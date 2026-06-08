/// Settings related IPC commands
/// 
/// v1.0
/// Responsibilities:
/// - Dashboard window management
/// - Heartbeat mechanism (for auto-lock)
/// - App settings related operations

use tauri::{Manager, PhysicalPosition, Position, State, WebviewUrl, WebviewWindowBuilder, Emitter};

use crate::commands::vault::AppState;
use crate::crypto::{aes, argon2};
use crate::database::sqlite;

/// Open Dashboard window
/// 
/// v1.0
/// Flow:
/// 1. Check vault state - if locked, mark as pending and focus main window
/// 2. Check if Dashboard window already exists → wait for window_ready
/// 3. If not exists, create new window (hidden, will be shown by window_ready)
#[tauri::command]
pub async fn open_dashboard_window(app: tauri::AppHandle) -> Result<(), String> {
    // Check vault state: if locked, don't open dashboard - focus main window instead
    let app_state = app.state::<AppState>();
    if !app_state.state_manager.is_unlocked() {
        println!("[Dashboard] Vault is locked, focusing main window and marking pending");
        
        // Mark that dashboard was requested - will auto-open after unlock
        let mut pending = app_state.pending_dashboard.lock().unwrap();
        *pending = true;
        
        // Bring main window on-screen and focus
        if let Some(main_window) = app.get_webview_window("main") {
            main_window.show()
                .map_err(|e| format!("Failed to show main window: {}", e))?;
            let _ = main_window.center();
            main_window.set_focus()
                .map_err(|e| format!("Failed to focus main window: {}", e))?;
            println!("[Dashboard] Main window shown and focused");
        }
        
        return Ok(());
    }
    
    // 🔥 FIXED: Check if window already exists (including hidden state)
    if let Some(window) = app.get_webview_window("dashboard") {
        println!("[Dashboard] Window exists, showing and focusing it");
        window.show()
            .map_err(|e| format!("Failed to show dashboard: {}", e))?;
        window.set_focus()
            .map_err(|e| format!("Failed to focus dashboard: {}", e))?;
        
        // Hide main search window
        if let Some(main_window) = app.get_webview_window("main") {
            let _ = main_window.hide();
            println!("[Dashboard] Main window hidden");
        }
        
        return Ok(());
    }

    // Create new window (first time opening dashboard)
    let _dashboard_window = WebviewWindowBuilder::new(
        &app,
        "dashboard",
        WebviewUrl::default(),
    )
    .title("AIKeyVault - Dashboard")
    .inner_size(1280.0, 800.0)
    .center()
    .resizable(false)
    .maximizable(false)
    .fullscreen(false)
    .decorations(true)
    .visible(false)  // Start hidden, will be shown by window_ready
    .build()
    .map_err(|e| format!("Failed to create dashboard window: {}", e))?;

    println!("[Dashboard] New dashboard window created (hidden, waiting for ready signal)");

    // Hide main search window
    if let Some(main_window) = app.get_webview_window("main") {
        let _ = main_window.hide();
        println!("[Dashboard] Main window hidden");
    }

    Ok(())
}

/// Heartbeat mechanism - Update last activity time
/// 
/// v1.0
/// Frontend calls this command on keyboard/mouse interaction (throttled to once per 5 seconds)
/// Used to renew auto-lock countdown
#[tauri::command]
pub async fn heartbeat(state: State<'_, AppState>) -> Result<(), String> {
    state.state_manager.update_last_activity();
    Ok(())
}

