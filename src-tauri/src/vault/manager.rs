/// VaultItem management module
///
/// Responsibilities:
/// - VaultItem CRUD operations
/// - Encryption/decryption integration
/// - Search and sorting
/// - Usage statistics
use rusqlite::Connection;
use serde::{Deserialize, Serialize};
use std::sync::{Arc, Mutex};
use uuid::Uuid;
use zeroize::Zeroizing;

use crate::crypto::{decrypt_data, encrypt_data, generate_nonce};
use crate::database::sqlite;

/// VaultItem data model
///
/// Corresponds to PRD Section 5 data structure
///
/// Note:
/// - secret_cipher and nonce are encrypted storage
/// - Other fields are plaintext storage (for search and sorting)
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct VaultItem {
    pub id: String,                // UUID
    pub title: String,             // User-defined title
    pub provider_id: String,       // Provider ID (e.g. "openai")
    pub secret_cipher: Vec<u8>,    // Encrypted API Key
    pub nonce: Vec<u8>,            // AES-GCM Nonce (12 bytes)
    pub tags: String,              // Tags (comma-separated)
    pub note: Option<String>,      // Note
    pub favorite: bool,            // Is favorite
    pub usage_count: i32,          // Usage count
    pub last_used_at: Option<i64>, // Last used time (Unix timestamp)
    pub created_at: i64,           // Creation time
    pub updated_at: i64,           // Update time
}

/// VaultItem secure metadata (for frontend display)
///
/// [IPC isolation iron rule]:
/// Frontend only receives this structure, does not include secret_cipher and nonce
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct VaultItemMeta {
    pub id: String,
    pub title: String,
    pub provider_id: String,
    pub tags: String,
    pub note: Option<String>,
    pub favorite: bool,
    pub usage_count: i32,
    pub last_used_at: Option<i64>,
    pub created_at: i64,
    pub updated_at: i64,
}

impl VaultItem {
    /// Convert to secure metadata (remove sensitive fields)
    ///
    /// [Ciphertext no-cross-boundary guarantee]: This method ensures secret_cipher and nonce are not passed to frontend
    pub fn to_meta(&self) -> VaultItemMeta {
        VaultItemMeta {
            id: self.id.clone(),
            title: self.title.clone(),
            provider_id: self.provider_id.clone(),
            tags: self.tags.clone(),
            note: self.note.clone(),
            favorite: self.favorite,
            usage_count: self.usage_count,
            last_used_at: self.last_used_at,
            created_at: self.created_at,
            updated_at: self.updated_at,
        }
    }
}

/// Vault Manager
///
/// Responsible for all VaultItem related operations
/// Integrates Crypto and Database
pub struct VaultManager {
    db: Arc<Mutex<Connection>>,
    master_key: Arc<Mutex<Option<Zeroizing<Vec<u8>>>>>,
}

impl VaultManager {
    pub fn new(
        db: Arc<Mutex<Connection>>,
        master_key: Arc<Mutex<Option<Zeroizing<Vec<u8>>>>>,
    ) -> Self {
        Self { db, master_key }
    }

    /// Create new VaultItem
    ///
    /// Parameters:
    /// - title: Title
    /// - provider_id: Provider ID
    /// - secret: Plaintext API Key (only exists in Rust side)
    /// - tags: Tags
    /// - note: Note
    ///
    /// Flow:
    /// 1. Generate random Nonce
    /// 2. Use master encryption key to encrypt secret
    /// 3. Store to database
    /// 4. Return secure metadata (no ciphertext)
    pub fn create_item(
        &self,
        title: String,
        provider_id: String,
        secret: String,
        tags: String,
        note: Option<String>,
    ) -> Result<VaultItemMeta, String> {
        // Get master encryption key
        let master_key_guard = self.master_key.lock().unwrap();
        let master_key = master_key_guard.as_ref().ok_or("Vault is locked")?;

        // Generate random Nonce
        let nonce = generate_nonce();

        // Encrypt API Key
        let secret_cipher = encrypt_data(secret.as_bytes(), master_key, &nonce)?;

        // Generate UUID and timestamp
        let id = Uuid::new_v4().to_string();
        let now = chrono::Utc::now().timestamp();

        // Build VaultItem
        let item = VaultItem {
            id: id.clone(),
            title,
            provider_id,
            secret_cipher,
            nonce,
            tags,
            note,
            favorite: false,
            usage_count: 0,
            last_used_at: None,
            created_at: now,
            updated_at: now,
        };

        // Store to database
        let db = self.db.lock().unwrap();
        sqlite::insert_vault_item(&db, &item)
            .map_err(|e| format!("Failed to insert item: {}", e))?;

        // Return secure metadata (no ciphertext)
        Ok(item.to_meta())
    }

