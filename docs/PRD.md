# AIKeyVault 产品需求与架构设计文档（PRD & Architecture）V3.1 升级版

## 1. 项目定位

### 产品简介

**AIKeyVault** 是一款专为 AI 开发者、独立开发者和 AI 重度用户打造的本地优先（Local-First）API Key 管理工具。 **核心目标：**  

- 安全存储 API Key  
- 极速搜索与复制  
- 降低上下文切换成本  
- 为未来 AI 开发工作流提供基础设施  

### 产品聚焦 (V1 范围)

- AI 模型 API Key 管理  
- 本地加密存储  
- 全局快捷键唤起  
- 极速搜索  
- 一键复制  
- 导入导出  

### 核心理念

**«Launch → Search → Copy → Hide»**

  

即：**«用完即走»**

  

不追求成为通用密码管理器。 **不实现：**  

- 浏览器自动填充  
- 网站密码管理  
- 双因素认证  
- 表单自动填写 保持产品克制与专注。  

## 2. 产品目标

开发者通常同时拥有多个平台的 API Key：  

- OpenAI  
- Anthropic Claude  
- Gemini  
- DeepSeek  
- OpenRouter  
- Azure OpenAI  
- 火山方舟  
- 阿里云百炼  
- 腾讯混元  
- SiliconFlow  

**面临的问题：**

- Key 只显示一次  
- 项目之间频繁切换  
- 本地 txt/.env 不安全  
- 查找成本高  
- 容易误删或遗忘  

**AIKeyVault** 提供统一、安全、高效的解决方案。  

## 3. 技术栈

### 桌面框架

**Tauri 2.0**

  

**安全要求：** 严格限制 IPC Command 白名单。 仅允许调用显式注册的 Rust Commands。 禁止：  

- 前端直接访问文件系统  
- 前端执行 Shell  
- 任意命令执行  

### 后端

**Rust**

  

负责：

- 加解密  
- SQLite  
- 状态机  
- 全局快捷键  
- 系统托盘  
- 剪贴板管理  
- 导入导出  
- 自动锁定  

### 前端

**React 18 + TypeScript + Vite**

  

### UI 设计

**Tailwind CSS + Shadcn UI**

  

设计风格：

- 极简  
- 毛玻璃  
- Apple 风格  
- Raycast 风格  
- Spotlight 风格  

### 国际化

**react-i18next**

  

首发支持：

- zh-CN  
- en-US  

## 4. 安全架构

### 主密码

首次启动必须设置主密码。 **警告：** 遗忘主密码后数据无法恢复。系统不提供找回机制。  

### 密钥派生

采用：**Argon2id** 生成主加密密钥。 **Salt 管理：** 首次初始化生成随机 Salt。存储于 app_metadata，用于 Argon2id 派生。  

### 数据加密

采用：**AES-256-GCM**

  

提供：

- 数据机密性  
- 完整性验证  
- 防篡改能力  

### Nonce 规则

每条记录使用独立随机 Nonce。严禁固定 Nonce。 数据库保存：  

- CipherText  
- Nonce Auth Tag 直接附加在 CipherText 后。  

### 自动锁定

支持：5分钟、15分钟、30分钟、1小时、永不。  

### 内存安全（📌 V3.1 架构升级）

**进入 Locked 状态时：**

- 清除主加密密钥  
- 销毁敏感缓存 **进入 Unlocked 状态时：**  
- 重新执行 Argon2id  

**【IPC 隔离铁律】：** 明文 API Key 绝对禁止跨越 IPC 边界进入前端 React（V8 引擎）的堆内存中。前端 UI 仅传递数据的 `id` 给 Rust。

**【内存擦除机制】：** 主加密密钥在 Rust 端强制使用 `secrecy` 等敏感内存管理库，确保内存释放时立即 Zeroize（彻底清零），防范进程内存 Dump 与冷启动攻击。

