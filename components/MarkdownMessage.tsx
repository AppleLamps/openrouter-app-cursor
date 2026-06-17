"use client";

import React, { useEffect, useId, useMemo, useRef, useState } from "react";
import { Check, Copy, Eye, EyeOff, X } from "lucide-react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import rehypeSanitize from "rehype-sanitize";
import type { BundledLanguage, Highlighter } from "shiki";

const ALLOWED_LINK_PROTOCOLS = new Set(["http:", "https:", "mailto:"]);
const ALLOWED_MEDIA_PROTOCOLS = new Set(["http:", "https:"]);

type MarkdownMessageProps = {
  content: string;
  deferRichBlocks?: boolean;
};

let shikiHighlighterPromise: Promise<Highlighter> | null = null;
let mermaidModulePromise: Promise<typeof import("mermaid").default> | null = null;
let mermaidInitialized = false;
let vegaEmbedPromise: Promise<typeof import("vega-embed").default> | null = null;

async function getShikiHighlighter() {
  shikiHighlighterPromise ??= import("shiki").then(({ createHighlighter }) =>
    createHighlighter({
      themes: ["github-light"],
      langs: ["text"],
    }),
  );

  return shikiHighlighterPromise;
}

async function highlightCode(code: string, language: string) {
  const { bundledLanguages } = await import("shiki");
  const requestedLanguage = language || "text";
  const safeLanguage = requestedLanguage in bundledLanguages ? requestedLanguage : "text";
  const highlighter = await getShikiHighlighter();

  if (!highlighter.getLoadedLanguages().includes(safeLanguage)) {
    await highlighter.loadLanguage(safeLanguage as BundledLanguage);
  }

  return highlighter.codeToHtml(code, {
    lang: safeLanguage,
    theme: "github-light",
  });
}

async function getMermaid() {
  mermaidModulePromise ??= import("mermaid").then(({ default: mermaid }) => {
    if (!mermaidInitialized) {
      mermaid.initialize({
        startOnLoad: false,
        securityLevel: "strict",
        theme: "base",
        themeVariables: {
          background: "#fbfaf7",
          primaryColor: "#f8f5ef",
          primaryTextColor: "#26221c",
          primaryBorderColor: "#d96c42",
          lineColor: "#736d64",
          secondaryColor: "#efeee9",
          tertiaryColor: "#ffffff",
        },
      });
      mermaid.setParseErrorHandler(() => undefined);
      mermaidInitialized = true;
    }

    return mermaid;
  });

  return mermaidModulePromise;
}

async function getVegaEmbed() {
  vegaEmbedPromise ??= import("vega-embed").then(({ default: embed }) => embed);
  return vegaEmbedPromise;
}

