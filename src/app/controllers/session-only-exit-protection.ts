import {
  WORKSPACE_AREA_REGISTRY,
  WORKSPACE_TRANSFER_AREA_IDS,
  createWorkspaceAreaFingerprint,
  type WorkspaceLiveState,
  type WorkspaceTransferAreaId
} from "../state/workspace-backup";

export type NonDurableReason = "saved-data-ignored" | "storage-unavailable" | "session-only-write";

export interface SessionOnlyAffectedArea {
  readonly id: WorkspaceTransferAreaId;
  readonly label: string;
  readonly reason: NonDurableReason;
}

export type SessionOnlyBackupOutcome =
  | {
      readonly status: "requested";
      readonly message: string;
    }
  | {
      readonly status: "failed";
      readonly message: string;
    };

export interface SessionOnlyExitProtectionSnapshot {
  readonly revision: number;
  readonly initialized: boolean;
  readonly armed: boolean;
  readonly sessionOnlyChangeCount: number;
  readonly affectedAreas: readonly SessionOnlyAffectedArea[];
  readonly reasons: readonly NonDurableReason[];
  readonly backupOutcome: SessionOnlyBackupOutcome | null;
  readonly sensitiveAreaOmitted: boolean;
}

interface SessionOnlyAreaState {
  baselineFingerprint: string;
  currentFingerprint: string;
  acknowledgedFingerprint: string | null;
  reason: NonDurableReason | null;
}

const REASON_ORDER: readonly NonDurableReason[] = [
  "saved-data-ignored",
  "storage-unavailable",
  "session-only-write"
];

function isGuardedAreaId(id: string): id is WorkspaceTransferAreaId {
  return (WORKSPACE_TRANSFER_AREA_IDS as readonly string[]).includes(id);
}

export class SessionOnlyExitProtectionCore {
  private readonly listeners = new Set<() => void>();
  private readonly areas = new Map<WorkspaceTransferAreaId, SessionOnlyAreaState>();
  private readonly pendingDurableIds = new Set<WorkspaceTransferAreaId>();
  private snapshot: SessionOnlyExitProtectionSnapshot = {
    revision: 0,
    initialized: false,
    armed: false,
    sessionOnlyChangeCount: 0,
    affectedAreas: [],
    reasons: [],
    backupOutcome: null,
    sensitiveAreaOmitted: false
  };

  subscribe = (listener: () => void): (() => void) => {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  };

  getSnapshot = (): SessionOnlyExitProtectionSnapshot => this.snapshot;

  private publish(overrides: Partial<SessionOnlyExitProtectionSnapshot> = {}): void {
    const changedAreas = WORKSPACE_TRANSFER_AREA_IDS.flatMap((id) => {
      const area = this.areas.get(id);
      if (!area?.reason || area.currentFingerprint === area.baselineFingerprint) return [];
      return [{ id, area }];
    });
    const affectedAreas = changedAreas.flatMap(({ id, area }) =>
      area.acknowledgedFingerprint === area.currentFingerprint
        ? []
        : [{ id, label: WORKSPACE_AREA_REGISTRY[id].label, reason: area.reason! }]
    );
    const activeReasons = new Set(affectedAreas.map((area) => area.reason));
    this.snapshot = {
      ...this.snapshot,
      revision: this.snapshot.revision + 1,
      initialized: this.areas.size === WORKSPACE_TRANSFER_AREA_IDS.length,
      armed: affectedAreas.length > 0,
      sessionOnlyChangeCount: changedAreas.length,
      affectedAreas,
      reasons: REASON_ORDER.filter((reason) => activeReasons.has(reason)),
      ...overrides
    };
    for (const listener of this.listeners) listener();
  }

  initialize = (liveState: WorkspaceLiveState, reason: NonDurableReason | null): void => {
    if (this.snapshot.initialized) return;
    for (const id of WORKSPACE_TRANSFER_AREA_IDS) {
      const fingerprint = createWorkspaceAreaFingerprint(id, liveState[id]);
      this.areas.set(id, {
        baselineFingerprint: fingerprint,
        currentFingerprint: fingerprint,
        acknowledgedFingerprint: null,
        reason
      });
    }
    this.publish();
  };

