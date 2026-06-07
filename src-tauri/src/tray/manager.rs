/// Tray Manager - System tray management module
/// 
/// [Phase 7 - System residence]:
/// 
/// Features:
/// 1. Create system tray icon
/// 2. Right-click menu (Lock / Dashboard / Quit) with i18n support
/// 3. Left-click toggle main search window display
/// 4. Background residence (Daemon): Intercept window close event, change to hide
/// 
/// Design philosophy:
/// - When user clicks X to close window, don't exit program, hide to tray instead
/// - Only via tray menu "Quit" can truly exit
/// - Similar to Telegram Desktop / Discord / Raycast background residence mode

use tauri::{
    AppHandle, Emitter, Manager, PhysicalPosition,
    menu::{Menu, MenuItem},
    tray::{TrayIconBuilder, TrayIconEvent, MouseButton, MouseButtonState, TrayIcon},
};
use std::sync::Mutex;

/// Global tray handle for updating menu
static TRAY_HANDLE: Mutex<Option<TrayIcon<tauri::Wry>>> = Mutex::new(None);

/// Tray menu text translations
struct TrayMenuText {
    lock: &'static str,
    dashboard: &'static str,
    quit: &'static str,
}

/// Get tray menu text based on language
fn get_tray_text(language: &str) -> TrayMenuText {
    match language {
        "en-US" => TrayMenuText {
            lock: "Lock Vault",
            dashboard: "Dashboard",
            quit: "Quit",
        },
        "ja-JP" => TrayMenuText {
            lock: "Vaultをロック",
            dashboard: "ダッシュボード",
            quit: "終了",
        },
        "ko-KR" => TrayMenuText {
            lock: "Vault 잠금",
            dashboard: "대시보드",
            quit: "종료",
        },
        _ => TrayMenuText {
            lock: "锁定保险库",
            dashboard: "管理面板",
            quit: "退出程序",
        },
    }
}

/// Initialize system tray
///
/// [Execution flow]:
/// 1. Create tray icon (using Tauri default icon or custom icon)
/// 2. Build right-click menu with current language
/// 3. Register left-click event (Toggle main window)
/// 4. Register menu item click events (ONCE — never re-register)
pub fn setup_system_tray(app: &AppHandle) -> Result<(), Box<dyn std::error::Error>> {
    println!("[Tray] Initializing system tray...");

    // 1. Register menu event handler ONCE (before any menu is built)
    register_menu_events(app);

    // 2. Get current language setting from database
    let language = get_current_language(app);
    println!("[Tray] Using language: {}", language);

    // 3. Build tray menu with localized text
    let menu = build_tray_menu(app, &language)?;

    // 4. Load tray icon (using Tauri built-in icon resource)
    let icon = app.default_window_icon()
        .ok_or("Failed to load app icon")?
        .clone();

    // 5. Create tray icon and store handle for later updates
    // 🔥 FIXED: macOS-specific template icon for dark mode compatibility
    let tray = TrayIconBuilder::new()
        .icon(icon)
        .icon_as_template(cfg!(target_os = "macos"))  // true on macOS, false elsewhere
        .menu(&menu)
        .show_menu_on_left_click(false)  // 🔥 Key: Disable left-click popup menu
        .on_tray_icon_event(|tray, event| {
            // Left-click event
            if let TrayIconEvent::Click {
                button: MouseButton::Left,
                button_state: MouseButtonState::Up,
                ..
            } = event
            {
                let app = tray.app_handle();
                if let Err(e) = toggle_main_window(app) {
                    eprintln!("[Tray] Failed to toggle main window: {}", e);
                }
            }
        })
        .build(app)?;

    // Store tray handle globally for menu updates
    *TRAY_HANDLE.lock().unwrap() = Some(tray);

    println!("[Tray] System tray initialized successfully");

    Ok(())
}

/// Register menu click events (called ONCE during setup)
///
/// IMPORTANT: Must only be called once. Re-registering on_menu_event
/// causes WebView2 crashes when the tray context menu is shown.
fn register_menu_events(app: &AppHandle) {
    let app_handle = app.clone();
    app.on_menu_event(move |app, event| {
        match event.id().as_ref() {
            "lock" => {
                println!("[Tray] Menu: Lock Vault clicked");
                if let Err(e) = handle_lock_vault(&app_handle) {
                    eprintln!("[Tray] Failed to lock vault: {}", e);
                }
            }
            "dashboard" => {
                println!("[Tray] Menu: Dashboard clicked");
                if let Err(e) = handle_open_dashboard(&app_handle) {
                    eprintln!("[Tray] Failed to open dashboard: {}", e);
                }
            }
            "quit" => {
                println!("[Tray] Menu: Quit clicked");
                handle_quit(&app_handle);
            }
            _ => {}
        }
    });
}

/// Get current language from database
fn get_current_language(app: &AppHandle) -> String {
    let app_data_dir = match app.path().app_data_dir() {
        Ok(dir) => dir,
        Err(_) => return "zh-CN".to_string(),
    };
    
    let db_path = app_data_dir.join("vault.db");
    
    match rusqlite::Connection::open(&db_path) {
        Ok(conn) => {
            match crate::database::sqlite::get_metadata(&conn, "language") {
                Ok(Some(lang)) => lang,
                _ => "zh-CN".to_string(),
            }
        }
        Err(_) => "zh-CN".to_string(),
    }
}

