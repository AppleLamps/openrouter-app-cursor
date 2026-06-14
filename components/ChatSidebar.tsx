"use client";

import { useEffect, useState } from "react";
import { Check, MessageSquare, PanelLeftClose, PanelLeftOpen, Pencil, Plus, Trash2, X } from "lucide-react";
import type { ChatThread } from "@/lib/types";

type ChatSidebarProps = {
  threads: ChatThread[];
  activeThreadId: string;
  collapsed: boolean;
  mobileOpen: boolean;
  onToggleCollapsed: () => void;
  onCloseMobile: () => void;
  onNewThread: () => void;
  onSelectThread: (threadId: string) => void;
  onRenameThread: (threadId: string, title: string) => void;
  onDeleteThread: (threadId: string) => void;
};

export function ChatSidebar({
  threads,
  activeThreadId,
  collapsed,
  mobileOpen,
  onToggleCollapsed,
  onCloseMobile,
  onNewThread,
  onSelectThread,
  onRenameThread,
  onDeleteThread,
}: ChatSidebarProps) {
  const sortedThreads = [...threads].sort((a, b) => Date.parse(b.updatedAt) - Date.parse(a.updatedAt));

  return (
    <>
      <button
        type="button"
        aria-label="Close sidebar"
        className={`fixed inset-0 z-40 bg-black/60 backdrop-blur-sm transition lg:hidden ${
          mobileOpen ? "block" : "hidden"
        }`}
        onClick={onCloseMobile}
      />

      <aside
        className={[
          "modal-safe fixed inset-y-0 left-0 z-50 flex w-[84vw] max-w-80 flex-col border-r border-[color:var(--border)] bg-[color:var(--surface)] shadow-2xl transition-transform duration-200 lg:static lg:z-auto lg:h-full lg:shrink-0 lg:translate-x-0 lg:p-0 lg:shadow-none",
          mobileOpen
            ? "visible translate-x-0"
            : "invisible pointer-events-none -translate-x-full lg:pointer-events-auto lg:visible",
          collapsed ? "lg:w-[4.75rem]" : "lg:w-72",
        ].join(" ")}
      >
        <div className="flex items-center justify-between gap-2 border-b border-[color:var(--border)] pb-3 lg:p-3">
          {!collapsed ? (
            <div className="min-w-0">
              <p className="truncate text-sm font-semibold">Chats</p>
              <p className="text-xs text-[color:var(--muted)]">{threads.length}</p>
            </div>
          ) : null}
          <div className="ml-auto flex items-center gap-2">
            <button
              type="button"
              title={collapsed ? "Expand sidebar" : "Collapse sidebar"}
              aria-label={collapsed ? "Expand sidebar" : "Collapse sidebar"}
              onClick={onToggleCollapsed}
              className="hidden min-h-11 min-w-11 place-items-center rounded-full bg-[color:var(--surface-muted)] text-[color:var(--muted)] transition active:scale-95 lg:grid"
            >
              {collapsed ? <PanelLeftOpen size={18} aria-hidden="true" /> : <PanelLeftClose size={18} aria-hidden="true" />}
            </button>
            <button
              type="button"
              title="Close sidebar"
              aria-label="Close sidebar"
              onClick={onCloseMobile}
              className="grid min-h-11 min-w-11 place-items-center rounded-full bg-[color:var(--surface-muted)] text-[color:var(--muted)] transition active:scale-95 lg:hidden"
            >
              <X size={18} aria-hidden="true" />
            </button>
          </div>
        </div>

        <div className="pt-3 lg:px-3 lg:pt-3">
          <button
            type="button"
            title="New chat"
            aria-label="New chat"
            onClick={onNewThread}
            className={`inline-flex min-h-11 w-full items-center justify-center gap-2 rounded-xl bg-[color:var(--foreground)] px-3 text-sm font-medium text-[color:var(--background)] transition active:scale-[0.98] ${
              collapsed ? "lg:px-0" : ""
            }`}
          >
            <Plus size={18} aria-hidden="true" />
            {!collapsed ? <span>New chat</span> : null}
          </button>
        </div>

        <div className="scroll-area min-h-0 flex-1 space-y-2 overflow-y-auto py-3 lg:px-3">
          {sortedThreads.map((thread) => (
            <ThreadRow
              key={thread.id}
              thread={thread}
              active={thread.id === activeThreadId}
              collapsed={collapsed}
              onSelect={() => onSelectThread(thread.id)}
              onRename={(title) => onRenameThread(thread.id, title)}
              onDelete={() => onDeleteThread(thread.id)}
            />
          ))}
        </div>
      </aside>
    </>
  );
}

