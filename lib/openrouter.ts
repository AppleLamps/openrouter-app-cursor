import type { JSONValue } from "ai";

export const LARGE_SYSTEM_PROMPT_CHARS = 4096;

const PROMPT_CACHING_MODEL_PREFIXES = ["anthropic/", "google/", "qwen/", "alibaba/"] as const;

export function supportsAutomaticPromptCaching(model: string) {
  const normalized = model.toLowerCase();
  return PROMPT_CACHING_MODEL_PREFIXES.some((prefix) => normalized.startsWith(prefix));
}

export function shouldApplyAutomaticCacheControl(model: string, systemPrompt: string) {
  return supportsAutomaticPromptCaching(model) && systemPrompt.length >= LARGE_SYSTEM_PROMPT_CHARS;
}

export const RESPONSE_HEALING_PLUGIN = { id: "response-healing" } as const;

export type OpenRouterRouterPick = {
  id: string;
  label: string;
  description: string;
};

export const OPENROUTER_ROUTER_PICKS: OpenRouterRouterPick[] = [
  {
    id: "openrouter/auto",
    label: "Auto",
    description: "NotDiamond picks the best model for each prompt.",
  },
  {
    id: "openrouter/pareto-code",
    label: "Pareto",
    description: "Routes to strong coding models by Artificial Analysis score.",
  },
  {
    id: "openrouter/free",
    label: "Free",
    description: "Random free model matched to your request capabilities.",
  },
];

export function buildChatExtraBody(options: {
  sessionId: string;
  model: string;
  systemPrompt: string;
  jsonMode?: boolean;
}): Record<string, JSONValue> {
  const extraBody: Record<string, JSONValue> = {
    session_id: options.sessionId,
  };

  if (options.jsonMode) {
    extraBody.response_format = { type: "json_object" };
  }

  if (shouldApplyAutomaticCacheControl(options.model, options.systemPrompt)) {
    extraBody.cache_control = { type: "ephemeral" };
  }

  return extraBody;
}

export const TITLE_RESPONSE_FORMAT = {
  type: "json_schema" as const,
  json_schema: {
    name: "conversation_title",
    strict: true,
    schema: {
      type: "object",
      properties: {
        title: {
          type: "string",
          description: "A concise 3-6 word title for the conversation",
        },
      },
      required: ["title"],
      additionalProperties: false,
    },
  },
};

export function parseTitleResponse(text: string) {
  const trimmed = text.trim();
  if (!trimmed) {
    return "";
  }

  try {
    const parsed = JSON.parse(trimmed) as { title?: unknown };
    if (typeof parsed.title === "string" && parsed.title.trim()) {
      return normalizeTitle(parsed.title);
    }
  } catch {
    // Fall through to plain-text normalization.
  }

  return normalizeTitle(trimmed);
}

function normalizeTitle(raw: string) {
  const compact = raw.replace(/\s+/g, " ").trim();
  const unquoted = compact.replace(/^["'`]+|["'`]+$/g, "").trim();
  if (!unquoted) {
    return "";
  }

  return unquoted.length > 60 ? `${unquoted.slice(0, 57).trim()}...` : unquoted;
}
