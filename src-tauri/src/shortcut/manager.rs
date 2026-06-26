/// Global shortcut management module
///
/// [Phase 4 implementation + Dynamic Shortcut]:
/// Core features:
/// 1. Register user-defined global shortcut (customizable)
/// 2. Listen for shortcut events
/// 3. On trigger:
///    - If VaultState::Locked, show Unlock Window
///    - If VaultState::Unlocked, show/hide Search Window
/// 4. Dynamic shortcut registration/unregistration
/// 5. Persistent storage in database
///
/// Default shortcuts:
/// - macOS: Cmd+Shift+Space
/// - Windows/Linux: Ctrl+Shift+Space
use tauri::{AppHandle, Emitter, Manager};
use tauri_plugin_global_shortcut::{Code, GlobalShortcutExt, Modifiers, Shortcut, ShortcutState};

/// Parse shortcut string to Shortcut object
///
/// Examples:
/// - "Ctrl+Shift+Space" -> Ctrl+Shift+Space
/// - "Cmd+Shift+K" -> Super+Shift+K
/// - "Alt+X" -> Alt+X
fn parse_shortcut(shortcut_str: &str) -> Result<Shortcut, String> {
    let parts: Vec<&str> = shortcut_str.split('+').collect();
    if parts.is_empty() {
        return Err("Invalid shortcut format".to_string());
    }

    let mut modifiers = Modifiers::empty();
    let mut key_code: Option<Code> = None;

    for part in parts {
        let part_lower = part.to_lowercase();
        match part_lower.as_str() {
            "ctrl" | "control" => modifiers |= Modifiers::CONTROL,
            "shift" => modifiers |= Modifiers::SHIFT,
            "alt" | "option" => modifiers |= Modifiers::ALT,
            "cmd" | "super" | "meta" | "win" => modifiers |= Modifiers::SUPER,
            // Common keys
            "space" => key_code = Some(Code::Space),
            "enter" | "return" => key_code = Some(Code::Enter),
            "tab" => key_code = Some(Code::Tab),
            "esc" | "escape" => key_code = Some(Code::Escape),
            "backspace" => key_code = Some(Code::Backspace),
            // Letters A-Z
            key if key.len() == 1 && key.chars().next().unwrap().is_alphabetic() => {
                let ch = key.chars().next().unwrap().to_uppercase().next().unwrap();
                key_code = match ch {
                    'A' => Some(Code::KeyA),
                    'B' => Some(Code::KeyB),
                    'C' => Some(Code::KeyC),
                    'D' => Some(Code::KeyD),
                    'E' => Some(Code::KeyE),
                    'F' => Some(Code::KeyF),
                    'G' => Some(Code::KeyG),
                    'H' => Some(Code::KeyH),
                    'I' => Some(Code::KeyI),
                    'J' => Some(Code::KeyJ),
                    'K' => Some(Code::KeyK),
                    'L' => Some(Code::KeyL),
                    'M' => Some(Code::KeyM),
                    'N' => Some(Code::KeyN),
                    'O' => Some(Code::KeyO),
                    'P' => Some(Code::KeyP),
                    'Q' => Some(Code::KeyQ),
                    'R' => Some(Code::KeyR),
                    'S' => Some(Code::KeyS),
                    'T' => Some(Code::KeyT),
                    'U' => Some(Code::KeyU),
                    'V' => Some(Code::KeyV),
                    'W' => Some(Code::KeyW),
                    'X' => Some(Code::KeyX),
                    'Y' => Some(Code::KeyY),
                    'Z' => Some(Code::KeyZ),
                    _ => None,
                };
            }
            _ => return Err(format!("Unknown key: {}", part)),
        }
    }

    if let Some(code) = key_code {
        Ok(Shortcut::new(Some(modifiers), code))
    } else {
        Err("No key code specified".to_string())
    }
}

/// Get default shortcut string based on OS
pub fn get_default_shortcut() -> String {
    #[cfg(target_os = "macos")]
    return "Cmd+Shift+Space".to_string();

    #[cfg(not(target_os = "macos"))]
    return "Ctrl+Shift+Space".to_string();
}

/// Register global shortcut with custom shortcut string
///
/// Parameters:
/// - app: Tauri AppHandle
/// - shortcut_str: Custom shortcut string (e.g. "Ctrl+Shift+K")
pub fn register_custom_shortcut(app: &AppHandle, shortcut_str: &str) -> Result<(), String> {
    println!("[Shortcut] Registering custom shortcut: {}", shortcut_str);

    let shortcut = parse_shortcut(shortcut_str)?;
    let app_clone = app.clone();

    // Register shortcut
    app.global_shortcut()
        .on_shortcut(shortcut, move |_app, _shortcut, event| {
            if event.state == ShortcutState::Pressed {
                let _ = toggle_search_window(&app_clone);
            }
        })
        .map_err(|e| format!("Failed to register shortcut: {}", e))?;

    println!("[Shortcut] Custom shortcut registered successfully");
    Ok(())
}

