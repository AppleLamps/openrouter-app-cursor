import {
  DEFAULT_MESSAGE_TRANSFORMS,
  DEFAULT_MULTIMODAL_SETTINGS,
  DEFAULT_PROFILE_SETTINGS,
  DEFAULT_PROVIDER_ROUTING,
  DEFAULT_REASONING,
  DEFAULT_RESPONSE_CACHING,
  DEFAULT_SERVER_TOOLS,
  type ChatAttachment,
  type ChatGeneratedFile,
  type ChatMessage,
  type ChatMessageSource,
  type ChatMessageUsage,
  type FetchEngine,
  type MessageTransformSettings,
  type MultimodalSettings,
  type ProviderRoutingSettings,
  type ProviderSort,
  type ReasoningEffort,
  type ReasoningSettings,
  type ResponseCachingSettings,
  type SearchContextSize,
  type SearchEngine,
  type ServerToolSettings,
  type ChatThread,
  type UserProfileSettings,
} from "@/lib/types";

export function isChatMessage(value: unknown): value is ChatMessage {
  if (!value || typeof value !== "object") {
    return false;
  }

  const message = value as Partial<ChatMessage>;
  const sources = message.sources;
  const attachments = message.attachments;
  const files = message.files;

  return (
    typeof message.id === "string" &&
    (message.role === "system" || message.role === "user" || message.role === "assistant") &&
    typeof message.content === "string" &&
    (message.createdAt === undefined || typeof message.createdAt === "string") &&
    (sources === undefined || Array.isArray(sources)) &&
    (attachments === undefined || Array.isArray(attachments)) &&
    (files === undefined || Array.isArray(files)) &&
    (message.reasoning === undefined || typeof message.reasoning === "string") &&
    (message.usage === undefined || isChatMessageUsage(message.usage))
  );
}

export function isChatMessageUsage(value: unknown): value is ChatMessageUsage {
  if (!value || typeof value !== "object") {
    return false;
  }

  const usage = value as Partial<ChatMessageUsage>;
  const numeric = (field: unknown) => field === undefined || (typeof field === "number" && Number.isFinite(field));

  return (
    numeric(usage.inputTokens) &&
    numeric(usage.outputTokens) &&
    numeric(usage.cachedTokens) &&
    numeric(usage.cacheWriteTokens)
  );
}

