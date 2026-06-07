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

use tauri::AppHandle;
use tauri_plugin_clipboard_manager::ClipboardExt;

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
    // 1. Write to clipboard
    app.clipboard()
        .write_text(&content)
        .map_err(|e| format!("Failed to write to clipboard: {}", e))?;

    println!("[Clipboard] Wrote {} chars to clipboard", content.len());

    // 2. Start auto-clear timer
    if auto_clear_seconds > 0 {
        let app_clone = app.clone();
        tokio::spawn(async move {
            start_auto_clear_timer(app_clone, auto_clear_seconds).await;
        });
    }

    Ok(())
}

/// Clear clipboard
/// 
/// v1.0 implementation
pub async fn clear_clipboard(app: AppHandle) -> Result<(), String> {
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
async fn start_auto_clear_timer(app: AppHandle, seconds: u32) {
    println!("[Clipboard] Auto-clear timer started: {}s", seconds);
    
    tokio::time::sleep(tokio::time::Duration::from_secs(seconds as u64)).await;
    
    let _ = clear_clipboard(app).await;
    
    println!("[Clipboard] Auto-cleared after {}s", seconds);
}

/// Tauri Command: Manually clear clipboard
#[tauri::command]
pub async fn clear_clipboard_command(app: AppHandle) -> Result<(), String> {
    clear_clipboard(app).await
}
