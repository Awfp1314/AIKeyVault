/// Vault related IPC commands
/// 
/// All commands follow IPC isolation principles:
/// - Frontend only passes IDs, never receives plaintext API Keys
/// - Encryption/decryption operations are completed within Rust backend

use crate::vault::manager::{VaultItemMeta, VaultManager};
use crate::vault::state::StateManager;
use crate::clipboard::manager::write_to_clipboard_secure;
use rusqlite::Connection;
use std::sync::{Arc, Mutex};
use tauri::{Emitter, Manager, State};

/// Global state container
pub struct AppState {
    pub state_manager: Arc<StateManager>,
    pub db: Arc<Mutex<Connection>>,
    pub pending_dashboard: Arc<Mutex<bool>>,
}

/// Search VaultItems
/// 
/// v1.0 implementation
/// Parameters:
/// - query: Search keyword
/// 
/// Returns: Safe metadata list
/// 
/// Security check: Must be in Unlocked state
#[tauri::command]
pub async fn search_vault_items(
    query: String,
    state: State<'_, AppState>,
) -> Result<Vec<VaultItemMeta>, String> {
    // Security check: Must be in Unlocked state
    if !state.state_manager.is_unlocked() {
        return Err("Vault is locked".to_string());
    }

    // Get master key
    let master_key_guard = state.state_manager.get_master_key()
        .ok_or("Master key not available")?;
    
    let master_key = Arc::new(Mutex::new(Some(master_key_guard)));

    // Create VaultManager
    let manager = VaultManager::new(state.db.clone(), master_key);

    // Execute search
    manager.search_items(query)
}

/// Copy API Key to clipboard
/// 
/// Security closed-loop operation - v1.0 implementation
/// Parameters:
/// - item_id: VaultItem ID
/// - app: Tauri AppHandle (for window control)
/// 
/// Flow:
/// 1. Security check: Must be in Unlocked state
/// 2. Read clipboard_clear_timeout setting from database
/// 3. Query database
/// 4. Decrypt secret_cipher
/// 5. Inject privacy mark and write to clipboard
/// 6. Update usage statistics
/// 7. Hide search window
/// 8. Return success (no plaintext returned)
#[tauri::command]
pub async fn copy_vault_item_to_clipboard(
    item_id: String,
    app: tauri::AppHandle,
    state: State<'_, AppState>,
) -> Result<(), String> {
    // Security check: Must be in Unlocked state
    if !state.state_manager.is_unlocked() {
        return Err("Vault is locked".to_string());
    }

    // Read clipboard_clear_timeout setting from database
    let clipboard_timeout = {
        let db = state.db.lock().unwrap();
        match crate::database::sqlite::get_metadata(&db, "clipboard_clear_timeout") {
            Ok(Some(val)) => val.parse::<u32>().unwrap_or(60),
            _ => 60, // Default 60 seconds
        }
    };

    // Get master key
    let master_key_guard = state.state_manager.get_master_key()
        .ok_or("Master key not available")?;
    
    let master_key = Arc::new(Mutex::new(Some(master_key_guard)));

    // Create VaultManager
    let manager = VaultManager::new(state.db.clone(), master_key);

    // Copy to clipboard (internally decrypts and updates statistics)
    manager.copy_to_clipboard(item_id.clone())?;

    // Get decrypted secret
    let decrypted_secret = manager.get_decrypted_secret(&item_id)?;
    
    // Write to system clipboard with user-configured timeout
    write_to_clipboard_secure(app.clone(), decrypted_secret, clipboard_timeout).await?;

    println!("[Clipboard] Copied with auto-clear timeout: {}s", clipboard_timeout);

    // Hide search window
    if let Some(window) = app.get_webview_window("main") {
        let _ = window.hide();
    }

    Ok(())
}

/// Lock Vault
/// 
/// v1.0 implementation
/// Flow:
/// 1. Zeroize master encryption key
/// 2. Clear sensitive cache
/// 3. Transition state to Locked
/// 4. Broadcast lock event (vault://lock-triggered)
#[tauri::command]
pub async fn lock_vault(
    app: tauri::AppHandle,
    state: State<'_, AppState>,
) -> Result<(), String> {
    // Transition to Locked state (automatically zeroize master key)
    state.state_manager.transition_to_locked();

    // Broadcast lock event
    let _ = app.emit("vault://lock-triggered", ());

    // Reset pending dashboard flag
    let mut pending = state.pending_dashboard.lock().unwrap();
    *pending = false;

    // Hide main window
    if let Some(window) = app.get_webview_window("main") {
        let _ = window.hide();
    }

    Ok(())
}

/// Get current VaultState
#[tauri::command]
pub async fn get_vault_state(state: State<'_, AppState>) -> Result<String, String> {
    let vault_state = state.state_manager.get_state();
    
    let state_str = match vault_state {
        crate::vault::state::VaultState::FirstLaunch => "FirstLaunch",
        crate::vault::state::VaultState::Locked => "Locked",
        crate::vault::state::VaultState::Unlocked => "Unlocked",
    };
    
    Ok(state_str.to_string())
}

