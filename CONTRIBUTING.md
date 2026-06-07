# 贡献指南 Contributing Guide

感谢你对 AIKeyVault 的关注！无论你是修复一个错别字、添加一个新供应商图标，还是改进加密实现——**每一份贡献都值得被珍惜**。

Thank you for your interest in AIKeyVault! Whether you fix a typo, add a new provider icon, or improve the crypto implementation — **every contribution matters**.

---

## 🎯 我可以做什么？How Can I Help?

不确定从哪里开始？这里有一些方向：

Not sure where to start? Here are some ideas:

### 🟢 新手友好 Beginner Friendly

| 领域 Area | 说明 Description |
|-----------|-----------------|
| **翻译与 i18n** / Translation & i18n | 改进现有语言翻译，或添加新语言。Improve existing translations or add a new language. Files in `src/i18n/locales/` |
| **供应商图标** / Provider Icons | 添加新的 AI 供应商 SVG 图标。Add SVG icons for new AI providers. See `src/components/icons/providers/` |
| **文档改进** / Documentation | 修正错别字、补充使用示例、录制演示。Fix typos, add usage examples, record demos |
| **CSS 样式微调** / CSS Polish | 调整间距、颜色、动画效果。Tweak spacing, colors, animations |

### 🟡 有一定经验 Some Experience

| 领域 Area | 说明 Description |
|-----------|-----------------|
| **搜索体验** / Search UX | 改进模糊搜索、搜索高亮、键盘导航。Improve fuzzy search, highlight, keyboard nav. Files: `SearchPage.tsx`, `manager.rs` |
| **导入/导出** / Import & Export | 支持更多格式（CSV、JSON）、批量导入。Support more formats, batch import. File: `src-tauri/src/import_export/kvx.rs` |
| **测试覆盖** / Testing | 为 Rust 端加密、数据库操作编写测试。Write tests for crypto and database ops |
| **组件重构** / Refactoring | 提取可复用的通用组件，减少重复。Extract reusable components, reduce duplication |

### 🔴 经验丰富 Experienced

| 领域 Area | 说明 Description |
|-----------|-----------------|
| **安全审计** / Security Audit | 审查加密实现、IPC 隔离、内存安全。Review crypto, IPC isolation, memory safety. Key files: `crypto/`, `vault/` |
| **性能优化** / Performance | 大量密钥渲染优化、数据库查询、启动速度。Large dataset rendering, query optimization, startup speed |
| **跨平台兼容** / Cross-platform | macOS/Linux 适配、打包优化。Platform-specific fixes, packaging tuning |
| **新功能** / New Features | 密码强度检测、密钥过期提醒、硬件密钥支持。Strength meter, key expiry, hardware key support |

### 🎨 非代码贡献 Non-Code Contributions

- 撰写使用教程或博客文章 / Write tutorials or blog posts
- 设计更好的应用图标或 UI 稿 / Design better icons or UI mockups
- 回答 Issues 中的用户问题 / Answer questions in Issues
- 帮助测试新版本并反馈 / Help test new releases and report feedback

---

## 🐛 报告 Bug / Bug Reports

发现 Bug？请花一分钟提交 Issue，这对项目帮助巨大。

Found a bug? Please take a minute to file an issue — it helps tremendously.

