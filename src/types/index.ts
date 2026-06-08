/**
 * 🔐 AIKeyVault 核心类型定义
 * v1.0 Frontend Type System (匹配 Rust 后端)
 */

/** AI Provider 枚举 */
export type AIProvider = 
  | "OpenAI"
  | "Anthropic"
  | "Google"
  | "Azure"
  | "Cohere"
  | "Huggingface"
  | "Replicate"
  | "Custom";

/** Vault Item 元数据（前端安全视图�?*/
export interface VaultItemMeta {
  id: string;
  title: string;
  provider_id: string; // 注意：Rust 后端使用 provider_id，不�?provider
  tags: string; // 注意：Rust 后端是逗号分隔的字符串，不是数�?
  note: string | null;
  favorite: boolean;
  usage_count: number;
  last_used_at: number | null;
  created_at: number;
  updated_at: number;
}

/** 搜索匹配结果 */
export interface SearchResult extends VaultItemMeta {
  matchScore: number; // 搜索相关度评�?
}

/** Vault 状态枚�?*/
export enum VaultState {
  FirstLaunch = "FirstLaunch",
  Locked = "Locked",
  Unlocked = "Unlocked",
}

/** 全局应用状�?*/
export interface AppState {
  vaultState: VaultState;
  isInitialized: boolean;
  lastActivity: number;
}

/** 更新检查结果 */
export interface UpdateInfo {
  has_update: boolean;
  current_version: string;
  latest_version: string;
  release_url: string;
  release_notes: string;
}

