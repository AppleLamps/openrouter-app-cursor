"use client";

import { useEffect, useRef, useState } from "react";
import { Send, Square } from "lucide-react";

type ComposerProps = {
  isStreaming: boolean;
  disabled?: boolean;
  onSend: (message: string) => boolean;
  onStop: () => void;
};

export function Composer({ isStreaming, disabled = false, onSend, onStop }: ComposerProps) {
  const [value, setValue] = useState("");
  const textareaRef = useRef<HTMLTextAreaElement | null>(null);

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
    if (!next || disabled || isStreaming) {
      return;
    }

    if (onSend(next) !== false) {
      setValue("");
    }
  }

  return (
    <form
      className="composer-safe flex items-end gap-2"
      onSubmit={(event) => {
        event.preventDefault();
        submit();
      }}
    >
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
          disabled={disabled || !value.trim()}
          className="grid min-h-11 min-w-11 place-items-center rounded-full bg-[color:var(--accent-strong)] text-[color:var(--background)] transition active:scale-95 disabled:cursor-not-allowed disabled:bg-[color:var(--surface-muted)] disabled:text-[color:var(--muted)]"
        >
          <Send size={18} aria-hidden="true" />
        </button>
      )}
    </form>
  );
}
