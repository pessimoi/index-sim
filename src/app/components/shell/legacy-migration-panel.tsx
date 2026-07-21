import type { LegacySetupMigrationReport } from "../../state/legacy-storage-migration";
import {
  createLegacyMigrationViewModel,
  type LegacyMigrationViewModel
} from "../../view-models/legacy-migration";

export interface LegacyMigrationPanelProps {
  viewModel: LegacyMigrationViewModel;
  clearPending: boolean;
  onImport(): void;
  onKeep(): void;
  onRequestClear(): void;
  onConfirmClear(): void;
  onCancelClear(): void;
}

export interface LegacyMigrationReviewProps extends Omit<LegacyMigrationPanelProps, "viewModel"> {
  report: LegacySetupMigrationReport;
  hasRewriteSetup: boolean;
}

export function LegacyMigrationReview({
  report,
  hasRewriteSetup,
  ...actions
}: LegacyMigrationReviewProps) {
  return (
    <LegacyMigrationPanel
      viewModel={createLegacyMigrationViewModel({ report, hasRewriteSetup })}
      {...actions}
    />
  );
}

export function LegacyMigrationPanel({
  viewModel,
  clearPending,
  onImport,
  onKeep,
  onRequestClear,
  onConfirmClear,
  onCancelClear
}: LegacyMigrationPanelProps) {
  return (
    <section
      className={`legacy-migration-strip ${viewModel.tone}`}
      aria-label="Legacy setup migration"
    >
      <div className="section-title-row">
        <h2>Legacy data</h2>
        <span className={`status-pill ${viewModel.importReady ? "ready" : ""}`}>
          {viewModel.statusLabel}
        </span>
      </div>
      <p className="legacy-migration-copy">
        This browser has data from the old app. Import compatible data, keep it for later, or clear
        known old keys.
      </p>
      <div className="legacy-migration-summary" aria-label="Legacy data summary">
        {viewModel.summaryItems.map((item) => (
          <span key={item}>{item}</span>
        ))}
      </div>
      <div className="legacy-migration-outcomes" aria-label="Legacy migration outcome">
        {viewModel.outcomeItems.map((item) => (
          <span key={item}>{item}</span>
        ))}
      </div>
      <div className="legacy-migration-plan" aria-label="Legacy import and review plan">
        <div>
          <h3>Will import</h3>
          {viewModel.importPlan.length > 0 ? (
            <ul>
              {viewModel.importPlan.map((item) => (
                <li key={item}>{item}</li>
              ))}
            </ul>
          ) : (
            <p>No compatible legacy data can be imported by this flow.</p>
          )}
        </div>
        <div>
          <h3>Needs review or reset</h3>
          {viewModel.reviewPlan.length > 0 ? (
            <ul>
              {viewModel.reviewPlan.map((item) => (
                <li key={item}>{item}</li>
              ))}
            </ul>
          ) : (
            <p>No detected legacy data needs manual review.</p>
          )}
        </div>
      </div>
      <div className="legacy-key-table-wrap">
        <table className="legacy-key-table" aria-label="Legacy storage key review">
          <thead>
            <tr>
              <th>Key</th>
              <th>Found</th>
              <th>Policy</th>
              <th>Handling</th>
              <th>Clear</th>
            </tr>
          </thead>
          <tbody>
            {viewModel.keyRows.map((item) => (
              <tr key={item.key} className={item.found ? "found" : undefined}>
                <td>
                  <code>{item.key}</code>
                  <span>{item.label}</span>
                </td>
                <td>{item.foundLabel}</td>
                <td>{item.dispositionLabel}</td>
                <td>
                  {item.handling} {item.reason}
                </td>
                <td>{item.clearLabel}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      {viewModel.showExistingRewriteSetupNotice && (
        <p className="inline-status neutral">
          Your rewrite setup is already loaded; import replaces it only if you choose it.
        </p>
      )}
      {viewModel.showUnsupportedDataNotice && (
        <p className="inline-status neutral">
          Some legacy data cannot be imported into this rewrite setup.
        </p>
      )}
      <div className="legacy-migration-actions">
        <button type="button" disabled={!viewModel.importReady} onClick={onImport}>
          Import compatible data
        </button>
        <button type="button" onClick={onKeep}>
          Keep legacy data
        </button>
        {!clearPending ? (
          <button type="button" className="danger-button" onClick={onRequestClear}>
            Clear legacy data
          </button>
        ) : (
          <>
            <p className="inline-status error">
              Clear will remove these known legacy keys: {viewModel.clearKeyList || "none"}.
            </p>
            <button type="button" className="danger-button" onClick={onConfirmClear}>
              Confirm clear
            </button>
            <button type="button" onClick={onCancelClear}>
              Cancel
            </button>
          </>
        )}
      </div>
    </section>
  );
}