/// Get auto-lock timeout setting (seconds)
/// 
/// v1.0
/// Returns timeout value from database, default 300 (5 minutes)
#[tauri::command]
pub async fn window_ready(app: tauri::AppHandle) -> Result<(), String> {
    println!("[Window] Received window_ready signal");
    
    if let Some(window) = app.get_webview_window("dashboard") {
        let is_visible = window.is_visible().unwrap_or(false);
        println!("[Window] Dashboard window state - visible: {}", is_visible);
        
        if !is_visible {
            println!("[Window] Dashboard webview ready, showing window");
            
            // Center the window before showing
            window.center()
                .map_err(|e| format!("Failed to center dashboard: {}", e))?;
            
            window.show()
                .map_err(|e| format!("Failed to show dashboard: {}", e))?;
            
            window.set_focus()
                .map_err(|e| format!("Failed to focus dashboard: {}", e))?;
            
            println!("[Window] Dashboard window now visible and focused");
        } else {
            println!("[Window] Dashboard already visible, skipping show");
        }
    } else {
        println!("[Window] Warning: Dashboard window not found");
    }
    
    Ok(())
}

/// Get auto-lock timeout setting (seconds)
/// 
/// v1.0
/// Read user settings from database (supports 5min/15min/30min/never)
#[tauri::command]
pub async fn get_auto_lock_timeout(state: State<'_, AppState>) -> Result<i64, String> {
    let db = state.db.lock().unwrap();
    
    match crate::database::sqlite::get_metadata(&db, "auto_lock_timeout") {
        Ok(Some(timeout_str)) => {
            timeout_str.parse::<i64>()
                .map_err(|e| format!("Invalid timeout value: {}", e))
        }
        Ok(None) => Ok(300), // 默认 5 分钟
        Err(e) => Err(format!("Failed to read timeout: {}", e)),
    }
}

/// 应用设置数据结构
#[derive(Debug, serde::Serialize, serde::Deserialize)]
pub struct AppSettings {
    pub auto_lock_timeout: i64,      // Auto-lock timeout (seconds), 0 means never
    pub clipboard_clear_timeout: i64, // Clipboard clear timeout (seconds), 0 means never
    pub language: String,             // UI language: "zh-CN", "en-US", "ja-JP", "ko-KR"
}

/// Get app settings
/// 
/// v1.0
/// Return all configuration items
#[tauri::command]
pub async fn get_app_settings(state: State<'_, AppState>) -> Result<AppSettings, String> {
    let db = state.db.lock().unwrap();
    
    // 读取自动锁定超时
    let auto_lock_timeout = match crate::database::sqlite::get_metadata(&db, "auto_lock_timeout") {
        Ok(Some(val)) => val.parse::<i64>().unwrap_or(300),
        _ => 300, // 默认 5 分钟
    };
    
    // Read clipboard clear timeout
    let clipboard_clear_timeout = match crate::database::sqlite::get_metadata(&db, "clipboard_clear_timeout") {
        Ok(Some(val)) => val.parse::<i64>().unwrap_or(60),
        _ => 60, // Default 60 seconds
    };
    
    // Read language setting
    let language = match crate::database::sqlite::get_metadata(&db, "language") {
        Ok(Some(val)) => val,
        _ => "zh-CN".to_string(), // Default Chinese
    };
    
    Ok(AppSettings {
        auto_lock_timeout,
        clipboard_clear_timeout,
        language,
    })
}

/// Update app settings
/// 
/// v1.0
/// Save configuration to database, takes effect immediately
#[tauri::command]
pub async fn update_app_settings(
    app: tauri::AppHandle,
    settings: AppSettings,
    state: State<'_, AppState>,
) -> Result<(), String> {
    let db = state.db.lock().unwrap();
    
    // 保存自动锁定超时
    crate::database::sqlite::set_metadata(
        &db,
        "auto_lock_timeout",
        &settings.auto_lock_timeout.to_string()
    ).map_err(|e| format!("Failed to save auto_lock_timeout: {}", e))?;
    
    // Save clipboard clear timeout
    crate::database::sqlite::set_metadata(
        &db,
        "clipboard_clear_timeout",
        &settings.clipboard_clear_timeout.to_string()
    ).map_err(|e| format!("Failed to save clipboard_clear_timeout: {}", e))?;
    
    // Save language setting
    crate::database::sqlite::set_metadata(
        &db,
        "language",
        &settings.language
    ).map_err(|e| format!("Failed to save language: {}", e))?;
    
    // Release database lock before updating tray menu
    drop(db);
    
    // Update tray menu with new language
    if let Err(e) = crate::tray::update_tray_menu(&app, &settings.language) {
        eprintln!("[Settings] Failed to update tray menu: {}", e);
    }

    // Broadcast language change to ALL windows so they update i18n immediately
    app.emit("vault://language-changed", settings.language.clone())
        .map_err(|e| format!("Failed to emit language change event: {}", e))?;

    println!("[Settings] Updated: auto_lock={}s, clipboard={}s, language={}",
        settings.auto_lock_timeout, settings.clipboard_clear_timeout, settings.language);
    
    Ok(())
}

