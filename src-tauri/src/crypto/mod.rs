pub mod aes;
/// Crypto Module - Encryption and Key Derivation
///
/// Submodules:
/// - argon2: Master password hashing and key derivation
/// - aes: AES-256-GCM encryption/decryption
pub mod argon2;

// Re-export commonly used functions
pub use aes::{decrypt_data, encrypt_data, generate_nonce};
pub use argon2::{
    derive_master_key, derive_master_key_from_password_hash, generate_salt, hash_master_password,
    verify_master_password,
};