export function MarkdownMessage({ content, deferRichBlocks = false }: MarkdownMessageProps) {
  return (
    <div className="min-w-0 wrap-break-word">
      <ReactMarkdown
        remarkPlugins={[remarkGfm]}
        rehypePlugins={[rehypeSanitize]}
        components={{
          h1: ({ children }) => <h1>{children}</h1>,
          h2: ({ children }) => <h2>{children}</h2>,
          h3: ({ children }) => <h3>{children}</h3>,
          p: ({ children }) => <p className="mb-4 last:mb-0">{children}</p>,
          a: ({ children, href }) => {
            const safeHref = sanitizeHref(href);
            if (!safeHref) {
              return <span className="text-(--accent)">{children}</span>;
            }

            return (
              <a
                href={safeHref}
                target="_blank"
                rel="noopener noreferrer"
                className="text-(--accent) underline decoration-(--accent)/50 underline-offset-4"
              >
                {children}
              </a>
            );
          },
          img: ({ src, alt }) => {
            const safeSrc = sanitizeMediaSrc(typeof src === "string" ? src : undefined);
            if (!safeSrc) {
              return null;
            }

            return (
              <img
                src={safeSrc}
                alt={alt ?? ""}
                className="my-3 max-w-full rounded-lg border border-(--border)"
                loading="lazy"
              />
            );
          },
          ul: ({ children }) => <ul className="mb-4 list-disc space-y-1.5 pl-5 last:mb-0">{children}</ul>,
          ol: ({ children }) => <ol className="mb-4 list-decimal space-y-1.5 pl-5 last:mb-0">{children}</ol>,
          li: ({ children }) => <li className="pl-1.5">{children}</li>,
          blockquote: ({ children }) => (
            <blockquote className="mb-3 border-l-2 border-(--accent)/60 pl-3 text-(--muted) last:mb-0">
              {children}
            </blockquote>
          ),
          hr: () => <hr className="my-4 border-(--border)" />,
          table: ({ children }) => (
            <div className="mb-3 overflow-x-auto rounded-lg border border-(--border) last:mb-0">
              <table className="w-full min-w-96 border-collapse text-left text-sm">{children}</table>
            </div>
          ),
          th: ({ children }) => (
            <th className="border-b border-(--border) bg-(--surface-muted) px-3 py-2 font-medium">
              {children}
            </th>
          ),
          td: ({ children }) => <td className="border-b border-(--border) px-3 py-2">{children}</td>,
          pre: ({ children }) => <RichBlock deferRichBlocks={deferRichBlocks}>{children}</RichBlock>,
          code: ({ className, children }) => {
            if (className?.startsWith("language-")) {
              return <code className={className}>{children}</code>;
            }

            return (
              <code className="rounded-md bg-(--surface-muted) px-1.5 py-0.5 font-sans text-[0.88em] text-(--accent)">
                {children}
              </code>
            );
          },
        }}
      >
        {content}
      </ReactMarkdown>
    </div>
  );
}

function RichBlock({
  children,
  deferRichBlocks = false,
}: {
  children: React.ReactNode;
  deferRichBlocks?: boolean;
}) {
  const code = useMemo(() => extractText(children).replace(/\n$/, ""), [children]);
  const language = useMemo(() => extractLanguage(children).toLowerCase(), [children]);

  if (deferRichBlocks) {
    return <PlainCodeBlock code={code} language={language} />;
  }

  if (language === "mermaid") {
    return <MermaidBlock code={code} />;
  }

  if (language === "chart" || language === "vega-lite" || language === "vegalite") {
    return <ChartBlock code={code} language={language === "chart" ? "chart" : "vega-lite"} />;
  }

  return <CodeBlock code={code} language={language} />;
}

function MermaidBlock({ code }: { code: string }) {
  const rawId = useId();
  const renderId = useMemo(() => `mermaid-${rawId.replace(/[^a-zA-Z0-9_-]/g, "")}`, [rawId]);
  const [svg, setSvg] = useState("");
  const [error, setError] = useState("");

  useEffect(() => {
    let cancelled = false;

    async function renderMermaid() {
      setError("");
      setSvg("");

      try {
        const mermaid = await getMermaid();
        await mermaid.parse(code);

        const result = await mermaid.render(renderId, code);
        if (!cancelled) {
          setSvg(result.svg);
        }
      } catch (caught) {
        if (!cancelled) {
          setError(formatRenderError(caught, "Unable to render Mermaid diagram."));
        }
      }
    }

    void renderMermaid();

    return () => {
      cancelled = true;
    };
  }, [code, renderId]);

  return (
    <RenderedPanel
      label="mermaid"
      code={code}
      error={error}
      loading={!svg && !error}
      body={
        svg ? (
          <div
            className="rich-render rich-render-mermaid"
            // Safe: Mermaid strict mode sanitizes SVG output (no scripts or HTML labels).
            dangerouslySetInnerHTML={{ __html: svg }}
          />
        ) : null
      }
    />
  );
}

function ChartBlock({ code, language }: { code: string; language: string }) {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let view: { finalize: () => void } | undefined;
    let cancelled = false;

    async function renderChart() {
      setError("");
      setLoading(true);

      try {
        const spec = parseChartSpec(code);
        const embed = await getVegaEmbed();

        if (!containerRef.current || cancelled) {
          return;
        }

        const result = await embed(containerRef.current, spec, {
          actions: false,
          renderer: "svg",
          theme: "dark",
          tooltip: true,
        });

        view = result.view;
      } catch (caught) {
        if (!cancelled) {
          setError(formatRenderError(caught, "Unable to render chart."));
        }
      } finally {
        if (!cancelled) {
          setLoading(false);
        }
      }
    }

    void renderChart();

    return () => {
      cancelled = true;
      view?.finalize();
    };
  }, [code]);

  return (
    <RenderedPanel
      label={language}
      code={code}
      error={error}
      loading={loading}
      body={<div ref={containerRef} className="rich-render rich-render-chart" />}
    />
  );
}

