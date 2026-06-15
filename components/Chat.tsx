"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Menu, Settings, Trash2 } from "lucide-react";
import { ChatSidebar } from "@/components/ChatSidebar";
import { Composer } from "@/components/Composer";
import { MessageBubble } from "@/components/MessageBubble";
import { SettingsModal } from "@/components/SettingsModal";
import {
  clearStoredSettings,
  loadActiveThreadId,
  loadSettings,
  loadThreads,
  saveActiveThreadId,
  saveSettings,
  saveThreads,
} from "@/lib/storage";
import {
  DEFAULT_SETTINGS,
  type ApiStatus,
  type ChatAttachment,
  type ChatGeneratedFile,
  type ChatMessage,
  type ChatMessageSource,
  type ChatSettings,
  type ChatThread,
} from "@/lib/types";

type ApiErrorResponse = {
  error?: {
    code?: string;
    message?: string;
  };
};

type KeyStatusResponse = {
  configured?: boolean;
  label?: string;
  limitRemaining?: number | null;
  error?: {
    code?: string;
    message?: string;
  };
};

type ChatStreamEvent =
  | { type: "text"; text?: string }
  | { type: "source"; source?: ChatMessageSource }
  | { type: "file"; file?: ChatGeneratedFile }
  | { type: "error"; error?: { message?: string } }
  | { type: "done" };

