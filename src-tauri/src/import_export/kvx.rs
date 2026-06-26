/// KVX encrypted backup format implementation
///
/// [Architecture design]:
/// .kvx file is AIKeyVault's proprietary encrypted backup format
///
/// File structure (JSON):
/// {
///   "version": "1.0",
///   "kdf": "argon2id",
///   "cipher": "AES-256-GCM",
///   "salt": "Base64 encoded 32-byte Salt",
///   "nonce": "Base64 encoded 12-byte Nonce",
///   "data": "Base64 encoded encrypted data (VaultItem array JSON)"
/// }
///
/// [Security features]:
/// 1. User-defined export password (independent from master password)
/// 2. Fresh random Salt and Nonce (different for each export)
/// 3. Argon2id derives export-specific key
/// 4. AES-256-GCM encrypts entire data payload
/// 5. Export key immediately Zeroized after encryption/decryption
///
/// [Data merge strategy]:
/// Import uses Upsert strategy:
/// - If ID doesn't exist, insert new record
/// - If ID exists, compare updated_at, keep the newer one
use crate::crypto::{aes, argon2};
use crate::vault::manager::VaultItem;
use rusqlite::Connection;
use serde::{Deserialize, Serialize};
use std::fs;

/// KVX file format (following PRD Section 11 specifications)
#[derive(Serialize, Deserialize)]
pub struct KvxFile {
    pub version: String,
    pub kdf: String,
    pub cipher: String,
    pub salt: String,  // Base64 encoded Salt
    pub nonce: String, // Base64 encoded Nonce
    pub data: String,  // Base64 encoded encrypted data
}

/// Export data to .kvx file
///
/// [Execution flow]:
/// 1. Query all VaultItems from database
/// 2. Decrypt all secrets using master key
/// 3. Create export structure with plaintext secrets
/// 4. Generate fresh random Salt and Nonce for export encryption
/// 5. Use export password + Salt to derive export-specific key (Argon2id)
/// 6. Serialize plaintext data to JSON
/// 7. Use export key + Nonce for AES-256-GCM encryption
/// 8. Assemble KVX JSON structure and write to file
/// 9. Export key immediately Zeroized
///
/// Parameters:
/// - conn: Database connection
/// - export_password: User-defined export password
/// - file_path: File path to save
/// - master_key: Current master key to decrypt secrets
pub fn export_data(
    conn: &Connection,
    export_password: &str,
    file_path: &str,
    master_key: &zeroize::Zeroizing<Vec<u8>>,
) -> Result<(), String> {
    println!("[KVX Export] Starting export process...");

    // 1. Query all VaultItems (with encrypted secrets)
    let items = crate::database::sqlite::query_all_items(conn)
        .map_err(|e| format!("Failed to query vault items: {}", e))?;

    println!("[KVX Export] Found {} items to export", items.len());

    // 2. Create export items with decrypted secrets (plaintext)
    #[derive(serde::Serialize)]
    struct ExportItem {
        id: String,
        title: String,
        provider_id: String,
        secret_plaintext: String, // Plaintext secret for export
        tags: String,
        note: Option<String>,
        favorite: bool,
        usage_count: i32,
        last_used_at: Option<i64>,
        created_at: i64,
        updated_at: i64,
    }

    let mut export_items = Vec::new();

    for item in items {
        // Decrypt secret using master key
        let plaintext_bytes = aes::decrypt_data(&item.secret_cipher, master_key, &item.nonce)
            .map_err(|e| format!("Failed to decrypt item {}: {}", item.id, e))?;

        let plaintext_secret = String::from_utf8(plaintext_bytes)
            .map_err(|e| format!("Failed to parse secret as UTF-8: {}", e))?;

        export_items.push(ExportItem {
            id: item.id,
            title: item.title,
            provider_id: item.provider_id,
            secret_plaintext: plaintext_secret,
            tags: item.tags,
            note: item.note,
            favorite: item.favorite,
            usage_count: item.usage_count,
            last_used_at: item.last_used_at,
            created_at: item.created_at,
            updated_at: item.updated_at,
        });
    }

    println!(
        "[KVX Export] Decrypted {} secrets for export",
        export_items.len()
    );

    // 3. Serialize to JSON (with plaintext secrets)
    let json_data = serde_json::to_string(&export_items)
        .map_err(|e| format!("Failed to serialize vault items: {}", e))?;

    // 4. Generate fresh random Salt and Nonce (ensure each export is different)
    let export_salt = argon2::generate_salt();
    let export_nonce = aes::generate_nonce();

    println!("[KVX Export] Generated fresh Salt and Nonce");

    // 5. Derive export-specific key (protected with Zeroizing)
    let export_key = argon2::derive_master_key(export_password, &export_salt)
        .map_err(|e| format!("Failed to derive export key: {}", e))?;

    println!("[KVX Export] Derived export key using Argon2id");

    // 6. Encrypt data
    let encrypted_data = aes::encrypt_data(json_data.as_bytes(), &export_key, &export_nonce)
        .map_err(|e| format!("Failed to encrypt data: {}", e))?;

    println!(
        "[KVX Export] Encrypted {} bytes of data",
        encrypted_data.len()
    );

    // 7. Assemble KVX file structure
    let kvx_file = KvxFile {
        version: "1.0".to_string(),
        kdf: "argon2id".to_string(),
        cipher: "AES-256-GCM".to_string(),
        salt: base64::Engine::encode(&base64::engine::general_purpose::STANDARD, &export_salt),
        nonce: base64::Engine::encode(&base64::engine::general_purpose::STANDARD, &export_nonce),
        data: base64::Engine::encode(&base64::engine::general_purpose::STANDARD, &encrypted_data),
    };

    // 8. Serialize and write to file
    let kvx_json = serde_json::to_string_pretty(&kvx_file)
        .map_err(|e| format!("Failed to serialize KVX file: {}", e))?;

    fs::write(file_path, kvx_json).map_err(|e| format!("Failed to write KVX file: {}", e))?;

    println!("[KVX Export] Successfully exported vault data");
    println!("[KVX Export] Export key has been zeroized automatically");

    Ok(())
}

