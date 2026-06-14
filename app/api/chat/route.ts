import { createOpenRouter } from "@openrouter/ai-sdk-provider";
import { streamText, type ModelMessage } from "ai";
import { DEFAULT_MODEL, type ChatMessage } from "@/lib/types";

export const runtime = "nodejs";
export const maxDuration = 60;

type ChatRequestBody = {
  apiKey?: unknown;
  messages?: unknown;
  model?: unknown;
  systemPrompt?: unknown;
  temperature?: unknown;
};

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
      abortSignal: req.signal,
    });

    return await createPrimedTextResponse(result.textStream);
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

async function createPrimedTextResponse(textStream: AsyncIterable<string>) {
  const iterator = textStream[Symbol.asyncIterator]();
  let firstChunk: IteratorResult<string>;

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
      controller.enqueue(encoder.encode(firstChunk.value));

      try {
        for (;;) {
          const chunk = await iterator.next();
          if (chunk.done) {
            controller.close();
            return;
          }
          controller.enqueue(encoder.encode(chunk.value));
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
      "Content-Type": "text/plain; charset=utf-8",
      "X-Content-Type-Options": "nosniff",
    },
  });
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
