import { useState, type ReactNode } from "react";
import type { PriceImportNotice } from "../state/price-import";
import type { InlineNoticeViewModel } from "../view-models/contracts";
import type { DenseCompareScaleCellViewModel } from "../view-models/compare";
import { expandedCompactLabel } from "../view-models/presentation-language";

export interface PendingUndo {
  id: string;
  label: string;
  restoreLabel: string;
  createdAt: number;
  scope?: "economy-data" | "saved-setups";
  restore: () => string | void;
}

export interface DisplayMetric {
  label: string;
  value: string;
  tone?: string;
  accessibleLabel?: string;
}

export function CollapsibleSection({
  ariaLabel,
  title,
  subtitle,
  statusLabel,
  statusReady = false,
  className = "",
  defaultOpen = true,
  children
}: {
  ariaLabel: string;
  title: string;
  subtitle?: string;
  statusLabel?: string;
  statusReady?: boolean;
  className?: string;
  defaultOpen?: boolean;
  children: ReactNode;
}) {
  const [open, setOpen] = useState(defaultOpen);
  return (
    <details
      className={`collapsible-section ${className}`.trim()}
      role="region"
      aria-label={ariaLabel}
      open={open}
      onToggle={(event) => {
        if (event.currentTarget.open !== open) setOpen(event.currentTarget.open);
      }}
    >
      <summary className="section-title-row collapsible-section-summary">
        <span className="collapsible-section-title">
          <span className="collapsible-section-caret" aria-hidden="true">
            ▸
          </span>
          <span>
            <span className="collapsible-section-heading" role="heading" aria-level={2}>
              {title}
            </span>
            {subtitle ? <span className="section-subtitle">{subtitle}</span> : null}
          </span>
        </span>
        {statusLabel ? (
          <span className={`status-pill ${statusReady ? "ready" : ""}`}>{statusLabel}</span>
        ) : null}
      </summary>
      <div className="collapsible-section-body">{children}</div>
    </details>
  );
}

export function MetricList({ items }: { items: readonly DisplayMetric[] }) {
  return (
    <>
      {items.map((item) => {
        const accessibleLabel = item.accessibleLabel ?? expandedCompactLabel(item.label);
        return (
          <div className="metric" key={item.label}>
            {accessibleLabel ? (
              <span className="visually-hidden">{`${accessibleLabel}: ${item.value}`}</span>
            ) : null}
            <span aria-hidden={accessibleLabel ? true : undefined}>{item.label}</span>
            <strong aria-hidden={accessibleLabel ? true : undefined} className={item.tone}>
              {item.value}
            </strong>
          </div>
        );
      })}
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

export function ActionStatus({ message }: { message: string }) {
  if (!message) return null;
  return (
    <section
      className="action-status-strip"
      role="status"
      aria-live="polite"
      aria-label="Action status"
    >
      <span>{message}</span>
    </section>
  );
}