/// Change master password (batch re-encrypt all API Keys)
/// 
/// v1.0 - Key Rotation
/// 
/// Execution flow:
/// 1. Verify old master password
/// 2. Generate new Salt
/// 3. Derive new master key
/// 4. Use SQLite transaction to batch re-encrypt all VaultItems
/// 5. Update master password hash
/// 
/// Transaction protection mechanism:
/// Use SQLite Transaction to guarantee atomicity:
/// - Either all succeed and commit
/// - Or all rollback
/// - Prevent program crash causing disaster where some data uses old key, some uses new key
/// 
/// Memory safety:
/// - Old and new keys both use Zeroizing wrapper
/// - Plaintext API Key immediately dropped after re-encryption completes
/// - All sensitive data auto-cleared on transaction failure
#[tauri::command]
pub async fn change_master_password(
    old_password: String,
    new_password: String,
    state: State<'_, AppState>,
) -> Result<(), String> {
    println!("[ChangeMasterPassword] Starting password rotation...");

    let db = state.db.lock().unwrap();

    // 1. 验证旧主密码
    let stored_hash = sqlite::get_metadata(&db, "master_password_hash")
        .map_err(|e| format!("Failed to read password hash: {}", e))?
        .ok_or("No master password set")?;

    let is_valid = argon2::verify_master_password(&old_password, &stored_hash)
        .map_err(|e| format!("Password verification failed: {}", e))?;

    if !is_valid {
        return Err("Incorrect old password".to_string());
    }

    println!("[ChangeMasterPassword] Old password verified");

    // 2. Read old Salt and derive old master key
    // FIXED: Use "salt" key to match setup_master_password convention
    let old_salt_b64 = sqlite::get_metadata(&db, "salt")
        .map_err(|e| format!("Failed to read old salt: {}", e))?
        .ok_or("Salt not found")?;

    let old_salt = base64::Engine::decode(&base64::engine::general_purpose::STANDARD, old_salt_b64)
        .map_err(|e| format!("Failed to decode old salt: {}", e))?;

    let old_master_key = argon2::derive_master_key(&old_password, &old_salt)
        .map_err(|e| format!("Failed to derive old key: {}", e))?;

    println!("[ChangeMasterPassword] Old master key derived");

    // 3. Generate new Salt and derive new master key
    let new_salt = argon2::generate_salt();
    let new_master_key = argon2::derive_master_key(&new_password, &new_salt)
        .map_err(|e| format!("Failed to derive new key: {}", e))?;

    println!("[ChangeMasterPassword] New master key derived");

    // 4. Generate new password hash
    let new_hash = argon2::hash_master_password(&new_password, &new_salt)
        .map_err(|e| format!("Failed to hash new password: {}", e))?;

    // 5. Query all VaultItems
    let items = sqlite::query_all_items(&db)
        .map_err(|e| format!("Failed to query vault items: {}", e))?;

    println!("[ChangeMasterPassword] Found {} items to re-encrypt", items.len());

    // 6. Start SQLite transaction (core protection mechanism)
    // 
    // Transaction's role:
    // - Batch re-encryption is high-risk operation, crash midway causes permanent data corruption
    // - Transaction provides atomicity guarantee:
    //   * If any record re-encryption fails, entire transaction rolls back
    //   * Database maintains consistent state using old key
    //   * User can retry, no data loss
    // - All changes before Commit are in memory, disk file unaffected
    // - Only after Commit succeeds, new key takes effect
    let tx = db.unchecked_transaction()
        .map_err(|e| format!("Failed to start transaction: {}", e))?;

    println!("[ChangeMasterPassword] Transaction started, entering critical section...");

    // 7. Batch re-encrypt each record
    for item in items.iter() {
        // 7.1 Decrypt using old key
        let plaintext = aes::decrypt_data(&item.secret_cipher, &old_master_key, &item.nonce)
            .map_err(|e| format!("Failed to decrypt item {}: {}", item.id, e))?;

        // 7.2 Generate new Nonce (each record must have independent Nonce)
        let new_nonce = aes::generate_nonce();

        // 7.3 Encrypt using new key
        let new_ciphertext = aes::encrypt_data(&plaintext, &new_master_key, &new_nonce)
            .map_err(|e| format!("Failed to encrypt item {}: {}", item.id, e))?;

        // 7.4 Update database (within transaction)
        tx.execute(
            "UPDATE vault_items SET secret_cipher = ?1, nonce = ?2, updated_at = ?3 WHERE id = ?4",
            rusqlite::params![
                new_ciphertext,
                new_nonce,
                chrono::Utc::now().timestamp(),
                item.id
            ],
        ).map_err(|e| format!("Failed to update item {}: {}", item.id, e))?;

        println!("[ChangeMasterPassword] Re-encrypted item: {}", item.title);
    }

    // 8. Update master password hash and Salt (in transaction)
    // FIXED: Use "salt" key to match setup_master_password convention
    tx.execute(
        "INSERT OR REPLACE INTO app_metadata (key, value) VALUES ('master_password_hash', ?1)",
        [&new_hash],
    ).map_err(|e| format!("Failed to update password hash: {}", e))?;

    let new_salt_b64 = base64::Engine::encode(&base64::engine::general_purpose::STANDARD, &new_salt);
    tx.execute(
        "INSERT OR REPLACE INTO app_metadata (key, value) VALUES ('salt', ?1)",
        [&new_salt_b64],
    ).map_err(|e| format!("Failed to update salt: {}", e))?;

    // 9. Commit transaction (critical moment)
    // 
    // Commit guarantee:
    // - If commit() returns Ok, all changes are persisted to disk
    // - If commit() returns Err, transaction auto-rollback, database restored to old state
    // - From this moment, old key is invalid, new key takes effect
    tx.commit()
        .map_err(|e| format!("Failed to commit transaction: {}", e))?;

    println!("[ChangeMasterPassword] Transaction committed successfully");
    println!("[ChangeMasterPassword] Password rotation complete!");
    println!("[ChangeMasterPassword] Old and new master keys have been zeroized");

    // 10. Update key in StateManager (if currently in Unlocked state)
    if state.state_manager.is_unlocked() {
        // Immediately lock, force user to unlock with new password
        state.state_manager.transition_to_locked();
        println!("[ChangeMasterPassword] Vault locked, please unlock with new password");
    }

    Ok(())
}