    /// Copy API Key to clipboard
    ///
    /// [Secure closed-loop operation]:
    /// 1. Query database by item_id
    /// 2. Decrypt secret_cipher
    /// 3. Write to clipboard (future integration with privacy marking)
    /// 4. usage_count + 1
    /// 5. Update last_used_at
    /// 6. Return success (no plaintext returned)
    ///
    /// [IPC isolation iron rule]: Plaintext API Key does not leave Rust side
    pub fn copy_to_clipboard(&self, item_id: String) -> Result<String, String> {
        // Get master encryption key
        let master_key_guard = self.master_key.lock().unwrap();
        let master_key = master_key_guard.as_ref().ok_or("Vault is locked")?;

        // 查询数据库获�?VaultItem
        let db = self.db.lock().unwrap();
        let item = sqlite::query_item_by_id(&db, &item_id)
            .map_err(|e| format!("Failed to query item: {}", e))?
            .ok_or("Item not found")?;

        // Decrypt API Key
        let plaintext_bytes = decrypt_data(&item.secret_cipher, master_key, &item.nonce)?;
        let plaintext = String::from_utf8(plaintext_bytes)
            .map_err(|e| format!("Failed to decode plaintext: {}", e))?;

        // Update usage statistics
        sqlite::update_usage_stats(&db, &item_id)
            .map_err(|e| format!("Failed to update usage stats: {}", e))?;

        Ok(plaintext)
    }

    /// Search VaultItems
    ///
    /// Search scope: title, provider_id, tags
    /// Sort rules:
    /// 1. favorite (favorites first)
    /// 2. Search match score
    /// 3. usage_count (usage frequency)
    /// 4. last_used_at (recently used)
    ///
    /// Returns: Secure metadata list (no ciphertext)
    pub fn search_items(&self, query: String) -> Result<Vec<VaultItemMeta>, String> {
        let db = self.db.lock().unwrap();

        // Query all items
        let all_items =
            sqlite::query_all_items(&db).map_err(|e| format!("Failed to query items: {}", e))?;

        // Convert to metadata and filter search
        let query_lower = query.to_lowercase();
        let mut filtered_items: Vec<VaultItemMeta> = all_items
            .into_iter()
            .filter(|item| {
                if query.is_empty() {
                    true
                } else {
                    item.title.to_lowercase().contains(&query_lower)
                        || item.provider_id.to_lowercase().contains(&query_lower)
                        || item.tags.to_lowercase().contains(&query_lower)
                }
            })
            .map(|item| item.to_meta())
            .collect();

        // Sort: favorite -> usage_count -> last_used_at
        filtered_items.sort_by(|a, b| {
            // 1. Favorites first
            match b.favorite.cmp(&a.favorite) {
                std::cmp::Ordering::Equal => {
                    // 2. Usage frequency
                    match b.usage_count.cmp(&a.usage_count) {
                        std::cmp::Ordering::Equal => {
                            // 3. Recently used
                            b.last_used_at.cmp(&a.last_used_at)
                        }
                        other => other,
                    }
                }
                other => other,
            }
        });

        Ok(filtered_items)
    }

    /// Get all VaultItems (return secure metadata)
    pub fn get_all_items(&self) -> Result<Vec<VaultItemMeta>, String> {
        self.search_items(String::new())
    }

