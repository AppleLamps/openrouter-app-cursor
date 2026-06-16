"use client";

import { useEffect, useRef, useState } from "react";
import { X } from "lucide-react";
import {
  DataSettingsSection,
  ModelSettingsSection,
  SetupSettingsSection,
  ToolsSettingsSection,
} from "@/components/settings/SettingsSections";
import type { ApiStatus, ChatSettings } from "@/lib/types";

type SettingsModalProps = {
  open: boolean;
  settings: ChatSettings;
  apiStatus: ApiStatus;
  apiStatusText: string;
  onClose: () => void;
  onValidateApiKey: (apiKey?: string) => void;
  onSettingsChange: (settings: ChatSettings) => void;
  onClearChat: () => void;
  onResetSettings: () => void;
  onExportAllThreads: () => void;
  onExportCurrentThread: () => void;
  onImportThreads: (file: File) => void;
  importNotice?: string;
  canExportCurrentThread: boolean;
};

type SettingsSectionId = "setup" | "model" | "tools" | "data";

const SETTINGS_SECTIONS: { id: SettingsSectionId; label: string; description: string }[] = [
  { id: "setup", label: "Setup", description: "API key" },
  { id: "model", label: "Model", description: "Behavior" },
  { id: "tools", label: "Tools", description: "Features" },
  { id: "data", label: "Data", description: "Backup" },
];

export function SettingsModal({
  open,
  settings,
  apiStatus,
  apiStatusText,
  onClose,
  onValidateApiKey,
  onSettingsChange,
  onClearChat,
  onResetSettings,
  onExportAllThreads,
  onExportCurrentThread,
  onImportThreads,
  importNotice,
  canExportCurrentThread,
}: SettingsModalProps) {
  const [activeSection, setActiveSection] = useState<SettingsSectionId>("setup");
  const panelRef = useRef<HTMLElement>(null);
  const previousFocusRef = useRef<HTMLElement | null>(null);

  useEffect(() => {
    if (!open) {
      return;
    }

    setActiveSection("setup");
  }, [open]);

  useEffect(() => {
    if (!open) {
      return;
    }

    previousFocusRef.current =
      document.activeElement instanceof HTMLElement ? document.activeElement : null;

    const focusable = getFocusableElements(panelRef.current);
    focusable[0]?.focus();

    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") {
        onClose();
        return;
      }

      if (event.key !== "Tab") {
        return;
      }

      const panel = panelRef.current;
      if (!panel) {
        return;
      }

      const elements = getFocusableElements(panel);
      if (elements.length === 0) {
        return;
      }

      const first = elements[0];
      const last = elements[elements.length - 1];
      const active = document.activeElement;

      if (event.shiftKey) {
        if (active === first || !panel.contains(active)) {
          event.preventDefault();
          last.focus();
        }
        return;
      }

      if (active === last || !panel.contains(active)) {
        event.preventDefault();
        first.focus();
      }
    }

    window.addEventListener("keydown", handleKeyDown);

    return () => {
      window.removeEventListener("keydown", handleKeyDown);
      previousFocusRef.current?.focus();
    };
  }, [onClose, open]);

  if (!open) {
    return null;
  }

  return (
    <div
      className="modal-safe fixed inset-0 z-70 flex items-end bg-black/45 backdrop-blur-sm sm:items-center sm:justify-center"
      role="dialog"
      aria-modal="true"
      aria-labelledby="settings-title"
      onMouseDown={(event) => {
        if (event.target === event.currentTarget) {
          onClose();
        }
      }}
    >
      <section
        ref={panelRef}
        className="flex h-[min(88dvh,52rem)] max-h-full w-full flex-col overflow-hidden rounded-t-2xl border border-(--border) bg-(--surface) shadow-[0_24px_80px_rgba(31,31,30,0.18)] sm:h-[min(84dvh,52rem)] sm:max-w-3xl sm:rounded-2xl"
      >
        <header className="shrink-0 border-b border-(--border) px-4 py-3">
          <div className="flex items-center justify-between gap-3">
            <div className="min-w-0">
              <h2 id="settings-title" className="text-base font-semibold">
                Settings
              </h2>
              <p className="truncate text-xs text-(--muted)">{apiStatusText}</p>
            </div>
            <button
              type="button"
              title="Close"
              aria-label="Close"
              onClick={onClose}
              className="grid min-h-10 min-w-10 place-items-center rounded-md bg-(--surface-muted) text-(--muted) transition active:scale-95"
            >
              <X size={18} aria-hidden="true" />
            </button>
          </div>
        </header>

        <nav className="shrink-0 border-b border-(--border) bg-(--surface) px-4 py-3" aria-label="Settings sections">
          <div className="scroll-area flex gap-2 overflow-x-auto sm:grid sm:grid-cols-4">
            {SETTINGS_SECTIONS.map((section) => {
              const active = activeSection === section.id;

              return (
                <button
                  key={section.id}
                  type="button"
                  aria-current={active ? "page" : undefined}
                  onClick={() => setActiveSection(section.id)}
                  className={`min-h-11 min-w-23 rounded-md px-3 py-2 text-left transition active:scale-[0.98] sm:min-w-0 ${
                    active
                      ? "bg-(--accent-strong) text-(--background)"
                      : "bg-(--surface-muted) text-(--foreground)"
                  }`}
                >
                  <span className="block text-sm font-medium leading-5">{section.label}</span>
                  <span className="block text-xs opacity-75">{section.description}</span>
                </button>
              );
            })}
          </div>
        </nav>

        <div className="scroll-area min-h-0 flex-1 overflow-y-auto px-4 py-4">
          {activeSection === "setup" ? (
            <SetupSettingsSection
              settings={settings}
              apiStatus={apiStatus}
              onValidateApiKey={onValidateApiKey}
              onSettingsChange={onSettingsChange}
            />
          ) : null}

          {activeSection === "model" ? (
            <ModelSettingsSection settings={settings} onSettingsChange={onSettingsChange} />
          ) : null}

          {activeSection === "tools" ? (
            <ToolsSettingsSection settings={settings} onSettingsChange={onSettingsChange} />
          ) : null}

          {activeSection === "data" ? (
            <DataSettingsSection
              onClearChat={onClearChat}
              onResetSettings={onResetSettings}
              onExportAllThreads={onExportAllThreads}
              onExportCurrentThread={onExportCurrentThread}
              onImportThreads={onImportThreads}
              importNotice={importNotice}
              canExportCurrentThread={canExportCurrentThread}
            />
          ) : null}
        </div>
      </section>
    </div>
  );
}

function getFocusableElements(container: HTMLElement | null) {
  if (!container) {
    return [] as HTMLElement[];
  }

  return Array.from(
    container.querySelectorAll<HTMLElement>(
      'a[href], button:not([disabled]), textarea:not([disabled]), input:not([disabled]), select:not([disabled]), [tabindex]:not([tabindex="-1"])',
    ),
  ).filter((element) => !element.hasAttribute("disabled") && element.tabIndex !== -1);
}
