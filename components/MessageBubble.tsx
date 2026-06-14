"use client";

import { MarkdownMessage } from "@/components/MarkdownMessage";
import type { ChatMessage, ChatMessageSource } from "@/lib/types";

type MessageBubbleProps = {
  message: ChatMessage;
  isStreaming?: boolean;
};

export function MessageBubble({ message, isStreaming = false }: MessageBubbleProps) {
  const isUser = message.role === "user";

  return (
    <article className={`flex ${isUser ? "justify-end" : "justify-start"}`}>
      <div
        className={[
          "max-w-[88%] rounded-[1.35rem] px-4 py-3 text-[0.96rem] leading-6 shadow-[0_8px_26px_rgba(0,0,0,0.18)]",
          isUser
            ? "rounded-br-md bg-[color:var(--accent-strong)] text-[#10120f]"
            : "rounded-bl-md border border-[color:var(--border)] bg-[color:var(--surface-raised)] text-[color:var(--foreground)]",
        ].join(" ")}
      >
        {isUser ? (
          <p className="whitespace-pre-wrap break-words">{message.content}</p>
        ) : message.content ? (
          <>
            <MarkdownMessage content={message.content} />
            <SourceChips sources={message.sources ?? []} />
          </>
        ) : isStreaming ? (
          <TypingIndicator />
        ) : null}
      </div>
    </article>
  );
}

function SourceChips({ sources }: { sources: ChatMessageSource[] }) {
  if (sources.length === 0) {
    return null;
  }

  return (
    <div className="mt-3 flex flex-wrap gap-2 border-t border-[color:var(--border)] pt-3">
      {sources.map((source, index) => (
        <a
          key={`${source.url}-${source.id}`}
          href={source.url}
          target="_blank"
          rel="noreferrer"
          className="inline-flex min-h-8 max-w-full items-center gap-1 rounded-full border border-[color:var(--border)] bg-[color:var(--surface-muted)] px-2.5 text-xs text-[color:var(--foreground)] transition active:scale-95"
        >
          <span className="shrink-0 text-[color:var(--accent)]">{index + 1}</span>
          <span className="truncate">{source.title?.trim() || hostnameFromUrl(source.url)}</span>
        </a>
      ))}
    </div>
  );
}

function hostnameFromUrl(url: string) {
  try {
    return new URL(url).hostname.replace(/^www\./, "");
  } catch {
    return url;
  }
}

function TypingIndicator() {
  return (
    <div className="flex h-6 items-center gap-1.5" aria-label="Assistant is generating">
      <span className="typing-dot h-1.5 w-1.5 rounded-full bg-[color:var(--muted)]" />
      <span className="typing-dot h-1.5 w-1.5 rounded-full bg-[color:var(--muted)]" />
      <span className="typing-dot h-1.5 w-1.5 rounded-full bg-[color:var(--muted)]" />
    </div>
  );
}
