export type ChatMessage = {
  id: string;
  role: "system" | "user" | "assistant";
  content: string;
  createdAt?: string;
  sources?: ChatMessageSource[];
  attachments?: ChatAttachment[];
  files?: ChatGeneratedFile[];
  reasoning?: string;
  usage?: ChatMessageUsage;
};

export type ChatMessageUsage = {
  inputTokens?: number;
  outputTokens?: number;
  cachedTokens?: number;
  cacheWriteTokens?: number;
};

export type ChatMessageSource = {
  id: string;
  url: string;
  title?: string;
};

export type ChatAttachmentKind = "image" | "pdf";

export type ChatAttachment = {
  id: string;
  name: string;
  mediaType: string;
  size: number;
  dataUrl: string;
  kind: ChatAttachmentKind;
};

export type ChatGeneratedFile = {
  id: string;
  mediaType: string;
  dataUrl: string;
  name?: string;
};

export type ChatThread = {
  id: string;
  title: string;
  messages: ChatMessage[];
  createdAt: string;
  updatedAt: string;
  starred?: boolean;
};

export type ChatSettings = {
  apiKey?: string;
  model: string;
  systemPrompt: string;
  temperature: number;
  serverTools: ServerToolSettings;
  multimodal: MultimodalSettings;
  messageTransforms: MessageTransformSettings;
  responseCaching: ResponseCachingSettings;
  reasoning: ReasoningSettings;
  providerRouting: ProviderRoutingSettings;
};

export type SearchEngine = "auto" | "native" | "exa" | "firecrawl" | "parallel" | "perplexity";
export type FetchEngine = "auto" | "native" | "exa" | "openrouter" | "firecrawl" | "parallel";
export type SearchContextSize = "auto" | "low" | "medium" | "high";

export type ServerToolSettings = {
  webSearch: {
    enabled: boolean;
    engine: SearchEngine;
    maxResults: number;
    maxTotalResults: number;
    searchContextSize: SearchContextSize;
    allowedDomains: string[];
    excludedDomains: string[];
  };
  webFetch: {
    enabled: boolean;
    engine: FetchEngine;
    maxUses: number;
    maxContentTokens: number;
    allowedDomains: string[];
    blockedDomains: string[];
  };
  datetime: {
    enabled: boolean;
    timezone: string;
  };
};

export type ImageGenerationMode = "text-and-image" | "image-only";

export type MultimodalSettings = {
  imageGeneration: {
    enabled: boolean;
    mode: ImageGenerationMode;
    aspectRatio: string;
  };
  pdfEngine: "auto" | "cloudflare-ai" | "mistral-ocr" | "native";
};

export type MessageTransformSettings = {
  contextCompression: {
    enabled: boolean;
  };
};

export type ResponseCachingSettings = {
  enabled: boolean;
  ttlSeconds: number;
};

export type ReasoningEffort = "xhigh" | "high" | "medium" | "low" | "minimal" | "none";

export type ReasoningSettings = {
  enabled: boolean;
  effort: ReasoningEffort;
  exclude: boolean;
};

export type ProviderSort = "default" | "price" | "throughput" | "latency";

export type ProviderRoutingSettings = {
  providerSort: ProviderSort;
  dataCollectionDeny: boolean;
};

export type OpenRouterModel = {
  id: string;
  name: string;
  contextLength: number | null;
  created?: number;
  pricing: {
    prompt?: string;
    completion?: string;
    request?: string;
    image?: string;
    webSearch?: string;
  };
  architecture: {
    modality?: string;
    inputModalities: string[];
    outputModalities: string[];
    tokenizer?: string | null;
  };
  topProvider?: {
    contextLength?: number | null;
    maxCompletionTokens?: number | null;
    isModerated?: boolean | null;
  };
};

export const DEFAULT_MODEL = "openai/gpt-5-mini";

export const DEFAULT_SERVER_TOOLS: ServerToolSettings = {
  webSearch: {
    enabled: false,
    engine: "auto",
    maxResults: 5,
    maxTotalResults: 15,
    searchContextSize: "auto",
    allowedDomains: [],
    excludedDomains: [],
  },
  webFetch: {
    enabled: false,
    engine: "auto",
    maxUses: 5,
    maxContentTokens: 50000,
    allowedDomains: [],
    blockedDomains: [],
  },
  datetime: {
    enabled: false,
    timezone: "America/New_York",
  },
};

export const DEFAULT_MULTIMODAL_SETTINGS: MultimodalSettings = {
  imageGeneration: {
    enabled: false,
    mode: "text-and-image",
    aspectRatio: "auto",
  },
  pdfEngine: "auto",
};

export const DEFAULT_MESSAGE_TRANSFORMS: MessageTransformSettings = {
  contextCompression: {
    enabled: true,
  },
};

export const DEFAULT_RESPONSE_CACHING: ResponseCachingSettings = {
  enabled: false,
  ttlSeconds: 300,
};

export const DEFAULT_REASONING: ReasoningSettings = {
  enabled: false,
  effort: "medium",
  exclude: false,
};

export const DEFAULT_PROVIDER_ROUTING: ProviderRoutingSettings = {
  providerSort: "default",
  dataCollectionDeny: false,
};

export const DEFAULT_SETTINGS: ChatSettings = {
  model: DEFAULT_MODEL,
  systemPrompt: "You are a concise, helpful assistant.",
  temperature: 0.7,
  serverTools: DEFAULT_SERVER_TOOLS,
  multimodal: DEFAULT_MULTIMODAL_SETTINGS,
  messageTransforms: DEFAULT_MESSAGE_TRANSFORMS,
  responseCaching: DEFAULT_RESPONSE_CACHING,
  reasoning: DEFAULT_REASONING,
  providerRouting: DEFAULT_PROVIDER_ROUTING,
};

export type ApiStatus = "checking" | "configured" | "missing" | "invalid" | "unknown";
