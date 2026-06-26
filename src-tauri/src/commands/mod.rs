pub mod settings;
/// Commands Module - Tauri IPC Commands
///
/// IPC Whitelist Principle:
/// All frontend-callable functions must be explicitly registered here
/// Strictly limit permissions, prohibit frontend direct access to file system, execute Shell, etc.
///
/// Command categories:
/// - vault.rs: VaultItem CRUD, search, copy, etc.
/// - settings.rs: App settings, master password change, window management, heartbeat mechanism, etc.
pub mod vault;
