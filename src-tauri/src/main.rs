// Prevent console window on Windows in release mode
#![cfg_attr(not(debug_assertions), windows_subsystem = "windows")]

// 模块声明
mod clipboard;
mod commands;
mod crypto;
mod database;
mod import_export;
mod shortcut;
mod startup;
mod tray;
mod vault;

use commands::vault::AppState;
use database::sqlite;
use std::sync::{Arc, Mutex};
use tauri::{Emitter, Manager};
use vault::state::{StateManager, VaultState};

fn main() {
    tauri::Builder::default()
        .plugin(tauri_plugin_clipboard_manager::init())
        .plugin(tauri_plugin_global_shortcut::Builder::new().build())
        .plugin(tauri_plugin_dialog::init())
        .plugin(tauri_plugin_autostart::init(tauri_plugin_autostart::MacosLauncher::LaunchAgent, Some(vec!["--hidden"])))
        .invoke_handler(tauri::generate_handler![
            // v1.0 鉴权相关 Commands
            commands::vault::get_initial_state,
            commands::vault::setup_master_password,
            commands::vault::unlock_vault,
            // v1.0 Vault CRUD Commands
            commands::vault::search_vault_items,
            commands::vault::copy_vault_item_to_clipboard,
            commands::vault::lock_vault,
            commands::vault::get_vault_state,
            commands::vault::get_all_vault_items,
            commands::vault::create_vault_item,
            commands::vault::update_vault_item,
            commands::vault::delete_vault_item,
            commands::vault::reveal_vault_item_secret, // v1.0
            clipboard::manager::clear_clipboard_command,
            // v1.0 Settings & Window Management
            commands::settings::open_dashboard_window,
            commands::settings::heartbeat,
            commands::settings::get_auto_lock_timeout,
            commands::settings::window_ready,
            // v1.0 Dynamic Settings
            commands::settings::get_app_settings,
            commands::settings::update_app_settings,
            // v1.0 Import/Export & Password Rotation
            commands::settings::change_master_password,
            commands::settings::export_vault_data,
            commands::settings::import_vault_data,
            // v1.0 Autostart
            commands::settings::enable_startup,
            commands::settings::disable_startup,
            commands::settings::is_startup_enabled,
            // v1.0 Global Shortcut
            commands::settings::get_global_shortcut,
            commands::settings::update_global_shortcut,
            commands::settings::trigger_search_refresh,
            // v1.0.2 Update Check
            commands::settings::check_for_update,
            commands::settings::open_url,
        ])
        .setup(|app| {
            println!("[AIKeyVault] v1.0 - Initializing with real authentication...");
            let start_hidden = std::env::args().any(|arg| arg == "--hidden");

            // 1. 初始化数据库
            let app_data_dir = app
                .path()
                .app_data_dir()
                .expect("Failed to get app data directory");

            std::fs::create_dir_all(&app_data_dir)
                .expect("Failed to create app data directory");

            let db_path = app_data_dir.join("vault.db");
            println!("[Database] Path: {:?}", db_path);

            let db = sqlite::initialize_database(db_path)
                .expect("Failed to initialize database");
            let db = Arc::new(Mutex::new(db));

            // 2. Check VaultState (cold start detection)
            let initial_state = {
                let conn = db.lock().unwrap();

                // Check if master password hash exists
                match sqlite::get_metadata(&conn, "master_password_hash") {
                    Ok(Some(_)) => {
                        println!("[StateDetection] Found master password hash -> Locked");
                        VaultState::Locked
                    }
                    _ => {
                        println!("[StateDetection] No master password hash -> FirstLaunch");
                        VaultState::FirstLaunch
                    }
                }
            };

            // 3. Create StateManager
            let state_manager = Arc::new(StateManager::new(initial_state));

            println!("[AIKeyVault] Initial VaultState: {:?}", state_manager.get_state());

            // 4. Create global state
            let app_state = AppState {
                state_manager: state_manager.clone(),
                db: db.clone(),
                pending_dashboard: Arc::new(Mutex::new(false)),
            };

            // 5. Inject global state
            app.manage(app_state);

            // 6. Register global shortcut
            let app_handle = app.handle().clone();
            if let Err(e) = shortcut::manager::register_global_shortcut(&app_handle) {
                eprintln!("[Shortcut] Failed to register: {}", e);
            }

            // 7. Initialize system tray (v1.0)
            if let Err(e) = tray::manager::setup_system_tray(&app.handle()) {
                eprintln!("[Tray] Failed to initialize system tray: {}", e);
            }

            // 8. Register window close interceptor (Daemon mode) (v1.0)
            tray::manager::register_close_interceptor(&app.handle());

            // 9. Initialize autostart (v1.0)
            if let Err(e) = startup::manager::init_autostart(&app.handle()) {
                eprintln!("[Startup] Failed to initialize autostart: {}", e);
            }

            // The configured main window starts hidden. Normal launches explicitly
            // show it; autostart launches pass --hidden and stay resident in tray.
            if start_hidden {
                println!("[Startup] Hidden autostart launch detected; main window stays hidden");
            } else if let Some(main_window) = app.get_webview_window("main") {
                if let Err(e) = main_window.show() {
                    eprintln!("[Window] Failed to show main window: {}", e);
                }
                if let Err(e) = main_window.set_focus() {
                    eprintln!("[Window] Failed to focus main window: {}", e);
                }
            }

            // Note: Dashboard window is no longer pre-created at startup
            // It will be created on-demand when user first opens it
            // This avoids complexity with hidden window state management

            // 10. Start auto-lock guardian thread (v1.0 - dynamic timeout + sleep-aware)
            let state_manager_guard = state_manager.clone();
            let app_handle_guard = app.handle().clone();
            let db_guard = db.clone();

            tauri::async_runtime::spawn(async move {
                loop {
                    // Check every 10 seconds
                    tokio::time::sleep(tokio::time::Duration::from_secs(10)).await;

                    // Read timeout setting from database (v1.0)
                    let timeout = {
                        let conn = db_guard.lock().unwrap();
                        match sqlite::get_metadata(&conn, "auto_lock_timeout") {
                            Ok(Some(val)) => val.parse::<i64>().unwrap_or(300),
                            _ => 300, // Default 5 minutes
                        }
                    };

                    // If timeout is 0, never auto-lock
                    if timeout == 0 {
                        continue;
                    }

                    // 🔥 FIXED: Use system clock for sleep-aware detection
                    // This ensures auto-lock triggers even after system resume from sleep
                    if state_manager_guard.should_auto_lock(timeout) {
                        let last_activity = state_manager_guard.get_last_activity_time();
                        let now = std::time::SystemTime::now()
                            .duration_since(std::time::UNIX_EPOCH)
                            .unwrap()
                            .as_secs() as i64;
                        let elapsed = now - last_activity;

                        println!("[AutoLock] Timeout detected ({}s elapsed, threshold: {}s), locking vault...", elapsed, timeout);

                        // Execute lock
                        state_manager_guard.transition_to_locked();

                        // Broadcast lock event to all windows
                        let _ = app_handle_guard.emit("vault://lock-triggered", ());

                        println!("[AutoLock] Vault locked automatically");
                    }
                }
            });

            println!("[AIKeyVault] v1.0 - Initialization Complete");
            println!("[AIKeyVault] v1.0 - Auto-lock guardian started");
            println!("[AIKeyVault] v1.0 - System tray & daemon mode enabled");
            println!("[AIKeyVault] Ready for authentication flow");

            Ok(())
        })
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
