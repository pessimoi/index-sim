import {
  trySavePersisted,
  type KeyValueStorage,
  type VersionedStorageOptions
} from "@/adapters/storage";
import {
  clearInvalidLocalState,
  clearLocalStateItem,
  createLocalStateHealthExport,
  createLocalStateHealthReport,
  localStateHealthNeedsAttention,
  type LocalStateClearResult,
  type LocalStateHealthExport,
  type LocalStateHealthItemId,
  type LocalStateHealthReport,
  type LocalStateStorageFailure
} from "../state/local-state-health";

export const LOCAL_STATE_PERSISTENCE_NOTICE =
  "Local storage is unavailable. Changes may not persist after reload.";

export type LocalStateClearPendingId = LocalStateHealthItemId | "invalid-all" | null;

export interface LocalStateRecoveryOutcome {
  clearedIds: readonly LocalStateHealthItemId[];
  failedIds: readonly LocalStateHealthItemId[];
  message: string;
}

export interface LocalStateRecoveryTransitionState {
  blockedIds: readonly LocalStateHealthItemId[];
  contextInvalidIds: readonly LocalStateHealthItemId[];
  storageFailures: readonly LocalStateStorageFailure[];
  skipNextPersistIds: readonly LocalStateHealthItemId[];
}

export interface LocalStateRecoverySnapshot {
  report: LocalStateHealthReport;
  notice: string | null;
  pendingClearId: LocalStateClearPendingId;
  blockedIds: readonly LocalStateHealthItemId[];
  visible: boolean;
}

export interface LocalStateRecoveryDependencies {
  storage: KeyValueStorage;
  storageUnavailable: boolean;
  persistenceUnavailable?: boolean;
  persistenceNotice?: string;
  onStatus: (message: string) => void;
  onDownload: (fileName: string, value: LocalStateHealthExport) => void;
  now?: () => Date;
}

function uniqueIds(ids: readonly LocalStateHealthItemId[]): readonly LocalStateHealthItemId[] {
  return [...new Set(ids)];
}

function withoutIds(
  current: readonly LocalStateHealthItemId[],
  removed: readonly LocalStateHealthItemId[]
): readonly LocalStateHealthItemId[] {
  return current.filter((id) => !removed.includes(id));
}

export function initialLocalStateRecoveryTransition(
  report: LocalStateHealthReport
): LocalStateRecoveryTransitionState {
  return {
    blockedIds: report.items.filter(localStateHealthNeedsAttention).map((item) => item.id),
    contextInvalidIds: [],
    storageFailures: [],
    skipNextPersistIds: []
  };
}

export function blockContextInvalidTransition(
  state: LocalStateRecoveryTransitionState,
  ids: readonly LocalStateHealthItemId[]
): LocalStateRecoveryTransitionState {
  return {
    ...state,
    blockedIds: uniqueIds([...state.blockedIds, ...ids]),
    contextInvalidIds: uniqueIds([...state.contextInvalidIds, ...ids])
  };
}

export function releaseClearedLocalStateTransition(
  state: LocalStateRecoveryTransitionState,
  ids: readonly LocalStateHealthItemId[]
): LocalStateRecoveryTransitionState {
  return {
    ...state,
    blockedIds: withoutIds(state.blockedIds, ids),
    contextInvalidIds: withoutIds(state.contextInvalidIds, ids),
    skipNextPersistIds: uniqueIds([...state.skipNextPersistIds, ...ids])
  };
}

export function unblockReplacedLocalStateTransition(
  state: LocalStateRecoveryTransitionState,
  ids: readonly LocalStateHealthItemId[]
): LocalStateRecoveryTransitionState {
  return {
    ...state,
    blockedIds: withoutIds(state.blockedIds, ids),
    contextInvalidIds: withoutIds(state.contextInvalidIds, ids)
  };
}

export function prepareExternalLocalStateApplyTransition(
  state: LocalStateRecoveryTransitionState,
  ids: readonly LocalStateHealthItemId[]
): LocalStateRecoveryTransitionState {
  return {
    ...state,
    skipNextPersistIds: uniqueIds([...state.skipNextPersistIds, ...ids])
  };
}

