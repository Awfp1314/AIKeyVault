import { 
  Brain, 
  Sparkles, 
  Cloud, 
  Layers, 
  Package,
  Zap,
  Code,
  Cpu,
  Gem,
  Key,
  Mountain,
  Rocket,
  Shield,
  Star,
  Wind
} from "lucide-react";

interface ProviderIconProps {
  provider: string; // v1.0 改为 string 以接受任�?provider_id
  className?: string;
}

/**
 * 🎨 ProviderIcon
 * 
 * AI Provider Logo 组件
 * 
 * 【Phase 7 - 降级策略�?
 * 用户目前尚未收集官方 SVG 图标，使�?Lucide React 图标作为优雅降级方案
 * 
 * 映射策略�?
 * - openai / gpt �?Sparkles（✨ 闪光�?
 * - anthropic / claude �?Brain（�?大脑�?
 * - google / gemini �?Gem（�?宝石�?
 * - azure / microsoft �?Cloud（☁�?云）
 * - deepseek �?Mountain（⛰�?深海探索�?
 * - openrouter �?Rocket（🚀 路由�?
 * - cohere �?Layers（层叠）
 * - huggingface �?Package（包�?
 * - replicate �?Zap（⚡ 闪电�?
 * - aws / bedrock �?Shield（盾牌）
 * - siliconflow �?Wind（�?流动�?
 * - custom / other �?Key（�?钥匙�?
 * 
 * 未来可替换为真实 SVG Logo
 */
export function ProviderIcon({ provider, className = "w-5 h-5" }: ProviderIconProps) {
  const iconProps = {
    className: `${className} flex-shrink-0`,
    strokeWidth: 1.5,
  };

  // 统一转小写进行匹配（容错�?
  const providerLower = provider.toLowerCase();

  // OpenAI 系列
  if (providerLower.includes('openai') || providerLower.includes('gpt')) {
    return <Sparkles {...iconProps} className={`${iconProps.className} text-emerald-500`} />;
  }
  
  // Anthropic 系列
  if (providerLower.includes('anthropic') || providerLower.includes('claude')) {
    return <Brain {...iconProps} className={`${iconProps.className} text-orange-500`} />;
  }
  
  // Google 系列
  if (providerLower.includes('google') || providerLower.includes('gemini') || providerLower.includes('palm')) {
    return <Gem {...iconProps} className={`${iconProps.className} text-blue-500`} />;
  }
  
  // Azure / Microsoft 系列
  if (providerLower.includes('azure') || providerLower.includes('microsoft')) {
    return <Cloud {...iconProps} className={`${iconProps.className} text-cyan-500`} />;
  }
  
  // DeepSeek 系列
  if (providerLower.includes('deepseek')) {
    return <Mountain {...iconProps} className={`${iconProps.className} text-indigo-600`} />;
  }
  
  // OpenRouter
  if (providerLower.includes('openrouter') || providerLower.includes('router')) {
    return <Rocket {...iconProps} className={`${iconProps.className} text-violet-500`} />;
  }
  
  // Cohere
  if (providerLower.includes('cohere')) {
    return <Layers {...iconProps} className={`${iconProps.className} text-purple-500`} />;
  }
  
  // HuggingFace
  if (providerLower.includes('huggingface') || providerLower.includes('hugging')) {
    return <Package {...iconProps} className={`${iconProps.className} text-yellow-500`} />;
  }
  
  // Replicate
  if (providerLower.includes('replicate')) {
    return <Zap {...iconProps} className={`${iconProps.className} text-pink-500`} />;
  }
  
  // AWS Bedrock
  if (providerLower.includes('aws') || providerLower.includes('bedrock')) {
    return <Shield {...iconProps} className={`${iconProps.className} text-orange-600`} />;
  }
  
  // SiliconFlow
  if (providerLower.includes('silicon') || providerLower.includes('flow')) {
    return <Wind {...iconProps} className={`${iconProps.className} text-sky-400`} />;
  }
  
  // Mistral AI
  if (providerLower.includes('mistral')) {
    return <Star {...iconProps} className={`${iconProps.className} text-red-500`} />;
  }
  
  // 中文 AI 服务�?
  if (providerLower.includes('baidu') || providerLower.includes('wenxin') || providerLower.includes('文心')) {
    return <Cpu {...iconProps} className={`${iconProps.className} text-blue-600`} />;
  }
  
  if (providerLower.includes('alibaba') || providerLower.includes('qwen') || providerLower.includes('通义') || providerLower.includes('百炼')) {
    return <Cloud {...iconProps} className={`${iconProps.className} text-orange-500`} />;
  }
  
  if (providerLower.includes('tencent') || providerLower.includes('hunyuan') || providerLower.includes('混元')) {
    return <Layers {...iconProps} className={`${iconProps.className} text-blue-500`} />;
  }
  
  if (providerLower.includes('moonshot') || providerLower.includes('kimi')) {
    return <Star {...iconProps} className={`${iconProps.className} text-purple-400`} />;
  }
  
  if (providerLower.includes('zhipu') || providerLower.includes('智谱') || providerLower.includes('glm')) {
    return <Brain {...iconProps} className={`${iconProps.className} text-green-500`} />;
  }
  
  // 火山引擎
  if (providerLower.includes('volcengine') || providerLower.includes('doubao') || providerLower.includes('豆包')) {
    return <Mountain {...iconProps} className={`${iconProps.className} text-red-600`} />;
  }
  
  // Custom / Other
  if (providerLower.includes('custom') || providerLower.includes('other')) {
    return <Code {...iconProps} className={`${iconProps.className} text-gray-500`} />;
  }
  
  // 默认图标（未识别�?Provider�?
  return <Key {...iconProps} className={`${iconProps.className} text-gray-400`} />;
}
