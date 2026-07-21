import type { ChangeEvent, Ref } from "react";
import type { InlineNoticeViewModel } from "../../view-models/contracts";
import { InlineImportNotice } from "../app-presenters";
import { HiscoresPanel, type HiscoresPanelProps } from "../topbar/hiscores-panel";

export interface AppHeaderProps {
  activeGameRevisionLabel: string;
  hiscores: HiscoresPanelProps;
  setupImportPhase: "idle" | "reading" | "review";
  setupImportNotice: InlineNoticeViewModel | null;
  setupImportInputRef: Ref<HTMLInputElement>;
  shareCreateNotice: string | null;
  shareButtonRef: Ref<HTMLButtonElement>;
  onImportSetup(file: File): Promise<void>;
  onExportSetup(): void;
  onShareSetup(): void;
}

async function importSelectedFile(
  event: ChangeEvent<HTMLInputElement>,
  importFile: (file: File) => Promise<void>
): Promise<void> {
  const input = event.currentTarget;
  const file = input.files?.[0];
  if (!file) return;
  try {
    await importFile(file);
  } finally {
    input.value = "";
  }
}

export function AppHeader({
  activeGameRevisionLabel,
  hiscores,
  setupImportPhase,
  setupImportNotice,
  setupImportInputRef,
  shareCreateNotice,
  shareButtonRef,
  onImportSetup,
  onExportSetup,
  onShareSetup
}: AppHeaderProps) {
  const setupScopeHelpId = "combat-setup-transfer-scope";
  return (
    <>
      <a
        className="skip-link"
        href="#workbench-active-panel"
        onClick={(event) => {
          event.preventDefault();
          document.getElementById("workbench-active-panel")?.focus();
        }}
      >
        Skip to active workbench pane
      </a>
      <header className="topbar">
        <div className="topbar-brand">
          <h1>2004scape Combat Simulator</h1>
          <span
            className="game-revision-badge"
            aria-label={`Active game data: ${activeGameRevisionLabel}`}
          >
            {activeGameRevisionLabel}
          </span>
        </div>
        <HiscoresPanel {...hiscores} />
        <div className="actions">
          <p id={setupScopeHelpId} className="transfer-scope-copy">
            Combat setup files replace setup, custom-monster, cannon and Dense preferences. They are
            not full Workspace backups and do not include loot or prices.
          </p>
          <label className="file-button">
            Review combat setup file
            <input
              ref={setupImportInputRef}
              type="file"
              accept="application/json,.json"
              aria-describedby={setupScopeHelpId}
              disabled={setupImportPhase === "reading"}
              onChange={(event) => void importSelectedFile(event, onImportSetup)}
            />
          </label>
          <button type="button" aria-describedby={setupScopeHelpId} onClick={onExportSetup}>
            Export combat setup
          </button>
          <button ref={shareButtonRef} type="button" onClick={onShareSetup}>
            Share setup
          </button>
          {setupImportPhase === "reading" && (
            <div className="topbar-import-notice inline-status" role="status" aria-live="polite">
              Reviewing setup file…
            </div>
          )}
          {setupImportNotice && (
            <InlineImportNotice
              notice={setupImportNotice}
              ariaLabel="Setup transfer notice"
              className="topbar-import-notice setup-import-notice"
            />
          )}
          {shareCreateNotice && (
            <div
              className="topbar-import-notice inline-status error"
              role="alert"
              aria-label="Share setup notice"
            >
              {shareCreateNotice}
            </div>
          )}
        </div>
      </header>
    </>
  );
}
