# AIKeyVault

<div align="center">

[![License](https://img.shields.io/badge/license-MIT-blue.svg)](./LICENSE)
[![Platform](https://img.shields.io/badge/platform-Windows%20%7C%20macOS%20%7C%20Linux-lightgrey)]()
[![Tauri](https://img.shields.io/badge/built%20with-Tauri-24C8D8?logo=tauri)](https://tauri.app/)
[![Rust](https://img.shields.io/badge/rust-1.70%2B-orange?logo=rust)](https://www.rust-lang.org/)
[![Release](https://img.shields.io/badge/release-v1.0-6C63FF)](https://github.com/Awfp1314/AIKeyVault/releases)

**本地优先、安全至上的 AI API 密钥管理工具**

[特性](#特性) • [截图](#截图) • [安装](#安装) • [使用指南](#使用指南) • [安全设计](#安全设计) • [开发](#开发)

*English version: [README.md](./README.md)*

</div>

---

> 🔒 **100% 本地运行，零网络请求。** AIKeyVault 绝不联网——无遥测、无统计、无云同步。**你的数据永不离开你的设备。** 信任源于透明：每一行加密代码完全开源，任何人可审计。

AIKeyVault 为 AI 开发者提供 Raycast 风格的快速启动器，加密管理所有 API 密钥。

## 特性

- **AES-256-GCM 加密** — 每条密钥独立随机 nonce 加密，主密码绝不以明文驻留内存。
- **Argon2id 密钥派生** — 16 MiB 内存硬哈希，暴力破解不可行。
- **类 Raycast 启动器** — 全局快捷键（`Ctrl+Shift+Space`）唤起毛玻璃透明搜索窗口，输入即搜，回车即复制。
- **模糊搜索** — 跨标题、供应商、标签智能匹配，纯键盘操作：`↑↓` 导航，`Enter` 复制。
- **自动锁定与内存安全** — 闲置超时自动锁定，主密钥立即从内存中零化擦除。剪贴板定时自动清空。
- **暗色模式 + 多语言** — 暗色优先的玻璃拟态 UI，支持简体中文、English、日本語、한국어。
- **加密备份** — 导出为 `.kvx` 文件（AES-256-GCM 加密），可安全存储或跨设备迁移。
- **系统托盘驻留** — 最小化到托盘后台运行，右键菜单快速操作。

## 截图

| 搜索启动器 | 密钥管理面板 |
|:--:|:--:|
| ![搜索启动器](./docs/screenshots/01-search-launcher.png) | ![密钥管理面板](./docs/screenshots/02-keys-panel.png) |

| 安全设置 | 解锁界面 |
|:--:|:--:|
| ![安全设置](./docs/screenshots/03-security-panel.png) | ![解锁界面](./docs/screenshots/04-unlock-screen.png) |

| 首次设置密码 | 首次启动引导 |
|:--:|:--:|
| ![首次设置密码](./docs/screenshots/05-password-setup.png) | ![首次启动引导](./docs/screenshots/06-onboarding.png) |

## 安装

### 下载安装（推荐）

> 预构建安装包将在 [Releases](https://github.com/Awfp1314/AIKeyVault/releases) 页面发布。

| 平台 | 安装包格式 |
|------|-----------|
| Windows | `.msi` / `.exe` |
| macOS | `.dmg` |
| Linux | `.deb` / `.AppImage` |

### 从源码构建

**环境要求：**
- [Rust](https://www.rust-lang.org/tools/install) >= 1.70
- [Node.js](https://nodejs.org/) >= 18
- **Windows**：[WebView2 Runtime](https://developer.microsoft.com/microsoft-edge/webview2/)（Windows 11 已预装）
- **Linux**：`libwebkit2gtk-4.1-dev` 及系统库（详见 [CONTRIBUTING.md](./CONTRIBUTING.md)）
- **macOS**：无需额外依赖

```bash
# 克隆并安装依赖
git clone https://github.com/Awfp1314/AIKeyVault.git
cd AIKeyVault
npm install

# 开发模式（Rust + React 热重载）
npm run tauri dev

# 生产构建
npm run tauri build
# 产物位于 src-tauri/target/release/bundle/
```

## 使用指南

### 首次启动

1. 选择界面语言
2. 设置主密码（6 位以上，推荐强密码）
3. 保险库就绪 — 开始添加 API 密钥

### 日常操作

| 操作 | 快捷键 / 路径 |
|------|-------------|
| 唤起搜索 | `Ctrl+Shift+Space`（可自定义） |
| 搜索密钥 | 输入标题 / 供应商 / 标签 |
| 复制选中密钥 | `Enter` |
| 打开管理面板 | 搜索窗口齿轮图标，或托盘菜单 |
| 锁定保险库 | 托盘菜单 → Lock Vault，或自动锁定超时 |
| 导出 / 导入 | 管理面板 → Keys 面板 |

### 添加 API 密钥

1. 打开管理面板（`Ctrl+Shift+Space` → 齿轮图标）
2. 进入 **Keys** 面板
3. 点击 **Add Key**
4. 填写：标题、供应商、API Key、标签（可选）
5. 保存 — 密钥即时加密并存入本地数据库

### 备份与还原

将加密的保险库导出为 `.kvx` 文件，安全存放（U 盘、私有云等），在任何设备上使用导出密码即可导入还原。

## 支持的供应商

OpenAI · Anthropic (Claude) · Google (Gemini) · DeepSeek · OpenRouter ·
Azure OpenAI · SiliconFlow · 火山方舟 · 阿里百炼 · 腾讯混元 ·
**Custom**（任意 API 密钥服务）

## 安全设计

### 加密流程

```
主密码
       │
       ▼  Argon2id（16 MiB, 2 iter, 4 parallel）
256-bit 主密钥
       │
       ▼  AES-256-GCM（每条记录独立 96-bit 随机 nonce）
密文 → SQLite BLOB 存储
```

### 设计原则

- **IPC 隔离** — React 前端仅接收条目 ID 和安全元数据（`VaultItemMeta`）。所有加解密操作在 Rust 后端完成，明文绝不跨越 IPC 边界（唯一例外：`reveal` 命令 10 秒后自动遮罩）。
- **内存加固** — 主密钥包装于 `Zeroizing<Vec<u8>>`。锁定时在释放前强制零化，杜绝交换分区泄漏。
- **剪贴板保护** — macOS 注入隐私标记，可配置自动清空时长（30s / 60s / 5min / 永不）。
- **独立 Nonce** — 每条保险库记录使用独立的 96-bit 随机 nonce，彻底杜绝 nonce 重用风险。
- **零网络请求** — AIKeyVault 不发起任何网络连接，无遥测、无崩溃上报、无更新检测回传。

### AIKeyVault 不是

- **不是云服务** — 数据永不离开你的设备。
- **不是密码管理器** — 不会跨设备同步、不会填充浏览器表单、不会存储非 AI 服务的凭据。
- **不是命令行工具** — 它是为视觉反馈和操作速度设计的桌面 GUI 应用。

## 开发

```bash
npm run dev           # 前端 Vite 开发服务器（端口 1420）
npm run build         # TypeScript 类型检查 + Vite 生产构建
npm run tauri dev     # 完整 Tauri 开发（Rust + React 热重载）
npm run tauri build   # 生产安装包构建
npm run check         # 全量检查：tsc + cargo clippy
npm run lint          # Rust 格式化与 lint 检查
```

详见 [CONTRIBUTING.md](./CONTRIBUTING.md) 了解开发流程、代码规范与系统依赖详情。

## 项目结构

```
AIKeyVault/
├── src/                         # React 18 + TypeScript 前端
│   ├── components/              # 可复用 UI 组件
│   │   ├── GlobalStateListener.tsx   # 跨窗口锁定事件同步
│   │   ├── ProviderIcon.tsx          # AI 供应商图标组件
│   │   └── VaultItemRow.tsx          # 密钥行组件（遮罩/明文切换）
│   ├── pages/                   # 页面组件
│   │   ├── OnboardingView.tsx        # 首次启动主密码设置
│   │   ├── UnlockView.tsx            # 锁定 / 解锁界面
│   │   ├── SearchPage.tsx            # 主搜索启动器窗口
│   │   ├── DashboardPage.tsx         # 设置与密钥管理窗口
│   │   └── dashboard/                # Dashboard 子面板
│   ├── hooks/                   # 自定义 React Hooks
│   │   ├── useVault.ts               # Vault IPC 封装
│   │   ├── useHeartbeat.ts           # 用户活动心跳节流
│   │   └── useSearchKeyboard.ts      # 搜索结果键盘导航
│   └── i18n/locales/            # 语言包
│       ├── en-US.json
│       ├── zh-CN.json
│       ├── ja-JP.json
│       └── ko-KR.json
│
├── src-tauri/src/               # Rust 后端
│   ├── crypto/                  # 加密层
│   │   ├── argon2.rs                # Argon2id：盐生成、密钥派生、验证
│   │   └── aes.rs                   # AES-256-GCM：独立 nonce 加解密
│   ├── vault/                   # 保险库核心逻辑
│   │   ├── state.rs                 # 状态机（首次启动 → 解锁 ⇄ 锁定）
│   │   └── manager.rs               # VaultItem CRUD、搜索、剪贴板复制
│   ├── database/sqlite.rs       # SQLite 操作（app_metadata + vault_items）
│   ├── clipboard/manager.rs     # 剪贴板写入（自动清空 + 隐私标记）
│   ├── shortcut/manager.rs      # 全局快捷键注册 / 修改 / 注销
│   ├── tray/manager.rs          # 系统托盘菜单（显示 / 锁定 / 退出）
│   ├── import_export/kvx.rs     # .kvx 加密备份格式
│   └── commands/                # Tauri IPC 命令处理
│       ├── vault.rs                 # 保险库生命周期 + 条目 CRUD
│       └── settings.rs              # 设置、心跳、窗口管理
│
├── docs/PRD.md                  # 产品需求文档
├── design/app-icon.png          # 图标源素材
├── CONTRIBUTING.md              # 贡献指南
├── AGENTS.md                    # AI 编码助手架构说明
└── CLAUDE.md                    # Claude Code 项目指令
```

## 许可证

MIT — 详见 [LICENSE](./LICENSE)。

## 致谢

基于 [Tauri 2.0](https://tauri.app/)、[React](https://react.dev/)、[Rust](https://www.rust-lang.org/) 和 [Tailwind CSS](https://tailwindcss.com/) 构建。