/// Export Vault data to .kvx file
/// 
/// v1.0 - Encrypted Backup
/// 
/// Parameters:
/// - export_password: User-defined export password (independent from master password)
/// - file_path: File path to save (selected by frontend via dialog plugin)
#[tauri::command]
pub async fn export_vault_data(
    export_password: String,
    file_path: String,
    state: State<'_, AppState>,
) -> Result<(), String> {
    // Only allow export in Unlocked state
    if !state.state_manager.is_unlocked() {
        return Err("Vault is locked".to_string());
    }

    // Get master key to decrypt secrets before export
    let master_key_guard = state.state_manager.get_master_key()
        .ok_or("Master key not available")?;
    
    let db = state.db.lock().unwrap();

    // Call KVX export module with master key
    crate::import_export::kvx::export_data(&db, &export_password, &file_path, &master_key_guard)
}

/// Import .kvx file to Vault
/// 
/// v1.0 - Data Migration
/// 
/// Parameters:
/// - import_password: Decryption password provided by user
/// - file_path: .kvx file path (selected by frontend via dialog plugin)
/// 
/// Returns: Number of successfully imported entries
#[tauri::command]
pub async fn import_vault_data(
    import_password: String,
    file_path: String,
    state: State<'_, AppState>,
) -> Result<usize, String> {
    // Only allow import in Unlocked state
    if !state.state_manager.is_unlocked() {
        return Err("Vault is locked".to_string());
    }

    // Get master key to re-encrypt imported secrets
    let master_key_guard = state.state_manager.get_master_key()
        .ok_or("Master key not available")?;

    let db = state.db.lock().unwrap();

    // Call KVX import module with master key
    crate::import_export::kvx::import_data(&db, &import_password, &file_path, &master_key_guard)
}

