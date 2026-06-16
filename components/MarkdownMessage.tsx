"use client";

import React, { useEffect, useId, useMemo, useRef, useState } from "react";
import { Check, Copy } from "lucide-react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";

type MarkdownMessageProps = {
  content: string;
};

export function MarkdownMessage({ content }: MarkdownMessageProps) {
  return (
    <div className="min-w-0 break-words">
      <ReactMarkdown
        remarkPlugins={[remarkGfm]}
        components={{
          h1: ({ children }) => <h1>{children}</h1>,
          h2: ({ children }) => <h2>{children}</h2>,
          h3: ({ children }) => <h3>{children}</h3>,
          p: ({ children }) => <p className="mb-4 last:mb-0">{children}</p>,
          a: ({ children, href }) => (
            <a
              href={href}
              target="_blank"
              rel="noreferrer"
              className="text-[color:var(--accent)] underline decoration-[color:var(--accent)]/50 underline-offset-4"
            >
              {children}
            </a>
          ),
          ul: ({ children }) => <ul className="mb-4 list-disc space-y-1.5 pl-5 last:mb-0">{children}</ul>,
          ol: ({ children }) => <ol className="mb-4 list-decimal space-y-1.5 pl-5 last:mb-0">{children}</ol>,
          li: ({ children }) => <li className="pl-1.5">{children}</li>,
          blockquote: ({ children }) => (
            <blockquote className="mb-3 border-l-2 border-[color:var(--accent)]/60 pl-3 text-[color:var(--muted)] last:mb-0">
              {children}
            </blockquote>
          ),
          hr: () => <hr className="my-4 border-[color:var(--border)]" />,
          table: ({ children }) => (
            <div className="mb-3 overflow-x-auto rounded-lg border border-[color:var(--border)] last:mb-0">
              <table className="w-full min-w-96 border-collapse text-left text-sm">{children}</table>
            </div>
          ),
          th: ({ children }) => (
            <th className="border-b border-[color:var(--border)] bg-[color:var(--surface-muted)] px-3 py-2 font-medium">
              {children}
            </th>
          ),
          td: ({ children }) => <td className="border-b border-[color:var(--border)] px-3 py-2">{children}</td>,
          pre: ({ children }) => <RichBlock>{children}</RichBlock>,
          code: ({ className, children }) => {
            if (className?.startsWith("language-")) {
              return <code className={className}>{children}</code>;
            }

            return (
              <code className="rounded-md bg-[color:var(--surface-muted)] px-1.5 py-0.5 font-sans text-[0.88em] text-[color:var(--accent)]">
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

function RichBlock({ children }: { children: React.ReactNode }) {
  const code = useMemo(() => extractText(children).replace(/\n$/, ""), [children]);
  const language = useMemo(() => extractLanguage(children).toLowerCase(), [children]);

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
        const mermaid = (await import("mermaid")).default;
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
        const { default: embed } = await import("vega-embed");

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

function CodeBlock({ code, language }: { code: string; language: string }) {
  const [copied, setCopied] = useState(false);
  const [highlightedHtml, setHighlightedHtml] = useState("");
  const [highlightError, setHighlightError] = useState("");

  useEffect(() => {
    let cancelled = false;

    async function highlightCode() {
      setHighlightError("");
      setHighlightedHtml("");

      try {
        const { bundledLanguages, codeToHtml } = await import("shiki");
        const requestedLanguage = language || "text";
        const safeLanguage = requestedLanguage in bundledLanguages ? requestedLanguage : "text";
        const html = await codeToHtml(code, {
          lang: safeLanguage,
          theme: "github-light",
        });

        if (!cancelled) {
          setHighlightedHtml(html);
        }
      } catch (caught) {
        if (!cancelled) {
          setHighlightError(formatRenderError(caught, "Syntax highlighting unavailable."));
        }
      }
    }

    void highlightCode();

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
    <div className="mb-3 overflow-hidden rounded-xl border border-[color:var(--border)] bg-[color:var(--surface)] font-sans last:mb-0">
      <BlockHeader label={language || "code"} copied={copied} onCopy={copyCode} />
      {highlightError ? <RenderError message={highlightError} /> : null}
      {highlightedHtml ? (
        <div
          className="rich-code scroll-area overflow-x-auto"
          dangerouslySetInnerHTML={{ __html: highlightedHtml }}
        />
      ) : (
        <pre className="scroll-area overflow-x-auto p-3 text-[0.84rem] leading-5 text-[color:var(--foreground)]">
          <code>{code}</code>
        </pre>
      )}
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
    <div className="mb-3 overflow-hidden rounded-xl border border-[color:var(--border)] bg-[color:var(--surface)] font-sans last:mb-0">
      <BlockHeader label={label} copied={copied} onCopy={copyCode} />
      {error ? <RenderError message={error} /> : null}
      {loading ? (
        <div className="flex min-h-28 items-center justify-center px-3 py-6 text-sm text-[color:var(--muted)]">
          Rendering {label}...
        </div>
      ) : null}
      <div className={error ? "hidden" : undefined}>{body}</div>
      {error ? (
        <pre className="scroll-area max-h-64 overflow-auto border-t border-[color:var(--border)] p-3 text-[0.8rem] leading-5 text-[color:var(--foreground)]">
          <code>{code}</code>
        </pre>
      ) : null}
    </div>
  );
}

function BlockHeader({
  label,
  copied,
  onCopy,
}: {
  label: string;
  copied: boolean;
  onCopy: () => void;
}) {
  return (
    <div className="flex min-h-10 items-center justify-between gap-3 border-b border-[color:var(--border)] px-3">
      <span className="truncate text-xs text-[color:var(--muted)]">{label}</span>
      <button
        type="button"
        title="Copy source"
        aria-label="Copy source"
        onClick={onCopy}
        className="inline-flex min-h-9 min-w-9 items-center justify-center rounded-full text-[color:var(--muted)] transition active:scale-95"
      >
        {copied ? <Check size={16} aria-hidden="true" /> : <Copy size={16} aria-hidden="true" />}
      </button>
    </div>
  );
}

function RenderError({ message }: { message: string }) {
  return (
    <div className="border-b border-[color:var(--border)] bg-[color:var(--danger)]/10 px-3 py-2 text-xs leading-5 text-[color:var(--danger)]">
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
