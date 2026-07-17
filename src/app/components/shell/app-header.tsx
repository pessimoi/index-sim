import type { ChangeEvent, Ref } from "react";
import type { InlineNoticeViewModel } from "../../view-models/contracts";
import { InlineImportNotice } from "../app-presenters";
import { HiscoresPanel, type HiscoresPanelProps } from "../topbar/hiscores-panel";

export interface AppHeaderProps {
  hiscores: HiscoresPanelProps;
  setupImportNotice: InlineNoticeViewModel | null;
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
  hiscores,
  setupImportNotice,
  shareCreateNotice,
  shareButtonRef,
  onImportSetup,
  onExportSetup,
  onShareSetup
}: AppHeaderProps) {
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
        </div>
        <HiscoresPanel {...hiscores} />
        <div className="actions">
          <label className="file-button">
            Import setup
            <input
              type="file"
              accept="application/json,.json"
              onChange={(event) => void importSelectedFile(event, onImportSetup)}
            />
          </label>
          <button type="button" onClick={onExportSetup}>
            Export setup
          </button>
          <button ref={shareButtonRef} type="button" onClick={onShareSetup}>
            Share setup
          </button>
          {setupImportNotice && (
            <InlineImportNotice
              notice={setupImportNotice}
              ariaLabel="Setup import notice"
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
