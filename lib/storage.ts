import {
  DEFAULT_MODEL,
  DEFAULT_SETTINGS,
  type ChatMessage,
  type ChatSettings,
  type ChatThread,
} from "@/lib/types";
import {
  isChatAttachment,
  isChatGeneratedFile,
  isChatMessage,
  isChatThread,
  normalizeMessageTransforms,
  normalizeMultimodalSettings,
  normalizeProviderRouting,
  normalizeReasoning,
  normalizeResponseCaching,
  normalizeServerTools,
  normalizeUserProfile,
} from "@/lib/validation";
import { createId } from "@/lib/utils";

const MESSAGES_KEY = "openrouter-chat:messages:v1";
const SETTINGS_KEY = "openrouter-chat:settings:v1";
const THREADS_KEY = "openrouter-chat:threads:v1";
const ACTIVE_THREAD_KEY = "openrouter-chat:active-thread-id:v1";
const SIDEBAR_COLLAPSED_KEY = "openrouter-chat:sidebar-collapsed:v1";

function canUseStorage() {
  return typeof window !== "undefined" && typeof window.localStorage !== "undefined";
}

function normalizeSettings(value: unknown): ChatSettings {
  if (!value || typeof value !== "object") {
    return DEFAULT_SETTINGS;
  }

  const settings = value as Partial<ChatSettings>;
  const temperature =
    typeof settings.temperature === "number" && Number.isFinite(settings.temperature)
      ? Math.min(2, Math.max(0, settings.temperature))
      : DEFAULT_SETTINGS.temperature;

  return {
    apiKey:
      typeof settings.apiKey === "string" && settings.apiKey.trim()
        ? settings.apiKey.trim()
        : undefined,
    profile: normalizeUserProfile(settings.profile),
    model:
      typeof settings.model === "string" && settings.model.trim()
        ? settings.model.trim()
        : DEFAULT_MODEL,
    systemPrompt:
      typeof settings.systemPrompt === "string"
        ? settings.systemPrompt
        : DEFAULT_SETTINGS.systemPrompt,
    temperature,
    serverTools: normalizeServerTools(settings.serverTools),
    multimodal: normalizeMultimodalSettings(settings.multimodal),
    messageTransforms: normalizeMessageTransforms(settings.messageTransforms),
    responseCaching: normalizeResponseCaching(settings.responseCaching),
    reasoning: normalizeReasoning(settings.reasoning),
    providerRouting: normalizeProviderRouting(settings.providerRouting),
  };
}

function normalizeChatMessage(message: ChatMessage): ChatMessage {
  return {
    ...message,
    attachments: message.attachments?.filter(isChatAttachment),
    files: message.files?.filter(isChatGeneratedFile),
  };
}

function titleFromMessages(messages: ChatMessage[]) {
  const firstUserMessage = messages.find((message) => message.role === "user" && message.content.trim());
  if (!firstUserMessage) {
    return "New chat";
  }

  const compact = firstUserMessage.content.replace(/\s+/g, " ").trim();
  return compact.length > 42 ? `${compact.slice(0, 39).trim()}...` : compact;
}

function normalizeThread(thread: ChatThread): ChatThread {
  const messages = thread.messages.filter(isChatMessage).map(normalizeChatMessage);
  return {
    ...thread,
    title: thread.title.trim() || titleFromMessages(messages),
    messages,
    starred: Boolean(thread.starred),
  };
}

function loadLegacyMessages(): ChatMessage[] {
  if (!canUseStorage()) {
    return [];
  }

  try {
    const raw = window.localStorage.getItem(MESSAGES_KEY);
    if (!raw) {
      return [];
    }

    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed.filter(isChatMessage) : [];
  } catch {
    return [];
  }
}

export function loadThreads(): ChatThread[] {
  if (!canUseStorage()) {
    return [];
  }

  try {
    const raw = window.localStorage.getItem(THREADS_KEY);
    if (raw) {
      const parsed = JSON.parse(raw);
      if (Array.isArray(parsed)) {
        const threads = parsed.filter(isChatThread).map(normalizeThread);
        if (threads.length > 0) {
          return threads;
        }
      }
    }
  } catch {
    // Fall through to legacy migration.
  }

  const legacyMessages = loadLegacyMessages();
  if (legacyMessages.length === 0) {
    return [];
  }

  const now = new Date().toISOString();
  const migratedThread: ChatThread = {
    id: createId(),
    title: titleFromMessages(legacyMessages),
    messages: legacyMessages,
    createdAt: legacyMessages[0]?.createdAt ?? now,
    updatedAt: now,
    starred: false,
  };

  saveThreads([migratedThread]);
  window.localStorage.removeItem(MESSAGES_KEY);
  return [migratedThread];
}

export function saveThreads(threads: ChatThread[]) {
  if (!canUseStorage()) {
    return;
  }

  window.localStorage.setItem(THREADS_KEY, JSON.stringify(threads.map(normalizeThread)));
}

export function loadActiveThreadId() {
  if (!canUseStorage()) {
    return null;
  }

  return window.localStorage.getItem(ACTIVE_THREAD_KEY);
}

export function saveActiveThreadId(threadId: string) {
  if (!canUseStorage()) {
    return;
  }

  window.localStorage.setItem(ACTIVE_THREAD_KEY, threadId);
}

export function loadSidebarCollapsed() {
  if (!canUseStorage()) {
    return false;
  }

  return window.localStorage.getItem(SIDEBAR_COLLAPSED_KEY) === "true";
}

export function saveSidebarCollapsed(collapsed: boolean) {
  if (!canUseStorage()) {
    return;
  }

  window.localStorage.setItem(SIDEBAR_COLLAPSED_KEY, collapsed ? "true" : "false");
}

export function clearStoredThreads() {
  if (!canUseStorage()) {
    return;
  }

  window.localStorage.removeItem(THREADS_KEY);
  window.localStorage.removeItem(ACTIVE_THREAD_KEY);
  window.localStorage.removeItem(MESSAGES_KEY);
}

export function loadSettings(): ChatSettings {
  if (!canUseStorage()) {
    return DEFAULT_SETTINGS;
  }

  try {
    const raw = window.localStorage.getItem(SETTINGS_KEY);
    return raw ? normalizeSettings(JSON.parse(raw)) : DEFAULT_SETTINGS;
  } catch {
    return DEFAULT_SETTINGS;
  }
}

export function saveSettings(settings: ChatSettings) {
  if (!canUseStorage()) {
    return;
  }

  window.localStorage.setItem(SETTINGS_KEY, JSON.stringify(normalizeSettings(settings)));
}

export function clearStoredSettings() {
  if (!canUseStorage()) {
    return;
  }

  window.localStorage.removeItem(SETTINGS_KEY);
}
