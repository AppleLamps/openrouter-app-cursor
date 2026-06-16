"use client";

import { useEffect, useMemo, useState } from "react";
import type { ComponentType } from "react";
import {
  BriefcaseBusiness,
  Check,
  ChevronDown,
  Code2,
  FolderKanban,
  Home,
  MessageCircle,
  MoreHorizontal,
  Palette,
  PanelLeftClose,
  PanelLeftOpen,
  Pencil,
  Plus,
  Search,
  Sparkles,
  Star,
  Trash2,
  X,
} from "lucide-react";
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
  onToggleStarred: (threadId: string) => void;
  onComingSoon: (label: string) => void;
};

const PRODUCT_LINKS = [
  { label: "Code", icon: Code2 },
  { label: "Cowork", icon: BriefcaseBusiness },
  { label: "Design", icon: Palette },
];

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
  onToggleStarred,
  onComingSoon,
}: ChatSidebarProps) {
  const [query, setQuery] = useState("");
  const sortedThreads = useMemo(
    () => [...threads].sort((a, b) => Date.parse(b.updatedAt) - Date.parse(a.updatedAt)),
    [threads],
  );
  const filteredThreads = useMemo(() => {
    const normalizedQuery = query.trim().toLowerCase();
    if (!normalizedQuery) {
      return sortedThreads;
    }

    return sortedThreads.filter((thread) => thread.title.toLowerCase().includes(normalizedQuery));
  }, [query, sortedThreads]);
  const starredThreads = filteredThreads.filter((thread) => thread.starred);

  return (
    <>
      <button
        type="button"
        aria-label="Close sidebar"
        className={`fixed inset-0 z-40 bg-black/20 backdrop-blur-[2px] transition lg:hidden ${
          mobileOpen ? "block" : "hidden"
        }`}
        onClick={onCloseMobile}
      />

      <aside
        className={[
          "modal-safe fixed inset-y-0 left-0 z-50 flex w-[86vw] max-w-[18rem] flex-col border-r border-[color:var(--border)] bg-[color:var(--sidebar)] transition-transform duration-200 lg:static lg:z-auto lg:h-full lg:w-[17.5rem] lg:shrink-0 lg:translate-x-0 lg:p-0",
          mobileOpen
            ? "visible translate-x-0 shadow-2xl"
            : "invisible pointer-events-none -translate-x-full lg:pointer-events-auto lg:visible lg:shadow-none",
          collapsed ? "lg:w-[4.75rem]" : "",
        ].join(" ")}
      >
        <div className="flex items-center justify-between gap-2 px-3 pb-3 lg:pt-3">
          <button
            type="button"
            onClick={() => onComingSoon("Home")}
            className="inline-flex min-w-0 items-center gap-2 rounded-lg px-1 py-1 text-left text-lg font-semibold text-[color:var(--foreground)]"
          >
            <Sparkles size={19} className="text-[color:var(--brand)]" aria-hidden="true" />
            {!collapsed ? <span className="truncate font-serif text-[1.35rem]">Lamps</span> : null}
          </button>
          <div className="ml-auto flex items-center gap-1">
            <button
              type="button"
              title={collapsed ? "Expand sidebar" : "Collapse sidebar"}
              aria-label={collapsed ? "Expand sidebar" : "Collapse sidebar"}
              onClick={onToggleCollapsed}
              className="hidden h-8 w-8 place-items-center rounded-lg text-[color:var(--muted)] hover:bg-[color:var(--surface-muted)] lg:grid"
            >
              {collapsed ? <PanelLeftOpen size={16} aria-hidden="true" /> : <PanelLeftClose size={16} aria-hidden="true" />}
            </button>
            <button
              type="button"
              title="Close sidebar"
              aria-label="Close sidebar"
              onClick={onCloseMobile}
              className="grid h-9 w-9 place-items-center rounded-lg text-[color:var(--muted)] hover:bg-[color:var(--surface-muted)] lg:hidden"
            >
              <X size={17} aria-hidden="true" />
            </button>
          </div>
        </div>

        {!collapsed ? (
          <div className="px-3">
            <label className="mb-2 flex h-9 items-center gap-2 rounded-xl border border-transparent bg-white/60 px-2 text-sm text-[color:var(--muted)] focus-within:border-[color:var(--border-strong)]">
              <Search size={15} aria-hidden="true" />
              <span className="sr-only">Search chats</span>
              <input
                value={query}
                onChange={(event) => setQuery(event.target.value)}
                placeholder="Search chats"
                className="min-w-0 flex-1 bg-transparent text-[color:var(--foreground)] outline-none placeholder:text-[color:var(--muted)]"
              />
            </label>

            <button
              type="button"
              onClick={onNewThread}
              className="mb-3 flex h-10 w-full items-center justify-between rounded-xl px-2 text-sm text-[color:var(--foreground)] hover:bg-white"
            >
              <span className="inline-flex items-center gap-2">
                <span className="grid h-5 w-5 place-items-center rounded-full bg-[color:var(--surface-muted)]">
                  <Plus size={14} aria-hidden="true" />
                </span>
                New chat
              </span>
              <span className="rounded-md border border-[color:var(--border)] bg-[color:var(--surface)] px-1.5 py-0.5 text-[0.68rem] text-[color:var(--muted)]">
                Ctrl K
              </span>
            </button>

            <nav className="space-y-1 text-sm" aria-label="Primary">
              <SidebarAction icon={MessageCircle} label="Chats" active onClick={() => setQuery("")} />
              <SidebarAction icon={FolderKanban} label="Projects" onClick={() => onComingSoon("Projects")} />
              <SidebarAction icon={Sparkles} label="Artifacts" onClick={() => onComingSoon("Artifacts")} />
              <SidebarAction icon={Home} label="Customize" onClick={() => onComingSoon("Customize")} />
            </nav>
          </div>
        ) : (
          <div className="space-y-2 px-2">
            <CollapsedButton label="Search chats" icon={Search} onClick={() => onToggleCollapsed()} />
            <CollapsedButton label="New chat" icon={Plus} onClick={onNewThread} />
          </div>
        )}

        {!collapsed ? (
          <div className="mt-5 min-h-0 flex-1 overflow-hidden px-3">
            <SectionHeading label="Products" />
            <div className="mb-5 space-y-1">
              {PRODUCT_LINKS.map(({ label, icon }) => (
                <SidebarAction key={label} icon={icon} label={label} onClick={() => onComingSoon(label)} />
              ))}
            </div>

            <div className="scroll-area h-full overflow-y-auto pr-1">
              <ThreadSection
                label="Starred"
                emptyLabel="No starred chats"
                threads={starredThreads}
                activeThreadId={activeThreadId}
                onSelectThread={onSelectThread}
                onRenameThread={onRenameThread}
                onDeleteThread={onDeleteThread}
                onToggleStarred={onToggleStarred}
              />
              <ThreadSection
                label="Recents"
                emptyLabel={query ? "No matching chats" : "No recent chats"}
                threads={filteredThreads}
                activeThreadId={activeThreadId}
                onSelectThread={onSelectThread}
                onRenameThread={onRenameThread}
                onDeleteThread={onDeleteThread}
                onToggleStarred={onToggleStarred}
              />
            </div>
          </div>
        ) : (
          <div className="scroll-area mt-4 min-h-0 flex-1 space-y-2 overflow-y-auto px-2">
            {sortedThreads.slice(0, 12).map((thread) => (
              <button
                key={thread.id}
                type="button"
                title={thread.title}
                aria-label={thread.title}
                onClick={() => onSelectThread(thread.id)}
                className={`grid h-10 w-full place-items-center rounded-xl transition ${
                  thread.id === activeThreadId
                    ? "bg-[color:var(--surface-muted)] text-[color:var(--foreground)]"
                    : "text-[color:var(--muted)] hover:bg-white"
                }`}
              >
                <MessageCircle size={17} aria-hidden="true" />
              </button>
            ))}
          </div>
        )}

        {!collapsed ? (
          <div className="mt-auto border-t border-[color:var(--border)] p-3">
            <button
              type="button"
              onClick={() => onComingSoon("Account")}
              className="flex w-full items-center gap-2 rounded-xl p-1.5 text-left hover:bg-white"
            >
              <span className="grid h-9 w-9 shrink-0 place-items-center rounded-full bg-[color:var(--foreground)] text-xs font-semibold text-[color:var(--background)]">
                AL
              </span>
              <span className="min-w-0 flex-1">
                <span className="block truncate text-sm font-medium">Apple Lamps</span>
                <span className="block truncate text-xs text-[color:var(--muted)]">Max plan</span>
              </span>
              <ChevronDown size={15} className="text-[color:var(--muted)]" aria-hidden="true" />
            </button>
          </div>
        ) : null}
      </aside>
    </>
  );
}