function isHtmlLanguage(language: string) {
  return language === "html" || language === "htm";
}

function CodeBlock({ code, language }: { code: string; language: string }) {
  const [copied, setCopied] = useState(false);
  const [previewing, setPreviewing] = useState(false);
  const [highlightedHtml, setHighlightedHtml] = useState("");
  const [highlightError, setHighlightError] = useState("");
  const canPreview = isHtmlLanguage(language);

  useEffect(() => {
    let cancelled = false;

    async function runHighlight() {
      setHighlightError("");
      setHighlightedHtml("");

      try {
        const html = await highlightCode(code, language);

        if (!cancelled) {
          setHighlightedHtml(html);
        }
      } catch (caught) {
        if (!cancelled) {
          setHighlightError(formatRenderError(caught, "Syntax highlighting unavailable."));
        }
      }
    }

    void runHighlight();

    return () => {
      cancelled = true;
    };
  }, [code, language]);

  async function copyCode() {
    try {
      await navigator.clipboard.writeText(code);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 1400);
    } catch {
      setCopied(false);
    }
  }

  return (
    <div className="mb-3 overflow-hidden rounded-xl border border-(--border) bg-(--surface) font-sans last:mb-0">
      <BlockHeader
        label={language || "code"}
        copied={copied}
        onCopy={copyCode}
        previewing={canPreview ? previewing : undefined}
        onPreview={canPreview ? () => setPreviewing((current) => !current) : undefined}
      />
      {highlightError ? <RenderError message={highlightError} /> : null}
      {highlightedHtml ? (
        <div
          className="rich-code scroll-area"
          // Safe: Shiki escapes source text into HTML spans; language is whitelisted.
          dangerouslySetInnerHTML={{ __html: highlightedHtml }}
        />
      ) : (
        <pre className="scroll-area p-3 text-[0.84rem] leading-5 whitespace-pre-wrap wrap-break-word text-(--foreground)">
          <code>{code}</code>
        </pre>
      )}
      {canPreview && previewing ? <HtmlPreviewModal code={code} onClose={() => setPreviewing(false)} /> : null}
    </div>
  );
}

function PlainCodeBlock({ code, language }: { code: string; language: string }) {
  const [copied, setCopied] = useState(false);
  const [previewing, setPreviewing] = useState(false);
  const canPreview = isHtmlLanguage(language);

  async function copyCode() {
    try {
      await navigator.clipboard.writeText(code);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 1400);
    } catch {
      setCopied(false);
    }
  }

  return (
    <div className="mb-3 overflow-hidden rounded-xl border border-(--border) bg-(--surface) font-sans last:mb-0">
      <BlockHeader
        label={language || "code"}
        copied={copied}
        onCopy={copyCode}
        previewing={canPreview ? previewing : undefined}
        onPreview={canPreview ? () => setPreviewing((current) => !current) : undefined}
      />
      <pre className="scroll-area p-3 text-[0.84rem] leading-5 whitespace-pre-wrap wrap-break-word text-(--foreground)">
        <code>{code}</code>
      </pre>
      {canPreview && previewing ? <HtmlPreviewModal code={code} onClose={() => setPreviewing(false)} /> : null}
    </div>
  );
}

