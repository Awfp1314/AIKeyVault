use tauri::{AppHandle, Manager};
use tauri_plugin_autostart::ManagerExt;

/// Initialize autostart manager on app startup
///
/// This should be called once during app initialization
pub fn init_autostart(app: &AppHandle) -> Result<(), String> {
    // Get autostart manager
    let autostart_manager = app.autolaunch();

    // Check if autostart is enabled in database
    match get_startup_enabled_from_db(app) {
        Ok(enabled) => {
            if enabled {
                // If enabled in DB, ensure it's registered with system
                if let Err(e) = autostart_manager.enable() {
                    eprintln!("[Startup] Failed to enable autostart: {}", e);
                    return Err(format!("Failed to enable autostart: {}", e));
                }
                println!("[Startup] Autostart enabled");
            } else {
                // If disabled in DB, ensure it's unregistered from system
                if let Err(e) = autostart_manager.disable() {
                    eprintln!("[Startup] Failed to disable autostart: {}", e);
                    // Non-critical error, continue
                }
                println!("[Startup] Autostart disabled");
            }
            Ok(())
        }
        Err(e) => {
            // If no setting exists, default to disabled
            eprintln!("[Startup] Failed to read startup setting: {}", e);
            Ok(())
        }
    }
}

/// Enable autostart and save to database
pub fn enable_autostart(app: &AppHandle) -> Result<(), String> {
    let autostart_manager = app.autolaunch();

    // Enable with system
    autostart_manager
        .enable()
        .map_err(|e| format!("Failed to enable autostart: {}", e))?;

    // Save to database
    save_startup_enabled_to_db(app, true)?;

    println!("[Startup] Autostart enabled successfully");
    Ok(())
}

/// Disable autostart and save to database
pub fn disable_autostart(app: &AppHandle) -> Result<(), String> {
    let autostart_manager = app.autolaunch();

    // Disable with system
    autostart_manager
        .disable()
        .map_err(|e| format!("Failed to disable autostart: {}", e))?;

    // Save to database
    save_startup_enabled_to_db(app, false)?;

    println!("[Startup] Autostart disabled successfully");
    Ok(())
}

/// Check if autostart is currently enabled
pub fn is_autostart_enabled(app: &AppHandle) -> Result<bool, String> {
    // Read from database (source of truth)
    get_startup_enabled_from_db(app)
}

/// Save startup enabled state to database
fn save_startup_enabled_to_db(app: &AppHandle, enabled: bool) -> Result<(), String> {
    let db_path = app
        .path()
        .app_data_dir()
        .map_err(|e| format!("Failed to get app data dir: {}", e))?
        .join("vault.db");

    let conn = rusqlite::Connection::open(&db_path)
        .map_err(|e| format!("Failed to open database: {}", e))?;

    let value = if enabled { "true" } else { "false" };

    conn.execute(
        "INSERT OR REPLACE INTO app_metadata (key, value) VALUES (?1, ?2)",
        rusqlite::params!["startup_enabled", value],
    )
    .map_err(|e| format!("Failed to save startup setting: {}", e))?;

    Ok(())
}

/// Read startup enabled state from database
fn get_startup_enabled_from_db(app: &AppHandle) -> Result<bool, String> {
    let db_path = app
        .path()
        .app_data_dir()
        .map_err(|e| format!("Failed to get app data dir: {}", e))?
        .join("vault.db");

    let conn = rusqlite::Connection::open(&db_path)
        .map_err(|e| format!("Failed to open database: {}", e))?;

    let result: Result<String, rusqlite::Error> = conn.query_row(
        "SELECT value FROM app_metadata WHERE key = ?1",
        rusqlite::params!["startup_enabled"],
        |row| row.get(0),
    );

    match result {
        Ok(value) => Ok(value == "true"),
        Err(rusqlite::Error::QueryReturnedNoRows) => Ok(false), // Default to disabled
        Err(e) => Err(format!("Failed to read startup setting: {}", e)),
    }
}
