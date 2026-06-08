/**
 * UpdateCheckModal - Version update check popup
 *
 * v1.0.2
 * Opens when user clicks "Check for Updates" in SystemPanel.
 * Calls the Rust backend to query GitHub Releases API.
 *
 * States: checking → upToDate | updateAvailable | error
 */

import React, { useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { invoke } from '@tauri-apps/api/core';
import { RefreshCw, Check, ExternalLink, AlertCircle, X } from 'lucide-react';

interface UpdateInfo {
  has_update: boolean;
  current_version: string;
  latest_version: string;
  release_url: string;
  release_notes: string;
}

type ModalState = 'checking' | 'upToDate' | 'updateAvailable' | 'error';

interface UpdateCheckModalProps {
  onClose: () => void;
}

export const UpdateCheckModal: React.FC<UpdateCheckModalProps> = ({ onClose }) => {
  const { t } = useTranslation();
  const [state, setState] = React.useState<ModalState>('checking');
  const [updateInfo, setUpdateInfo] = React.useState<UpdateInfo | null>(null);
  const [errorMsg, setErrorMsg] = React.useState('');

  useEffect(() => {
    const check = async () => {
      try {
        const info = await invoke<UpdateInfo>('check_for_update');
        setUpdateInfo(info);
        setState(info.has_update ? 'updateAvailable' : 'upToDate');
      } catch (err) {
        console.error('[UpdateCheck] Failed:', err);
        setErrorMsg(String(err));
        setState('error');
      }
    };
    check();
  }, []);

  const handleOpenRelease = () => {
    if (updateInfo?.release_url) {
      invoke('open_url', { url: updateInfo.release_url })
        .catch((err) => console.error('[UpdateCheck] Failed to open URL:', err));
    }
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm"
      onClick={onClose}
    >
      <div
        className="w-full max-w-sm bg-slate-800/90 backdrop-blur-2xl rounded-2xl shadow-[0_0_0_1px_rgba(255,255,255,0.05),0_20px_50px_-12px_rgba(0,0,0,0.8),0_0_100px_rgba(0,0,0,0.4)] flex flex-col overflow-hidden"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="px-6 py-4 flex items-start justify-between flex-shrink-0 border-b border-white/5">
          <div>
            <h3 className="text-base font-semibold text-white/90">
              {t('system.updateModalTitle') || 'Check for Updates'}
            </h3>
          </div>
          <button
            onClick={onClose}
            className="p-1 rounded-lg text-white/40 hover:text-white/70 hover:bg-white/10 transition-colors"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Content */}
        <div className="px-6 py-6 flex flex-col items-center text-center gap-4">
          {/* --- Checking --- */}
          {state === 'checking' && (
            <>
              <div className="w-16 h-16 rounded-2xl bg-blue-500/10 flex items-center justify-center">
                <RefreshCw className="w-8 h-8 text-blue-400 animate-spin" />
              </div>
              <div>
                <p className="text-sm font-medium text-white/80">
                  {t('system.checkingUpdate') || 'Checking for updates...'}
                </p>
                <p className="text-xs text-white/40 mt-1">
                  {t('system.checkingUpdateHint') || 'Querying GitHub Releases'}
                </p>
              </div>
              {/* Animated dots */}
              <div className="flex gap-1.5">
                <div className="w-2 h-2 rounded-full bg-white/20 animate-bounce [animation-delay:0ms]" />
                <div className="w-2 h-2 rounded-full bg-white/20 animate-bounce [animation-delay:150ms]" />
                <div className="w-2 h-2 rounded-full bg-white/20 animate-bounce [animation-delay:300ms]" />
              </div>
            </>
          )}

          {/* --- Up to Date --- */}
          {state === 'upToDate' && (
            <>
              <div className="w-16 h-16 rounded-2xl bg-green-500/10 flex items-center justify-center">
                <Check className="w-8 h-8 text-green-400" />
              </div>
              <div>
                <p className="text-sm font-medium text-green-400">
                  {t('system.updateUpToDate') || "You're up to date!"}
                </p>
                <p className="text-xs text-white/40 mt-1">
                  {updateInfo
                    ? `v${updateInfo.current_version} ${t('system.updateLatestVersion') || 'is the latest version'}`
                    : ''
                  }
                </p>
              </div>
              <button
                onClick={onClose}
                className="mt-2 px-6 py-2 bg-white/10 border border-white/10 rounded-xl text-sm text-white/70 hover:bg-white/15 transition-colors"
              >
                {t('common.confirm') || 'OK'}
              </button>
            </>
          )}

          {/* --- Update Available --- */}
          {state === 'updateAvailable' && updateInfo && (
            <>
              <div className="w-16 h-16 rounded-2xl bg-amber-500/10 flex items-center justify-center">
                <AlertCircle className="w-8 h-8 text-amber-400" />
              </div>
              <div>
                <div className="inline-flex items-center gap-1.5 px-3 py-1 bg-amber-500/15 border border-amber-500/30 rounded-full mb-3">
                  <span className="w-1.5 h-1.5 rounded-full bg-amber-400 animate-pulse" />
                  <span className="text-xs font-medium text-amber-400">
                    {t('system.updateAvailable') || 'New version available!'}
                  </span>
                </div>
                <div className="flex items-center justify-center gap-3 text-sm">
                  <span className="text-white/40 font-mono">v{updateInfo.current_version}</span>
                  <span className="text-white/20">→</span>
                  <span className="text-white font-mono font-semibold">v{updateInfo.latest_version}</span>
                </div>
              </div>

              {/* Release Notes Preview */}
              {updateInfo.release_notes && (
                <div className="w-full max-h-32 overflow-y-auto bg-black/20 rounded-xl p-3 text-left [scrollbar-width:none]">
                  <p className="text-xs text-white/50 whitespace-pre-line">
                    {updateInfo.release_notes}
                  </p>
                </div>
              )}

              <div className="flex items-center gap-3 mt-2">
                <button
                  onClick={handleOpenRelease}
                  className="flex items-center gap-2 px-5 py-2.5 bg-amber-500/20 border border-amber-500/30 rounded-xl text-sm text-amber-400 hover:bg-amber-500/30 transition-colors font-medium"
                >
                  <ExternalLink className="w-4 h-4" />
                  <span>{t('system.updateViewRelease') || 'View Release'}</span>
                </button>
                <button
                  onClick={onClose}
                  className="px-5 py-2.5 bg-white/5 border border-white/10 rounded-xl text-sm text-white/50 hover:bg-white/10 transition-colors"
                >
                  {t('system.updateLater') || 'Later'}
                </button>
              </div>
            </>
          )}

          {/* --- Error --- */}
          {state === 'error' && (
            <>
              <div className="w-16 h-16 rounded-2xl bg-red-500/10 flex items-center justify-center">
                <AlertCircle className="w-8 h-8 text-red-400" />
              </div>
              <div>
                <p className="text-sm font-medium text-red-400">
                  {t('system.updateError') || 'Update check failed'}
                </p>
                <p className="text-xs text-white/30 mt-2 max-w-[280px] break-words">
                  {errorMsg}
                </p>
              </div>
              <button
                onClick={onClose}
                className="mt-2 px-6 py-2 bg-white/10 border border-white/10 rounded-xl text-sm text-white/70 hover:bg-white/15 transition-colors"
              >
                {t('common.confirm') || 'OK'}
              </button>
            </>
          )}
        </div>
      </div>
    </div>
  );
};