function RenderedPanel({
  label,
  code,
  error,
  loading,
  body,
}: {
  label: string;
  code: string;
  error: string;
  loading: boolean;
  body: React.ReactNode;
}) {
  const [copied, setCopied] = useState(false);

  async function copyCode() {
    try {
      await navigator.clipboard.writeText(code);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 1400);
    } catch {
      setCopied(false);
    }
  }

  return (
    <div className="mb-3 overflow-hidden rounded-xl border border-(--border) bg-(--surface) font-sans last:mb-0">
      <BlockHeader label={label} copied={copied} onCopy={copyCode} />
      {error ? <RenderError message={error} /> : null}
      <div
        aria-live="polite"
        aria-atomic="true"
        className={
          loading
            ? "flex min-h-28 items-center justify-center px-3 py-6 text-sm text-(--muted)"
            : "sr-only"
        }
      >
        {loading ? `Rendering ${label}...` : error ? "" : `${label} rendered.`}
      </div>
      <div className={error ? "hidden" : undefined}>{body}</div>
      {error ? (
        <pre className="scroll-area max-h-64 overflow-y-auto border-t border-(--border) p-3 text-[0.8rem] leading-5 whitespace-pre-wrap wrap-break-word text-(--foreground)">
          <code>{code}</code>
        </pre>
      ) : null}
    </div>
  );
}

function HtmlPreviewModal({ code, onClose }: { code: string; onClose: () => void }) {
  const titleId = useId();
  const closeButtonRef = useRef<HTMLButtonElement | null>(null);

  useEffect(() => {
    closeButtonRef.current?.focus();

    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") {
        onClose();
      }
    }

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [onClose]);

  return (
    <div
      className="fixed inset-0 z-90 flex items-center justify-center bg-black/45 p-3 md:p-6"
      role="dialog"
      aria-modal="true"
      aria-labelledby={titleId}
      onClick={onClose}
    >
      <div
        className="flex h-[88dvh] w-full max-w-6xl flex-col overflow-hidden rounded-2xl border border-(--border) bg-(--surface-raised) shadow-[0_24px_80px_rgba(18,18,18,0.28)]"
        onClick={(event) => event.stopPropagation()}
      >
        <div className="flex min-h-12 items-center justify-between gap-3 border-b border-(--border) px-4">
          <h2 id={titleId} className="truncate text-sm font-medium text-(--foreground)">
            HTML preview
          </h2>
          <button
            ref={closeButtonRef}
            type="button"
            title="Close preview"
            aria-label="Close preview"
            onClick={onClose}
            className="inline-flex min-h-9 min-w-9 items-center justify-center rounded-full text-(--muted) transition hover:bg-(--surface-muted) hover:text-(--foreground) active:scale-95"
          >
            <X size={17} aria-hidden="true" />
          </button>
        </div>
        <div className="min-h-0 flex-1 bg-white">
          <HtmlPreview code={code} fill />
        </div>
      </div>
    </div>
  );
}

function HtmlPreview({ code, fill = false }: { code: string; fill?: boolean }) {
  const iframeRef = useRef<HTMLIFrameElement | null>(null);

  function resizeIframe() {
    if (fill) {
      return;
    }

    const iframe = iframeRef.current;
    const document = iframe?.contentDocument;
    if (!iframe || !document?.body) {
      return;
    }

    iframe.style.height = `${Math.max(document.documentElement.scrollHeight, document.body.scrollHeight, 128)}px`;
  }

  useEffect(() => {
    resizeIframe();
  }, [code, fill]);

  return (
    <div className={fill ? "h-full bg-white" : "border-t border-(--border) bg-white"}>
      <iframe
        ref={iframeRef}
        srcDoc={code}
        sandbox=""
        title="HTML preview"
        onLoad={resizeIframe}
        className={fill ? "block h-full w-full border-0" : "block min-h-32 w-full border-0"}
      />
    </div>
  );
}

function BlockHeader({
  label,
  copied,
  onCopy,
  previewing,
  onPreview,
}: {
  label: string;
  copied: boolean;
  onCopy: () => void;
  previewing?: boolean;
  onPreview?: () => void;
}) {
  return (
    <div className="flex min-h-10 items-center justify-between gap-3 border-b border-(--border) px-3">
      <span className="truncate text-xs text-(--muted)">{label}</span>
      <div className="flex items-center gap-0.5">
        {onPreview ? (
          <button
            type="button"
            title={previewing ? "Hide preview" : "Show preview"}
            aria-label={previewing ? "Hide preview" : "Show preview"}
            aria-pressed={previewing}
            onClick={onPreview}
            className={`inline-flex min-h-9 min-w-9 items-center justify-center rounded-full transition active:scale-95 ${
              previewing ? "text-(--accent)" : "text-(--muted)"
            }`}
          >
            {previewing ? <EyeOff size={16} aria-hidden="true" /> : <Eye size={16} aria-hidden="true" />}
          </button>
        ) : null}
        <button
          type="button"
          title="Copy source"
          aria-label="Copy source"
          onClick={onCopy}
          className="inline-flex min-h-9 min-w-9 items-center justify-center rounded-full text-(--muted) transition active:scale-95"
        >
          {copied ? <Check size={16} aria-hidden="true" /> : <Copy size={16} aria-hidden="true" />}
        </button>
      </div>
    </div>
  );
}

