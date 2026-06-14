import { createOpenRouter } from "@openrouter/ai-sdk-provider";
import { streamText, type JSONValue, type ModelMessage, type TextStreamPart } from "ai";
import { DEFAULT_MODEL, DEFAULT_SERVER_TOOLS, type ChatMessage, type ChatMessageSource } from "@/lib/types";

export const runtime = "nodejs";
export const maxDuration = 60;

type ChatRequestBody = {
  apiKey?: unknown;
  messages?: unknown;
  model?: unknown;
  systemPrompt?: unknown;
  temperature?: unknown;
  serverTools?: unknown;
};

type OpenRouterServerTool = {
  type: "openrouter:web_search" | "openrouter:web_fetch" | "openrouter:datetime";
  parameters?: Record<string, JSONValue>;
};

type ServerToolValidation = {
  tools: OpenRouterServerTool[];
};

type StreamEvent =
  | { type: "text"; text: string }
  | { type: "source"; source: ChatMessageSource }
  | { type: "done" };

type PublicErrorCode =
  | "aborted"
  | "invalid_input"
  | "invalid_model"
  | "missing_api_key"
  | "openrouter_failure"
  | "rate_limited";

const MODEL_PATTERN = /^~?[a-zA-Z0-9_.-]+\/[a-zA-Z0-9_.:-]+$/;

export async function GET() {
  return Response.json({
    configured: false,
    source: "local-settings",
  });
}

export async function POST(req: Request) {
  let body: ChatRequestBody;
  try {
    body = (await req.json()) as ChatRequestBody;
  } catch {
    return jsonError("Request body must be valid JSON.", 400, "invalid_input");
  }

  const validated = validateRequestBody(body);
  if (!validated.ok) {
    return jsonError(validated.message, validated.status, validated.code);
  }

  const openrouter = createOpenRouter({
    apiKey: validated.apiKey,
    headers: {
      "HTTP-Referer": process.env.NEXT_PUBLIC_SITE_URL ?? "http://localhost:3000",
      "X-OpenRouter-Title": "OpenRouter Chat PWA",
    },
  });

  try {
    const result = streamText({
      model: openrouter.chat(validated.model),
      messages: validated.messages,
      system: validated.systemPrompt || undefined,
      temperature: validated.temperature,
      providerOptions:
        validated.serverTools.tools.length > 0
          ? {
              openrouter: {
                tools: validated.serverTools.tools,
              },
            }
          : undefined,
      abortSignal: req.signal,
    });

    return await createPrimedEventResponse(result.fullStream);
  } catch (error) {
    return errorResponse(error, req.signal);
  }
}

function validateRequestBody(body: ChatRequestBody):
  | {
      ok: true;
      apiKey: string;
      messages: ModelMessage[];
      model: string;
      systemPrompt: string;
      temperature: number;
      serverTools: ServerToolValidation;
    }
  | {
      ok: false;
      status: number;
      code: PublicErrorCode;
      message: string;
    } {
  const apiKey = typeof body.apiKey === "string" ? body.apiKey.trim() : "";
  if (!apiKey) {
    return {
      ok: false,
      status: 400,
      code: "missing_api_key",
      message: "Add an OpenRouter API key in Settings before sending.",
    };
  }

  const model = typeof body.model === "string" && body.model.trim() ? body.model.trim() : DEFAULT_MODEL;

  if (!MODEL_PATTERN.test(model)) {
    return {
      ok: false,
      status: 400,
      code: "invalid_model",
      message: "Model must use an OpenRouter id like openai/gpt-5-mini.",
    };
  }

  const temperature =
    typeof body.temperature === "number" && Number.isFinite(body.temperature)
      ? body.temperature
      : 0.7;

  if (temperature < 0 || temperature > 2) {
    return {
      ok: false,
      status: 400,
      code: "invalid_input",
      message: "Temperature must be between 0 and 2.",
    };
  }

  const systemPrompt = typeof body.systemPrompt === "string" ? body.systemPrompt.trim() : "";

  if (!Array.isArray(body.messages)) {
    return {
      ok: false,
      status: 400,
      code: "invalid_input",
      message: "Messages must be an array.",
    };
  }

  const chatMessages = body.messages.filter(isChatMessage);
  const messages = chatMessages
    .filter((message) => message.role === "user" || message.role === "assistant")
    .map((message) => ({
      role: message.role,
      content: message.content.trim(),
    }))
    .filter((message) => message.content.length > 0) satisfies ModelMessage[];

  const lastMessage = messages.at(-1);
  if (!lastMessage || lastMessage.role !== "user") {
    return {
      ok: false,
      status: 400,
      code: "invalid_input",
      message: "Enter a message before sending.",
    };
  }

  return {
    ok: true,
    apiKey,
    messages,
    model,
    systemPrompt,
    temperature,
    serverTools: validateServerTools(body.serverTools),
  };
}

