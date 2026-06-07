import { useState, useRef, useEffect } from "react";
import { useTranslation } from "react-i18next";
import { invoke } from "@tauri-apps/api/core";
import { ShieldCheck, AlertCircle, AlertTriangle, Globe, ChevronDown } from "lucide-react";

interface OnboardingViewProps {
  onComplete: () => void;
}

type OnboardingStep = 'language' | 'password';

// Language options with extensibility
const LANGUAGE_OPTIONS = [
  { value: 'zh-CN', label: '简体中文', flag: '🇨🇳' },
  { value: 'en-US', label: 'English', flag: '🇺🇸' },
  { value: 'ja-JP', label: '日本語', flag: '🇯🇵' },
  { value: 'ko-KR', label: '한국어', flag: '🇰🇷' },
];

/**
 * 🎯 OnboardingView - 首次启动两步引导
 * 
 * Step 1: 语言选择（Language Selection）
 * Step 2: 设置主密码（Password Setup）
 * 
 * 【Premium Redesign】
 * 视觉：极简紧凑，与 UnlockView 统一的高级暗黑质感
 * 交互：语言选择 → 密码输入 + 确认密码 + 强度提示
 * 
 * 安全要求：
 * - 两次密码必须一致
 * - 密码长度至少 6 个字符
 * - 使用 type="password" 隐藏输入
 */
