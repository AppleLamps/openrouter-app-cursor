export type ChatMessage = {
  id: string;
  role: "system" | "user" | "assistant";
  content: string;
  createdAt?: string;
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

export const DEFAULT_SETTINGS: ChatSettings = {
  model: DEFAULT_MODEL,
  systemPrompt: "You are a concise, helpful assistant.",
  temperature: 0.7,
};

export type ApiStatus = "checking" | "configured" | "missing" | "invalid" | "unknown";