export function isChatAttachment(value: unknown): value is ChatAttachment {
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

export function isChatGeneratedFile(value: unknown): value is ChatGeneratedFile {
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

export function isChatThread(value: unknown): value is ChatThread {
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
    typeof thread.updatedAt === "string" &&
    (thread.starred === undefined || typeof thread.starred === "boolean")
  );
}

export function isChatThreadArray(value: unknown): value is ChatThread[] {
  return Array.isArray(value) && value.every(isChatThread);
}

export function isChatMessageSource(value: unknown): value is ChatMessageSource {
  if (!value || typeof value !== "object") {
    return false;
  }

  const source = value as Partial<ChatMessageSource>;
  return (
    typeof source.id === "string" &&
    typeof source.url === "string" &&
    (source.title === undefined || typeof source.title === "string")
  );
}

export function normalizeSearchEngine(value: unknown): SearchEngine {
  return value === "native" ||
    value === "exa" ||
    value === "firecrawl" ||
    value === "parallel" ||
    value === "perplexity"
    ? value
    : "auto";
}

export function normalizeFetchEngine(value: unknown): FetchEngine {
  return value === "native" ||
    value === "exa" ||
    value === "openrouter" ||
    value === "firecrawl" ||
    value === "parallel"
    ? value
    : "auto";
}

export function normalizeSearchContextSize(value: unknown): SearchContextSize {
  return value === "low" || value === "medium" || value === "high" ? value : "auto";
}

export function normalizeDomains(value: unknown): string[] {
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

export function normalizeDomainsForApi(value: unknown): string[] | undefined {
  const domains = normalizeDomains(value);
  return domains.length > 0 ? domains : undefined;
}

export function clampNumber(value: unknown, min: number, max: number, fallback: number) {
  const numeric = typeof value === "number" && Number.isFinite(value) ? value : fallback;
  return Math.min(max, Math.max(min, Math.round(numeric)));
}

export function normalizeUserProfile(value: unknown): UserProfileSettings {
  if (!value || typeof value !== "object") {
    return DEFAULT_PROFILE_SETTINGS;
  }

  const profile = value as Partial<UserProfileSettings>;
  return {
    displayName:
      typeof profile.displayName === "string"
        ? profile.displayName.replace(/\s+/g, " ").trim().slice(0, 80)
        : DEFAULT_PROFILE_SETTINGS.displayName,
  };
}

export function isValidTimezone(value: string) {
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

export function normalizeAspectRatio(value: unknown) {
  return value === "1:1" ||
    value === "2:3" ||
    value === "3:2" ||
    value === "3:4" ||
    value === "4:3" ||
    value === "4:5" ||
    value === "5:4" ||
    value === "9:16" ||
    value === "16:9" ||
    value === "21:9" ||
    value === "auto"
    ? value
    : DEFAULT_MULTIMODAL_SETTINGS.imageGeneration.aspectRatio;
}

export function normalizeMultimodalSettings(value: unknown): MultimodalSettings {
  if (!value || typeof value !== "object") {
    return DEFAULT_MULTIMODAL_SETTINGS;
  }

  const multimodal = value as Partial<MultimodalSettings>;
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
      aspectRatio: normalizeAspectRatio((imageGeneration as { aspectRatio?: unknown }).aspectRatio),
    },
    pdfEngine:
      pdfEngine === "cloudflare-ai" || pdfEngine === "mistral-ocr" || pdfEngine === "native"
        ? pdfEngine
        : DEFAULT_MULTIMODAL_SETTINGS.pdfEngine,
  };
}

export function normalizeMessageTransforms(value: unknown): MessageTransformSettings {
  if (!value || typeof value !== "object") {
    return DEFAULT_MESSAGE_TRANSFORMS;
  }

  const transforms = value as Partial<MessageTransformSettings>;
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

export function normalizeResponseCaching(value: unknown): ResponseCachingSettings {
  if (!value || typeof value !== "object") {
    return DEFAULT_RESPONSE_CACHING;
  }

  const caching = value as Partial<ResponseCachingSettings>;

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

export function normalizeProviderSort(value: unknown): ProviderSort {
  return value === "price" || value === "throughput" || value === "latency" ? value : "default";
}

export function normalizeProviderRouting(value: unknown): ProviderRoutingSettings {
  if (!value || typeof value !== "object") {
    return DEFAULT_PROVIDER_ROUTING;
  }

  const routing = value as Partial<ProviderRoutingSettings>;

  return {
    providerSort: normalizeProviderSort(routing.providerSort),
    dataCollectionDeny: Boolean(routing.dataCollectionDeny),
  };
}

export function normalizeReasoning(value: unknown): ReasoningSettings {
  if (!value || typeof value !== "object") {
    return DEFAULT_REASONING;
  }

  const reasoning = value as Partial<ReasoningSettings>;
  const effort =
    reasoning.effort === "xhigh" ||
      reasoning.effort === "high" ||
      reasoning.effort === "medium" ||
      reasoning.effort === "low" ||
      reasoning.effort === "minimal" ||
      reasoning.effort === "none"
      ? (reasoning.effort as ReasoningEffort)
      : DEFAULT_REASONING.effort;

  return {
    enabled: Boolean(reasoning.enabled),
    effort,
    exclude: Boolean(reasoning.exclude),
  };
}

export function normalizeServerTools(value: unknown): ServerToolSettings {
  if (!value || typeof value !== "object") {
    return DEFAULT_SERVER_TOOLS;
  }

  const tools = value as Partial<ServerToolSettings>;
  const webSearch = tools.webSearch && typeof tools.webSearch === "object" ? tools.webSearch : {};
  const webFetch = tools.webFetch && typeof tools.webFetch === "object" ? tools.webFetch : {};
  const datetime = tools.datetime && typeof tools.datetime === "object" ? tools.datetime : {};

  return {
    webSearch: {
      enabled: Boolean((webSearch as { enabled?: unknown }).enabled),
      engine: normalizeSearchEngine((webSearch as { engine?: unknown }).engine),
      maxResults: clampNumber(
        (webSearch as { maxResults?: unknown }).maxResults,
        1,
        25,
        DEFAULT_SERVER_TOOLS.webSearch.maxResults,
      ),
      maxTotalResults: clampNumber(
        (webSearch as { maxTotalResults?: unknown }).maxTotalResults,
        1,
        100,
        DEFAULT_SERVER_TOOLS.webSearch.maxTotalResults,
      ),
      searchContextSize: normalizeSearchContextSize((webSearch as { searchContextSize?: unknown }).searchContextSize),
      allowedDomains: normalizeDomains((webSearch as { allowedDomains?: unknown }).allowedDomains),
      excludedDomains: normalizeDomains((webSearch as { excludedDomains?: unknown }).excludedDomains),
    },
    webFetch: {
      enabled: Boolean((webFetch as { enabled?: unknown }).enabled),
      engine: normalizeFetchEngine((webFetch as { engine?: unknown }).engine),
      maxUses: clampNumber(
        (webFetch as { maxUses?: unknown }).maxUses,
        1,
        50,
        DEFAULT_SERVER_TOOLS.webFetch.maxUses,
      ),
      maxContentTokens: clampNumber(
        (webFetch as { maxContentTokens?: unknown }).maxContentTokens,
        1000,
        200000,
        DEFAULT_SERVER_TOOLS.webFetch.maxContentTokens,
      ),
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
