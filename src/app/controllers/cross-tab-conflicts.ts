import { createMemoryStorage, type KeyValueStorage } from "@/adapters/storage";
import {
  createLocalStateHealthReport,
  LOCAL_STATE_HEALTH_DESCRIPTORS,
  type LocalStateHealthItemId
} from "../state/local-state-health";
import { executeLocalStateBatch, type LocalStateBatchOperation } from "./local-state-batch";

export type CrossTabAreaId = Exclude<LocalStateHealthItemId, "legacy-migration-dismissed">;
export type CrossTabExternalStatus = "valid" | "missing" | "unsupported" | "invalid";
export type CrossTabConflictStatus = "clear" | "conflicted" | "resolving";

export interface CrossTabAreaRegistration {
  readonly id: CrossTabAreaId;
  readonly label: string;
  readonly key: string;
  readonly persistence: "autosave" | "transaction";
}

type CrossTabAreaRegistry = { [K in CrossTabAreaId]: CrossTabAreaRegistration & { id: K } };

function healthDescriptor(id: CrossTabAreaId) {
  const descriptor = LOCAL_STATE_HEALTH_DESCRIPTORS.find((candidate) => candidate.id === id);
  if (!descriptor) throw new Error(`Missing local-state health descriptor for ${id}`);
  return descriptor;
}

function registration<K extends CrossTabAreaId>(
  id: K,
  persistence: CrossTabAreaRegistration["persistence"]
): CrossTabAreaRegistration & { id: K } {
  const descriptor = healthDescriptor(id);
  return { id, label: descriptor.label, key: descriptor.key, persistence };
}

export const CROSS_TAB_AREA_REGISTRY = {
  "rewrite-setup": registration("rewrite-setup", "autosave"),
  "planner-ui": registration("planner-ui", "autosave"),
  "loot-prefs": registration("loot-prefs", "autosave"),
  "loot-settings": registration("loot-settings", "autosave"),
  "hidden-gear-tiers": registration("hidden-gear-tiers", "autosave"),
  "duel-snapshots": registration("duel-snapshots", "autosave"),
  "price-history": registration("price-history", "autosave"),
  "selected-price-set": registration("selected-price-set", "transaction"),
  "manual-price-overrides": registration("manual-price-overrides", "transaction"),
  "hiscores-last-player": registration("hiscores-last-player", "transaction")
} as const satisfies CrossTabAreaRegistry;

export const CROSS_TAB_AREA_IDS = Object.keys(CROSS_TAB_AREA_REGISTRY) as CrossTabAreaId[];

const CROSS_TAB_REGISTRATION_BY_KEY = new Map(
  CROSS_TAB_AREA_IDS.map((id) => {
    const item = CROSS_TAB_AREA_REGISTRY[id];
    return [item.key, item] as const;
  })
);

export interface CrossTabAreaConflict {
  readonly id: CrossTabAreaId;
  readonly label: string;
  readonly firstDetectedRevision: number;
  readonly latestDetectedRevision: number;
  readonly externalStatus: CrossTabExternalStatus;
}

export interface CrossTabConflictNotice {
  readonly affectedCount: number;
  readonly revision: number;
}

export interface CrossTabConflictSnapshot {
  readonly status: CrossTabConflictStatus;
  readonly conflicts: readonly CrossTabAreaConflict[];
  readonly notice: CrossTabConflictNotice | null;
  readonly initialized: boolean;
  readonly persistenceAvailable: boolean;
}

interface RawConflictRecord extends CrossTabAreaConflict {
  readonly firstConflictingBaselineRaw: string | null;
  latestExternalRaw: string | null;
}

interface AreaBaseline {
  raw: string | null;
  revision: number;
}

export type CrossTabWriteCheck =
  | { status: "ready" }
  | { status: "external-conflict"; id: CrossTabAreaId }
  | { status: "unavailable" };

export type CrossTabReviewResult =
  | { status: "ready" }
  | { status: "stale"; changedIds: readonly CrossTabAreaId[] }
  | { status: "unavailable" }
  | { status: "invalid"; invalidIds: readonly CrossTabAreaId[] };

export interface CrossTabKeepUndoRecord {
  readonly ids: readonly CrossTabAreaId[];
  readonly preimages: ReadonlyMap<string, string | null>;
  readonly postimages: ReadonlyMap<string, string | null>;
}

export type CrossTabKeepResult =
  | { status: "kept"; undo: CrossTabKeepUndoRecord }
  | { status: "stale"; changedIds: readonly CrossTabAreaId[] }
  | { status: "invalid"; invalidIds: readonly CrossTabAreaId[] }
  | { status: "unavailable" }
  | { status: "failed"; rollbackFailed: boolean };

export type CrossTabUndoResult =
  | { status: "undone" }
  | { status: "stale" }
  | { status: "unavailable" }
  | { status: "failed"; rollbackFailed: boolean };

export interface CrossTabStorageChange {
  readonly key: string | null;
  readonly oldValue: string | null;
  readonly newValue: string | null;
}

