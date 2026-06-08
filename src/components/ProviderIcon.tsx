import { Key } from "lucide-react";
import { OpenAIIcon } from "./icons/providers/OpenAIIcon";
import { AnthropicIcon } from "./icons/providers/AnthropicIcon";
import { GoogleIcon } from "./icons/providers/GoogleIcon";
import { GoogleGeminiIcon } from "./icons/providers/GoogleGeminiIcon";
import { DeepSeekIcon } from "./icons/providers/DeepSeekIcon";
import { MistralIcon } from "./icons/providers/MistralIcon";
import { GroqIcon } from "./icons/providers/GroqIcon";
import { CohereIcon } from "./icons/providers/CohereIcon";
import { AlibabaIcon } from "./icons/providers/AlibabaIcon";
import { QwenIcon } from "./icons/providers/QwenIcon";
import { ByteDanceIcon } from "./icons/providers/ByteDanceIcon";
import { MinimaxIcon } from "./icons/providers/MinimaxIcon";
import { MoonshotIcon } from "./icons/providers/MoonshotIcon";
import { ZhipuIcon } from "./icons/providers/ZhipuIcon";
import { BaichuanIcon } from "./icons/providers/BaichuanIcon";
import { BaiduIcon } from "./icons/providers/BaiduIcon";
import { TencentIcon } from "./icons/providers/TencentIcon";
import { MicrosoftIcon } from "./icons/providers/MicrosoftIcon";
import { AmazonIcon } from "./icons/providers/AmazonIcon";
import { MetaIcon } from "./icons/providers/MetaIcon";
import { NvidiaIcon } from "./icons/providers/NvidiaIcon";
import { OllamaIcon } from "./icons/providers/OllamaIcon";
import { LmStudioIcon } from "./icons/providers/LmStudioIcon";
import { OpenRouterIcon } from "./icons/providers/OpenRouterIcon";
import { SiliconFlowIcon } from "./icons/providers/SiliconFlowIcon";
import { XaiIcon } from "./icons/providers/XaiIcon";
import { HuggingFaceIcon } from "./icons/providers/HuggingFaceIcon";

interface ProviderIconProps {
  provider: string;
  className?: string;
}

/**
 * ProviderIcon - 使用官方 SVG Logo（来自 Simple Icons / LobeHub Icons）
 *
 * 匹配策略：
 * 1. 精确匹配 provider_id → 官方 SVG
 * 2. 关键词模糊匹配 → 官方 SVG（容错用户输入）
 * 3. 未匹配 → Key 图标（降级）
 */
