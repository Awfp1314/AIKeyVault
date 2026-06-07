import { useState, useRef, useEffect, useCallback } from "react";
import { Search, ChevronDown } from "lucide-react";
import { ProviderIcon } from "./ProviderIcon";

interface ProviderOption {
  value: string;
  label: string;
}

const PROVIDERS: ProviderOption[] = [
  { value: "anthropic", label: "Anthropic" },
  { value: "openai", label: "OpenAI" },
  { value: "google", label: "Google" },
  { value: "deepseek", label: "DeepSeek" },
  { value: "xai", label: "xAI" },
  { value: "mistral", label: "Mistral AI" },
  { value: "groq", label: "Groq" },
  { value: "cohere", label: "Cohere" },
  { value: "alibaba", label: "Alibaba" },
  { value: "bytedance", label: "ByteDance" },
  { value: "minimax", label: "MiniMax" },
  { value: "moonshot", label: "Moonshot AI" },
  { value: "zhipu", label: "Zhipu AI" },
  { value: "baichuan", label: "Baichuan" },
  { value: "baidu", label: "Baidu" },
  { value: "tencent", label: "Tencent" },
  { value: "microsoft", label: "Microsoft" },
  { value: "amazon", label: "Amazon" },
  { value: "meta", label: "Meta" },
  { value: "nvidia", label: "NVIDIA" },
  { value: "ollama", label: "Ollama" },
  { value: "lmstudio", label: "LM Studio" },
  { value: "openrouter", label: "OpenRouter" },
  { value: "siliconflow", label: "SiliconFlow" },
];

interface ProviderSelectProps {
  value: string;
  onChange: (value: string) => void;
  disabled?: boolean;
  className?: string;
}

export function ProviderSelect({ value, onChange, disabled, className }: ProviderSelectProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [search, setSearch] = useState("");
  const [highlightIndex, setHighlightIndex] = useState(-1);
  const containerRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const listRef = useRef<HTMLUListElement>(null);

  const filtered = search.trim()
    ? PROVIDERS.filter(
        (p) =>
          p.label.toLowerCase().includes(search.toLowerCase()) ||
          p.value.toLowerCase().includes(search.toLowerCase())
      )
    : PROVIDERS;

  // 搜索变化时重置高亮
  useEffect(() => {
    setHighlightIndex(-1);
  }, [search]);

  // 外部点击关闭
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setIsOpen(false);
        setSearch("");
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  // 选中后自动滚动到可见区域
  useEffect(() => {
    if (highlightIndex >= 0 && listRef.current) {
      const items = listRef.current.querySelectorAll("[data-option]");
      if (items[highlightIndex]) {
        items[highlightIndex].scrollIntoView({ block: "nearest" });
      }
    }
  }, [highlightIndex]);

  const selectOption = useCallback(
    (option: ProviderOption) => {
      onChange(option.value);
      setSearch("");
      setIsOpen(false);
      inputRef.current?.blur();
    },
    [onChange]
  );

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (!isOpen) {
      if (e.key === "ArrowDown" || e.key === "Enter") {
        setIsOpen(true);
        e.preventDefault();
      }
      return;
    }

    switch (e.key) {
      case "ArrowDown":
        e.preventDefault();
        setHighlightIndex((prev) =>
          prev < filtered.length - 1 ? prev + 1 : 0
        );
        break;
      case "ArrowUp":
        e.preventDefault();
        setHighlightIndex((prev) =>
          prev > 0 ? prev - 1 : filtered.length - 1
        );
        break;
      case "Enter":
        e.preventDefault();
        if (highlightIndex >= 0 && highlightIndex < filtered.length) {
          selectOption(filtered[highlightIndex]);
        } else {
          // 无匹配时支持自由输入
          onChange(search.trim() || value);
          setIsOpen(false);
          setSearch("");
        }
        break;
      case "Escape":
        setIsOpen(false);
        setSearch("");
        break;
    }
  };

  const currentLabel =
    PROVIDERS.find((p) => p.value === value)?.label || value || "搜索或输入供应商...";

  return (
    <div ref={containerRef} className={`relative ${className ?? ""}`}>
      {/* 输入框 */}
      <div className="relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-white/30 pointer-events-none" />
        <input
          ref={inputRef}
          type="text"
          value={isOpen ? search : currentLabel}
          onChange={(e) => {
            setSearch(e.target.value);
            if (!isOpen) setIsOpen(true);
          }}
          onFocus={() => {
            setIsOpen(true);
            setSearch("");
          }}
          onKeyDown={handleKeyDown}
          placeholder="搜索或输入供应商..."
          disabled={disabled}
          className="w-full h-9 px-3 pl-10 pr-10 bg-black/40 border border-white/5 rounded-lg text-sm text-white placeholder:text-white/30 focus:outline-none focus:border-white/20 focus:ring-1 focus:ring-white/20 transition-colors duration-150 disabled:opacity-50 disabled:cursor-not-allowed"
          autoComplete="off"
          role="combobox"
          aria-expanded={isOpen}
          aria-haspopup="listbox"
        />
        <button
          type="button"
          tabIndex={-1}
          onClick={() => {
            if (!disabled) {
              setIsOpen((prev) => !prev);
              if (!isOpen) {
                setSearch("");
                setTimeout(() => inputRef.current?.focus(), 0);
              }
            }
          }}
          className="absolute right-2 top-1/2 -translate-y-1/2 p-1 rounded text-white/40 hover:text-white/70 transition-colors"
        >
          <ChevronDown
            className={`w-4 h-4 transition-transform duration-200 ${isOpen ? "rotate-180" : ""}`}
          />
        </button>
      </div>

      {/* 下拉列表 */}
      {isOpen && (
        <div className="absolute z-50 mt-1 w-full rounded-lg bg-slate-800/90 backdrop-blur-2xl shadow-2xl overflow-hidden">
          <ul
            ref={listRef}
            role="listbox"
            className="max-h-64 overflow-y-auto [scrollbar-width:none] py-1"
          >
            {filtered.length === 0 ? (
              <li className="px-4 py-2 text-xs text-white/40 text-center">
                无匹配结果 — 按 Enter 使用 &quot;{search}&quot;
              </li>
            ) : (
              filtered.map((option, idx) => {
                const isHighlighted = idx === highlightIndex;
                return (
                  <li
                    key={option.value}
                    data-option="true"
                    role="option"
                    aria-selected={option.value === value}
                    onClick={() => selectOption(option)}
                    onMouseEnter={() => setHighlightIndex(idx)}
                    className={`flex items-center gap-3 px-4 py-2 cursor-pointer text-sm transition-colors
                      ${isHighlighted
                        ? "bg-white/10 text-white"
                        : "text-white/80 hover:bg-white/5"
                      }
                      ${option.value === value ? "bg-white/5" : ""}
                    `}
                  >
                    <ProviderIcon provider={option.value} className="w-5 h-5" />
                    <span className="flex-1 truncate">{option.label}</span>
                    {option.value === value && (
                      <span className="text-white/60 text-xs">✓</span>
                    )}
                  </li>
                );
              })
            )}
          </ul>
        </div>
      )}
    </div>
  );
}