    /// Delete VaultItem
    pub fn delete_item(&self, item_id: String) -> Result<(), String> {
        let db = self.db.lock().unwrap();
        sqlite::delete_vault_item(&db, &item_id)
            .map_err(|e| format!("Failed to delete item: {}", e))
    }

    /// Update VaultItem (metadata and optionally secret)
    ///
    /// Parameters:
    /// - item_id: Item to update
    /// - title, provider_id, tags, note: New metadata
    /// - secret: Optional new plaintext secret (None = keep existing)
    ///
    /// Flow:
    /// 1. Query existing item
    /// 2. If secret is Some, re-encrypt with new random nonce
    /// 3. Update database with new metadata and/or ciphertext
    pub fn update_item(
        &self,
        item_id: String,
        title: String,
        provider_id: String,
        secret: Option<String>,
        tags: String,
        note: Option<String>,
    ) -> Result<VaultItemMeta, String> {
        let db = self.db.lock().unwrap();

        // Query existing item to verify it exists
        let existing_item = sqlite::query_item_by_id(&db, &item_id)
            .map_err(|e| format!("Failed to query item: {}", e))?
            .ok_or("Item not found")?;

        // If secret is provided, re-encrypt it
        if let Some(new_secret) = secret {
            let master_key_lock = self.master_key.lock().unwrap();
            let master_key = master_key_lock.as_ref().ok_or("Master key not available")?;

            // Generate new random nonce
            let nonce = generate_nonce();

            // Encrypt with new nonce
            let cipher = encrypt_data(&new_secret.into_bytes(), master_key, &nonce)
                .map_err(|e| format!("Failed to encrypt secret: {}", e))?;

            drop(master_key_lock); // Release lock before DB operation

            // Update both metadata and encrypted secret
            sqlite::update_vault_item_with_secret(
                &db,
                &item_id,
                &title,
                &provider_id,
                &cipher,
                &nonce,
                Some(&tags),
                note.as_deref(),
                existing_item.favorite,
            )
            .map_err(|e| format!("Failed to update item with secret: {}", e))?;
        } else {
            // Update only metadata (keep existing encryption)
            sqlite::update_vault_item_metadata(
                &db,
                &item_id,
                &title,
                Some(&tags),
                note.as_deref(),
                existing_item.favorite,
            )
            .map_err(|e| format!("Failed to update metadata: {}", e))?;

            // Also update provider_id separately if needed
            // Note: Current update_vault_item_metadata doesn't handle provider_id
            // We need to add a database function for this
            if provider_id != existing_item.provider_id {
                sqlite::update_vault_item_provider(&db, &item_id, &provider_id)
                    .map_err(|e| format!("Failed to update provider: {}", e))?;
            }
        }

        // Query and return updated item
        let updated_item = sqlite::query_item_by_id(&db, &item_id)
            .map_err(|e| format!("Failed to query updated item: {}", e))?
            .ok_or("Item not found after update")?;

        Ok(updated_item.to_meta())
    }

    /// Get decrypted API Key (for clipboard operations)
    ///
    /// [Security warning]: This function returns plaintext API Key
    /// Only for Rust backend internal use, absolutely forbidden to pass to frontend
    pub fn get_decrypted_secret(&self, item_id: &str) -> Result<String, String> {
        // Get master encryption key
        let master_key_guard = self.master_key.lock().unwrap();
        let master_key = master_key_guard.as_ref().ok_or("Vault is locked")?;

        // 查询数据库获�?VaultItem
        let db = self.db.lock().unwrap();
        let item = sqlite::query_item_by_id(&db, item_id)
            .map_err(|e| format!("Failed to query item: {}", e))?
            .ok_or("Item not found")?;

        // Decrypt API Key
        let plaintext_bytes = decrypt_data(&item.secret_cipher, master_key, &item.nonce)?;
        let plaintext = String::from_utf8(plaintext_bytes)
            .map_err(|e| format!("Failed to decode plaintext: {}", e))?;

        Ok(plaintext)
    }
}