/// Register global shortcut (with database persistence)
///
/// [Phase 4 implementation]:
/// Reads shortcut from database, falls back to default if not set
pub fn register_global_shortcut(app: &AppHandle) -> Result<(), String> {
    // Read custom shortcut from database
    let shortcut_str = match get_shortcut_from_db(app) {
        Ok(s) => s,
        Err(_) => get_default_shortcut(),
    };

    register_custom_shortcut(app, &shortcut_str)
}

/// Unregister specific shortcut
pub fn unregister_specific_shortcut(app: &AppHandle, shortcut_str: &str) -> Result<(), String> {
    let shortcut = parse_shortcut(shortcut_str)?;

    app.global_shortcut()
        .unregister(shortcut)
        .map_err(|e| format!("Failed to unregister shortcut: {}", e))?;

    println!("[Shortcut] Shortcut {} unregistered", shortcut_str);
    Ok(())
}

/// Toggle search window show/hide
///
/// [Phase 4 implementation]:
/// Core interaction logic:
/// 1. If window is hidden -> Show and focus
/// 2. If window is shown -> Hide
/// 3. When showing, emit vault://focus-input event for frontend to clear input and focus
fn toggle_search_window(app: &AppHandle) -> Result<(), String> {
    if let Some(window) = app.get_webview_window("main") {
        let is_visible = window
            .is_visible()
            .map_err(|e| format!("Failed to check window visibility: {}", e))?;

        if is_visible {
            // Window is showing -> Hide
            window
                .hide()
                .map_err(|e| format!("Failed to hide window: {}", e))?;
            println!("[Shortcut] Window hidden");
        } else {
            // Window is hidden -> Show and focus
            window
                .show()
                .map_err(|e| format!("Failed to show window: {}", e))?;
            window
                .set_focus()
                .map_err(|e| format!("Failed to focus window: {}", e))?;

            // Send focus event to frontend
            let _ = app.emit("vault://focus-input", ());

            println!("[Shortcut] Window shown and focused");
        }
    } else {
        return Err("Main window not found".to_string());
    }

    Ok(())
}

/// Save shortcut to database
fn save_shortcut_to_db(app: &AppHandle, shortcut: &str) -> Result<(), String> {
    let db_path = app
        .path()
        .app_data_dir()
        .map_err(|e| format!("Failed to get app data dir: {}", e))?
        .join("vault.db");

    let conn = rusqlite::Connection::open(&db_path)
        .map_err(|e| format!("Failed to open database: {}", e))?;

    conn.execute(
        "INSERT OR REPLACE INTO app_metadata (key, value) VALUES (?1, ?2)",
        rusqlite::params!["global_shortcut", shortcut],
    )
    .map_err(|e| format!("Failed to save shortcut: {}", e))?;

    Ok(())
}

/// Read shortcut from database
fn get_shortcut_from_db(app: &AppHandle) -> Result<String, String> {
    let db_path = app
        .path()
        .app_data_dir()
        .map_err(|e| format!("Failed to get app data dir: {}", e))?
        .join("vault.db");

    let conn = rusqlite::Connection::open(&db_path)
        .map_err(|e| format!("Failed to open database: {}", e))?;

    let result: Result<String, rusqlite::Error> = conn.query_row(
        "SELECT value FROM app_metadata WHERE key = ?1",
        rusqlite::params!["global_shortcut"],
        |row| row.get(0),
    );

    match result {
        Ok(shortcut) => Ok(shortcut),
        Err(rusqlite::Error::QueryReturnedNoRows) => Ok(get_default_shortcut()),
        Err(e) => Err(format!("Failed to read shortcut: {}", e)),
    }
}

/// Update global shortcut (unregister old, register new)
pub fn update_global_shortcut(app: &AppHandle, new_shortcut: &str) -> Result<(), String> {
    // Get current shortcut
    let old_shortcut = get_shortcut_from_db(app).unwrap_or_else(|_| get_default_shortcut());

    // Unregister old shortcut
    if let Err(e) = unregister_specific_shortcut(app, &old_shortcut) {
        eprintln!("[Shortcut] Failed to unregister old shortcut: {}", e);
        // Continue anyway
    }

    // Register new shortcut
    register_custom_shortcut(app, new_shortcut)?;

    // Save to database
    save_shortcut_to_db(app, new_shortcut)?;

    println!(
        "[Shortcut] Shortcut updated: {} -> {}",
        old_shortcut, new_shortcut
    );
    Ok(())
}

/// Get current shortcut
pub fn get_current_shortcut(app: &AppHandle) -> Result<String, String> {
    get_shortcut_from_db(app)
}
