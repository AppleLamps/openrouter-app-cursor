"use client";

import { useEffect, useRef, useState } from "react";
import { FileText, Image as ImageIcon, Paperclip, Send, Square, X } from "lucide-react";
import type { ChatAttachment } from "@/lib/types";

type ComposerProps = {
  isStreaming: boolean;
  disabled?: boolean;
  onSend: (message: string, attachments?: ChatAttachment[]) => boolean;
  onStop: () => void;
};

const MAX_ATTACHMENTS = 4;
const MAX_ATTACHMENT_BYTES = 5 * 1024 * 1024;
const SUPPORTED_MEDIA_TYPES = new Set([
  "image/png",
  "image/jpeg",
  "image/webp",
  "image/gif",
  "application/pdf",
]);

export function Composer({ isStreaming, disabled = false, onSend, onStop }: ComposerProps) {
  const [value, setValue] = useState("");
  const [attachments, setAttachments] = useState<ChatAttachment[]>([]);
  const [attachmentError, setAttachmentError] = useState("");
  const textareaRef = useRef<HTMLTextAreaElement | null>(null);
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  useEffect(() => {
    const textarea = textareaRef.current;
    if (!textarea) {
      return;
    }
    textarea.style.height = "auto";
    textarea.style.height = `${Math.min(textarea.scrollHeight, 148)}px`;
  }, [value]);

  function submit() {
    const next = value.trim();
    if ((!next && attachments.length === 0) || disabled || isStreaming) {
      return;
    }

    if (onSend(next, attachments) !== false) {
      setValue("");
      setAttachments([]);
      setAttachmentError("");
    }
  }

  async function addFiles(files: FileList | null) {
    if (!files || files.length === 0) {
      return;
    }

    setAttachmentError("");
    const nextAttachments: ChatAttachment[] = [];
    const availableSlots = MAX_ATTACHMENTS - attachments.length;

    for (const file of Array.from(files).slice(0, availableSlots)) {
      if (!SUPPORTED_MEDIA_TYPES.has(file.type)) {
        setAttachmentError("Attach PNG, JPEG, WebP, GIF, or PDF files.");
        continue;
      }

      if (file.size > MAX_ATTACHMENT_BYTES) {
        setAttachmentError("Each attachment must be 5 MB or smaller.");
        continue;
      }

      nextAttachments.push({
        id: createId(),
        name: file.name,
        mediaType: file.type,
        size: file.size,
        dataUrl: await readAsDataUrl(file),
        kind: file.type === "application/pdf" ? "pdf" : "image",
      });
    }

    if (files.length > availableSlots) {
      setAttachmentError(`You can attach up to ${MAX_ATTACHMENTS} files per message.`);
    }

    if (nextAttachments.length > 0) {
      setAttachments((current) => [...current, ...nextAttachments]);
    }

    if (fileInputRef.current) {
      fileInputRef.current.value = "";
    }
  }

  return (
    <form
      className="composer-safe flex flex-col gap-2"
      onSubmit={(event) => {
        event.preventDefault();
        submit();
      }}
    >
      {attachments.length > 0 ? (
        <div className="scroll-area flex max-h-28 gap-2 overflow-x-auto">
          {attachments.map((attachment) => (
            <AttachmentPreview
              key={attachment.id}
              attachment={attachment}
              onRemove={() =>
                setAttachments((current) => current.filter((item) => item.id !== attachment.id))
              }
            />
          ))}
        </div>
      ) : null}

      {attachmentError ? (
        <p className="text-xs text-[color:var(--danger)]" role="status">
          {attachmentError}
        </p>
      ) : null}

      <div className="flex items-end gap-2">
        <input
          ref={fileInputRef}
          type="file"
          accept="image/png,image/jpeg,image/webp,image/gif,application/pdf"
          multiple
          className="hidden"
          onChange={(event) => void addFiles(event.target.files)}
        />
        <button
          type="button"
          title="Attach image or PDF"
          aria-label="Attach image or PDF"
          disabled={disabled || isStreaming || attachments.length >= MAX_ATTACHMENTS}
          onClick={() => fileInputRef.current?.click()}
          className="grid min-h-11 min-w-11 place-items-center rounded-full border border-[color:var(--border)] bg-[color:var(--surface)] text-[color:var(--muted)] transition active:scale-95 disabled:cursor-not-allowed disabled:opacity-50"
        >
          <Paperclip size={18} aria-hidden="true" />
        </button>

        <label className="min-h-11 flex-1 rounded-[1.4rem] border border-[color:var(--border)] bg-[color:var(--surface)] px-4 py-2.5 shadow-[0_10px_30px_rgba(0,0,0,0.22)]">
          <span className="sr-only">Message</span>
          <textarea
            ref={textareaRef}
            value={value}
            rows={1}
            disabled={disabled}
            placeholder="Message"
            onChange={(event) => setValue(event.target.value)}
            onKeyDown={(event) => {
              if (event.key === "Enter" && !event.shiftKey) {
                event.preventDefault();
                submit();
              }
            }}
            className="block max-h-36 min-h-6 w-full resize-none bg-transparent text-base leading-6 text-[color:var(--foreground)] outline-none placeholder:text-[color:var(--muted)] disabled:opacity-60"
          />
        </label>

        {isStreaming ? (
          <button
            type="button"
            title="Stop generating"
            aria-label="Stop generating"
            onClick={onStop}
            className="grid min-h-11 min-w-11 place-items-center rounded-full bg-[color:var(--danger)] text-[color:var(--background)] transition active:scale-95"
          >
            <Square size={17} fill="currentColor" aria-hidden="true" />
          </button>
        ) : (
          <button
            type="submit"
            title="Send"
            aria-label="Send"
            disabled={disabled || (!value.trim() && attachments.length === 0)}
            className="grid min-h-11 min-w-11 place-items-center rounded-full bg-[color:var(--accent-strong)] text-[color:var(--background)] transition active:scale-95 disabled:cursor-not-allowed disabled:bg-[color:var(--surface-muted)] disabled:text-[color:var(--muted)]"
          >
            <Send size={18} aria-hidden="true" />
          </button>
        )}
      </div>
    </form>
  );
}

