"use client";

import { useEffect, useRef, useState } from "react";
import {
  FileText,
  Image as ImageIcon,
  Mic,
  Paperclip,
  Send,
  Settings2,
  SlidersHorizontal,
  Square,
  X,
} from "lucide-react";
import type { ChatAttachment } from "@/lib/types";
import { createId, formatBytes } from "@/lib/utils";

type ComposerProps = {
  isStreaming: boolean;
  disabled?: boolean;
  model: string;
  onSend: (message: string, attachments?: ChatAttachment[]) => boolean;
  onStop: () => void;
  onOpenSettings: () => void;
  onVoice: () => void;
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

export function Composer({
  isStreaming,
  disabled = false,
  model,
  onSend,
  onStop,
  onOpenSettings,
  onVoice,
}: ComposerProps) {
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
      className="composer-safe mx-auto flex max-w-188 flex-col gap-2"
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
        <p className="text-xs text-(--danger)" role="status">
          {attachmentError}
        </p>
      ) : null}

      <div className="rounded-[1.1rem] border border-(--border-strong) bg-(--surface-raised) p-3 shadow-[0_8px_24px_rgba(31,31,30,0.07)]">
        <input
          ref={fileInputRef}
          type="file"
          accept="image/png,image/jpeg,image/webp,image/gif,application/pdf"
          multiple
          className="hidden"
          onChange={(event) => void addFiles(event.target.files)}
        />
        <label className="block">
          <span className="sr-only">Message</span>
          <textarea
            ref={textareaRef}
            value={value}
            rows={1}
            disabled={disabled}
            placeholder="Write a message..."
            onChange={(event) => setValue(event.target.value)}
            onKeyDown={(event) => {
              if (event.key === "Enter" && !event.shiftKey) {
                event.preventDefault();
                submit();
              }
            }}
            className="block max-h-40 min-h-10 w-full resize-none bg-transparent text-base leading-6 text-(--foreground) outline-none placeholder:text-(--muted) disabled:opacity-60"
          />
        </label>

        <div className="flex items-center justify-between gap-3 pt-2">
          <button
            type="button"
            title="Attach image or PDF"
            aria-label="Attach image or PDF"
            disabled={disabled || isStreaming || attachments.length >= MAX_ATTACHMENTS}
            onClick={() => fileInputRef.current?.click()}
            className="grid h-9 w-9 place-items-center rounded-md text-(--foreground) transition hover:bg-(--surface-muted) disabled:cursor-not-allowed disabled:opacity-45"
          >
            <Paperclip size={18} aria-hidden="true" />
          </button>

          <div className="flex min-w-0 items-center gap-1.5">
            <button
              type="button"
              onClick={onOpenSettings}
              className="hidden min-w-0 items-center gap-1 rounded-md px-2 py-1.5 text-sm text-(--muted) hover:bg-(--surface-muted) sm:inline-flex"
            >
              <span className="truncate">{formatModelLabel(model)}</span>
              <SlidersHorizontal size={14} aria-hidden="true" />
            </button>
            <button
              type="button"
              title="Settings"
              aria-label="Settings"
              onClick={onOpenSettings}
              className="grid h-9 w-9 place-items-center rounded-md text-(--muted) hover:bg-(--surface-muted)"
            >
              <Settings2 size={17} aria-hidden="true" />
            </button>
            <button
              type="button"
              title="Voice input"
              aria-label="Voice input"
              onClick={onVoice}
              className="grid h-9 w-9 place-items-center rounded-md text-(--muted) hover:bg-(--surface-muted)"
            >
              <Mic size={17} aria-hidden="true" />
            </button>
            {isStreaming ? (
              <button
                type="button"
                title="Stop generating"
                aria-label="Stop generating"
                onClick={onStop}
                className="grid h-9 w-9 place-items-center rounded-md bg-(--danger) text-white transition active:scale-95"
              >
                <Square size={15} fill="currentColor" aria-hidden="true" />
              </button>
            ) : (
              <button
                type="submit"
                title="Send"
                aria-label="Send"
                disabled={disabled || (!value.trim() && attachments.length === 0)}
                className="grid h-9 w-9 place-items-center rounded-md bg-(--foreground) text-(--background) transition active:scale-95 disabled:cursor-not-allowed disabled:bg-(--surface-muted) disabled:text-(--muted)"
              >
                <Send size={17} aria-hidden="true" />
              </button>
            )}
          </div>
        </div>
      </div>

      <p className="text-center text-xs text-(--muted)">
        AI can make mistakes. Please double-check important details.
      </p>
    </form>
  );
}

function formatModelLabel(model: string) {
  const label = model.split("/").pop() || model;
  return label.length > 22 ? `${label.slice(0, 19)}...` : label;
}

function AttachmentPreview({
  attachment,
  onRemove,
}: {
  attachment: ChatAttachment;
  onRemove: () => void;
}) {
  return (
    <div className="relative flex h-20 min-w-40 max-w-56 items-center gap-2 rounded-lg border border-(--border) bg-(--surface) p-2">
      {attachment.kind === "image" ? (
        <img
          src={attachment.dataUrl}
          alt=""
          className="h-14 w-14 shrink-0 rounded-lg object-cover"
        />
      ) : (
        <div className="grid h-14 w-14 shrink-0 place-items-center rounded-lg bg-(--surface-muted) text-(--accent)">
          <FileText size={20} aria-hidden="true" />
        </div>
      )}
      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-1">
          {attachment.kind === "image" ? (
            <ImageIcon size={13} className="shrink-0 text-(--muted)" aria-hidden="true" />
          ) : null}
          <p className="truncate text-xs font-medium">{attachment.name}</p>
        </div>
        <p className="mt-1 text-xs text-(--muted)">{formatBytes(attachment.size)}</p>
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