function isChatMessage(value: unknown): value is ChatMessage {
  if (!value || typeof value !== "object") {
    return false;
  }

  const message = value as Partial<ChatMessage>;
  return (
    typeof message.id === "string" &&
    (message.role === "system" || message.role === "user" || message.role === "assistant") &&
    typeof message.content === "string"
  );
}

async function createPrimedEventResponse(fullStream: AsyncIterable<TextStreamPart<any>>) {
  const iterator = fullStream[Symbol.asyncIterator]();
  let firstChunk: IteratorResult<TextStreamPart<any>>;

  try {
    firstChunk = await iterator.next();
  } catch (error) {
    return errorResponse(error);
  }

  if (firstChunk.done) {
    return jsonError(
      "The selected model did not return a response. Check the model id.",
      400,
      "invalid_model",
    );
  }

  const encoder = new TextEncoder();
  const stream = new ReadableStream<Uint8Array>({
    async start(controller) {
      enqueueStreamPart(controller, encoder, firstChunk.value);

      try {
        for (;;) {
          const chunk = await iterator.next();
          if (chunk.done) {
            enqueueEvent(controller, encoder, { type: "done" });
            controller.close();
            return;
          }
          enqueueStreamPart(controller, encoder, chunk.value);
        }
      } catch (error) {
        controller.error(error);
      }
    },
    async cancel() {
      await iterator.return?.();
    },
  });

  return new Response(stream, {
    headers: {
      "Cache-Control": "no-store, no-transform",
      "Content-Type": "application/x-ndjson; charset=utf-8",
      "X-Content-Type-Options": "nosniff",
    },
  });
}

function enqueueStreamPart(
  controller: ReadableStreamDefaultController<Uint8Array>,
  encoder: TextEncoder,
  part: TextStreamPart<any>,
) {
  if (part.type === "text-delta" && part.text) {
    enqueueEvent(controller, encoder, { type: "text", text: part.text });
    return;
  }

  if (part.type === "source" && part.sourceType === "url") {
    enqueueEvent(controller, encoder, {
      type: "source",
      source: {
        id: part.id,
        url: part.url,
        title: part.title,
      },
    });
  }
}

function enqueueEvent(
  controller: ReadableStreamDefaultController<Uint8Array>,
  encoder: TextEncoder,
  event: StreamEvent,
) {
  controller.enqueue(encoder.encode(`${JSON.stringify(event)}\n`));
}

function validateServerTools(value: unknown): ServerToolValidation {
  if (!value || typeof value !== "object") {
    return { tools: [] };
  }

  const settings = value as Record<string, unknown>;
  const tools: OpenRouterServerTool[] = [];
  const webSearch = getRecord(settings.webSearch);
  const webFetch = getRecord(settings.webFetch);
  const datetime = getRecord(settings.datetime);

  if (Boolean(webSearch?.enabled)) {
    const engine = normalizeSearchEngine(webSearch?.engine);
    const allowedDomains = normalizeDomains(webSearch?.allowedDomains);
    const excludedDomains = normalizeDomains(webSearch?.excludedDomains);
    const parameters = compactParameters({
      engine,
      max_results: clampInteger(webSearch?.maxResults, 1, 25, DEFAULT_SERVER_TOOLS.webSearch.maxResults),
      max_total_results: clampInteger(
        webSearch?.maxTotalResults,
        1,
        100,
        DEFAULT_SERVER_TOOLS.webSearch.maxTotalResults,
      ),
      search_context_size:
        webSearch?.searchContextSize === "low" ||
        webSearch?.searchContextSize === "medium" ||
        webSearch?.searchContextSize === "high"
          ? webSearch.searchContextSize
          : undefined,
      allowed_domains: allowedDomains,
      excluded_domains:
        engine === "exa" || !allowedDomains || allowedDomains.length === 0
          ? excludedDomains
          : undefined,
    });
    tools.push({ type: "openrouter:web_search", parameters });
  }

  if (Boolean(webFetch?.enabled)) {
    const parameters = compactParameters({
      engine: normalizeFetchEngine(webFetch?.engine),
      max_uses: clampInteger(webFetch?.maxUses, 1, 50, DEFAULT_SERVER_TOOLS.webFetch.maxUses),
      max_content_tokens: clampInteger(
        webFetch?.maxContentTokens,
        1000,
        200000,
        DEFAULT_SERVER_TOOLS.webFetch.maxContentTokens,
      ),
      allowed_domains: normalizeDomains(webFetch?.allowedDomains),
      blocked_domains: normalizeDomains(webFetch?.blockedDomains),
    });
    tools.push({ type: "openrouter:web_fetch", parameters });
  }

  if (Boolean(datetime?.enabled)) {
    const timezone =
      typeof datetime?.timezone === "string" && isValidTimezone(datetime.timezone.trim())
        ? datetime.timezone.trim()
        : DEFAULT_SERVER_TOOLS.datetime.timezone;
    tools.push({
      type: "openrouter:datetime",
      parameters: {
        timezone,
      },
    });
  }

  return { tools };
}

