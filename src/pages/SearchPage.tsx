import { useState, useEffect } from "react";
import { useTranslation } from "react-i18next";
import { Search, Settings } from "lucide-react";
import { invoke } from "@tauri-apps/api/core";
import { listen } from "@tauri-apps/api/event";
import { useSearchKeyboard } from "../hooks/useSearchKeyboard";
import { useVault } from "../hooks/useVault";
import { useHeartbeat } from "../hooks/useHeartbeat";
import { VaultItemRow } from "../components/VaultItemRow";
import { Toast } from "../components/Toast";
import type { SearchResult } from "../types";

/**
 * 🔍 SearchPage - 核心搜索界面
 * 
 * 【Phase 4 更新】
 * - 移除 Dummy Data，接入真实 Tauri IPC
 * - 监听 vault://focus-input 事件（全局快捷键唤起时）
 * - 自动清空输入并聚焦
 * 
 * 【Phase 5.2 更新】
 * - 右下角添加 ⚙️ 图标，打开 Dashboard 窗口
 * 
 * 【v1.0 更新】
 * - 每次窗口获得焦点时自动刷新数据（解决添加密钥后不显示的问题）
 * 
 * 【视觉风格】
 * - Mac/Raycast 级别的毛玻璃质感
 * - 深度背景虚化 (backdrop-blur-2xl)
 * - 极细半透明边框
 * 
 * 【交互设计】
 * - 全键盘操作，零鼠标依赖
 * - 防抖搜索 (150ms)
 * - 平滑滚动选中项
 * 
 * 【布局结构】
 * ┌─────────────────────────────┐
 * │ 🔍  [Search Input]     ⚙️  │
 * ├─────────────────────────────┤
 * │ 📦  OpenAI Production API  │
 * │ 🧠  Claude 3.5 Sonnet      │ ← Selected
 * │ 🌐  Google Gemini Pro      │
 * └─────────────────────────────┘
 */
