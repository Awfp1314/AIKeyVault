/// SQLite database management module
/// 
/// Database file: vault.db
/// 
/// Schema design:
/// 1. app_metadata - Application metadata (Salt, settings, etc.)
/// 2. vault_items - API Key storage (encrypted fields + plaintext metadata)
/// 
/// Encryption strategy:
/// - Encrypted fields: secret_cipher, nonce
/// - Plaintext fields: title, provider_id, tags, favorite, usage_count
///   (Plaintext fields for high-performance search and sorting)
/// 
/// Index optimization:
/// - idx_provider: Fast filtering by Provider
/// - idx_usage: Sort by usage frequency
/// - idx_last_used: Sort by recent usage

use rusqlite::{Connection, Result};
use std::path::PathBuf;

/// Initialize database connection
/// 
/// Create vault.db file (if not exists)
/// Execute Schema creation and index building
pub fn initialize_database(db_path: PathBuf) -> Result<Connection> {
    // Open or create database connection
    let conn = Connection::open(db_path)?;

    // Create table structure
    create_tables(&conn)?;

    // Create indexes
    create_indexes(&conn)?;

    Ok(conn)
}

/// Create Schema (strictly following PRD Section 7 specifications)
fn create_tables(conn: &Connection) -> Result<()> {
    // 1. app_metadata table: Store application-level metadata
    conn.execute(
        "CREATE TABLE IF NOT EXISTS app_metadata (
            key TEXT PRIMARY KEY,
            value TEXT NOT NULL
        )",
        [],
    )?;

    // 2. vault_items table: Store encrypted API Keys
    conn.execute(
        "CREATE TABLE IF NOT EXISTS vault_items (
            id TEXT PRIMARY KEY,
            title TEXT NOT NULL,
            provider_id TEXT NOT NULL,
            secret_cipher BLOB NOT NULL,
            nonce BLOB NOT NULL,
            tags TEXT,
            note TEXT,
            favorite INTEGER DEFAULT 0,
            usage_count INTEGER DEFAULT 0,
            last_used_at INTEGER,
            created_at INTEGER NOT NULL,
            updated_at INTEGER NOT NULL
        )",
        [],
    )?;

    Ok(())
}

/// Create indexes (optimize query performance)
fn create_indexes(conn: &Connection) -> Result<()> {
    // Fast filtering by Provider
    conn.execute(
        "CREATE INDEX IF NOT EXISTS idx_provider ON vault_items(provider_id)",
        [],
    )?;

    // Sort by usage frequency (descending)
    conn.execute(
        "CREATE INDEX IF NOT EXISTS idx_usage ON vault_items(usage_count DESC)",
        [],
    )?;

    // Sort by recent usage (descending)
    conn.execute(
        "CREATE INDEX IF NOT EXISTS idx_last_used ON vault_items(last_used_at DESC)",
        [],
    )?;

    Ok(())
}

/// Insert Vault Item
/// 
/// [Security requirement]: Caller must ensure secret_cipher and nonce are properly encrypted
pub fn insert_vault_item(
    conn: &Connection,
    item: &crate::vault::manager::VaultItem,
) -> Result<()> {
    conn.execute(
        "INSERT INTO vault_items (
            id, title, provider_id, secret_cipher, nonce,
            tags, note, favorite, usage_count, last_used_at,
            created_at, updated_at
        ) VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8, ?9, ?10, ?11, ?12)",
        rusqlite::params![
            item.id,
            item.title,
            item.provider_id,
            item.secret_cipher,
            item.nonce,
            item.tags,
            item.note,
            item.favorite as i32,
            item.usage_count,
            item.last_used_at,
            item.created_at,
            item.updated_at,
        ],
    )?;

    Ok(())
}

/// Query all Vault Items
/// 
/// [Security warning]: This function returns complete VaultItem (including ciphertext)
/// Only for Rust backend internal use, absolutely forbidden to pass ciphertext fields to frontend
pub fn query_all_items(conn: &Connection) -> Result<Vec<crate::vault::manager::VaultItem>> {
    let mut stmt = conn.prepare(
        "SELECT id, title, provider_id, secret_cipher, nonce,
                tags, note, favorite, usage_count, last_used_at,
                created_at, updated_at
         FROM vault_items
         ORDER BY favorite DESC, usage_count DESC, last_used_at DESC"
    )?;

    let items_iter = stmt.query_map([], |row| {
        Ok(crate::vault::manager::VaultItem {
            id: row.get(0)?,
            title: row.get(1)?,
            provider_id: row.get(2)?,
            secret_cipher: row.get(3)?,
            nonce: row.get(4)?,
            tags: row.get(5)?,
            note: row.get(6)?,
            favorite: row.get::<_, i32>(7)? != 0,
            usage_count: row.get(8)?,
            last_used_at: row.get(9)?,
            created_at: row.get(10)?,
            updated_at: row.get(11)?,
        })
    })?;

    let mut items = Vec::new();
    for item in items_iter {
        items.push(item?);
    }

    Ok(items)
}

