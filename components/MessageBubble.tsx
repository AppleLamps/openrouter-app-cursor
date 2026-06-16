"use client";

import { useEffect, useState } from "react";
import type { ReactNode } from "react";
import {
  Check,
  Copy,
  Download,
  FileText,
  Image as ImageIcon,
  RotateCcw,
  ThumbsDown,
  ThumbsUp,
  Volume2,
  VolumeX,
} from "lucide-react";
import { MarkdownMessage } from "@/components/MarkdownMessage";
import type { ChatAttachment, ChatGeneratedFile, ChatMessage, ChatMessageSource } from "@/lib/types";

type MessageBubbleProps = {
  message: ChatMessage;
  isStreaming?: boolean;
  showThinking?: boolean;
  onRetry?: () => void;
};

type Feedback = "up" | "down" | null;

export function MessageBubble({
  message,
  isStreaming = false,
  showThinking = false,
  onRetry,
}: MessageBubbleProps) {
  const isUser = message.role === "user";
  const attachments = message.attachments ?? [];
  const files = message.files ?? [];
  const [copied, setCopied] = useState(false);
  const [feedback, setFeedback] = useState<Feedback>(null);
  const [speaking, setSpeaking] = useState(false);

  useEffect(() => {
    if (!speaking || typeof window === "undefined" || !("speechSynthesis" in window)) {
      return;
    }

    const interval = window.setInterval(() => {
      if (!window.speechSynthesis.speaking) {
        setSpeaking(false);
        window.clearInterval(interval);
      }
    }, 300);

    return () => window.clearInterval(interval);
  }, [speaking]);

  async function copyMessage() {
    try {
      await navigator.clipboard.writeText(message.content);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 1400);
    } catch {
      setCopied(false);
    }
  }

  function toggleSpeech() {
    if (typeof window === "undefined" || !("speechSynthesis" in window) || !message.content.trim()) {
      return;
    }

    if (speaking) {
      window.speechSynthesis.cancel();
      setSpeaking(false);
      return;
    }

    window.speechSynthesis.cancel();
    const utterance = new SpeechSynthesisUtterance(message.content);
    utterance.onend = () => setSpeaking(false);
    utterance.onerror = () => setSpeaking(false);
    window.speechSynthesis.speak(utterance);
    setSpeaking(true);
  }

  if (isUser) {
    return (
      <article className="group flex justify-end">
        <div className="max-w-[82%] md:max-w-[70%]">
          <div className="rounded-2xl bg-[color:var(--user-bubble)] px-4 py-2.5 text-[0.95rem] leading-6 text-[color:var(--foreground)]">
            {message.content ? <p className="whitespace-pre-wrap break-words">{message.content}</p> : null}
            <AttachmentGrid attachments={attachments} align="right" />
          </div>
          <MessageActions
            align="right"
            timestamp={formatTimestamp(message.createdAt)}
            copied={copied}
            speaking={speaking}
            feedback={feedback}
            onCopy={copyMessage}
            onSpeak={toggleSpeech}
            onFeedback={setFeedback}
          />
        </div>
      </article>
    );
  }

  return (
    <article className="group max-w-3xl">
      {showThinking ? (
        <button
          type="button"
          className="mb-3 inline-flex h-8 items-center gap-2 rounded-full border border-[color:var(--border)] bg-[color:var(--surface)] px-3 text-xs text-[color:var(--muted)]"
        >
          <TypingIndicator />
          Thought for a moment
        </button>
      ) : null}

      {message.content ? (
        <div className="assistant-message">
          <MarkdownMessage content={message.content} />
        </div>
      ) : files.length > 0 || showThinking ? null : isStreaming ? (
        <div className="py-2">
          <TypingIndicator />
        </div>
      ) : null}
      <GeneratedFileGrid files={files} />
      <SourceChips sources={message.sources ?? []} />
      <MessageActions
        align="left"
        copied={copied}
        speaking={speaking}
        feedback={feedback}
        onCopy={copyMessage}
        onSpeak={toggleSpeech}
        onFeedback={setFeedback}
        onRetry={onRetry}
      />
    </article>
  );
}