/// Get all VaultItems (for Dashboard list)
#[tauri::command]
pub async fn get_all_vault_items(
    state: State<'_, AppState>,
) -> Result<Vec<VaultItemMeta>, String> {
    // Security check: Must be in Unlocked state
    if !state.state_manager.is_unlocked() {
        return Err("Vault is locked".to_string());
    }

    // Get master key
    let master_key_guard = state.state_manager.get_master_key()
        .ok_or("Master key not available")?;
    
    let master_key = Arc::new(Mutex::new(Some(master_key_guard)));

    // Create VaultManager
    let manager = VaultManager::new(state.db.clone(), master_key);

    // Get all items
    manager.get_all_items()
}

/// Create VaultItem
/// 
/// Parameters: Metadata from frontend + plaintext secret
/// Returns: Safe metadata (no ciphertext)
#[tauri::command]
pub async fn create_vault_item(
    title: String,
    provider_id: String,
    secret: String,
    tags: String,
    note: Option<String>,
    state: State<'_, AppState>,
) -> Result<VaultItemMeta, String> {
    // Security check: Must be in Unlocked state
    if !state.state_manager.is_unlocked() {
        return Err("Vault is locked".to_string());
    }

    // Get master key
    let master_key_guard = state.state_manager.get_master_key()
        .ok_or("Master key not available")?;
    
    let master_key = Arc::new(Mutex::new(Some(master_key_guard)));

    // Create VaultManager
    let manager = VaultManager::new(state.db.clone(), master_key);

    // Create VaultItem
    manager.create_item(title, provider_id, secret, tags, note)
}

/// Update VaultItem
/// 
/// Parameters: item_id, new metadata, and optionally new secret
/// Returns: Updated safe metadata
/// 
/// Security:
/// - If secret is Some, re-encrypt with new random nonce
/// - If secret is None, keep existing encryption
#[tauri::command]
pub async fn update_vault_item(
    item_id: String,
    title: String,
    provider_id: String,
    secret: Option<String>,
    tags: String,
    note: Option<String>,
    state: State<'_, AppState>,
) -> Result<VaultItemMeta, String> {
    // Security check: Must be in Unlocked state
    if !state.state_manager.is_unlocked() {
        return Err("Vault is locked".to_string());
    }

    // Get master key
    let master_key_guard = state.state_manager.get_master_key()
        .ok_or("Master key not available")?;
    
    let master_key = Arc::new(Mutex::new(Some(master_key_guard)));

    // Create VaultManager
    let manager = VaultManager::new(state.db.clone(), master_key);

    // Update item
    manager.update_item(item_id, title, provider_id, secret, tags, note)
}

/// Delete VaultItem
#[tauri::command]
pub async fn delete_vault_item(
    item_id: String,
    state: State<'_, AppState>,
) -> Result<(), String> {
    // Security check: Must be in Unlocked state
    if !state.state_manager.is_unlocked() {
        return Err("Vault is locked".to_string());
    }

    // Get master key
    let master_key_guard = state.state_manager.get_master_key()
        .ok_or("Master key not available")?;
    
    let master_key = Arc::new(Mutex::new(Some(master_key_guard)));

    // Create VaultManager
    let manager = VaultManager::new(state.db.clone(), master_key);

    // Delete item
    manager.delete_item(item_id)
}

/// Get initial state (called on app startup)
/// 
/// v1.0
/// Determine state based on whether master password hash exists in database
#[tauri::command]
pub async fn get_initial_state(
    state: State<'_, AppState>,
) -> Result<String, String> {
    let vault_state = state.state_manager.get_state();
    
    let state_str = match vault_state {
        crate::vault::state::VaultState::FirstLaunch => "FirstLaunch",
        crate::vault::state::VaultState::Locked => "Locked",
        crate::vault::state::VaultState::Unlocked => "Unlocked",
    };
    
    Ok(state_str.to_string())
}

/// Reveal plaintext secret of a single VaultItem
/// 
/// v1.0 - Extremely strict security control
/// 
/// Usage: Click eye icon in Dashboard to view plaintext
/// 
/// Security checks:
/// 1. Must be in Unlocked state
/// 2. Only return single record plaintext
/// 3. Frontend responsible for auto-masking after short time
/// 
/// IPC isolation principle: Plaintext API Key only stays in frontend memory briefly (<10s)
#[tauri::command]
pub async fn reveal_vault_item_secret(
    item_id: String,
    state: State<'_, AppState>,
) -> Result<String, String> {
    // Security check: Must be in Unlocked state
    if !state.state_manager.is_unlocked() {
        return Err("Vault is locked".to_string());
    }

    // Get master key
    let master_key_guard = state.state_manager.get_master_key()
        .ok_or("Master key not available")?;
    
    let master_key = Arc::new(Mutex::new(Some(master_key_guard)));

    // Create VaultManager
    let manager = VaultManager::new(state.db.clone(), master_key);

    // Decrypt and return plaintext (extremely dangerous!)
    manager.get_decrypted_secret(&item_id)
}