function getRecord(value: unknown): Record<string, unknown> | null {
  return value && typeof value === "object" && !Array.isArray(value) ? (value as Record<string, unknown>) : null;
}

function normalizeSearchEngine(value: unknown) {
  return value === "native" ||
    value === "exa" ||
    value === "firecrawl" ||
    value === "parallel" ||
    value === "perplexity"
    ? value
    : "auto";
}

function normalizeFetchEngine(value: unknown) {
  return value === "native" ||
    value === "exa" ||
    value === "openrouter" ||
    value === "firecrawl" ||
    value === "parallel"
    ? value
    : "auto";
}

function normalizeDomains(value: unknown) {
  if (!Array.isArray(value)) {
    return undefined;
  }

  const domains = Array.from(
    new Set(
      value
        .filter((domain): domain is string => typeof domain === "string")
        .map((domain) => domain.trim().toLowerCase())
        .filter(Boolean),
    ),
  );

  return domains.length > 0 ? domains : undefined;
}

function clampInteger(value: unknown, min: number, max: number, fallback: number) {
  const numeric = typeof value === "number" && Number.isFinite(value) ? value : fallback;
  return Math.min(max, Math.max(min, Math.round(numeric)));
}

function compactParameters(parameters: Record<string, unknown>): Record<string, JSONValue> {
  return Object.fromEntries(
    Object.entries(parameters).filter(([, value]) => {
      if (value === undefined || value === null) {
        return false;
      }
      if (Array.isArray(value) && value.length === 0) {
        return false;
      }
      return true;
    }),
  ) as Record<string, JSONValue>;
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

function errorResponse(error: unknown, signal?: AbortSignal) {
  if (signal?.aborted || isAbortError(error)) {
    return jsonError("Streaming request was aborted.", 499, "aborted");
  }

  const status = getErrorStatus(error);
  if (status === 429) {
    return jsonError("OpenRouter rate limit reached. Try again shortly.", 429, "rate_limited");
  }

  if (status === 400 || status === 404) {
    return jsonError("The selected model is not available through OpenRouter.", 400, "invalid_model");
  }

  console.error("OpenRouter chat request failed", error);
  return jsonError("OpenRouter API request failed. Try again.", 502, "openrouter_failure");
}

function getErrorStatus(error: unknown) {
  if (!error || typeof error !== "object") {
    return undefined;
  }

  const maybeStatus = error as {
    status?: unknown;
    statusCode?: unknown;
    response?: { status?: unknown };
  };

  if (typeof maybeStatus.status === "number") {
    return maybeStatus.status;
  }
  if (typeof maybeStatus.statusCode === "number") {
    return maybeStatus.statusCode;
  }
  if (typeof maybeStatus.response?.status === "number") {
    return maybeStatus.response.status;
  }

  return undefined;
}

function isAbortError(error: unknown) {
  return (
    error instanceof DOMException && error.name === "AbortError"
  ) || (
    error instanceof Error && /aborted|abort/i.test(error.message)
  );
}

function jsonError(message: string, status: number, code: PublicErrorCode) {
  return Response.json(
    {
      error: {
        code,
        message,
      },
    },
    { status },
  );
}
