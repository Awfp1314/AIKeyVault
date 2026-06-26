import { useState, useEffect, useRef } from "react";
import { useTranslation } from "react-i18next";
import { invoke } from "@tauri-apps/api/core";
import { listen } from "@tauri-apps/api/event";
import { save, open } from "@tauri-apps/plugin-dialog";
import { VaultItemMeta } from "../../types";
import { 
  Key, 
  Eye, 
  EyeOff, 
  Copy, 
  Edit, 
  Trash2, 
  Plus, 
  Star,
  Tag,
  AlertCircle,
  Download,
  Upload,
  Check
} from "lucide-react";
import { ProviderIcon } from "../../components/ProviderIcon";
import { ProviderSelect } from "../../components/ProviderSelect";

/**
/**
 * 🔑 KeysPanel - Key Management Table
 * 
 * v1.0
 * 
 * Core features:
 * 1. List all API Keys (using VaultItemMeta safe metadata)
 * 2. Privacy masking strategy: Default display `••••••••a1b2` (last 4 chars)
 * 3. Click 👁️ icon: Call reveal_vault_item_secret to get plaintext, auto-mask after 10s
 * 4. Click 📋 icon: Copy to clipboard
 * 5. CRUD operations
 * 
 * Memory safety guarantee:
 * - Plaintext only stored briefly in revealedSecrets Map (<10s)
 * - Auto-clear timer ensures no long-term residence
 * - Immediately clear all plaintext on component unmount
 */

