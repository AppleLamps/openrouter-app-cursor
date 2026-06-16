import type { ChatThread } from "@/lib/types";

export function downloadFile(filename: string, content: string, mimeType: string) {
  if (typeof window === "undefined") {
    return;
  }

  const blob = new Blob([content], { type: mimeType });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = filename;
  anchor.rel = "noopener";
  document.body.appendChild(anchor);
  anchor.click();
  anchor.remove();
  URL.revokeObjectURL(url);
}

export function exportThreadsJson(threads: ChatThread[]) {
  const date = new Date().toISOString().slice(0, 10);
  downloadFile(`lamps-threads-${date}.json`, JSON.stringify(threads, null, 2), "application/json");
}

export function serializeThreadMarkdown(thread: ChatThread) {
  const lines = [`# ${thread.title}`, ""];

  for (const message of thread.messages) {
    if (message.role === "system") {
      continue;
    }

    lines.push(`## ${message.role}`);
    if (message.createdAt) {
      lines.push(message.createdAt);
    }
    lines.push("");
    if (message.content.trim()) {
      lines.push(message.content.trim());
      lines.push("");
    }

    const attachmentNames = (message.attachments ?? []).map((attachment) => attachment.name);
    if (attachmentNames.length > 0) {
      for (const name of attachmentNames) {
        lines.push(`- ${name}`);
      }
      lines.push("");
    }
  }

  return lines.join("\n").trimEnd();
}

function sanitizeFilename(title: string) {
  const sanitized = title
    .replace(/[<>:"/\\|?*\u0000-\u001f]/g, "-")
    .replace(/\s+/g, " ")
    .trim();
  return sanitized.slice(0, 80) || "chat";
}

export function exportThreadMarkdown(thread: ChatThread) {
  downloadFile(`${sanitizeFilename(thread.title)}.md`, serializeThreadMarkdown(thread), "text/markdown");
}

export function parseThreadsJson(text: string): unknown {
  try {
    return JSON.parse(text) as unknown;
  } catch {
    return null;
  }
}
