type KeyStatusBody = {
  apiKey?: unknown;
};

type OpenRouterKeyResponse = {
  data?: {
    label?: unknown;
    limit?: unknown;
    limit_remaining?: unknown;
    limit_reset?: unknown;
    usage?: unknown;
    usage_daily?: unknown;
    usage_weekly?: unknown;
    usage_monthly?: unknown;
    is_free_tier?: unknown;
  };
};

export async function POST(req: Request) {
  let body: KeyStatusBody;
  try {
    body = (await req.json()) as KeyStatusBody;
  } catch {
    return jsonError("Request body must be valid JSON.", 400, "invalid_input");
  }

  const apiKey = typeof body.apiKey === "string" ? body.apiKey.trim() : "";
  if (!apiKey) {
    return jsonError("Add an OpenRouter API key in Settings.", 400, "missing_api_key");
  }

  try {
    const response = await fetch("https://openrouter.ai/api/v1/key", {
      headers: {
        Accept: "application/json",
        Authorization: `Bearer ${apiKey}`,
      },
      cache: "no-store",
    });

    if (response.status === 401 || response.status === 403) {
      return Response.json({
        configured: false,
        error: {
          code: "invalid_api_key",
          message: "OpenRouter rejected this API key.",
        },
      });
    }

    if (!response.ok) {
      return jsonError("Could not validate the OpenRouter API key.", 502, "openrouter_failure");
    }

    const payload = (await response.json()) as OpenRouterKeyResponse;
    const data = payload.data ?? {};

    return Response.json({
      configured: true,
      label: typeof data.label === "string" ? data.label : undefined,
      limit: numberOrNull(data.limit),
      limitRemaining: numberOrNull(data.limit_remaining),
      limitReset: typeof data.limit_reset === "string" ? data.limit_reset : null,
      usage: numberOrNull(data.usage),
      usageDaily: numberOrNull(data.usage_daily),
      usageWeekly: numberOrNull(data.usage_weekly),
      usageMonthly: numberOrNull(data.usage_monthly),
      isFreeTier: typeof data.is_free_tier === "boolean" ? data.is_free_tier : null,
    });
  } catch {
    return jsonError("Could not reach OpenRouter to validate the key.", 502, "network_failure");
  }
}

function numberOrNull(value: unknown) {
  return typeof value === "number" && Number.isFinite(value) ? value : null;
}

function jsonError(message: string, status: number, code: string) {
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
