"use client";

import { useEffect, useRef, useState } from "react";
import {
  Braces,
  Check,
  ChevronDown,
  FileText,
  Image as ImageIcon,
  Mic,
  Paperclip,
  Plus,
  Send,
  Square,
  X,
} from "lucide-react";
import type { ChatAttachment, OpenRouterModel } from "@/lib/types";
import { createId, formatBytes } from "@/lib/utils";

type ComposerProps = {
  isStreaming: boolean;
  disabled?: boolean;
  model: string;
  placeholder?: string;
  showDisclaimer?: boolean;
  seed?: { id: string; text: string } | null;
  onSend: (message: string, attachments?: ChatAttachment[], options?: { jsonMode?: boolean }) => boolean;
  onStop: () => void;
  onOpenSettings: () => void;
  onModelChange?: (model: string) => void;
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
  placeholder = "Write a message...",
  showDisclaimer = true,
  seed = null,
  onSend,
  onStop,
  onOpenSettings,
  onModelChange,
  onVoice,
}: ComposerProps) {
  const [value, setValue] = useState("");
  const [attachments, setAttachments] = useState<ChatAttachment[]>([]);
  const [jsonMode, setJsonMode] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);
  const [attachmentError, setAttachmentError] = useState("");
  const [modelPickerOpen, setModelPickerOpen] = useState(false);
  const [modelQuery, setModelQuery] = useState("");
  const [pickerModels, setPickerModels] = useState<OpenRouterModel[]>([]);
  const [pickerLoading, setPickerLoading] = useState(false);
  const [isFocused, setIsFocused] = useState(false);
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

  useEffect(() => {
    if (!seed) {
      return;
    }
    setValue(seed.text);
    const textarea = textareaRef.current;
    if (textarea) {
      textarea.focus();
      const end = seed.text.length;
      requestAnimationFrame(() => textarea.setSelectionRange(end, end));
    }
  }, [seed]);

  useEffect(() => {
    if (!modelPickerOpen) {
      return;
    }
    const controller = new AbortController();
    const timeout = window.setTimeout(async () => {
      setPickerLoading(true);
      try {
        const params = new URLSearchParams({ sort: "most-popular" });
        if (modelQuery.trim()) {
          params.set("q", modelQuery.trim());
        }
        const res = await fetch(`/api/models?${params.toString()}`, { signal: controller.signal });
        if (res.ok) {
          const data = (await res.json()) as { data?: OpenRouterModel[] };
          setPickerModels(data.data ?? []);
        }
      } catch {
        // aborted or network error — leave previous list in place
      } finally {
        if (!controller.signal.aborted) {
          setPickerLoading(false);
        }
      }
    }, 200);
    return () => {
      window.clearTimeout(timeout);
      controller.abort();
    };
  }, [modelPickerOpen, modelQuery]);

  function submit() {
    const next = value.trim();
    if ((!next && attachments.length === 0) || disabled || isStreaming) {
      return;
    }

    if (onSend(next, attachments, { jsonMode }) !== false) {
      setValue("");
      setAttachments([]);
      setJsonMode(false);
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
      className="composer-safe mx-auto flex max-w-184 flex-col gap-2"
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

      <div className={`rounded-[1.1rem] border bg-(--surface-raised) p-3 transition-[border-color,box-shadow] duration-150 ${isFocused
        ? "border-(--border-strong) shadow-[0_4px_20px_rgba(31,31,30,0.1)]"
        : "border-(--border) shadow-[0_4px_16px_rgba(31,31,30,0.05)]"
        }`}>
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
            placeholder={placeholder}
            onChange={(event) => setValue(event.target.value)}
            onFocus={() => setIsFocused(true)}
            onBlur={() => setIsFocused(false)}
            onKeyDown={(event) => {
              if (event.key === "Enter" && !event.shiftKey) {
                event.preventDefault();
                submit();
              }
            }}
            className="block max-h-40 min-h-6 w-full resize-none bg-transparent text-base leading-6 text-(--foreground) outline-none placeholder:text-(--muted) disabled:opacity-60"
          />
        </label>

        <div className="flex items-center justify-between gap-3 pt-2">
          <div className="relative flex items-center gap-1.5">
            <button
              type="button"
              title="Add attachment or tool"
              aria-label="Add attachment or tool"
              aria-haspopup="menu"
              aria-expanded={menuOpen}
              disabled={disabled || isStreaming}
              onClick={() => setMenuOpen((current) => !current)}
              className="grid h-9 w-9 place-items-center rounded-full text-(--foreground) transition hover:bg-(--surface-muted) disabled:cursor-not-allowed disabled:opacity-45"
            >
              <Plus size={18} aria-hidden="true" />
            </button>

            {jsonMode ? (
              <button
                type="button"
                title="JSON mode on — click to turn off"
                aria-label="Turn off JSON mode"
                onClick={() => setJsonMode(false)}
                className="inline-flex h-7 items-center gap-1 rounded-md bg-(--surface-muted) px-2 text-xs font-medium text-(--foreground)"
              >
                <Braces size={13} aria-hidden="true" />
                JSON
                <X size={12} aria-hidden="true" />
              </button>
            ) : null}

            {menuOpen ? (
              <>
                <button
                  type="button"
                  aria-hidden="true"
                  tabIndex={-1}
                  onClick={() => setMenuOpen(false)}
                  className="fixed inset-0 z-20 cursor-default"
                />
                <div
                  role="menu"
                  className="absolute bottom-full left-0 z-30 mb-2 w-56 rounded-xl border border-(--border) bg-(--surface-raised) p-1 text-sm shadow-[0_10px_30px_rgba(31,31,30,0.14)]"
                >
                  <button
                    type="button"
                    role="menuitem"
                    disabled={attachments.length >= MAX_ATTACHMENTS}
                    onClick={() => {
                      fileInputRef.current?.click();
                      setMenuOpen(false);
                    }}
                    className="flex h-9 w-full items-center gap-2 rounded-md px-2 text-left text-(--foreground) transition hover:bg-(--surface-muted) disabled:cursor-not-allowed disabled:opacity-45"
                  >
                    <Paperclip size={16} aria-hidden="true" />
                    Attach image or PDF
                  </button>
                  <button
                    type="button"
                    role="menuitemcheckbox"
                    aria-checked={jsonMode}
                    onClick={() => {
                      setJsonMode((current) => !current);
                      setMenuOpen(false);
                    }}
                    className="flex h-9 w-full items-center gap-2 rounded-md px-2 text-left text-(--foreground) transition hover:bg-(--surface-muted)"
                  >
                    <Braces size={16} aria-hidden="true" />
                    JSON mode
                    {jsonMode ? <Check size={15} className="ml-auto text-(--brand)" aria-hidden="true" /> : null}
                  </button>
                </div>
              </>
            ) : null}
          </div>

          <div className="flex min-w-0 items-center gap-1.5">
            {/* Inline model picker */}
            <div className="relative flex min-w-0 items-center">
              <button
                type="button"
                aria-haspopup="listbox"
                aria-expanded={modelPickerOpen}
                onClick={() => {
                  setModelPickerOpen((o) => !o);
                  setModelQuery("");
                }}
                className="inline-flex min-w-0 items-center gap-1 rounded-lg px-2 py-1.5 text-sm text-(--muted) transition hover:bg-(--surface-muted) hover:text-(--foreground)"
              >
                <span className="max-w-36 truncate">{formatModelLabel(model)}</span>
                <ChevronDown size={13} className="shrink-0 opacity-70" aria-hidden="true" />
              </button>

              {modelPickerOpen ? (
                <>
                  <button
                    type="button"
                    aria-hidden="true"
                    tabIndex={-1}
                    onClick={() => setModelPickerOpen(false)}
                    className="fixed inset-0 z-20 cursor-default"
                  />
                  <div
                    role="listbox"
                    aria-label="Select model"
                    className="absolute bottom-full right-0 z-30 mb-2 w-72 overflow-hidden rounded-xl border border-(--border) bg-(--surface-raised) shadow-[0_10px_30px_rgba(31,31,30,0.14)]"
                  >
                    <div className="border-b border-(--border) px-3 py-2">
                      <input
                        value={modelQuery}
                        onChange={(e) => setModelQuery(e.target.value)}
                        placeholder="Search models…"
                        autoFocus
                        spellCheck={false}
                        autoCapitalize="off"
                        autoCorrect="off"
                        className="w-full bg-transparent text-sm text-(--foreground) outline-none placeholder:text-(--muted)"
                      />
                    </div>
                    <div className="scroll-area max-h-64 overflow-y-auto">
                      {pickerLoading && pickerModels.length === 0 ? (
                        <p className="px-3 py-4 text-center text-xs text-(--muted)">Loading…</p>
                      ) : pickerModels.length === 0 ? (
                        <p className="px-3 py-4 text-center text-xs text-(--muted)">No models found.</p>
                      ) : (
                        pickerModels.map((m) => (
                          <button
                            key={m.id}
                            type="button"
                            role="option"
                            aria-selected={m.id === model}
                            onClick={() => {
                              onModelChange?.(m.id);
                              setModelPickerOpen(false);
                            }}
                            className={`flex w-full items-center justify-between gap-2 px-3 py-2.5 text-left text-sm transition hover:bg-(--surface-muted) ${m.id === model ? "bg-(--surface-muted) font-medium" : "text-(--foreground)"}`}
                          >
                            <span className="truncate">{m.name}</span>
                            {m.id === model ? (
                              <Check size={14} className="shrink-0 text-(--brand)" aria-hidden="true" />
                            ) : null}
                          </button>
                        ))
                      )}
                    </div>
                    <div className="border-t border-(--border) px-3 py-2">
                      <button
                        type="button"
                        onClick={() => {
                          setModelPickerOpen(false);
                          onOpenSettings();
                        }}
                        className="text-xs text-(--muted) transition hover:text-(--foreground)"
                      >
                        All models in Settings →
                      </button>
                    </div>
                  </div>
                </>
              ) : null}
            </div>

            <button
              type="button"
              title="Voice input"
              aria-label="Voice input"
              onClick={onVoice}
              className="grid h-9 w-9 place-items-center rounded-full text-(--muted) transition hover:bg-(--surface-muted)"
            >
              <Mic size={17} aria-hidden="true" />
            </button>
            {isStreaming ? (
              <button
                type="button"
                title="Stop generating"
                aria-label="Stop generating"
                onClick={onStop}
                className="grid h-9 w-9 place-items-center rounded-full bg-(--danger) text-white transition active:scale-95"
              >
                <Square size={15} fill="currentColor" aria-hidden="true" />
              </button>
            ) : (
              <button
                type="submit"
                title="Send"
                aria-label="Send"
                disabled={disabled || (!value.trim() && attachments.length === 0)}
                className="grid h-9 w-9 place-items-center rounded-full bg-(--foreground) text-(--background) transition active:scale-95 disabled:cursor-not-allowed disabled:opacity-30"
              >
                <Send size={16} aria-hidden="true" />
              </button>
            )}
          </div>
        </div>
      </div>

      {showDisclaimer ? (
        <p className="text-center text-xs text-(--muted)">
          AI can make mistakes. Please double-check important details.
        </p>
      ) : null}
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