/// Query single Vault Item (by ID)
pub fn query_item_by_id(conn: &Connection, item_id: &str) -> Result<Option<crate::vault::manager::VaultItem>> {
    let mut stmt = conn.prepare(
        "SELECT id, title, provider_id, secret_cipher, nonce,
                tags, note, favorite, usage_count, last_used_at,
                created_at, updated_at
         FROM vault_items
         WHERE id = ?1"
    )?;

    let mut items_iter = stmt.query_map([item_id], |row| {
        Ok(crate::vault::manager::VaultItem {
            id: row.get(0)?,
            title: row.get(1)?,
            provider_id: row.get(2)?,
            secret_cipher: row.get(3)?,
            nonce: row.get(4)?,
            tags: row.get(5)?,
            note: row.get(6)?,
            favorite: row.get::<_, i32>(7)? != 0,
            usage_count: row.get(8)?,
            last_used_at: row.get(9)?,
            created_at: row.get(10)?,
            updated_at: row.get(11)?,
        })
    })?;

    Ok(items_iter.next().transpose()?)
}

/// Update usage statistics
/// 
/// Called every time API Key is copied to clipboard
/// - usage_count + 1
/// - last_used_at updated to current timestamp
pub fn update_usage_stats(
    conn: &Connection,
    item_id: &str,
) -> Result<()> {
    let now = chrono::Utc::now().timestamp();

    conn.execute(
        "UPDATE vault_items 
         SET usage_count = usage_count + 1,
             last_used_at = ?1,
             updated_at = ?1
         WHERE id = ?2",
        rusqlite::params![now, item_id],
    )?;

    Ok(())
}

/// Update Vault Item (excluding ciphertext update)
/// 
/// Used to update plaintext metadata (title, tags, note, favorite)
pub fn update_vault_item_metadata(
    conn: &Connection,
    item_id: &str,
    title: &str,
    tags: Option<&str>,
    note: Option<&str>,
    favorite: bool,
) -> Result<()> {
    let now = chrono::Utc::now().timestamp();

    conn.execute(
        "UPDATE vault_items 
         SET title = ?1, tags = ?2, note = ?3, favorite = ?4, updated_at = ?5
         WHERE id = ?6",
        rusqlite::params![title, tags, note, favorite as i32, now, item_id],
    )?;

    Ok(())
}

/// Update VaultItem with new encrypted secret
/// 
/// Used when both metadata and secret need to be updated
pub fn update_vault_item_with_secret(
    conn: &Connection,
    item_id: &str,
    title: &str,
    provider_id: &str,
    secret_cipher: &[u8],
    nonce: &[u8],
    tags: Option<&str>,
    note: Option<&str>,
    favorite: bool,
) -> Result<()> {
    let now = chrono::Utc::now().timestamp();

    conn.execute(
        "UPDATE vault_items 
         SET title = ?1, provider_id = ?2, secret_cipher = ?3, nonce = ?4, 
             tags = ?5, note = ?6, favorite = ?7, updated_at = ?8
         WHERE id = ?9",
        rusqlite::params![
            title,
            provider_id,
            secret_cipher,
            nonce,
            tags,
            note,
            favorite as i32,
            now,
            item_id
        ],
    )?;

    Ok(())
}

/// Update only provider_id
pub fn update_vault_item_provider(
    conn: &Connection,
    item_id: &str,
    provider_id: &str,
) -> Result<()> {
    let now = chrono::Utc::now().timestamp();

    conn.execute(
        "UPDATE vault_items 
         SET provider_id = ?1, updated_at = ?2
         WHERE id = ?3",
        rusqlite::params![provider_id, now, item_id],
    )?;

    Ok(())
}

/// Delete Vault Item
pub fn delete_vault_item(conn: &Connection, item_id: &str) -> Result<()> {
    conn.execute("DELETE FROM vault_items WHERE id = ?1", [item_id])?;
    Ok(())
}

/// Get/Set app_metadata key-value pairs
pub fn get_metadata(conn: &Connection, key: &str) -> Result<Option<String>> {
    let mut stmt = conn.prepare("SELECT value FROM app_metadata WHERE key = ?1")?;
    let mut rows = stmt.query([key])?;
    
    if let Some(row) = rows.next()? {
        Ok(Some(row.get(0)?))
    } else {
        Ok(None)
    }
}

pub fn set_metadata(conn: &Connection, key: &str, value: &str) -> Result<()> {
    conn.execute(
        "INSERT OR REPLACE INTO app_metadata (key, value) VALUES (?1, ?2)",
        [key, value],
    )?;
    Ok(())
}