export function cancelExternalLocalStateApplyTransition(
  state: LocalStateRecoveryTransitionState,
  ids: readonly LocalStateHealthItemId[]
): LocalStateRecoveryTransitionState {
  return {
    ...state,
    skipNextPersistIds: withoutIds(state.skipNextPersistIds, ids)
  };
}

export function consumeLocalStatePersistSkip(
  state: LocalStateRecoveryTransitionState,
  id: LocalStateHealthItemId
): { state: LocalStateRecoveryTransitionState; skip: boolean } {
  if (state.skipNextPersistIds.includes(id)) {
    return {
      state: {
        ...state,
        skipNextPersistIds: withoutIds(state.skipNextPersistIds, [id])
      },
      skip: true
    };
  }
  return { state, skip: state.blockedIds.includes(id) };
}

export function upsertLocalStateStorageFailure(
  failures: readonly LocalStateStorageFailure[],
  failure: LocalStateStorageFailure
): readonly LocalStateStorageFailure[] {
  return [...failures.filter((candidate) => candidate.id !== failure.id), failure];
}

export function removeLocalStateStorageFailures(
  failures: readonly LocalStateStorageFailure[],
  ids: readonly LocalStateHealthItemId[]
): readonly LocalStateStorageFailure[] {
  return failures.filter((failure) => !ids.includes(failure.id));
}

export function localStateHealthExportFileName(report: LocalStateHealthReport): string {
  const safeTimestamp = report.generatedAt.replace(/[^0-9A-Za-z._-]+/g, "-");
  return `index-sim-local-state-health-${safeTimestamp}.json`;
}

function formatCount(value: number): string {
  return value.toLocaleString("en-US", {
    maximumFractionDigits: 0,
    minimumFractionDigits: 0
  });
}

function outcomeFromResult(
  result: LocalStateClearResult,
  message: string
): LocalStateRecoveryOutcome {
  return {
    clearedIds: result.clearedItems.map((item) => item.id),
    failedIds: result.failedItems.map((failed) => failed.item.id),
    message
  };
}

export class LocalStateRecoveryControllerCore {
  private readonly listeners = new Set<() => void>();
  private readonly now: () => Date;
  private transition: LocalStateRecoveryTransitionState;
  private snapshot: LocalStateRecoverySnapshot;

  constructor(private readonly dependencies: LocalStateRecoveryDependencies) {
    this.now = dependencies.now ?? (() => new Date());
    const report = createLocalStateHealthReport(dependencies.storage, this.now(), {
      storageUnavailable: dependencies.storageUnavailable
    });
    this.transition = initialLocalStateRecoveryTransition(report);
    const notice = this.persistenceIsUnavailable() ? this.persistenceNotice() : null;
    this.snapshot = {
      report,
      notice,
      pendingClearId: null,
      blockedIds: this.transition.blockedIds,
      visible: report.hasAttention || notice != null
    };
  }

  private persistenceIsUnavailable(): boolean {
    return (
      this.dependencies.storageUnavailable || this.dependencies.persistenceUnavailable === true
    );
  }

  private persistenceNotice(): string {
    return this.dependencies.persistenceNotice ?? LOCAL_STATE_PERSISTENCE_NOTICE;
  }

  subscribe = (listener: () => void): (() => void) => {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  };

  getSnapshot = (): LocalStateRecoverySnapshot => this.snapshot;

  private publish(report: LocalStateHealthReport = this.snapshot.report): void {
    this.snapshot = {
      ...this.snapshot,
      report,
      blockedIds: this.transition.blockedIds,
      visible: report.hasAttention || this.snapshot.notice != null
    };
    for (const listener of this.listeners) listener();
  }