function AttachmentPreview({
  attachment,
  onRemove,
}: {
  attachment: ChatAttachment;
  onRemove: () => void;
}) {
  return (
    <div className="relative flex h-20 min-w-40 max-w-56 items-center gap-2 rounded-xl border border-[color:var(--border)] bg-[color:var(--surface)] p-2">
      {attachment.kind === "image" ? (
        <img
          src={attachment.dataUrl}
          alt=""
          className="h-14 w-14 shrink-0 rounded-lg object-cover"
        />
      ) : (
        <div className="grid h-14 w-14 shrink-0 place-items-center rounded-lg bg-[color:var(--surface-muted)] text-[color:var(--accent)]">
          <FileText size={20} aria-hidden="true" />
        </div>
      )}
      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-1">
          {attachment.kind === "image" ? (
            <ImageIcon size={13} className="shrink-0 text-[color:var(--muted)]" aria-hidden="true" />
          ) : null}
          <p className="truncate text-xs font-medium">{attachment.name}</p>
        </div>
        <p className="mt-1 text-xs text-[color:var(--muted)]">{formatBytes(attachment.size)}</p>
      </div>
      <button
        type="button"
        title="Remove attachment"
        aria-label={`Remove ${attachment.name}`}
        onClick={onRemove}
        className="absolute right-1 top-1 grid h-7 w-7 place-items-center rounded-full bg-black/60 text-white"
      >
        <X size={14} aria-hidden="true" />
      </button>
    </div>
  );
}

function readAsDataUrl(file: File) {
  return new Promise<string>((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result));
    reader.onerror = () => reject(reader.error);
    reader.readAsDataURL(file);
  });
}

function createId() {
  if (typeof crypto !== "undefined" && "randomUUID" in crypto) {
    return crypto.randomUUID();
  }

  return `${Date.now()}-${Math.random().toString(36).slice(2)}`;
}

function formatBytes(bytes: number) {
  if (bytes < 1024 * 1024) {
    return `${Math.max(1, Math.round(bytes / 1024))} KB`;
  }

  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}
