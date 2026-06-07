/// Vault module - Core business logic
/// 
/// Responsibilities:
/// - VaultState state machine management
/// - VaultItem CRUD operations
/// - Master encryption key lifecycle management
/// - Auto-lock logic

pub mod manager;
pub mod state;

// Re-export commonly used types
pub use manager::{VaultItem, VaultItemMeta, VaultManager};
pub use state::{StateManager, VaultState};
