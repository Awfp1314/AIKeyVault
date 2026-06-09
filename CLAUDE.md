# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Build & Dev Commands

```bash
npm run tauri dev      # Full dev: Rust backend + React frontend with HMR
npm run tauri build    # Production build (Windows/macOS/Linux)
npm run build          # Frontend-only: tsc typecheck + vite build
npm run dev            # Frontend-only: Vite dev server (port 1420, strictPort)
npm run check          # TypeScript check + Rust clippy
npm run lint           # Rust clippy + cargo fmt --check
npm run reset-vault    # Local dev helper to reset vault data
```

Rust checks (run from `src-tauri/`):
```bash
cargo build            # Compile check
cargo clippy           # Lint
cargo fmt --check      # Format check
cargo test             # Run Rust tests if tests are added
cargo test <name>      # Run one Rust test by name if present
```

There is no JS/TS test runner or JS/TS formatter configured. No first-party test files are currently present. TypeScript `strict: true` with `noUnusedLocals` and `noUnusedParameters` is enforced by `npm run build`/`npm run check` via `tsc`.

## Architecture

Tauri 2.0 desktop app with **two windows**:
- `main`: startup window from `src-tauri/tauri.conf.json`; transparent frameless search window (800×600, no OS decorations) — `bg-transparent` is REQUIRED
- `dashboard`: created/focused on demand by Rust window-management commands; normal framed settings window (1200×700, with OS chrome)

**React 18 + TypeScript** frontend (`src/`), **Rust** backend (`src-tauri/src/`).

### State Machine (Rust `StateManager`)

```
FirstLaunch → (setup_master_password) → Unlocked
Unlocked   → (lock_vault / auto-lock) → Locked  (master key zeroized)
Locked     → (unlock_vault)            → Unlocked (key re-derived)
```

Tauri events broadcast to ALL windows: `vault://unlocked`, `vault://lock-triggered`, plus UI sync events such as `vault://language-changed` and `vault://shortcut-updated`.
`App.tsx` routes by `window.label` + `vaultState`:
- `main`: FirstLaunch→OnboardingView, Locked→UnlockView, Unlocked→SearchPage
- `dashboard`: FirstLaunch/Locked→UnlockView, Unlocked→DashboardPage

**`src/store/` exists but is empty** — all state management is through `App.tsx` local state + Tauri IPC events, not Zustand/Redux.

### IPC Isolation (CRITICAL)

**NEVER pass plaintext API Keys over IPC to the frontend.** This is an iron rule.
- Frontend sends only item IDs (`itemId`/`item_id`), Rust performs all crypto locally.
- `VaultItemMeta` is the safe type (no ciphertext) returned to frontend. `VaultItem` (with `secret_cipher`, `nonce`) is Rust-internal only.
- IPC commands check `VaultState::Unlocked` before executing sensitive operations.
- **One exception**: `reveal_vault_item_secret` intentionally returns plaintext for the "eye icon" view — frontend auto-masks after 10 seconds. Do not follow this pattern for new commands.

### Crypto Stack (Rust)
- **Argon2id**: 16 MiB memory, 2 iterations, 4 parallelism → 256-bit key (code uses 16384 KiB; older docs may mention different values)
- **AES-256-GCM**: per-record independent 96-bit random nonce, 128-bit auth tag
- **Memory safety**: master key in `Zeroizing<Vec<u8>>`, zeroed on lock via `StateManager::transition_to_locked()`

### Database (SQLite)
- Location: `{app_data_dir}/vault.db` (platform-dependent)
- Two tables: `app_metadata` (key-value for salt, password hash, settings), `vault_items` (encrypted API keys)
- `secret_cipher` and `nonce` are BLOB (encrypted); `title`, `provider_id`, `tags`, `favorite`, `usage_count` are plaintext for search
- Indexes: `idx_provider`, `idx_usage`, `idx_last_used` for sort performance
- DB files (`*.db`, `*.db-shm`, `*.db-wal`) are gitignored — never commit them

### Auto-Lock System
- Rust guardian thread polls every 10 seconds, reads `auto_lock_timeout` from DB each cycle
- Frontend `useHeartbeat` hook sends `heartbeat` IPC on user activity, throttled to 5 seconds
- Timeout 0 means "never auto-lock"; uses system clock for sleep-aware detection

### Network Behavior
README text may still describe "zero network requests", but current code includes a user-triggered GitHub Releases update check (`check_for_update`) and URL opener. Do not introduce background telemetry or cloud sync without explicit approval.

## Type System Gotchas
- Field is `provider_id` (string), NOT `provider` — matches Rust backend snake_case
- `tags` is a comma-separated `string`, NOT an array
- `@/` path alias resolves to `./src/` (configured in both `tsconfig.json` and `vite.config.ts`)

## Note: Metadata Key Consistency
All salt read/write operations use the key `"salt"` — this was previously inconsistent (`"master_salt"` in old `settings.rs.backup`) but has been fixed. The `.backup` file at `src-tauri/src/commands/settings.rs.backup` still contains the old buggy code — it should be deleted, not referenced.

## i18n
`react-i18next` with inline JSON files at `src/i18n/locales/{zh-CN,en-US,ja-JP,ko-KR}.json`. Default: `zh-CN`, fallback: `en-US`. Always add new UI strings to all locale files.

## Tauri Capabilities
`src-tauri/capabilities/default.json` lists allowed permissions per window (`main`, `dashboard`). When adding IPC or plugin-backed features needing new permissions (clipboard/dialog/global-shortcut/shell/autostart/window APIs), update capabilities and register the corresponding plugin in `src-tauri/src/main.rs`.

## UI Notes
- No component library (no shadcn/ui) — all components are custom Tailwind CSS
- Dark mode via `class` strategy with CSS custom properties (`hsl(var(--...))`)
- Glassmorphism via `backdrop-blur-2xl`/`backdrop-blur-3xl`
- Transparent window: `html`, `body`, `#root` all get `background-color: transparent !important` — REMOVING THIS BREAKS the main window
- Provider icon SVGs in `src/components/icons/`

## Reference Docs
- `AGENTS.md` — detailed architecture notes with additional gotchas; verify against current code before copying older values
- `CONTRIBUTING.md` — contribution workflow, platform dependencies, style notes, security boundaries
- `docs/PRD.md` — product requirements
- `docs/PROJECT_STRUCTURE.md` — module overview
- `docs/PHASE*.md` — phase completion reports
- `CHANGELOG.md` — version history
