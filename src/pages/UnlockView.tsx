import { useState, useRef, useEffect } from "react";
import { useTranslation } from "react-i18next";
import { invoke } from "@tauri-apps/api/core";
import { listen } from "@tauri-apps/api/event";
import { Lock, AlertCircle, Keyboard } from "lucide-react";

interface UnlockViewProps {
  onUnlock: () => void;
}

/**
 * 🔓 UnlockView - 解锁界面
 * 
 * 【Premium Redesign】
 * 视觉：极简紧凑，Raycast/1Password 风格，暗黑高级质感
 * 交互：自动聚焦，Enter 解锁，错误清空
 * 
 * 安全要求：
 * - type="password" 隐藏输入
 * - 错误时清空输入框（防止残留）
 */
export function UnlockView({ onUnlock }: UnlockViewProps) {
  const { t } = useTranslation();
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [shake, setShake] = useState(false);
  const [globalShortcut, setGlobalShortcut] = useState('');
  
  const passwordInputRef = useRef<HTMLInputElement>(null);

  // 自动聚焦 + 加载快捷键
  useEffect(() => {
    passwordInputRef.current?.focus();
    loadGlobalShortcut();
  }, []);

  // 监听快捷键更新事件
  useEffect(() => {
    const unlisten = listen<string>("vault://shortcut-updated", (event) => {
      setGlobalShortcut(event.payload);
    });

    return () => {
      unlisten.then(fn => fn());
    };
  }, []);

  // 加载全局快捷键
  const loadGlobalShortcut = async () => {
    try {
      const shortcut = await invoke<string>('get_global_shortcut');
      setGlobalShortcut(shortcut);
    } catch (err) {
      // 使用默认值
      const isMac = navigator.platform.toUpperCase().indexOf('MAC') >= 0;
      setGlobalShortcut(isMac ? 'Cmd+Shift+Space' : 'Ctrl+Shift+Space');
    }
  };

  // 提交解锁
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    setShake(false);

    if (!password) {
      return;
    }

    setIsLoading(true);

    try {
      await invoke("unlock_vault", { masterPassword: password });
      onUnlock();
    } catch (err) {
      console.error("[Unlock] Failed to unlock:", err);
      setError(t('unlock.invalid_password'));
      setPassword(""); // 清空输入框
      setShake(true);
      
      // 500ms 后重新聚焦
      setTimeout(() => {
        passwordInputRef.current?.focus();
        setShake(false);
      }, 500);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="w-full h-full flex items-center justify-center p-4">
      {/* 紧凑毛玻璃卡片 */}
      <div
        className={`
          w-[400px]
          bg-slate-950/95 backdrop-blur-2xl
          border border-white/10
          rounded-2xl
          shadow-2xl
          p-8
          transition-transform duration-200
          ${shake ? "animate-shake" : ""}
        `}
      >
        {/* 极简 Logo + 标题 */}
        <div className="flex flex-col items-center space-y-1 mb-6">
          {/* 单色锁图标 - 极简 */}
          <Lock className="w-10 h-10 text-white/80 mb-2" strokeWidth={1.5} />
          
          <h1 className="text-xl font-semibold text-white">
            {t('unlock.title')}
          </h1>
          <p className="text-sm text-white/40">
            {t('unlock.description')}
          </p>
        </div>

        {/* 表单 */}
        <form onSubmit={handleSubmit} className="space-y-3">
          {/* 密码输入 */}
          <div>
            <input
              ref={passwordInputRef}
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder={t('unlock.password_placeholder')}
              autoComplete="off"
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

          {/* 解锁按钮 */}
          <button
            type="submit"
            disabled={isLoading || !password}
            className="
              w-full h-10
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
                {t('unlock.unlocking')}
              </span>
            ) : (
              t('unlock.button')
            )}
          </button>
        </form>

        {/* 键盘提示 */}
        <div className="mt-6 space-y-2">
          {/* Enter 提示 */}
          <div className="text-center">
            <p className="text-xs text-white/30">
              {t('unlock.press_enter')}
            </p>
          </div>
          
          {/* 全局快捷键提示 */}
          {globalShortcut && (
            <div className="flex items-center justify-center gap-2 text-xs text-white/20">
              <Keyboard className="w-3 h-3" />
              <span>{t('unlock.shortcut_hint_prefix') || 'Press'}</span>
              {globalShortcut.split('+').map((key, index) => (
                <span key={index} className="flex items-center gap-1">
                  {index > 0 && <span>+</span>}
                  <kbd className="px-1.5 py-0.5 bg-white/5 border border-white/10 rounded text-[10px] font-mono">
                    {key}
                  </kbd>
                </span>
              ))}
              <span>{t('unlock.shortcut_hint_suffix') || 'to show/hide'}</span>
            </div>
          )}
        </div>
      </div>

      {/* 抖动动画 */}
      <style>{`
        @keyframes shake {
          0%, 100% { transform: translateX(0); }
          10%, 30%, 50%, 70%, 90% { transform: translateX(-4px); }
          20%, 40%, 60%, 80% { transform: translateX(4px); }
        }
        .animate-shake {
          animation: shake 0.5s ease-in-out;
        }
      `}</style>
    </div>
  );
}