1. 检查 [Issues](https://github.com/Awfp1314/AIKeyVault/issues) 是否已有相同问题 / Check [Issues](https://github.com/Awfp1314/AIKeyVault/issues) for duplicates
2. 如果没有，创建新 Issue，尽可能包含以下信息 / If not found, create one with as much detail as you can:
   - 操作系统和版本 / OS and version
   - AIKeyVault 版本 / AIKeyVault version
   - 复现步骤 / Steps to reproduce
   - 预期行为 vs 实际行为 / Expected vs actual behavior
   - 错误日志或截图 / Error logs or screenshots

## 💡 功能建议 / Feature Requests

有新想法？欢迎分享！

Have an idea? We'd love to hear it!

1. 创建 Issue，标记为 `enhancement` / Create an Issue labeled `enhancement`
2. 描述你的想法 / Describe your idea:
   - 解决什么问题 / What problem does it solve
   - 使用场景 / Use cases
   - 可能的实现方案（如果你有想法）/ Possible approach (if you have one)

---

## 🔧 提交代码 / Code Contributions

### 第一次贡献？First Time?

1. **Fork 本仓库 / Fork this repository**
2. **克隆你的 Fork / Clone your fork**
   ```bash
   git clone https://github.com/Awfp1314/AIKeyVault.git
   cd AIKeyVault
   ```
3. **添加上游仓库 / Add upstream remote**
   ```bash
   git remote add upstream https://github.com/Awfp1314/AIKeyVault.git
   ```

### 开发环境 / Development Setup

```bash
# 安装系统依赖 / Install system dependencies

# Windows: 安装 WebView2 Runtime（Windows 11 已预装）
# Windows: Install WebView2 Runtime (pre-installed on Windows 11)
# 下载 / Download: https://developer.microsoft.com/microsoft-edge/webview2/

# macOS: 无需额外依赖 / No extra dependencies needed

# Linux (Debian/Ubuntu):
sudo apt install -y libwebkit2gtk-4.1-dev build-essential curl wget file \
  libxdo-dev libssl-dev libayatana-appindicator3-dev librsvg2-dev

# Linux (Arch):
sudo pacman -S --needed webkit2gtk-4.1 base-devel curl wget file \
  libxdo libssl openssl libayatana-appindicator librsvg

# Linux (Fedora):
sudo dnf install -y webkit2gtk4.1-devel openssl-devel curl wget file \
  libXScrnSaver libxdo-devel libappindicator-gtk3-devel librsvg2-devel

# 验证 Rust / Verify Rust
rustc --version  # 需要 >= 1.70 / Requires >= 1.70
cargo --version

# 安装项目依赖 / Install project dependencies
npm install

# 启动开发模式 / Start development
npm run tauri dev
```

### 开发流程 / Development Workflow

1. **创建分支 / Create a branch**
   ```bash
   git checkout -b feature/your-feature-name
   ```

2. **编写代码 / Write code**
   - 遵循现有代码风格 / Follow existing code style
   - 保持变更小而专注（一个 PR = 一件事）/ Keep changes small and focused (one PR = one thing)
   - 添加注释解释"为什么"而非"做什么" / Add comments explaining "why", not "what"

3. **检查你的改动 / Check your changes**
   ```bash
   npm run check         # TypeScript + Rust clippy
   npm run lint          # Rust fmt + clippy
   npm run build         # 确保前端构建通过 / Ensure frontend builds
   ```

4. **提交 / Commit**
   ```bash
   git add .
   git commit -m "feat: add amazing feature"
   ```

   遵循 [Conventional Commits](https://www.conventionalcommits.org/)：
   | Prefix | 用途 Purpose |
   |--------|-------------|
   | `feat:` | 新功能 New feature |
   | `fix:` | Bug 修复 Bug fix |
   | `docs:` | 文档更新 Documentation |
   | `style:` | 代码格式（空格、分号等）Formatting |
   | `refactor:` | 重构（不改变功能）Refactoring |
   | `perf:` | 性能优化 Performance |
   | `test:` | 测试相关 Tests |
   | `chore:` | 构建/工具 Build/tooling |
   | `i18n:` | 翻译 Translation |

5. **推送并创建 PR / Push and create PR**
   ```bash
   git push origin feature/your-feature-name
   ```
   然后在 GitHub 上创建 Pull Request。PR 描述请包含 / Then create a PR with:
   - 改了什么 / What changed
   - 为什么这样改 / Why
   - 如何测试 / How to test
   - 截图（如有 UI 改动）/ Screenshots (if UI changed)

---

## 📐 代码规范 / Code Style

### TypeScript
- 使用 `const` 和 `let`，禁用 `var` / Use `const` and `let`, no `var`
- 函数命名 camelCase，组件命名 PascalCase / camelCase for functions, PascalCase for components
- 优先使用明确的类型，避免 `any` / Prefer explicit types, avoid `any`
- 嵌套不超过 3 层 / Max 3 levels of nesting

### Rust
- 提交前运行 `cargo fmt` 和 `cargo clippy` / Run `cargo fmt` and `cargo clippy` before commit
- 变量/函数 snake_case，类型/接口 PascalCase / snake_case for vars/functions, PascalCase for types
- 使用 `Result<T, E>` 处理错误，避免 `unwrap()` / Use `Result<T, E>`, avoid `unwrap()`
- 用 `?` 或 `match` 传播错误 / Propagate errors with `?` or `match`

### 🔒 安全红线 / Security Boundaries
> **这是最重要的部分。违反以下规则将无法通过审查。**
> **This is the most important section. Violations will not pass review.**

- ❌ 禁止在前端代码中硬编码密钥、密码或盐值 / Never hardcode keys, passwords, or salts in frontend code
- ❌ 禁止在日志中输出明文密钥 / Never log plaintext secrets
- ❌ 禁止通过 IPC 向 React 前端传递明文密钥（唯一例外：`reveal_vault_item_secret`，10 秒后自动遮罩）/ Never pass plaintext secrets over IPC (sole exception: `reveal_vault_item_secret`, auto-masks after 10s)
- ✅ 所有加解密操作必须仅在 Rust 端完成 / All crypto operations must happen in Rust only
- ✅ 敏感数据使用 `secrecy` 库的 `Zeroizing` 包装 / Wrap sensitive data with `Zeroizing`
- ✅ 锁定时必须零化内存 / Zeroize memory on lock

---

## 🔍 代码审查 / Code Review

所有 PR 都会经过审查。我们关注：

All PRs go through review. We look at:

- ✅ 功能正确性 / Does it work
- 🧹 代码质量 / Is it maintainable
- 🔒 安全性 / Is it secure
- ⚡ 性能影响 / Does it affect performance
- 🔄 向后兼容 / Is it backward compatible

**审查不是你 vs. 审查者——而是一起把代码做得更好。** 别害怕提 PR，我们乐于帮助改进。

**Review is not you vs. the reviewer — it's us working together to make the code better.** Don't be afraid to submit a PR; we're happy to help improve it.

---

## 📄 许可证 / License

贡献代码即表示你同意将代码以 MIT License 授权。

By contributing, you agree to license your code under the MIT License.

## 🙏 行为准则 / Code of Conduct

- 🌍 尊重所有贡献者，无论背景和经验水平 / Respect all contributors, regardless of background or experience
- 💬 提供建设性反馈，而非批评 / Give constructive feedback, not criticism
- 🤗 包容多样性 / Embrace diversity
- 🎯 专注技术讨论 / Focus on technical discussion
- 🧑‍🏫 老手帮助新手，新手也敢于提问 / Experienced contributors help newcomers; newcomers, don't be afraid to ask

---

## 💬 需要帮助？Need Help?

- **GitHub Issues** — 技术问题和 Bug 报告 / Technical questions and bug reports
- **GitHub Discussions** — 一般讨论、想法交流 / General discussion and brainstorming
- **直接提 PR** — 即便是小到改一个标点的 PR，我们也欢迎 / Even a single-character PR is welcome

---

**感谢你的贡献。每一行代码、每一个 Issue、每一个建议——都在让 AIKeyVault 变得更好。** 🎉

**Thank you for contributing. Every line of code, every issue filed, every suggestion — makes AIKeyVault better.** 🎉