/// Enable autostart (launch at system boot)
/// 
/// v1.0
#[tauri::command]
pub async fn enable_startup(app: tauri::AppHandle) -> Result<(), String> {
    crate::startup::manager::enable_autostart(&app)
}

/// Disable autostart
/// 
/// v1.0
#[tauri::command]
pub async fn disable_startup(app: tauri::AppHandle) -> Result<(), String> {
    crate::startup::manager::disable_autostart(&app)
}

/// Check if autostart is enabled
/// 
/// v1.0
#[tauri::command]
pub async fn is_startup_enabled(app: tauri::AppHandle) -> Result<bool, String> {
    crate::startup::manager::is_autostart_enabled(&app)
}

/// Get current global shortcut
/// 
/// v1.0
#[tauri::command]
pub async fn get_global_shortcut(app: tauri::AppHandle) -> Result<String, String> {
    crate::shortcut::manager::get_current_shortcut(&app)
}

/// Update global shortcut
/// 
/// v1.0
#[tauri::command]
pub async fn update_global_shortcut(app: tauri::AppHandle, shortcut: String) -> Result<(), String> {
    crate::shortcut::manager::update_global_shortcut(&app, &shortcut)?;
    
    // Broadcast shortcut update event to all windows
    app.emit("vault://shortcut-updated", shortcut.clone())
        .map_err(|e| format!("Failed to emit shortcut update event: {}", e))?;
    
    println!("[Settings] Broadcasted shortcut update: {}", shortcut);
    Ok(())
}

/// Trigger search page refresh (emit event to main window)
///
/// v1.0
#[tauri::command]
pub async fn trigger_search_refresh(app: tauri::AppHandle) -> Result<(), String> {
    app.emit("vault://focus-input", ())
        .map_err(|e| format!("Failed to emit refresh event: {}", e))?;
    println!("[Settings] Emitted vault://focus-input event to refresh search page");
    Ok(())
}

// ============ Update Check ============

/// Update check response returned to frontend
#[derive(Debug, serde::Serialize)]
pub struct UpdateInfo {
    pub has_update: bool,
    pub current_version: String,
    pub latest_version: String,
    pub release_url: String,
    pub release_notes: String,
}