export function KeysPanel({ onReady }: { onReady?: () => void }) {
  const { t } = useTranslation();
  const [items, setItems] = useState<VaultItemMeta[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  
  // Store temporarily revealed plaintext (item_id -> plaintext)
  const [revealedSecrets, setRevealedSecrets] = useState<Map<string, string>>(new Map());
  
  // Store IDs currently loading plaintext
  const [revealingIds, setRevealingIds] = useState<Set<string>>(new Set());
  
  // Store auto-mask timers outside React state to avoid stale cleanup closures.
  const autoHideTimersRef = useRef<Map<string, number>>(new Map());
  
  // Store IDs of items that were just copied (for checkmark animation)
  const [copiedIds, setCopiedIds] = useState<Set<string>>(new Set());

  // Add Key Modal State
  const [showAddModal, setShowAddModal] = useState(false);

  // Edit Key Modal State
  const [showEditModal, setShowEditModal] = useState(false);
  const [itemToEdit, setItemToEdit] = useState<VaultItemMeta | null>(null);

  // Delete Confirmation Modal State
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [itemToDelete, setItemToDelete] = useState<{ id: string; title: string } | null>(null);

  // Export/Import State
  const [showExportModal, setShowExportModal] = useState(false);
  const [exportPassword, setExportPassword] = useState('');
  const [exportPasswordConfirm, setExportPasswordConfirm] = useState('');
  const [exportLoading, setExportLoading] = useState(false);
  const [showExportPassword, setShowExportPassword] = useState(false);

  const [showImportModal, setShowImportModal] = useState(false);
  const [importPassword, setImportPassword] = useState('');
  const [importFilePath, setImportFilePath] = useState('');
  const [importLoading, setImportLoading] = useState(false);
  const [showImportPassword, setShowImportPassword] = useState(false);

  const clearRevealState = () => {
    autoHideTimersRef.current.forEach(timerId => clearTimeout(timerId));
    autoHideTimersRef.current.clear();
    setRevealedSecrets(new Map());
    setRevealingIds(new Set());
    setCopiedIds(new Set());
  };

  useEffect(() => {
    loadItems();

    const unlistenLock = listen("vault://lock-triggered", () => {
      clearRevealState();
    });

    // Clear all plaintext and timers on component unmount
    return () => {
      clearRevealState();
      unlistenLock.then(fn => fn());
    };
  }, []);

  const loadItems = async () => {
    try {
      setIsLoading(true);
      setError(null);
      const data = await invoke<VaultItemMeta[]>("get_all_vault_items");
      setItems(data);
      onReady?.();
    } catch (err) {
      console.error("[KeysPanel] Failed to load items:", err);
      setError(`${t('keys.load_failed')}: ${err}`);
    } finally {
      setIsLoading(false);
    }
  };

  const handleRevealSecret = async (itemId: string) => {
    // 如果已经显示，则隐藏
    if (revealedSecrets.has(itemId)) {
      hideSecret(itemId);
      return;
    }

    // Start loading
    setRevealingIds(prev => new Set(prev).add(itemId));

    try {
      const plaintext = await invoke<string>("reveal_vault_item_secret", { itemId });
      
      // Save plaintext to Map
      setRevealedSecrets(prev => new Map(prev).set(itemId, plaintext));

      const existingTimer = autoHideTimersRef.current.get(itemId);
      if (existingTimer) {
        clearTimeout(existingTimer);
      }

      // Set 10 second auto-hide
      const timerId = window.setTimeout(() => {
        hideSecret(itemId);
      }, 10000);

      autoHideTimersRef.current.set(itemId, timerId);
    } catch (err) {
      console.error("[KeysPanel] Failed to reveal secret:", err);
      alert(`${t('keys.reveal_failed')}: ${err}`);
    } finally {
      setRevealingIds(prev => {
        const next = new Set(prev);
        next.delete(itemId);
        return next;
      });
    }
  };

  const hideSecret = (itemId: string) => {
    // 清除明文
    setRevealedSecrets(prev => {
      const next = new Map(prev);
      next.delete(itemId);
      return next;
    });

    // Clear timer
    const timerId = autoHideTimersRef.current.get(itemId);
    if (timerId) {
      clearTimeout(timerId);
      autoHideTimersRef.current.delete(itemId);
    }
  };

  const handleCopySecret = async (itemId: string) => {
    try {
      // Always use the backend path so clipboard privacy and auto-clear apply.
      await invoke("copy_vault_item_to_clipboard", { itemId });
      
      // Show checkmark on button for 2 seconds
      setCopiedIds(prev => new Set(prev).add(itemId));
      setTimeout(() => {
        setCopiedIds(prev => {
          const next = new Set(prev);
          next.delete(itemId);
          return next;
        });
      }, 2000);
    } catch (err) {
      console.error("[KeysPanel] Failed to copy:", err);
      alert(`${t('keys.copy_failed')}: ${err}`);
    }
  };

  const handleDeleteItem = async (itemId: string) => {
    try {
      await invoke("delete_vault_item", { itemId });
      await loadItems();
      setShowDeleteModal(false);
      setItemToDelete(null);
    } catch (err) {
      console.error("[KeysPanel] Failed to delete:", err);
      alert(`${t('keys.delete_failed')}: ${err}`);
    }
  };

  const openDeleteConfirmation = (itemId: string, itemTitle: string) => {
    setItemToDelete({ id: itemId, title: itemTitle });
    setShowDeleteModal(true);
  };

  const handleCreateItem = async (formData: {
    title: string;
    providerId: string;
    secret: string;
    tags: string;
    note: string;
  }) => {
    try {
      await invoke("create_vault_item", {
        title: formData.title,
        providerId: formData.providerId,
        secret: formData.secret,
        tags: formData.tags,
        note: formData.note || null,
      });
      
      setShowAddModal(false);
      await loadItems();
    } catch (err) {
      console.error("[KeysPanel] Failed to create item:", err);
      throw err; // Re-throw to let modal handle error display
    }
  };

  const openEditModal = async (item: VaultItemMeta) => {
    setItemToEdit(item);
    setShowEditModal(true);
  };

  const handleUpdateItem = async (formData: {
    title: string;
    providerId: string;
    secret: string;
    tags: string;
    note: string;
  }) => {
    if (!itemToEdit) return;

    try {
      // If secret is empty, don't update it (keep existing)
      const secretToUpdate = formData.secret.trim() ? formData.secret : null;

      await invoke("update_vault_item", {
        itemId: itemToEdit.id,
        title: formData.title,
        providerId: formData.providerId,
        secret: secretToUpdate,
        tags: formData.tags,
        note: formData.note || null,
      });
      
      setShowEditModal(false);
      setItemToEdit(null);
      await loadItems();
    } catch (err) {
      console.error("[KeysPanel] Failed to update item:", err);
      throw err; // Re-throw to let modal handle error display
    }
  };

  const handleExport = async () => {
    if (!exportPassword) {
      alert(t('data.exportPasswordRequired'));
      return;
    }
    if (exportPassword !== exportPasswordConfirm) {
      alert(t('data.passwordMismatch'));
      return;
    }
    if (exportPassword.length < 6) {
      alert(t('data.passwordTooShort'));
      return;
    }

    try {
      setExportLoading(true);
      const filePath = await save({
        defaultPath: `aikeyvault-backup-${Date.now()}.kvx`,
        filters: [{
          name: 'AIKeyVault Backup',
          extensions: ['kvx']
        }]
      });

      if (!filePath) {
        setExportLoading(false);
        return;
      }

      await invoke('export_vault_data', { exportPassword, filePath });
      
      alert(t('data.exportSuccess'));
      setShowExportModal(false);
      setExportPassword('');
      setExportPasswordConfirm('');
    } catch (error) {
      console.error('[Export] Failed:', error);
      alert(`${t('data.exportFailed')}: ${error}`);
    } finally {
      setExportLoading(false);
    }
  };

  const handleSelectImportFile = async () => {
    try {
      const selected = await open({
        multiple: false,
        filters: [{
          name: 'AIKeyVault Backup',
          extensions: ['kvx']
        }]
      });

      if (selected && typeof selected === 'string') {
        setImportFilePath(selected);
        setShowImportModal(true);
      }
    } catch (error) {
      console.error('[Import] Failed to select file:', error);
      alert(`${t('data.selectFileFailed')}: ${error}`);
    }
  };

  const handleImport = async () => {
    if (!importPassword) {
      alert(t('data.importPasswordRequired'));
      return;
    }
    if (!importFilePath) {
      alert(t('data.noFileSelected'));
      return;
    }

    try {
      setImportLoading(true);
      const importedCount = await invoke<number>('import_vault_data', {
        importPassword,
        filePath: importFilePath
      });

      alert(`${t('data.importSuccess')}! ${importedCount} ${t('data.itemsImported')}.`);
      setShowImportModal(false);
      setImportPassword('');
      setImportFilePath('');
      
      // Reload Dashboard to show new items
      await loadItems();
      
      // Notify main window (search page) to refresh
      try {
        await invoke('trigger_search_refresh');
      } catch (err) {
        console.error('[Import] Failed to notify search page:', err);
      }
    } catch (error) {
      console.error('Import failed:', error);
      const errorMsg = String(error);
      
      // Check if it's a password error
      if (errorMsg.includes('Incorrect password') || errorMsg.includes('密码错误')) {
        alert(t('data.importWrongPassword'));
      } else {
        alert(`${t('data.importFailed')}: ${error}`);
      }
    } finally {
      setImportLoading(false);
    }
  };

  const maskSecret = (itemId: string): string => {
    // 如果已揭示，返回明文
    const plaintext = revealedSecrets.get(itemId);
    if (plaintext) {
      return plaintext;
    }

    // Otherwise return masked
    // TODO: In future, get last 4 chars from backend, currently using placeholder
    return "••••••••••••••••";
  };

  if (isLoading) {
    return (
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-2xl font-bold text-white">{t('keys.title')}</h2>
            <p className="text-white/60 mt-2">{t('keys.description')}</p>
          </div>
        </div>
        <div className="w-full max-w-5xl mx-auto">
          <table className="w-full table-fixed">
            <colgroup>
              <col style={{ width: '140px' }} />
              <col style={{ width: '100px' }} />
              <col style={{ width: '180px' }} />
              <col style={{ width: '110px' }} />
              <col style={{ width: '140px' }} />
              <col style={{ width: '80px' }} />
              <col style={{ width: '130px' }} />
            </colgroup>
            <thead>
              <tr className="border-b border-white/10">
                <th className="py-3 px-4 text-left text-xs font-semibold text-white/40 uppercase tracking-wider">
                  {t('keys.table_provider')}
                </th>
                <th className="py-3 px-4 text-left text-xs font-semibold text-white/40 uppercase tracking-wider">
                  {t('keys.table_title')}
                </th>
                <th className="py-3 px-4 text-left text-xs font-semibold text-white/40 uppercase tracking-wider">
                  {t('keys.table_secret')}
                </th>
                <th className="py-3 px-4 text-left text-xs font-semibold text-white/40 uppercase tracking-wider">
                  {t('keys.table_tags')}
                </th>
                <th className="py-3 px-4 text-left text-xs font-semibold text-white/40 uppercase tracking-wider">
                  {t('keys.table_note')}
                </th>
                <th className="py-3 px-4 text-left text-xs font-semibold text-white/40 uppercase tracking-wider">
                  {t('keys.table_usage')}
                </th>
                <th className="py-3 px-4 text-left text-xs font-semibold text-white/40 uppercase tracking-wider">
                  {t('keys.table_actions')}
                </th>
              </tr>
            </thead>
            <tbody>
              <tr>
                <td colSpan={7} className="py-12 text-center">
                  <div className="w-5 h-5 mx-auto border-2 border-white/10 border-t-white/40 rounded-full animate-spin" />
                </td>
              </tr>
            </tbody>
          </table>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="space-y-6">
        <div>
          <h2 className="text-2xl font-bold text-white">{t('keys.title')}</h2>
          <p className="text-red-400 mt-2">
            {t('keys.load_failed')}: {error}
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold text-white">{t('keys.title')}</h2>
          <p className="text-white/60 mt-2">{t('keys.description')}</p>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={() => {
              handleSelectImportFile();
            }}
            className="h-9 px-3 flex items-center gap-1.5 text-sm bg-white/5 border border-white/10 text-white/70 hover:text-white hover:bg-white/10 rounded-lg transition-all"
            title={t('data.importButton')}
          >
            <Upload className="w-4 h-4" />
            <span className="hidden sm:inline">{t('data.importButton')}</span>
          </button>
          <button
            onClick={() => {
              setShowExportModal(true);
            }}
            className="h-9 px-3 flex items-center gap-1.5 text-sm bg-white/5 border border-white/10 text-white/70 hover:text-white hover:bg-white/10 rounded-lg transition-all"
            title={t('data.exportButton')}
          >
            <Download className="w-4 h-4" />
            <span className="hidden sm:inline">{t('data.exportButton')}</span>
          </button>
          <button
            className="h-9 px-4 flex items-center gap-1.5 text-sm bg-blue-600 hover:bg-blue-500 text-white font-medium rounded-lg shadow-[0_0_15px_rgba(37,99,235,0.2)] border border-white/10 active:scale-95 transition-all"
            onClick={() => setShowAddModal(true)}
          >
            <Plus className="w-4 h-4" />
            {t('keys.add_button')}
          </button>
        </div>
      </div>

      {/* Empty State */}
      {items.length === 0 && (
        <div className="flex-1 flex flex-col items-center justify-center py-20 bg-transparent">
          <Key className="w-16 h-16 text-white/10 mb-4" />
          <p className="text-lg font-medium text-white/70">{t('keys.no_keys')}</p>
          <p className="text-sm text-white/40 mt-1">{t('keys.no_keys_hint')}</p>
        </div>
      )}

      {/* Table */}
      {items.length > 0 && (
        <div className="w-full max-w-5xl mx-auto">
          <table className="w-full table-fixed">
            <colgroup>
              <col style={{ width: '140px' }} />
              <col style={{ width: '100px' }} />
              <col style={{ width: '180px' }} />
              <col style={{ width: '110px' }} />
              <col style={{ width: '140px' }} />
              <col style={{ width: '80px' }} />
              <col style={{ width: '130px' }} />
            </colgroup>
            <thead>
              <tr className="border-b border-white/10">
                <th className="py-3 px-4 text-left text-xs font-semibold text-white/40 uppercase tracking-wider">
                  {t('keys.table_provider')}
                </th>
                <th className="py-3 px-4 text-left text-xs font-semibold text-white/40 uppercase tracking-wider">
                  {t('keys.table_title')}
                </th>
                <th className="py-3 px-4 text-left text-xs font-semibold text-white/40 uppercase tracking-wider">
                  {t('keys.table_secret')}
                </th>
                <th className="py-3 px-4 text-left text-xs font-semibold text-white/40 uppercase tracking-wider">
                  {t('keys.table_tags')}
                </th>
                <th className="py-3 px-4 text-left text-xs font-semibold text-white/40 uppercase tracking-wider">
                  {t('keys.table_note')}
                </th>
                <th className="py-3 px-4 text-left text-xs font-semibold text-white/40 uppercase tracking-wider">
                  {t('keys.table_usage')}
                </th>
                <th className="py-3 px-4 text-left text-xs font-semibold text-white/40 uppercase tracking-wider">
                  {t('keys.table_actions')}
                </th>
              </tr>
            </thead>
            <tbody>
              {items.map((item) => (
                <tr 
                  key={item.id} 
                  className="border-b border-white/5 hover:bg-white/[0.04] transition-colors group"
                >
                  {/* Provider */}
                  <td className="py-3 px-4 text-sm text-white/80">
                    <div className="flex items-center gap-2">
                      <ProviderIcon provider={item.provider_id} className="w-5 h-5 flex-shrink-0" />
                      <span className="font-medium capitalize truncate">
                        {item.provider_id}
                      </span>
                    </div>
                  </td>

                  {/* Title */}
                  <td className="py-3 px-4 text-sm text-white/80">
                    <div className="flex items-center gap-2">
                      {item.favorite && <Star className="w-3.5 h-3.5 text-yellow-400 fill-yellow-400 flex-shrink-0" />}
                      <span className="font-medium truncate" title={item.title}>{item.title}</span>
                    </div>
                  </td>

                  {/* Secret (with Privacy Mask + Reveal/Hide Button) */}
                  <td className="py-3 px-4 text-sm text-white/80">
                    <div className="flex items-center gap-1.5">
                      <div className="font-mono text-xs truncate min-w-0">
                        {maskSecret(item.id)}
                      </div>
                      {/* Reveal/Hide Button */}
                      <button
                        onClick={() => handleRevealSecret(item.id)}
                        disabled={revealingIds.has(item.id)}
                        className="text-white/40 hover:text-white transition-colors p-1 rounded hover:bg-white/10 disabled:opacity-50 disabled:cursor-not-allowed flex-shrink-0"
                        title={revealedSecrets.has(item.id) ? t('keys.hide_hint') : t('keys.reveal_hint')}
                      >
                        {revealingIds.has(item.id) ? (
                          <div className="w-3.5 h-3.5 border-2 border-white/20 border-t-white/60 rounded-full animate-spin" />
                        ) : revealedSecrets.has(item.id) ? (
                          <EyeOff className="w-3.5 h-3.5" />
                        ) : (
                          <Eye className="w-3.5 h-3.5" />
                        )}
                      </button>
                    </div>
                  </td>

                  {/* Tags */}
                  <td className="py-3 px-4 text-sm text-white/80">
                    {item.tags && item.tags.length > 0 ? (
                      <div className="flex items-center gap-1">
                        <Tag className="w-3 h-3 text-white/40 flex-shrink-0" />
                        <span className="text-xs text-white/60 truncate" title={item.tags}>{item.tags}</span>
                      </div>
                    ) : (
                      <span className="text-xs text-white/30">-</span>
                    )}
                  </td>

                  {/* Note */}
                  <td className="py-3 px-4 text-sm text-white/80">
                    {item.note && item.note.length > 0 ? (
                      <span className="text-xs text-white/60 truncate block" title={item.note}>{item.note}</span>
                    ) : (
                      <span className="text-xs text-white/30">-</span>
                    )}
                  </td>

                  {/* Usage Count */}
                  <td className="py-3 px-4 text-sm text-white/80">
                    <span className="text-xs text-white/60">{item.usage_count}x</span>
                  </td>

                  {/* Actions */}
                  <td className="py-3 px-4 text-sm text-white/80">
                    <div className="flex items-center gap-2">
                      {/* Copy Button */}
                      <button
                        onClick={() => handleCopySecret(item.id)}
                        className="text-white/40 hover:text-white transition-colors p-1.5 rounded hover:bg-white/10"
                        title={t('keys.copy_hint')}
                      >
                        {copiedIds.has(item.id) ? (
                          <Check className="w-4 h-4 text-green-400" />
                        ) : (
                          <Copy className="w-4 h-4" />
                        )}
                      </button>

                      {/* Edit Button */}
                      <button
                        onClick={() => openEditModal(item)}
                        className="text-white/40 hover:text-white transition-colors p-1.5 rounded hover:bg-white/10"
                        title={t('keys.edit_hint')}
                      >
                        <Edit className="w-4 h-4" />
                      </button>

                      {/* Delete Button */}
                      <button
                        onClick={() => openDeleteConfirmation(item.id, item.title)}
                        className="text-white/40 hover:text-red-400 transition-colors p-1.5 rounded hover:bg-red-500/10"
                        title={t('keys.delete_hint')}
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* Privacy Notice */}
      <div className="mt-12 mx-auto w-fit px-4 py-2 bg-white/[0.03] border border-white/5 rounded-full flex items-center gap-2 shadow-sm">
        <AlertCircle className="w-3.5 h-3.5 text-white/40" />
        <span className="text-xs text-white/40">
          {t('keys.privacy_title')} · {t('keys.privacy_badge')}
        </span>
      </div>

      {/* Add Key Modal */}
      {showAddModal && (
        <AddKeyModal
          onClose={() => setShowAddModal(false)}
          onSubmit={handleCreateItem}
        />
      )}

      {/* Edit Key Modal */}
      {showEditModal && itemToEdit && (
        <EditKeyModal
          item={itemToEdit}
          onClose={() => {
            setShowEditModal(false);
            setItemToEdit(null);
          }}
          onSubmit={handleUpdateItem}
        />
      )}

      {/* Delete Confirmation Modal */}
      {showDeleteModal && itemToDelete && (
        <DeleteConfirmModal
          itemTitle={itemToDelete.title}
          onConfirm={() => handleDeleteItem(itemToDelete.id)}
          onCancel={() => {
            setShowDeleteModal(false);
            setItemToDelete(null);
          }}
        />
      )}

      {/* Export Modal */}
      {showExportModal && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <div className="bg-slate-800 border border-white/20 rounded-2xl shadow-2xl w-full max-w-md max-h-[90vh] flex flex-col">
            {/* Header */}
            <div className="px-6 py-4 border-b border-white/10 flex-shrink-0">
              <h3 className="text-xl font-bold text-white">{t('data.exportModalTitle')}</h3>
              <p className="text-sm text-white/60 mt-1">{t('data.exportDescription')}</p>
            </div>

            {/* Form */}
            <div className="flex-1 overflow-y-auto scrollbar-thin scrollbar-track-transparent scrollbar-thumb-white/10 p-6 space-y-4">
              <div>
                <label className="block text-sm font-medium text-white/80 mb-2">
                  {t('data.exportPasswordLabel')}
                </label>
                <div className="relative">
                  <input
                    type={showExportPassword ? 'text' : 'password'}
                    value={exportPassword}
                    onChange={(e) => setExportPassword(e.target.value)}
                    className="w-full px-4 py-2 bg-white/5 border border-white/10 rounded-lg 
                      text-white placeholder:text-white/30 pr-12
                      focus:outline-none focus:border-blue-500/50 transition-colors"
                    placeholder={t('data.placeholder_min_chars')}
                  />
                  <button
                    type="button"
                    onClick={() => setShowExportPassword(!showExportPassword)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-white/40 hover:text-white/70 transition-colors"
                  >
                    {showExportPassword ? '🙈' : '👁️'}
                  </button>
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-white/80 mb-2">
                  {t('data.confirmPasswordLabel')}
                </label>
                <input
                  type={showExportPassword ? 'text' : 'password'}
                  value={exportPasswordConfirm}
                  onChange={(e) => setExportPasswordConfirm(e.target.value)}
                  className="w-full px-4 py-2 bg-white/5 border border-white/10 rounded-lg 
                    text-white placeholder:text-white/30
                    focus:outline-none focus:border-blue-500/50 transition-colors"
                  placeholder={t('data.placeholder_reenter')}
                />
              </div>
            </div>

            {/* Footer */}
            <div className="px-6 py-4 border-t border-white/10 flex-shrink-0 flex gap-3 justify-end">
              <button
                onClick={() => {
                  setShowExportModal(false);
                  setExportPassword('');
                  setExportPasswordConfirm('');
                }}
                className="px-4 py-2 text-white/70 hover:text-white transition-colors"
                disabled={exportLoading}
              >
                {t('common.cancel')}
              </button>
              <button
                onClick={handleExport}
                className="px-6 py-2 bg-blue-500 hover:bg-blue-600 rounded-lg text-white font-medium 
                  transition-colors disabled:opacity-50"
                disabled={exportLoading}
              >
                {exportLoading ? t('data.exporting') : t('data.exportButton')}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Import Modal */}
      {showImportModal && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <div className="bg-slate-800 border border-white/20 rounded-2xl shadow-2xl w-full max-w-md max-h-[90vh] flex flex-col">
            {/* Header */}
            <div className="px-6 py-4 border-b border-white/10 flex-shrink-0">
              <h3 className="text-xl font-bold text-white">{t('data.importModalTitle')}</h3>
              <p className="text-sm text-white/60 mt-1">{t('data.importDescription')}</p>
            </div>

            {/* Form */}
            <div className="flex-1 overflow-y-auto scrollbar-thin scrollbar-track-transparent scrollbar-thumb-white/10 p-6 space-y-4">
              <div className="bg-white/5 border border-white/10 rounded-lg p-3">
                <p className="text-sm text-white/70 break-all">
                  <span className="text-white/50">{t('data.selectedFile')}:</span> {importFilePath}
                </p>
              </div>

              <div>
                <label className="block text-sm font-medium text-white/80 mb-2">
                  {t('data.importPasswordLabel')}
                </label>
                <div className="relative">
                  <input
                    type={showImportPassword ? 'text' : 'password'}
                    value={importPassword}
                    onChange={(e) => setImportPassword(e.target.value)}
                    className="w-full px-4 py-2 bg-white/5 border border-white/10 rounded-lg 
                      text-white placeholder:text-white/30 pr-12
                      focus:outline-none focus:border-blue-500/50 transition-colors"
                    placeholder={t('data.placeholder_min_chars')}
                  />
                  <button
                    type="button"
                    onClick={() => setShowImportPassword(!showImportPassword)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-white/40 hover:text-white/70 transition-colors"
                  >
                    {showImportPassword ? '🙈' : '👁️'}
                  </button>
                </div>
              </div>
            </div>

            {/* Footer */}
            <div className="px-6 py-4 border-t border-white/10 flex-shrink-0 flex gap-3 justify-end">
              <button
                onClick={() => {
                  setShowImportModal(false);
                  setImportPassword('');
                  setImportFilePath('');
                }}
                className="px-4 py-2 text-white/70 hover:text-white transition-colors"
                disabled={importLoading}
              >
                {t('common.cancel')}
              </button>
              <button
                onClick={handleImport}
                className="px-6 py-2 bg-green-500 hover:bg-green-600 rounded-lg text-white font-medium 
                  transition-colors disabled:opacity-50"
                disabled={importLoading}
              >
                {importLoading ? t('data.importing') : t('data.importButton')}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

// Add Key Modal Component
interface AddKeyModalProps {
  onClose: () => void;
  onSubmit: (formData: {
    title: string;
    providerId: string;
    secret: string;
    tags: string;
    note: string;
  }) => Promise<void>;
}

function AddKeyModal({ onClose, onSubmit }: AddKeyModalProps) {
  const { t } = useTranslation(); // 添加 useTranslation hook
  const [title, setTitle] = useState("");
  const [providerId, setProviderId] = useState("openai");
  const [secret, setSecret] = useState("");
  const [tags, setTags] = useState("");
  const [note, setNote] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async () => {
    if (!title.trim() || !secret.trim()) {
      setError(t('keys.validation_required'));
      return;
    }

    setIsSubmitting(true);
    setError(null);

    try {
      // 清理标签：移除逗号后的空格，并去除首尾空白
      const cleanedTags = tags
        .replace(/，/g, ',')  // 中文逗号转英文逗号
        .replace(/,\s+/g, ',')  // 移除逗号后的空格
        .replace(/\s+,/g, ',')  // 移除逗号前的空格
        .trim();

      await onSubmit({
        title: title.trim(),
        providerId,
        secret: secret.trim(),
        tags: cleanedTags,
        note: note.trim(),
      });
    } catch (err) {
      setError(`${t('keys.create_failed')}: ${err}`);
      setIsSubmitting(false);
    }
  };

  const handleFormSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    handleSubmit();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="w-full max-w-md bg-slate-800/90 backdrop-blur-2xl rounded-2xl shadow-[0_0_0_1px_rgba(255,255,255,0.05),0_20px_50px_-12px_rgba(0,0,0,0.8),0_0_100px_rgba(0,0,0,0.4)] flex flex-col overflow-hidden">
        {/* Header */}
        <div className="px-6 py-4 flex items-start justify-between flex-shrink-0">
          <div>
            <h3 className="text-lg font-semibold text-white/90">{t('keys.modal_title')}</h3>
            <p className="text-xs text-white/50 mt-1">{t('keys.modal_description')}</p>
          </div>
        </div>

        {/* Form - Scrollable */}
        <form 
          onSubmit={handleFormSubmit}
          className="flex-1 overflow-y-auto [scrollbar-width:none]"
        >
          <div className="px-6 py-0 pb-6 space-y-4">
          {/* Error Message */}
          {error && (
            <div className="bg-red-500/10 border border-red-500/30 rounded-lg p-2.5">
              <p className="text-xs text-red-400">{error}</p>
            </div>
          )}

          {/* Title */}
          <div>
            <label className="block text-xs font-medium text-white/60 mb-1.5">
              {t('keys.modal_title_label')} <span className="text-rose-500/70">*</span>
            </label>
            <input
              type="text"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder={t('keys.modal_title_placeholder')}
              className="w-full h-9 px-3 bg-black/40 border border-white/5 rounded-lg text-sm text-white placeholder:text-white/30 focus:outline-none focus:border-white/20 focus:ring-1 focus:ring-white/20 transition-colors duration-150"
              disabled={isSubmitting}
            />
          </div>

          {/* Provider */}
          <div>
            <label className="block text-xs font-medium text-white/60 mb-1.5">
              {t('keys.modal_provider_label')}
            </label>
            <ProviderSelect
              value={providerId}
              onChange={setProviderId}
              disabled={isSubmitting}
            />
          </div>

          {/* Secret */}
          <div>
            <label className="block text-xs font-medium text-white/60 mb-1.5">
              {t('keys.modal_secret_label')} <span className="text-rose-500/70">*</span>
            </label>
            <textarea
              value={secret}
              onChange={(e) => setSecret(e.target.value)}
              placeholder="sk-..."
              rows={2}
              className="w-full px-3 py-2 bg-black/40 border border-white/5 rounded-lg text-sm text-white placeholder:text-white/30 font-mono focus:outline-none focus:border-white/20 focus:ring-1 focus:ring-white/20 transition-colors duration-150 resize-none"
              disabled={isSubmitting}
            />
          </div>

          {/* Tags */}
          <div>
            <label className="block text-xs font-medium text-white/60 mb-1.5">
              {t('keys.modal_tags_label')}
            </label>
            <input
              type="text"
              value={tags}
              onChange={(e) => setTags(e.target.value)}
              onBlur={(e) => {
                // 失去焦点时自动清理：转换中文逗号并移除多余空格
                const cleanedValue = e.target.value
                  .replace(/，/g, ',')
                  .replace(/,\s+/g, ',')
                  .replace(/\s+,/g, ',')
                  .trim();
                setTags(cleanedValue);
              }}
              placeholder={t('keys.modal_tags_placeholder')}
              className="w-full h-9 px-3 bg-black/40 border border-white/5 rounded-lg text-sm text-white placeholder:text-white/30 focus:outline-none focus:border-white/20 focus:ring-1 focus:ring-white/20 transition-colors duration-150"
              disabled={isSubmitting}
            />
          </div>

          {/* Note */}
          <div>
            <label className="block text-xs font-medium text-white/60 mb-1.5">
              {t('keys.modal_note_label')}
            </label>
            <textarea
              value={note}
              onChange={(e) => setNote(e.target.value)}
              placeholder={t('keys.modal_note_placeholder')}
              rows={2}
              className="w-full px-3 py-2 bg-black/40 border border-white/5 rounded-lg text-sm text-white placeholder:text-white/30 focus:outline-none focus:border-white/20 focus:ring-1 focus:ring-white/20 transition-colors duration-150 resize-none"
              disabled={isSubmitting}
            />
          </div>
          </div>
        </form>

        {/* Footer */}
        <div className="px-6 py-4 flex flex-shrink-0 justify-end gap-2 bg-black/20">
          <button
            type="button"
            onClick={onClose}
            disabled={isSubmitting}
            className="h-9 px-4 flex items-center justify-center text-sm text-white/60 hover:text-white hover:bg-white/10 rounded-lg transition-colors"
          >
            {t('keys.modal_cancel')}
          </button>
          <button
            type="button"
            onClick={handleSubmit}
            disabled={isSubmitting}
            className="h-9 px-4 flex items-center justify-center gap-1.5 text-sm bg-white text-black hover:bg-white/90 rounded-lg font-medium shadow-sm transition-transform active:scale-95"
          >
            {isSubmitting ? (
              <>
                <div className="w-4 h-4 border-2 border-black/20 border-t-black rounded-full animate-spin" />
                {t('keys.modal_creating')}
              </>
            ) : (
              <>
                <Plus className="w-4 h-4" />
                {t('keys.modal_create')}
              </>
            )}
          </button>
        </div>
      </div>
    </div>
  );
}

// Edit Key Modal Component (Reuses Add Modal structure with pre-filled data)
interface EditKeyModalProps {
  item: VaultItemMeta;
  onClose: () => void;
  onSubmit: (formData: {
    title: string;
    providerId: string;
    secret: string;
    tags: string;
    note: string;
  }) => Promise<void>;
}

function EditKeyModal({ item, onClose, onSubmit }: EditKeyModalProps) {
  const { t } = useTranslation();
  const [title, setTitle] = useState(item.title);
  const [providerId, setProviderId] = useState(item.provider_id);
  const [secret, setSecret] = useState(""); // Empty = keep existing secret
  const [tags, setTags] = useState(item.tags || "");
  const [note, setNote] = useState(item.note || "");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async () => {
    if (!title.trim()) {
      setError(t('keys.validation_required'));
      return;
    }

    setIsSubmitting(true);
    setError(null);

    try {
      // Clean tags
      const cleanedTags = tags
        .replace(/，/g, ',')
        .replace(/,\s+/g, ',')
        .replace(/\s+,/g, ',')
        .trim();

      await onSubmit({
        title: title.trim(),
        providerId,
        secret: secret.trim(), // Empty string means keep existing
        tags: cleanedTags,
        note: note.trim(),
      });
    } catch (err) {
      setError(`${t('keys.update_failed')}: ${err}`);
      setIsSubmitting(false);
    }
  };

  const handleFormSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    handleSubmit();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="w-full max-w-md bg-slate-800/90 backdrop-blur-2xl rounded-2xl shadow-[0_0_0_1px_rgba(255,255,255,0.05),0_20px_50px_-12px_rgba(0,0,0,0.8),0_0_100px_rgba(0,0,0,0.4)] flex flex-col overflow-hidden">
        {/* Header */}
        <div className="px-6 py-4 flex items-start justify-between flex-shrink-0">
          <div>
            <h3 className="text-lg font-semibold text-white/90">{t('keys.edit_modal_title')}</h3>
            <p className="text-xs text-white/50 mt-1">{t('keys.edit_modal_description')}</p>
          </div>
        </div>

        {/* Form - Scrollable */}
        <form 
          onSubmit={handleFormSubmit}
          className="flex-1 overflow-y-auto [scrollbar-width:none]"
        >
          <div className="px-6 py-0 pb-6 space-y-4">
          {/* Error Message */}
          {error && (
            <div className="bg-red-500/10 border border-red-500/30 rounded-lg p-2.5">
              <p className="text-xs text-red-400">{error}</p>
            </div>
          )}

          {/* Title */}
          <div>
            <label className="block text-xs font-medium text-white/60 mb-1.5">
              {t('keys.modal_title_label')} <span className="text-rose-500/70">*</span>
            </label>
            <input
              type="text"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder={t('keys.modal_title_placeholder')}
              className="w-full h-9 px-3 bg-black/40 border border-white/5 rounded-lg text-sm text-white placeholder:text-white/30 focus:outline-none focus:border-white/20 focus:ring-1 focus:ring-white/20 transition-colors duration-150"
              disabled={isSubmitting}
            />
          </div>

          {/* Provider */}
          <div>
            <label className="block text-xs font-medium text-white/60 mb-1.5">
              {t('keys.modal_provider_label')}
            </label>
            <ProviderSelect
              value={providerId}
              onChange={setProviderId}
              disabled={isSubmitting}
            />
          </div>

          {/* Secret */}
          <div>
            <label className="block text-xs font-medium text-white/60 mb-1.5">
              {t('keys.modal_secret_label')}
            </label>
            <p className="text-[10px] text-white/40 mb-1.5">
              {t('keys.edit_secret_hint')}
            </p>
            <textarea
              value={secret}
              onChange={(e) => setSecret(e.target.value)}
              placeholder={t('keys.edit_secret_placeholder')}
              rows={2}
              className="w-full px-3 py-2 bg-black/40 border border-white/5 rounded-lg text-sm text-white placeholder:text-white/30 font-mono focus:outline-none focus:border-white/20 focus:ring-1 focus:ring-white/20 transition-colors duration-150 resize-none"
              disabled={isSubmitting}
            />
          </div>

          {/* Tags */}
          <div>
            <label className="block text-xs font-medium text-white/60 mb-1.5">
              {t('keys.modal_tags_label')}
            </label>
            <input
              type="text"
              value={tags}
              onChange={(e) => setTags(e.target.value)}
              onBlur={(e) => {
                const cleanedValue = e.target.value
                  .replace(/，/g, ',')
                  .replace(/,\s+/g, ',')
                  .replace(/\s+,/g, ',')
                  .trim();
                setTags(cleanedValue);
              }}
              placeholder={t('keys.modal_tags_placeholder')}
              className="w-full h-9 px-3 bg-black/40 border border-white/5 rounded-lg text-sm text-white placeholder:text-white/30 focus:outline-none focus:border-white/20 focus:ring-1 focus:ring-white/20 transition-colors duration-150"
              disabled={isSubmitting}
            />
          </div>

          {/* Note */}
          <div>
            <label className="block text-xs font-medium text-white/60 mb-1.5">
              {t('keys.modal_note_label')}
            </label>
            <textarea
              value={note}
              onChange={(e) => setNote(e.target.value)}
              placeholder={t('keys.modal_note_placeholder')}
              rows={2}
              className="w-full px-3 py-2 bg-black/40 border border-white/5 rounded-lg text-sm text-white placeholder:text-white/30 focus:outline-none focus:border-white/20 focus:ring-1 focus:ring-white/20 transition-colors duration-150 resize-none"
              disabled={isSubmitting}
            />
          </div>
          </div>
        </form>

        {/* Footer */}
        <div className="px-6 py-4 flex flex-shrink-0 justify-end gap-2 bg-black/20">
          <button
            type="button"
            onClick={onClose}
            disabled={isSubmitting}
            className="h-9 px-4 flex items-center justify-center text-sm text-white/60 hover:text-white hover:bg-white/10 rounded-lg transition-colors"
          >
            {t('keys.modal_cancel')}
          </button>
          <button
            type="button"
            onClick={handleSubmit}
            disabled={isSubmitting}
            className="h-9 px-4 flex items-center justify-center gap-1.5 text-sm bg-white text-black hover:bg-white/90 rounded-lg font-medium shadow-sm transition-transform active:scale-95"
          >
            {isSubmitting ? (
              <>
                <div className="w-4 h-4 border-2 border-black/20 border-t-black rounded-full animate-spin" />
                {t('keys.modal_updating')}
              </>
            ) : (
              <>
                <Check className="w-4 h-4" />
                {t('keys.modal_update')}
              </>
            )}
          </button>
        </div>
      </div>
    </div>
  );
}

// Delete Confirmation Modal Component
interface DeleteConfirmModalProps {
  itemTitle: string;
  onConfirm: () => void;
  onCancel: () => void;
}

function DeleteConfirmModal({ itemTitle, onConfirm, onCancel }: DeleteConfirmModalProps) {
  const { t } = useTranslation();
  const [isDeleting, setIsDeleting] = useState(false);

  const handleConfirm = async () => {
    setIsDeleting(true);
    await onConfirm();
    setIsDeleting(false);
  };

  return (
    <div className="fixed inset-0 bg-black/70 backdrop-blur-sm flex items-center justify-center z-50 p-4">
      <div className="bg-slate-800 border border-red-500/30 rounded-2xl shadow-2xl w-full max-w-md">
        {/* Header */}
        <div className="px-6 py-4 border-b border-white/10">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-full bg-red-500/10 border border-red-500/20 flex items-center justify-center flex-shrink-0">
              <AlertCircle className="w-5 h-5 text-red-400" />
            </div>
            <div>
              <h3 className="text-lg font-bold text-white">{t('keys.delete_confirm_title')}</h3>
              <p className="text-sm text-white/60 mt-0.5">{t('keys.delete_confirm_subtitle')}</p>
            </div>
          </div>
        </div>

        {/* Content */}
        <div className="px-6 py-5">
          <p className="text-sm text-white/80">
            {t('keys.delete_confirm_message')}
          </p>
          <div className="mt-3 px-4 py-3 bg-white/5 border border-white/10 rounded-lg">
            <p className="text-sm font-medium text-white break-all">
              {itemTitle}
            </p>
          </div>
          <p className="text-xs text-red-400/80 mt-3">
            {t('keys.delete_warning')}
          </p>
        </div>

        {/* Footer */}
        <div className="px-6 py-4 border-t border-white/10 flex gap-3 justify-end">
          <button
            onClick={onCancel}
            disabled={isDeleting}
            className="px-4 py-2 text-sm text-white/70 hover:text-white hover:bg-white/10 rounded-lg transition-colors disabled:opacity-50"
          >
            {t('common.cancel')}
          </button>
          <button
            onClick={handleConfirm}
            disabled={isDeleting}
            className="px-4 py-2 text-sm bg-red-500 hover:bg-red-600 text-white font-medium rounded-lg transition-colors disabled:opacity-50 flex items-center gap-2"
          >
            {isDeleting ? (
              <>
                <div className="w-4 h-4 border-2 border-white/20 border-t-white rounded-full animate-spin" />
                {t('keys.deleting')}
              </>
            ) : (
              <>
                <Trash2 className="w-4 h-4" />
                {t('keys.delete_button')}
              </>
            )}
          </button>
        </div>
      </div>
    </div>
  );
}
