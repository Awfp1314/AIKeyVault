import { useEffect } from "react";
import { Check, X, AlertCircle, Info } from "lucide-react";

export type ToastType = "success" | "error" | "warning" | "info";

export interface ToastProps {
  message: string;
  type?: ToastType;
  duration?: number;
  onClose: () => void;
}

/**
 * 🎉 Toast Notification Component
 * 
 * Elegant glassmorphism-styled toast notification
 * 
 * Features:
 * - Auto-dismiss after duration
 * - Smooth slide-in animation from top
 * - Icon based on toast type
 * - Matches app's glassmorphism aesthetic
 */
export function Toast({ message, type = "success", duration = 2000, onClose }: ToastProps) {
  useEffect(() => {
    const timer = setTimeout(() => {
      onClose();
    }, duration);

    return () => clearTimeout(timer);
  }, [duration, onClose]);

  const getIcon = () => {
    switch (type) {
      case "success":
        return <Check className="w-5 h-5 text-green-400" />;
      case "error":
        return <X className="w-5 h-5 text-red-400" />;
      case "warning":
        return <AlertCircle className="w-5 h-5 text-amber-400" />;
      case "info":
        return <Info className="w-5 h-5 text-blue-400" />;
    }
  };

  const getBorderColor = () => {
    switch (type) {
      case "success":
        return "border-green-500/30";
      case "error":
        return "border-red-500/30";
      case "warning":
        return "border-amber-500/30";
      case "info":
        return "border-blue-500/30";
    }
  };

  const getGlowColor = () => {
    switch (type) {
      case "success":
        return "shadow-green-500/20";
      case "error":
        return "shadow-red-500/20";
      case "warning":
        return "shadow-amber-500/20";
      case "info":
        return "shadow-blue-500/20";
    }
  };

  return (
    <div
      className={`
        fixed top-6 left-1/2 -translate-x-1/2 z-50
        flex items-center gap-3
        px-5 py-3
        rounded-xl
        border ${getBorderColor()}
        shadow-2xl ${getGlowColor()}
        animate-slide-in
      `}
      style={{
        background: 'rgba(20, 20, 30, 0.95)',
        backdropFilter: 'blur(40px) saturate(150%)',
        WebkitBackdropFilter: 'blur(40px) saturate(150%)',
        boxShadow: 'inset 0 1px 0 0 rgba(255, 255, 255, 0.1), 0 10px 30px rgba(0, 0, 0, 0.4)',
      }}
    >
      {/* Icon */}
      <div className="flex-shrink-0">
        {getIcon()}
      </div>

      {/* Message */}
      <p className="text-sm font-medium text-white/90">
        {message}
      </p>

      {/* Close Button */}
      <button
        onClick={onClose}
        className="flex-shrink-0 text-white/40 hover:text-white/70 transition-colors"
      >
        <X className="w-4 h-4" />
      </button>
    </div>
  );
}
