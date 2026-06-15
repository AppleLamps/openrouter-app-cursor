import {
  DEFAULT_MODEL,
  DEFAULT_MESSAGE_TRANSFORMS,
  DEFAULT_MULTIMODAL_SETTINGS,
  DEFAULT_RESPONSE_CACHING,
  DEFAULT_SERVER_TOOLS,
  DEFAULT_SETTINGS,
  type ChatAttachment,
  type ChatGeneratedFile,
  type ChatMessage,
  type ChatSettings,
  type ChatThread,
  type FetchEngine,
  type SearchContextSize,
  type SearchEngine,
  type ServerToolSettings,
} from "@/lib/types";

const MESSAGES_KEY = "openrouter-chat:messages:v1";
const SETTINGS_KEY = "openrouter-chat:settings:v1";
const THREADS_KEY = "openrouter-chat:threads:v1";
const ACTIVE_THREAD_KEY = "openrouter-chat:active-thread-id:v1";

function canUseStorage() {
  return typeof window !== "undefined" && typeof window.localStorage !== "undefined";
}

function isChatMessage(value: unknown): value is ChatMessage {
  if (!value || typeof value !== "object") {
    return false;
  }

  const message = value as Partial<ChatMessage>;
  const sources = (message as { sources?: unknown }).sources;
  const attachments = (message as { attachments?: unknown }).attachments;
  const files = (message as { files?: unknown }).files;
  return (
    typeof message.id === "string" &&
    (message.role === "system" || message.role === "user" || message.role === "assistant") &&
    typeof message.content === "string" &&
    (message.createdAt === undefined || typeof message.createdAt === "string") &&
    (sources === undefined || Array.isArray(sources)) &&
    (attachments === undefined || Array.isArray(attachments)) &&
    (files === undefined || Array.isArray(files))
  );
}

function normalizeSettings(value: unknown): ChatSettings {
  if (!value || typeof value !== "object") {
    return DEFAULT_SETTINGS;
  }

  const settings = value as Partial<ChatSettings>;
  const temperature =
    typeof settings.temperature === "number" && Number.isFinite(settings.temperature)
      ? Math.min(2, Math.max(0, settings.temperature))
      : DEFAULT_SETTINGS.temperature;

  return {
    apiKey:
      typeof settings.apiKey === "string" && settings.apiKey.trim()
        ? settings.apiKey.trim()
        : undefined,
    model:
      typeof settings.model === "string" && settings.model.trim()
        ? settings.model.trim()
        : DEFAULT_MODEL,
    systemPrompt:
      typeof settings.systemPrompt === "string"
        ? settings.systemPrompt
        : DEFAULT_SETTINGS.systemPrompt,
    temperature,
    serverTools: normalizeServerTools(settings.serverTools),
    multimodal: normalizeMultimodalSettings(settings.multimodal),
    messageTransforms: normalizeMessageTransforms(settings.messageTransforms),
    responseCaching: normalizeResponseCaching(settings.responseCaching),
  };
}

function normalizeChatMessage(message: ChatMessage): ChatMessage {
  return {
    ...message,
    attachments: message.attachments?.filter(isChatAttachment),
    files: message.files?.filter(isChatGeneratedFile),
  };
}

function isChatAttachment(value: unknown): value is ChatAttachment {
  if (!value || typeof value !== "object") {
    return false;
  }

  const attachment = value as Partial<ChatAttachment>;
  return (
    typeof attachment.id === "string" &&
    typeof attachment.name === "string" &&
    typeof attachment.mediaType === "string" &&
    typeof attachment.size === "number" &&
    typeof attachment.dataUrl === "string" &&
    attachment.dataUrl.startsWith("data:") &&
    (attachment.kind === "image" || attachment.kind === "pdf")
  );
}

function isChatGeneratedFile(value: unknown): value is ChatGeneratedFile {
  if (!value || typeof value !== "object") {
    return false;
  }

  const file = value as Partial<ChatGeneratedFile>;
  return (
    typeof file.id === "string" &&
    typeof file.mediaType === "string" &&
    typeof file.dataUrl === "string" &&
    file.dataUrl.startsWith("data:") &&
    (file.name === undefined || typeof file.name === "string")
  );
}

