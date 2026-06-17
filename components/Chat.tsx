"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { ComponentType } from "react";
import { FileText, FolderKanban, Lightbulb, Mail, Menu, MoreHorizontal, Share2 } from "lucide-react";
import { ChatSidebar } from "@/components/ChatSidebar";
import { Composer } from "@/components/Composer";
import { MessageBubble } from "@/components/MessageBubble";
import { SettingsModal } from "@/components/SettingsModal";
import {
  DEFAULT_SETTINGS,
  type ApiStatus,
  type ChatAttachment,
  type ChatGeneratedFile,
  type ChatMessage,
  type ChatMessageSource,
  type ChatMessageUsage,
  type ChatSettings,
  type ChatThread,
} from "@/lib/types";
import {
  clearStoredSettings,
  loadActiveThreadId,
  loadSettings,
  loadSidebarCollapsed,
  loadThreads,
  saveActiveThreadId,
  saveSettings,
  saveSidebarCollapsed,
  saveThreads,
} from "@/lib/storage";
import { createId } from "@/lib/utils";
import { exportThreadMarkdown, exportThreadsJson, parseThreadsJson } from "@/lib/io";
import {
  isChatGeneratedFile as isGeneratedFile,
  isChatMessageSource as isMessageSource,
  isChatMessageUsage as isMessageUsage,
  isChatThreadArray,
} from "@/lib/validation";

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
  | { type: "reasoning"; text?: string }
  | { type: "source"; source?: ChatMessageSource }
  | { type: "file"; file?: ChatGeneratedFile }
  | { type: "usage"; usage?: ChatMessageUsage }
  | { type: "error"; error?: { message?: string } }
  | { type: "done" };

type StreamingDraft = {
  threadId: string;
  messageId: string;
  content: string;
  reasoning: string;
};

