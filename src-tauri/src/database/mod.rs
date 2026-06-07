/// Database module - SQLite datastore
/// 
/// Responsibilities:
/// - Database initialization, Schema creation
/// - CRUD operations
/// - Index management
/// - Transaction handling

pub mod sqlite;

// Re-export commonly used functions
pub use sqlite::{
    delete_vault_item, get_metadata, initialize_database, insert_vault_item, query_all_items,
    query_item_by_id, set_metadata, update_usage_stats, update_vault_item_metadata,
};