function classifyExternalRaw(id: CrossTabAreaId, raw: string | null): CrossTabExternalStatus {
  if (raw === null) return "missing";
  const registration = CROSS_TAB_AREA_REGISTRY[id];
  const report = createLocalStateHealthReport(
    createMemoryStorage({ [registration.key]: raw }),
    new Date(0)
  );
  const item = report.items.find((candidate) => candidate.id === id);
  if (item?.status === "loaded") return "valid";
  if (item?.status === "version-mismatch") return "unsupported";
  return "invalid";
}

function uniqueAreaIds(ids: readonly LocalStateHealthItemId[]): CrossTabAreaId[] {
  const selected = new Set(ids);
  return CROSS_TAB_AREA_IDS.filter((id) => selected.has(id));
}

export class CrossTabConflictControllerCore {
  private readonly listeners = new Set<() => void>();
  private readonly baselines = new Map<CrossTabAreaId, AreaBaseline>();
  private readonly conflicts = new Map<CrossTabAreaId, RawConflictRecord>();
  private revision = 0;
  private snapshot: CrossTabConflictSnapshot = {
    status: "clear",
    conflicts: [],
    notice: null,
    initialized: false,
    persistenceAvailable: true
  };

  constructor(private readonly storage: KeyValueStorage) {}

  subscribe = (listener: () => void): (() => void) => {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  };

  getSnapshot = (): CrossTabConflictSnapshot => this.snapshot;

  private nextRevision(): number {
    this.revision += 1;
    return this.revision;
  }

  private publish(status?: CrossTabConflictStatus): void {
    const conflicts = CROSS_TAB_AREA_IDS.flatMap((id) => {
      const conflict = this.conflicts.get(id);
      if (!conflict) return [];
      return [
        {
          id: conflict.id,
          label: conflict.label,
          firstDetectedRevision: conflict.firstDetectedRevision,
          latestDetectedRevision: conflict.latestDetectedRevision,
          externalStatus: conflict.externalStatus
        }
      ];
    });
    this.snapshot = {
      ...this.snapshot,
      status: status ?? (conflicts.length > 0 ? "conflicted" : "clear"),
      conflicts,
      notice:
        conflicts.length > 0 ? { affectedCount: conflicts.length, revision: this.revision } : null
    };
    for (const listener of this.listeners) listener();
  }

  initialize = (): boolean => {
    if (this.snapshot.initialized) return this.snapshot.persistenceAvailable;
    const captured = new Map<CrossTabAreaId, AreaBaseline>();
    try {
      for (const id of CROSS_TAB_AREA_IDS) {
        captured.set(id, {
          raw: this.storage.getItem(CROSS_TAB_AREA_REGISTRY[id].key),
          revision: this.nextRevision()
        });
      }
    } catch {
      this.snapshot = { ...this.snapshot, initialized: true, persistenceAvailable: false };
      this.publish();
      return false;
    }
    for (const [id, baseline] of captured) this.baselines.set(id, baseline);
    this.snapshot = { ...this.snapshot, initialized: true, persistenceAvailable: true };
    this.publish();
    return true;
  };

  private captureConflict(id: CrossTabAreaId, externalRaw: string | null): void {
    const baseline = this.baselines.get(id);
    if (!baseline) return;
    const detectedRevision = this.nextRevision();
    const existing = this.conflicts.get(id);
    this.conflicts.set(id, {
      id,
      label: CROSS_TAB_AREA_REGISTRY[id].label,
      firstDetectedRevision: existing?.firstDetectedRevision ?? detectedRevision,
      latestDetectedRevision: detectedRevision,
      externalStatus: classifyExternalRaw(id, externalRaw),
      firstConflictingBaselineRaw: existing?.firstConflictingBaselineRaw ?? baseline.raw,
      latestExternalRaw: externalRaw
    });
    this.publish();
  }

  handleStorageChange = (change: CrossTabStorageChange): void => {
    if (!this.snapshot.initialized || !this.snapshot.persistenceAvailable || change.key === null) {
      return;
    }
    const registration = CROSS_TAB_REGISTRATION_BY_KEY.get(change.key);
    if (!registration) return;
    const baseline = this.baselines.get(registration.id);
    if (!baseline || change.newValue === baseline.raw) return;
    this.captureConflict(registration.id, change.newValue);
  };

  checkFreshness = (id: LocalStateHealthItemId): CrossTabWriteCheck => {
    if (id === "legacy-migration-dismissed") return { status: "ready" };
    if (!this.snapshot.initialized && !this.initialize()) return { status: "unavailable" };
    if (!this.snapshot.persistenceAvailable) return { status: "unavailable" };
    const areaId = id as CrossTabAreaId;
    if (this.conflicts.has(areaId)) return { status: "external-conflict", id: areaId };
    const baseline = this.baselines.get(areaId);
    try {
      const currentRaw = this.storage.getItem(CROSS_TAB_AREA_REGISTRY[areaId].key);
      if (!baseline || currentRaw !== baseline.raw) {
        this.captureConflict(areaId, currentRaw);
        return { status: "external-conflict", id: areaId };
      }
    } catch {
      return { status: "unavailable" };
    }
    return { status: "ready" };
  };

