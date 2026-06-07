# Dashboard Panel Components

**v1.0 - 控制中心血肉填�?

这个目录包含 Dashboard 的各个功能面板组件�?

## 组件列表

### SecurityPanel.tsx
**安全设置面板**

功能�?
- 自动锁定超时设置�?分钟/15分钟/30分钟/永不�?
- 剪贴板清空超时设置（30�?60�?5分钟/永不�?
- 修改主密码入口（未来实现�?

技术实现：
- �?`get_app_settings` IPC 命令读取当前配置
- 通过 `update_app_settings` 立即保存更改�?SQLite
- 实时生效，无需重启应用

### KeysPanel.tsx
**密钥管理表格**

功能�?
- 列表展示所�?API Keys（使用安全的 `VaultItemMeta`�?
- 隐私遮罩策略：默认显�?`••••••••••••••••`
- 点击 👁�?图标：调�?`reveal_vault_item_secret` 获取明文
- 10秒自动遮罩：防止明文长时间驻留内�?
- 复制/删除/编辑操作

安全保证�?
- 明文仅存储在 React State �?`Map<string, string>` �?
- 自动清除定时器确�?10 秒后移除明文
- 组件卸载时立即清空所有明文和定时�?
- 符合「点击查看明文」的最小权限原�?

## IPC 命令依赖

### 后端 Commands
```rust
// settings.rs
get_app_settings() -> AppSettings
update_app_settings(settings: AppSettings) -> ()
export_vault_data(export_password: String, file_path: String) -> ()
import_vault_data(import_password: String, file_path: String) -> usize

// vault.rs
get_all_vault_items() -> Vec<VaultItemMeta>
reveal_vault_item_secret(item_id: String) -> String
copy_vault_item_to_clipboard(item_id: String) -> ()
delete_vault_item(item_id: String) -> ()
```

## 内存安全机制

### KeysPanel 的明文管�?

```typescript
// 明文存储：仅在需要时存在
const [revealedSecrets, setRevealedSecrets] = useState<Map<string, string>>(new Map());

// 自动清除�?0秒后移除
const timerId = setTimeout(() => hideSecret(itemId), 10000);

// 组件卸载：立即清�?
useEffect(() => {
  return () => {
    revealedSecrets.clear();
    autoHideTimers.forEach(timerId => clearTimeout(timerId));
  };
}, []);
```

### 为什么明文不会长时间驻留�?

1. **按需加载**：仅在用户点击「眼睛」图标时才调�?`reveal_vault_item_secret`
2. **定时清除**�?0秒后自动�?`revealedSecrets` Map 中移�?
3. **主动隐藏**：用户再次点击「眼睛」图标可立即隐藏
4. **组件卸载**：离开页面时立即清空所有明�?
5. **锁定事件**：监�?`vault://lock-triggered`，立即卸载整�?Dashboard

## 未来扩展

- **SystemPanel**：语言设置、全局快捷键、启动行为（已实现）
- **Add/Edit Modal**：新建和编辑 VaultItem 的弹窗组件

**注意**：导入/导出功能已集成在 KeysPanel 中（v1.0），不再需要独立的 DataPanel。