  reconcileCurrent = (
    liveState: WorkspaceLiveState,
    globalReason: NonDurableReason | null
  ): void => {
    if (!this.snapshot.initialized) return;
    let changed = false;
    for (const id of WORKSPACE_TRANSFER_AREA_IDS) {
      const area = this.areas.get(id)!;
      const currentFingerprint = createWorkspaceAreaFingerprint(id, liveState[id]);
      if (area.currentFingerprint !== currentFingerprint) changed = true;
      area.currentFingerprint = currentFingerprint;
      if (globalReason) {
        if (area.reason !== globalReason) changed = true;
        area.reason = globalReason;
      } else if (this.pendingDurableIds.has(id)) {
        changed = true;
        area.baselineFingerprint = currentFingerprint;
        area.acknowledgedFingerprint = null;
        area.reason = null;
        this.pendingDurableIds.delete(id);
      }
    }
    if (changed) this.publish();
  };

  recordDurable = (id: string, value: unknown): void => {
    if (!this.snapshot.initialized || !isGuardedAreaId(id)) return;
    const fingerprint = createWorkspaceAreaFingerprint(id, value as WorkspaceLiveState[typeof id]);
    const area = this.areas.get(id)!;
    area.baselineFingerprint = fingerprint;
    area.currentFingerprint = fingerprint;
    area.acknowledgedFingerprint = null;
    area.reason = null;
    this.pendingDurableIds.delete(id);
    this.publish();
  };

  recordDurableIds = (ids: readonly string[]): void => {
    if (!this.snapshot.initialized) return;
    for (const id of ids) {
      if (!isGuardedAreaId(id)) continue;
      const area = this.areas.get(id)!;
      area.baselineFingerprint = area.currentFingerprint;
      area.acknowledgedFingerprint = null;
      area.reason = null;
      this.pendingDurableIds.add(id);
    }
    this.publish();
  };

  recordNonDurable = (id: string, value: unknown, reason: NonDurableReason): void => {
    if (!this.snapshot.initialized || !isGuardedAreaId(id)) return;
    const area = this.areas.get(id)!;
    area.currentFingerprint = createWorkspaceAreaFingerprint(
      id,
      value as WorkspaceLiveState[typeof id]
    );
    area.reason = reason;
    this.pendingDurableIds.delete(id);
    this.publish();
  };

  recordNonDurableIds = (ids: readonly string[], reason: NonDurableReason): void => {
    if (!this.snapshot.initialized) return;
    for (const id of ids) {
      if (!isGuardedAreaId(id)) continue;
      this.areas.get(id)!.reason = reason;
      this.pendingDurableIds.delete(id);
    }
    this.publish();
  };

  acknowledgeBackup = (
    includedAreaIds: readonly WorkspaceTransferAreaId[],
    capturedLiveState: WorkspaceLiveState
  ): void => {
    if (!this.snapshot.initialized) return;
    const included = new Set(includedAreaIds);
    for (const id of WORKSPACE_TRANSFER_AREA_IDS) {
      const area = this.areas.get(id)!;
      if (
        !area.reason ||
        area.currentFingerprint === area.baselineFingerprint ||
        !included.has(id)
      ) {
        continue;
      }
      const capturedFingerprint = createWorkspaceAreaFingerprint(id, capturedLiveState[id]);
      if (capturedFingerprint === area.currentFingerprint) {
        area.acknowledgedFingerprint = area.currentFingerprint;
      }
    }
    const sensitive = this.areas.get("hiscores-last-player")!;
    const sensitiveAreaOmitted =
      sensitive.reason !== null &&
      sensitive.currentFingerprint !== sensitive.baselineFingerprint &&
      !included.has("hiscores-last-player");
    this.publish({
      backupOutcome: {
        status: "requested",
        message:
          "Workspace backup download started for the current changes. Check your browser downloads; saving the file cannot be verified."
      },
      sensitiveAreaOmitted
    });
  };

  recordBackupFailure = (): void => {
    this.publish({
      backupOutcome: {
        status: "failed",
        message: "Workspace backup download could not be started. Try again."
      }
    });
  };
}
