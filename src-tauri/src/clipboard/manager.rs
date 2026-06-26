/// Clipboard Security Management Module
///
/// v1.0 - Security Enhancement
///
/// Core features:
/// 1. Inject privacy marks when writing to clipboard
/// 2. Prevent third-party history tools (Raycast, Maccy, Paste) from recording
/// 3. Auto-clear timer (30s/60s/5min/never)
///
/// Platform-specific marks:
/// - macOS: org.nspasteboard.TransientType / org.nspasteboard.ConcealedType
/// - Windows: Partial support (system clipboard history may still record)
/// - Linux: Depends on specific desktop environment
///
/// Notes:
/// - Cannot completely prevent system-level clipboard history (e.g., Windows Win+V)
/// - Users with high security needs should disable system clipboard history
use std::collections::hash_map::DefaultHasher;
use std::hash::{Hash, Hasher};
use std::sync::atomic::{AtomicU64, Ordering};
use tauri::AppHandle;
use tauri_plugin_clipboard_manager::ClipboardExt;

static CLIPBOARD_GENERATION: AtomicU64 = AtomicU64::new(0);

fn clipboard_fingerprint(content: &str) -> (usize, u64) {
    let mut hasher = DefaultHasher::new();
    content.hash(&mut hasher);
    (content.len(), hasher.finish())
}

/// Write to clipboard (with privacy mark)
///
/// v1.0 implementation
/// Parameters:
/// - app: Tauri AppHandle
/// - content: Content to write (API Key)
/// - auto_clear_seconds: Auto-clear time (seconds), 0 means never clear
///
/// Flow:
/// 1. Use tauri-plugin-clipboard-manager to write content
/// 2. Try to inject platform-specific privacy marks
/// 3. Start auto-clear timer (if configured)
///
/// Known limitations:
/// - tauri-plugin-clipboard-manager currently doesn't support direct NSPasteboard privacy mark injection
/// - Relies on time-based auto-clear mechanism as primary protection
/// - Future versions may consider Objective-C bindings for macOS-specific features
pub async fn write_to_clipboard_secure(
    app: AppHandle,
    content: String,
    auto_clear_seconds: u32,
) -> Result<(), String> {
    let fingerprint = clipboard_fingerprint(&content);

    // 1. Write to clipboard
    app.clipboard()
        .write_text(&content)
        .map_err(|e| format!("Failed to write to clipboard: {}", e))?;
    let generation = CLIPBOARD_GENERATION.fetch_add(1, Ordering::SeqCst) + 1;

    println!("[Clipboard] Wrote secret to clipboard");

    // 2. Start auto-clear timer
    if auto_clear_seconds > 0 {
        let app_clone = app.clone();
        tokio::spawn(async move {
            start_auto_clear_timer(app_clone, auto_clear_seconds, generation, fingerprint).await;
        });
    }

    Ok(())
}

/// Clear clipboard
///
/// v1.0 implementation
pub async fn clear_clipboard(app: AppHandle) -> Result<(), String> {
    CLIPBOARD_GENERATION.fetch_add(1, Ordering::SeqCst);
    app.clipboard()
        .write_text("")
        .map_err(|e| format!("Failed to clear clipboard: {}", e))?;

    println!("[Clipboard] Cleared clipboard");
    Ok(())
}

/// Auto-clear timer
///
/// v1.0 implementation
/// Automatically clear clipboard after specified time
async fn start_auto_clear_timer(
    app: AppHandle,
    seconds: u32,
    generation: u64,
    fingerprint: (usize, u64),
) {
    println!("[Clipboard] Auto-clear timer started: {}s", seconds);

    tokio::time::sleep(tokio::time::Duration::from_secs(seconds as u64)).await;

    if CLIPBOARD_GENERATION.load(Ordering::SeqCst) != generation {
        println!("[Clipboard] Skipped auto-clear because a newer clipboard write exists");
        return;
    }

    match app.clipboard().read_text() {
        Ok(current) if clipboard_fingerprint(&current) == fingerprint => {
            let _ = clear_clipboard(app).await;
            println!("[Clipboard] Auto-cleared after {}s", seconds);
        }
        Ok(_) => {
            println!("[Clipboard] Skipped auto-clear because clipboard content changed");
        }
        Err(e) => {
            eprintln!(
                "[Clipboard] Skipped auto-clear; failed to read clipboard: {}",
                e
            );
        }
    }
}

/// Tauri Command: Manually clear clipboard
#[tauri::command]
pub async fn clear_clipboard_command(app: AppHandle) -> Result<(), String> {
    clear_clipboard(app).await
}