function normalizeServerTools(value: unknown): ServerToolSettings {
  if (!value || typeof value !== "object") {
    return DEFAULT_SERVER_TOOLS;
  }

  const tools = value as Partial<ChatSettings["serverTools"]>;
  const webSearch = tools.webSearch && typeof tools.webSearch === "object" ? tools.webSearch : {};
  const webFetch = tools.webFetch && typeof tools.webFetch === "object" ? tools.webFetch : {};
  const datetime = tools.datetime && typeof tools.datetime === "object" ? tools.datetime : {};

  return {
    webSearch: {
      enabled: Boolean((webSearch as { enabled?: unknown }).enabled),
      engine: normalizeSearchEngine((webSearch as { engine?: unknown }).engine),
      maxResults: clampNumber((webSearch as { maxResults?: unknown }).maxResults, 1, 25, DEFAULT_SERVER_TOOLS.webSearch.maxResults),
      maxTotalResults: clampNumber((webSearch as { maxTotalResults?: unknown }).maxTotalResults, 1, 100, DEFAULT_SERVER_TOOLS.webSearch.maxTotalResults),
      searchContextSize: normalizeSearchContextSize((webSearch as { searchContextSize?: unknown }).searchContextSize),
      allowedDomains: normalizeDomains((webSearch as { allowedDomains?: unknown }).allowedDomains),
      excludedDomains: normalizeDomains((webSearch as { excludedDomains?: unknown }).excludedDomains),
    },
    webFetch: {
      enabled: Boolean((webFetch as { enabled?: unknown }).enabled),
      engine: normalizeFetchEngine((webFetch as { engine?: unknown }).engine),
      maxUses: clampNumber((webFetch as { maxUses?: unknown }).maxUses, 1, 50, DEFAULT_SERVER_TOOLS.webFetch.maxUses),
      maxContentTokens: clampNumber((webFetch as { maxContentTokens?: unknown }).maxContentTokens, 1000, 200000, DEFAULT_SERVER_TOOLS.webFetch.maxContentTokens),
      allowedDomains: normalizeDomains((webFetch as { allowedDomains?: unknown }).allowedDomains),
      blockedDomains: normalizeDomains((webFetch as { blockedDomains?: unknown }).blockedDomains),
    },
    datetime: {
      enabled: Boolean((datetime as { enabled?: unknown }).enabled),
      timezone:
        typeof (datetime as { timezone?: unknown }).timezone === "string" &&
        isValidTimezone((datetime as { timezone: string }).timezone.trim())
          ? (datetime as { timezone: string }).timezone.trim()
          : DEFAULT_SERVER_TOOLS.datetime.timezone,
    },
  };
}

function normalizeMultimodalSettings(value: unknown): ChatSettings["multimodal"] {
  if (!value || typeof value !== "object") {
    return DEFAULT_MULTIMODAL_SETTINGS;
  }

  const multimodal = value as Partial<ChatSettings["multimodal"]>;
  const imageGeneration =
    multimodal.imageGeneration && typeof multimodal.imageGeneration === "object"
      ? multimodal.imageGeneration
      : {};
  const pdfEngine = multimodal.pdfEngine;

  return {
    imageGeneration: {
      enabled: Boolean((imageGeneration as { enabled?: unknown }).enabled),
      mode:
        (imageGeneration as { mode?: unknown }).mode === "image-only"
          ? "image-only"
          : DEFAULT_MULTIMODAL_SETTINGS.imageGeneration.mode,
      aspectRatio:
        typeof (imageGeneration as { aspectRatio?: unknown }).aspectRatio === "string" &&
        (imageGeneration as { aspectRatio: string }).aspectRatio.trim()
          ? (imageGeneration as { aspectRatio: string }).aspectRatio.trim()
          : DEFAULT_MULTIMODAL_SETTINGS.imageGeneration.aspectRatio,
    },
    pdfEngine:
      pdfEngine === "cloudflare-ai" || pdfEngine === "mistral-ocr" || pdfEngine === "native"
        ? pdfEngine
        : DEFAULT_MULTIMODAL_SETTINGS.pdfEngine,
  };
}

function normalizeMessageTransforms(value: unknown): ChatSettings["messageTransforms"] {
  if (!value || typeof value !== "object") {
    return DEFAULT_MESSAGE_TRANSFORMS;
  }

  const transforms = value as Partial<ChatSettings["messageTransforms"]>;
  const contextCompression =
    transforms.contextCompression && typeof transforms.contextCompression === "object"
      ? transforms.contextCompression
      : {};

  return {
    contextCompression: {
      enabled:
        typeof (contextCompression as { enabled?: unknown }).enabled === "boolean"
          ? (contextCompression as { enabled: boolean }).enabled
          : DEFAULT_MESSAGE_TRANSFORMS.contextCompression.enabled,
    },
  };
}

function normalizeResponseCaching(value: unknown): ChatSettings["responseCaching"] {
  if (!value || typeof value !== "object") {
    return DEFAULT_RESPONSE_CACHING;
  }

  const caching = value as Partial<ChatSettings["responseCaching"]>;

  return {
    enabled: Boolean(caching.enabled),
    ttlSeconds: clampNumber(
      caching.ttlSeconds,
      1,
      86400,
      DEFAULT_RESPONSE_CACHING.ttlSeconds,
    ),
  };
}

function normalizeSearchEngine(value: unknown): SearchEngine {
  return value === "native" ||
    value === "exa" ||
    value === "firecrawl" ||
    value === "parallel" ||
    value === "perplexity"
    ? value
    : "auto";
}

function normalizeFetchEngine(value: unknown): FetchEngine {
  return value === "native" ||
    value === "exa" ||
    value === "openrouter" ||
    value === "firecrawl" ||
    value === "parallel"
    ? value
    : "auto";
}

function normalizeSearchContextSize(value: unknown): SearchContextSize {
  return value === "low" || value === "medium" || value === "high" ? value : "auto";
}

