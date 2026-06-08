import { useState, useEffect, useRef } from "react";
import { useTranslation } from "react-i18next";
import { invoke } from "@tauri-apps/api/core";
import { Key, Shield, Settings as SettingsIcon } from "lucide-react";
import { useHeartbeat } from "../hooks/useHeartbeat";
import { VaultState, UpdateInfo } from "../types";
import { SecurityPanel } from "./dashboard/SecurityPanel";
import { KeysPanel } from "./dashboard/KeysPanel";
import { SystemPanel } from "./dashboard/SystemPanel";
import { UpdateCheckModal } from "../components/UpdateCheckModal";

/**
 * 🎛️ DashboardPage - Control Center
 * 
 * v1.0
 * 900x600 window, left-right layout
 * 
 * Security lock mechanism:
 * When vault://lock-triggered is received:
 * 1. Immediately unmount all sub-components containing sensitive data
 * 2. Replace with blank skeleton screen
 * 3. Render UnlockView at top level
 * 4. Ensure no plaintext data remains in DOM tree
 * 
 * Layout structure:
 * ┌──────────┬──────────────────────────┐
 * │ Keys     │                          │
 * │ Security │  Content Area            │
 * │ System   │                          │
 * │ Data     │                          │
 * └──────────┴──────────────────────────┘
 */

interface DashboardPageProps {
  vaultState: VaultState | null;
}

type MenuItem = "keys" | "security" | "system";

export function DashboardPage({ vaultState: initialVaultState }: DashboardPageProps) {
  const { t } = useTranslation();
  const [selectedMenu, setSelectedMenu] = useState<MenuItem>("keys");
  const [contentReady, setContentReady] = useState(false);
  const [updateModalOpen, setUpdateModalOpen] = useState(false);
  const autoCheckDone = useRef(false);

  // 心跳机制 - v1.0
  useHeartbeat();

  // 通知后端窗口已准备就绪（React 已挂载，可以安全显示窗口）
  useEffect(() => {
    const notifyReady = async () => {
      try {
        await invoke("window_ready");
        // Delay marking content ready to allow initial render to complete
        setTimeout(() => {
          setContentReady(true);
        }, 100);
      } catch (err) {
        console.error("[DashboardPage] Failed to notify window ready:", err);
        // Fallback: show content anyway after delay
        setTimeout(() => {
          setContentReady(true);
        }, 300);
      }
    };
    
    notifyReady();
  }, []);

  // Auto-check for updates silently when dashboard opens (once per session)
  useEffect(() => {
    if (!contentReady || autoCheckDone.current) return;
    autoCheckDone.current = true;

    const autoCheck = async () => {
      try {
        const info = await invoke<UpdateInfo>('check_for_update');
        if (info.has_update) {
          setUpdateModalOpen(true);
        }
      } catch (err) {
        // Silently ignore - user can manually check from System panel
        console.log('[DashboardPage] Auto-update check skipped:', err);
      }
    };

    // Small delay to let the dashboard finish rendering first
    const timer = setTimeout(autoCheck, 2000);
    return () => clearTimeout(timer);
  }, [contentReady]);

  // 🔥 关键修复：直接使用 prop 传递的 vaultState，不维护本地副本
  // App.tsx 通过 GlobalStateListener 已经统一管理了状态
  const vaultState = initialVaultState;

  // Show loading state when not initialized
  if (vaultState === null) {
    return (
      <div className="w-screen h-screen bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900 flex items-center justify-center">
        <div className="animate-pulse text-white/40">{t('dashboard.loading')}</div>
      </div>
    );
  }

  // 已解锁，显示 Dashboard 内容
  return (
    <div className="w-screen h-screen bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900 flex overflow-hidden">
      {!contentReady && (
        <div className="absolute inset-0 z-50 bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900 flex items-center justify-center">
          <div className="w-6 h-6 border-2 border-white/10 border-t-white/40 rounded-full animate-spin" />
        </div>
      )}
      {/* 左侧边栏 */}
      <aside className="w-56 bg-black/20 border-r border-white/10 flex flex-col">
        {/* Logo */}
        <div className="px-6 py-6 border-b border-white/10">
          <h1 className="text-xl font-bold text-white">AIKeyVault</h1>
          <p className="text-xs text-white/50 mt-1">{t('dashboard.control_center')}</p>
        </div>

        {/* 菜单 */}
        <nav className="flex-1 px-3 py-4 space-y-1">
          <MenuItem
            icon={Key}
            label={t('dashboard.keys')}
            active={selectedMenu === "keys"}
            onClick={() => setSelectedMenu("keys")}
          />
          <MenuItem
            icon={Shield}
            label={t('dashboard.security')}
            active={selectedMenu === "security"}
            onClick={() => setSelectedMenu("security")}
          />
          <MenuItem
            icon={SettingsIcon}
            label={t('dashboard.system')}
            active={selectedMenu === "system"}
            onClick={() => setSelectedMenu("system")}
          />
        </nav>

        {/* 版本信息 */}
        <div className="px-6 py-4 border-t border-white/10">
          <p className="text-xs text-white/30">v1.0</p>
        </div>
      </aside>

      {/* 右侧内容区 */}
      <main 
        className="flex-1 overflow-auto scrollbar-thin scrollbar-track-transparent scrollbar-thumb-white/10 hover:scrollbar-thumb-white/20"
        style={{
          scrollbarWidth: "thin",
          scrollbarColor: "rgba(255,255,255,0.1) transparent",
        }}
      >
        <div className="p-8">
          {selectedMenu === "keys" && <KeysContent onReady={() => setContentReady(true)} />}
          {selectedMenu === "security" && <SecurityContent />}
          {selectedMenu === "system" && <SystemContent />}
        </div>
      </main>

      {/* Auto-check Update Modal */}
      {updateModalOpen && (
        <UpdateCheckModal onClose={() => setUpdateModalOpen(false)} />
      )}
    </div>
  );
}

// 菜单项组件
interface MenuItemProps {
  icon: React.ElementType;
  label: string;
  active: boolean;
  onClick: () => void;
}

function MenuItem({ icon: Icon, label, active, onClick }: MenuItemProps) {
  return (
    <button
      onClick={onClick}
      className={`
        w-full flex items-center gap-3 px-4 py-2.5 rounded-lg
        transition-all duration-200
        ${active 
          ? "bg-white/10 text-white shadow-lg shadow-blue-500/20" 
          : "text-white/60 hover:text-white hover:bg-white/5"
        }
      `}
    >
      <Icon className="w-5 h-5" />
      <span className="text-sm font-medium">{label}</span>
    </button>
  );
}

// Keys content area (v1.0 - real implementation)
function KeysContent({ onReady }: { onReady?: () => void }) {
  return <KeysPanel onReady={onReady} />;
}

// Security content area (v1.0 - real implementation)
function SecurityContent() {
  return <SecurityPanel />;
}

// System content area (v1.0 - language setting implementation)
function SystemContent() {
  return <SystemPanel />;
}
