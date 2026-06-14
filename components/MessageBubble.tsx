"use client";

import { MarkdownMessage } from "@/components/MarkdownMessage";
import type { ChatMessage } from "@/lib/types";

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
          <MarkdownMessage content={message.content} />
        ) : isStreaming ? (
          <TypingIndicator />
        ) : null}
      </div>
    </article>
  );
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
