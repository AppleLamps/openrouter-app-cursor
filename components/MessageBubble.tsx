"use client";

import { useEffect, useRef, useState } from "react";
import type { ReactNode } from "react";
import {
  Brain,
  Check,
  ChevronDown,
  Copy,
  Download,
  FileText,
  GitBranch,
  Image as ImageIcon,
  Pencil,
  RotateCcw,
  ThumbsDown,
  ThumbsUp,
  Volume2,
  VolumeX,
  X,
} from "lucide-react";
import { MarkdownMessage } from "@/components/MarkdownMessage";
import type { ChatAttachment, ChatGeneratedFile, ChatMessage, ChatMessageSource } from "@/lib/types";
import { formatBytes } from "@/lib/utils";

type MessageBubbleProps = {
  message: ChatMessage;
  contentOverride?: string;
  reasoningOverride?: string;
  isStreaming?: boolean;
  showThinking?: boolean;
  onRetry?: () => void;
  onEditMessage?: (messageId: string, newContent: string) => void;
  onForkFromMessage?: (messageId: string) => void;
};

type Feedback = "up" | "down" | null;

export function MessageBubble({
  message,
  contentOverride,
  reasoningOverride,
  isStreaming = false,
  showThinking = false,
  onRetry,
  onEditMessage,
  onForkFromMessage,
}: MessageBubbleProps) {
  const isUser = message.role === "user";
  const displayContent = contentOverride ?? message.content;
  const displayReasoning = reasoningOverride ?? message.reasoning ?? "";
  const attachments = message.attachments ?? [];
  const files = message.files ?? [];
  const [copied, setCopied] = useState(false);
  const [feedback, setFeedback] = useState<Feedback>(null);
  const [speaking, setSpeaking] = useState(false);
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(message.content);
  const [reasoningOpen, setReasoningOpen] = useState(false);
  const textareaRef = useRef<HTMLTextAreaElement | null>(null);

  useEffect(() => {
    setDraft(message.content);
  }, [message.content]);

  useEffect(() => {
    if (!editing) {
      return;
    }

    const textarea = textareaRef.current;
    if (!textarea) {
      return;
    }

    textarea.style.height = "auto";
    textarea.style.height = `${Math.min(textarea.scrollHeight, 148)}px`;
  }, [draft, editing]);

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
      await navigator.clipboard.writeText(displayContent);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 1400);
    } catch {
      setCopied(false);
    }
  }

  function toggleSpeech() {
    if (typeof window === "undefined" || !("speechSynthesis" in window) || !displayContent.trim()) {
      return;
    }

    if (speaking) {
      window.speechSynthesis.cancel();
      setSpeaking(false);
      return;
    }

    window.speechSynthesis.cancel();
    const utterance = new SpeechSynthesisUtterance(displayContent);
    utterance.onend = () => setSpeaking(false);
    utterance.onerror = () => setSpeaking(false);
    window.speechSynthesis.speak(utterance);
    setSpeaking(true);
  }

  function saveEdit() {
    const next = draft.trim();
    if (!next && attachments.length === 0) {
      return;
    }

    onEditMessage?.(message.id, next);
    setEditing(false);
  }

  function cancelEdit() {
    setDraft(message.content);
    setEditing(false);
  }

  if (isUser) {
    return (
      <article className="group flex justify-end">
        <div className="max-w-[86%] md:max-w-[68%]">
          <div className="rounded-xl bg-(--user-bubble) px-4 py-2.5 text-[0.95rem] leading-6 text-(--foreground)">
            {editing ? (
              <textarea
                ref={textareaRef}
                value={draft}
                rows={1}
                onChange={(event) => setDraft(event.target.value)}
                onKeyDown={(event) => {
                  if (event.key === "Escape") {
                    event.preventDefault();
                    cancelEdit();
                  }
                  if (event.key === "Enter" && !event.shiftKey) {
                    event.preventDefault();
                    saveEdit();
                  }
                }}
                className="block max-h-36 min-h-10 w-full resize-none bg-transparent text-[0.95rem] leading-6 text-(--foreground) outline-none"
              />
            ) : message.content ? (
              <p className="whitespace-pre-wrap wrap-break-word">{message.content}</p>
            ) : null}
            <AttachmentGrid attachments={attachments} align="right" />
          </div>
          {editing ? (
            <div className="mt-2 flex justify-end gap-1">
              <ActionButton label="Save edit" onClick={saveEdit}>
                <Check size={15} aria-hidden="true" />
              </ActionButton>
              <ActionButton label="Cancel edit" onClick={cancelEdit}>
                <X size={15} aria-hidden="true" />
              </ActionButton>
            </div>
          ) : (
            <MessageActions
              align="right"
              timestamp={formatTimestamp(message.createdAt)}
              copied={copied}
              speaking={speaking}
              feedback={feedback}
              onCopy={copyMessage}
              onSpeak={toggleSpeech}
              onFeedback={setFeedback}
              onEdit={
                onEditMessage
                  ? () => {
                    setDraft(message.content);
                    setEditing(true);
                  }
                  : undefined
              }
              onFork={onForkFromMessage ? () => onForkFromMessage(message.id) : undefined}
            />
          )}
        </div>
      </article>
    );
  }

  return (
    <article className="group max-w-184">
      {showThinking && !displayReasoning ? (
        <button
          type="button"
          className="mb-3 inline-flex h-8 items-center gap-2 rounded-md border border-(--border) bg-(--surface) px-3 text-xs text-(--muted)"
        >
          <TypingIndicator />
          Thought for a moment
        </button>
      ) : null}

      {displayReasoning ? (
        <div className="mb-3 rounded-xl border border-(--border) bg-(--surface) text-sm">
          <button
            type="button"
            onClick={() => setReasoningOpen((current) => !current)}
            className="flex min-h-10 w-full items-center gap-2 px-3 text-left text-xs font-medium text-(--muted) transition hover:text-(--foreground)"
            aria-expanded={reasoningOpen}
          >
            <Brain size={14} aria-hidden="true" />
            <span>{isStreaming && !displayContent ? "Thinking…" : "Reasoning"}</span>
            <ChevronDown
              size={14}
              aria-hidden="true"
              className={`ml-auto shrink-0 transition ${reasoningOpen ? "rotate-180" : ""}`}
            />
          </button>
          {reasoningOpen || (isStreaming && !displayContent) ? (
            <div className="border-t border-(--border) px-3 py-2.5 text-[0.85rem] leading-6 text-(--muted)">
              <MarkdownMessage content={displayReasoning} deferRichBlocks={isStreaming} />
            </div>
          ) : null}
        </div>
      ) : null}

      {displayContent ? (
        <div className="assistant-message">
          <MarkdownMessage content={displayContent} deferRichBlocks={isStreaming} />
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
        onFork={onForkFromMessage ? () => onForkFromMessage(message.id) : undefined}
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
  onEdit,
  onFork,
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
  onEdit?: () => void;
  onFork?: () => void;
}) {
  return (
    <div
      className={`mt-2 flex items-center gap-1 text-(--muted) opacity-100 transition md:opacity-0 md:group-hover:opacity-100 md:group-focus-within:opacity-100 ${align === "right" ? "justify-end" : "justify-start"
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
      {onEdit ? (
        <ActionButton label="Edit" onClick={onEdit}>
          <Pencil size={15} aria-hidden="true" />
        </ActionButton>
      ) : null}
      {onFork ? (
        <ActionButton label="Fork" onClick={onFork}>
          <GitBranch size={15} aria-hidden="true" />
        </ActionButton>
      ) : null}
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
      className={`grid h-8 w-8 place-items-center rounded-md transition hover:bg-(--surface-muted) ${active ? "text-(--foreground)" : ""
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
          className={`group overflow-hidden rounded-xl border ${align === "right"
              ? "border-black/5 bg-white/65"
              : "border-(--border) bg-(--surface)"
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
              <span className="grid h-12 w-12 shrink-0 place-items-center rounded-lg bg-(--surface-muted) text-(--brand)">
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
            className="overflow-hidden rounded-lg border border-(--border) bg-(--surface)"
          >
            <img
              src={file.dataUrl}
              alt={file.name ?? `Generated image ${index + 1}`}
              className="max-h-128 w-full object-contain"
            />
            <figcaption className="flex items-center justify-between gap-3 border-t border-(--border) px-3 py-2 text-xs text-(--muted)">
              <span className="inline-flex min-w-0 items-center gap-1.5">
                <ImageIcon size={14} aria-hidden="true" />
                <span className="truncate">{file.name ?? `Generated image ${index + 1}`}</span>
              </span>
              <a
                href={file.dataUrl}
                download={file.name ?? `generated-image-${index + 1}.${extensionFromMediaType(file.mediaType)}`}
                className="inline-flex min-h-8 shrink-0 items-center gap-1 rounded-md border border-(--border) px-2 text-(--foreground) transition hover:bg-(--surface-muted)"
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
            className="flex min-h-16 items-center gap-3 rounded-lg border border-(--border) bg-(--surface) px-3 py-2 text-sm transition hover:bg-(--surface-muted)"
          >
            <span className="grid h-11 w-11 shrink-0 place-items-center rounded-lg bg-(--surface-muted) text-(--brand)">
              <FileText size={19} aria-hidden="true" />
            </span>
            <span className="min-w-0 flex-1">
              <span className="block truncate font-medium">{file.name ?? "Generated file"}</span>
              <span className="mt-0.5 block truncate text-xs text-(--muted)">{file.mediaType}</span>
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
    <div className="mt-4 flex flex-wrap gap-2 border-t border-(--border) pt-3">
      {sources.map((source, index) => (
        <a
          key={`${source.url}-${source.id}`}
          href={source.url}
          target="_blank"
          rel="noreferrer"
          className="inline-flex min-h-8 max-w-full items-center gap-1 rounded-md border border-(--border) bg-(--surface) px-2.5 text-xs text-(--foreground) transition hover:bg-(--surface-muted)"
        >
          <span className="shrink-0 text-(--brand)">{index + 1}</span>
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
      <span className="typing-dot h-1.5 w-1.5 rounded-full bg-(--brand)" />
      <span className="typing-dot h-1.5 w-1.5 rounded-full bg-(--brand)" />
      <span className="typing-dot h-1.5 w-1.5 rounded-full bg-(--brand)" />
    </span>
  );
}
