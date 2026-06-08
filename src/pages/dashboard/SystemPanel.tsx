/**
 * SystemPanel - macOS-Style Native Settings Panel
 * 
 * Features:
 * 1. Language switch (Segmented Control)
 * 2. Startup settings (iOS Toggle Switch)
 * 3. Global shortcut display (Keyboard kbd tags)
 * 4. About info (Horizontal layout)
 * 
 * Design Philosophy: Precision, restraint, and desktop-native feel
 */

import React, { useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { invoke } from '@tauri-apps/api/core';
import { Globe, Rocket, Keyboard, Info, ChevronDown, Edit2, Check, X, RefreshCw } from 'lucide-react';
import { UpdateCheckModal } from '../../components/UpdateCheckModal';

// Language options with extensibility
const LANGUAGE_OPTIONS = [
  { value: 'zh-CN', label: '简体中文', flag: '🇨🇳' },
  { value: 'en-US', label: 'English', flag: '🇺🇸' },
  { value: 'ja-JP', label: '日本語', flag: '🇯🇵' },
  { value: 'ko-KR', label: '한국어', flag: '🇰🇷' },
];

// Platform-aware key display mapping
const getKeyDisplay = (key: string): string => {
  const isMac = navigator.platform.toUpperCase().indexOf('MAC') >= 0;
  
  if (isMac) {
    const macMap: Record<string, string> = {
      'Cmd': '⌘',
      'Ctrl': '⌃',
      'Alt': '⌥',
      'Shift': '⇧',
      'Space': 'Space',
    };
    return macMap[key] || key;
  }
  
  return key; // Windows/Linux keeps original
};

// Get default shortcut based on OS
const getDefaultShortcut = (): string => {
  const isMac = navigator.platform.toUpperCase().indexOf('MAC') >= 0;
  return isMac ? 'Cmd+Shift+Space' : 'Ctrl+Shift+Space';
};

export const SystemPanel: React.FC = () => {
  const { t, i18n } = useTranslation();
  const [currentLanguage, setCurrentLanguage] = useState(i18n.language);
  const [isSaving, setIsSaving] = useState(false);
  const [startupEnabled, setStartupEnabled] = useState(false);
  const [isLanguageDropdownOpen, setIsLanguageDropdownOpen] = useState(false);
  const [isLoadingStartup, setIsLoadingStartup] = useState(true);
  const [currentShortcut, setCurrentShortcut] = useState(getDefaultShortcut());
  const [isEditingShortcut, setIsEditingShortcut] = useState(false);
  const [recordingKeys, setRecordingKeys] = useState<string[]>([]);
  const [isLoadingShortcut, setIsLoadingShortcut] = useState(true);
  const [showUpdateModal, setShowUpdateModal] = useState(false);

  useEffect(() => {
    loadLanguageFromBackend();
    loadStartupState();
    loadShortcut();
  }, []);

  const loadLanguageFromBackend = async () => {
    try {
      const settings = await invoke<{
        auto_lock_timeout: number;
        clipboard_clear_timeout: number;
        language: string;
      }>('get_app_settings');
      
      if (settings.language && settings.language !== i18n.language) {
        await i18n.changeLanguage(settings.language);
        setCurrentLanguage(settings.language);
      } else {
        setCurrentLanguage(i18n.language);
      }
    } catch (err) {
      console.error('[SystemPanel] Failed to load language:', err);
      setCurrentLanguage(i18n.language);
    }
  };

  const loadStartupState = async () => {
    setIsLoadingStartup(true);
    try {
      const enabled = await invoke<boolean>('is_startup_enabled');
      setStartupEnabled(enabled);
    } catch (err) {
      console.error('[SystemPanel] Failed to load startup state:', err);
      setStartupEnabled(false);
    } finally {
      setIsLoadingStartup(false);
    }
  };

  const loadShortcut = async () => {
    setIsLoadingShortcut(true);
    try {
      const shortcut = await invoke<string>('get_global_shortcut');
      setCurrentShortcut(shortcut);
    } catch (err) {
      console.error('[SystemPanel] Failed to load shortcut:', err);
      // Use default based on OS
      setCurrentShortcut(getDefaultShortcut());
    } finally {
      setIsLoadingShortcut(false);
    }
  };

  const handleLanguageChange = async (lang: string) => {
    if (isSaving || lang === currentLanguage) return;
    
    setIsSaving(true);
    setIsLanguageDropdownOpen(false); // Close dropdown after selection
    
    try {
      setCurrentLanguage(lang);
      await i18n.changeLanguage(lang);
      
      const currentSettings = await invoke<{
        auto_lock_timeout: number;
        clipboard_clear_timeout: number;
        language: string;
      }>('get_app_settings');
      
      await invoke('update_app_settings', {
        settings: {
          auto_lock_timeout: currentSettings.auto_lock_timeout,
          clipboard_clear_timeout: currentSettings.clipboard_clear_timeout,
          language: lang,
        }
      });
    } catch (err) {
      console.error('[SystemPanel] Failed to save language:', err);
      setCurrentLanguage(i18n.language);
    } finally {
      setIsSaving(false);
    }
  };

  const handleStartupToggle = async () => {
    const newState = !startupEnabled;
    setStartupEnabled(newState); // Optimistic UI update
    
    try {
      if (newState) {
        await invoke('enable_startup');
      } else {
        await invoke('disable_startup');
      }
    } catch (err) {
      console.error('[SystemPanel] Failed to toggle startup:', err);
      // Revert on error
      setStartupEnabled(!newState);
      alert(`Failed to ${newState ? 'enable' : 'disable'} startup: ${err}`);
    }
  };

  // Start recording shortcut
  const handleStartEditShortcut = () => {
    setIsEditingShortcut(true);
    setRecordingKeys([]);
  };

  // Cancel shortcut editing
  const handleCancelEditShortcut = () => {
    setIsEditingShortcut(false);
    setRecordingKeys([]);
  };

  // Save new shortcut
  const handleSaveShortcut = async () => {
    if (recordingKeys.length === 0) {
      handleCancelEditShortcut();
      return;
    }

    const newShortcut = recordingKeys.join('+');
    
    try {
      await invoke('update_global_shortcut', { shortcut: newShortcut });
      setCurrentShortcut(newShortcut);
      setIsEditingShortcut(false);
      setRecordingKeys([]);
    } catch (err) {
      console.error('[SystemPanel] Failed to update shortcut:', err);
      alert(`Failed to update shortcut: ${err}`);
    }
  };

  // Handle keyboard input for shortcut recording
  const handleShortcutKeyDown = (e: React.KeyboardEvent) => {
    e.preventDefault();
    e.stopPropagation();

    const keys: string[] = [];
    
    // 🔥 FIXED: Check Meta/Cmd first with highest priority
    if (e.metaKey || e.key === 'Meta') {
      keys.push('Cmd');
    } else if (e.ctrlKey || e.key === 'Control') {
      // Only add Ctrl if no Meta key
      keys.push('Ctrl');
    }
    
    if (e.altKey || e.key === 'Alt') keys.push('Alt');
    if (e.shiftKey || e.key === 'Shift') keys.push('Shift');
    
    // Main key (not a modifier)
    if (!['Meta', 'Control', 'Alt', 'Shift'].includes(e.key)) {
      const key = e.key === ' ' ? 'Space' : e.key.toUpperCase();
      if (key.length === 1 || key === 'SPACE') {
        keys.push(key === 'SPACE' ? 'Space' : key);
      }
    }

    if (keys.length > 0) {
      setRecordingKeys(keys);
    }
  };

  // Parse shortcut string into key array for display
  const parseShortcutKeys = (shortcut: string): string[] => {
    return shortcut.split('+');
  };

  // Get current language display info
  const currentLangOption = LANGUAGE_OPTIONS.find(opt => opt.value === currentLanguage) || LANGUAGE_OPTIONS[0];

  return (
    <div className="w-full max-w-4xl mx-auto space-y-4">
      
      {/* Language Section - macOS-Style Dropdown */}
      <div className="p-5 bg-white/[0.02] border border-white/5 rounded-2xl flex items-center justify-between hover:bg-white/[0.04] transition-colors">
        <div className="flex items-center gap-4">
          <div className="p-2.5 bg-white/5 rounded-xl text-white/60">
            <Globe className="w-5 h-5" />
          </div>
          <div>
            <div className="text-sm font-medium text-white/90">
              {t('system.languageTitle') || 'Language'}
            </div>
            <div className="text-xs text-white/40 mt-0.5">
              {t('system.languageDescription') || 'Choose your preferred language'}
            </div>
          </div>
        </div>
        
        {/* Custom Dropdown - macOS Native Style */}
        <div className="relative">
          <button
            onClick={() => !isSaving && setIsLanguageDropdownOpen(!isLanguageDropdownOpen)}
            disabled={isSaving}
            className={`
              min-w-[160px] px-4 py-2 bg-black/20 border border-white/10 rounded-xl
              flex items-center justify-between gap-3
              hover:bg-black/30 transition-all
              ${isSaving ? 'opacity-50 cursor-not-allowed' : 'cursor-pointer'}
            `}
          >
            <span className="flex items-center gap-2 text-sm text-white/90">
              <span>{currentLangOption.flag}</span>
              <span>{currentLangOption.label}</span>
            </span>
            <ChevronDown className={`w-4 h-4 text-white/40 transition-transform ${isLanguageDropdownOpen ? 'rotate-180' : ''}`} />
          </button>

          {/* Dropdown Menu */}
          {isLanguageDropdownOpen && (
            <>
              {/* Backdrop to close dropdown */}
              <div 
                className="fixed inset-0 z-10" 
                onClick={() => setIsLanguageDropdownOpen(false)}
              />
              
              {/* Menu Items */}
              <div className="absolute right-0 mt-2 min-w-[160px] bg-black/80 backdrop-blur-xl border border-white/10 rounded-xl shadow-2xl overflow-hidden z-20">
                {LANGUAGE_OPTIONS.map((option) => (
                  <button
                    key={option.value}
                    onClick={() => handleLanguageChange(option.value)}
                    className={`
                      w-full px-4 py-2.5 flex items-center gap-2 text-sm
                      transition-colors
                      ${currentLanguage === option.value
                        ? 'bg-blue-600/20 text-white'
                        : 'text-white/70 hover:bg-white/5'
                      }
                    `}
                  >
                    <span>{option.flag}</span>
                    <span>{option.label}</span>
                    {currentLanguage === option.value && (
                      <span className="ml-auto text-blue-400 text-xs">✓</span>
                    )}
                  </button>
                ))}
              </div>
            </>
          )}
        </div>
      </div>

      {/* Startup Section - iOS Toggle Switch */}
      <div className="p-5 bg-white/[0.02] border border-white/5 rounded-2xl flex items-center justify-between hover:bg-white/[0.04] transition-colors">
        <div className="flex items-center gap-4">
          <div className="p-2.5 bg-white/5 rounded-xl text-white/60">
            <Rocket className="w-5 h-5" />
          </div>
          <div>
            <div className="text-sm font-medium text-white/90">
              {t('system.startupTitle') || 'Launch at Startup'}
            </div>
            <div className="text-xs text-white/40 mt-0.5">
              {t('system.startupDescription') || 'Automatically start when system boots'}
            </div>
          </div>
        </div>
        
        {/* iOS-Style Toggle Switch */}
        <label className="relative inline-flex items-center cursor-pointer">
          <input
            type="checkbox"
            className="sr-only peer"
            checked={startupEnabled}
            onChange={handleStartupToggle}
            disabled={isLoadingStartup}
          />
          <div className={`
            w-11 h-6 bg-black/40 peer-focus:outline-none rounded-full peer 
            peer-checked:after:translate-x-full peer-checked:after:border-white 
            after:content-[''] after:absolute after:top-[2px] after:left-[2px] 
            after:bg-white after:border-gray-300 after:border after:rounded-full 
            after:h-5 after:w-5 after:transition-all peer-checked:bg-blue-600 
            border border-white/10
            ${isLoadingStartup ? 'opacity-50 cursor-not-allowed' : ''}
          `}></div>
        </label>
      </div>

      {/* Global Shortcut Section - Editable Keyboard Keys */}
      <div className="p-5 bg-white/[0.02] border border-white/5 rounded-2xl flex items-center justify-between hover:bg-white/[0.04] transition-colors">
        <div className="flex items-center gap-4">
          <div className="p-2.5 bg-white/5 rounded-xl text-white/60">
            <Keyboard className="w-5 h-5" />
          </div>
          <div>
            <div className="text-sm font-medium text-white/90">
              {t('system.shortcutTitle') || 'Global Shortcut'}
            </div>
            <div className="text-xs text-white/40 mt-0.5">
              {t('system.shortcutDescription') || 'Quick access keyboard combination'}
            </div>
          </div>
        </div>
        
        {/* Shortcut Display or Editor */}
        {isEditingShortcut ? (
          <div className="flex items-center gap-2">
            {/* Recording Input */}
            <input
              type="text"
              autoFocus
              readOnly
              value={recordingKeys.join(' + ')}
              placeholder="Press keys..."
              onKeyDown={handleShortcutKeyDown}
              className="
                w-40 px-3 py-1.5 bg-blue-600/20 border border-blue-500/30 rounded-lg
                text-xs font-mono text-white text-center
                focus:outline-none focus:ring-2 focus:ring-blue-500/50
                placeholder:text-white/30
              "
            />
            
            {/* Confirm Button */}
            <button
              onClick={handleSaveShortcut}
              disabled={recordingKeys.length === 0}
              className="
                p-1.5 bg-green-600/20 border border-green-500/30 rounded-lg
                hover:bg-green-600/30 transition-colors
                disabled:opacity-40 disabled:cursor-not-allowed
              "
              title="Save"
            >
              <Check className="w-4 h-4 text-green-400" />
            </button>
            
            {/* Cancel Button */}
            <button
              onClick={handleCancelEditShortcut}
              className="
                p-1.5 bg-red-600/20 border border-red-500/30 rounded-lg
                hover:bg-red-600/30 transition-colors
              "
              title="Cancel"
            >
              <X className="w-4 h-4 text-red-400" />
            </button>
          </div>
        ) : (
          <div className="flex items-center gap-2">
            {/* Display Current Shortcut */}
            {isLoadingShortcut ? (
              <div className="px-4 py-1.5 bg-white/5 rounded-lg">
                <span className="text-xs text-white/40">Loading...</span>
              </div>
            ) : (
              <div className="flex items-center gap-1.5">
                {parseShortcutKeys(currentShortcut).map((key, index) => (
                  <React.Fragment key={index}>
                    {index > 0 && <span className="text-white/30 text-xs">+</span>}
                    <kbd className="px-2 py-1 bg-white/10 border border-white/10 border-b-[3px] rounded-md text-xs font-mono text-white/80 shadow-sm">
                      {getKeyDisplay(key)}
                    </kbd>
                  </React.Fragment>
                ))}
              </div>
            )}
            
            {/* Edit Button */}
            <button
              onClick={handleStartEditShortcut}
              disabled={isLoadingShortcut}
              className="
                p-1.5 bg-white/5 border border-white/10 rounded-lg
                hover:bg-white/10 transition-colors
                disabled:opacity-40 disabled:cursor-not-allowed
              "
              title="Edit shortcut"
            >
              <Edit2 className="w-3.5 h-3.5 text-white/60" />
            </button>
          </div>
        )}
      </div>

      {/* About Section */}
      <div className="p-5 bg-white/[0.02] border border-white/5 rounded-2xl flex items-center justify-between hover:bg-white/[0.04] transition-colors">
        <div className="flex items-center gap-4">
          <div className="p-2.5 bg-white/5 rounded-xl text-white/60">
            <Info className="w-5 h-5" />
          </div>
          <div>
            <div className="text-sm font-medium text-white/90">
              {t('system.aboutTitle') || 'About AIKeyVault'}
            </div>
            <div className="text-xs text-white/40 mt-0.5">
              {t('system.aboutDescription') || 'Version and technical information'}
            </div>
          </div>
        </div>

        {/* Right-aligned Version Info + Update Check Button */}
        <div className="flex items-center gap-4">
          <div className="text-right text-sm text-white/50 space-y-1">
            <div className="font-mono text-xs">v1.0.2</div>
            <div className="text-xs">Tauri 2.0</div>
            <div className="text-xs">AES-256-GCM</div>
          </div>

          <button
            onClick={() => setShowUpdateModal(true)}
            className="
              flex items-center gap-1.5 px-3 py-1.5
              bg-white/5 border border-white/10 rounded-lg
              text-xs text-white/50 hover:bg-white/10 hover:text-white/70 transition-colors
            "
          >
            <RefreshCw className="w-3.5 h-3.5" />
            <span>{t('system.checkUpdate') || 'Check for Updates'}</span>
          </button>
        </div>
      </div>

      {/* Subtle Footer Note */}
      <div className="pt-4 text-center">
        <p className="text-xs text-white/20">
          {t('system.footerNote') || 'Built with precision for AI developers'}
        </p>
      </div>

      {/* Update Check Modal */}
      {showUpdateModal && (
        <UpdateCheckModal onClose={() => setShowUpdateModal(false)} />
      )}
    </div>
  );
};
