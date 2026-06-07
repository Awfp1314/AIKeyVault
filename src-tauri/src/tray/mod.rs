/// Tray module - System tray management
/// 
/// Responsibilities:
/// - Create system tray icon
/// - Tray menu with i18n support
/// - Handle menu item click events
/// - Update menu when language changes

pub mod manager;

// Re-export public functions
pub use manager::{setup_system_tray, register_close_interceptor, update_tray_menu};