### 剪贴板自动清空与隐私（📌 V3.1 架构升级）

支持：30秒、60秒、5分钟、永不。  

**【防第三方劫持机制】：** Rust 模块写入剪贴板时，除了文本数据外，必须向系统底层强行写入隐私标签。例如 macOS 的 `org.nspasteboard.TransientType` 或 `org.nspasteboard.ConcealedType`，以命令 Raycast、Maccy、Paste 等第三方历史记录工具主动抛弃此次复制记录。 部分操作系统可能保留剪贴板历史（例如：Windows Clipboard History Win+V）。**AIKeyVault** 无法主动删除系统历史记录。高安全需求用户建议关闭系统剪贴板历史。  

## 5. 数据模型

Rust

```
pub struct VaultItem {
    pub id: String, //
    pub title: String, //
    pub provider_id: String, //
    pub secret_cipher: Vec<u8>, //
    pub nonce: Vec<u8>, //
    pub tags: String, //
    pub note: Option<String>, //
    pub favorite: bool, //
    pub usage_count: i32, //
    pub last_used_at: Option<i64>, //
    pub created_at: i64, //
    pub updated_at: i64, //
}

pub struct AppSettings {
    pub language: String, //
    pub auto_lock_minutes: u32, //
    pub clipboard_clear_seconds: u32, //
    pub startup_enabled: bool, //
    pub shortcut: String, //
}
```

## 6. Provider 体系

**内置：** openai, anthropic, gemini, deepseek, openrouter, azure, siliconflow, volcengine, alibaba, tencent, custom **数据库存储：** openai, anthropic, gemini 等 ID。 **UI 显示：** OpenAI, Claude, Gemini 等本地化名称并配套 Logo。  

## 7. 数据库存储

### 引擎

**SQLite**

  

文件：vault.db 首次运行自动创建。无需额外数据库环境。  

### 加密策略

- **加密字段：** secret_cipher, nonce  
- **明文字段：** title, provider_id, tags, favorite, usage_count (保证搜索性能)  

### Schema

SQL

```
CREATE TABLE app_metadata (
    key TEXT PRIMARY KEY,
    value TEXT NOT NULL
);

CREATE TABLE vault_items (
    id TEXT PRIMARY KEY,
    title TEXT NOT NULL,
    provider_id TEXT NOT NULL,
    secret_cipher BLOB NOT NULL,
    nonce BLOB NOT NULL,
    tags TEXT,
    note TEXT,
    favorite INTEGER DEFAULT 0,
    usage_count INTEGER DEFAULT 0,
    last_used_at INTEGER,
    created_at INTEGER NOT NULL,
    updated_at INTEGER NOT NULL
);
```

### Index

SQL

```
CREATE INDEX idx_provider ON vault_items(provider_id);
CREATE INDEX idx_usage ON vault_items(usage_count DESC);
CREATE INDEX idx_last_used ON vault_items(last_used_at DESC);
```

## 8. 状态机设计

Rust

```
enum VaultState {
    FirstLaunch,
    Locked,
    Unlocked,
}
```

统一由 Rust 管理。  

## 9. 窗口架构

### Onboarding Window

首次启动显示。 **流程：** 欢迎页 ↓ 设置主密码 ↓ 快捷键设置 ↓ 开机启动设置 ↓ 完成。 **创建：** 🎉 Welcome Demo Key，并显示系统通知。  

### Unlock Window

**触发：** Locked 状态。 **UI：** 无边框，毛玻璃，居中，仅包含密码输入框。 **成功后：** 关闭自身 ↓ 打开 Search Window。  

### Quick Search Window

核心窗口。参考：Raycast / Spotlight  

- **搜索范围：** Title, Provider, Tags  
- **排序规则：** 1. 收藏状态 -> 2. 搜索匹配度 -> 3. usage_count -> 4. last_used_at  
- **交互：**
	- ↑ ↓ 导航  
	- Enter 复制  
	- ESC 关闭  