  private currentReport(): LocalStateHealthReport {
    return createLocalStateHealthReport(this.dependencies.storage, this.now(), {
      storageUnavailable: this.dependencies.storageUnavailable,
      storageFailures: this.transition.storageFailures,
      contextInvalidItemIds: this.transition.contextInvalidIds
    });
  }

  refresh = (): LocalStateHealthReport => {
    const report = this.currentReport();
    this.publish(report);
    return report;
  };

  shouldSkipPersist = (id: LocalStateHealthItemId): boolean => {
    const result = consumeLocalStatePersistSkip(this.transition, id);
    this.transition = result.state;
    return result.skip;
  };

  persist = <T>(
    id: LocalStateHealthItemId,
    options: VersionedStorageOptions<T>,
    value: T
  ): boolean => {
    const result = trySavePersisted(options, value);
    if (result.status === "saved") {
      if (this.persistenceIsUnavailable()) {
        this.markPersistenceUnavailable();
        return false;
      }
      this.clearStorageFailures([id]);
      return true;
    }
    this.recordStorageFailure(id, result.reason);
    return false;
  };

  recordStorageFailure = (
    id: LocalStateHealthItemId,
    reason: LocalStateStorageFailure["reason"]
  ): void => {
    this.transition = {
      ...this.transition,
      storageFailures: upsertLocalStateStorageFailure(this.transition.storageFailures, {
        id,
        reason
      })
    };
    this.snapshot = { ...this.snapshot, notice: this.persistenceNotice() };
    this.dependencies.onStatus(this.persistenceNotice());
    this.refresh();
  };

  clearStorageFailures = (ids: readonly LocalStateHealthItemId[]): void => {
    if (ids.length === 0) return;
    const next = removeLocalStateStorageFailures(this.transition.storageFailures, ids);
    if (next.length === this.transition.storageFailures.length) return;
    this.transition = { ...this.transition, storageFailures: next };
    this.refresh();
  };

  markPersistenceUnavailable = (): void => {
    const notice = this.persistenceNotice();
    const shouldAnnounce = this.snapshot.notice !== notice;
    this.snapshot = { ...this.snapshot, notice };
    if (shouldAnnounce) this.dependencies.onStatus(notice);
    this.refresh();
  };

  blockContextInvalid = (ids: readonly LocalStateHealthItemId[], notice: string | null): void => {
    if (ids.length === 0 && notice == null) return;
    this.transition = blockContextInvalidTransition(this.transition, ids);
    if (notice != null) this.snapshot = { ...this.snapshot, notice };
    this.refresh();
  };

  unblockReplaced = (ids: readonly LocalStateHealthItemId[]): void => {
    if (ids.length === 0) return;
    this.transition = unblockReplacedLocalStateTransition(this.transition, ids);
    this.refresh();
  };

  prepareExternalApply = (ids: readonly LocalStateHealthItemId[]): void => {
    if (ids.length === 0) return;
    this.transition = prepareExternalLocalStateApplyTransition(this.transition, uniqueIds(ids));
  };

  cancelExternalApply = (ids: readonly LocalStateHealthItemId[]): void => {
    if (ids.length === 0) return;
    this.transition = cancelExternalLocalStateApplyTransition(this.transition, uniqueIds(ids));
  };

  completeExternalApply = (ids: readonly LocalStateHealthItemId[]): void => {
    const selectedIds = uniqueIds(ids);
    if (selectedIds.length === 0) return;
    this.transition = unblockReplacedLocalStateTransition(
      {
        ...this.transition,
        storageFailures: removeLocalStateStorageFailures(
          this.transition.storageFailures,
          selectedIds
        )
      },
      selectedIds
    );
    this.refresh();
  };

  completeExternalUndo = (ids: readonly LocalStateHealthItemId[]): void => {
    const selectedIds = uniqueIds(ids);
    if (selectedIds.length === 0) return;
    this.transition = {
      ...this.transition,
      blockedIds: withoutIds(this.transition.blockedIds, selectedIds),
      contextInvalidIds: withoutIds(this.transition.contextInvalidIds, selectedIds),
      storageFailures: removeLocalStateStorageFailures(this.transition.storageFailures, selectedIds)
    };
    const report = this.currentReport();
    const restoredAttentionIds = report.items
      .filter((item) => selectedIds.includes(item.id) && localStateHealthNeedsAttention(item))
      .map((item) => item.id);
    this.transition = {
      ...this.transition,
      blockedIds: uniqueIds([...this.transition.blockedIds, ...restoredAttentionIds])
    };
    this.publish(report);
  };