export function ProviderIcon({ provider, className = "w-5 h-5" }: ProviderIconProps) {
  const cn = `${className} flex-shrink-0`;
  const lower = provider.toLowerCase();

  // ── Anthropic ──
  if (lower.includes("anthropic") || lower.includes("claude")) {
    return <AnthropicIcon className={`${cn} text-[#191919] dark:text-white`} />;
  }

  // ── OpenAI ──
  if (lower.includes("openai") || lower.includes("gpt") || lower.includes("chatgpt")) {
    return <OpenAIIcon className={`${cn} text-black dark:text-white`} />;
  }

  // ── Google / Gemini ──
  if (lower.includes("gemini")) {
    return <GoogleGeminiIcon className={`${cn} text-[#8E75B2]`} />;
  }
  if (lower.includes("google") || lower.includes("palm")) {
    return <GoogleIcon className={`${cn} text-[#4285F4]`} />;
  }

  // ── DeepSeek ──
  if (lower.includes("deepseek")) {
    return <DeepSeekIcon className={`${cn} text-[#5786FE]`} />;
  }

  // ── xAI / Grok ──
  if (lower.includes("xai") || lower.includes("grok")) {
    return <XaiIcon className={`${cn} text-black dark:text-white`} />;
  }

  // ── Mistral AI ──
  if (lower.includes("mistral")) {
    return <MistralIcon className={`${cn} text-[#FA520F]`} />;
  }

  // ── Groq ──
  if (lower.includes("groq")) {
    return <GroqIcon className={`${cn} text-[#F55036]`} />;
  }

  // ── Cohere ──
  if (lower.includes("cohere")) {
    return <CohereIcon className={`${cn} text-[#39594D] dark:text-[#D6F4E4]`} />;
  }

  // ── Alibaba / Qwen / 百炼 ──
  if (lower.includes("qwen") || lower.includes("通义") || lower.includes("百炼")) {
    return <QwenIcon className={`${cn} text-[#6950EF]`} />;
  }
  if (lower.includes("alibaba")) {
    return <AlibabaIcon className={`${cn} text-[#FF6A00]`} />;
  }

  // ── ByteDance / 火山引擎 / 豆包 ──
  if (lower.includes("volcengine") || lower.includes("doubao") || lower.includes("豆包") || lower.includes("bytedance")) {
    return <ByteDanceIcon className={`${cn} text-[#3C8CFF]`} />;
  }

  // ── MiniMax ──
  if (lower.includes("minimax")) {
    return <MinimaxIcon className={`${cn} text-[#E73562]`} />;
  }

  // ── Moonshot / Kimi ──
  if (lower.includes("moonshot") || lower.includes("kimi")) {
    return <MoonshotIcon className={`${cn} text-black dark:text-white`} />;
  }

  // ── 智谱 / GLM ──
  if (lower.includes("zhipu") || lower.includes("智谱") || lower.includes("glm")) {
    return <ZhipuIcon className={`${cn} text-[#1677FF]`} />;
  }

  // ── Baichuan ──
  if (lower.includes("baichuan") || lower.includes("百川")) {
    return <BaichuanIcon className={`${cn} text-black dark:text-white`} />;
  }

  // ── Baidu / 文心 ──
  if (lower.includes("baidu") || lower.includes("wenxin") || lower.includes("文心")) {
    return <BaiduIcon className={`${cn} text-[#2932E1]`} />;
  }

  // ── Tencent / 混元 ──
  if (lower.includes("tencent") || lower.includes("hunyuan") || lower.includes("混元")) {
    return <TencentIcon className={`${cn} text-[#006EFF]`} />;
  }

  // ── Microsoft / Azure ──
  if (lower.includes("microsoft") || lower.includes("azure")) {
    return <MicrosoftIcon className={`${cn} text-[#00A4EF]`} />;
  }

  // ── Amazon / AWS / Bedrock ──
  if (lower.includes("amazon") || lower.includes("aws") || lower.includes("bedrock")) {
    return <AmazonIcon className={`${cn} text-[#FF9900]`} />;
  }

  // ── Meta ──
  if (lower.includes("meta")) {
    return <MetaIcon className={`${cn} text-[#0467DF]`} />;
  }

  // ── NVIDIA ──
  if (lower.includes("nvidia")) {
    return <NvidiaIcon className={`${cn} text-[#76B900]`} />;
  }

  // ── Ollama ──
  if (lower.includes("ollama")) {
    return <OllamaIcon className={`${cn} text-black dark:text-white`} />;
  }

  // ── LM Studio ──
  if (lower.includes("lmstudio") || lower.includes("lm studio")) {
    return <LmStudioIcon className={`${cn} text-black dark:text-white`} />;
  }

  // ── OpenRouter ──
  if (lower.includes("openrouter")) {
    return <OpenRouterIcon className={`${cn} text-[#94A3B8]`} />;
  }

  // ── SiliconFlow / 硅基流动 ──
  if (lower.includes("silicon") && (lower.includes("flow") || lower.includes("cloud") || lower.includes("硅基"))) {
    return <SiliconFlowIcon className={`${cn} text-[#7B5CFD]`} />;
  }

  // ── HuggingFace ──
  if (lower.includes("huggingface") || lower.includes("hugging")) {
    return <HuggingFaceIcon className={`${cn} text-[#FFD21E]`} />;
  }

  // ── Replicate ── (no official SVG yet, keep Lucide)
  if (lower.includes("replicate")) {
    return <Key className={`${cn} text-pink-500`} strokeWidth={1.5} />;
  }

  // ── Custom / Other ──
  if (lower.includes("custom") || lower.includes("other")) {
    return <Key className={`${cn} text-gray-500`} strokeWidth={1.5} />;
  }

  // 默认降级：未识别 provider
  return <Key className={`${cn} text-gray-400`} strokeWidth={1.5} />;
}
