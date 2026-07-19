import { useEffect, useId, useRef } from "react";
import type { CombatStyle } from "@/domain/shared";
import type { PriceImportNotice } from "../state/price-import";
import type { InlineNoticeViewModel } from "../view-models/contracts";
import { formatNumber } from "../view-models/formatting";
import type { DenseCompareScaleCellViewModel } from "../view-models/compare";

export interface ShareSetupDialogState {
  url: string;
  targetLabel: string;
  combatStyle: CombatStyle;
  cannonEnabled: boolean;
  lootPreferenceCount: number;
  revisionLabel: string;
  copyStatus: "idle" | "copied" | "failed";
}

export interface PendingUndo {
  id: string;
  label: string;
  restoreLabel: string;
  createdAt: number;
  restore: () => string | void;
}

export interface DisplayMetric {
  label: string;
  value: string;
  tone?: string;
}

export function MetricList({ items }: { items: readonly DisplayMetric[] }) {
  return (
    <>
      {items.map((item) => (
        <div className="metric" key={item.label}>
          <span>{item.label}</span>
          <strong className={item.tone}>{item.value}</strong>
        </div>
      ))}
    </>
  );
}

export function DenseScaleCell({
  value,
  scale
}: {
  value: string;
  scale: DenseCompareScaleCellViewModel;
}) {
  return (
    <span className={`dense-scale-cell dense-scale-${scale.tone}`} aria-label={scale.ariaLabel}>
      <span className="dense-scale-track" aria-hidden="true">
        <span style={{ width: `${scale.widthPercent}%` }} />
      </span>
      <span className="dense-scale-number">{value}</span>
    </span>
  );
}

export function InlineImportNotice({
  notice,
  ariaLabel,
  className = ""
}: {
  notice: InlineNoticeViewModel | PriceImportNotice;
  ariaLabel: string;
  className?: string;
}) {
  return (
    <div
      className={`${className} inline-status ${notice.tone}`.trim()}
      role={notice.tone === "error" ? "alert" : "status"}
      aria-label={ariaLabel}
    >
      <span>{notice.message}</span>
      {"code" in notice && notice.code ? (
        <span className="import-error-code">Code {notice.code}</span>
      ) : null}
      {notice.details?.length ? (
        <ul>
          {notice.details.map((detail) => (
            <li key={detail}>{detail}</li>
          ))}
        </ul>
      ) : null}
    </div>
  );
}

export function ShareSetupDialog({
  state,
  onCopy,
  onClose
}: {
  state: ShareSetupDialogState;
  onCopy: () => void;
  onClose: () => void;
}) {
  const dialogRef = useRef<HTMLDialogElement>(null);
  const urlFieldRef = useRef<HTMLInputElement>(null);
  const titleId = useId();
  const urlId = useId();

  useEffect(() => {
    const dialog = dialogRef.current;
    if (!dialog) return;
    if (!dialog.open) dialog.showModal();
    urlFieldRef.current?.focus();
    return () => {
      if (dialog.open) dialog.close();
    };
  }, []);

  return (
    <dialog
      ref={dialogRef}
      className="share-setup-dialog"
      aria-labelledby={titleId}
      onCancel={(event) => {
        event.preventDefault();
        onClose();
      }}
    >
      <div className="share-setup-dialog-header">
        <div>
          <span className="eyebrow">Portable setup</span>
          <h2 id={titleId}>Share setup</h2>
        </div>
        <button type="button" onClick={onClose} aria-label="Close share setup dialog">
          Close
        </button>
      </div>
      <p>
        {state.targetLabel} · {state.combatStyle} · Player levels included
      </p>
      <div className="share-setup-summary" aria-label="Shared setup contents">
        <span>Cannon {state.cannonEnabled ? "included" : "off"}</span>
        <span>{formatNumber(state.lootPreferenceCount)} loot choices</span>
        <span>{state.revisionLabel}</span>
        <span>Uses recipient prices</span>
      </div>
      <div className="field share-setup-url-field">
        <label htmlFor={urlId}>Setup link</label>
        <input
          ref={urlFieldRef}
          id={urlId}
          type="text"
          readOnly
          value={state.url}
          onFocus={(event) => event.currentTarget.select()}
        />
      </div>
      <p className="share-setup-privacy-note">
        Anyone with this link can read the included levels and setup choices. The link is encoded,
        not encrypted.
      </p>
      <div className="share-setup-dialog-actions">
        <button type="button" onClick={onCopy}>
          Copy
        </button>
        <button type="button" onClick={onClose}>
          Done
        </button>
      </div>
      {state.copyStatus !== "idle" ? (
        <p
          className={`inline-status ${state.copyStatus === "copied" ? "success" : "error"}`}
          role="status"
        >
          {state.copyStatus === "copied"
            ? "Link copied"
            : "Clipboard unavailable. Select the link and copy it manually."}
        </p>
      ) : null}
    </dialog>
  );
}

export function PendingUndoStatus({
  pendingUndo,
  onUndo
}: {
  pendingUndo: PendingUndo | null;
  onUndo: () => void;
}) {
  if (!pendingUndo) return null;
  return (
    <section
      className="pending-undo-strip"
      role="status"
      aria-live="polite"
      aria-label="Local state undo"
    >
      <span>{pendingUndo.label}</span>
      <button type="button" onClick={onUndo}>
        Undo
      </button>
    </section>
  );
}