function SidebarAction({
  icon: Icon,
  label,
  active = false,
  onClick,
}: {
  icon: ComponentType<{ size?: number; className?: string; "aria-hidden"?: boolean }>;
  label: string;
  active?: boolean;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`flex h-9 w-full items-center gap-2 rounded-lg px-2 text-left transition ${
        active ? "bg-white text-[color:var(--foreground)]" : "text-[color:var(--foreground)] hover:bg-white"
      }`}
    >
      <Icon size={16} className="shrink-0 text-[color:var(--muted)]" aria-hidden={true} />
      <span className="truncate">{label}</span>
    </button>
  );
}

function CollapsedButton({
  label,
  icon: Icon,
  onClick,
}: {
  label: string;
  icon: ComponentType<{ size?: number; "aria-hidden"?: boolean }>;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      title={label}
      aria-label={label}
      onClick={onClick}
      className="grid h-10 w-full place-items-center rounded-xl text-[color:var(--muted)] hover:bg-white"
    >
      <Icon size={17} aria-hidden={true} />
    </button>
  );
}

function SectionHeading({ label }: { label: string }) {
  return (
    <div className="mb-2 flex items-center justify-between px-2 text-[0.68rem] font-medium uppercase tracking-[0.08em] text-[color:var(--muted)]">
      <span>{label}</span>
    </div>
  );
}

