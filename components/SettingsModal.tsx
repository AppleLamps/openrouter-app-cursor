"use client";

import { useEffect, useMemo, useState } from "react";
import { Check, KeyRound, RefreshCw, RotateCcw, Search, Trash2, X } from "lucide-react";
import {
  DEFAULT_MODEL,
  type ApiStatus,
  type ChatSettings,
  type OpenRouterModel,
} from "@/lib/types";

type SettingsModalProps = {
  open: boolean;
  settings: ChatSettings;
  apiStatus: ApiStatus;
  apiStatusText: string;
  onClose: () => void;
  onValidateApiKey: (apiKey?: string) => void;
  onSettingsChange: (settings: ChatSettings) => void;
  onClearChat: () => void;
  onResetSettings: () => void;
};

type ModelsResponse = {
  data?: OpenRouterModel[];
  error?: {
    message?: string;
  };
};

export function SettingsModal({
  open,
  settings,
  apiStatus,
  apiStatusText,
  onClose,
  onValidateApiKey,
  onSettingsChange,
  onClearChat,
  onResetSettings,
}: SettingsModalProps) {
  const [draftApiKey, setDraftApiKey] = useState(settings.apiKey ?? "");
  const [modelQuery, setModelQuery] = useState(settings.model);
  const [models, setModels] = useState<OpenRouterModel[]>([]);
  const [modelsLoading, setModelsLoading] = useState(false);
  const [modelsError, setModelsError] = useState("");

  useEffect(() => {
    if (!open) {
      return;
    }

    setDraftApiKey(settings.apiKey ?? "");
    setModelQuery(settings.model || DEFAULT_MODEL);
  }, [open, settings.apiKey, settings.model]);

  useEffect(() => {
    if (!open) {
      return;
    }

    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") {
        onClose();
      }
    }

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [onClose, open]);

  useEffect(() => {
    if (!open) {
      return;
    }

    const controller = new AbortController();
    const timeout = window.setTimeout(async () => {
      setModelsLoading(true);
      setModelsError("");
      try {
        const params = new URLSearchParams({
          sort: "most-popular",
        });
        if (modelQuery.trim()) {
          params.set("q", modelQuery.trim());
        }

        const response = await fetch(`/api/models?${params.toString()}`, {
          signal: controller.signal,
        });
        const data = (await response.json()) as ModelsResponse;

        if (!response.ok) {
          setModels([]);
          setModelsError(data.error?.message ?? "Could not load models.");
          return;
        }

        setModels(data.data ?? []);
      } catch (error) {
        if (!controller.signal.aborted) {
          setModels([]);
          setModelsError("Could not load models.");
        }
      } finally {
        if (!controller.signal.aborted) {
          setModelsLoading(false);
        }
      }
    }, 250);

    return () => {
      window.clearTimeout(timeout);
      controller.abort();
    };
  }, [modelQuery, open]);

  const savedKeyLabel = useMemo(() => maskApiKey(settings.apiKey), [settings.apiKey]);

  if (!open) {
    return null;
  }

  function saveApiKey() {
    const nextApiKey = draftApiKey.trim();
    onSettingsChange({
      ...settings,
      apiKey: nextApiKey || undefined,
    });
    onValidateApiKey(nextApiKey);
  }

  function removeApiKey() {
    setDraftApiKey("");
    onSettingsChange({
      ...settings,
      apiKey: undefined,
    });
    onValidateApiKey("");
  }

  return (
    <div
      className="modal-safe fixed inset-0 z-[70] flex items-end bg-black/60 backdrop-blur-sm sm:items-center sm:justify-center"
      role="dialog"
      aria-modal="true"
      aria-labelledby="settings-title"
      onMouseDown={(event) => {
        if (event.target === event.currentTarget) {
          onClose();
        }
      }}
    >
      <section className="max-h-full w-full overflow-hidden rounded-t-3xl border border-[color:var(--border)] bg-[color:var(--surface)] shadow-2xl sm:max-w-2xl sm:rounded-3xl">
        <header className="flex items-center justify-between gap-3 border-b border-[color:var(--border)] px-4 py-3">
          <div>
            <h2 id="settings-title" className="text-base font-semibold">
              Settings
            </h2>
            <p className="text-xs text-[color:var(--muted)]">{apiStatusText}</p>
          </div>
          <button
            type="button"
            title="Close"
            aria-label="Close"
            onClick={onClose}
            className="grid min-h-11 min-w-11 place-items-center rounded-full bg-[color:var(--surface-muted)] text-[color:var(--muted)] transition active:scale-95"
          >
            <X size={18} aria-hidden="true" />
          </button>
        </header>

        <div className="scroll-area max-h-[min(78dvh,48rem)] overflow-y-auto px-4 py-4">
          <section className="mb-5 rounded-xl border border-[color:var(--border)] bg-[color:var(--surface-raised)] p-3">
            <div className="mb-3 flex items-center justify-between gap-3">
              <div className="min-w-0">
                <p className="text-sm font-medium">API key</p>
                <p className="truncate text-xs text-[color:var(--muted)]">{savedKeyLabel || apiStatusLabel(apiStatus)}</p>
              </div>
              <button
                type="button"
                title="Validate API key"
                aria-label="Validate API key"
                onClick={() => onValidateApiKey()}
                className="grid min-h-11 min-w-11 shrink-0 place-items-center rounded-full bg-[color:var(--surface-muted)] text-[color:var(--foreground)] transition active:scale-95"
              >
                <RefreshCw size={17} aria-hidden="true" />
              </button>
            </div>
            <div className="flex flex-col gap-2 sm:flex-row">
              <label className="min-w-0 flex-1">
                <span className="sr-only">OpenRouter API key</span>
                <div className="flex min-h-12 items-center gap-2 rounded-xl border border-[color:var(--border)] bg-[color:var(--background)] px-3">
                  <KeyRound size={17} className="shrink-0 text-[color:var(--muted)]" aria-hidden="true" />
                  <input
                    value={draftApiKey}
                    type="password"
                    spellCheck={false}
                    autoCapitalize="off"
                    autoCorrect="off"
                    placeholder="sk-or-..."
                    onChange={(event) => setDraftApiKey(event.target.value)}
                    className="min-w-0 flex-1 bg-transparent text-base outline-none placeholder:text-[color:var(--muted)]"
                  />
                </div>
              </label>
              <button
                type="button"
                onClick={saveApiKey}
                className="inline-flex min-h-12 items-center justify-center gap-2 rounded-xl bg-[color:var(--accent-strong)] px-4 text-sm font-medium text-[color:var(--background)] transition active:scale-[0.98]"
              >
                <Check size={17} aria-hidden="true" />
                Save
              </button>
              <button
                type="button"
                onClick={removeApiKey}
                className="inline-flex min-h-12 items-center justify-center gap-2 rounded-xl border border-[color:var(--border)] px-4 text-sm font-medium text-[color:var(--foreground)] transition active:scale-[0.98]"
              >
                <Trash2 size={17} aria-hidden="true" />
                Remove
              </button>
            </div>
          </section>

          <section className="mb-5">
            <div className="mb-3">
              <label className="mb-2 block text-sm font-medium">Model search</label>
              <div className="flex min-h-12 items-center gap-2 rounded-xl border border-[color:var(--border)] bg-[color:var(--surface-raised)] px-3">
                <Search size={17} className="shrink-0 text-[color:var(--muted)]" aria-hidden="true" />
                <input
                  value={modelQuery}
                  spellCheck={false}
                  autoCapitalize="off"
                  autoCorrect="off"
                  placeholder="Search OpenRouter models"
                  onChange={(event) => setModelQuery(event.target.value)}
                  className="min-w-0 flex-1 bg-transparent text-base text-[color:var(--foreground)] outline-none placeholder:text-[color:var(--muted)]"
                />
              </div>
            </div>

            <label className="mb-3 block">
              <span className="mb-2 block text-sm font-medium">Selected model</span>
              <input
                value={settings.model}
                spellCheck={false}
                autoCapitalize="off"
                autoCorrect="off"
                onChange={(event) =>
                  onSettingsChange({
                    ...settings,
                    model: event.target.value,
                  })
                }
                className="min-h-12 w-full rounded-xl border border-[color:var(--border)] bg-[color:var(--surface-raised)] px-3 text-base text-[color:var(--foreground)]"
              />
            </label>

            <div className="scroll-area max-h-72 space-y-2 overflow-y-auto rounded-xl border border-[color:var(--border)] bg-[color:var(--background)] p-2">
              {modelsLoading ? (
                <p className="px-2 py-5 text-center text-sm text-[color:var(--muted)]">Loading models...</p>
              ) : modelsError ? (
                <p className="px-2 py-5 text-center text-sm text-[color:var(--muted)]">{modelsError}</p>
              ) : models.length === 0 ? (
                <p className="px-2 py-5 text-center text-sm text-[color:var(--muted)]">No models found.</p>
              ) : (
                models.map((model) => (
                  <button
                    key={model.id}
                    type="button"
                    onClick={() => {
                      onSettingsChange({
                        ...settings,
                        model: model.id,
                      });
                      setModelQuery(model.id);
                    }}
                    className={`block min-h-16 w-full rounded-lg px-3 py-2 text-left transition active:scale-[0.99] ${
                      settings.model === model.id
                        ? "bg-[color:var(--accent-strong)] text-[color:var(--background)]"
                        : "bg-[color:var(--surface-raised)] text-[color:var(--foreground)]"
                    }`}
                  >
                    <span className="block truncate text-sm font-medium">{model.name}</span>
                    <span className="block truncate text-xs opacity-75">{model.id}</span>
                    <span className="mt-1 block truncate text-xs opacity-75">
                      {formatContext(model.contextLength)} context · {formatPrice(model.pricing.prompt)}/{formatPrice(model.pricing.completion)}
                    </span>
                  </button>
                ))
              )}
            </div>
          </section>

          <label className="mb-4 block">
            <span className="mb-2 block text-sm font-medium">System prompt</span>
            <textarea
              value={settings.systemPrompt}
              rows={4}
              onChange={(event) =>
                onSettingsChange({
                  ...settings,
                  systemPrompt: event.target.value,
                })
              }
              className="min-h-28 w-full resize-y rounded-xl border border-[color:var(--border)] bg-[color:var(--surface-raised)] px-3 py-3 text-base leading-6 text-[color:var(--foreground)]"
            />
          </label>

          <label className="mb-5 block">
            <span className="mb-2 flex items-center justify-between gap-3 text-sm font-medium">
              <span>Temperature</span>
              <span className="text-[color:var(--muted)]">{settings.temperature.toFixed(1)}</span>
            </span>
            <input
              type="range"
              min="0"
              max="2"
              step="0.1"
              value={settings.temperature}
              onChange={(event) =>
                onSettingsChange({
                  ...settings,
                  temperature: Number(event.target.value),
                })
              }
              className="h-11 w-full accent-[color:var(--accent-strong)]"
            />
          </label>

          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <button
              type="button"
              onClick={onClearChat}
              className="inline-flex min-h-12 items-center justify-center gap-2 rounded-xl border border-[color:var(--border)] bg-[color:var(--surface-raised)] px-4 text-sm font-medium text-[color:var(--foreground)] transition active:scale-[0.98]"
            >
              <Trash2 size={17} aria-hidden="true" />
              Clear chat
            </button>
            <button
              type="button"
              onClick={onResetSettings}
              className="inline-flex min-h-12 items-center justify-center gap-2 rounded-xl bg-[color:var(--foreground)] px-4 text-sm font-medium text-[color:var(--background)] transition active:scale-[0.98]"
            >
              <RotateCcw size={17} aria-hidden="true" />
              Reset settings
            </button>
          </div>
        </div>
      </section>
    </div>
  );
}

function apiStatusLabel(status: ApiStatus) {
  switch (status) {
    case "checking":
      return "Checking...";
    case "configured":
      return "API key valid";
    case "invalid":
      return "API key invalid";
    case "missing":
      return "API key missing";
    default:
      return "Status unavailable";
  }
}

function maskApiKey(apiKey?: string) {
  if (!apiKey) {
    return "";
  }

  if (apiKey.length <= 12) {
    return "Saved key";
  }

  return `${apiKey.slice(0, 7)}...${apiKey.slice(-4)}`;
}

function formatContext(contextLength: number | null) {
  if (!contextLength) {
    return "Unknown";
  }

  return Intl.NumberFormat("en", { notation: "compact" }).format(contextLength);
}

function formatPrice(price?: string) {
  const numeric = Number(price);
  if (!Number.isFinite(numeric)) {
    return "n/a";
  }

  return `$${(numeric * 1_000_000).toFixed(numeric * 1_000_000 < 1 ? 2 : 1)}/M`;
}