export function Chat() {
  const [hydrated, setHydrated] = useState(false);
  const [threads, setThreads] = useState<ChatThread[]>([]);
  const [activeThreadId, setActiveThreadId] = useState("");
  const [settings, setSettings] = useState<ChatSettings>(DEFAULT_SETTINGS);
  const [isStreaming, setIsStreaming] = useState(false);
  const [statusText, setStatusText] = useState("");
  const [apiStatus, setApiStatus] = useState<ApiStatus>("missing");
  const [apiStatusText, setApiStatusText] = useState("API key missing");
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const abortRef = useRef<AbortController | null>(null);
  const scrollRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    const loadedThreads = loadThreads();
    const initialThreads = loadedThreads.length > 0 ? loadedThreads : [createEmptyThread()];
    const savedActiveThreadId = loadActiveThreadId();
    const activeThread = initialThreads.find((thread) => thread.id === savedActiveThreadId) ?? initialThreads[0];

    setThreads(initialThreads);
    setActiveThreadId(activeThread.id);
    setSettings(loadSettings());
    setHydrated(true);
  }, []);

  useEffect(() => {
    if (hydrated) {
      saveThreads(threads);
    }
  }, [hydrated, threads]);

  useEffect(() => {
    if (hydrated && activeThreadId) {
      saveActiveThreadId(activeThreadId);
    }
  }, [activeThreadId, hydrated]);

  useEffect(() => {
    if (hydrated) {
      saveSettings(settings);
    }
  }, [hydrated, settings]);

  const activeThread = useMemo(
    () => threads.find((thread) => thread.id === activeThreadId) ?? null,
    [activeThreadId, threads],
  );

  const messages = activeThread?.messages ?? [];
  const visibleMessages = useMemo(
    () => messages.filter((message) => message.role !== "system"),
    [messages],
  );

  useEffect(() => {
    scrollRef.current?.scrollTo({
      top: scrollRef.current.scrollHeight,
      behavior: messages.length > 2 ? "smooth" : "auto",
    });
  }, [messages, isStreaming]);

  const refreshApiStatus = useCallback(
    async (apiKeyOverride?: string) => {
      const apiKey = (apiKeyOverride ?? settings.apiKey ?? "").trim();
      if (!apiKey) {
        setApiStatus("missing");
        setApiStatusText("API key missing");
        return;
      }

      setApiStatus("checking");
      setApiStatusText("Checking...");
      try {
        const response = await fetch("/api/key/status", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({ apiKey }),
        });
        const data = (await response.json()) as KeyStatusResponse;

        if (response.ok && data.configured) {
          setApiStatus("configured");
          setApiStatusText(data.limitRemaining === null || data.limitRemaining === undefined ? "API key valid" : `API key valid (${data.limitRemaining.toFixed(2)} credits left)`);
          return;
        }

        setApiStatus(data.error?.code === "invalid_api_key" || response.status === 401 ? "invalid" : "unknown");
        setApiStatusText(data.error?.message ?? "API key status unavailable");
      } catch {
        setApiStatus("unknown");
        setApiStatusText("API key status unavailable");
      }
    },
    [settings.apiKey],
  );

  useEffect(() => {
    if (hydrated) {
      void refreshApiStatus();
    }
  }, [hydrated, refreshApiStatus]);

  const updateThread = useCallback((threadId: string, updater: (thread: ChatThread) => ChatThread) => {
    setThreads((current) => current.map((thread) => (thread.id === threadId ? updater(thread) : thread)));
  }, []);

  const updateAssistantMessage = useCallback(
    (threadId: string, messageId: string, content: string) => {
      updateThread(threadId, (thread) => ({
        ...thread,
        messages: thread.messages.map((message) =>
          message.id === messageId ? { ...message, content } : message,
        ),
        updatedAt: new Date().toISOString(),
      }));
    },
    [updateThread],
  );

  const addAssistantSource = useCallback(
    (threadId: string, messageId: string, source: ChatMessageSource) => {
      updateThread(threadId, (thread) => ({
        ...thread,
        messages: thread.messages.map((message) => {
          if (message.id !== messageId) {
            return message;
          }

          const currentSources = message.sources ?? [];
          if (currentSources.some((current) => current.url === source.url)) {
            return message;
          }

          return {
            ...message,
            sources: [...currentSources, source],
          };
        }),
        updatedAt: new Date().toISOString(),
      }));
    },
    [updateThread],
  );

  const addAssistantFile = useCallback(
    (threadId: string, messageId: string, file: ChatGeneratedFile) => {
      updateThread(threadId, (thread) => ({
        ...thread,
        messages: thread.messages.map((message) => {
          if (message.id !== messageId) {
            return message;
          }

          const currentFiles = message.files ?? [];
          if (currentFiles.some((current) => current.dataUrl === file.dataUrl)) {
            return message;
          }

          return {
            ...message,
            files: [...currentFiles, file],
          };
        }),
        updatedAt: new Date().toISOString(),
      }));
    },
    [updateThread],
  );

  const sendMessage = useCallback(
    (rawContent: string, attachments: ChatAttachment[] = []) => {
      const content = rawContent.trim();
      if (!content && attachments.length === 0) {
        setStatusText("Enter a message or attach a file before sending.");
        return false;
      }
      if (isStreaming || !activeThread) {
        return false;
      }

      const apiKey = settings.apiKey?.trim();
      if (!apiKey) {
        setStatusText("Add an OpenRouter API key in Settings before sending.");
        setIsSettingsOpen(true);
        return false;
      }

      const threadId = activeThread.id;
      const userMessage: ChatMessage = {
        id: createId(),
        role: "user",
        content,
        attachments,
        createdAt: new Date().toISOString(),
      };
      const assistantMessage: ChatMessage = {
        id: createId(),
        role: "assistant",
        content: "",
        createdAt: new Date().toISOString(),
      };
      const requestMessages = [...activeThread.messages, userMessage].filter(
        (message) => message.role === "user" || message.role === "assistant",
      );
      const nextTitle = activeThread.messages.some((message) => message.role === "user")
        ? activeThread.title
        : createTitleFromMessage(content);
      const now = new Date().toISOString();

      setStatusText("");
      setIsStreaming(true);
      updateThread(threadId, (thread) => ({
        ...thread,
        title: nextTitle,
        messages: [...requestMessages, assistantMessage],
        updatedAt: now,
      }));

      const controller = new AbortController();
      abortRef.current = controller;
      let streamedContent = "";

      void (async () => {
        try {
          const response = await fetch("/api/chat", {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
            },
            body: JSON.stringify({
              apiKey,
              messages: requestMessages,
              model: settings.model,
              systemPrompt: settings.systemPrompt,
              temperature: settings.temperature,
              serverTools: settings.serverTools,
              multimodal: settings.multimodal,
              messageTransforms: settings.messageTransforms,
              responseCaching: settings.responseCaching,
            }),
            signal: controller.signal,
          });

          if (!response.ok) {
            const message = await readErrorMessage(response);
            updateAssistantMessage(threadId, assistantMessage.id, message);
            setStatusText(message);
            return;
          }

          if (!response.body) {
            const message = "The server did not return a stream.";
            updateAssistantMessage(threadId, assistantMessage.id, message);
            setStatusText(message);
            return;
          }

          const reader = response.body.getReader();
          const decoder = new TextDecoder();
          let buffer = "";

          for (;;) {
            const { done, value } = await reader.read();
            if (done) {
              break;
            }
            buffer += decoder.decode(value, { stream: true });
            buffer = processStreamEvents(buffer, {
              onText: (text) => {
                streamedContent += text;
                updateAssistantMessage(threadId, assistantMessage.id, streamedContent);
              },
              onSource: (source) => addAssistantSource(threadId, assistantMessage.id, source),
              onFile: (file) => addAssistantFile(threadId, assistantMessage.id, file),
              onError: (message) => {
                streamedContent = message;
                updateAssistantMessage(threadId, assistantMessage.id, message);
                setStatusText(message);
              },
            });
          }

          buffer += decoder.decode();
          processStreamEvents(`${buffer}\n`, {
            onText: (text) => {
              streamedContent += text;
              updateAssistantMessage(threadId, assistantMessage.id, streamedContent);
            },
            onSource: (source) => addAssistantSource(threadId, assistantMessage.id, source),
            onFile: (file) => addAssistantFile(threadId, assistantMessage.id, file),
            onError: (message) => {
              streamedContent = message;
              updateAssistantMessage(threadId, assistantMessage.id, message);
              setStatusText(message);
            },
          });
          updateAssistantMessage(
            threadId,
            assistantMessage.id,
            streamedContent.trim() ? streamedContent : "No response.",
          );
        } catch (error) {
          if (controller.signal.aborted) {
            updateAssistantMessage(
              threadId,
              assistantMessage.id,
              streamedContent.trim() ? streamedContent : "Generation stopped.",
            );
            setStatusText("Generation stopped.");
            return;
          }

          const message =
            error instanceof TypeError
              ? "Network failure. Check your connection and try again."
              : "The response stream was interrupted. Try again.";
          updateAssistantMessage(threadId, assistantMessage.id, message);
          setStatusText(message);
        } finally {
          abortRef.current = null;
          setIsStreaming(false);
        }
      })();

      return true;
    },
    [activeThread, addAssistantFile, addAssistantSource, isStreaming, settings, updateAssistantMessage, updateThread],
  );

  const stopStreaming = useCallback(() => {
    abortRef.current?.abort();
  }, []);

  const createThread = useCallback(() => {
    abortRef.current?.abort();
    const thread = createEmptyThread();
    setThreads((current) => [thread, ...current]);
    setActiveThreadId(thread.id);
    setStatusText("");
    setSidebarOpen(false);
  }, []);

  const selectThread = useCallback((threadId: string) => {
    abortRef.current?.abort();
    setActiveThreadId(threadId);
    setStatusText("");
    setSidebarOpen(false);
  }, []);

  const renameThread = useCallback(
    (threadId: string, title: string) => {
      updateThread(threadId, (thread) => ({
        ...thread,
        title: title.trim() || thread.title,
        updatedAt: new Date().toISOString(),
      }));
    },
    [updateThread],
  );

  const deleteThread = useCallback(
    (threadId: string) => {
      abortRef.current?.abort();
      setThreads((current) => {
        const remaining = current.filter((thread) => thread.id !== threadId);
        if (remaining.length === 0) {
          const replacement = createEmptyThread();
          setActiveThreadId(replacement.id);
          return [replacement];
        }

        if (threadId === activeThreadId) {
          const nextActive = [...remaining].sort((a, b) => Date.parse(b.updatedAt) - Date.parse(a.updatedAt))[0];
          setActiveThreadId(nextActive.id);
        }

        return remaining;
      });
      setStatusText("");
    },
    [activeThreadId],
  );

  const clearActiveChat = useCallback(() => {
    abortRef.current?.abort();
    if (!activeThread) {
      return;
    }

    updateThread(activeThread.id, (thread) => ({
      ...thread,
      title: "New chat",
      messages: [],
      updatedAt: new Date().toISOString(),
    }));
    setStatusText("");
  }, [activeThread, updateThread]);

  const resetSettings = useCallback(() => {
    setSettings(DEFAULT_SETTINGS);
    clearStoredSettings();
    setApiStatus("missing");
    setApiStatusText("API key missing");
  }, []);

  return (
    <main className="app-shell flex overflow-hidden">
      <ChatSidebar
        threads={threads}
        activeThreadId={activeThreadId}
        collapsed={sidebarCollapsed}
        mobileOpen={sidebarOpen}
        onToggleCollapsed={() => setSidebarCollapsed((current) => !current)}
        onCloseMobile={() => setSidebarOpen(false)}
        onNewThread={createThread}
        onSelectThread={selectThread}
        onRenameThread={renameThread}
        onDeleteThread={deleteThread}
      />

      <section className="flex min-w-0 flex-1 flex-col overflow-hidden">
        <header className="flex shrink-0 items-center justify-between gap-3 border-b border-[color:var(--border)] pb-3 lg:pl-3">
          <div className="flex min-w-0 items-center gap-2">
            <button
              type="button"
              title="Open sidebar"
              aria-label="Open sidebar"
              onClick={() => setSidebarOpen(true)}
              className="grid min-h-11 min-w-11 shrink-0 place-items-center rounded-full border border-[color:var(--border)] bg-[color:var(--surface)] text-[color:var(--muted)] transition active:scale-95 lg:hidden"
            >
              <Menu size={18} aria-hidden="true" />
            </button>
            <div className="min-w-0">
              <h1 className="truncate text-[1.05rem] font-semibold leading-tight text-[color:var(--foreground)]">
                {activeThread?.title || "OpenRouter Chat"}
              </h1>
              <p className="truncate text-xs text-[color:var(--muted)]">{settings.model}</p>
            </div>
          </div>
          <div className="flex shrink-0 items-center gap-2">
            <button
              type="button"
              title="Clear chat"
              aria-label="Clear chat"
              onClick={clearActiveChat}
              className="grid min-h-11 min-w-11 place-items-center rounded-full border border-[color:var(--border)] bg-[color:var(--surface)] text-[color:var(--muted)] transition active:scale-95"
            >
              <Trash2 size={18} aria-hidden="true" />
            </button>
            <button
              type="button"
              title="Settings"
              aria-label="Settings"
              onClick={() => setIsSettingsOpen(true)}
              className="grid min-h-11 min-w-11 place-items-center rounded-full bg-[color:var(--foreground)] text-[color:var(--background)] transition active:scale-95"
            >
              <Settings size={18} aria-hidden="true" />
            </button>
          </div>
        </header>

        <section
          ref={scrollRef}
          className="scroll-area min-h-0 flex-1 overflow-y-auto px-0 py-4 lg:pl-3"
          aria-label="Chat messages"
        >
          {!hydrated ? (
            <div className="flex min-h-full items-center justify-center px-6 text-center text-sm text-[color:var(--muted)]">
              Loading chat...
            </div>
          ) : visibleMessages.length === 0 ? (
            <div className="flex min-h-full items-center justify-center px-7 text-center">
              <div>
                <div className="mx-auto mb-4 grid h-14 w-14 place-items-center rounded-2xl bg-[color:var(--surface-raised)] text-2xl">
                  OR
                </div>
                <p className="text-base font-medium text-[color:var(--foreground)]">Start a conversation.</p>
                <p className="mt-2 text-sm leading-6 text-[color:var(--muted)]">
                  Messages stay on this device until you clear them.
                </p>
              </div>
            </div>
          ) : (
            <div className="space-y-4">
              {visibleMessages.map((message) => (
                <MessageBubble
                  key={message.id}
                  message={message}
                  isStreaming={isStreaming && message.id === visibleMessages.at(-1)?.id}
                />
              ))}
            </div>
          )}
        </section>

        <div className="-mx-[max(0.75rem,env(safe-area-inset-left))] shrink-0 border-t border-[color:var(--border)] bg-[color:var(--background)]/95 pt-3 backdrop-blur lg:ml-0">
          {statusText ? (
            <p className="composer-safe pb-2 text-xs text-[color:var(--muted)]" role="status">
              {statusText}
            </p>
          ) : null}
          <Composer onSend={sendMessage} onStop={stopStreaming} isStreaming={isStreaming} disabled={!hydrated} />
        </div>
      </section>

      <SettingsModal
        open={isSettingsOpen}
        settings={settings}
        apiStatus={apiStatus}
        apiStatusText={apiStatusText}
        onClose={() => setIsSettingsOpen(false)}
        onValidateApiKey={refreshApiStatus}
        onSettingsChange={setSettings}
        onClearChat={clearActiveChat}
        onResetSettings={resetSettings}
      />
    </main>
  );
}