function ThreadSection({
  label,
  emptyLabel,
  threads,
  activeThreadId,
  onSelectThread,
  onRenameThread,
  onDeleteThread,
  onToggleStarred,
}: {
  label: string;
  emptyLabel: string;
  threads: ChatThread[];
  activeThreadId: string;
  onSelectThread: (threadId: string) => void;
  onRenameThread: (threadId: string, title: string) => void;
  onDeleteThread: (threadId: string) => void;
  onToggleStarred: (threadId: string) => void;
}) {
  return (
    <section className="mb-5">
      <SectionHeading label={label} />
      <div className="space-y-1">
        {threads.length === 0 ? (
          <p className="px-2 py-1 text-xs text-[color:var(--muted)]">{emptyLabel}</p>
        ) : (
          threads.map((thread) => (
            <ThreadRow
              key={`${label}-${thread.id}`}
              thread={thread}
              active={thread.id === activeThreadId}
              onSelect={() => onSelectThread(thread.id)}
              onRename={(title) => onRenameThread(thread.id, title)}
              onDelete={() => onDeleteThread(thread.id)}
              onToggleStarred={() => onToggleStarred(thread.id)}
            />
          ))
        )}
      </div>
    </section>
  );
}

function ThreadRow({
  thread,
  active,
  onSelect,
  onRename,
  onDelete,
  onToggleStarred,
}: {
  thread: ChatThread;
  active: boolean;
  onSelect: () => void;
  onRename: (title: string) => void;
  onDelete: () => void;
  onToggleStarred: () => void;
}) {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(thread.title);
  const [menuOpen, setMenuOpen] = useState(false);

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

  return (
    <div
      className={`group relative rounded-lg transition ${
        active ? "bg-[color:var(--surface-muted)]" : "hover:bg-white"
      }`}
    >
      {editing ? (
        <div className="flex min-h-9 items-center gap-1 px-2">
          <input
            value={draft}
            autoFocus
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
            className="min-w-0 flex-1 rounded-md border border-[color:var(--border)] bg-white px-2 py-1 text-sm outline-none"
          />
          <button
            type="button"
            title="Save chat name"
            aria-label="Save chat name"
            onMouseDown={(event) => event.preventDefault()}
            onClick={commitRename}
            className="grid h-7 w-7 place-items-center rounded-md text-[color:var(--brand)] hover:bg-[color:var(--surface)]"
          >
            <Check size={14} aria-hidden="true" />
          </button>
        </div>
      ) : (
        <button type="button" onClick={onSelect} className="flex h-9 w-full items-center gap-2 px-2 pr-9 text-left">
          <span className="min-w-0 flex-1 truncate text-sm text-[color:var(--foreground)]">{thread.title}</span>
        </button>
      )}

      {!editing ? (
        <button
          type="button"
          title="More options"
          aria-label={`More options for ${thread.title}`}
          onClick={() => setMenuOpen((current) => !current)}
          className={`absolute right-1 top-1 grid h-7 w-7 place-items-center rounded-md text-[color:var(--muted)] hover:bg-[color:var(--surface)] ${
            menuOpen ? "opacity-100" : "opacity-0 group-hover:opacity-100 focus:opacity-100"
          }`}
        >
          <MoreHorizontal size={16} aria-hidden="true" />
        </button>
      ) : null}

      {menuOpen ? (
        <div className="absolute right-1 top-8 z-20 w-40 rounded-xl border border-[color:var(--border)] bg-white p-1 text-sm shadow-[0_10px_30px_rgba(80,67,52,0.12)]">
          <MenuItem
            label={thread.starred ? "Unstar" : "Star"}
            icon={Star}
            onClick={() => {
              onToggleStarred();
              setMenuOpen(false);
            }}
          />
          <MenuItem
            label="Rename"
            icon={Pencil}
            onClick={() => {
              setEditing(true);
              setMenuOpen(false);
            }}
          />
          <MenuItem
            label="Delete"
            icon={Trash2}
            danger
            onClick={() => {
              onDelete();
              setMenuOpen(false);
            }}
          />
        </div>
      ) : null}
    </div>
  );
}

function MenuItem({
  label,
  icon: Icon,
  danger = false,
  onClick,
}: {
  label: string;
  icon: ComponentType<{ size?: number; "aria-hidden"?: boolean }>;
  danger?: boolean;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`flex h-8 w-full items-center gap-2 rounded-lg px-2 text-left hover:bg-[color:var(--surface-muted)] ${
        danger ? "text-[color:var(--danger)]" : "text-[color:var(--foreground)]"
      }`}
    >
      <Icon size={14} aria-hidden={true} />
      <span>{label}</span>
    </button>
  );
}