export function SearchPage() {
  const { t } = useTranslation();
  const { searchItems, copyToClipboard } = useVault();
  const [searchResults, setSearchResults] = useState<SearchResult[]>([]);
  const [showToast, setShowToast] = useState(false);
  const [toastMessage, setToastMessage] = useState("");
  const [globalShortcut, setGlobalShortcut] = useState('');

  // 心跳机制 - v1.0
  useHeartbeat();

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

  // 刷新数据的函数
  const refreshData = async () => {
    const results = await searchItems("");
    setSearchResults(results);
  };

  // 初始化显示所有项目
  useEffect(() => {
    refreshData();
    loadGlobalShortcut();
  }, []);

  // 监听 vault://focus-input 事件（全局快捷键触发）
  useEffect(() => {
    const unlisten = listen("vault://focus-input", async () => {
      // 刷新数据（可能在 Dashboard 中添加了新密钥）
      await refreshData();
      // 清空输入会通过 searchInputRef 在 useSearchKeyboard 中处理
      searchInputRef.current?.focus();
      searchInputRef.current?.select();
    });

    return () => {
      unlisten.then(fn => fn());
    };
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

  // 键盘导航
  const {
    selectedIndex,
    searchQuery,
    searchInputRef,
    handleSearchChange,
    setSelectedIndex,
  } = useSearchKeyboard({
    itemCount: searchResults.length,
    onSelect: async (index) => {
      const item = searchResults[index];
      if (item) {
        try {
          await copyToClipboard(item.id);
          setToastMessage(t('common.copied') || 'Copied to clipboard!');
          setShowToast(true);
        } catch (error) {
          console.error(`[SearchPage] Failed to copy:`, error);
          setToastMessage('Failed to copy');
          setShowToast(true);
        }
      } else {
        console.warn(`[SearchPage] No item at index ${index}`);
      }
    },
    onSearch: async (query) => {
      const newResults = await searchItems(query);
      setSearchResults(newResults);
    },
  });

  // 打开 Dashboard 窗口
  const handleOpenDashboard = async () => {
    try {
      await invoke("open_dashboard_window");
    } catch (err) {
      console.error("[SearchPage] Failed to open dashboard:", err);
    }
  };

  return (
    <div className="w-full h-full flex items-center justify-center p-2">
      {/* Toast Notification */}
      {showToast && (
        <Toast
          message={toastMessage}
          type="success"
          duration={2000}
          onClose={() => setShowToast(false)}
        />
      )}

      {/* 主容器：无缝黑曜石玻璃 */}
      <div
        className="
          w-full max-w-2xl
          flex flex-col
          rounded-2xl
          shadow-2xl shadow-black/60
          overflow-hidden
          relative
        "
        style={{
          background: 'rgba(10, 10, 15, 0.95)',
          backdropFilter: 'blur(60px) saturate(150%)',
          WebkitBackdropFilter: 'blur(60px) saturate(150%)',
          boxShadow: 'inset 0 1px 0 0 rgba(255, 255, 255, 0.1), 0 20px 60px rgba(0, 0, 0, 0.6)',
        }}
      >
        {/* 顶部微光边框 */}
        <div className="absolute top-0 left-0 right-0 h-px bg-gradient-to-r from-transparent via-white/20 to-transparent" />
        
        {/* 左侧边框高光 */}
        <div className="absolute top-0 left-0 bottom-0 w-px bg-gradient-to-b from-white/20 via-white/5 to-transparent" />
        
        {/* Header: 搜索栏（无边框，融入背景） */}
        <div className="flex items-center h-14 px-4 border-b border-white/10 flex-shrink-0">
          {/* 搜索图标 */}
          <Search className="w-5 h-5 text-white/40 mr-3 flex-shrink-0" />

          {/* 搜索输入 - 完全透明融入 */}
          <input
            ref={searchInputRef}
            type="text"
            value={searchQuery}
            onChange={(e) => handleSearchChange(e.target.value)}
            placeholder={t('search.placeholder')}
            autoComplete="off"
            spellCheck={false}
            className="
              flex-1 h-full
              bg-transparent
              text-lg text-white
              placeholder:text-white/30
              focus:outline-none
              border-none ring-0
            "
          />

          {/* 设置按钮 - 悬浮微光 */}
          <button
            onClick={handleOpenDashboard}
            className="
              p-2 ml-2
              text-white/50 hover:text-white
              hover:bg-white/10
              rounded-lg
              transition-colors
              flex-shrink-0
            "
            title={t('search.open_dashboard')}
          >
            <Settings className="w-5 h-5" />
          </button>
        </div>

        {/* 结果列表 - 隐藏滚动条 */}
        <div
          className="
            flex-1
            max-h-[280px]
            overflow-y-auto
          "
          style={{
            scrollbarWidth: 'none',        // Firefox
            msOverflowStyle: 'none',       // IE/Edge Legacy
            WebkitOverflowScrolling: 'touch', // iOS smooth scroll
          }}
        >
          {searchResults.length > 0 ? (
            searchResults.map((item, index) => (
              <VaultItemRow
                key={item.id}
                item={item}
                index={index}
                isSelected={index === selectedIndex}
                onClick={async () => {
                  try {
                    await copyToClipboard(item.id);
                    setToastMessage(t('common.copied') || 'Copied to clipboard!');
                    setShowToast(true);
                  } catch (error) {
                    console.error(`[SearchPage] Click copy failed:`, error);
                    setToastMessage('Failed to copy');
                    setShowToast(true);
                  }
                }}
                onHover={() => setSelectedIndex(index)}
              />
            ))
          ) : (
            <div className="px-4 py-12 text-center">
              <p className="text-white/40 text-sm">{t('search.no_results')}</p>
              <p className="text-white/25 text-xs mt-1">
                {t('search.try_different')}
              </p>
            </div>
          )}
        </div>

        {/* Footer: 快捷键提示 */}
        <div className="h-8 px-4 flex items-center justify-between border-t border-white/10 bg-black/20 flex-shrink-0 text-[10px] text-white/40">
          <span>{t('search.navigate')}</span>
          <span>{t('search.copy_hint')}</span>
          
          {/* 全局快捷键提示 */}
          {globalShortcut ? (
            <span className="flex items-center gap-1">
              {globalShortcut.split('+').map((key, index) => (
                <span key={index} className="flex items-center">
                  {index > 0 && <span className="mx-0.5">+</span>}
                  <kbd className="px-1 py-0.5 bg-white/10 border border-white/10 rounded text-[9px] font-mono text-white/50">
                    {key}
                  </kbd>
                </span>
              ))}
              <span className="ml-1">{t('search.close_hint')}</span>
            </span>
          ) : (
            <span>{t('search.close_hint')}</span>
          )}
        </div>
      </div>
    </div>
  );
}