function normalizeDomains(value: unknown): string[] {
  if (!Array.isArray(value)) {
    return [];
  }

  return Array.from(
    new Set(
      value
        .filter((domain): domain is string => typeof domain === "string")
        .map((domain) => domain.trim().toLowerCase())
        .filter(Boolean),
    ),
  );
}

function clampNumber(value: unknown, min: number, max: number, fallback: number) {
  const numeric = typeof value === "number" && Number.isFinite(value) ? value : fallback;
  return Math.min(max, Math.max(min, Math.round(numeric)));
}

function isValidTimezone(value: string) {
  if (!value) {
    return false;
  }

  try {
    Intl.DateTimeFormat(undefined, { timeZone: value });
    return true;
  } catch {
    return false;
  }
}

function createId() {
  if (typeof crypto !== "undefined" && "randomUUID" in crypto) {
    return crypto.randomUUID();
  }

  return `${Date.now()}-${Math.random().toString(36).slice(2)}`;
}

function titleFromMessages(messages: ChatMessage[]) {
  const firstUserMessage = messages.find((message) => message.role === "user" && message.content.trim());
  if (!firstUserMessage) {
    return "New chat";
  }

  const compact = firstUserMessage.content.replace(/\s+/g, " ").trim();
  return compact.length > 42 ? `${compact.slice(0, 39).trim()}...` : compact;
}

function isChatThread(value: unknown): value is ChatThread {
  if (!value || typeof value !== "object") {
    return false;
  }

  const thread = value as Partial<ChatThread>;
  return (
    typeof thread.id === "string" &&
    typeof thread.title === "string" &&
    Array.isArray(thread.messages) &&
    thread.messages.every(isChatMessage) &&
    typeof thread.createdAt === "string" &&
    typeof thread.updatedAt === "string"
  );
}

function normalizeThread(thread: ChatThread): ChatThread {
  const messages = thread.messages.filter(isChatMessage).map(normalizeChatMessage);
  return {
    ...thread,
    title: thread.title.trim() || titleFromMessages(messages),
    messages,
  };
}

function loadLegacyMessages(): ChatMessage[] {
  if (!canUseStorage()) {
    return [];
  }

  try {
    const raw = window.localStorage.getItem(MESSAGES_KEY);
    if (!raw) {
      return [];
    }

    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed.filter(isChatMessage) : [];
  } catch {
    return [];
  }
}

export function loadThreads(): ChatThread[] {
  if (!canUseStorage()) {
    return [];
  }

  try {
    const raw = window.localStorage.getItem(THREADS_KEY);
    if (raw) {
      const parsed = JSON.parse(raw);
      if (Array.isArray(parsed)) {
        const threads = parsed.filter(isChatThread).map(normalizeThread);
        if (threads.length > 0) {
          return threads;
        }
      }
    }
  } catch {
    // Fall through to legacy migration.
  }

  const legacyMessages = loadLegacyMessages();
  if (legacyMessages.length === 0) {
    return [];
  }

  const now = new Date().toISOString();
  const migratedThread: ChatThread = {
    id: createId(),
    title: titleFromMessages(legacyMessages),
    messages: legacyMessages,
    createdAt: legacyMessages[0]?.createdAt ?? now,
    updatedAt: now,
  };

  saveThreads([migratedThread]);
  window.localStorage.removeItem(MESSAGES_KEY);
  return [migratedThread];
}

export function saveThreads(threads: ChatThread[]) {
  if (!canUseStorage()) {
    return;
  }

  window.localStorage.setItem(THREADS_KEY, JSON.stringify(threads.map(normalizeThread)));
}

export function loadActiveThreadId() {
  if (!canUseStorage()) {
    return null;
  }

  return window.localStorage.getItem(ACTIVE_THREAD_KEY);
}

export function saveActiveThreadId(threadId: string) {
  if (!canUseStorage()) {
    return;
  }

  window.localStorage.setItem(ACTIVE_THREAD_KEY, threadId);
}

export function clearStoredThreads() {
  if (!canUseStorage()) {
    return;
  }

  window.localStorage.removeItem(THREADS_KEY);
  window.localStorage.removeItem(ACTIVE_THREAD_KEY);
  window.localStorage.removeItem(MESSAGES_KEY);
}

export function loadSettings(): ChatSettings {
  if (!canUseStorage()) {
    return DEFAULT_SETTINGS;
  }

  try {
    const raw = window.localStorage.getItem(SETTINGS_KEY);
    return raw ? normalizeSettings(JSON.parse(raw)) : DEFAULT_SETTINGS;
  } catch {
    return DEFAULT_SETTINGS;
  }
}

export function saveSettings(settings: ChatSettings) {
  if (!canUseStorage()) {
    return;
  }

  window.localStorage.setItem(SETTINGS_KEY, JSON.stringify(normalizeSettings(settings)));
}

export function clearStoredSettings() {
  if (!canUseStorage()) {
    return;
  }

  window.localStorage.removeItem(SETTINGS_KEY);
}
