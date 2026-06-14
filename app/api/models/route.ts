import type { OpenRouterModel } from "@/lib/types";

const ALLOWED_SORTS = new Set([
  "pricing-low-to-high",
  "pricing-high-to-low",
  "context-high-to-low",
  "throughput-high-to-low",
  "latency-low-to-high",
  "most-popular",
  "top-weekly",
  "newest",
]);

type OpenRouterModelResponse = {
  data?: unknown;
};

type RawOpenRouterModel = {
  id?: unknown;
  name?: unknown;
  context_length?: unknown;
  created?: unknown;
  pricing?: {
    prompt?: unknown;
    completion?: unknown;
    request?: unknown;
    image?: unknown;
    web_search?: unknown;
  };
  architecture?: {
    modality?: unknown;
    input_modalities?: unknown;
    output_modalities?: unknown;
    tokenizer?: unknown;
  };
  top_provider?: {
    context_length?: unknown;
    max_completion_tokens?: unknown;
    is_moderated?: unknown;
  };
};

export async function GET(req: Request) {
  const requestUrl = new URL(req.url);
  const q = requestUrl.searchParams.get("q")?.trim();
  const sort = requestUrl.searchParams.get("sort")?.trim() || "most-popular";

  const openRouterUrl = new URL("https://openrouter.ai/api/v1/models");
  openRouterUrl.searchParams.set("output_modalities", "text");
  if (q) {
    openRouterUrl.searchParams.set("q", q);
  }
  if (ALLOWED_SORTS.has(sort)) {
    openRouterUrl.searchParams.set("sort", sort);
  }

  try {
    const response = await fetch(openRouterUrl, {
      headers: {
        Accept: "application/json",
      },
      cache: "no-store",
    });

    if (!response.ok) {
      return Response.json(
        {
          error: {
            code: "models_unavailable",
            message: "OpenRouter models are unavailable. Try again.",
          },
        },
        { status: 502 },
      );
    }

    const payload = (await response.json()) as OpenRouterModelResponse;
    const rawModels = Array.isArray(payload.data) ? payload.data : [];
    const models = rawModels.map(toModel).filter((model): model is OpenRouterModel => Boolean(model));

    return Response.json({
      data: models.slice(0, 40),
    });
  } catch {
    return Response.json(
      {
        error: {
          code: "network_failure",
          message: "Could not reach OpenRouter models. Check your connection.",
        },
      },
      { status: 502 },
    );
  }
}

function toModel(value: unknown): OpenRouterModel | null {
  if (!value || typeof value !== "object") {
    return null;
  }

  const raw = value as RawOpenRouterModel;
  if (typeof raw.id !== "string" || typeof raw.name !== "string") {
    return null;
  }

  return {
    id: raw.id,
    name: raw.name,
    contextLength: typeof raw.context_length === "number" ? raw.context_length : null,
    created: typeof raw.created === "number" ? raw.created : undefined,
    pricing: {
      prompt: stringValue(raw.pricing?.prompt),
      completion: stringValue(raw.pricing?.completion),
      request: stringValue(raw.pricing?.request),
      image: stringValue(raw.pricing?.image),
      webSearch: stringValue(raw.pricing?.web_search),
    },
    architecture: {
      modality: stringValue(raw.architecture?.modality),
      inputModalities: stringArray(raw.architecture?.input_modalities),
      outputModalities: stringArray(raw.architecture?.output_modalities),
      tokenizer: stringValue(raw.architecture?.tokenizer),
    },
    topProvider: {
      contextLength:
        typeof raw.top_provider?.context_length === "number"
          ? raw.top_provider.context_length
          : null,
      maxCompletionTokens:
        typeof raw.top_provider?.max_completion_tokens === "number"
          ? raw.top_provider.max_completion_tokens
          : null,
      isModerated:
        typeof raw.top_provider?.is_moderated === "boolean"
          ? raw.top_provider.is_moderated
          : null,
    },
  };
}

function stringValue(value: unknown) {
  return typeof value === "string" ? value : undefined;
}

function stringArray(value: unknown) {
  return Array.isArray(value) ? value.filter((item): item is string => typeof item === "string") : [];
}