  recordExternalApplyFailure = (
    failures: readonly LocalStateStorageFailure[],
    blockPersistence = false
  ): void => {
    if (failures.length === 0) return;
    let nextFailures = this.transition.storageFailures;
    const failedIds: LocalStateHealthItemId[] = [];
    for (const failure of failures) {
      nextFailures = upsertLocalStateStorageFailure(nextFailures, failure);
      failedIds.push(failure.id);
    }
    this.transition = cancelExternalLocalStateApplyTransition(
      {
        ...this.transition,
        blockedIds: blockPersistence
          ? uniqueIds([...this.transition.blockedIds, ...failedIds])
          : this.transition.blockedIds,
        storageFailures: nextFailures
      },
      failedIds
    );
    const notice = this.persistenceNotice();
    this.snapshot = { ...this.snapshot, notice };
    this.dependencies.onStatus(notice);
    this.refresh();
  };

  beginClear = (id: Exclude<LocalStateClearPendingId, null>): void => {
    this.snapshot = { ...this.snapshot, pendingClearId: id };
    this.publish();
  };

  cancelClear = (): void => {
    this.snapshot = { ...this.snapshot, pendingClearId: null };
    this.publish();
  };

  private applyClearResult(result: LocalStateClearResult): void {
    const clearedIds = result.clearedItems.map((item) => item.id);
    let failures = removeLocalStateStorageFailures(this.transition.storageFailures, clearedIds);
    for (const failed of result.failedItems) {
      failures = upsertLocalStateStorageFailure(failures, {
        id: failed.item.id,
        reason: failed.reason
      });
    }
    this.transition = releaseClearedLocalStateTransition(
      { ...this.transition, storageFailures: failures },
      clearedIds
    );
  }

  confirmClearItem = (id: LocalStateHealthItemId): LocalStateRecoveryOutcome => {
    const item = this.snapshot.report.items.find((candidate) => candidate.id === id);
    const label = item?.label ?? id;
    const result = clearLocalStateItem(this.dependencies.storage, id);
    this.applyClearResult(result);
    const message =
      result.failedItems.length > 0
        ? `Could not clear ${label}. Local storage is unavailable.`
        : result.clearedItems.length > 0
          ? `Cleared ${label}`
          : `${label} had no local data to clear`;
    this.snapshot = { ...this.snapshot, notice: message, pendingClearId: null };
    this.dependencies.onStatus(message);
    this.refresh();
    return outcomeFromResult(result, message);
  };

  confirmClearInvalid = (): LocalStateRecoveryOutcome => {
    const result = clearInvalidLocalState(this.dependencies.storage, this.snapshot.report);
    this.applyClearResult(result);
    const message =
      result.failedItems.length > 0
        ? `Could not clear ${formatCount(result.failedItems.length)} local state keys. Local storage is unavailable.`
        : result.clearedItems.length > 0
          ? `Cleared ${formatCount(result.clearedItems.length)} invalid local state keys`
          : "No invalid local state keys to clear";
    this.snapshot = { ...this.snapshot, notice: message, pendingClearId: null };
    this.dependencies.onStatus(message);
    this.refresh();
    return outcomeFromResult(result, message);
  };

  exportReport = (): void => {
    const report = this.currentReport();
    const message = "Exported local state recovery report";
    this.dependencies.onDownload(
      localStateHealthExportFileName(report),
      createLocalStateHealthExport(report)
    );
    this.snapshot = { ...this.snapshot, report, notice: message, pendingClearId: null };
    this.dependencies.onStatus(message);
    this.publish(report);
  };
}