function MessageActions({
  align,
  timestamp,
  copied,
  speaking,
  feedback,
  onCopy,
  onSpeak,
  onFeedback,
  onRetry,
}: {
  align: "left" | "right";
  timestamp?: string;
  copied: boolean;
  speaking: boolean;
  feedback: Feedback;
  onCopy: () => void;
  onSpeak: () => void;
  onFeedback: (feedback: Feedback) => void;
  onRetry?: () => void;
}) {
  return (
    <div
      className={`mt-2 flex items-center gap-1 text-[color:var(--muted)] opacity-100 transition md:opacity-0 md:group-hover:opacity-100 md:group-focus-within:opacity-100 ${
        align === "right" ? "justify-end" : "justify-start"
      }`}
    >
      {timestamp ? <span className="mr-1 text-xs">{timestamp}</span> : null}
      <ActionButton label={copied ? "Copied" : "Copy"} onClick={onCopy}>
        {copied ? <Check size={15} aria-hidden="true" /> : <Copy size={15} aria-hidden="true" />}
      </ActionButton>
      <ActionButton label={speaking ? "Stop reading" : "Read aloud"} onClick={onSpeak}>
        {speaking ? <VolumeX size={15} aria-hidden="true" /> : <Volume2 size={15} aria-hidden="true" />}
      </ActionButton>
      <ActionButton
        label="Thumbs up"
        active={feedback === "up"}
        onClick={() => onFeedback(feedback === "up" ? null : "up")}
      >
        <ThumbsUp size={15} aria-hidden="true" />
      </ActionButton>
      <ActionButton
        label="Thumbs down"
        active={feedback === "down"}
        onClick={() => onFeedback(feedback === "down" ? null : "down")}
      >
        <ThumbsDown size={15} aria-hidden="true" />
      </ActionButton>
      {onRetry ? (
        <ActionButton label="Retry" onClick={onRetry}>
          <RotateCcw size={15} aria-hidden="true" />
        </ActionButton>
      ) : null}
    </div>
  );
}

function ActionButton({
  label,
  active = false,
  onClick,
  children,
}: {
  label: string;
  active?: boolean;
  onClick: () => void;
  children: ReactNode;
}) {
  return (
    <button
      type="button"
      title={label}
      aria-label={label}
      onClick={onClick}
      className={`grid h-8 w-8 place-items-center rounded-lg transition hover:bg-[color:var(--surface-muted)] ${
        active ? "text-[color:var(--foreground)]" : ""
      }`}
    >
      {children}
    </button>
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
              ? "border-black/5 bg-white/65"
              : "border-[color:var(--border)] bg-[color:var(--surface)]"
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
              <span className="grid h-12 w-12 shrink-0 place-items-center rounded-lg bg-[color:var(--surface-muted)] text-[color:var(--brand)]">
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
    <div className="mt-4 grid gap-3">
      {files.map((file, index) =>
        file.mediaType.startsWith("image/") ? (
          <figure
            key={file.id}
            className="overflow-hidden rounded-2xl border border-[color:var(--border)] bg-[color:var(--surface)]"
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
                className="inline-flex min-h-8 shrink-0 items-center gap-1 rounded-full border border-[color:var(--border)] px-2 text-[color:var(--foreground)] transition hover:bg-[color:var(--surface-muted)]"
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
            className="flex min-h-16 items-center gap-3 rounded-2xl border border-[color:var(--border)] bg-[color:var(--surface)] px-3 py-2 text-sm transition hover:bg-[color:var(--surface-muted)]"
          >
            <span className="grid h-11 w-11 shrink-0 place-items-center rounded-lg bg-[color:var(--surface-muted)] text-[color:var(--brand)]">
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
    <div className="mt-4 flex flex-wrap gap-2 border-t border-[color:var(--border)] pt-3">
      {sources.map((source, index) => (
        <a
          key={`${source.url}-${source.id}`}
          href={source.url}
          target="_blank"
          rel="noreferrer"
          className="inline-flex min-h-8 max-w-full items-center gap-1 rounded-full border border-[color:var(--border)] bg-[color:var(--surface)] px-2.5 text-xs text-[color:var(--foreground)] transition hover:bg-[color:var(--surface-muted)]"
        >
          <span className="shrink-0 text-[color:var(--brand)]">{index + 1}</span>
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

function formatTimestamp(createdAt?: string) {
  if (!createdAt) {
    return undefined;
  }

  const timestamp = Date.parse(createdAt);
  if (!Number.isFinite(timestamp)) {
    return undefined;
  }

  return new Intl.DateTimeFormat(undefined, {
    hour: "numeric",
    minute: "2-digit",
  }).format(timestamp);
}

function TypingIndicator() {
  return (
    <span className="inline-flex h-5 items-center gap-1.5" aria-label="Assistant is generating">
      <span className="typing-dot h-1.5 w-1.5 rounded-full bg-[color:var(--brand)]" />
      <span className="typing-dot h-1.5 w-1.5 rounded-full bg-[color:var(--brand)]" />
      <span className="typing-dot h-1.5 w-1.5 rounded-full bg-[color:var(--brand)]" />
    </span>
  );
}
