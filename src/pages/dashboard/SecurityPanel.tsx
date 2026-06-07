import { useState, useEffect } from "react";
import { useTranslation } from "react-i18next";
import { invoke } from "@tauri-apps/api/core";
import { Shield, Lock, Clock, Clipboard, Check, AlertCircle } from "lucide-react";

/**
 * 🛡�?SecurityPanel - 安全设置面板
 * 
 * 【Phase 5.3�?
 * 
 * 功能�?
 * 1. 自动锁定超时设置�?分钟/15分钟/30分钟/永不�?
 * 2. 剪贴板清空超时设置（30�?60�?5分钟/永不�?
 * 3. 修改主密码（未来实现�?
 * 
 * 交互流程�?
 * 1. 从后端加载当前设�?
 * 2. 用户修改下拉�?
 * 3. 立即调用 IPC 保存
 * 4. 显示保存成功提示
 */

interface AppSettings {
  auto_lock_timeout: number;
  clipboard_clear_timeout: number;
}

export function SecurityPanel() {
  const { t } = useTranslation();
  const [settings, setSettings] = useState<AppSettings | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [saveMessage, setSaveMessage] = useState<{ type: 'success' | 'error', text: string } | null>(null);

  const [showChangePasswordModal, setShowChangePasswordModal] = useState(false);
  const [showChangePasswordConfirm, setShowChangePasswordConfirm] = useState(false);
  const [oldPassword, setOldPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [newPasswordConfirm, setNewPasswordConfirm] = useState('');
  const [changePasswordLoading, setChangePasswordLoading] = useState(false);
  const [changePasswordError, setChangePasswordError] = useState('');
  const [showOldPassword, setShowOldPassword] = useState(false);
  const [showNewPassword, setShowNewPassword] = useState(false);

  // 加载当前设置
  useEffect(() => {
    loadSettings();
  }, []);

  const loadSettings = async () => {
    try {
      const currentSettings = await invoke<AppSettings>("get_app_settings");
      setSettings(currentSettings);
    } catch (error) {
      console.error("[SecurityPanel] Failed to load settings:", error);
      setSaveMessage({ type: 'error', text: t('security.load_failed') });
    } finally {
      setIsLoading(false);
    }
  };

  const handleUpdateSettings = async (updatedSettings: AppSettings) => {
    setIsSaving(true);
    setSaveMessage(null);

    try {
      await invoke("update_app_settings", { settings: updatedSettings });
      setSettings(updatedSettings);
      setSaveMessage({ type: 'success', text: t('security.saved') });
      
      // 3秒后清除提示
      setTimeout(() => setSaveMessage(null), 3000);
    } catch (error) {
      console.error("[SecurityPanel] Failed to save settings:", error);
      setSaveMessage({ type: 'error', text: `${t('security.save_failed')}: ${error}` });
    } finally {
      setIsSaving(false);
    }
  };

  const handleAutoLockChange = (value: string) => {
    if (!settings) return;
    const timeout = parseInt(value);
    handleUpdateSettings({ ...settings, auto_lock_timeout: timeout });
  };

  const handleClipboardChange = (value: string) => {
    if (!settings) return;
    const timeout = parseInt(value);
    handleUpdateSettings({ ...settings, clipboard_clear_timeout: timeout });
  };

  const handleChangePassword = async () => {
    // 清除之前的错误
    setChangePasswordError('');
    
    // 验证输入
    if (!oldPassword || !newPassword || !newPasswordConfirm) {
      setChangePasswordError(t('data.allFieldsRequired'));
      return;
    }
    if (newPassword !== newPasswordConfirm) {
      setChangePasswordError(t('data.passwordMismatch'));
      return;
    }
    if (newPassword.length < 6) {
      setChangePasswordError(t('data.passwordTooShort'));
      return;
    }
    if (oldPassword === newPassword) {
      setChangePasswordError(t('data.samePassword'));
      return;
    }

    // 显示确认步骤
    if (!showChangePasswordConfirm) {
      setShowChangePasswordConfirm(true);
      return;
    }

    try {
      setChangePasswordLoading(true);
      await invoke('change_master_password', { oldPassword, newPassword });
      
      // 关闭弹窗
      setShowChangePasswordModal(false);
      setShowChangePasswordConfirm(false);
      setOldPassword('');
      setNewPassword('');
      setNewPasswordConfirm('');
      setChangePasswordError('');
      
      // 显示成功消息
      setSaveMessage({ type: 'success', text: t('data.changePasswordSuccess') });
      setTimeout(() => setSaveMessage(null), 3000);
      
      // 3秒后刷新页面（让用户看到成功消息）
      setTimeout(() => {
        window.location.reload();
      }, 3000);
    } catch (error) {
      console.error('Change password failed:', error);
      setChangePasswordError(`${t('data.changePasswordFailed')}: ${error}`);
      setShowChangePasswordConfirm(false);
    } finally {
      setChangePasswordLoading(false);
    }
  };

  if (isLoading) {
    return (
      <div className="space-y-6">
        <div>
          <h2 className="text-2xl font-bold text-white">{t('security.title')}</h2>
          <p className="text-white/60 mt-2">{t('security.loading')}</p>
        </div>
      </div>
    );
  }

  if (!settings) {
    return (
      <div className="space-y-6">
        <div>
          <h2 className="text-2xl font-bold text-white">{t('security.title')}</h2>
          <p className="text-white/60 mt-2 text-red-400">{t('security.load_failed')}</p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h2 className="text-2xl font-bold text-white">{t('security.title')}</h2>
        <p className="text-white/60 mt-2">{t('security.description')}</p>
      </div>

      {/* 保存提示 - Fixed Height to Prevent Layout Shift */}
      <div className="h-12">
        {saveMessage && (
          <div className={`flex items-center gap-2 px-4 py-3 rounded-lg border transition-opacity ${
            saveMessage.type === 'success' 
              ? 'bg-green-500/10 border-green-500/30 text-green-400' 
              : 'bg-red-500/10 border-red-500/30 text-red-400'
          }`}>
            {saveMessage.type === 'success' ? (
              <Check className="w-5 h-5" />
            ) : (
              <AlertCircle className="w-5 h-5" />
            )}
            <span className="text-sm font-medium">{saveMessage.text}</span>
          </div>
        )}
      </div>

      {/* Settings Container - Max Width Constraint */}
      <div className="w-full max-w-4xl mx-auto space-y-4">
        {/* Auto-lock Timeout - Horizontal Layout */}
        <div className="p-5 bg-white/[0.02] border border-white/5 rounded-2xl flex items-center justify-between hover:bg-white/[0.04] transition-colors">
          <div className="flex items-center gap-4">
            <div className="p-2.5 bg-white/5 rounded-xl text-white/60">
              <Clock className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-sm font-medium text-white/90">{t('security.auto_lock_title')}</h3>
              <p className="text-xs text-white/40 mt-0.5">
                {t('security.auto_lock_description')}
              </p>
            </div>
          </div>
          
          <select
            value={settings.auto_lock_timeout.toString()}
            onChange={(e) => handleAutoLockChange(e.target.value)}
            disabled={isSaving}
            className="w-40 h-9 px-3 bg-white/5 border border-white/10 rounded-lg text-sm text-white 
              focus:outline-none focus:ring-1 focus:ring-white/20 transition-all disabled:opacity-50"
          >
            <option value="300" className="bg-gray-900 text-white">{t('security.time_5min')}</option>
            <option value="900" className="bg-gray-900 text-white">{t('security.time_15min')}</option>
            <option value="1800" className="bg-gray-900 text-white">{t('security.time_30min')}</option>
            <option value="0" className="bg-gray-900 text-white">{t('security.time_never')}</option>
          </select>
        </div>

        {/* Clipboard Clear Timeout - Horizontal Layout */}
        <div className="p-5 bg-white/[0.02] border border-white/5 rounded-2xl flex items-center justify-between hover:bg-white/[0.04] transition-colors">
          <div className="flex items-center gap-4">
            <div className="p-2.5 bg-white/5 rounded-xl text-white/60">
              <Clipboard className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-sm font-medium text-white/90">{t('security.clipboard_title')}</h3>
              <p className="text-xs text-white/40 mt-0.5">
                {t('security.clipboard_description')}
              </p>
            </div>
          </div>
          
          <select
            value={settings.clipboard_clear_timeout.toString()}
            onChange={(e) => handleClipboardChange(e.target.value)}
            disabled={isSaving}
            className="w-40 h-9 px-3 bg-white/5 border border-white/10 rounded-lg text-sm text-white 
              focus:outline-none focus:ring-1 focus:ring-white/20 transition-all disabled:opacity-50"
          >
            <option value="30" className="bg-gray-900 text-white">{t('security.time_30s')}</option>
            <option value="60" className="bg-gray-900 text-white">{t('security.time_60s')}</option>
            <option value="300" className="bg-gray-900 text-white">{t('security.time_5min')}</option>
            <option value="0" className="bg-gray-900 text-white">{t('security.time_never')}</option>
          </select>
        </div>

        {/* Master Password Change - Horizontal Layout */}
        <div className="p-5 bg-white/[0.02] border border-white/5 rounded-2xl flex items-center justify-between hover:bg-white/[0.04] transition-colors">
          <div className="flex items-center gap-4">
            <div className="p-2.5 bg-white/5 rounded-xl text-white/60">
              <Lock className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-sm font-medium text-white/90">{t('security.master_password_title')}</h3>
              <p className="text-xs text-white/40 mt-0.5">
                {t('security.master_password_description')}
              </p>
            </div>
          </div>
          
          <button
            onClick={() => setShowChangePasswordModal(true)}
            className="h-9 px-4 flex items-center justify-center text-sm font-medium bg-white/10 hover:bg-white/15 
              border border-white/10 rounded-lg text-white transition-all active:scale-95"
          >
            {t('data.changePasswordButton')}
          </button>
        </div>
      </div>

      {/* Security Notice - Refined Banner */}
      <div className="mt-8 p-5 bg-blue-500/[0.02] border border-blue-500/10 rounded-2xl">
        <div className="flex items-start gap-3">
          <Shield className="w-4 h-4 text-blue-400/80 mt-0.5" />
          <div className="flex-1">
            <p className="text-sm font-medium text-blue-400/80 mb-2">{t('security.best_practices_title')}</p>
            <ul className="space-y-1.5 text-xs text-blue-400/50 leading-relaxed">
              <li>✓ {t('security.best_practices_1')}</li>
              <li>✓ {t('security.best_practices_2')}</li>
              <li>✓ {t('security.best_practices_3')}</li>
            </ul>
          </div>
        </div>
      </div>

      {/* Change Password Modal */}
      {showChangePasswordModal && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <div className="bg-slate-800 border border-white/20 rounded-2xl shadow-2xl w-full max-w-md max-h-[90vh] flex flex-col">
            {/* Header */}
            <div className="px-6 py-4 border-b border-white/10 flex-shrink-0">
              <h3 className="text-xl font-bold text-white">{t('data.changePasswordModalTitle')}</h3>
              <p className="text-sm text-white/60 mt-1">{t('data.changePasswordDescription')}</p>
            </div>

            {/* Form */}
            <div className="flex-1 overflow-y-auto scrollbar-thin scrollbar-track-transparent scrollbar-thumb-white/10 p-6 space-y-4">
              <div>
                <label className="block text-sm font-medium text-white/80 mb-2">
                  {t('data.oldPasswordLabel')}
                </label>
                <div className="relative">
                  <input
                    type={showOldPassword ? 'text' : 'password'}
                    value={oldPassword}
                    onChange={(e) => setOldPassword(e.target.value)}
                    className="w-full px-4 py-2 bg-white/5 border border-white/10 rounded-lg 
                      text-white placeholder:text-white/30 pr-12
                      focus:outline-none focus:border-blue-500/50 transition-colors"
                    placeholder={t('data.placeholder_current_password')}
                  />
                  <button
                    type="button"
                    onClick={() => setShowOldPassword(!showOldPassword)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-white/40 hover:text-white/70 transition-colors"
                  >
                    {showOldPassword ? '🙈' : '👁️'}
                  </button>
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-white/80 mb-2">
                  {t('data.newPasswordLabel')}
                </label>
                <div className="relative">
                  <input
                    type={showNewPassword ? 'text' : 'password'}
                    value={newPassword}
                    onChange={(e) => setNewPassword(e.target.value)}
                    className="w-full px-4 py-2 bg-white/5 border border-white/10 rounded-lg 
                      text-white placeholder:text-white/30 pr-12
                      focus:outline-none focus:border-blue-500/50 transition-colors"
                    placeholder={t('data.placeholder_min_chars')}
                  />
                  <button
                    type="button"
                    onClick={() => setShowNewPassword(!showNewPassword)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-white/40 hover:text-white/70 transition-colors"
                  >
                    {showNewPassword ? '🙈' : '👁️'}
                  </button>
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-white/80 mb-2">
                  {t('data.confirmNewPasswordLabel')}
                </label>
                <input
                  type={showNewPassword ? 'text' : 'password'}
                  value={newPasswordConfirm}
                  onChange={(e) => setNewPasswordConfirm(e.target.value)}
                  className="w-full px-4 py-2 bg-white/5 border border-white/10 rounded-lg 
                    text-white placeholder:text-white/30
                    focus:outline-none focus:border-blue-500/50 transition-colors"
                  placeholder={t('data.placeholder_reenter_new')}
                />
              </div>

              <div className="bg-amber-500/10 border border-amber-500/30 rounded-lg p-4">
                <p className="text-sm text-amber-300">
                  {t('data.changePasswordWarning')}
                </p>
              </div>

              {/* 错误提示 */}
              {changePasswordError && (
                <div className="bg-red-500/10 border border-red-500/30 rounded-lg p-4 flex items-start gap-3">
                  <AlertCircle className="w-5 h-5 text-red-400 flex-shrink-0 mt-0.5" />
                  <p className="text-sm text-red-300 flex-1">{changePasswordError}</p>
                </div>
              )}

              {/* 确认提示 */}
              {showChangePasswordConfirm && !changePasswordError && (
                <div className="bg-blue-500/10 border border-blue-500/30 rounded-lg p-4">
                  <p className="text-sm text-blue-300">
                    ⚠️ {t('data.changePasswordConfirm')}
                  </p>
                </div>
              )}
            </div>

            {/* Footer */}
            <div className="px-6 py-4 border-t border-white/10 flex-shrink-0 flex gap-3 justify-end">
              <button
                onClick={() => {
                  setShowChangePasswordModal(false);
                  setShowChangePasswordConfirm(false);
                  setOldPassword('');
                  setNewPassword('');
                  setNewPasswordConfirm('');
                  setChangePasswordError('');
                }}
                className="px-4 py-2 text-white/70 hover:text-white transition-colors"
                disabled={changePasswordLoading}
              >
                {t('common.cancel')}
              </button>
              <button
                onClick={handleChangePassword}
                className={`px-6 py-2 rounded-lg text-white font-medium 
                  transition-colors disabled:opacity-50 ${
                    showChangePasswordConfirm 
                      ? 'bg-red-500 hover:bg-red-600' 
                      : 'bg-amber-500 hover:bg-amber-600'
                  }`}
                disabled={changePasswordLoading}
              >
                {changePasswordLoading 
                  ? t('data.changing') 
                  : showChangePasswordConfirm 
                    ? t('common.confirm') 
                    : t('data.changePasswordButton')}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