/// Setup master password (called on first startup)
/// 
/// v1.0
/// Parameters:
/// - master_password: User-set master password
/// 
/// Flow:
/// 1. Generate random Salt
/// 2. Generate password hash using Argon2id
/// 3. Store Salt and hash to database
/// 4. Derive master encryption key
/// 5. Transition state to Unlocked
#[tauri::command]
pub async fn setup_master_password(
    master_password: String,
    app: tauri::AppHandle,
    state: State<'_, AppState>,
) -> Result<(), String> {
    // Security check: Must be in FirstLaunch state
    if !state.state_manager.is_first_launch() {
        return Err("Master password already set".to_string());
    }

    // Generate random Salt
    let salt = crate::crypto::generate_salt();

    // Generate password hash
    let password_hash = crate::crypto::hash_master_password(&master_password, &salt)
        .map_err(|e| format!("Failed to hash password: {}", e))?;

    // Store to database
    let db = state.db.lock().unwrap();
    
    // Encode Salt to Base64 for storage
    let salt_base64 = base64::Engine::encode(&base64::engine::general_purpose::STANDARD, &salt);
    
    crate::database::sqlite::set_metadata(&db, "salt", &salt_base64)
        .map_err(|e| format!("Failed to store salt: {}", e))?;
    
    crate::database::sqlite::set_metadata(&db, "master_password_hash", &password_hash)
        .map_err(|e| format!("Failed to store password hash: {}", e))?;

    drop(db); // Release database lock

    // Derive master encryption key
    let master_key = crate::crypto::derive_master_key(&master_password, &salt)
        .map_err(|e| format!("Failed to derive master key: {}", e))?;

    // Transition to Unlocked state
    state.state_manager.transition_to_unlocked(master_key);

    // Update last activity time
    state.state_manager.update_last_activity();

    // Broadcast unlock event
    let _ = app.emit("vault://unlocked", ());

    println!("[Setup] Master password set successfully");

    Ok(())
}

/// Unlock Vault
/// 
/// v1.0
/// Parameters:
/// - master_password: User input master password
/// 
/// Flow:
/// 1. Read Salt and password hash from database
/// 2. Verify password
/// 3. If correct, derive master encryption key
/// 4. Transition state to Unlocked
#[tauri::command]
pub async fn unlock_vault(
    master_password: String,
    app: tauri::AppHandle,
    state: State<'_, AppState>,
) -> Result<(), String> {
    // Security check: Must be in Locked state
    if !state.state_manager.is_locked() {
        return Err("Vault is not locked".to_string());
    }

    // Phase 1: All sync operations (no .await) - keep MutexGuards scoped
    let (salt, stored_hash) = {
        let db = state.db.lock().unwrap();
        
        let salt_base64 = crate::database::sqlite::get_metadata(&db, "salt")
            .map_err(|e| format!("Failed to read salt: {}", e))?
            .ok_or("Salt not found")?;
        
        let hash = crate::database::sqlite::get_metadata(&db, "master_password_hash")
            .map_err(|e| format!("Failed to read password hash: {}", e))?
            .ok_or("Password hash not found")?;

        // db MutexGuard dropped here when block ends
        (salt_base64, hash)
    };

    // Decode Salt
    let salt_bytes = base64::Engine::decode(&base64::engine::general_purpose::STANDARD, &salt)
        .map_err(|e| format!("Failed to decode salt: {}", e))?;

    // Verify password
    let is_valid = crate::crypto::verify_master_password(&master_password, &stored_hash)
        .map_err(|e| format!("Password verification failed: {}", e))?;

    if !is_valid {
        return Err("Invalid password".to_string());
    }

    // Derive master encryption key
    let master_key = crate::crypto::derive_master_key(&master_password, &salt_bytes)
        .map_err(|e| format!("Failed to derive master key: {}", e))?;

    // Transition to Unlocked state
    state.state_manager.transition_to_unlocked(master_key);

    // Update last activity time
    state.state_manager.update_last_activity();

    // Check if dashboard was requested while vault was locked
    let needs_dashboard = {
        let mut pending = state.pending_dashboard.lock().unwrap();
        if *pending {
            *pending = false;
            true
        } else {
            false
        }
        // pending MutexGuard dropped here when block ends
    };

    // Phase 2: Window transitions BEFORE emitting event (avoid visual flash)
    // 
    // Key ordering: hide main / open dashboard BEFORE the frontend processes
    // the unlock event. Otherwise main window would briefly render SearchPage
    // before being hidden, causing visible stutter.
    if needs_dashboard {
        println!("[Unlock] Opening dashboard (was requested while locked)");
        
        // Hide main window first (no more visual changes after this)
        if let Some(main_window) = app.get_webview_window("main") {
            let _ = main_window.hide();
        }
        
        // Open/create dashboard window
        if let Err(e) = crate::commands::settings::open_dashboard_window(app.clone()).await {
            eprintln!("[Unlock] Failed to open dashboard: {}", e);
        }
    }

    // Broadcast unlock event (after window transitions complete)
    let _ = app.emit("vault://unlocked", ());

    println!("[Unlock] Vault unlocked successfully");

    Ok(())
}
