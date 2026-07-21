import { withGeneratedAlchAuthority } from "@/adapters/generated/price-fallback";
import { parsePriceSetFileText } from "@/adapters/market";
import { PRICE_SET_IMPORT_MAX_BYTES } from "@/data/schemas";
import type { GameDataSnapshot, PriceSet } from "@/domain/shared";
import type { JsonDownloadRequestResult } from "@/adapters/browser";
import {
  applyManualPriceOverrides,
  type ManualPriceOverridesState
} from "../state/manual-price-overrides";
import type { LocalStateHealthItemId } from "../state/local-state-health";
import {
  appendAcceptedPriceSetToHistory,
  type BrowserPriceHistoryState
} from "../state/price-history";
import {
  createPriceImportSuccessNotice,
  describePriceImportError,
  type PriceImportNotice
} from "../state/price-import";
import { requestFileExport, type FileExportOutcome } from "./file-export-outcome";

export interface MarketNotice {
  tone: "neutral" | "success" | "warning" | "error";
  message: string;
}

export interface PriceSetTransferSnapshot {
  importNotice: PriceImportNotice | null;
  resetPending: boolean;
}

export const PRICE_HISTORY_FULL_CAPTURE_GUIDANCE =
  "Local history is full, so this PriceSet was not saved as a comparison. Review local history, then save it explicitly." as const;

export type AcceptedPriceHistoryCaptureOutcome =
  | { status: "added"; history: BrowserPriceHistoryState }
  | {
      status: "full-skipped";
      history: BrowserPriceHistoryState;
      guidance: typeof PRICE_HISTORY_FULL_CAPTURE_GUIDANCE;
    };

export interface AcceptPriceSetInput {
  priceSet: PriceSet;
  acceptedAt: Date;
  nextStatus: string;
  gameData: GameDataSnapshot;
  manualPriceOverrides: ManualPriceOverridesState;
}

export interface AcceptedPriceSetOutcome {
  status: "ready";
  basePriceSet: PriceSet;
  activePriceSet: PriceSet;
  priceHistoryUpdate(current: BrowserPriceHistoryState): BrowserPriceHistoryState;
  priceHistoryCapture(current: BrowserPriceHistoryState): AcceptedPriceHistoryCaptureOutcome;
  activePriceSetOrigin: "selected";
  selectedPersisted: boolean;
  appStatus: string;
  marketNotice: MarketNotice;
}

export type PriceSetFileImportOutcome = AcceptedPriceSetOutcome | { status: "rejected" };

export type ImportPriceSetFileInput = Omit<
  AcceptPriceSetInput,
  "priceSet" | "acceptedAt" | "nextStatus"
> & {
  beforeAccept?(): void;
};

export interface ResetPriceSetInput {
  fallbackPriceSet: PriceSet;
  fallbackOrigin: "scheduled" | "bundled";
  fallbackLabel: string;
  manualPriceOverrides: ManualPriceOverridesState;
}

export interface ResetPriceSetOutcome {
  status: "ready";
  basePriceSet: PriceSet;
  activePriceSet: PriceSet;
  activePriceSetOrigin: ResetPriceSetInput["fallbackOrigin"];
  persistedReset: boolean;
  appStatus: string;
  marketNotice: MarketNotice;
}

export type PriceSetActionOutcome =
  | (Omit<Extract<FileExportOutcome, { status: "requested" }>, "notice"> & {
      marketNotice: MarketNotice;
    })
  | (Omit<Extract<FileExportOutcome, { status: "failed" }>, "notice"> & {
      marketNotice: MarketNotice;
    });

export interface PriceSetTransferDependencies<TFile> {
  readFileText(file: TFile, maxBytes: number): Promise<string>;
  downloadJsonFile(fileName: string, value: unknown): JsonDownloadRequestResult;
  saveSelectedPriceSet(priceSet: PriceSet, selectedAt: Date): void;
  clearSelectedPriceSet(): void;
  storageUnavailable: boolean;
  clearStorageFailures(ids: readonly LocalStateHealthItemId[]): void;
  recordStorageFailure(id: LocalStateHealthItemId, reason: "save_failed" | "clear_failed"): void;
  markPersistenceUnavailable(): void;
  canStartDurableWrite(ids: readonly LocalStateHealthItemId[]): boolean;
  recordCurrentBaselines(ids: readonly LocalStateHealthItemId[]): void;
  unblockReplaced(ids: readonly LocalStateHealthItemId[]): void;
  refreshLocalStateHealth(): void;
  now(): Date;
}

function priceSetExportFileName(priceSet: PriceSet): string {
  const safeId = priceSet.id.replace(/[^a-z0-9._-]+/gi, "-").replace(/^-+|-+$/g, "");
  return `index-sim-price-set-${safeId || "active"}.json`;
}

export class PriceSetTransferControllerCore<TFile> {
  private readonly listeners = new Set<() => void>();
  private snapshot: PriceSetTransferSnapshot = { importNotice: null, resetPending: false };

  constructor(private readonly dependencies: PriceSetTransferDependencies<TFile>) {}

  subscribe = (listener: () => void): (() => void) => {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  };

  getSnapshot = (): PriceSetTransferSnapshot => this.snapshot;

  private update(patch: Partial<PriceSetTransferSnapshot>): void {
    const importNotice =
      patch.importNotice === undefined ? this.snapshot.importNotice : patch.importNotice;
    const resetPending = patch.resetPending ?? this.snapshot.resetPending;
    if (
      importNotice === this.snapshot.importNotice &&
      resetPending === this.snapshot.resetPending
    ) {
      return;
    }
    this.snapshot = { importNotice, resetPending };
    for (const listener of this.listeners) listener();
  }

