export type ChatMessage = {
  id: string;
  role: "system" | "user" | "assistant";
  content: string;
  createdAt?: string;
  sources?: ChatMessageSource[];
};

export type ChatMessageSource = {
  id: string;
  url: string;
  title?: string;
};

export type ChatThread = {
  id: string;
  title: string;
  messages: ChatMessage[];
  createdAt: string;
  updatedAt: string;
};

export type ChatSettings = {
  apiKey?: string;
  model: string;
  systemPrompt: string;
  temperature: number;
  serverTools: ServerToolSettings;
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

export const DEFAULT_SETTINGS: ChatSettings = {
  model: DEFAULT_MODEL,
  systemPrompt: "You are a concise, helpful assistant.",
  temperature: 0.7,
  serverTools: DEFAULT_SERVER_TOOLS,
};

export type ApiStatus = "checking" | "configured" | "missing" | "invalid" | "unknown";
