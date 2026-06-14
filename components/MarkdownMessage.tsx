"use client";

import React, { useMemo, useState } from "react";
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
          p: ({ children }) => <p className="mb-3 last:mb-0">{children}</p>,
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
          ul: ({ children }) => <ul className="mb-3 list-disc space-y-1 pl-5 last:mb-0">{children}</ul>,
          ol: ({ children }) => <ol className="mb-3 list-decimal space-y-1 pl-5 last:mb-0">{children}</ol>,
          li: ({ children }) => <li className="pl-1">{children}</li>,
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
          pre: ({ children }) => <CodeBlock>{children}</CodeBlock>,
          code: ({ className, children }) => {
            if (className?.startsWith("language-")) {
              return <code className={className}>{children}</code>;
            }

            return (
              <code className="rounded-md bg-black/35 px-1.5 py-0.5 text-[0.88em] text-[color:var(--accent)]">
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

function CodeBlock({ children }: { children: React.ReactNode }) {
  const [copied, setCopied] = useState(false);
  const code = useMemo(() => extractText(children).replace(/\n$/, ""), [children]);
  const language = useMemo(() => extractLanguage(children), [children]);

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
    <div className="mb-3 overflow-hidden rounded-lg border border-[color:var(--border)] bg-[#070808] last:mb-0">
      <div className="flex min-h-10 items-center justify-between gap-3 border-b border-[color:var(--border)] px-3">
        <span className="truncate text-xs text-[color:var(--muted)]">{language || "code"}</span>
        <button
          type="button"
          title="Copy code"
          aria-label="Copy code"
          onClick={copyCode}
          className="inline-flex min-h-9 min-w-9 items-center justify-center rounded-full text-[color:var(--muted)] transition active:scale-95"
        >
          {copied ? <Check size={16} aria-hidden="true" /> : <Copy size={16} aria-hidden="true" />}
        </button>
      </div>
      <pre className="scroll-area overflow-x-auto p-3 text-[0.84rem] leading-5 text-[#f7f1e8]">
        <code>{code}</code>
      </pre>
    </div>
  );
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
