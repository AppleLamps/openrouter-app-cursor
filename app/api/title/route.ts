import { createOpenRouter } from "@openrouter/ai-sdk-provider";
import { generateText, type ModelMessage } from "ai";
import { DEFAULT_MODEL, type ChatMessage } from "@/lib/types";
import { parseTitleResponse, RESPONSE_HEALING_PLUGIN, TITLE_RESPONSE_FORMAT } from "@/lib/openrouter";
import { isChatAttachment, isChatMessage } from "@/lib/validation";

export const runtime = "nodejs";
export const maxDuration = 30;

type TitleRequestBody = {
  apiKey?: unknown;
  messages?: unknown;
};

type PublicErrorCode = "invalid_input" | "missing_api_key" | "openrouter_failure";

const TITLE_SYSTEM_PROMPT =
  "Generate a concise 3-6 word title for this conversation. Reply with only the title, no quotes or punctuation.";

export async function POST(req: Request) {
  let body: TitleRequestBody;
  try {
    body = (await req.json()) as TitleRequestBody;
  } catch {
    return jsonError("Request body must be valid JSON.", 400, "invalid_input");
  }

  const validated = validateTitleRequestBody(body);
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
    const result = await generateText({
      model: openrouter.chat(DEFAULT_MODEL, {
        extraBody: {
          response_format: TITLE_RESPONSE_FORMAT,
          plugins: [RESPONSE_HEALING_PLUGIN],
        },
      }),
      system: TITLE_SYSTEM_PROMPT,
      messages: validated.messages,
      temperature: 0.4,
      abortSignal: req.signal,
    });

    const title = parseTitleResponse(result.text);
    if (!title) {
      return jsonError("Could not generate a title.", 502, "openrouter_failure");
    }

    return Response.json({ title });
  } catch (error) {
    if (isAbortError(error)) {
      return jsonError("Title generation was cancelled.", 499, "openrouter_failure");
    }

    const message = error instanceof Error ? error.message : "Title generation failed.";
    return jsonError(message, 502, "openrouter_failure");
  }
}

function validateTitleRequestBody(body: TitleRequestBody):
  | {
      ok: true;
      apiKey: string;
      messages: ModelMessage[];
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

  if (messages.length === 0) {
    return {
      ok: false,
      status: 400,
      code: "invalid_input",
      message: "At least one user or assistant message is required.",
    };
  }

  return {
    ok: true,
    apiKey,
    messages,
  };
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

function isAbortError(error: unknown) {
  return (
    (error instanceof DOMException && error.name === "AbortError") ||
    (error instanceof Error && /aborted|abort/i.test(error.message))
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