  private persistSelected(priceSet: PriceSet, selectedAt: Date): boolean {
    if (!this.dependencies.canStartDurableWrite(["selected-price-set"])) return false;
    try {
      this.dependencies.saveSelectedPriceSet(priceSet, selectedAt);
      if (this.dependencies.storageUnavailable) {
        this.dependencies.markPersistenceUnavailable();
        return false;
      }
      this.dependencies.clearStorageFailures(["selected-price-set"]);
      this.dependencies.recordCurrentBaselines(["selected-price-set"]);
      this.dependencies.refreshLocalStateHealth();
      this.update({ resetPending: false });
      return true;
    } catch {
      this.dependencies.recordStorageFailure("selected-price-set", "save_failed");
      return false;
    }
  }

  acceptPriceSet = (input: AcceptPriceSetInput): AcceptedPriceSetOutcome => {
    const canonicalPriceSet = withGeneratedAlchAuthority(input.priceSet, input.gameData);
    const activePriceSet = applyManualPriceOverrides(canonicalPriceSet, input.manualPriceOverrides);
    const selectedPersisted = this.persistSelected(canonicalPriceSet, input.acceptedAt);
    this.dependencies.unblockReplaced(["selected-price-set"]);
    const priceHistoryCapture = (current: BrowserPriceHistoryState) => {
      const history = appendAcceptedPriceSetToHistory(current, canonicalPriceSet, input.acceptedAt);
      return history === current
        ? {
            status: "full-skipped" as const,
            history,
            guidance: PRICE_HISTORY_FULL_CAPTURE_GUIDANCE
          }
        : { status: "added" as const, history };
    };

    return {
      status: "ready",
      basePriceSet: canonicalPriceSet,
      activePriceSet,
      priceHistoryUpdate: (current) => priceHistoryCapture(current).history,
      priceHistoryCapture,
      activePriceSetOrigin: "selected",
      selectedPersisted,
      appStatus: input.nextStatus,
      marketNotice: {
        tone: selectedPersisted ? "success" : "neutral",
        message: selectedPersisted
          ? `${input.nextStatus}: ${canonicalPriceSet.label}. High alch uses current generated game data.`
          : `${input.nextStatus}: ${canonicalPriceSet.label}. High alch uses current generated game data. Local restore was not saved.`
      }
    };
  };

  importFile = async (
    file: TFile,
    input: ImportPriceSetFileInput
  ): Promise<PriceSetFileImportOutcome> => {
    this.update({ importNotice: null });
    try {
      const priceSet = parsePriceSetFileText(
        await this.dependencies.readFileText(file, PRICE_SET_IMPORT_MAX_BYTES),
        { maxBytes: PRICE_SET_IMPORT_MAX_BYTES }
      );
      input.beforeAccept?.();
      const outcome = this.acceptPriceSet({
        gameData: input.gameData,
        manualPriceOverrides: input.manualPriceOverrides,
        priceSet,
        acceptedAt: this.dependencies.now(),
        nextStatus: "Imported price set"
      });
      this.update({ importNotice: createPriceImportSuccessNotice(priceSet.label) });
      return outcome;
    } catch (error) {
      this.update({ importNotice: describePriceImportError(error) });
      return { status: "rejected" };
    }
  };

  exportPriceSet = (priceSet: PriceSet): PriceSetActionOutcome => {
    const fileName = priceSetExportFileName(priceSet);
    const outcome = requestFileExport("price-set", fileName, () =>
      this.dependencies.downloadJsonFile(fileName, priceSet)
    );
    const { notice, ...actionOutcome } = outcome;
    return {
      ...actionOutcome,
      marketNotice: notice
    };
  };

  requestReset = (fallbackLabel: string): MarketNotice => {
    this.update({ resetPending: true });
    return {
      tone: "neutral",
      message: `Confirm reset imported PriceSet to ${fallbackLabel}. Manual item prices and local price history will be kept.`
    };
  };

  cancelReset = (): void => this.update({ resetPending: false });

  resetToFallback = (input: ResetPriceSetInput): ResetPriceSetOutcome => {
    const activePriceSet = applyManualPriceOverrides(
      input.fallbackPriceSet,
      input.manualPriceOverrides
    );
    let persistedReset = this.dependencies.canStartDurableWrite(["selected-price-set"]);
    if (persistedReset) {
      try {
        this.dependencies.clearSelectedPriceSet();
        if (this.dependencies.storageUnavailable) {
          persistedReset = false;
          this.dependencies.markPersistenceUnavailable();
        } else {
          this.dependencies.clearStorageFailures(["selected-price-set"]);
          this.dependencies.recordCurrentBaselines(["selected-price-set"]);
        }
      } catch {
        persistedReset = false;
        this.dependencies.recordStorageFailure("selected-price-set", "clear_failed");
      }
    }
    this.dependencies.refreshLocalStateHealth();
    this.update({ resetPending: false });

    return {
      status: "ready",
      basePriceSet: input.fallbackPriceSet,
      activePriceSet,
      activePriceSetOrigin: input.fallbackOrigin,
      persistedReset,
      appStatus: persistedReset
        ? `Reset to ${input.fallbackLabel}`
        : `Reset to ${input.fallbackLabel} for this session`,
      marketNotice: {
        tone: persistedReset ? "success" : "neutral",
        message: persistedReset
          ? `Reset to ${input.fallbackLabel}. Manual item prices and local price history were kept.`
          : `Reset to ${input.fallbackLabel} for this session. Manual item prices and local price history were kept. Local storage is unavailable, so reload may restore the previous PriceSet.`
      }
    };
  };
}
