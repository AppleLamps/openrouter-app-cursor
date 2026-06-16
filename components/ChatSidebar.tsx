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
          "modal-safe fixed inset-y-0 left-0 z-50 flex w-[86vw] max-w-[18rem] flex-col border-r border-(--border) bg-(--sidebar) transition-transform duration-200 lg:static lg:z-auto lg:h-full lg:w-70 lg:shrink-0 lg:translate-x-0 lg:p-0",
          mobileOpen
            ? "visible translate-x-0 shadow-2xl"
            : "invisible pointer-events-none -translate-x-full lg:pointer-events-auto lg:visible lg:shadow-none",
          collapsed ? "lg:w-19" : "",
        ].join(" ")}
      >
        <div className="flex items-center justify-between gap-2 px-3 pb-3 lg:pt-3">
          <button
            type="button"
            onClick={() => onComingSoon("Home")}
            className="inline-flex min-w-0 items-center gap-2 rounded-md px-1 py-1 text-left text-lg font-semibold text-(--foreground)"
          >
            <Sparkles size={19} className="text-(--brand)" aria-hidden="true" />
            {!collapsed ? <span className="truncate font-serif text-[1.35rem]">Lamps</span> : null}
          </button>
          <div className="ml-auto flex items-center gap-1">
            <button
              type="button"
              title={collapsed ? "Expand sidebar" : "Collapse sidebar"}
              aria-label={collapsed ? "Expand sidebar" : "Collapse sidebar"}
              onClick={onToggleCollapsed}
              className="hidden h-8 w-8 place-items-center rounded-md text-(--muted) hover:bg-(--surface-muted) lg:grid"
            >
              {collapsed ? <PanelLeftOpen size={16} aria-hidden="true" /> : <PanelLeftClose size={16} aria-hidden="true" />}
            </button>
            <button
              type="button"
              title="Close sidebar"
              aria-label="Close sidebar"
              onClick={onCloseMobile}
              className="grid h-9 w-9 place-items-center rounded-md text-(--muted) hover:bg-(--surface-muted) lg:hidden"
            >
              <X size={17} aria-hidden="true" />
            </button>
          </div>
        </div>

        {!collapsed ? (
          <div className="px-3">
            <label className="mb-2 flex h-9 items-center gap-2 rounded-md border border-transparent bg-(--surface)/75 px-2 text-sm text-(--muted) focus-within:border-(--border-strong)">
              <Search size={15} aria-hidden="true" />
              <span className="sr-only">Search chats</span>
              <input
                value={query}
                onChange={(event) => setQuery(event.target.value)}
                placeholder="Search chats"
                className="min-w-0 flex-1 bg-transparent text-(--foreground) outline-none placeholder:text-(--muted)"
              />
            </label>

            <button
              type="button"
              onClick={onNewThread}
              className="mb-3 flex h-10 w-full items-center rounded-md px-2 text-sm text-(--foreground) hover:bg-(--surface)"
            >
              <span className="inline-flex items-center gap-2">
                <span className="grid h-5 w-5 place-items-center rounded-full bg-(--surface-muted)">
                  <Plus size={14} aria-hidden="true" />
                </span>
                New chat
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
                    ? "bg-(--surface-muted) text-(--foreground)"
                    : "text-(--muted) hover:bg-(--surface)"
                }`}
              >
                <MessageCircle size={17} aria-hidden="true" />
              </button>
            ))}
          </div>
        )}

        {!collapsed ? (
          <div className="mt-auto border-t border-(--border) p-3">
            <button
              type="button"
              onClick={() => onComingSoon("Account")}
              className="flex w-full items-center gap-2 rounded-md p-1.5 text-left hover:bg-(--surface)"
            >
              <span className="grid h-9 w-9 shrink-0 place-items-center rounded-full bg-(--foreground) text-xs font-semibold text-(--background)">
                AL
              </span>
              <span className="min-w-0 flex-1">
                <span className="block truncate text-sm font-medium">Apple Lamps</span>
                <span className="block truncate text-xs text-(--muted)">Max plan</span>
              </span>
              <ChevronDown size={15} className="text-(--muted)" aria-hidden="true" />
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
      className={`flex h-9 w-full items-center gap-2 rounded-md px-2 text-left transition ${
        active ? "bg-(--surface) text-(--foreground)" : "text-(--foreground) hover:bg-(--surface)"
      }`}
    >
      <Icon size={16} className="shrink-0 text-(--muted)" aria-hidden={true} />
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
      className="grid h-10 w-full place-items-center rounded-md text-(--muted) hover:bg-(--surface)"
    >
      <Icon size={17} aria-hidden={true} />
    </button>
  );
}

function SectionHeading({ label }: { label: string }) {
  return (
    <div className="mb-2 flex items-center justify-between px-2 text-xs font-medium text-(--muted)">
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
          <p className="px-2 py-1 text-xs text-(--muted)">{emptyLabel}</p>
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
      className={`group relative rounded-md transition ${
        active ? "bg-(--surface-muted)" : "hover:bg-(--surface)"
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
            className="min-w-0 flex-1 rounded-md border border-(--border) bg-(--surface) px-2 py-1 text-sm outline-none"
          />
          <button
            type="button"
            title="Save chat name"
            aria-label="Save chat name"
            onMouseDown={(event) => event.preventDefault()}
            onClick={commitRename}
            className="grid h-7 w-7 place-items-center rounded-md text-(--brand) hover:bg-(--surface)"
          >
            <Check size={14} aria-hidden="true" />
          </button>
        </div>
      ) : (
        <button type="button" onClick={onSelect} className="flex h-9 w-full items-center gap-2 px-2 pr-9 text-left">
          <span className="min-w-0 flex-1 truncate text-sm text-(--foreground)">{thread.title}</span>
        </button>
      )}

      {!editing ? (
        <button
          type="button"
          title="More options"
          aria-label={`More options for ${thread.title}`}
          onClick={() => setMenuOpen((current) => !current)}
          className={`absolute right-1 top-1 grid h-7 w-7 place-items-center rounded-md text-(--muted) hover:bg-(--surface) ${
            menuOpen ? "opacity-100" : "opacity-0 group-hover:opacity-100 focus:opacity-100"
          }`}
        >
          <MoreHorizontal size={16} aria-hidden="true" />
        </button>
      ) : null}

      {menuOpen ? (
        <div className="absolute right-1 top-8 z-20 w-40 rounded-lg border border-(--border) bg-(--surface-raised) p-1 text-sm shadow-[0_10px_30px_rgba(31,31,30,0.12)]">
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
      className={`flex h-8 w-full items-center gap-2 rounded-md px-2 text-left hover:bg-(--surface-muted) ${
        danger ? "text-(--danger)" : "text-(--foreground)"
      }`}
    >
      <Icon size={14} aria-hidden={true} />
      <span>{label}</span>
    </button>
  );
}
