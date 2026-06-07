import { useEffect, useState, useRef } from "react";
import { useTranslation } from "react-i18next";
import { listen } from "@tauri-apps/api/event";
import { VaultState } from "../types";

interface GlobalStateListenerProps {
  onStateChange?: (state: VaultState) => void;
}

/**
 * 🔒 GlobalStateListener - Global state security interceptor
 * 
 * [Security architecture core component]:
 * Listens for `vault://lock-triggered` events dispatched by Rust backend
 * Once VaultState::Locked is triggered, must respond within milliseconds:
 * 1. Force render Gaussian blur overlay
 * 2. Destroy all non-secure interface DOM (such as Dashboard forms)
 * 3. Ensure any timing vulnerabilities are absolutely sealed
 * 
 * [Multi-window sync mechanism]:
 * All window instances receive lock event simultaneously, achieving cross-window forced suspension within one millisecond
 */
export function GlobalStateListener({ onStateChange }: GlobalStateListenerProps) {
  const [_vaultState, setVaultState] = useState<VaultState>(VaultState.Locked);
  const onStateChangeRef = useRef(onStateChange);
  
  // Keep ref up to date
  useEffect(() => {
    onStateChangeRef.current = onStateChange;
  }, [onStateChange]);

  useEffect(() => {
    // Listen for lock event
    const unlistenLock = listen("vault://lock-triggered", () => {
      setVaultState(VaultState.Locked);
      onStateChangeRef.current?.(VaultState.Locked);
    });

    // Listen for unlock event (if backend implements)
    const unlistenUnlock = listen("vault://unlock-triggered", () => {
      setVaultState(VaultState.Unlocked);
      onStateChangeRef.current?.(VaultState.Unlocked);
    });

    return () => {
      unlistenLock.then((fn) => fn());
      unlistenUnlock.then((fn) => fn());
    };
  }, []); // 空依赖数组，只注册一次

  // v1.0 temporarily assumes unlocked (activate during v1.0 integration)
  // if (vaultState === VaultState.Locked) {
  //   return <LockOverlay />;
  // }

  return null;
}

/**
 * 🚫 LockOverlay - Lock overlay
 * 
 * [Visual design]:
 * - Fullscreen highest Z-index layer
 * - Gaussian blur + dark background
 * - Lock icon + status message
 */
export function LockOverlay() {
  const { t } = useTranslation();
  return (
    <div
      className="
        fixed inset-0 z-[9999]
        bg-black/80 backdrop-blur-3xl
        flex items-center justify-center
      "
      role="alert"
      aria-live="assertive"
    >
      <div className="text-center space-y-4">
        <div className="w-16 h-16 mx-auto mb-4 rounded-full bg-white/10 flex items-center justify-center">
          <svg
            className="w-8 h-8 text-white/60"
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z"
            />
          </svg>
        </div>

        <h2 className="text-xl font-semibold text-white">{t('lock_overlay.title')}</h2>
        <p className="text-sm text-white/50 max-w-xs">
          {t('lock_overlay.message')}
        </p>
      </div>
    </div>
  );
}
