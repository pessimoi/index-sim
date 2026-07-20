import type { BrowserStorageAccess } from "../application-recovery";

export interface LocalStateBatchOperation<Id extends string> {
  id: Id;
  key: string;
  intent: "write" | "clear";
  targetRaw: string | null;
}

export interface LocalStateBatchSuccess {
  status: "written";
  preimages: Map<string, string | null>;
}

export interface LocalStateBatchUnavailable {
  status: "unavailable";
}

export interface LocalStateBatchFailure<Id extends string> {
  status: "failed";
  failedOperation: LocalStateBatchOperation<Id>;
  affectedOperations: readonly LocalStateBatchOperation<Id>[];
  rollbackFailedOperations: readonly LocalStateBatchOperation<Id>[];
  preimages: Map<string, string | null>;
}

export type LocalStateBatchResult<Id extends string> =
  LocalStateBatchSuccess | LocalStateBatchUnavailable | LocalStateBatchFailure<Id>;

export function restoreLocalStateBatch<Id extends string>(
  storage: BrowserStorageAccess["storage"],
  operations: readonly LocalStateBatchOperation<Id>[],
  preimages: ReadonlyMap<string, string | null>
): readonly LocalStateBatchOperation<Id>[] {
  const failures: LocalStateBatchOperation<Id>[] = [];
  for (const operation of [...operations].reverse()) {
    try {
      const raw = preimages.get(operation.key) ?? null;
      if (raw === null) storage.removeItem(operation.key);
      else storage.setItem(operation.key, raw);
    } catch {
      failures.push(operation);
    }
  }
  return failures;
}

export function executeLocalStateBatch<Id extends string>(
  storage: BrowserStorageAccess["storage"],
  operations: readonly LocalStateBatchOperation<Id>[]
): LocalStateBatchResult<Id> {
  const preimages = new Map<string, string | null>();
  try {
    for (const operation of operations) {
      preimages.set(operation.key, storage.getItem(operation.key));
    }
  } catch {
    return { status: "unavailable" };
  }

  const affected: LocalStateBatchOperation<Id>[] = [];
  for (const operation of operations) {
    affected.push(operation);
    try {
      if (operation.targetRaw === null) storage.removeItem(operation.key);
      else storage.setItem(operation.key, operation.targetRaw);
    } catch {
      return {
        status: "failed",
        failedOperation: operation,
        affectedOperations: affected,
        rollbackFailedOperations: restoreLocalStateBatch(storage, affected, preimages),
        preimages
      };
    }
  }
  return { status: "written", preimages };
}
