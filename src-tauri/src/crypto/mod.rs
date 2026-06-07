/// Crypto Module - Encryption and Key Derivation
/// 
/// Submodules:
/// - argon2: Master password hashing and key derivation
/// - aes: AES-256-GCM encryption/decryption

pub mod argon2;
pub mod aes;

// Re-export commonly used functions
pub use argon2::{generate_salt, hash_master_password, verify_master_password, derive_master_key};
pub use aes::{encrypt_data, decrypt_data, generate_nonce};
