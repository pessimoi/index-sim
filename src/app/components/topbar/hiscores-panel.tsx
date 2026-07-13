import { useEffect, useRef, type FormEvent } from "react";
import type { HiscoresResponse } from "@/domain/shared";
import type { HiscoresPreviewRow } from "../../state/hiscores";
import type { HiscoresLookupNotice } from "../../controllers/hiscores-lookup";

interface HiscoresPanelProps {
  statusLabel: "checking" | "available" | "disabled" | "unavailable";
  available: boolean;
  player: string;
  response: HiscoresResponse | null;
  busy: boolean;
  previewOpen: boolean;
  notice: HiscoresLookupNotice | null;
  previewRows: readonly HiscoresPreviewRow[];
  canApply: boolean;
  onPlayerChange: (value: string) => void;
  onLookup: () => Promise<void>;
  onPreviewOpenChange: (open: boolean) => void;
  onApply: () => void;
}

export function HiscoresPanel({
  statusLabel,
  available,
  player,
  response,
  busy,
  previewOpen,
  notice,
  previewRows,
  canApply,
  onPlayerChange,
  onLookup,
  onPreviewOpenChange,
  onApply
}: HiscoresPanelProps) {
  const detailsRef = useRef<HTMLDetailsElement>(null);
  const summaryRef = useRef<HTMLElement>(null);

  useEffect(() => {
    if (!previewOpen) return;

    const dismissOnOutsidePointer = (event: PointerEvent) => {
      if (event.target instanceof Node && !detailsRef.current?.contains(event.target)) {
        onPreviewOpenChange(false);
      }
    };
    const dismissOnEscape = (event: globalThis.KeyboardEvent) => {
      if (event.key !== "Escape") return;
      event.preventDefault();
      onPreviewOpenChange(false);
      window.requestAnimationFrame(() => summaryRef.current?.focus());
    };

    document.addEventListener("pointerdown", dismissOnOutsidePointer);
    document.addEventListener("keydown", dismissOnEscape);
    return () => {
      document.removeEventListener("pointerdown", dismissOnOutsidePointer);
      document.removeEventListener("keydown", dismissOnEscape);
    };
  }, [onPreviewOpenChange, previewOpen]);

  const submitLookup = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    void onLookup();
  };

  return (
    <section className="topbar-hiscores" aria-label="Hiscores">
      <div className="topbar-hiscores-heading">
        <strong>Player lookup</strong>
        <span className={`status-pill ${available ? "ready" : ""}`}>{statusLabel}</span>
      </div>
      <form className="hiscores-form topbar-hiscores-form" onSubmit={submitLookup}>
        <div className="field">
          <label className="visually-hidden" htmlFor="hiscores-player">
            Player
          </label>
          <input
            id="hiscores-player"
            type="text"
            autoComplete="off"
            placeholder="Player name"
            value={player}
            onChange={(event) => onPlayerChange(event.target.value)}
          />
        </div>
        <button type="submit" disabled={!available || busy}>
          {busy ? "Looking up" : "Lookup"}
        </button>
      </form>
      {notice && (
        <p
          className={`inline-status ${notice.tone}`}
          role={notice.tone === "error" ? "alert" : "status"}
        >
          {notice.message}
        </p>
      )}
      {previewRows.length > 0 && (
        <details
          className="hiscores-preview-details"
          open={previewOpen}
          ref={detailsRef}
          onToggle={(event) => onPreviewOpenChange(event.currentTarget.open)}
        >
          <summary ref={summaryRef}>Review {previewRows.length} levels</summary>
          <div className="hiscores-preview">
            {response && (
              <p className="hiscores-preview-meta">
                <span>
                  Preview for <strong>{response.normalizedPlayer || response.player}</strong>
                </span>
                <span>Source: {response.source.label}</span>
                <span>Fetched: {response.fetchedAt}</span>
              </p>
            )}
            <table aria-label="Hiscores preview">
              <thead>
                <tr>
                  <th>Skill</th>
                  <th>Current</th>
                  <th>Hiscores</th>
                </tr>
              </thead>
              <tbody>
                {previewRows.map((row) => (
                  <tr key={row.skill}>
                    <td>{row.skill}</td>
                    <td>{row.currentLevel ?? "-"}</td>
                    <td>{row.fetchedLevel}</td>
                  </tr>
                ))}
              </tbody>
            </table>
            <button type="button" disabled={!canApply} onClick={onApply}>
              Apply
            </button>
          </div>
        </details>
      )}
    </section>
  );
}
