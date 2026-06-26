/// Argon2id key derivation module.
///
/// Current profile:
/// - Memory: 64 MiB
/// - Iterations: 3
/// - Parallelism: 4
/// - Output: 32 bytes
///
/// Existing vaults created with the legacy 16 MiB / 2 iteration profile remain
/// readable through `derive_master_key_from_password_hash`. New vaults, master
/// password changes, and new KVX exports use the current profile.
use argon2::{
    password_hash::{PasswordHash, PasswordHasher, PasswordVerifier, SaltString},
    Algorithm, Argon2, Params, Version,
};
use rand::RngCore;
use zeroize::Zeroizing;

const ARGON2_MEMORY_KIB: u32 = 65_536;
const ARGON2_ITERATIONS: u32 = 3;
const ARGON2_PARALLELISM: u32 = 4;
const ARGON2_OUTPUT_LEN: usize = 32;

const LEGACY_ARGON2_MEMORY_KIB: u32 = 16_384;
const LEGACY_ARGON2_ITERATIONS: u32 = 2;

fn build_params(memory_kib: u32, iterations: u32, parallelism: u32) -> Result<Params, String> {
    Params::new(memory_kib, iterations, parallelism, Some(ARGON2_OUTPUT_LEN))
        .map_err(|e| format!("Failed to create Argon2 params: {}", e))
}

fn current_params() -> Result<Params, String> {
    build_params(ARGON2_MEMORY_KIB, ARGON2_ITERATIONS, ARGON2_PARALLELISM)
}

fn legacy_params() -> Result<Params, String> {
    build_params(
        LEGACY_ARGON2_MEMORY_KIB,
        LEGACY_ARGON2_ITERATIONS,
        ARGON2_PARALLELISM,
    )
}

/// Generate random 32-byte salt.
pub fn generate_salt() -> Vec<u8> {
    let mut salt = vec![0u8; 32];
    rand::thread_rng().fill_bytes(&mut salt);
    salt
}

/// Derive a 256-bit master encryption key using the current Argon2id profile.
pub fn derive_master_key(master_password: &str, salt: &[u8]) -> Result<Zeroizing<Vec<u8>>, String> {
    derive_master_key_with_params(master_password, salt, current_params()?)
}

/// Derive a master key using Argon2 parameters embedded in the PHC password hash.
///
/// This is required because the same KDF output encrypts vault records. If an
/// existing vault was created with older parameters, unlock must derive the old
/// key until the user rotates the master password and re-encrypts the records.
pub fn derive_master_key_from_password_hash(
    master_password: &str,
    salt: &[u8],
    stored_hash: &str,
) -> Result<Zeroizing<Vec<u8>>, String> {
    let parsed_hash = PasswordHash::new(stored_hash)
        .map_err(|e| format!("Failed to parse password hash: {}", e))?;
    let params = Params::try_from(&parsed_hash)
        .map_err(|e| format!("Failed to read Argon2 params from password hash: {}", e))?;

    derive_master_key_with_params(master_password, salt, params)
}

/// Derive a key using the legacy 16 MiB / 2 iteration profile.
///
/// Only used for importing older KVX files that do not carry KDF parameters.
pub fn derive_master_key_legacy(
    master_password: &str,
    salt: &[u8],
) -> Result<Zeroizing<Vec<u8>>, String> {
    derive_master_key_with_params(master_password, salt, legacy_params()?)
}

fn derive_master_key_with_params(
    master_password: &str,
    salt: &[u8],
    params: Params,
) -> Result<Zeroizing<Vec<u8>>, String> {
    if salt.len() != 32 {
        return Err("Invalid salt length: expected 32 bytes".to_string());
    }

    let argon2 = Argon2::new(Algorithm::Argon2id, Version::V0x13, params);
    let mut output_key = Zeroizing::new(vec![0u8; ARGON2_OUTPUT_LEN]);

    argon2
        .hash_password_into(master_password.as_bytes(), salt, &mut output_key)
        .map_err(|e| format!("Failed to derive key: {}", e))?;

    Ok(output_key)
}

/// Verify a master password against the stored PHC hash.
pub fn verify_master_password(master_password: &str, stored_hash: &str) -> Result<bool, String> {
    let parsed_hash = PasswordHash::new(stored_hash)
        .map_err(|e| format!("Failed to parse password hash: {}", e))?;
    let argon2 = Argon2::default();

    match argon2.verify_password(master_password.as_bytes(), &parsed_hash) {
        Ok(_) => Ok(true),
        Err(argon2::password_hash::Error::Password) => Ok(false),
        Err(e) => Err(format!("Password verification error: {}", e)),
    }
}

/// Generate a PHC-format master password hash using the current Argon2id profile.
pub fn hash_master_password(master_password: &str, salt: &[u8]) -> Result<String, String> {
    if salt.len() != 32 {
        return Err("Invalid salt length: expected 32 bytes".to_string());
    }

    let argon2 = Argon2::new(Algorithm::Argon2id, Version::V0x13, current_params()?);
    let salt_string =
        SaltString::encode_b64(salt).map_err(|e| format!("Failed to encode salt: {}", e))?;

    let password_hash = argon2
        .hash_password(master_password.as_bytes(), &salt_string)
        .map_err(|e| format!("Failed to hash password: {}", e))?;

    Ok(password_hash.to_string())
}

#[cfg(test)]
mod tests {
    use super::*;

    const TEST_SALT: [u8; 32] = [7u8; 32];

    #[test]
    fn hash_master_password_uses_current_params() {
        let hash = hash_master_password("correct horse battery staple", &TEST_SALT).unwrap();

        assert!(hash.contains("m=65536,t=3,p=4"));
        assert!(verify_master_password("correct horse battery staple", &hash).unwrap());
        assert!(!verify_master_password("wrong password", &hash).unwrap());
    }

    #[test]
    fn derive_master_key_from_password_hash_preserves_legacy_params() {
        let salt_string = SaltString::encode_b64(&TEST_SALT).unwrap();
        let argon2 = Argon2::new(
            Algorithm::Argon2id,
            Version::V0x13,
            legacy_params().unwrap(),
        );
        let legacy_hash = argon2
            .hash_password("legacy password".as_bytes(), &salt_string)
            .unwrap()
            .to_string();

        assert!(legacy_hash.contains("m=16384,t=2,p=4"));

        let from_hash =
            derive_master_key_from_password_hash("legacy password", &TEST_SALT, &legacy_hash)
                .unwrap();
        let direct_legacy = derive_master_key_legacy("legacy password", &TEST_SALT).unwrap();

        assert_eq!(&*from_hash, &*direct_legacy);
    }
}