function ThreadRow({
  thread,
  active,
  collapsed,
  onSelect,
  onRename,
  onDelete,
}: {
  thread: ChatThread;
  active: boolean;
  collapsed: boolean;
  onSelect: () => void;
  onRename: (title: string) => void;
  onDelete: () => void;
}) {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(thread.title);

  useEffect(() => {
    setDraft(thread.title);
  }, [thread.title]);

  function commitRename() {
    const nextTitle = draft.trim();
    if (nextTitle) {
      onRename(nextTitle);
    } else {
      setDraft(thread.title);
    }
    setEditing(false);
  }

  if (collapsed) {
    return (
      <button
        type="button"
        title={thread.title}
        aria-label={thread.title}
        onClick={onSelect}
        className={`grid min-h-11 w-full place-items-center rounded-xl transition active:scale-95 ${
          active
            ? "bg-[color:var(--accent-strong)] text-[color:var(--background)]"
            : "bg-[color:var(--surface-raised)] text-[color:var(--muted)]"
        }`}
      >
        <MessageSquare size={17} aria-hidden="true" />
      </button>
    );
  }

  return (
    <div
      className={`rounded-xl border transition ${
        active
          ? "border-[color:var(--accent)] bg-[color:var(--surface-raised)]"
          : "border-transparent bg-transparent hover:bg-[color:var(--surface-raised)]"
      }`}
    >
      <button type="button" onClick={onSelect} className="flex min-h-12 w-full items-center gap-3 px-3 text-left">
        <MessageSquare size={17} className="shrink-0 text-[color:var(--muted)]" aria-hidden="true" />
        {editing ? (
          <input
            value={draft}
            autoFocus
            onClick={(event) => event.stopPropagation()}
            onChange={(event) => setDraft(event.target.value)}
            onBlur={commitRename}
            onKeyDown={(event) => {
              if (event.key === "Enter") {
                commitRename();
              }
              if (event.key === "Escape") {
                setDraft(thread.title);
                setEditing(false);
              }
            }}
            className="min-w-0 flex-1 rounded-lg border border-[color:var(--border)] bg-[color:var(--background)] px-2 py-1 text-sm"
          />
        ) : (
          <span className="min-w-0 flex-1 truncate text-sm">{thread.title}</span>
        )}
      </button>
      {!editing ? (
        <div className="flex justify-end gap-1 px-2 pb-2">
          <button
            type="button"
            title="Rename chat"
            aria-label="Rename chat"
            onClick={() => setEditing(true)}
            className="grid min-h-9 min-w-9 place-items-center rounded-full text-[color:var(--muted)] transition active:scale-95"
          >
            <Pencil size={15} aria-hidden="true" />
          </button>
          <button
            type="button"
            title="Delete chat"
            aria-label="Delete chat"
            onClick={onDelete}
            className="grid min-h-9 min-w-9 place-items-center rounded-full text-[color:var(--muted)] transition active:scale-95"
          >
            <Trash2 size={15} aria-hidden="true" />
          </button>
        </div>
      ) : (
        <div className="flex justify-end px-2 pb-2">
          <button
            type="button"
            title="Save chat name"
            aria-label="Save chat name"
            onClick={commitRename}
            className="grid min-h-9 min-w-9 place-items-center rounded-full text-[color:var(--accent)] transition active:scale-95"
          >
            <Check size={15} aria-hidden="true" />
          </button>
        </div>
      )}
    </div>
  );
}
