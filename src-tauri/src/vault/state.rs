/// VaultState state machine module
///
/// [Security architecture core]:
/// Unified management of three Vault states
///
/// State definitions:
/// - FirstLaunch: First launch, need to set master password
/// - Locked: Locked, need to enter master password to unlock
/// - Unlocked: Unlocked, can access sensitive data
///
/// State transitions:
/// FirstLaunch --[Set master password]--> Unlocked
/// Unlocked --[Auto-lock/Manual lock]--> Locked
/// Locked --[Verify master password]--> Unlocked
///
/// Memory safety:
/// - When entering Locked state: Clear master encryption key, destroy sensitive cache
/// - When entering Unlocked state: Re-execute Argon2id key derivation
///
/// Global sync mechanism:
/// - When state changes, broadcast IPC events to all frontend windows
/// - Events: vault://lock-triggered, vault://unlocked, etc.
use serde::{Deserialize, Serialize};
use std::sync::{Arc, RwLock};
use std::time::{SystemTime, UNIX_EPOCH};
use zeroize::Zeroizing;

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, Eq)]
pub enum VaultState {
    FirstLaunch,
    Locked,
    Unlocked,
}

impl VaultState {
    /// Check if it's the first launch
    pub fn is_first_launch(&self) -> bool {
        matches!(self, VaultState::FirstLaunch)
    }

    /// Check if locked
    pub fn is_locked(&self) -> bool {
        matches!(self, VaultState::Locked)
    }

    /// Check if unlocked
    pub fn is_unlocked(&self) -> bool {
        matches!(self, VaultState::Unlocked)
    }
}

/// State Manager
///
/// [Memory safety guarantee]:
/// - master_key wrapped with Zeroizing, automatically cleared
/// - transition_to_locked() actively clears master_key
/// - Thread-safe (using Arc<RwLock>)
pub struct StateManager {
    /// Current state (thread-safe)
    state: Arc<RwLock<VaultState>>,

    /// Master encryption key (only exists in Unlocked state)
    /// [Memory safety]: Wrapped with Zeroizing, automatically cleared when out of scope
    master_key: Arc<RwLock<Option<Zeroizing<Vec<u8>>>>>,

    /// Last activity timestamp (Unix timestamp, seconds)
    /// [Phase 5.2 added] Used for auto-lock daemon thread
    last_activity_time: Arc<RwLock<i64>>,
}

impl StateManager {
    /// Create new state manager
    pub fn new(initial_state: VaultState) -> Self {
        let now = SystemTime::now()
            .duration_since(UNIX_EPOCH)
            .unwrap()
            .as_secs() as i64;

        Self {
            state: Arc::new(RwLock::new(initial_state)),
            master_key: Arc::new(RwLock::new(None)),
            last_activity_time: Arc::new(RwLock::new(now)),
        }
    }

    /// Get the current state
    pub fn get_state(&self) -> VaultState {
        self.state.read().unwrap().clone()
    }

    /// Transition to Unlocked state
    ///
    /// Parameters:
    /// - master_key: Derived master encryption key
    ///
    /// [Security requirement]: Caller must first verify master password and derive master encryption key
    pub fn transition_to_unlocked(&self, master_key: Zeroizing<Vec<u8>>) {
        let mut state = self.state.write().unwrap();
        let mut key = self.master_key.write().unwrap();

        *state = VaultState::Unlocked;
        *key = Some(master_key);
    }

    /// Transition to Locked state
    ///
    /// [Memory safety core]:
    /// 1. Clear master encryption key (Secret automatically Zeroized)
    /// 2. Update state to Locked
    /// 3. Dispatch vault://lock-triggered event to frontend (handled by caller)
    pub fn transition_to_locked(&self) {
        let mut state = self.state.write().unwrap();
        let mut key = self.master_key.write().unwrap();

        // [Key]: Actively clear master encryption key
        // Secret<Vec<u8>> will automatically execute Zeroize on Drop
        *key = None;

        *state = VaultState::Locked;
    }

    /// Get master encryption key (only available in Unlocked state)
    ///
    /// Returns clone of key (Zeroizing wrapped)
    ///
    /// [Security warning]:
    /// - Only for Rust backend internal use
    /// - Absolutely forbidden to pass key to frontend
    pub fn get_master_key(&self) -> Option<Zeroizing<Vec<u8>>> {
        let key = self.master_key.read().unwrap();
        key.as_ref().map(|k| {
            // Create new Zeroizing wrapper (clone content)
            Zeroizing::new(k.to_vec())
        })
    }

    /// Check if unlocked
    pub fn is_unlocked(&self) -> bool {
        matches!(self.get_state(), VaultState::Unlocked)
    }

    /// Check if it's the first launch
    pub fn is_first_launch(&self) -> bool {
        matches!(self.get_state(), VaultState::FirstLaunch)
    }

    /// Check if locked
    pub fn is_locked(&self) -> bool {
        matches!(self.get_state(), VaultState::Locked)
    }

    /// Update last activity time (called by heartbeat mechanism)
    /// [Phase 5.2 added]
    pub fn update_last_activity(&self) {
        let now = SystemTime::now()
            .duration_since(UNIX_EPOCH)
            .unwrap()
            .as_secs() as i64;

        let mut last_activity = self.last_activity_time.write().unwrap();
        *last_activity = now;
    }

    /// Get last activity time
    /// [Phase 5.2 added]
    pub fn get_last_activity_time(&self) -> i64 {
        *self.last_activity_time.read().unwrap()
    }

    /// Check if auto-lock is needed
    /// [Phase 5.2 added]
    /// Parameter: timeout_seconds - Timeout duration (seconds)
    /// Returns: true means lock is needed
    pub fn should_auto_lock(&self, timeout_seconds: i64) -> bool {
        // Only check auto-lock in Unlocked state
        if !self.is_unlocked() {
            return false;
        }

        let now = SystemTime::now()
            .duration_since(UNIX_EPOCH)
            .unwrap()
            .as_secs() as i64;

        let last_activity = self.get_last_activity_time();
        let elapsed = now - last_activity;

        elapsed >= timeout_seconds
    }
}
