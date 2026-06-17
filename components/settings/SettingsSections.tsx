"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import {
  CalendarClock,
  Brain,
  Check,
  ChevronDown,
  Database,
  Download,
  FileText,
  Globe2,
  Image as ImageIcon,
  KeyRound,
  Minimize2,
  RefreshCw,
  RotateCcw,
  Route,
  Search,
  Trash2,
  Upload,
} from "lucide-react";
import {
  DEFAULT_MESSAGE_TRANSFORMS,
  DEFAULT_MODEL,
  DEFAULT_MULTIMODAL_SETTINGS,
  DEFAULT_PROVIDER_ROUTING,
  DEFAULT_REASONING,
  DEFAULT_RESPONSE_CACHING,
  DEFAULT_SERVER_TOOLS,
  type ApiStatus,
  type ChatSettings,
  type FetchEngine,
  type ImageGenerationMode,
  type OpenRouterModel,
  type ProviderSort,
  type ReasoningEffort,
  type SearchContextSize,
  type SearchEngine,
} from "@/lib/types";
import {
  MODEL_VARIANT_OPTIONS,
  parseModelWithVariants,
  setModelBase,
  toggleModelVariant,
} from "@/lib/model-variants";
import { OPENROUTER_ROUTER_PICKS } from "@/lib/openrouter";

type SettingsChange = (settings: ChatSettings) => void;

type ModelsResponse = {
  data?: OpenRouterModel[];
  error?: {
    message?: string;
  };
};

export function SetupSettingsSection({
  settings,
  apiStatus,
  onValidateApiKey,
  onSettingsChange,
}: {
  settings: ChatSettings;
  apiStatus: ApiStatus;
  onValidateApiKey: (apiKey?: string) => void;
  onSettingsChange: SettingsChange;
}) {
  const [draftApiKey, setDraftApiKey] = useState(settings.apiKey ?? "");
  const savedKeyLabel = useMemo(() => maskApiKey(settings.apiKey), [settings.apiKey]);

  useEffect(() => {
    setDraftApiKey(settings.apiKey ?? "");
  }, [settings.apiKey]);

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
    <SectionCard title="API key" description="Save your OpenRouter key locally on this device. It is sent only to local route handlers." icon={<KeyRound size={18} aria-hidden="true" />}>
      <div className="mb-3 flex items-center justify-between gap-3 rounded-xl border border-(--border) bg-(--background) px-3 py-2">
        <div className="min-w-0">
          <p className="text-sm font-medium">Current status</p>
          <p className="truncate text-xs text-(--muted)">{savedKeyLabel || apiStatusLabel(apiStatus)}</p>
        </div>
        <button
          type="button"
          title="Validate API key"
          aria-label="Validate API key"
          onClick={() => onValidateApiKey()}
          className="grid min-h-11 min-w-11 shrink-0 place-items-center rounded-full bg-(--surface-muted) text-(--foreground) transition active:scale-95"
        >
          <RefreshCw size={17} aria-hidden="true" />
        </button>
      </div>

      <div className="flex flex-col gap-2 sm:flex-row">
        <label className="min-w-0 flex-1">
          <span className="sr-only">OpenRouter API key</span>
          <div className="flex min-h-12 items-center gap-2 rounded-xl border border-(--border) bg-(--background) px-3">
            <KeyRound size={17} className="shrink-0 text-(--muted)" aria-hidden="true" />
            <input
              value={draftApiKey}
              type="password"
              spellCheck={false}
              autoCapitalize="off"
              autoCorrect="off"
              placeholder="sk-or-..."
              onChange={(event) => setDraftApiKey(event.target.value)}
              className="min-w-0 flex-1 bg-transparent text-base outline-none placeholder:text-(--muted)"
            />
          </div>
        </label>
        <button
          type="button"
          onClick={saveApiKey}
          className="inline-flex min-h-12 items-center justify-center gap-2 rounded-xl bg-(--accent-strong) px-4 text-sm font-medium text-(--background) transition active:scale-[0.98]"
        >
          <Check size={17} aria-hidden="true" />
          Save
        </button>
        <button
          type="button"
          onClick={removeApiKey}
          className="inline-flex min-h-12 items-center justify-center gap-2 rounded-xl border border-(--border) px-4 text-sm font-medium text-(--foreground) transition active:scale-[0.98]"
        >
          <Trash2 size={17} aria-hidden="true" />
          Remove
        </button>
      </div>
    </SectionCard>
  );
}

