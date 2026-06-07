import { memo } from "react";
import { useTranslation } from "react-i18next";
import { CornerDownLeft } from "lucide-react";
import { ProviderIcon } from "./ProviderIcon";
import type { SearchResult } from "../types";

interface VaultItemRowProps {
  item: SearchResult;
  index: number;
  isSelected: boolean;
  onClick: () => void;
  onHover: () => void;
}

/**
 * 🎯 VaultItemRow
 * 
 * 单个 Vault 项目行组�?
 * 
 * 【设计细节�?
 * - 选中态：微光高亮背景 + 左侧边框强调
 * - Hover 态：Enter 复制提示渐显
 * - 布局：Logo + Title/Tags + Copy Hint
 */
export const VaultItemRow = memo(function VaultItemRow({
  item,
  index,
  isSelected,
  onClick,
  onHover,
}: VaultItemRowProps) {
  const { t } = useTranslation();
  return (
    <div
      data-item-index={index}
      role="option"
      aria-selected={isSelected}
      onClick={onClick}
      onMouseEnter={onHover}
      className={`
        group relative
        flex items-center justify-between
        px-4 py-3
        border-b border-white/5
        cursor-default
        transition-colors
        ${
          isSelected
            ? "bg-white/10"
            : "hover:bg-white/10"
        }
      `}
    >
      {/* Left: Provider Icon */}
      <div className="flex-shrink-0">
        <ProviderIcon provider={item.provider_id} className="w-6 h-6" />
      </div>

      {/* Center: Title + Provider + Tags + Note */}
      <div className="flex-1 min-w-0 ml-3">
        <div className="flex items-center gap-2 mb-1">
          <h3 className="text-sm font-medium text-white/90 truncate">
            {item.title}
          </h3>
          <span className="text-xs text-white/40 flex-shrink-0">
            {item.provider_id}
          </span>
        </div>

        {item.tags && (
          <div className="flex gap-1.5 flex-wrap mb-1">
            {item.tags.split(',').slice(0, 3).map((tag) => (
              <span
                key={tag}
                className="
                  px-2 py-0.5
                  bg-white/10
                  border border-white/5
                  rounded-md
                  text-[10px] font-medium text-white/60
                "
              >
                {tag.trim()}
              </span>
            ))}
            {item.tags.split(',').length > 3 && (
              <span className="text-xs text-white/40">
                +{item.tags.split(',').length - 3}
              </span>
            )}
          </div>
        )}

        {item.note && (
          <p className="text-xs text-white/50 truncate mt-0.5">
            {item.note}
          </p>
        )}
      </div>

      {/* Right: Copy Hint (visible on hover/select) */}
      <div
        className={`
          flex items-center gap-1.5 text-xs text-white/60
          transition-opacity duration-200
          ${isSelected ? "opacity-100" : "opacity-0 group-hover:opacity-70"}
        `}
      >
        <CornerDownLeft className="w-3.5 h-3.5" />
        <span>{t('common.copy')}</span>
      </div>
    </div>
  );
});