/// Check GitHub Releases for a newer version
///
/// v1.0.2 — uses the public GitHub API (no auth needed, 60 req/hour).
/// Parses repository URL from Cargo.toml to build the API endpoint.
#[tauri::command]
pub async fn check_for_update() -> Result<UpdateInfo, String> {
    let current_version = env!("CARGO_PKG_VERSION").to_string();
    let repo_url = env!("CARGO_PKG_REPOSITORY");

    // Extract "owner/repo" from the repository URL
    let (owner, repo) = parse_github_repo(repo_url)?;

    let api_url = format!(
        "https://api.github.com/repos/{}/{}/releases/latest",
        owner, repo
    );

    println!("[UpdateCheck] Fetching: {}", api_url);

    let client = reqwest::Client::builder()
        .user_agent("AIKeyVault-UpdateCheck/1.0")
        .timeout(std::time::Duration::from_secs(10))
        .build()
        .map_err(|e| format!("Failed to create HTTP client: {}", e))?;

    let response = client
        .get(&api_url)
        .header("Accept", "application/vnd.github+json")
        .header("X-GitHub-Api-Version", "2022-11-28")
        .send()
        .await
        .map_err(|e| format!("Network error: {}", e))?;

    if !response.status().is_success() {
        return Err(format!("GitHub API returned: {}", response.status()));
    }

    let release: serde_json::Value = response
        .json()
        .await
        .map_err(|e| format!("Failed to parse response: {}", e))?;

    let latest_tag = release["tag_name"]
        .as_str()
        .unwrap_or("v0.0.0")
        .trim_start_matches('v')
        .to_string();

    let release_url = release["html_url"]
        .as_str()
        .unwrap_or(repo_url)
        .to_string();

    let release_notes = release["body"]
        .as_str()
        .unwrap_or("")
        .to_string();

    // Simple semver comparison: strip 'v' prefix and compare
    let has_update = compare_versions(&latest_tag, &current_version);

    println!(
        "[UpdateCheck] current={}, latest={}, has_update={}",
        current_version, latest_tag, has_update
    );

    Ok(UpdateInfo {
        has_update,
        current_version,
        latest_version: latest_tag,
        release_url,
        release_notes,
    })
}

/// Parse "owner/repo" from GitHub URL like "https://github.com/owner/repo"
fn parse_github_repo(url: &str) -> Result<(&str, &str), String> {
    // Strip trailing slash and .git suffix
    let url = url.trim_end_matches('/').trim_end_matches(".git");

    // Find "github.com/" prefix
    let after_github = url
        .find("github.com/")
        .map(|i| &url[i + 11..])
        .ok_or_else(|| format!("Not a GitHub URL: {}", url))?;

    let parts: Vec<&str> = after_github.split('/').collect();
    if parts.len() < 2 {
        return Err(format!("Cannot parse owner/repo from: {}", url));
    }

    Ok((parts[0], parts[1]))
}

/// Simple semver comparison: returns true if `latest` > `current`
fn compare_versions(latest: &str, current: &str) -> bool {
    let parse = |v: &str| -> Vec<u32> {
        v.split(|c: char| !c.is_ascii_digit())
            .filter(|s| !s.is_empty())
            .map(|s| s.parse::<u32>().unwrap_or(0))
            .collect()
    };

    let latest_parts = parse(latest);
    let current_parts = parse(current);

    for (l, c) in latest_parts.iter().zip(current_parts.iter()) {
        match l.cmp(c) {
            std::cmp::Ordering::Greater => return true,
            std::cmp::Ordering::Less => return false,
            std::cmp::Ordering::Equal => continue,
        }
    }

    // If all compared parts equal, longer version is newer (e.g. 1.0.1 > 1.0)
    latest_parts.len() > current_parts.len()
}

/// Open a URL in the system default browser
///
/// Uses platform-specific commands — no extra dependency needed.
#[tauri::command]
pub async fn open_url(url: String) -> Result<(), String> {
    println!("[OpenUrl] Opening: {}", url);

    #[cfg(target_os = "windows")]
    {
        std::process::Command::new("cmd")
            .args(["/c", "start", "", &url])
            .spawn()
            .map_err(|e| format!("Failed to open URL: {}", e))?;
    }

    #[cfg(target_os = "macos")]
    {
        std::process::Command::new("open")
            .arg(&url)
            .spawn()
            .map_err(|e| format!("Failed to open URL: {}", e))?;
    }

    #[cfg(target_os = "linux")]
    {
        std::process::Command::new("xdg-open")
            .arg(&url)
            .spawn()
            .map_err(|e| format!("Failed to open URL: {}", e))?;
    }

    Ok(())
}