function createId() {
  if (typeof crypto !== "undefined" && "randomUUID" in crypto) {
    return crypto.randomUUID();
  }

  return `${Date.now()}-${Math.random().toString(36).slice(2)}`;
}

function createEmptyThread(): ChatThread {
  const now = new Date().toISOString();
  return {
    id: createId(),
    title: "New chat",
    messages: [],
    createdAt: now,
    updatedAt: now,
  };
}

function createTitleFromMessage(content: string) {
  const compact = content.replace(/\s+/g, " ").trim();
  return compact.length > 42 ? `${compact.slice(0, 39).trim()}...` : compact || "New chat";
}

async function readErrorMessage(response: Response) {
  try {
    const data = (await response.json()) as ApiErrorResponse;
    if (data.error?.message) {
      return data.error.message;
    }
  } catch {
    // Fall back to status text below.
  }

  if (response.status === 429) {
    return "OpenRouter rate limit reached. Try again shortly.";
  }

  return response.statusText || "Request failed. Try again.";
}

function processStreamEvents(
  buffer: string,
  handlers: {
    onText: (text: string) => void;
    onSource: (source: ChatMessageSource) => void;
    onFile: (file: ChatGeneratedFile) => void;
    onError: (message: string) => void;
  },
) {
  const lines = buffer.split("\n");
  const remainder = lines.pop() ?? "";

  for (const line of lines) {
    if (!line.trim()) {
      continue;
    }

    try {
      const event = JSON.parse(line) as ChatStreamEvent;
      if (event.type === "text" && typeof event.text === "string") {
        handlers.onText(event.text);
      }
      if (event.type === "source" && isMessageSource(event.source)) {
        handlers.onSource(event.source);
      }
      if (event.type === "file" && isGeneratedFile(event.file)) {
        handlers.onFile(event.file);
      }
      if (event.type === "error" && typeof event.error?.message === "string") {
        handlers.onError(event.error.message);
      }
    } catch {
      handlers.onText(line);
    }
  }

  return remainder;
}

function isGeneratedFile(value: unknown): value is ChatGeneratedFile {
  if (!value || typeof value !== "object") {
    return false;
  }

  const file = value as Partial<ChatGeneratedFile>;
  return (
    typeof file.id === "string" &&
    typeof file.mediaType === "string" &&
    typeof file.dataUrl === "string" &&
    file.dataUrl.startsWith("data:") &&
    (file.name === undefined || typeof file.name === "string")
  );
}

function isMessageSource(value: unknown): value is ChatMessageSource {
  if (!value || typeof value !== "object") {
    return false;
  }

  const source = value as Partial<ChatMessageSource>;
  return (
    typeof source.id === "string" &&
    typeof source.url === "string" &&
    (source.title === undefined || typeof source.title === "string")
  );
}
