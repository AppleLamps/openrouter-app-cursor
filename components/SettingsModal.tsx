"use client";

import { useEffect, useMemo, useState } from "react";
import { CalendarClock, Check, ChevronDown, FileText, Globe2, Image as ImageIcon, KeyRound, Minimize2, RefreshCw, RotateCcw, Search, Trash2, X } from "lucide-react";
import {
  DEFAULT_MESSAGE_TRANSFORMS,
  DEFAULT_MODEL,
  DEFAULT_MULTIMODAL_SETTINGS,
  DEFAULT_SERVER_TOOLS,
  type ApiStatus,
  type ChatSettings,
  type FetchEngine,
  type ImageGenerationMode,
  type OpenRouterModel,
  type SearchContextSize,
  type SearchEngine,
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
  const [webToolsAdvancedOpen, setWebToolsAdvancedOpen] = useState(false);
  const [multimodalAdvancedOpen, setMultimodalAdvancedOpen] = useState(false);
  const serverTools = settings.serverTools ?? DEFAULT_SERVER_TOOLS;
  const multimodal = settings.multimodal ?? DEFAULT_MULTIMODAL_SETTINGS;
  const messageTransforms = settings.messageTransforms ?? DEFAULT_MESSAGE_TRANSFORMS;

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
        if (multimodal.imageGeneration.enabled) {
          params.set("output_modalities", "image");
        }
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
  }, [modelQuery, multimodal.imageGeneration.enabled, open]);

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

  function updateWebSearch(updates: Partial<ChatSettings["serverTools"]["webSearch"]>) {
    onSettingsChange({
      ...settings,
      serverTools: {
        ...serverTools,
        webSearch: {
          ...serverTools.webSearch,
          ...updates,
        },
      },
    });
  }

  function updateWebFetch(updates: Partial<ChatSettings["serverTools"]["webFetch"]>) {
    onSettingsChange({
      ...settings,
      serverTools: {
        ...serverTools,
        webFetch: {
          ...serverTools.webFetch,
          ...updates,
        },
      },
    });
  }

  function updateDatetime(updates: Partial<ChatSettings["serverTools"]["datetime"]>) {
    onSettingsChange({
      ...settings,
      serverTools: {
        ...serverTools,
        datetime: {
          ...serverTools.datetime,
          ...updates,
        },
      },
    });
  }

  function updateImageGeneration(updates: Partial<ChatSettings["multimodal"]["imageGeneration"]>) {
    onSettingsChange({
      ...settings,
      multimodal: {
        ...multimodal,
        imageGeneration: {
          ...multimodal.imageGeneration,
          ...updates,
        },
      },
    });
  }

  function updatePdfEngine(pdfEngine: ChatSettings["multimodal"]["pdfEngine"]) {
    onSettingsChange({
      ...settings,
      multimodal: {
        ...multimodal,
        pdfEngine,
      },
    });
  }

  function updateContextCompression(enabled: boolean) {
    onSettingsChange({
      ...settings,
      messageTransforms: {
        ...messageTransforms,
        contextCompression: {
          ...messageTransforms.contextCompression,
          enabled,
        },
      },
    });
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

          <section className="mb-5 rounded-xl border border-[color:var(--border)] bg-[color:var(--surface-raised)] p-3">
            <div className="mb-3 flex items-start justify-between gap-3">
              <div className="min-w-0">
                <p className="text-sm font-medium">Message transforms</p>
                <p className="mt-1 text-xs leading-5 text-[color:var(--muted)]">
                  Automatically compress long chats when they exceed the selected model context or message-count limits.
                </p>
              </div>
              <Minimize2 size={18} className="mt-0.5 shrink-0 text-[color:var(--accent)]" aria-hidden="true" />
            </div>

            <ToolToggle
              title="Auto compression"
              description="OpenRouter trims the middle of oversized prompts so long chats can continue."
              enabled={messageTransforms.contextCompression.enabled}
              onChange={updateContextCompression}
            />

            <p className="mt-3 text-xs leading-5 text-[color:var(--muted)]">
              Keep this on for long conversations. Turn it off only when exact recall of the full transcript matters more than avoiding context-limit errors.
            </p>
          </section>

          <section className="mb-5 rounded-xl border border-[color:var(--border)] bg-[color:var(--surface-raised)] p-3">
            <div className="mb-3 flex items-start justify-between gap-3">
              <div className="min-w-0">
                <p className="text-sm font-medium">Multimodal</p>
                <p className="mt-1 text-xs leading-5 text-[color:var(--muted)]">
                  Attach images or PDFs from the composer. Image generation requires a model that can output images.
                </p>
              </div>
              <ImageIcon size={18} className="mt-0.5 shrink-0 text-[color:var(--accent)]" aria-hidden="true" />
            </div>

            <div className="space-y-2">
              <ToolToggle
                title="Image generation"
                description="Ask image-capable models to return generated images with the text response."
                enabled={multimodal.imageGeneration.enabled}
                onChange={(enabled) => updateImageGeneration({ enabled })}
              />
            </div>

            <button
              type="button"
              onClick={() => setMultimodalAdvancedOpen((current) => !current)}
              className="mt-3 flex min-h-11 w-full items-center justify-between gap-3 rounded-xl border border-[color:var(--border)] px-3 text-left text-sm text-[color:var(--foreground)] transition active:scale-[0.99]"
            >
              <span>Advanced multimodal options</span>
              <ChevronDown
                size={17}
                aria-hidden="true"
                className={`shrink-0 transition ${multimodalAdvancedOpen ? "rotate-180" : ""}`}
              />
            </button>

            {multimodalAdvancedOpen ? (
              <div className="mt-3 space-y-4 border-t border-[color:var(--border)] pt-3">
                <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                  <SelectField
                    label="Image output mode"
                    value={multimodal.imageGeneration.mode}
                    onChange={(value) => updateImageGeneration({ mode: value as ImageGenerationMode })}
                    options={["text-and-image", "image-only"]}
                  />
                  <SelectField
                    label="Image aspect ratio"
                    value={multimodal.imageGeneration.aspectRatio}
                    onChange={(value) => updateImageGeneration({ aspectRatio: value })}
                    options={["auto", "1:1", "2:3", "3:2", "3:4", "4:3", "4:5", "5:4", "9:16", "16:9", "21:9"]}
                  />
                </div>

                <label className="block">
                  <span className="mb-2 flex items-center gap-2 text-sm font-medium">
                    <FileText size={16} aria-hidden="true" />
                    PDF parser
                  </span>
                  <select
                    value={multimodal.pdfEngine}
                    onChange={(event) => updatePdfEngine(event.target.value as ChatSettings["multimodal"]["pdfEngine"])}
                    className="min-h-12 w-full rounded-xl border border-[color:var(--border)] bg-[color:var(--background)] px-3 text-base text-[color:var(--foreground)]"
                  >
                    <option value="auto">auto</option>
                    <option value="cloudflare-ai">cloudflare-ai</option>
                    <option value="mistral-ocr">mistral-ocr</option>
                    <option value="native">native</option>
                  </select>
                </label>

                <p className="text-xs leading-5 text-[color:var(--muted)]">
                  Local images and PDFs are sent to OpenRouter as data URLs. PDF OCR/parser choices and image output models may add provider costs.
                </p>
              </div>
            ) : null}
          </section>

          <section className="mb-5 rounded-xl border border-[color:var(--border)] bg-[color:var(--surface-raised)] p-3">
            <div className="mb-3 flex items-start justify-between gap-3">
              <div className="min-w-0">
                <p className="text-sm font-medium">Web tools</p>
                <p className="mt-1 text-xs leading-5 text-[color:var(--muted)]">
                  Optional OpenRouter server tools. Web search and fetch are beta and may add provider/tool costs.
                </p>
              </div>
              <Globe2 size={18} className="mt-0.5 shrink-0 text-[color:var(--accent)]" aria-hidden="true" />
            </div>

            <div className="space-y-2">
              <ToolToggle
                title="Web Search"
                description="Let the model search current web results when needed."
                enabled={serverTools.webSearch.enabled}
                onChange={(enabled) => updateWebSearch({ enabled })}
              />
              <ToolToggle
                title="Web Fetch"
                description="Let the model fetch and read URLs mentioned in chat."
                enabled={serverTools.webFetch.enabled}
                onChange={(enabled) => updateWebFetch({ enabled })}
              />
              <ToolToggle
                title="Datetime"
                description="Give the model current date and time. No extra tool cost."
                enabled={serverTools.datetime.enabled}
                onChange={(enabled) => updateDatetime({ enabled })}
              />
            </div>

            <button
              type="button"
              onClick={() => setWebToolsAdvancedOpen((current) => !current)}
              className="mt-3 flex min-h-11 w-full items-center justify-between gap-3 rounded-xl border border-[color:var(--border)] px-3 text-left text-sm text-[color:var(--foreground)] transition active:scale-[0.99]"
            >
              <span>Advanced web options</span>
              <ChevronDown
                size={17}
                aria-hidden="true"
                className={`shrink-0 transition ${webToolsAdvancedOpen ? "rotate-180" : ""}`}
              />
            </button>

            {webToolsAdvancedOpen ? (
              <div className="mt-3 space-y-4 border-t border-[color:var(--border)] pt-3">
                <div>
                  <p className="mb-2 text-sm font-medium">Web Search</p>
                  <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                    <SelectField
                      label="Search engine"
                      value={serverTools.webSearch.engine}
                      onChange={(value) => updateWebSearch({ engine: value as SearchEngine })}
                      options={["auto", "native", "exa", "firecrawl", "parallel", "perplexity"]}
                    />
                    <SelectField
                      label="Context size"
                      value={serverTools.webSearch.searchContextSize}
                      onChange={(value) => updateWebSearch({ searchContextSize: value as SearchContextSize })}
                      options={["auto", "low", "medium", "high"]}
                    />
                    <NumberField
                      label="Max results per search"
                      value={serverTools.webSearch.maxResults}
                      min={1}
                      max={25}
                      onChange={(value) => updateWebSearch({ maxResults: value })}
                    />
                    <NumberField
                      label="Total result cap"
                      value={serverTools.webSearch.maxTotalResults}
                      min={1}
                      max={100}
                      onChange={(value) => updateWebSearch({ maxTotalResults: value })}
                    />
                  </div>
                  <DomainField
                    label="Allowed search domains"
                    value={serverTools.webSearch.allowedDomains}
                    onChange={(domains) => updateWebSearch({ allowedDomains: domains })}
                  />
                  <DomainField
                    label="Excluded search domains"
                    value={serverTools.webSearch.excludedDomains}
                    onChange={(domains) => updateWebSearch({ excludedDomains: domains })}
                  />
                  {serverTools.webSearch.allowedDomains.length > 0 && serverTools.webSearch.excludedDomains.length > 0 ? (
                    <p className="mt-2 text-xs leading-5 text-[color:var(--muted)]">
                      Some search engines treat allowed and excluded domains as mutually exclusive; allowed domains take precedence where required.
                    </p>
                  ) : null}
                </div>

                <div>
                  <p className="mb-2 text-sm font-medium">Web Fetch</p>
                  <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                    <SelectField
                      label="Fetch engine"
                      value={serverTools.webFetch.engine}
                      onChange={(value) => updateWebFetch({ engine: value as FetchEngine })}
                      options={["auto", "native", "exa", "openrouter", "firecrawl", "parallel"]}
                    />
                    <NumberField
                      label="Max fetches"
                      value={serverTools.webFetch.maxUses}
                      min={1}
                      max={50}
                      onChange={(value) => updateWebFetch({ maxUses: value })}
                    />
                    <NumberField
                      label="Max content tokens"
                      value={serverTools.webFetch.maxContentTokens}
                      min={1000}
                      max={200000}
                      onChange={(value) => updateWebFetch({ maxContentTokens: value })}
                    />
                  </div>
                  <DomainField
                    label="Allowed fetch domains"
                    value={serverTools.webFetch.allowedDomains}
                    onChange={(domains) => updateWebFetch({ allowedDomains: domains })}
                  />
                  <DomainField
                    label="Blocked fetch domains"
                    value={serverTools.webFetch.blockedDomains}
                    onChange={(domains) => updateWebFetch({ blockedDomains: domains })}
                  />
                </div>

                <label className="block">
                  <span className="mb-2 flex items-center gap-2 text-sm font-medium">
                    <CalendarClock size={16} aria-hidden="true" />
                    Datetime timezone
                  </span>
                  <input
                    value={serverTools.datetime.timezone}
                    spellCheck={false}
                    autoCapitalize="off"
                    autoCorrect="off"
                    placeholder="America/New_York"
                    onChange={(event) => updateDatetime({ timezone: event.target.value })}
                    className="min-h-12 w-full rounded-xl border border-[color:var(--border)] bg-[color:var(--background)] px-3 text-base text-[color:var(--foreground)]"
                  />
                </label>
              </div>
            ) : null}
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

function ToolToggle({
  title,
  description,
  enabled,
  onChange,
}: {
  title: string;
  description: string;
  enabled: boolean;
  onChange: (enabled: boolean) => void;
}) {
  return (
    <button
      type="button"
      onClick={() => onChange(!enabled)}
      className="flex min-h-14 w-full items-center justify-between gap-3 rounded-xl border border-[color:var(--border)] bg-[color:var(--background)] px-3 py-2 text-left transition active:scale-[0.99]"
    >
      <span className="min-w-0">
        <span className="block text-sm font-medium">{title}</span>
        <span className="block text-xs leading-5 text-[color:var(--muted)]">{description}</span>
      </span>
      <span
        className={`flex h-7 w-12 shrink-0 items-center rounded-full p-1 transition ${
          enabled ? "justify-end bg-[color:var(--accent-strong)]" : "justify-start bg-[color:var(--surface-muted)]"
        }`}
        aria-hidden="true"
      >
        <span className="h-5 w-5 rounded-full bg-[color:var(--background)] shadow" />
      </span>
    </button>
  );
}

function SelectField({
  label,
  value,
  options,
  onChange,
}: {
  label: string;
  value: string;
  options: string[];
  onChange: (value: string) => void;
}) {
  return (
    <label className="block">
      <span className="mb-2 block text-xs font-medium text-[color:var(--muted)]">{label}</span>
      <select
        value={value}
        onChange={(event) => onChange(event.target.value)}
        className="min-h-12 w-full rounded-xl border border-[color:var(--border)] bg-[color:var(--background)] px-3 text-base text-[color:var(--foreground)]"
      >
        {options.map((option) => (
          <option key={option} value={option}>
            {option}
          </option>
        ))}
      </select>
    </label>
  );
}

function NumberField({
  label,
  value,
  min,
  max,
  onChange,
}: {
  label: string;
  value: number;
  min: number;
  max: number;
  onChange: (value: number) => void;
}) {
  return (
    <label className="block">
      <span className="mb-2 block text-xs font-medium text-[color:var(--muted)]">{label}</span>
      <input
        type="number"
        inputMode="numeric"
        min={min}
        max={max}
        value={value}
        onChange={(event) => onChange(clampNumber(Number(event.target.value), min, max, value))}
        className="min-h-12 w-full rounded-xl border border-[color:var(--border)] bg-[color:var(--background)] px-3 text-base text-[color:var(--foreground)]"
      />
    </label>
  );
}

function DomainField({
  label,
  value,
  onChange,
}: {
  label: string;
  value: string[];
  onChange: (value: string[]) => void;
}) {
  return (
    <label className="mt-3 block">
      <span className="mb-2 block text-xs font-medium text-[color:var(--muted)]">{label}</span>
      <textarea
        value={value.join("\n")}
        rows={2}
        spellCheck={false}
        autoCapitalize="off"
        autoCorrect="off"
        placeholder="example.com, docs.example.com"
        onChange={(event) => onChange(parseDomains(event.target.value))}
        className="min-h-20 w-full resize-y rounded-xl border border-[color:var(--border)] bg-[color:var(--background)] px-3 py-2 text-base leading-6 text-[color:var(--foreground)]"
      />
    </label>
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

function parseDomains(value: string) {
  return Array.from(
    new Set(
      value
        .split(/[,\n]/)
        .map((domain) => domain.trim().toLowerCase())
        .filter(Boolean),
    ),
  );
}

function clampNumber(value: number, min: number, max: number, fallback: number) {
  if (!Number.isFinite(value)) {
    return fallback;
  }

  return Math.min(max, Math.max(min, Math.round(value)));
}
