"use client";

import { Download, FileText, Image as ImageIcon } from "lucide-react";
import { MarkdownMessage } from "@/components/MarkdownMessage";
import type { ChatAttachment, ChatGeneratedFile, ChatMessage, ChatMessageSource } from "@/lib/types";

type MessageBubbleProps = {
  message: ChatMessage;
  isStreaming?: boolean;
};

export function MessageBubble({ message, isStreaming = false }: MessageBubbleProps) {
  const isUser = message.role === "user";
  const attachments = message.attachments ?? [];
  const files = message.files ?? [];

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
          <>
            {message.content ? <p className="whitespace-pre-wrap break-words">{message.content}</p> : null}
            <AttachmentGrid attachments={attachments} align="right" />
          </>
        ) : message.content ? (
          <>
            <MarkdownMessage content={message.content} />
            <GeneratedFileGrid files={files} />
            <SourceChips sources={message.sources ?? []} />
          </>
        ) : files.length > 0 ? (
          <GeneratedFileGrid files={files} />
        ) : isStreaming ? (
          <TypingIndicator />
        ) : null}
      </div>
    </article>
  );
}

function AttachmentGrid({
  attachments,
  align,
}: {
  attachments: ChatAttachment[];
  align: "left" | "right";
}) {
  if (attachments.length === 0) {
    return null;
  }

  return (
    <div className={`mt-3 grid gap-2 ${attachments.length > 1 ? "grid-cols-2" : "grid-cols-1"}`}>
      {attachments.map((attachment) => (
        <a
          key={attachment.id}
          href={attachment.dataUrl}
          download={attachment.name}
          className={`group overflow-hidden rounded-xl border ${
            align === "right"
              ? "border-black/10 bg-black/10"
              : "border-[color:var(--border)] bg-[color:var(--background)]"
          }`}
        >
          {attachment.kind === "image" ? (
            <img
              src={attachment.dataUrl}
              alt={attachment.name}
              className="aspect-square w-full object-cover"
            />
          ) : (
            <div className="flex min-h-24 items-center gap-3 p-3">
              <span className="grid h-12 w-12 shrink-0 place-items-center rounded-lg bg-[color:var(--surface-muted)] text-[color:var(--accent)]">
                <FileText size={21} aria-hidden="true" />
              </span>
              <span className="min-w-0">
                <span className="block truncate text-sm font-medium">{attachment.name}</span>
                <span className="mt-1 block text-xs opacity-70">{formatBytes(attachment.size)}</span>
              </span>
            </div>
          )}
        </a>
      ))}
    </div>
  );
}

function GeneratedFileGrid({ files }: { files: ChatGeneratedFile[] }) {
  if (files.length === 0) {
    return null;
  }

  return (
    <div className="mt-3 grid gap-3">
      {files.map((file, index) =>
        file.mediaType.startsWith("image/") ? (
          <figure
            key={file.id}
            className="overflow-hidden rounded-xl border border-[color:var(--border)] bg-[color:var(--background)]"
          >
            <img
              src={file.dataUrl}
              alt={file.name ?? `Generated image ${index + 1}`}
              className="max-h-[32rem] w-full object-contain"
            />
            <figcaption className="flex items-center justify-between gap-3 border-t border-[color:var(--border)] px-3 py-2 text-xs text-[color:var(--muted)]">
              <span className="inline-flex min-w-0 items-center gap-1.5">
                <ImageIcon size={14} aria-hidden="true" />
                <span className="truncate">{file.name ?? `Generated image ${index + 1}`}</span>
              </span>
              <a
                href={file.dataUrl}
                download={file.name ?? `generated-image-${index + 1}.${extensionFromMediaType(file.mediaType)}`}
                className="inline-flex min-h-8 shrink-0 items-center gap-1 rounded-full border border-[color:var(--border)] px-2 text-[color:var(--foreground)] transition active:scale-95"
              >
                <Download size={13} aria-hidden="true" />
                Save
              </a>
            </figcaption>
          </figure>
        ) : (
          <a
            key={file.id}
            href={file.dataUrl}
            download={file.name ?? `generated-file-${index + 1}`}
            className="flex min-h-16 items-center gap-3 rounded-xl border border-[color:var(--border)] bg-[color:var(--background)] px-3 py-2 text-sm transition active:scale-[0.99]"
          >
            <span className="grid h-11 w-11 shrink-0 place-items-center rounded-lg bg-[color:var(--surface-muted)] text-[color:var(--accent)]">
              <FileText size={19} aria-hidden="true" />
            </span>
            <span className="min-w-0 flex-1">
              <span className="block truncate font-medium">{file.name ?? "Generated file"}</span>
              <span className="mt-0.5 block truncate text-xs text-[color:var(--muted)]">{file.mediaType}</span>
            </span>
            <Download size={16} aria-hidden="true" />
          </a>
        ),
      )}
    </div>
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

function extensionFromMediaType(mediaType: string) {
  if (mediaType === "image/jpeg") {
    return "jpg";
  }

  const subtype = mediaType.split("/")[1]?.split("+")[0];
  return subtype || "bin";
}

function formatBytes(bytes: number) {
  if (bytes < 1024 * 1024) {
    return `${Math.max(1, Math.round(bytes / 1024))} KB`;
  }

  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
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