export function ModelSettingsSection({
  settings,
  onSettingsChange,
}: {
  settings: ChatSettings;
  onSettingsChange: SettingsChange;
}) {
  const [modelQuery, setModelQuery] = useState(settings.model || DEFAULT_MODEL);
  const [models, setModels] = useState<OpenRouterModel[]>([]);
  const [modelsLoading, setModelsLoading] = useState(false);
  const [modelsError, setModelsError] = useState("");
  const multimodal = settings.multimodal ?? DEFAULT_MULTIMODAL_SETTINGS;
  const parsedModel = useMemo(() => parseModelWithVariants(settings.model || DEFAULT_MODEL), [settings.model]);
  const baseModel = parsedModel.baseModel || DEFAULT_MODEL;

  useEffect(() => {
    setModelQuery(baseModel);
  }, [baseModel]);

  useEffect(() => {
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
  }, [modelQuery, multimodal.imageGeneration.enabled]);

  return (
    <div className="space-y-4">
      <SectionCard title="Model picker" description="Search current OpenRouter models or type a custom model id." icon={<Search size={18} aria-hidden="true" />}>
        <div className="mb-3">
          <span className="mb-2 block text-sm font-medium">OpenRouter routers</span>
          <div className="grid gap-2 sm:grid-cols-3">
            {OPENROUTER_ROUTER_PICKS.map((router) => {
              const active = baseModel === router.id;

              return (
                <button
                  key={router.id}
                  type="button"
                  title={router.description}
                  onClick={() => {
                    onSettingsChange({
                      ...settings,
                      model: router.id,
                    });
                    setModelQuery(router.id);
                  }}
                  className={`rounded-xl border px-3 py-2.5 text-left transition active:scale-[0.99] ${
                    active
                      ? "border-(--accent-strong) bg-(--accent-strong) text-(--background)"
                      : "border-(--border) bg-(--background) text-(--foreground) hover:bg-(--surface-muted)"
                  }`}
                >
                  <span className="block text-sm font-medium">{router.label}</span>
                  <span className="mt-1 block text-xs leading-5 opacity-80">{router.description}</span>
                  <span className="mt-1 block truncate font-mono text-[0.7rem] opacity-70">{router.id}</span>
                </button>
              );
            })}
          </div>
        </div>

        <div className="mb-3">
          <label className="mb-2 block text-sm font-medium">Model search</label>
          <div className="flex min-h-12 items-center gap-2 rounded-xl border border-(--border) bg-(--background) px-3">
            <Search size={17} className="shrink-0 text-(--muted)" aria-hidden="true" />
            <input
              value={modelQuery}
              spellCheck={false}
              autoCapitalize="off"
              autoCorrect="off"
              placeholder="Search OpenRouter models"
              onChange={(event) => setModelQuery(event.target.value)}
              className="min-w-0 flex-1 bg-transparent text-base text-(--foreground) outline-none placeholder:text-(--muted)"
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
            className="min-h-12 w-full rounded-xl border border-(--border) bg-(--background) px-3 text-base text-(--foreground)"
          />
        </label>

        <div className="mb-3">
          <span className="mb-2 block text-sm font-medium">Model variants</span>
          <div className="flex flex-wrap gap-2">
            {MODEL_VARIANT_OPTIONS.map((option) => {
              const active = parsedModel.variants.has(option.id);

              return (
                <button
                  key={option.id}
                  type="button"
                  aria-pressed={active}
                  title={option.description}
                  onClick={() =>
                    onSettingsChange({
                      ...settings,
                      model: toggleModelVariant(settings.model || DEFAULT_MODEL, option.id, !active),
                    })
                  }
                  className={`min-h-9 rounded-full border px-3 text-sm font-medium transition active:scale-[0.98] ${
                    active
                      ? "border-(--accent-strong) bg-(--accent-strong) text-(--background)"
                      : "border-(--border) bg-(--background) text-(--foreground) hover:bg-(--surface-muted)"
                  }`}
                >
                  {option.label}
                </button>
              );
            })}
          </div>
          <p className="mt-2 text-xs leading-5 text-(--muted)">
            Append OpenRouter suffixes such as <code className="text-(--foreground)">:nitro</code> or{" "}
            <code className="text-(--foreground)">:online</code>. Online is a lighter alternative to the full web search
            server tool. Nitro, Floor, and Exacto are mutually exclusive routing sorts.
          </p>
        </div>

        <div className="scroll-area max-h-72 space-y-2 overflow-y-auto rounded-xl border border-(--border) bg-(--background) p-2">
          {modelsLoading ? (
            <p className="px-2 py-5 text-center text-sm text-(--muted)">Loading models...</p>
          ) : modelsError ? (
            <p className="px-2 py-5 text-center text-sm text-(--muted)">{modelsError}</p>
          ) : models.length === 0 ? (
            <p className="px-2 py-5 text-center text-sm text-(--muted)">No models found.</p>
          ) : (
            models.map((model) => (
              <button
                key={model.id}
                type="button"
                onClick={() => {
                  onSettingsChange({
                    ...settings,
                    model: setModelBase(settings.model || DEFAULT_MODEL, model.id),
                  });
                  setModelQuery(model.id);
                }}
                className={`block min-h-16 w-full rounded-lg px-3 py-2 text-left transition active:scale-[0.99] ${baseModel === model.id
                    ? "bg-(--accent-strong) text-(--background)"
                    : "bg-(--surface-raised) text-(--foreground)"
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
      </SectionCard>

      <SectionCard title="Behavior" description="Set the assistant instructions and response creativity." icon={<Minimize2 size={18} aria-hidden="true" />}>
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
            className="min-h-28 w-full resize-y rounded-xl border border-(--border) bg-(--background) px-3 py-3 text-base leading-6 text-(--foreground)"
          />
        </label>

        <label className="block">
          <span className="mb-2 flex items-center justify-between gap-3 text-sm font-medium">
            <span>Temperature</span>
            <span className="text-(--muted)">{settings.temperature.toFixed(1)}</span>
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
            className="h-11 w-full accent-(--accent-strong)"
          />
        </label>
      </SectionCard>

      <SectionCard
        title="Reasoning"
        description="Control extended thinking for reasoning-capable models. Adds output tokens (billed)."
        icon={<Brain size={18} aria-hidden="true" />}
      >
        <ToolToggle
          title="Extended reasoning"
          description="Let the model think step-by-step before answering. Best on o-series, Claude, Gemini, and DeepSeek-R1."
          enabled={settings.reasoning?.enabled ?? false}
          onChange={(enabled) =>
            onSettingsChange({
              ...settings,
              reasoning: {
                ...(settings.reasoning ?? DEFAULT_REASONING),
                enabled,
              },
            })
          }
        />

        {settings.reasoning?.enabled ? (
          <div className="mt-3 space-y-3 border-t border-(--border) pt-3">
            <SelectField
              label="Effort"
              value={settings.reasoning.effort ?? DEFAULT_REASONING.effort}
              onChange={(value) =>
                onSettingsChange({
                  ...settings,
                  reasoning: {
                    ...settings.reasoning,
                    effort: value as ReasoningEffort,
                  },
                })
              }
              options={["xhigh", "high", "medium", "low", "minimal", "none"]}
            />
            <ToolToggle
              title="Hide reasoning from response"
              description="The model still reasons internally, but the trace isn't returned. Saves bandwidth."
              enabled={settings.reasoning.exclude ?? false}
              onChange={(exclude) =>
                onSettingsChange({
                  ...settings,
                  reasoning: {
                    ...settings.reasoning,
                    exclude,
                  },
                })
              }
            />
            <p className="text-xs leading-5 text-(--muted)">
              Effort maps to OpenAI/Grok reasoning effort and Anthropic/Gemini thinking budgets. Not all models support every level; OpenRouter maps to the nearest supported value.
            </p>
          </div>
        ) : null}
      </SectionCard>

      <SectionCard
        title="Provider routing"
        description="Control how OpenRouter selects among providers for your model."
        icon={<Route size={18} aria-hidden="true" />}
      >
        <SelectField
          label="Provider sort"
          value={settings.providerRouting?.providerSort ?? DEFAULT_PROVIDER_ROUTING.providerSort}
          onChange={(value) =>
            onSettingsChange({
              ...settings,
              providerRouting: {
                ...(settings.providerRouting ?? DEFAULT_PROVIDER_ROUTING),
                providerSort: value as ProviderSort,
              },
            })
          }
          options={["default", "price", "throughput", "latency"]}
        />

        <div className="mt-3">
          <ToolToggle
            title="Deny data collection"
            description="Only route to providers that do not store prompts or completions."
            enabled={settings.providerRouting?.dataCollectionDeny ?? false}
            onChange={(dataCollectionDeny) =>
              onSettingsChange({
                ...settings,
                providerRouting: {
                  ...(settings.providerRouting ?? DEFAULT_PROVIDER_ROUTING),
                  dataCollectionDeny,
                },
              })
            }
          />
        </div>

        <p className="mt-3 text-xs leading-5 text-(--muted)">
          Default uses OpenRouter&apos;s price-weighted load balancing. Explicit sort disables load balancing and tries
          providers in order. Set provider sort to price (or use the Floor model variant) to opt out of Auto Exacto on
          tool-calling requests and prioritize cost instead. Data collection filtering may reduce available providers.
        </p>
      </SectionCard>
    </div>
  );
}

export function ToolsSettingsSection({
  settings,
  onSettingsChange,
}: {
  settings: ChatSettings;
  onSettingsChange: SettingsChange;
}) {
  const [webToolsAdvancedOpen, setWebToolsAdvancedOpen] = useState(false);
  const [multimodalAdvancedOpen, setMultimodalAdvancedOpen] = useState(false);
  const [cachingAdvancedOpen, setCachingAdvancedOpen] = useState(false);
  const serverTools = settings.serverTools ?? DEFAULT_SERVER_TOOLS;
  const multimodal = settings.multimodal ?? DEFAULT_MULTIMODAL_SETTINGS;
  const messageTransforms = settings.messageTransforms ?? DEFAULT_MESSAGE_TRANSFORMS;
  const responseCaching = settings.responseCaching ?? DEFAULT_RESPONSE_CACHING;

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

  function updateResponseCaching(updates: Partial<ChatSettings["responseCaching"]>) {
    onSettingsChange({
      ...settings,
      responseCaching: {
        ...responseCaching,
        ...updates,
      },
    });
  }

  return (
    <div className="space-y-4">
      <SectionCard
        title="Web tools"
        description="Optional OpenRouter server tools. Web search and fetch are beta and may add provider/tool costs."
        icon={<Globe2 size={18} aria-hidden="true" />}
      >
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

        <DisclosureButton open={webToolsAdvancedOpen} onClick={() => setWebToolsAdvancedOpen((current) => !current)}>
          Advanced web options
        </DisclosureButton>

        {webToolsAdvancedOpen ? (
          <div className="mt-3 space-y-4 border-t border-(--border) pt-3">
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
                <p className="mt-2 text-xs leading-5 text-(--muted)">
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
                className="min-h-12 w-full rounded-xl border border-(--border) bg-(--background) px-3 text-base text-(--foreground)"
              />
            </label>
          </div>
        ) : null}
      </SectionCard>

      <SectionCard
        title="Multimodal"
        description="Attach images or PDFs from the composer. Image generation requires a model that can output images."
        icon={<ImageIcon size={18} aria-hidden="true" />}
      >
        <ToolToggle
          title="Image generation"
          description="Ask image-capable models to return generated images with the text response."
          enabled={multimodal.imageGeneration.enabled}
          onChange={(enabled) => updateImageGeneration({ enabled })}
        />

        <DisclosureButton open={multimodalAdvancedOpen} onClick={() => setMultimodalAdvancedOpen((current) => !current)}>
          Advanced multimodal options
        </DisclosureButton>

        {multimodalAdvancedOpen ? (
          <div className="mt-3 space-y-4 border-t border-(--border) pt-3">
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
                className="min-h-12 w-full rounded-xl border border-(--border) bg-(--background) px-3 text-base text-(--foreground)"
              >
                <option value="auto">auto</option>
                <option value="cloudflare-ai">cloudflare-ai</option>
                <option value="mistral-ocr">mistral-ocr</option>
                <option value="native">native</option>
              </select>
            </label>

            <p className="text-xs leading-5 text-(--muted)">
              Local images and PDFs are sent to OpenRouter as data URLs. PDF OCR/parser choices and image output models may add provider costs.
            </p>
          </div>
        ) : null}
      </SectionCard>

      <SectionCard
        title="Response handling"
        description="Control long-chat compression and optional OpenRouter response caching."
        icon={<Database size={18} aria-hidden="true" />}
      >
        <div className="space-y-2">
          <ToolToggle
            title="Auto compression"
            description="OpenRouter trims the middle of oversized prompts so long chats can continue."
            enabled={messageTransforms.contextCompression.enabled}
            onChange={updateContextCompression}
          />
          <ToolToggle
            title="Response caching"
            description="OpenRouter can replay identical successful streaming responses from cache. Beta feature."
            enabled={responseCaching.enabled}
            onChange={(enabled) => updateResponseCaching({ enabled })}
          />
        </div>

        {responseCaching.enabled ? (
          <>
            <DisclosureButton open={cachingAdvancedOpen} onClick={() => setCachingAdvancedOpen((current) => !current)}>
              Advanced caching options
            </DisclosureButton>

            {cachingAdvancedOpen ? (
              <div className="mt-3 border-t border-(--border) pt-3">
                <NumberField
                  label="Cache TTL seconds"
                  value={responseCaching.ttlSeconds}
                  min={1}
                  max={86400}
                  onChange={(ttlSeconds) => updateResponseCaching({ ttlSeconds })}
                />
              </div>
            ) : null}
          </>
        ) : null}

        <p className="mt-3 text-xs leading-5 text-(--muted)">
          Keep caching off for private or one-off prompts. Keep compression on for long conversations unless exact full-transcript recall matters.
        </p>
      </SectionCard>
    </div>
  );
}

export function DataSettingsSection({
  onClearChat,
  onResetSettings,
  onExportAllThreads,
  onExportCurrentThread,
  onImportThreads,
  importNotice,
  canExportCurrentThread,
}: {
  onClearChat: () => void;
  onResetSettings: () => void;
  onExportAllThreads: () => void;
  onExportCurrentThread: () => void;
  onImportThreads: (file: File) => void;
  importNotice?: string;
  canExportCurrentThread: boolean;
}) {
  const [pendingAction, setPendingAction] = useState<"clear" | "reset" | null>(null);
  const importInputRef = useRef<HTMLInputElement | null>(null);

  function runAction(action: "clear" | "reset") {
    if (pendingAction !== action) {
      setPendingAction(action);
      return;
    }

    if (action === "clear") {
      onClearChat();
    } else {
      onResetSettings();
    }
    setPendingAction(null);
  }

  return (
    <SectionCard title="Data" description="Manage data stored locally in this browser." icon={<Trash2 size={18} aria-hidden="true" />}>
      <div className="space-y-3">
        <div className="rounded-xl border border-(--border) bg-(--background) p-3">
          <p className="text-sm font-medium">Backup and restore</p>
          <p className="mt-1 text-xs leading-5 text-(--muted)">
            Export chats as JSON or Markdown, or import previously exported JSON threads.
          </p>
          <div className="mt-3 flex flex-col gap-2">
            <button
              type="button"
              onClick={onExportAllThreads}
              className="inline-flex min-h-11 items-center justify-center gap-2 rounded-xl border border-(--border) px-4 text-sm font-medium text-(--foreground) transition active:scale-[0.98]"
            >
              <Download size={16} aria-hidden="true" />
              Export all threads (JSON)
            </button>
            <button
              type="button"
              onClick={onExportCurrentThread}
              disabled={!canExportCurrentThread}
              className="inline-flex min-h-11 items-center justify-center gap-2 rounded-xl border border-(--border) px-4 text-sm font-medium text-(--foreground) transition active:scale-[0.98] disabled:cursor-not-allowed disabled:opacity-45"
            >
              <FileText size={16} aria-hidden="true" />
              Export current thread (Markdown)
            </button>
            <input
              ref={importInputRef}
              type="file"
              accept="application/json"
              className="hidden"
              onChange={(event) => {
                const file = event.target.files?.[0];
                if (file) {
                  onImportThreads(file);
                }
                event.target.value = "";
              }}
            />
            <button
              type="button"
              onClick={() => importInputRef.current?.click()}
              className="inline-flex min-h-11 items-center justify-center gap-2 rounded-xl border border-(--border) px-4 text-sm font-medium text-(--foreground) transition active:scale-[0.98]"
            >
              <Upload size={16} aria-hidden="true" />
              Import threads (JSON)
            </button>
            {importNotice ? (
              <p className="text-xs text-(--accent)" role="status">
                {importNotice}
              </p>
            ) : null}
          </div>
        </div>
        <DestructiveAction
          title="Clear current chat"
          description="Removes messages from the active thread only. Other saved chats remain available in the sidebar."
          icon={<Trash2 size={17} aria-hidden="true" />}
          confirming={pendingAction === "clear"}
          onClick={() => runAction("clear")}
          onCancel={() => setPendingAction(null)}
        />
        <DestructiveAction
          title="Reset settings"
          description="Restores the default model, behavior, tools, and removes the locally saved API key."
          icon={<RotateCcw size={17} aria-hidden="true" />}
          confirming={pendingAction === "reset"}
          onClick={() => runAction("reset")}
          onCancel={() => setPendingAction(null)}
        />
      </div>
    </SectionCard>
  );
}

function SectionCard({
  title,
  description,
  icon,
  children,
}: {
  title: string;
  description: string;
  icon: React.ReactNode;
  children: React.ReactNode;
}) {
  return (
    <section className="rounded-xl border border-(--border) bg-(--surface-raised) p-3">
      <div className="mb-3 flex items-start justify-between gap-3">
        <div className="min-w-0">
          <h3 className="text-sm font-medium">{title}</h3>
          <p className="mt-1 text-xs leading-5 text-(--muted)">{description}</p>
        </div>
        <span className="mt-0.5 shrink-0 text-(--accent)">{icon}</span>
      </div>
      {children}
    </section>
  );
}

function DisclosureButton({
  children,
  open,
  onClick,
}: {
  children: React.ReactNode;
  open: boolean;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="mt-3 flex min-h-11 w-full items-center justify-between gap-3 rounded-xl border border-(--border) px-3 text-left text-sm text-(--foreground) transition active:scale-[0.99]"
    >
      <span>{children}</span>
      <ChevronDown size={17} aria-hidden="true" className={`shrink-0 transition ${open ? "rotate-180" : ""}`} />
    </button>
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
      role="switch"
      aria-checked={enabled}
      aria-label={title}
      onClick={() => onChange(!enabled)}
      className="flex min-h-14 w-full items-center justify-between gap-3 rounded-xl border border-(--border) bg-(--background) px-3 py-2 text-left transition active:scale-[0.99]"
    >
      <span className="min-w-0">
        <span className="block text-sm font-medium">{title}</span>
        <span className="block text-xs leading-5 text-(--muted)">{description}</span>
      </span>
      <span
        className={`flex h-7 w-12 shrink-0 items-center rounded-full p-1 transition ${enabled ? "justify-end bg-(--accent-strong)" : "justify-start bg-(--surface-muted)"
          }`}
        aria-hidden="true"
      >
        <span className="h-5 w-5 rounded-full bg-(--background) shadow" />
      </span>
    </button>
  );
}

function DestructiveAction({
  title,
  description,
  icon,
  confirming,
  onClick,
  onCancel,
}: {
  title: string;
  description: string;
  icon: React.ReactNode;
  confirming: boolean;
  onClick: () => void;
  onCancel: () => void;
}) {
  return (
    <div className="rounded-xl border border-(--border) bg-(--background) p-3">
      <div className="mb-3">
        <p className="text-sm font-medium">{title}</p>
        <p className="mt-1 text-xs leading-5 text-(--muted)">{description}</p>
      </div>
      <div className="flex flex-col gap-2 sm:flex-row">
        <button
          type="button"
          onClick={onClick}
          className={`inline-flex min-h-12 flex-1 items-center justify-center gap-2 rounded-xl px-4 text-sm font-medium transition active:scale-[0.98] ${confirming
              ? "bg-red-400 text-black"
              : "border border-(--border) bg-(--surface-raised) text-(--foreground)"
            }`}
        >
          {icon}
          {confirming ? `Confirm ${title.toLowerCase()}` : title}
        </button>
        {confirming ? (
          <button
            type="button"
            onClick={onCancel}
            className="inline-flex min-h-12 items-center justify-center rounded-xl border border-(--border) px-4 text-sm font-medium text-(--foreground) transition active:scale-[0.98]"
          >
            Cancel
          </button>
        ) : null}
      </div>
    </div>
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
      <span className="mb-2 block text-xs font-medium text-(--muted)">{label}</span>
      <select
        value={value}
        onChange={(event) => onChange(event.target.value)}
        className="min-h-12 w-full rounded-xl border border-(--border) bg-(--background) px-3 text-base text-(--foreground)"
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
      <span className="mb-2 block text-xs font-medium text-(--muted)">{label}</span>
      <input
        type="number"
        inputMode="numeric"
        min={min}
        max={max}
        value={value}
        onChange={(event) => onChange(clampNumber(Number(event.target.value), min, max, value))}
        className="min-h-12 w-full rounded-xl border border-(--border) bg-(--background) px-3 text-base text-(--foreground)"
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
      <span className="mb-2 block text-xs font-medium text-(--muted)">{label}</span>
      <textarea
        value={value.join("\n")}
        rows={2}
        spellCheck={false}
        autoCapitalize="off"
        autoCorrect="off"
        placeholder="example.com, docs.example.com"
        onChange={(event) => onChange(parseDomains(event.target.value))}
        className="min-h-20 w-full resize-y rounded-xl border border-(--border) bg-(--background) px-3 py-2 text-base leading-6 text-(--foreground)"
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
