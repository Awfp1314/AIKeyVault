# AGENTS.md - AIKeyVault

## Architecture Overview

Tauri 2.0 desktop app. React/TypeScript frontend + Rust backend. Two-language codebase.

- **Frontend** (`src/`): React 18 + TypeScript + Vite + Tailwind CSS 3.4
- **Backend** (`src-tauri/src/`): Rust + rusqlite + argon2 + aes-gcm + secrecy + zeroize

Two Tauri windows (different visual configs):
- `main`: transparent frameless search window (800x600, no decorations)
- `dashboard`: normal framed settings window (1200x700, with OS chrome)

## Dev Commands

```bash
npm run tauri dev     # Development (runs both Rust + React)
npm run tauri build   # Production build
npm run build         # Frontend-only: tsc typecheck + vite build
npm run dev           # Frontend-only: vite dev server (port 1420, strictPort)
```

No linter or formatter is configured. TypeScript `strict: true` with `noUnusedLocals` and `noUnusedParameters` enforced at build time via `tsc`.

## IPC Isolation - CRITICAL

**NEVER pass plaintext API Keys over IPC to the frontend.** This is the iron rule.

- Frontend sends only item IDs (`itemId`, `item_id`).
- Rust backend performs all encryption/decryption locally.
- IPC commands check vault state (`Unlocked` only) before executing.

The ONE exception: `reveal_vault_item_secret` intentionally returns plaintext to frontend for the "eye icon" reveal feature. Frontend auto-masks after 10 seconds. Do NOT use this pattern for new commands.

## State Machine

Rust `StateManager` drives vault state. Frontend receives state via Tauri events:

```
FirstLaunch → (setup_master_password) → Unlocked
Unlocked   → (lock_vault / auto-lock) → Locked (master key zeroized)
Locked     → (unlock_vault)           → Unlocked (key re-derived)
```

Events broadcast to ALL windows: `vault://unlocked`, `vault://lock-triggered`.
Frontend `App.tsx` routes by `window.label` + `vaultState`:
- `main` window: FirstLaunch→OnboardingView, Locked→UnlockView, Unlocked→SearchPage
- `dashboard` window: always DashboardPage (but listens for lock events)

## Type System Gotchas

- Field is `provider_id` (string), NOT `provider`. Matches Rust backend snake_case.
- `tags` is a comma-separated `string`, NOT an array.
- `VaultItemMeta` is the safe type frontend receives (no ciphertext fields). `VaultItem` (with `secret_cipher`, `nonce`) is Rust-internal only.
- The `@/` path alias resolves to `./src/` in both `tsconfig.json` and `vite.config.ts`.

## Crypto & Security

- **Argon2id**: 64 MiB memory, 3 iterations, 4 parallelism → 256-bit key
- **AES-256-GCM**: Per-record independent 96-bit random Nonce, 128-bit Auth Tag
- **Memory safety**: Master key wrapped in `Zeroizing<Vec<u8>>`, zeroed on lock
- **Clipboard**: Auto-clear timer (configurable: 30s/60s/5min/never), privacy marking
- **Metadata key inconsistency**: The Rust code reads `salt` in `vault.rs` but uses `master_salt` in `settings.rs` `change_master_password`. When adding new code, match the `setup_master_password` convention which writes as `"salt"`. The `change_master_password` path has a bug reading `"master_salt"` that won't exist.

## Auto-Lock & Heartbeat

- Rust guardian thread polls every 10 seconds, checks `last_activity_time` against `auto_lock_timeout` from DB.
- Frontend `useHeartbeat` hook sends IPC `heartbeat` on keyboard/mouse events (throttled to 5 seconds).
- Timeout value 0 means "never auto-lock".

## Database

SQLite database at `{app_data_dir}/vault.db`. Two tables:
- `app_metadata` (key TEXT PK, value TEXT) - salt, password hash, settings
- `vault_items` - encrypted API keys. `secret_cipher` and `nonce` are BLOB encrypted. `title`, `provider_id`, `tags`, `favorite`, `usage_count` stored plaintext for search.

Database files (`*.db`, `*.db-shm`, `*.db-wal`) are in `.gitignore` - never commit them.

## UI Conventions

- **No Shadcn/ui components installed** despite README listing it. All components are custom Tailwind.
- Tailwind dark mode via `class` strategy, CSS custom properties (`hsl(var(--...))`) for theming.
- Custom scrollbar styles (`.scrollbar-thin`).
- Transparent window background: `html`, `body`, `#root` all forced `background-color: transparent !important` - this is REQUIRED for the Tauri frameless window to work correctly.
- Glassmorphism effects via `backdrop-blur-2xl` and `backdrop-blur-3xl`.

## i18n

`react-i18next` with inline JSON locale files in `src/i18n/locales/`. Default language: `zh-CN`, fallback: `en-US`. Always add new UI strings to both locale files.

## Tauri Capabilities

`src-tauri/capabilities/default.json` lists allowed permissions for windows `main` and `dashboard`. When adding new IPC commands that require additional permissions (clipboard, dialog, global-shortcut, shell), update this file AND add the plugin in `main.rs`.

## Project Reference Docs

- `docs/PRD.md` - product requirements
- `docs/PROJECT_STRUCTURE.md` - module overview
- `docs/PHASE*.md` - phase completion reports with implementation details
- `CHANGELOG.md` - detailed feature history
