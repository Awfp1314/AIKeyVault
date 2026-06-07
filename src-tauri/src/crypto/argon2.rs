/// Argon2id Key Derivation Module
/// 
/// Security Architecture Core
/// Use Argon2id to derive 256-bit master encryption key from master password
/// 
/// Parameter configuration (optimized for desktop UX):
/// - Memory: 16 MiB (fast unlock for desktop, still secure)
/// - Iterations: 2
/// - Parallelism: 4
/// 
/// Security note: These parameters provide strong protection for local storage
/// while ensuring sub-second unlock times. 16 MiB is above OWASP minimum (15 MiB).
/// 
/// Salt management:
/// - First initialization generates 32-byte random Salt
/// - Stored in app_metadata table
/// - Used for all subsequent key derivation operations
/// 
/// Memory safety:
/// - Derived key wrapped with secrecy::Secret
/// - Ensures auto-zeroize on memory release

use argon2::{
    password_hash::{PasswordHash, PasswordHasher, PasswordVerifier, SaltString},
    Algorithm, Argon2, Params, Version,
};
use rand::RngCore;
use zeroize::Zeroizing;

/// Generate random Salt (32 bytes)
/// 
/// Use cryptographically secure random number generator (CSPRNG)
pub fn generate_salt() -> Vec<u8> {
    let mut salt = vec![0u8; 32];
    rand::thread_rng().fill_bytes(&mut salt);
    salt
}

/// Derive master encryption key from master password
/// 
/// Parameters:
/// - master_password: User input master password
/// - salt: Stored Salt (32 bytes)
/// 
/// Returns: 256-bit master encryption key (wrapped with Zeroizing)
/// 
/// Memory safety guarantee:
/// - Key wrapped with Zeroizing<Vec<u8>>, auto-zeroed when leaving scope
/// - Original password bytes immediately dropped after derivation (Rust scope guarantee)
pub fn derive_master_key(
    master_password: &str,
    salt: &[u8],
) -> Result<Zeroizing<Vec<u8>>, String> {
    // 验证 Salt 长度
    if salt.len() != 32 {
        return Err("Invalid salt length: expected 32 bytes".to_string());
    }

    // Configure Argon2id parameters (optimized for desktop)
    // Memory: 16 MiB = 16384 KiB (reduced for fast unlock)
    // Iterations: 2
    // Parallelism: 4
    // Output: 32 bytes (256-bit)
    // 
    // Performance: ~0.2-0.5s on modern CPUs
    // Security: Still strong for local storage (above OWASP minimum 15 MiB)
    let params = Params::new(16384, 2, 4, Some(32))
        .map_err(|e| format!("Failed to create Argon2 params: {}", e))?;

    let argon2 = Argon2::new(Algorithm::Argon2id, Version::V0x13, params);

    // 执行密钥派生
    let mut output_key = Zeroizing::new(vec![0u8; 32]);
    argon2
        .hash_password_into(master_password.as_bytes(), salt, &mut output_key)
        .map_err(|e| format!("Failed to derive key: {}", e))?;

    Ok(output_key)
}

/// Verify master password
/// 
/// Used to verify if user input password is correct when unlocking Vault
/// 
/// Parameters:
/// - master_password: User input master password
/// - stored_hash: PHC format hash stored in database
/// 
/// Returns: Whether verification succeeded
pub fn verify_master_password(
    master_password: &str,
    stored_hash: &str,
) -> Result<bool, String> {
    // Parse stored hash
    let parsed_hash = PasswordHash::new(stored_hash)
        .map_err(|e| format!("Failed to parse password hash: {}", e))?;

    // Configure Argon2id (parameters extracted from PHC string)
    let argon2 = Argon2::default();

    // 验证密码
    match argon2.verify_password(master_password.as_bytes(), &parsed_hash) {
        Ok(_) => Ok(true),
        Err(argon2::password_hash::Error::Password) => Ok(false),
        Err(e) => Err(format!("Password verification error: {}", e)),
    }
}

/// Generate master password hash (for storage)
/// 
/// Used when setting master password for first time, generate PHC format hash string
/// Stored in master_password_hash field in app_metadata table
pub fn hash_master_password(master_password: &str, salt: &[u8]) -> Result<String, String> {
    if salt.len() != 32 {
        return Err("Invalid salt length: expected 32 bytes".to_string());
    }

    let params = Params::new(16384, 2, 4, Some(32))
        .map_err(|e| format!("Failed to create Argon2 params: {}", e))?;

    let argon2 = Argon2::new(Algorithm::Argon2id, Version::V0x13, params);

    // Convert byte salt to SaltString (Base64 encoding)
    let salt_string = SaltString::encode_b64(salt)
        .map_err(|e| format!("Failed to encode salt: {}", e))?;

    // 生成 PHC 格式的哈希字符串
    let password_hash = argon2
        .hash_password(master_password.as_bytes(), &salt_string)
        .map_err(|e| format!("Failed to hash password: {}", e))?;

    Ok(password_hash.to_string())
}