function RenderError({ message }: { message: string }) {
  return (
    <div
      role="status"
      aria-live="polite"
      className="border-b border-(--border) bg-(--danger)/10 px-3 py-2 text-xs leading-5 text-(--danger)"
    >
      {message}
    </div>
  );
}

function parseChartSpec(code: string): Record<string, unknown> {
  let spec: unknown;

  try {
    spec = JSON.parse(code);
  } catch {
    throw new Error("Chart blocks must contain valid Vega-Lite JSON.");
  }

  if (!isRecord(spec)) {
    throw new Error("Chart blocks must contain a Vega-Lite JSON object.");
  }

  if (hasExternalDataUrl(spec)) {
    throw new Error("External chart data URLs are blocked. Use inline data.values instead.");
  }

  return spec;
}

function hasExternalDataUrl(value: unknown): boolean {
  if (Array.isArray(value)) {
    return value.some(hasExternalDataUrl);
  }

  if (!isRecord(value)) {
    return false;
  }

  const data = value.data;
  if (isRecord(data) && typeof data.url === "string") {
    return true;
  }

  return Object.values(value).some(hasExternalDataUrl);
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function sanitizeHref(href: string | undefined): string | undefined {
  if (!href) {
    return undefined;
  }

  const trimmed = href.trim();
  if (!trimmed || trimmed.startsWith("//")) {
    return undefined;
  }

  const lower = trimmed.toLowerCase();
  if (lower.startsWith("javascript:") || lower.startsWith("data:") || lower.startsWith("vbscript:")) {
    return undefined;
  }

  if (trimmed.startsWith("#") || trimmed.startsWith("/") || trimmed.startsWith(".")) {
    return trimmed;
  }

  try {
    const url = new URL(trimmed);
    if (ALLOWED_LINK_PROTOCOLS.has(url.protocol)) {
      return trimmed;
    }
  } catch {
    if (!/^[a-zA-Z][\w+.-]*:/.test(trimmed)) {
      return trimmed;
    }
  }

  return undefined;
}

function sanitizeMediaSrc(src: string | undefined): string | undefined {
  if (!src) {
    return undefined;
  }

  const trimmed = src.trim();
  if (!trimmed || trimmed.startsWith("//")) {
    return undefined;
  }

  const lower = trimmed.toLowerCase();
  if (lower.startsWith("javascript:") || lower.startsWith("vbscript:")) {
    return undefined;
  }

  try {
    const url = new URL(trimmed);
    if (ALLOWED_MEDIA_PROTOCOLS.has(url.protocol)) {
      return trimmed;
    }
  } catch {
    return undefined;
  }

  return undefined;
}

function formatRenderError(caught: unknown, fallback: string): string {
  if (caught instanceof Error && caught.message) {
    return caught.message;
  }

  return fallback;
}

function extractText(node: React.ReactNode): string {
  if (node === null || node === undefined || typeof node === "boolean") {
    return "";
  }
  if (typeof node === "string" || typeof node === "number") {
    return String(node);
  }
  if (Array.isArray(node)) {
    return node.map(extractText).join("");
  }
  if (React.isValidElement<{ children?: React.ReactNode }>(node)) {
    return extractText(node.props.children);
  }

  return "";
}

function extractLanguage(node: React.ReactNode): string {
  const child = Array.isArray(node) ? node[0] : node;
  if (!React.isValidElement<{ className?: string }>(child)) {
    return "";
  }

  const className = child.props.className ?? "";
  const match = className.match(/language-([\w-]+)/);
  return match?.[1] ?? "";
}