export function OnboardingView({ onComplete }: OnboardingViewProps) {
  const { t, i18n } = useTranslation();
  const [step, setStep] = useState<OnboardingStep>('language');
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [error, setError] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [selectedLanguage, setSelectedLanguage] = useState('zh-CN');
  const [isLanguageDropdownOpen, setIsLanguageDropdownOpen] = useState(false);
  
  const passwordInputRef = useRef<HTMLInputElement>(null);

  // 自动聚焦到密码输入框（仅在密码步骤）
  useEffect(() => {
    if (step === 'password') {
      passwordInputRef.current?.focus();
    }
  }, [step]);

  // 处理语言选择
  const handleSelectLanguage = async (lang: string) => {
    setSelectedLanguage(lang);
    setIsLanguageDropdownOpen(false);
  };

  // 确认语言并进入密码设置
  const handleConfirmLanguage = async () => {
    try {
      // 1. 切换 i18n 语言（立即生效）
      await i18n.changeLanguage(selectedLanguage);
      
      // 2. 读取当前设置（如果存在）
      let currentSettings = {
        auto_lock_timeout: 300,      // 默认 5 分钟
        clipboard_clear_timeout: 60, // 默认 60 秒
        language: selectedLanguage
      };
      
      try {
        // 尝试读取现有设置，如果数据库为空会使用默认值
        const settings = await invoke<{
          auto_lock_timeout: number;
          clipboard_clear_timeout: number;
          language: string;
        }>('get_app_settings');
        currentSettings = { ...settings, language: selectedLanguage };
      } catch (err) {
        // No existing settings, using defaults
      }
      
      // 3. 保存语言设置到数据库（持久化）
      await invoke('update_app_settings', { settings: currentSettings });
      
      // 4. 进入密码设置步骤
      setStep('password');
    } catch (err) {
      console.error('[Onboarding] Failed to save language:', err);
      // 即使保存失败，也允许用户继续（语言会在当前会话生效）
      setStep('password');
    }
  };

  // Get current language option
  const currentLangOption = LANGUAGE_OPTIONS.find(opt => opt.value === selectedLanguage) || LANGUAGE_OPTIONS[0];

  // 密码强度计算
  const getPasswordStrength = (pwd: string): { level: number; text: string; color: string } => {
    if (pwd.length === 0) return { level: 0, text: "", color: "" };
    if (pwd.length < 6) return { level: 1, text: t('onboarding.strength_too_short'), color: "text-red-400" };
    
    let strength = 0;
    if (pwd.length >= 12) strength++;
    if (/[a-z]/.test(pwd) && /[A-Z]/.test(pwd)) strength++;
    if (/\d/.test(pwd)) strength++;
    if (/[^a-zA-Z0-9]/.test(pwd)) strength++;

    if (strength === 0) return { level: 2, text: t('onboarding.strength_weak'), color: "text-orange-400" };
    if (strength <= 2) return { level: 3, text: t('onboarding.strength_fair'), color: "text-yellow-400" };
    if (strength === 3) return { level: 4, text: t('onboarding.strength_good'), color: "text-green-400" };
    return { level: 5, text: t('onboarding.strength_strong'), color: "text-emerald-400" };
  };

  const passwordStrength = getPasswordStrength(password);

  // 提交主密码设置
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");

    // 验证
    if (password.length < 6) {
      setError(t('onboarding.password_too_short'));
      return;
    }

    if (password !== confirmPassword) {
      setError(t('onboarding.password_mismatch'));
      return;
    }

    setIsLoading(true);

    try {
      await invoke("setup_master_password", { masterPassword: password });
      onComplete();
    } catch (err) {
      console.error("[Onboarding] Failed to set master password:", err);
      setError(String(err));
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="w-full h-full flex items-center justify-center p-4">
      {step === 'language' ? (
        // ========== STEP 1: 语言选择 (Language Selection) ==========
        <div className="w-full max-w-sm bg-slate-950/95 backdrop-blur-2xl border border-white/10 rounded-2xl shadow-2xl p-8">
          {/* Logo + 标题 */}
          <div className="flex flex-col items-center space-y-1 mb-6">
            <Globe className="w-12 h-12 text-white/80 mb-2" strokeWidth={1.5} />
            <h1 className="text-xl font-semibold text-white">
              Welcome / 欢迎
            </h1>
            <p className="text-sm text-white/40">
              {t('onboarding.language_selection_subtitle')}
            </p>
          </div>

          {/* 下拉框语言选择 */}
          <div className="space-y-4">
            <div className="relative">
              <button
                onClick={() => setIsLanguageDropdownOpen(!isLanguageDropdownOpen)}
                className="
                  w-full h-12 px-4 bg-white/5 border border-white/10 rounded-lg
                  flex items-center justify-between gap-3
                  hover:bg-white/10 transition-all
                  text-white/90 text-sm
                  focus:outline-none focus:ring-2 focus:ring-white/20
                "
              >
                <span className="flex items-center gap-2">
                  <span>{currentLangOption.flag}</span>
                  <span>{currentLangOption.label}</span>
                </span>
                <ChevronDown className={`w-4 h-4 text-white/40 transition-transform ${isLanguageDropdownOpen ? 'rotate-180' : ''}`} />
              </button>

              {/* Dropdown Menu */}
              {isLanguageDropdownOpen && (
                <>
                  {/* Backdrop */}
                  <div 
                    className="fixed inset-0 z-10" 
                    onClick={() => setIsLanguageDropdownOpen(false)}
                  />
                  
                  {/* Menu Items */}
                  <div className="absolute top-full left-0 right-0 mt-2 bg-black/80 backdrop-blur-xl border border-white/10 rounded-lg shadow-2xl overflow-hidden z-20">
                    {LANGUAGE_OPTIONS.map((option) => (
                      <button
                        key={option.value}
                        onClick={() => handleSelectLanguage(option.value)}
                        className={`
                          w-full px-4 py-3 flex items-center gap-2 text-sm
                          transition-colors
                          ${selectedLanguage === option.value
                            ? 'bg-blue-600/20 text-white'
                            : 'text-white/70 hover:bg-white/5'
                          }
                        `}
                      >
                        <span>{option.flag}</span>
                        <span>{option.label}</span>
                        {selectedLanguage === option.value && (
                          <span className="ml-auto text-blue-400 text-xs">✓</span>
                        )}
                      </button>
                    ))}
                  </div>
                </>
              )}
            </div>

            {/* 确认按钮 */}
            <button
              onClick={handleConfirmLanguage}
              className="
                w-full h-10
                bg-white text-black font-medium text-sm rounded-lg
                hover:bg-white/90
                transition-colors duration-150
                focus:outline-none focus:ring-2 focus:ring-white/30
              "
            >
              Continue / 继续
            </button>
          </div>
        </div>
      ) : (
        // ========== STEP 2: 设置密码 (Password Setup) ==========
        <div className="w-full max-w-sm bg-slate-950/95 backdrop-blur-2xl border border-white/10 rounded-2xl shadow-2xl p-8">
        
        {/* 极简 Logo + 标题 */}
        <div className="flex flex-col items-center space-y-1 mb-6">
          {/* 单色盾牌图标 - 极简 */}
          <ShieldCheck className="w-12 h-12 text-white/80 mb-2" strokeWidth={1.5} />
          
          <h1 className="text-xl font-semibold text-white">
            {t('onboarding.welcome')}
          </h1>
          <p className="text-sm text-white/40">
            {t('onboarding.description')}
          </p>
        </div>

        {/* 表单 */}
        <form onSubmit={handleSubmit} className="space-y-3">
          {/* 主密码输入 */}
          <div>
            <label className="block text-sm font-medium text-white/70 mb-1.5">
              {t('onboarding.master_password_label')}
            </label>
            <input
              ref={passwordInputRef}
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder={t('onboarding.master_password_placeholder')}
              className="
                w-full h-10 px-4
                bg-white/5 
                text-white text-sm
                placeholder:text-white/30
                border border-white/10 rounded-lg
                focus:outline-none focus:ring-2 focus:ring-white/20 focus:border-transparent
                transition-colors duration-150
              "
              disabled={isLoading}
            />

            {/* 密码强度指示器 - 紧凑版 */}
            {password && (
              <div className="mt-1.5 flex items-center gap-2">
                <div className="flex-1 h-0.5 bg-white/10 rounded-full overflow-hidden">
                  <div
                    className={`h-full transition-all duration-300 ${
                      passwordStrength.level === 1 ? "bg-red-500 w-1/5" :
                      passwordStrength.level === 2 ? "bg-orange-500 w-2/5" :
                      passwordStrength.level === 3 ? "bg-yellow-500 w-3/5" :
                      passwordStrength.level === 4 ? "bg-green-500 w-4/5" :
                      "bg-emerald-500 w-full"
                    }`}
                  />
                </div>
                <span className={`text-xs ${passwordStrength.color}`}>
                  {passwordStrength.text}
                </span>
              </div>
            )}
          </div>

          {/* 确认密码输入 */}
          <div>
            <label className="block text-sm font-medium text-white/70 mb-1.5">
              {t('onboarding.confirm_password_label')}
            </label>
            <input
              type="password"
              value={confirmPassword}
              onChange={(e) => setConfirmPassword(e.target.value)}
              placeholder={t('onboarding.confirm_password_placeholder')}
              className="
                w-full h-10 px-4
                bg-white/5 
                text-white text-sm
                placeholder:text-white/30
                border border-white/10 rounded-lg
                focus:outline-none focus:ring-2 focus:ring-white/20 focus:border-transparent
                transition-colors duration-150
              "
              disabled={isLoading}
            />
          </div>

          {/* 错误提示 */}
          {error && (
            <div className="flex items-center gap-2 p-2.5 bg-red-500/10 border border-red-500/20 rounded-lg">
              <AlertCircle className="w-4 h-4 text-red-400 flex-shrink-0" />
              <p className="text-red-400 text-xs">{error}</p>
            </div>
          )}

          {/* 提交按钮 - 纯净白色实心 */}
          <button
            type="submit"
            disabled={isLoading || !password || !confirmPassword}
            className="
              w-full h-10 mt-2
              bg-white text-black font-medium text-sm rounded-lg
              hover:bg-white/90
              disabled:opacity-40 disabled:cursor-not-allowed
              transition-colors duration-150
              focus:outline-none focus:ring-2 focus:ring-white/30
            "
          >
            {isLoading ? (
              <span className="flex items-center justify-center gap-2">
                <div className="w-3.5 h-3.5 border-2 border-black/30 border-t-black rounded-full animate-spin" />
                {t('onboarding.setting_up')}
              </span>
            ) : (
              t('onboarding.submit_button')
            )}
          </button>
        </form>

        {/* 安全提示 - 优雅的琥珀色内嵌警告 */}
        <div className="mt-6 p-3 bg-amber-500/10 border border-amber-500/20 rounded-lg flex items-start gap-2">
          <AlertTriangle className="w-3.5 h-3.5 text-amber-500/80 flex-shrink-0 mt-0.5" strokeWidth={2} />
          <p className="text-xs text-amber-500/80 leading-relaxed">
            {t('onboarding.notice')}
          </p>
        </div>
        </div>
      )}
    </div>
  );
}
