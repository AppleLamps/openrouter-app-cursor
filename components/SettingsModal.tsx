"use client";

import { useEffect, useState } from "react";
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
};

type SettingsSectionId = "setup" | "model" | "tools" | "data";

const SETTINGS_SECTIONS: { id: SettingsSectionId; label: string; description: string }[] = [
  { id: "setup", label: "Setup", description: "API key" },
  { id: "model", label: "Model", description: "Behavior" },
  { id: "tools", label: "Tools", description: "Features" },
  { id: "data", label: "Data", description: "Reset" },
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
}: SettingsModalProps) {
  const [activeSection, setActiveSection] = useState<SettingsSectionId>("setup");

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

    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") {
        onClose();
      }
    }

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [onClose, open]);

  if (!open) {
    return null;
  }

  return (
    <div
      className="modal-safe fixed inset-0 z-[70] flex items-end bg-black/60 backdrop-blur-sm sm:items-center sm:justify-center"
      role="dialog"
      aria-modal="true"
      aria-labelledby="settings-title"
      onMouseDown={(event) => {
        if (event.target === event.currentTarget) {
          onClose();
        }
      }}
    >
      <section className="flex h-[min(88dvh,52rem)] max-h-full w-full flex-col overflow-hidden rounded-t-3xl border border-[color:var(--border)] bg-[color:var(--surface)] shadow-2xl sm:h-[min(84dvh,52rem)] sm:max-w-3xl sm:rounded-3xl">
        <header className="shrink-0 border-b border-[color:var(--border)] px-4 py-3">
          <div className="flex items-center justify-between gap-3">
            <div className="min-w-0">
              <h2 id="settings-title" className="text-base font-semibold">
                Settings
              </h2>
              <p className="truncate text-xs text-[color:var(--muted)]">{apiStatusText}</p>
            </div>
            <button
              type="button"
              title="Close"
              aria-label="Close"
              onClick={onClose}
              className="grid min-h-11 min-w-11 place-items-center rounded-full bg-[color:var(--surface-muted)] text-[color:var(--muted)] transition active:scale-95"
            >
              <X size={18} aria-hidden="true" />
            </button>
          </div>
        </header>

        <nav className="shrink-0 border-b border-[color:var(--border)] bg-[color:var(--surface)] px-4 py-3" aria-label="Settings sections">
          <div className="scroll-area flex gap-2 overflow-x-auto sm:grid sm:grid-cols-4">
            {SETTINGS_SECTIONS.map((section) => {
              const active = activeSection === section.id;

              return (
                <button
                  key={section.id}
                  type="button"
                  aria-current={active ? "page" : undefined}
                  onClick={() => setActiveSection(section.id)}
                  className={`min-h-11 min-w-[5.75rem] rounded-xl px-3 py-2 text-left transition active:scale-[0.98] sm:min-w-0 ${
                    active
                      ? "bg-[color:var(--accent-strong)] text-[color:var(--background)]"
                      : "bg-[color:var(--surface-muted)] text-[color:var(--foreground)]"
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
            <DataSettingsSection onClearChat={onClearChat} onResetSettings={onResetSettings} />
          ) : null}
        </div>
      </section>
    </div>
  );
}