- **鼠标悬停：** 显示 📋 Copy  
- **点击：** 显示 ✓ Copied  
- **后续自动动作（📌 架构修正：全部在 Rust 内闭环处理）：** Rust 根据传入 ID 寻找密文 ↓ 解密 ↓ 注入隐私标记并写入剪贴板 ↓ usage_count +1 ↓ 更新 last_used_at ↓ 自动隐藏前端窗口 ↓ 系统通知。  
- **右下角：** ⚙ Gear 图标，点击打开 Dashboard  

### Dashboard Window

首次打开自动启动 Joyride 导览。  

- **Keys：** 新建、编辑、删除、收藏  
- **Security：** 修改主密码、自动锁定、剪贴板设置  
- **System：** 开机启动、快捷键、语言[cite: 1]
- **Data：** 导入、导出[cite: 1]
- **About：** Version、GitHub[cite: 1]

## 10. 窗口通信设计（📌 V3.1 架构升级）

Onboarding ↓ Unlock ↓ Search ↓ Dashboard[cite: 1]

- **解锁成功：** Unlock Window ↓ StateManager ↓ VaultState::Unlocked ↓ Open Search Window ↓ Close Unlock Window[cite: 1]
- **打开设置：** Search Window ↓ Click Gear ↓ Open Dashboard Window[cite: 1]
- **自动锁定：** Idle Timeout ↓ VaultState::Locked ↓ Zeroize Master Key ↓ Close Search Window ↓ Show Unlock Window[cite: 1]
- **【全局防泄漏同步广播】：** 一旦触发 `VaultState::Locked`，Rust 后端必须向前端全局派发 IPC 事件（如 `vault://lock-triggered`）。前端全局 `StateListener` 组件监听到该事件后，必须强制渲染高斯模糊遮罩或销毁所有非安全界面的 DOM（如 Dashboard 表单），确保任何时间差漏洞被绝对封死。

## 11. 导入导出

### 文件格式

.kvx[cite: 1]

### 导出

用户输入导出密码 ↓ Argon2id ↓ 生成导出密钥 ↓ 整体加密 ↓ 生成 .kvx[cite: 1]

### 文件结构

JSON

```
{
  "version": "1.0",
  "kdf": "argon2id",
  "cipher": "AES-256-GCM",
  "salt": "...",
  "nonce": "...",
  "data": "..."
}
```

### 导入

校验 version, kdf, cipher ↓ 输入密码 ↓ 解密 ↓ 导入数据库[cite: 1]

## 12. Rust 模块架构

Plaintext

```
src-tauri/src/
├── crypto/
│   ├── argon2.rs
│   ├── aes.rs
├── database/
│   ├── sqlite.rs
├── vault/
│   ├── manager.rs
│   ├── state.rs
├── clipboard/
│   ├── manager.rs
├── shortcut/
│   ├── manager.rs
├── tray/
│   ├── manager.rs
├── import_export/
│   ├── kvx.rs
├── commands/
│   ├── vault.rs
│   ├── settings.rs
└── main.rs
```

(架构树源自基础设计[cite: 1] 维持不变，内部核心逻辑参考安全加固条例)

## 13. Roadmap

### V1（MVP）

完成：Argon2id, AES-256-GCM, SQLite, 多窗口, 搜索, 收藏, 使用统计, 自动锁定, 剪贴板自动清空, 国际化, 导入导出[cite: 1]。

### V2（AI Hub）

支持：.env 导出, Shell Export, PowerShell Export, Docker Compose Env, MCP 模板生成[cite: 1]。 目标：减少对剪贴板依赖[cite: 1]。

### V3（Developer Infrastructure）

支持：aikeyvault get openai (CLI 命令)[cite: 1] 以及：CLI, MCP 集成, Local HTTP API[cite: 1]。 成为 AI 开发工作流基础设施[cite: 1]。