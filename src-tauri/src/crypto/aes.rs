/// AES-256-GCM Encryption/Decryption Module
/// 
/// Security Architecture Core
/// Provides data confidentiality, integrity verification, tamper-proof capability
/// 
/// Nonce rules:
/// - Each record uses independent 96-bit random Nonce
/// - Strictly forbidden to use fixed or reused Nonce
/// 
/// Data format:
/// - CipherText: Encrypted data
/// - Nonce: Independently stored (12 bytes)
/// - Auth Tag: Appended to CipherText end (16 bytes)
/// 
/// IPC isolation principle:
/// - Plaintext data (API Key) absolutely forbidden to pass to frontend via IPC
/// - Encryption/decryption operations must complete closed-loop in Rust backend

use aes_gcm::{
    aead::{Aead, KeyInit},
    Aes256Gcm, Nonce,
};
use rand::RngCore;
use zeroize::Zeroizing;

/// Generate random Nonce (96-bit / 12 bytes)
/// 
/// Use cryptographically secure random number generator (CSPRNG)
/// Must generate new Nonce for each encryption operation
pub fn generate_nonce() -> Vec<u8> {
    let mut nonce = vec![0u8; 12];
    rand::thread_rng().fill_bytes(&mut nonce);
    nonce
}

/// Encrypt data
/// 
/// Parameters:
/// - plaintext: Plaintext data (such as API Key)
/// - master_key: Master encryption key (from Argon2id, 32 bytes)
/// - nonce: Randomly generated Nonce (12 bytes)
/// 
/// Returns: (CipherText + AuthTag)
/// 
/// [Memory safety guarantee]:
/// - master_key wrapped with Zeroizing, automatically cleared
/// - plaintext cleaned by caller after encryption
/// - Returned ciphertext includes 16-byte Auth Tag (automatically appended)
pub fn encrypt_data(
    plaintext: &[u8],
    master_key: &Zeroizing<Vec<u8>>,
    nonce: &[u8],
) -> Result<Vec<u8>, String> {
    // Validate parameters
    if master_key.len() != 32 {
        return Err("Invalid master key length: expected 32 bytes".to_string());
    }
    if nonce.len() != 12 {
        return Err("Invalid nonce length: expected 12 bytes".to_string());
    }

    // Initialize AES-256-GCM cipher
    let cipher = Aes256Gcm::new_from_slice(master_key.as_ref())
        .map_err(|e| format!("Failed to initialize cipher: {}", e))?;

    // Convert Nonce
    let nonce_array = Nonce::from_slice(nonce);

    // Execute encryption (Auth Tag automatically appended to ciphertext end)
    let ciphertext = cipher
        .encrypt(nonce_array, plaintext)
        .map_err(|e| format!("Encryption failed: {}", e))?;

    Ok(ciphertext)
}

/// Decrypt data
/// 
/// Parameters:
/// - ciphertext: Encrypted data (includes Auth Tag)
/// - master_key: Master encryption key (32 bytes)
/// - nonce: Stored Nonce (12 bytes)
/// 
/// Returns: Plaintext data
/// 
/// [Security warning]:
/// - Returned plaintext data absolutely forbidden to pass to frontend via IPC
/// - Only use closed-loop on Rust side (such as write to clipboard)
/// - Caller must ensure plaintext is cleared immediately after use
pub fn decrypt_data(
    ciphertext: &[u8],
    master_key: &Zeroizing<Vec<u8>>,
    nonce: &[u8],
) -> Result<Vec<u8>, String> {
    // Validate parameters
    if master_key.len() != 32 {
        return Err("Invalid master key length: expected 32 bytes".to_string());
    }
    if nonce.len() != 12 {
        return Err("Invalid nonce length: expected 12 bytes".to_string());
    }

    // Initialize AES-256-GCM cipher
    let cipher = Aes256Gcm::new_from_slice(master_key.as_ref())
        .map_err(|e| format!("Failed to initialize cipher: {}", e))?;

    // Convert Nonce
    let nonce_array = Nonce::from_slice(nonce);

    // Execute decryption (Auth Tag automatically verifies integrity)
    let plaintext = cipher
        .decrypt(nonce_array, ciphertext)
        .map_err(|e| format!("Decryption failed (possible tampering): {}", e))?;

    Ok(plaintext)
}