/// Update tray menu with new language
/// 
/// This function should be called when user changes language in settings
pub fn update_tray_menu(app: &AppHandle, language: &str) -> Result<(), Box<dyn std::error::Error>> {
    println!("[Tray] Updating tray menu to language: {}", language);
    
    // Rebuild menu with new language  
    let menu = build_tray_menu(app, language)?;
    
    // Update menu on the stored tray handle
    let tray_guard = TRAY_HANDLE.lock().unwrap();
    if let Some(tray) = tray_guard.as_ref() {
        tray.set_menu(Some(menu))?;
        println!("[Tray] Tray menu updated successfully");
    } else {
        eprintln!("[Tray] Tray handle not found");
    }
    
    Ok(())
}

/// Build tray menu (menu items only, event handler registered elsewhere)
///
/// Menu items with i18n support:
/// - Lock Vault / 锁定保险库
/// - Dashboard / 管理面板
/// - --- (Separator)
/// - Quit / 退出程序
fn build_tray_menu(app: &AppHandle, language: &str) -> Result<Menu<tauri::Wry>, Box<dyn std::error::Error>> {
    let text = get_tray_text(language);

    // Create menu items with localized text
    let lock_item = MenuItem::with_id(app, "lock", text.lock, true, None::<&str>)?;
    let dashboard_item = MenuItem::with_id(app, "dashboard", text.dashboard, true, None::<&str>)?;
    let quit_item = MenuItem::with_id(app, "quit", text.quit, true, None::<&str>)?;

    // Assemble menu
    let menu = Menu::with_items(
        app,
        &[
            &lock_item,
            &dashboard_item,
            &tauri::menu::PredefinedMenuItem::separator(app)?,
            &quit_item,
        ],
    )?;

    Ok(menu)
}

/// Toggle main search window display
/// 
/// [Behavior]:
/// - If window is hidden → Show and focus
/// - If window is shown → Hide
fn toggle_main_window(app: &AppHandle) -> Result<(), Box<dyn std::error::Error>> {
    if let Some(window) = app.get_webview_window("main") {
        if window.is_visible()? {
            println!("[Tray] Hiding main window");
            window.hide()?;
        } else {
            println!("[Tray] Showing main window");
            window.show()?;
            window.set_focus()?;
            
            // Center the window
            if let Ok(monitor) = window.current_monitor() {
                if let Some(monitor) = monitor {
                    let monitor_size = monitor.size();
                    let monitor_pos = monitor.position();
                    let window_size = window.outer_size()?;
                    
                    let x = monitor_pos.x + (monitor_size.width as i32 - window_size.width as i32) / 2;
                    let y = monitor_pos.y + (monitor_size.height as i32 - window_size.height as i32) / 2;
                    
                    window.set_position(PhysicalPosition::new(x, y))?;
                }
            }
        }
    } else {
        eprintln!("[Tray] Main window not found");
    }

    Ok(())
}

/// Handle Lock Vault menu item
/// 
/// [Behavior]:
/// 1. Call StateManager to transition to Locked state
/// 2. Broadcast vault://lock-triggered event to all windows
fn handle_lock_vault(app: &AppHandle) -> Result<(), Box<dyn std::error::Error>> {
    // Get global state
    let state = app.state::<crate::commands::vault::AppState>();
    
    // Check if already locked
    if !state.state_manager.is_unlocked() {
        println!("[Tray] Vault is already locked");
        return Ok(());
    }

    // Execute lock
    state.state_manager.transition_to_locked();
    println!("[Tray] Vault locked successfully");

    // Broadcast lock event
    app.emit("vault://lock-triggered", ())?;

    Ok(())
}

/// Handle Open Dashboard menu item
/// 
/// [Behavior]:
/// 1. Call open_dashboard_window command
/// 2. If window already exists, focus directly
/// 3. If doesn't exist, create new window
fn handle_open_dashboard(app: &AppHandle) -> Result<(), Box<dyn std::error::Error>> {
    // Call existing Dashboard open logic
    tauri::async_runtime::block_on(async {
        crate::commands::settings::open_dashboard_window(app.clone())
            .await
            .map_err(|e| e.into())
    })
}

/// Handle Quit menu item
/// 
/// [Behavior]:
/// Completely exit program (not just hide window)
fn handle_quit(app: &AppHandle) {
    println!("[Tray] Quitting application...");
    app.exit(0);
}

/// Register window close interceptor (Daemon mode)
/// 
/// [Phase 7 - Background residence core mechanism]:
/// 
/// Listen for CloseRequested events on all windows:
/// - Intercept default close operation
/// - Change to window.hide()
/// - Keep application always resident in background
/// 
/// [Note]:
/// User can only truly exit via tray menu "Quit"
pub fn register_close_interceptor(app: &AppHandle) {
    println!("[Tray] Registering close interceptor for daemon mode...");

    // Register close interceptor for all windows
    for (_label, window) in app.webview_windows() {
        let window_clone = window.clone();
        
        window.on_window_event(move |event| {
            if let tauri::WindowEvent::CloseRequested { api, .. } = event {
                println!("[Tray] Close requested for window: {}", window_clone.label());
                
                // Prevent default close behavior
                api.prevent_close();
                
                // Hide window instead of destroying it (daemon mode)
                // This keeps the window instance alive and React state preserved
                if let Err(e) = window_clone.hide() {
                    eprintln!("[Tray] Failed to hide window: {}", e);
                } else {
                    println!("[Tray] Window hidden (daemon mode)");
                }
            }
        });
    }

    println!("[Tray] Close interceptor registered");
}
