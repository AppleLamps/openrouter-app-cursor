import { createOpenRouter } from "@openrouter/ai-sdk-provider";
import { streamText, type JSONValue, type ModelMessage, type TextStreamPart } from "ai";
import {
  DEFAULT_MESSAGE_TRANSFORMS,
  DEFAULT_MODEL,
  DEFAULT_MULTIMODAL_SETTINGS,
  DEFAULT_SERVER_TOOLS,
  type ChatAttachment,
  type ChatGeneratedFile,
  type ChatMessage,
  type ChatMessageSource,
  type MessageTransformSettings,
  type MultimodalSettings,
} from "@/lib/types";

export const runtime = "nodejs";
export const maxDuration = 60;

type ChatRequestBody = {
  apiKey?: unknown;
  messages?: unknown;
  model?: unknown;
  systemPrompt?: unknown;
  temperature?: unknown;
  serverTools?: unknown;
  multimodal?: unknown;
  messageTransforms?: unknown;
};

type OpenRouterServerTool = {
  type: "openrouter:web_search" | "openrouter:web_fetch" | "openrouter:datetime";
  parameters?: Record<string, JSONValue>;
};

type ServerToolValidation = {
  tools: OpenRouterServerTool[];
};

type MultimodalValidation = {
  providerOptions: Record<string, JSONValue>;
};

type MessageTransformValidation = {
  providerOptions: Record<string, JSONValue>;
};

type StreamEvent =
  | { type: "text"; text: string }
  | { type: "source"; source: ChatMessageSource }
  | { type: "file"; file: ChatGeneratedFile }
  | { type: "error"; error: { code: PublicErrorCode; message: string } }
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
    const openrouterOptions = mergeOpenRouterOptions(
      validated.multimodal.providerOptions,
      validated.messageTransforms.providerOptions,
      validated.serverTools.tools.length > 0 ? { tools: validated.serverTools.tools } : undefined,
    );

    const result = streamText({
      model: openrouter.chat(validated.model),
      messages: validated.messages,
      system: validated.systemPrompt || undefined,
      temperature: validated.temperature,
      providerOptions: openrouterOptions ? { openrouter: openrouterOptions } : undefined,
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
      multimodal: MultimodalValidation;
      messageTransforms: MessageTransformValidation;
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
    .map(toModelMessage)
    .filter((message): message is ModelMessage => message !== null);

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
    multimodal: validateMultimodal(body.multimodal, chatMessages),
    messageTransforms: validateMessageTransforms(body.messageTransforms),
  };
}

function mergeOpenRouterOptions(
  ...optionsList: Array<Record<string, JSONValue> | undefined>
): Record<string, JSONValue> | undefined {
  const merged: Record<string, JSONValue> = {};
  const plugins: JSONValue[] = [];

  for (const options of optionsList) {
    if (!options) {
      continue;
    }

    for (const [key, value] of Object.entries(options)) {
      if (key === "plugins" && Array.isArray(value)) {
        plugins.push(...value);
        continue;
      }

      merged[key] = value;
    }
  }

  if (plugins.length > 0) {
    merged.plugins = plugins;
  }

  return Object.keys(merged).length > 0 ? merged : undefined;
}

function toModelMessage(message: ChatMessage): ModelMessage | null {
  const content = message.content.trim();

  if (message.role === "assistant") {
    return content ? { role: "assistant", content } : null;
  }

  const attachments = (message.attachments ?? []).filter(isChatAttachment);
  if (attachments.length === 0) {
    return content ? { role: "user", content } : null;
  }

  const parts: Array<
    | { type: "text"; text: string }
    | { type: "image"; image: string; mediaType: string }
    | { type: "file"; data: string; filename: string; mediaType: string }
  > = [];

  if (content) {
    parts.push({ type: "text", text: content });
  }

  for (const attachment of attachments) {
    if (attachment.kind === "image") {
      parts.push({
        type: "image",
        image: attachment.dataUrl,
        mediaType: attachment.mediaType,
      });
    } else {
      parts.push({
        type: "file",
        data: attachment.dataUrl,
        filename: attachment.name,
        mediaType: attachment.mediaType,
      });
    }
  }

  return parts.length > 0 ? { role: "user", content: parts } : null;
}

