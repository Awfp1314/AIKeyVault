import { useState, useEffect } from "react";
import { useTranslation } from "react-i18next";
import { invoke } from "@tauri-apps/api/core";
import { listen } from "@tauri-apps/api/event";
import { getCurrentWindow } from "@tauri-apps/api/window";
import { GlobalStateListener } from "./components/GlobalStateListener";
import { SearchPage } from "./pages/SearchPage";
import { OnboardingView } from "./pages/OnboardingView";
import { UnlockView } from "./pages/UnlockView";
import { DashboardPage } from "./pages/DashboardPage";
import { VaultState } from "./types";

/**
 * 🚀 AIKeyVault - Main Application
 * 
 * v1.0 真实鉴权流与门面切换
 * v1.0 多窗口架�?
 * 
 * 【窗口路由�?
 * main -> 状态机路由（FirstLaunch/Locked/Unlocked -> SearchPage�?
 * dashboard -> DashboardPage
 * 
 * 【状态机设计�?
 * FirstLaunch -> OnboardingView (设置主密�?
 * Locked -> UnlockView (输入密码解锁)
 * Unlocked -> SearchPage (核心搜索界面)
 * 
 * 【防闪烁策略�?
 * 1. 初始状态为 null，避免渲染错误视�?
 * 2. 挂载时立即拉取真实状�?
 * 3. 使用 opacity 渐变过渡
 */
function App() {
  const { t, i18n } = useTranslation();
  const [vaultState, setVaultState] = useState<VaultState | null>(null);
  const [isInitialized, setIsInitialized] = useState(false);
  const [windowLabel, setWindowLabel] = useState<string>("");

  // 获取当前窗口标识
  useEffect(() => {
    const currentWindow = getCurrentWindow();
    setWindowLabel(currentWindow.label);
    console.log("[App] Current window label:", currentWindow.label);
  }, []);

  // 初始化语言设置
  useEffect(() => {
    const loadLanguage = async () => {
      try {
        const settings = await invoke<{
          auto_lock_timeout: number;
          clipboard_clear_timeout: number;
          language: string;
        }>('get_app_settings');
        
        if (settings.language && settings.language !== i18n.language) {
          await i18n.changeLanguage(settings.language);
          console.log("[App] Language loaded from backend:", settings.language);
        }
      } catch (err) {
        console.error("[App] Failed to load language:", err);
        // Use default language if loading fails
      }
    };

    loadLanguage();
  }, [i18n]);

  // 挂载时获取初始状态
  useEffect(() => {
    const initializeState = async () => {
      try {
        const stateStr = await invoke<string>("get_initial_state");
        console.log("[App] Initial state:", stateStr);
        setVaultState(stateStr as VaultState);
        setIsInitialized(true);
      } catch (err) {
        console.error("[App] Failed to get initial state:", err);
      }
    };

    initializeState();
  }, []);

  // 监听解锁事件
  useEffect(() => {
    const unlisten = listen("vault://unlocked", () => {
      console.log("[App] Vault unlocked event received");
      setVaultState(VaultState.Unlocked);
    });

    return () => {
      unlisten.then(fn => fn());
    };
  }, []);

  // 监听锁定事件
  useEffect(() => {
    const unlisten = listen("vault://lock-triggered", () => {
      console.log("[App] Vault locked event received");
      setVaultState(VaultState.Locked);
    });

    return () => {
      unlisten.then(fn => fn());
    };
  }, []);

  // 监听语言变更事件（跨窗口同步）
  useEffect(() => {
    const unlisten = listen<string>("vault://language-changed", (event) => {
      const lang = event.payload;
      console.log("[App] Language change event received:", lang);
      if (lang && lang !== i18n.language) {
        i18n.changeLanguage(lang);
      }
    });

    return () => {
      unlisten.then(fn => fn());
    };
  }, [i18n]);

  // 防闪烁：未初始化时显示加载状�?
  if (!isInitialized || vaultState === null) {
    return (
      <div className="w-screen h-screen bg-transparent flex items-center justify-center overflow-hidden">
        <div className="animate-pulse text-white/40">{t('common.loading')}</div>
      </div>
    );
  }

  // Onboarding 完成后的回调
  const handleOnboardingComplete = () => {
    console.log("[App] Onboarding complete");
    setVaultState(VaultState.Unlocked);
  };

  // Unlock 完成后的回调
  const handleUnlockComplete = () => {
    console.log("[App] Unlock complete");
    setVaultState(VaultState.Unlocked);
  };

  // 动态背景：main 窗口透明透视桌面，dashboard 窗口深色渐变
  const isDashboard = windowLabel === "dashboard";
  const lockedBgClass = isDashboard
    ? "bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900"
    : "bg-transparent";

  // 🔒 锁定状态：所有窗口统一显示解锁界面（在窗口路由之前拦截）
  if (vaultState === VaultState.Locked) {
    return (
      <>
        <GlobalStateListener onStateChange={setVaultState} />
        <div className={`w-screen h-screen flex items-center justify-center overflow-hidden ${lockedBgClass}`}>
          <UnlockView onUnlock={handleUnlockComplete} />
        </div>
      </>
    );
  }

  // 🔑 首次启动：main 窗口显示引导，dashboard 窗口显示解锁界面
  if (vaultState === VaultState.FirstLaunch) {
    if (windowLabel === "dashboard") {
      return (
        <>
          <GlobalStateListener onStateChange={setVaultState} />
          <div className={`w-screen h-screen flex items-center justify-center overflow-hidden ${lockedBgClass}`}>
            <UnlockView onUnlock={handleUnlockComplete} />
          </div>
        </>
      );
    }
    return (
      <>
        <GlobalStateListener onStateChange={setVaultState} />
        <div className="w-screen h-screen bg-transparent flex items-center justify-center overflow-hidden transition-opacity duration-300"
          style={{ opacity: isInitialized ? 1 : 0 }}
        >
          <OnboardingView onComplete={handleOnboardingComplete} />
        </div>
      </>
    );
  }

  // ✅ 已解锁：窗口分发路由
  if (windowLabel === "dashboard") {
    console.log("[App] Rendering dashboard window (unlocked)");
    return (
      <>
        <GlobalStateListener onStateChange={setVaultState} />
        <DashboardPage vaultState={vaultState} />
      </>
    );
  }

  // main 窗口已解锁 -> SearchPage
  return (
    <>
      <GlobalStateListener onStateChange={setVaultState} />
      <div 
        className="w-screen h-screen bg-transparent flex items-center justify-center overflow-hidden transition-opacity duration-300"
        style={{ opacity: isInitialized ? 1 : 0 }}
      >
        <SearchPage />
      </div>
    </>
  );
}

export default App;
