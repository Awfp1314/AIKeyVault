import { useEffect, useCallback, useRef } from "react";
import { invoke } from "@tauri-apps/api/core";

/**
 * 心跳机制 Hook
 * 
 * 【Phase 5.2�?
 * 用于续期自动锁定倒计�?
 * 
 * 【节流策略�?
 * - 限制为每 5 秒最多触发一�?
 * - 监听全局鼠标和键盘事�?
 * - 自动调用 Rust 端的 heartbeat 命令
 */
export function useHeartbeat() {
  const lastHeartbeatRef = useRef<number>(0);
  const THROTTLE_INTERVAL = 5000; // 5 �?

  const sendHeartbeat = useCallback(async () => {
    const now = Date.now();
    const elapsed = now - lastHeartbeatRef.current;

    // 节流�? 秒内只发送一�?
    if (elapsed < THROTTLE_INTERVAL) {
      return;
    }

    lastHeartbeatRef.current = now;

    try {
      await invoke("heartbeat");
    } catch (err) {
      console.error("[Heartbeat] Failed:", err);
    }
  }, []);

  useEffect(() => {
    // 监听用户活动（鼠标移动、键盘按下、点击）
    const handleActivity = () => {
      sendHeartbeat();
    };

    window.addEventListener("mousemove", handleActivity);
    window.addEventListener("keydown", handleActivity);
    window.addEventListener("click", handleActivity);

    // 初始心跳
    sendHeartbeat();

    return () => {
      window.removeEventListener("mousemove", handleActivity);
      window.removeEventListener("keydown", handleActivity);
      window.removeEventListener("click", handleActivity);
    };
  }, [sendHeartbeat]);
}
