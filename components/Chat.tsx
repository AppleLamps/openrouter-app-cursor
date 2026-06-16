"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Menu, MoreHorizontal, Share2 } from "lucide-react";
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
  const [noticeText, setNoticeText] = useState("");
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

  const toggleThreadStarred = useCallback(
    (threadId: string) => {
      updateThread(threadId, (thread) => ({
        ...thread,
        starred: !thread.starred,
        updatedAt: new Date().toISOString(),
      }));
    },
    [updateThread],
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

  const showComingSoon = useCallback((label: string) => {
    setNoticeText(`${label} is coming soon.`);
    window.setTimeout(() => setNoticeText(""), 1800);
  }, []);

  const renameActiveThread = useCallback(() => {
    if (!activeThread) {
      return;
    }

    const title = window.prompt("Rename chat", activeThread.title);
    if (title !== null) {
      renameThread(activeThread.id, title);
    }
  }, [activeThread, renameThread]);

  const retryAssistantMessage = useCallback(
    (assistantMessageId: string) => {
      if (!activeThread || isStreaming) {
        return;
      }

      const assistantIndex = activeThread.messages.findIndex((message) => message.id === assistantMessageId);
      const previousUserMessage = [...activeThread.messages]
        .slice(0, assistantIndex)
        .reverse()
        .find((message) => message.role === "user");

      if (!previousUserMessage) {
        setStatusText("No previous user message to retry.");
        return;
      }

      sendMessage(previousUserMessage.content, previousUserMessage.attachments ?? []);
    },
    [activeThread, isStreaming, sendMessage],
  );

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
        onToggleStarred={toggleThreadStarred}
        onComingSoon={showComingSoon}
      />

      <section className="flex min-w-0 flex-1 flex-col overflow-hidden bg-[color:var(--background)]">
        <header className="flex h-12 shrink-0 items-center justify-between gap-3 border-b border-[color:var(--border)] px-3 md:px-5">
          <div className="flex min-w-0 items-center gap-1.5">
            <button
              type="button"
              title="Open sidebar"
              aria-label="Open sidebar"
              onClick={() => setSidebarOpen(true)}
              className="grid h-9 w-9 shrink-0 place-items-center rounded-lg text-[color:var(--muted)] hover:bg-[color:var(--surface-muted)] lg:hidden"
            >
              <Menu size={17} aria-hidden="true" />
            </button>
            <button
              type="button"
              onClick={renameActiveThread}
              className="min-w-0 truncate rounded-lg px-2 py-1 text-left text-sm font-semibold text-[color:var(--foreground)] hover:bg-[color:var(--surface-muted)]"
            >
              {activeThread?.title || "New chat"}
            </button>
            <button
              type="button"
              title="More options"
              aria-label="More options"
              onClick={clearActiveChat}
              className="grid h-8 w-8 shrink-0 place-items-center rounded-lg text-[color:var(--muted)] hover:bg-[color:var(--surface-muted)]"
            >
              <MoreHorizontal size={17} aria-hidden="true" />
            </button>
          </div>
          <div className="flex shrink-0 items-center gap-2">
            <button
              type="button"
              onClick={() => showComingSoon("Share")}
              className="inline-flex h-8 items-center gap-1.5 rounded-full border border-[color:var(--border)] bg-[color:var(--surface)] px-3 text-sm font-medium text-[color:var(--foreground)] hover:bg-[color:var(--surface-muted)]"
            >
              <Share2 size={14} aria-hidden="true" />
              Share
            </button>
          </div>
        </header>

        <section
          ref={scrollRef}
          className="scroll-area min-h-0 flex-1 overflow-y-auto px-4 py-6 md:px-8"
          aria-label="Chat messages"
        >
          {!hydrated ? (
            <div className="flex min-h-full items-center justify-center px-6 text-center text-sm text-[color:var(--muted)]">
              Loading chat...
            </div>
          ) : visibleMessages.length === 0 ? (
            <div className="flex min-h-full items-center justify-center px-2 pb-20 text-center">
              <div className="w-full max-w-3xl">
                <div className="mb-8 flex items-center justify-center gap-3">
                  <span className="brand-burst text-4xl text-[color:var(--brand)]" aria-hidden="true">
                    *
                  </span>
                  <h1 className="font-serif text-4xl leading-tight text-[color:var(--foreground)] md:text-5xl">
                    Lamps returns!
                  </h1>
                </div>
                <p className="mx-auto max-w-md text-sm text-[color:var(--muted)]">
                  Draft an email, plan a project, summarize a document, or keep a thought moving.
                </p>
              </div>
            </div>
          ) : (
            <div className="mx-auto w-full max-w-3xl space-y-10">
              {visibleMessages.map((message, index) => (
                <MessageBubble
                  key={message.id}
                  message={message}
                  isStreaming={isStreaming && message.id === visibleMessages.at(-1)?.id}
                  onRetry={message.role === "assistant" ? () => retryAssistantMessage(message.id) : undefined}
                  showThinking={message.role === "assistant" && index === visibleMessages.length - 1 && isStreaming}
                />
              ))}
            </div>
          )}
        </section>

        <div className="shrink-0 bg-gradient-to-t from-[color:var(--background)] via-[color:var(--background)] to-transparent px-4 pb-3 md:px-8">
          {statusText ? (
            <p className="mx-auto max-w-3xl pb-2 text-xs text-[color:var(--muted)]" role="status">
              {statusText}
            </p>
          ) : null}
          <Composer
            onSend={sendMessage}
            onStop={stopStreaming}
            isStreaming={isStreaming}
            disabled={!hydrated}
            model={settings.model}
            onOpenSettings={() => setIsSettingsOpen(true)}
            onVoice={() => showComingSoon("Voice input")}
          />
        </div>
      </section>

      {noticeText ? (
        <div className="fixed bottom-5 left-1/2 z-[80] -translate-x-1/2 rounded-full border border-[color:var(--border)] bg-[color:var(--foreground)] px-4 py-2 text-sm text-[color:var(--background)] shadow-[0_10px_30px_rgba(80,67,52,0.16)]">
          {noticeText}
        </div>
      ) : null}

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
    starred: false,
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