  checkFreshnessFor = (ids: readonly LocalStateHealthItemId[]): CrossTabWriteCheck => {
    for (const id of uniqueAreaIds(ids)) {
      const result = this.checkFreshness(id);
      if (result.status !== "ready") return result;
    }
    return { status: "ready" };
  };

  isSuspended = (id: LocalStateHealthItemId): boolean =>
    id !== "legacy-migration-dismissed" && this.conflicts.has(id as CrossTabAreaId);

  recordVerifiedRaw = (id: LocalStateHealthItemId, raw: string | null): void => {
    if (id === "legacy-migration-dismissed") return;
    const areaId = id as CrossTabAreaId;
    this.baselines.set(areaId, { raw, revision: this.nextRevision() });
  };

  recordCurrentRaw = (ids: readonly LocalStateHealthItemId[]): boolean => {
    try {
      for (const id of uniqueAreaIds(ids)) {
        this.recordVerifiedRaw(id, this.storage.getItem(CROSS_TAB_AREA_REGISTRY[id].key));
      }
      return true;
    } catch {
      return false;
    }
  };

  resolveCleared = (ids: readonly LocalStateHealthItemId[]): void => {
    for (const id of uniqueAreaIds(ids)) {
      this.recordVerifiedRaw(id, null);
      this.conflicts.delete(id);
    }
    this.publish();
  };

  private refreshSelected(ids: readonly CrossTabAreaId[]): CrossTabReviewResult {
    const changedIds: CrossTabAreaId[] = [];
    const invalidIds: CrossTabAreaId[] = [];
    try {
      for (const id of ids) {
        const conflict = this.conflicts.get(id);
        if (!conflict) continue;
        const currentRaw = this.storage.getItem(CROSS_TAB_AREA_REGISTRY[id].key);
        if (currentRaw !== conflict.latestExternalRaw) {
          changedIds.push(id);
          this.captureConflict(id, currentRaw);
        }
        const latest = this.conflicts.get(id);
        if (latest && latest.externalStatus !== "valid" && latest.externalStatus !== "missing") {
          invalidIds.push(id);
        }
      }
    } catch {
      return { status: "unavailable" };
    }
    if (changedIds.length > 0) return { status: "stale", changedIds };
    if (invalidIds.length > 0) return { status: "invalid", invalidIds };
    return { status: "ready" };
  }

  refreshReview = (ids: readonly CrossTabAreaId[]): CrossTabReviewResult =>
    this.refreshSelected(ids);

  useSavedData = (ids: readonly CrossTabAreaId[]): CrossTabReviewResult =>
    this.refreshSelected(ids);

  keepCurrent = (
    operations: readonly LocalStateBatchOperation<CrossTabAreaId>[]
  ): CrossTabKeepResult => {
    const ids = uniqueAreaIds(operations.map((operation) => operation.id));
    const review = this.refreshSelected(ids);
    if (review.status !== "ready") return review;
    if (operations.length !== ids.length || ids.some((id) => !this.conflicts.has(id))) {
      return { status: "invalid", invalidIds: ids };
    }
    this.publish("resolving");
    const result = executeLocalStateBatch(this.storage, operations);
    if (result.status === "unavailable") {
      this.publish();
      return { status: "unavailable" };
    }
    if (result.status === "failed") {
      this.publish();
      return { status: "failed", rollbackFailed: result.rollbackFailedOperations.length > 0 };
    }
    const postimages = new Map<string, string | null>();
    for (const operation of operations) {
      postimages.set(operation.key, operation.targetRaw);
      this.recordVerifiedRaw(operation.id, operation.targetRaw);
      this.conflicts.delete(operation.id);
    }
    this.publish();
    return { status: "kept", undo: { ids, preimages: result.preimages, postimages } };
  };

  undoKeep = (record: CrossTabKeepUndoRecord): CrossTabUndoResult => {
    const operations: LocalStateBatchOperation<CrossTabAreaId>[] = [];
    try {
      for (const id of record.ids) {
        const registration = CROSS_TAB_AREA_REGISTRY[id];
        const expected = record.postimages.get(registration.key) ?? null;
        if (this.storage.getItem(registration.key) !== expected) return { status: "stale" };
        const targetRaw = record.preimages.get(registration.key) ?? null;
        operations.push({
          id,
          key: registration.key,
          intent: targetRaw === null ? "clear" : "write",
          targetRaw
        });
      }
    } catch {
      return { status: "unavailable" };
    }
    const result = executeLocalStateBatch(this.storage, operations);
    if (result.status === "unavailable") return { status: "unavailable" };
    if (result.status === "failed") {
      return { status: "failed", rollbackFailed: result.rollbackFailedOperations.length > 0 };
    }
    for (const operation of operations) this.recordVerifiedRaw(operation.id, operation.targetRaw);
    return { status: "undone" };
  };
}