const THREADS_SAVE_DEBOUNCE_MS = 750;

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
  const [importNotice, setImportNotice] = useState("");
  const [streamingDraft, setStreamingDraft] = useState<StreamingDraft | null>(null);
  const [composerSeed, setComposerSeed] = useState<{ id: string; text: string } | null>(null);
  const abortRef = useRef<AbortController | null>(null);
  const scrollRef = useRef<HTMLDivElement | null>(null);
  const isStreamingRef = useRef(false);
  const streamingDraftRef = useRef<StreamingDraft | null>(null);
  const streamingFrameRef = useRef<number | null>(null);
  const threadsRef = useRef<ChatThread[]>([]);
  const autoTitleTimeoutRef = useRef<number | null>(null);
  const scheduleAutoTitleRef = useRef<(threadId: string) => void>(() => { });

  const setStreamingActive = useCallback((active: boolean) => {
    isStreamingRef.current = active;
    setIsStreaming(active);
  }, []);

  useEffect(() => {
    const loadedThreads = loadThreads();
    const initialThreads = loadedThreads.length > 0 ? loadedThreads : [createEmptyThread()];
    const savedActiveThreadId = loadActiveThreadId();
    const activeThread = initialThreads.find((thread) => thread.id === savedActiveThreadId) ?? initialThreads[0];

    setThreads(initialThreads);
    setActiveThreadId(activeThread.id);
    setSettings(loadSettings());
    setSidebarCollapsed(loadSidebarCollapsed());
    setHydrated(true);
  }, []);

  useEffect(() => {
    if (!hydrated) {
      return;
    }

    const timeout = window.setTimeout(() => {
      saveThreads(threads);
    }, THREADS_SAVE_DEBOUNCE_MS);

    return () => {
      window.clearTimeout(timeout);
    };
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

  useEffect(() => {
    if (hydrated) {
      saveSidebarCollapsed(sidebarCollapsed);
    }
  }, [hydrated, sidebarCollapsed]);

  const activeThread = useMemo(
    () => threads.find((thread) => thread.id === activeThreadId) ?? null,
    [activeThreadId, threads],
  );

  threadsRef.current = threads;

  useEffect(() => {
    return () => {
      if (autoTitleTimeoutRef.current) {
        window.clearTimeout(autoTitleTimeoutRef.current);
      }
    };
  }, []);

  const messages = activeThread?.messages ?? [];
  const visibleMessages = useMemo(
    () => messages.filter((message) => message.role !== "system"),
    [messages],
  );

  useEffect(() => {
    scrollRef.current?.scrollTo({
      top: scrollRef.current.scrollHeight,
      behavior: visibleMessages.length > 2 ? "smooth" : "auto",
    });
  }, [visibleMessages.length, isStreaming, streamingDraft?.content]);

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

  const clearStreamingDraft = useCallback(() => {
    if (streamingFrameRef.current !== null) {
      cancelAnimationFrame(streamingFrameRef.current);
      streamingFrameRef.current = null;
    }

    streamingDraftRef.current = null;
    setStreamingDraft(null);
  }, []);

  const scheduleStreamingDraft = useCallback((threadId: string, messageId: string, content: string, reasoning: string) => {
    streamingDraftRef.current = { threadId, messageId, content, reasoning };

    if (streamingFrameRef.current !== null) {
      return;
    }

    streamingFrameRef.current = requestAnimationFrame(() => {
      streamingFrameRef.current = null;
      const draft = streamingDraftRef.current;
      if (draft) {
        setStreamingDraft(draft);
      }
    });
  }, []);

  const updateAssistantMessage = useCallback(
    (threadId: string, messageId: string, content: string, reasoning?: string, usage?: ChatMessageUsage) => {
      updateThread(threadId, (thread) => ({
        ...thread,
        messages: thread.messages.map((message) =>
          message.id === messageId
            ? {
                ...message,
                content,
                reasoning: reasoning ?? message.reasoning,
                usage: usage ?? message.usage,
              }
            : message,
        ),
        updatedAt: new Date().toISOString(),
      }));
    },
    [updateThread],
  );

  const commitAssistantMessage = useCallback(
    (threadId: string, messageId: string, content: string, reasoning?: string, usage?: ChatMessageUsage) => {
      clearStreamingDraft();
      updateAssistantMessage(threadId, messageId, content, reasoning, usage);
    },
    [clearStreamingDraft, updateAssistantMessage],
  );

  const setAssistantUsage = useCallback(
    (threadId: string, messageId: string, usage: ChatMessageUsage) => {
      updateThread(threadId, (thread) => ({
        ...thread,
        messages: thread.messages.map((message) =>
          message.id === messageId ? { ...message, usage } : message,
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

  const startAssistantRequest = useCallback(
    ({
      threadId,
      title,
      requestMessages,
      jsonMode = false,
    }: {
      threadId: string;
      title: string;
      requestMessages: ChatMessage[];
      jsonMode?: boolean;
    }) => {
      if (isStreamingRef.current) {
        return false;
      }

      const apiKey = settings.apiKey?.trim();
      if (!apiKey) {
        setStatusText("Add an OpenRouter API key in Settings before sending.");
        setIsSettingsOpen(true);
        return false;
      }

      const assistantMessage: ChatMessage = {
        id: createId(),
        role: "assistant",
        content: "",
        createdAt: new Date().toISOString(),
      };
      const now = new Date().toISOString();

      setStatusText("");
      setStreamingActive(true);
      updateThread(threadId, (thread) => ({
        ...thread,
        title,
        messages: [...requestMessages, assistantMessage],
        updatedAt: now,
      }));

      const controller = new AbortController();
      abortRef.current = controller;
      let streamedContent = "";
      let streamedReasoning = "";
      let streamedUsage: ChatMessageUsage | undefined;
      let completedSuccessfully = false;

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
              reasoning: settings.reasoning,
              providerRouting: settings.providerRouting,
              sessionId: threadId,
              jsonMode,
            }),
            signal: controller.signal,
          });

          if (!response.ok) {
            const message = await readErrorMessage(response);
            commitAssistantMessage(threadId, assistantMessage.id, message);
            setStatusText(message);
            return;
          }

          if (!response.body) {
            const message = "The server did not return a stream.";
            commitAssistantMessage(threadId, assistantMessage.id, message);
            setStatusText(message);
            return;
          }

          const reader = response.body.getReader();
          const decoder = new TextDecoder();
          let buffer = "";

          const streamHandlers = {
            onText: (text: string) => {
              streamedContent += text;
              scheduleStreamingDraft(threadId, assistantMessage.id, streamedContent, streamedReasoning);
            },
            onReasoning: (text: string) => {
              streamedReasoning += text;
              scheduleStreamingDraft(threadId, assistantMessage.id, streamedContent, streamedReasoning);
            },
            onSource: (source: ChatMessageSource) => addAssistantSource(threadId, assistantMessage.id, source),
            onFile: (file: ChatGeneratedFile) => addAssistantFile(threadId, assistantMessage.id, file),
            onUsage: (usage: ChatMessageUsage) => {
              streamedUsage = usage;
              setAssistantUsage(threadId, assistantMessage.id, usage);
            },
            onError: (message: string) => {
              streamedContent = message;
              commitAssistantMessage(threadId, assistantMessage.id, message);
              setStatusText(message);
            },
          };

          for (; ;) {
            const { done, value } = await reader.read();
            if (done) {
              break;
            }
            buffer += decoder.decode(value, { stream: true });
            buffer = processStreamEvents(buffer, streamHandlers);
          }

          buffer += decoder.decode();
          processStreamEvents(`${buffer}\n`, streamHandlers);
          commitAssistantMessage(
            threadId,
            assistantMessage.id,
            streamedContent.trim() ? streamedContent : "No response.",
            streamedReasoning.trim() ? streamedReasoning : undefined,
            streamedUsage,
          );
          completedSuccessfully = true;
        } catch (error) {
          if (controller.signal.aborted) {
            commitAssistantMessage(
              threadId,
              assistantMessage.id,
              streamedContent.trim() ? streamedContent : "Generation stopped.",
              streamedReasoning.trim() ? streamedReasoning : undefined,
            );
            setStatusText("Generation stopped.");
            return;
          }

          const message =
            error instanceof TypeError
              ? "Network failure. Check your connection and try again."
              : "The response stream was interrupted. Try again.";
          commitAssistantMessage(threadId, assistantMessage.id, message);
          setStatusText(message);
        } finally {
          abortRef.current = null;
          setStreamingActive(false);
          if (completedSuccessfully) {
            scheduleAutoTitleRef.current(threadId);
          }
        }
      })();

      return true;
    },
    [
      addAssistantFile,
      addAssistantSource,
      commitAssistantMessage,
      scheduleStreamingDraft,
      setAssistantUsage,
      setStreamingActive,
      settings,
      updateThread,
    ],
  );

  const sendMessage = useCallback(
    (rawContent: string, attachments: ChatAttachment[] = [], options?: { jsonMode?: boolean }) => {
      const content = rawContent.trim();
      if (!content && attachments.length === 0) {
        setStatusText("Enter a message or attach a file before sending.");
        return false;
      }
      if (!activeThread) {
        return false;
      }

      const userMessage: ChatMessage = {
        id: createId(),
        role: "user",
        content,
        attachments,
        createdAt: new Date().toISOString(),
      };
      const requestMessages = [...activeThread.messages, userMessage].filter(
        (message) => message.role === "user" || message.role === "assistant",
      );
      const nextTitle = activeThread.messages.some((message) => message.role === "user")
        ? activeThread.title
        : "New chat";

      return startAssistantRequest({
        threadId: activeThread.id,
        title: nextTitle,
        requestMessages,
        jsonMode: options?.jsonMode,
      });
    },
    [activeThread, startAssistantRequest],
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
    setComposerSeed(null);
  }, []);

  const selectThread = useCallback((threadId: string) => {
    abortRef.current?.abort();
    setActiveThreadId(threadId);
    setStatusText("");
    setSidebarOpen(false);
    setComposerSeed(null);
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

  const seedComposer = useCallback((text: string) => {
    setComposerSeed({ id: createId(), text });
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
      if (!activeThread || isStreamingRef.current) {
        return;
      }

      const assistantIndex = activeThread.messages.findIndex((message) => message.id === assistantMessageId);
      if (assistantIndex < 0) {
        setStatusText("Could not find that response to retry.");
        return;
      }

      const requestMessages = activeThread.messages
        .slice(0, assistantIndex)
        .filter((message) => message.role === "user" || message.role === "assistant");
      const previousUserMessage = [...requestMessages]
        .reverse()
        .find((message) => message.role === "user");

      if (!previousUserMessage) {
        setStatusText("No previous user message to retry.");
        return;
      }

      const trailingMessageCount = activeThread.messages.length - assistantIndex - 1;
      if (trailingMessageCount > 0) {
        const confirmed = window.confirm(
          `Retrying will remove ${trailingMessageCount} later message${trailingMessageCount === 1 ? "" : "s"} from this chat. Continue?`,
        );
        if (!confirmed) {
          return;
        }
      }

      abortRef.current?.abort();
      startAssistantRequest({
        threadId: activeThread.id,
        title: activeThread.title,
        requestMessages,
      });
    },
    [activeThread, startAssistantRequest],
  );

  const editUserMessage = useCallback(
    (messageId: string, newContent: string) => {
      if (!activeThread || isStreamingRef.current) {
        return;
      }

      const content = newContent.trim();
      const messageIndex = activeThread.messages.findIndex((message) => message.id === messageId);
      if (messageIndex < 0) {
        setStatusText("Could not find that message to edit.");
        return;
      }

      const original = activeThread.messages[messageIndex];
      if (original.role !== "user") {
        return;
      }

      if (!content && (original.attachments?.length ?? 0) === 0) {
        setStatusText("Enter a message before saving.");
        return;
      }

      abortRef.current?.abort();
      const editedMessage: ChatMessage = {
        ...original,
        content,
      };
      const requestMessages = activeThread.messages
        .slice(0, messageIndex + 1)
        .map((message, index) => (index === messageIndex ? editedMessage : message))
        .filter((message) => message.role === "user" || message.role === "assistant");

      startAssistantRequest({
        threadId: activeThread.id,
        title: activeThread.title,
        requestMessages,
      });
    },
    [activeThread, startAssistantRequest],
  );

  const forkFromMessage = useCallback(
    (messageId: string) => {
      if (!activeThread) {
        return;
      }

      const messageIndex = activeThread.messages.findIndex((message) => message.id === messageId);
      if (messageIndex < 0) {
        setStatusText("Could not find that message to fork.");
        return;
      }

      const now = new Date().toISOString();
      const forkedThread: ChatThread = {
        id: createId(),
        title: createForkTitle(activeThread.title),
        messages: activeThread.messages.slice(0, messageIndex + 1),
        createdAt: now,
        updatedAt: now,
        starred: false,
      };

      setThreads((current) => [forkedThread, ...current]);
      setActiveThreadId(forkedThread.id);
      setSidebarOpen(false);
      setStatusText("");
    },
    [activeThread],
  );

  const scheduleAutoTitle = useCallback(
    (threadId: string) => {
      if (autoTitleTimeoutRef.current) {
        window.clearTimeout(autoTitleTimeoutRef.current);
      }

      autoTitleTimeoutRef.current = window.setTimeout(() => {
        autoTitleTimeoutRef.current = null;
        void (async () => {
          const thread = threadsRef.current.find((item) => item.id === threadId);
          if (!thread || !shouldAutoTitle(thread)) {
            return;
          }

          const apiKey = settings.apiKey?.trim();
          if (!apiKey) {
            return;
          }

          const userMessages = thread.messages.filter((message) => message.role === "user");
          const assistantMessages = thread.messages.filter((message) => message.role === "assistant");
          const firstUser = userMessages[0];
          const firstAssistant = assistantMessages[0];
          if (!firstUser || !firstAssistant) {
            return;
          }

          try {
            const response = await fetch("/api/title", {
              method: "POST",
              headers: {
                "Content-Type": "application/json",
              },
              body: JSON.stringify({
                apiKey,
                messages: [firstUser, firstAssistant],
              }),
            });

            if (!response.ok) {
              return;
            }

            const data = (await response.json()) as { title?: string };
            if (typeof data.title === "string" && data.title.trim()) {
              renameThread(threadId, data.title.trim());
            }
          } catch {
            // Keep the existing title on any failure.
          }
        })();
      }, 1500);
    },
    [renameThread, settings.apiKey],
  );

  scheduleAutoTitleRef.current = scheduleAutoTitle;

  const exportAllThreads = useCallback(() => {
    exportThreadsJson(threadsRef.current);
  }, []);

  const exportCurrentThread = useCallback(() => {
    const thread = threadsRef.current.find((item) => item.id === activeThreadId);
    if (!thread || thread.messages.length === 0) {
      setNoticeText("Nothing to export in this chat.");
      window.setTimeout(() => setNoticeText(""), 1800);
      return;
    }

    exportThreadMarkdown(thread);
  }, [activeThreadId]);

  const importThreads = useCallback(async (file: File) => {
    try {
      const parsed = parseThreadsJson(await file.text());
      if (!isChatThreadArray(parsed)) {
        setNoticeText("Could not import threads. File format is invalid.");
        window.setTimeout(() => setNoticeText(""), 2500);
        return;
      }

      const now = new Date().toISOString();
      const imported = parsed.map((thread) => ({
        ...thread,
        id: createId(),
        starred: false,
        updatedAt: now,
      }));

      setThreads((current) => [...imported, ...current]);
      setImportNotice(`Imported ${imported.length} chat${imported.length === 1 ? "" : "s"}.`);
      window.setTimeout(() => setImportNotice(""), 3000);
    } catch {
      setNoticeText("Could not import threads.");
      window.setTimeout(() => setNoticeText(""), 2500);
    }
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
        onToggleStarred={toggleThreadStarred}
        onComingSoon={showComingSoon}
      />

      <section className="flex min-w-0 flex-1 flex-col overflow-hidden bg-(--background)">
        <header className="flex h-12 shrink-0 items-center justify-between gap-3 border-b border-(--border) bg-(--background) px-3 md:px-5">
          <div className="flex min-w-0 items-center gap-1.5">
            <button
              type="button"
              title="Open sidebar"
              aria-label="Open sidebar"
              onClick={() => setSidebarOpen(true)}
              className="grid h-8 w-8 shrink-0 place-items-center rounded-md text-(--muted) hover:bg-(--surface-muted) lg:hidden"
            >
              <Menu size={17} aria-hidden="true" />
            </button>
            <button
              type="button"
              onClick={renameActiveThread}
              className="min-w-0 truncate rounded-md px-2 py-1 text-left text-[0.92rem] font-semibold text-(--foreground) hover:bg-(--surface-muted)"
            >
              {activeThread?.title || "New chat"}
            </button>
            <button
              type="button"
              title="More options"
              aria-label="More options"
              onClick={() => showComingSoon("Chat options")}
              className="grid h-8 w-8 shrink-0 place-items-center rounded-md text-(--muted) hover:bg-(--surface-muted)"
            >
              <MoreHorizontal size={17} aria-hidden="true" />
            </button>
          </div>
          <div className="flex shrink-0 items-center gap-2">
            <button
              type="button"
              onClick={() => showComingSoon("Share")}
              className="inline-flex h-8 items-center gap-1.5 rounded-md border border-(--border) bg-(--surface-raised) px-3 text-sm font-medium text-(--foreground) shadow-[0_1px_2px_rgba(31,31,30,0.06)] hover:bg-(--surface-muted)"
            >
              <Share2 size={14} aria-hidden="true" />
              Share
            </button>
          </div>
        </header>

        {!hydrated ? (
          <div className="flex min-h-0 flex-1 items-center justify-center px-6 text-center text-sm text-(--muted)">
            Loading chat...
          </div>
        ) : visibleMessages.length === 0 ? (
          <div className="flex min-h-0 flex-1 flex-col items-center justify-center px-4 pb-10 md:px-8">
            <div className="w-full max-w-184">
              <div className="mb-7 flex items-center justify-center gap-3">
                <span className="brand-burst text-4xl text-(--brand)" aria-hidden="true">
                  *
                </span>
                <h1 className="font-serif text-4xl leading-tight text-(--foreground) md:text-[2.75rem]">
                  Lamps returns!
                </h1>
              </div>
              <p className="mx-auto mb-6 max-w-md text-center text-sm text-(--muted)">
                Draft an email, plan a project, summarize a document, or keep a thought moving.
              </p>
              <Composer
                key={activeThreadId}
                onSend={sendMessage}
                onStop={stopStreaming}
                isStreaming={isStreaming}
                disabled={!hydrated}
                model={settings.model}
                placeholder="What are you working on?"
                showDisclaimer={false}
                seed={composerSeed}
                onOpenSettings={() => setIsSettingsOpen(true)}
                onVoice={() => showComingSoon("Voice input")}
              />
              <StarterChips onSelect={seedComposer} />
            </div>
          </div>
        ) : (
          <>
            <section
              ref={scrollRef}
              className="scroll-area min-h-0 flex-1 overflow-y-auto px-4 py-7 md:px-8"
              aria-label="Chat messages"
            >
              <div className="mx-auto w-full max-w-184 space-y-6">
                {visibleMessages.map((message, index) => {
                  const isActiveStream =
                    isStreaming && message.id === visibleMessages.at(-1)?.id && message.role === "assistant";
                  const contentOverride =
                    streamingDraft?.messageId === message.id ? streamingDraft.content : undefined;
                  const reasoningOverride =
                    streamingDraft?.messageId === message.id ? streamingDraft.reasoning : undefined;

                  return (
                    <MessageBubble
                      key={message.id}
                      message={message}
                      contentOverride={contentOverride}
                      reasoningOverride={reasoningOverride}
                      isStreaming={isActiveStream}
                      onRetry={message.role === "assistant" ? () => retryAssistantMessage(message.id) : undefined}
                      onEditMessage={
                        message.role === "user" ? (messageId, content) => editUserMessage(messageId, content) : undefined
                      }
                      onForkFromMessage={(messageId) => forkFromMessage(messageId)}
                      showThinking={message.role === "assistant" && index === visibleMessages.length - 1 && isStreaming}
                    />
                  );
                })}
              </div>
            </section>

            <div className="shrink-0 bg-linear-to-t from-(--background) via-(--background) to-transparent px-4 pb-3 md:px-8">
              {statusText ? (
                <p className="mx-auto max-w-184 pb-2 text-xs text-(--muted)" role="status">
                  {statusText}
                </p>
              ) : null}
              <Composer
                key={activeThreadId}
                onSend={sendMessage}
                onStop={stopStreaming}
                isStreaming={isStreaming}
                disabled={!hydrated}
                model={settings.model}
                placeholder="Reply to Lamps…"
                onOpenSettings={() => setIsSettingsOpen(true)}
                onVoice={() => showComingSoon("Voice input")}
              />
            </div>
          </>
        )}
      </section>

      {noticeText ? (
        <div className="fixed bottom-5 left-1/2 z-80 -translate-x-1/2 rounded-md border border-(--border) bg-(--foreground) px-4 py-2 text-sm text-(--background) shadow-[0_10px_30px_rgba(31,31,30,0.14)]">
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
        onExportAllThreads={exportAllThreads}
        onExportCurrentThread={exportCurrentThread}
        onImportThreads={importThreads}
        importNotice={importNotice}
        canExportCurrentThread={Boolean(activeThread && activeThread.messages.length > 0)}
      />
    </main>
  );
}

const STARTER_PROMPTS: {
  label: string;
  icon: ComponentType<{ size?: number; className?: string; "aria-hidden"?: boolean }>;
  prompt: string;
}[] = [
  { label: "Draft an email", icon: Mail, prompt: "Help me draft an email to " },
  { label: "Plan a project", icon: FolderKanban, prompt: "Help me plan a project for " },
  { label: "Summarize", icon: FileText, prompt: "Summarize the following:\n\n" },
  { label: "Brainstorm", icon: Lightbulb, prompt: "Let's brainstorm ideas about " },
];

function StarterChips({ onSelect }: { onSelect: (text: string) => void }) {
  return (
    <div className="mt-4 flex flex-wrap justify-center gap-2">
      {STARTER_PROMPTS.map(({ label, icon: Icon, prompt }) => (
        <button
          key={label}
          type="button"
          onClick={() => onSelect(prompt)}
          className="inline-flex h-9 items-center gap-2 rounded-lg border border-(--border) bg-(--surface-raised) px-3 text-sm text-(--foreground) shadow-[0_1px_2px_rgba(31,31,30,0.05)] transition hover:bg-(--surface-muted)"
        >
          <Icon size={15} className="text-(--brand)" aria-hidden={true} />
          {label}
        </button>
      ))}
    </div>
  );
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

function createForkTitle(originalTitle: string) {
  const candidate = `${originalTitle} (fork)`;
  return candidate.length > 60 ? `${candidate.slice(0, 57).trim()}...` : candidate;
}

// Auto-title only when the user has not renamed away from defaults:
// - title is still "New chat", or
// - exactly one user and one assistant message and title still matches the first-message heuristic.
function shouldAutoTitle(thread: ChatThread) {
  if (thread.title === "New chat") {
    return true;
  }

  const userMessages = thread.messages.filter((message) => message.role === "user");
  const assistantMessages = thread.messages.filter((message) => message.role === "assistant");
  if (userMessages.length !== 1 || assistantMessages.length !== 1) {
    return false;
  }

  return thread.title === createTitleFromMessage(userMessages[0].content);
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
    onReasoning: (text: string) => void;
    onSource: (source: ChatMessageSource) => void;
    onFile: (file: ChatGeneratedFile) => void;
    onUsage: (usage: ChatMessageUsage) => void;
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
      if (event.type === "reasoning" && typeof event.text === "string") {
        handlers.onReasoning(event.text);
      }
      if (event.type === "source" && isMessageSource(event.source)) {
        handlers.onSource(event.source);
      }
      if (event.type === "file" && isGeneratedFile(event.file)) {
        handlers.onFile(event.file);
      }
      if (event.type === "usage" && isMessageUsage(event.usage)) {
        handlers.onUsage(event.usage);
      }
      if (event.type === "error" && typeof event.error?.message === "string") {
        handlers.onError(event.error.message);
      }
    } catch {
      continue;
    }
  }

  return remainder;
}