function isChatMessage(value: unknown): value is ChatMessage {
  if (!value || typeof value !== "object") {
    return false;
  }

  const message = value as Partial<ChatMessage>;
  return (
    typeof message.id === "string" &&
    (message.role === "system" || message.role === "user" || message.role === "assistant") &&
    typeof message.content === "string" &&
    (message.attachments === undefined || Array.isArray(message.attachments))
  );
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

async function createPrimedEventResponse(fullStream: AsyncIterable<TextStreamPart<any>>) {
  const iterator = fullStream[Symbol.asyncIterator]();
  let firstChunk: TextStreamPart<any>;

  try {
    for (;;) {
      const chunk = await iterator.next();
      if (chunk.done) {
        return jsonError(
          "The selected model did not return a response. Check the model id.",
          400,
          "invalid_model",
        );
      }

      const streamError = getStreamPartError(chunk.value);
      if (streamError) {
        return errorResponse(streamError);
      }

      if (isRenderableStreamPart(chunk.value)) {
        firstChunk = chunk.value;
        break;
      }
    }
  } catch (error) {
    return errorResponse(error);
  }

  const encoder = new TextEncoder();
  const stream = new ReadableStream<Uint8Array>({
    async start(controller) {
      enqueueStreamPart(controller, encoder, firstChunk);

      try {
        for (;;) {
          const chunk = await iterator.next();
          if (chunk.done) {
            enqueueEvent(controller, encoder, { type: "done" });
            controller.close();
            return;
          }

          const streamError = getStreamPartError(chunk.value);
          if (streamError) {
            enqueueEvent(controller, encoder, streamErrorEvent(streamError));
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

function isRenderableStreamPart(part: TextStreamPart<any>) {
  return (
    (part.type === "text-delta" && Boolean(part.text)) ||
    (part.type === "source" && part.sourceType === "url") ||
    part.type === "file"
  );
}

function getStreamPartError(part: TextStreamPart<any>) {
  const maybeError = part as { type?: string; error?: unknown };
  return maybeError.type === "error" ? maybeError.error : null;
}

function streamErrorEvent(error: unknown): StreamEvent {
  const publicError = publicErrorFrom(error);
  return {
    type: "error",
    error: {
      code: publicError.code,
      message: publicError.message,
    },
  };
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
    return;
  }

  if (part.type === "file") {
    enqueueEvent(controller, encoder, {
      type: "file",
      file: {
        id: createId(),
        mediaType: part.file.mediaType,
        dataUrl: `data:${part.file.mediaType};base64,${part.file.base64}`,
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

function validateMultimodal(value: unknown, messages: ChatMessage[]): MultimodalValidation {
  const settings = normalizeMultimodalSettings(value);
  const providerOptions: Record<string, JSONValue> = {};
  const hasPdfAttachment = messages.some((message) =>
    message.attachments?.some((attachment) => attachment.kind === "pdf"),
  );

  if (settings.imageGeneration.enabled) {
    providerOptions.modalities =
      settings.imageGeneration.mode === "image-only"
        ? ["image"]
        : ["image", "text"];

    if (settings.imageGeneration.aspectRatio !== "auto") {
      providerOptions.image_config = {
        aspect_ratio: settings.imageGeneration.aspectRatio,
      };
    }
  }

  if (hasPdfAttachment && settings.pdfEngine !== "auto") {
    providerOptions.plugins = [
      {
        id: "file-parser",
        pdf: {
          engine: settings.pdfEngine,
        },
      },
    ];
  }

  return { providerOptions };
}

function validateMessageTransforms(value: unknown): MessageTransformValidation {
  const settings = normalizeMessageTransforms(value);
  const plugin = settings.contextCompression.enabled
    ? { id: "context-compression" }
    : { id: "context-compression", enabled: false };

  return {
    providerOptions: {
      plugins: [plugin],
    },
  };
}

function normalizeMultimodalSettings(value: unknown): MultimodalSettings {
  if (!value || typeof value !== "object") {
    return DEFAULT_MULTIMODAL_SETTINGS;
  }

  const multimodal = value as Partial<MultimodalSettings>;
  const imageGeneration =
    multimodal.imageGeneration && typeof multimodal.imageGeneration === "object"
      ? multimodal.imageGeneration
      : {};

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
      multimodal.pdfEngine === "cloudflare-ai" ||
      multimodal.pdfEngine === "mistral-ocr" ||
      multimodal.pdfEngine === "native"
        ? multimodal.pdfEngine
        : DEFAULT_MULTIMODAL_SETTINGS.pdfEngine,
  };
}

function normalizeMessageTransforms(value: unknown): MessageTransformSettings {
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

function normalizeAspectRatio(value: unknown) {
  return value === "1:1" ||
    value === "2:3" ||
    value === "3:2" ||
    value === "3:4" ||
    value === "4:3" ||
    value === "4:5" ||
    value === "5:4" ||
    value === "9:16" ||
    value === "16:9" ||
    value === "21:9"
    ? value
    : DEFAULT_MULTIMODAL_SETTINGS.imageGeneration.aspectRatio;
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

function createId() {
  if (typeof crypto !== "undefined" && "randomUUID" in crypto) {
    return crypto.randomUUID();
  }

  return `${Date.now()}-${Math.random().toString(36).slice(2)}`;
}

function errorResponse(error: unknown, signal?: AbortSignal) {
  const publicError = publicErrorFrom(error, signal);
  if (publicError.shouldLog) {
    console.error("OpenRouter chat request failed", error);
  }

  return jsonError(publicError.message, publicError.status, publicError.code);
}

function publicErrorFrom(error: unknown, signal?: AbortSignal) {
  if (signal?.aborted || isAbortError(error)) {
    return {
      code: "aborted" as const,
      status: 499,
      message: "Streaming request was aborted.",
      shouldLog: false,
    };
  }

  const status = getErrorStatus(error);
  if (status === 429) {
    return {
      code: "rate_limited" as const,
      status: 429,
      message: "OpenRouter rate limit reached. Try again shortly.",
      shouldLog: false,
    };
  }

  if (status === 401 || status === 403) {
    return {
      code: "openrouter_failure" as const,
      status: 401,
      message: "OpenRouter rejected the API key. Check Settings.",
      shouldLog: false,
    };
  }

  if (status === 400 || status === 404) {
    return {
      code: "invalid_model" as const,
      status: 400,
      message: "The selected model is not available through OpenRouter.",
      shouldLog: false,
    };
  }

  return {
    code: "openrouter_failure" as const,
    status: 502,
    message: "OpenRouter API request failed. Try again.",
    shouldLog: true,
  };
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