/// Import .kvx file
///
/// [Execution flow]:
/// 1. Read .kvx file and parse JSON
/// 2. Validate file format (version, kdf, cipher)
/// 3. Use import password + Salt to derive decryption key (Argon2id)
/// 4. Use decryption key + Nonce for AES-256-GCM decryption
/// 5. Deserialize export items (with plaintext secrets)
/// 6. Re-encrypt secrets using current master key
/// 7. Use Upsert strategy to merge data into SQLite
/// 8. Decryption key immediately Zeroized
///
/// [Data merge strategy]:
/// - If ID doesn't exist, insert new record
/// - If ID exists, compare updated_at, keep the newer one
///
/// Parameters:
/// - conn: Database connection
/// - import_password: User-provided decryption password
/// - file_path: .kvx file path
/// - master_key: Current master key to re-encrypt secrets
pub fn import_data(
    conn: &Connection,
    import_password: &str,
    file_path: &str,
    master_key: &zeroize::Zeroizing<Vec<u8>>,
) -> Result<usize, String> {
    println!("[KVX Import] Starting import process...");

    // 1. Read file content
    let kvx_content =
        fs::read_to_string(file_path).map_err(|e| format!("Failed to read KVX file: {}", e))?;

    // 2. Parse JSON
    let kvx_file: KvxFile = serde_json::from_str(&kvx_content)
        .map_err(|e| format!("Failed to parse KVX file: {}", e))?;

    // 3. Validate file format
    if kvx_file.version != "1.0" {
        return Err(format!("Unsupported KVX version: {}", kvx_file.version));
    }
    if kvx_file.kdf != "argon2id" {
        return Err(format!("Unsupported KDF: {}", kvx_file.kdf));
    }
    if kvx_file.cipher != "AES-256-GCM" {
        return Err(format!("Unsupported cipher: {}", kvx_file.cipher));
    }

    println!("[KVX Import] File format validated (v{})", kvx_file.version);

    // 4. Decode Base64 fields
    let salt = base64::Engine::decode(&base64::engine::general_purpose::STANDARD, &kvx_file.salt)
        .map_err(|e| format!("Failed to decode salt: {}", e))?;

    let nonce = base64::Engine::decode(&base64::engine::general_purpose::STANDARD, &kvx_file.nonce)
        .map_err(|e| format!("Failed to decode nonce: {}", e))?;

    let encrypted_data =
        base64::Engine::decode(&base64::engine::general_purpose::STANDARD, &kvx_file.data)
            .map_err(|e| format!("Failed to decode encrypted data: {}", e))?;

    // 5. Derive decryption key
    let import_key = argon2::derive_master_key(import_password, &salt)
        .map_err(|e| format!("Failed to derive import key: {}", e))?;

    println!("[KVX Import] Derived import key using Argon2id");

    // 6. Decrypt data. Older KVX files used the legacy Argon2 profile and did
    // not store KDF parameters, so fall back once before returning a generic
    // password/corruption error.
    let decrypted_data = match aes::decrypt_data(&encrypted_data, &import_key, &nonce) {
        Ok(data) => data,
        Err(_) => {
            let legacy_import_key = argon2::derive_master_key_legacy(import_password, &salt)
                .map_err(|e| format!("Failed to derive legacy import key: {}", e))?;

            aes::decrypt_data(&encrypted_data, &legacy_import_key, &nonce)
                .map_err(|_| "Incorrect password or corrupted file".to_string())?
        }
    };

    println!("[KVX Import] Successfully decrypted data");

    // 7. Deserialize export items (with plaintext secrets)
    let json_string = String::from_utf8(decrypted_data)
        .map_err(|e| format!("Failed to parse decrypted data as UTF-8: {}", e))?;

    #[derive(serde::Deserialize)]
    struct ImportItem {
        id: String,
        title: String,
        provider_id: String,
        secret_plaintext: String, // Plaintext secret from export
        tags: String,
        note: Option<String>,
        favorite: bool,
        usage_count: i32,
        last_used_at: Option<i64>,
        created_at: i64,
        updated_at: i64,
    }

    let imported_items: Vec<ImportItem> = serde_json::from_str(&json_string)
        .map_err(|e| format!("Failed to deserialize export items: {}", e))?;

    println!(
        "[KVX Import] Parsed {} items from backup",
        imported_items.len()
    );

    // 8. Re-encrypt secrets with current master key and use Upsert strategy
    let mut inserted_count = 0;
    let mut updated_count = 0;
    let mut skipped_count = 0;
    let tx = conn
        .unchecked_transaction()
        .map_err(|e| format!("Failed to start import transaction: {}", e))?;

    for import_item in imported_items {
        // Re-encrypt secret with current master key
        let new_nonce = aes::generate_nonce();
        let secret_cipher = aes::encrypt_data(
            import_item.secret_plaintext.as_bytes(),
            master_key,
            &new_nonce,
        )
        .map_err(|e| format!("Failed to re-encrypt item {}: {}", import_item.id, e))?;

        // Create VaultItem with re-encrypted secret
        let vault_item = VaultItem {
            id: import_item.id.clone(),
            title: import_item.title.clone(),
            provider_id: import_item.provider_id,
            secret_cipher,
            nonce: new_nonce.to_vec(),
            tags: import_item.tags,
            note: import_item.note,
            favorite: import_item.favorite,
            usage_count: import_item.usage_count,
            last_used_at: import_item.last_used_at,
            created_at: import_item.created_at,
            updated_at: import_item.updated_at,
        };

        // Check if already exists
        match crate::database::sqlite::query_item_by_id(&tx, &vault_item.id) {
            Ok(Some(existing_item)) => {
                // Compare updated_at, keep the newer one
                if vault_item.updated_at > existing_item.updated_at {
                    // Update to imported newer data
                    upsert_vault_item(&tx, &vault_item)
                        .map_err(|e| format!("Failed to update item {}: {}", vault_item.id, e))?;
                    updated_count += 1;
                } else {
                    // Local data is newer, skip
                    skipped_count += 1;
                }
            }
            Ok(None) => {
                // Doesn't exist, insert new record
                crate::database::sqlite::insert_vault_item(&tx, &vault_item)
                    .map_err(|e| format!("Failed to insert item {}: {}", vault_item.id, e))?;
                inserted_count += 1;
            }
            Err(e) => {
                return Err(format!("Failed to query item {}: {}", vault_item.id, e));
            }
        }
    }

    tx.commit()
        .map_err(|e| format!("Failed to commit import transaction: {}", e))?;

    println!("[KVX Import] Import complete!");
    println!("  - Inserted: {}", inserted_count);
    println!("  - Updated: {}", updated_count);
    println!("  - Skipped: {}", skipped_count);
    println!("[KVX Import] Import key has been zeroized automatically");

    Ok(inserted_count + updated_count)
}

/// Upsert Vault Item (update existing record)
///
/// Used to overwrite existing records during import
fn upsert_vault_item(conn: &Connection, item: &VaultItem) -> Result<(), rusqlite::Error> {
    conn.execute(
        "INSERT OR REPLACE INTO vault_items (
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
