import { invoke } from "@tauri-apps/api/core";
import type { VaultItemMeta, SearchResult } from "../types";

/**
 * 🗄�?useVault Hook
 * 
 * v1.0 真实 IPC 接入 - Dummy Data 已拔�?
 * 
 * 【功能�?
 * - 通过 Tauri IPC �?Rust 后端通信
 * - 搜索 VaultItems（invoke("search_vault_items")�?
 * - 复制到剪贴板（invoke("copy_vault_item_to_clipboard")�?
 * - 所有操作都经过加密层，前端永远看不到明�?API Key
 */

export function useVault() {
  /**
   * 🔍 搜索 VaultItems
   * 
   * 【Phase 4 实现�?
   * 调用 Rust 后端�?search_vault_items 命令
   * 
   * 参数�?
   * - query: 搜索关键词（空字符串返回全部�?
   * 
   * 返回：安全的元数据列表（不包含密文）
   */
  const searchItems = async (query: string): Promise<SearchResult[]> => {
    try {
      const items = await invoke<VaultItemMeta[]>("search_vault_items", { query });
      
      // 转换�?SearchResult（添�?matchScore�?
      // Rust 后端已经完成排序，前端只需添加占位 score
      return items.map(item => ({
        ...item,
        matchScore: 1, // Rust 后端已排序，前端不需要重新计�?
      }));
    } catch (error) {
      console.error("[useVault] Search failed:", error);
      return [];
    }
  };

  /**
   * 📋 复制到剪贴板
   * 
   * 【Phase 4 实现 - 安全闭环�?
   * 调用 Rust 后端�?copy_vault_item_to_clipboard 命令
   * 
   * 流程�?
   * 1. Rust 后端解密 API Key
   * 2. 写入系统剪贴板（带隐私标记）
   * 3. 启动 60s 自动清空计时�?
   * 4. 更新使用统计（usage_count + 1�?
   * 5. 自动隐藏窗口
   * 
   * 【IPC 隔离铁律】：
   * - 前端仅传�?item_id
   * - 明文 API Key 永远不离开 Rust �?
   */
  const copyToClipboard = async (itemId: string): Promise<void> => {
    try {
      await invoke("copy_vault_item_to_clipboard", { itemId });
    } catch (error) {
      console.error("[useVault] Copy failed:", error);
      throw error;
    }
  };

  /**
   * 🔒 锁定 Vault
   * 
   * 【Phase 4 实现�?
   * 调用 Rust 后端�?lock_vault 命令
   */
  const lockVault = async (): Promise<void> => {
    try {
      await invoke("lock_vault");
    } catch (error) {
      console.error("[useVault] Lock failed:", error);
      throw error;
    }
  };

  /**
   * 📊 获取 Vault 状�?
   * 
   * 【Phase 4 实现�?
   */
  const getVaultState = async (): Promise<string> => {
    try {
      return await invoke<string>("get_vault_state");
    } catch (error) {
      console.error("[useVault] Get state failed:", error);
      return "Locked";
    }
  };

  return {
    searchItems,
    copyToClipboard,
    lockVault,
    getVaultState,
  };
}
