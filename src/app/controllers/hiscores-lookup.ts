import {
  HiscoresAdapterError,
  loadLastHiscoresPlayer,
  saveLastHiscoresPlayer
} from "@/adapters/hiscores";
import type { KeyValueStorage } from "@/adapters/storage";
import type { HiscoresResponse, HiscoresStatusResponse } from "@/domain/shared";
import {
  countApplicableHiscoresSkills,
  isHiscoresPreviewCurrent,
  normalizeHiscoresPlayerInput
} from "../state/hiscores";
import type { LocalStateHealthItemId } from "../state/local-state-health";

export interface HiscoresLookupNotice {
  tone: "neutral" | "success" | "error";
  message: string;
}

export interface HiscoresLookupSnapshot {
  status: HiscoresStatusResponse | null;
  statusLabel: "checking" | "available" | "disabled" | "unavailable";
  available: boolean;
  player: string;
  response: HiscoresResponse | null;
  busy: boolean;
  previewOpen: boolean;
  notice: HiscoresLookupNotice | null;
}

type HiscoresLookupMutableSnapshot = Omit<HiscoresLookupSnapshot, "statusLabel" | "available">;

export type HiscoresApplyOutcome =
  | {
      status: "ready";
      response: HiscoresResponse;
      applicableSkillCount: number;
    }
  | { status: "stale" };

export interface HiscoresLookupDependencies {
  storage: KeyValueStorage;
  fetchStatus: () => Promise<HiscoresStatusResponse>;
  lookupPlayer: (player: string) => Promise<HiscoresResponse>;
  clearStorageFailures: (ids: readonly LocalStateHealthItemId[]) => void;
  recordStorageFailure: (
    id: LocalStateHealthItemId,
    reason: "save_failed" | "clear_failed"
  ) => void;
  unblockReplaced: (ids: readonly LocalStateHealthItemId[]) => void;
  refreshLocalStateHealth: () => void;
}

export function hiscoresUnavailableMessage(status: HiscoresStatusResponse | null): string {
  return status?.source.id === "disabled"
    ? "Live hiscores lookup is not configured in this run. Use the Player level fields above to edit levels manually."
    : "Hiscores lookup is unavailable right now. Use the Player level fields above to edit levels manually.";
}

export function describeHiscoresError(error: unknown): string {
  if (error instanceof HiscoresAdapterError) {
    if (error.code === "bad-request") return "Check the player name";
    if (error.code === "not-found") return "Player not found";
    if (error.code === "rate-limited") {
      return error.retryAfterSeconds
        ? `Rate limited. Try again in ${error.retryAfterSeconds}s`
        : "Rate limited";
    }
    if (error.code === "upstream-unavailable") return hiscoresUnavailableMessage(null);
    if (error.code === "upstream-invalid") return "Hiscores response invalid";
  }
  return "Hiscores lookup failed. Player level fields still work for manual edits.";
}

export function hiscoresStatusLabel(
  status: HiscoresStatusResponse | null
): HiscoresLookupSnapshot["statusLabel"] {
  if (status === null) return "checking";
  if (status.available) return "available";
  return status.source.id === "disabled" ? "disabled" : "unavailable";
}

function snapshotWithDerivedState(snapshot: HiscoresLookupMutableSnapshot): HiscoresLookupSnapshot {
  return {
    ...snapshot,
    statusLabel: hiscoresStatusLabel(snapshot.status),
    available: snapshot.status?.available === true
  };
}

export class HiscoresLookupControllerCore {
  private readonly listeners = new Set<() => void>();
  private requestSequence = 0;
  private snapshot: HiscoresLookupSnapshot;

  constructor(private readonly dependencies: HiscoresLookupDependencies) {
    this.snapshot = snapshotWithDerivedState({
      status: null,
      player: loadLastHiscoresPlayer(dependencies.storage),
      response: null,
      busy: false,
      previewOpen: false,
      notice: null
    });
  }

  subscribe = (listener: () => void): (() => void) => {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  };

  getSnapshot = (): HiscoresLookupSnapshot => this.snapshot;

  private update(patch: Partial<HiscoresLookupMutableSnapshot>): void {
    const current: HiscoresLookupMutableSnapshot = {
      status: this.snapshot.status,
      player: this.snapshot.player,
      response: this.snapshot.response,
      busy: this.snapshot.busy,
      previewOpen: this.snapshot.previewOpen,
      notice: this.snapshot.notice
    };
    this.snapshot = snapshotWithDerivedState({ ...current, ...patch });
    for (const listener of this.listeners) listener();
  }

  loadStatus = async (isCancelled: () => boolean = () => false): Promise<void> => {
    try {
      const status = await this.dependencies.fetchStatus();
      if (isCancelled()) return;
      this.update({
        status,
        notice: status.available
          ? null
          : { tone: "neutral", message: hiscoresUnavailableMessage(status) }
      });
    } catch (error) {
      if (isCancelled()) return;
      this.update({
        status: null,
        notice: { tone: "error", message: describeHiscoresError(error) }
      });
    }
  };

  changePlayer = (player: string): void => {
    const responseIsStale =
      this.snapshot.response !== null && !isHiscoresPreviewCurrent(player, this.snapshot.response);
    this.update({
      player,
      ...(responseIsStale
        ? {
            response: null,
            previewOpen: false,
            notice: this.snapshot.notice?.tone === "success" ? null : this.snapshot.notice
          }
        : {})
    });
  };

  private persistPlayer(player: string): boolean {
    let persisted = true;
    try {
      saveLastHiscoresPlayer(this.dependencies.storage, player);
      this.dependencies.clearStorageFailures(["hiscores-last-player"]);
    } catch {
      persisted = false;
      this.dependencies.recordStorageFailure("hiscores-last-player", "save_failed");
    }
    this.dependencies.unblockReplaced(["hiscores-last-player"]);
    this.dependencies.refreshLocalStateHealth();
    return persisted;
  }

  lookup = async (): Promise<void> => {
    const lookupPlayer = this.snapshot.player;
    const lookupPlayerKey = normalizeHiscoresPlayerInput(lookupPlayer);
    if (!lookupPlayerKey) {
      this.update({ notice: { tone: "error", message: "Enter a player name" } });
      return;
    }
    if (!this.snapshot.available) {
      this.update({
        notice: { tone: "error", message: hiscoresUnavailableMessage(this.snapshot.status) }
      });
      return;
    }

    const requestSequence = (this.requestSequence += 1);
    this.update({ busy: true, notice: { tone: "neutral", message: "Looking up hiscores" } });
    try {
      const response = await this.dependencies.lookupPlayer(lookupPlayer);
      const latestRequest = requestSequence === this.requestSequence;
      if (!latestRequest || !isHiscoresPreviewCurrent(this.snapshot.player, response)) {
        if (latestRequest) {
          this.update({
            response: null,
            notice: {
              tone: "neutral",
              message: "Player changed before lookup completed. Run Lookup again."
            }
          });
        }
        return;
      }

      this.update({ response, previewOpen: true });
      this.persistPlayer(response.player);
      this.update({
        notice: {
          tone: "success",
          message: countApplicableHiscoresSkills(response)
            ? "Hiscores preview ready"
            : "No supported skills returned"
        }
      });
    } catch (error) {
      const latestRequest = requestSequence === this.requestSequence;
      if (
        !latestRequest ||
        normalizeHiscoresPlayerInput(this.snapshot.player) !== lookupPlayerKey
      ) {
        return;
      }
      this.update({
        response: null,
        previewOpen: false,
        notice: { tone: "error", message: describeHiscoresError(error) }
      });
    } finally {
      if (requestSequence === this.requestSequence) this.update({ busy: false });
    }
  };

  setPreviewOpen = (previewOpen: boolean): void => {
    if (previewOpen === this.snapshot.previewOpen) return;
    this.update({ previewOpen });
  };

  closePreview = (): void => this.setPreviewOpen(false);

  prepareApply = (): HiscoresApplyOutcome => {
    if (!isHiscoresPreviewCurrent(this.snapshot.player, this.snapshot.response)) {
      this.update({
        response: null,
        notice: {
          tone: "neutral",
          message: "Hiscores preview no longer matches Player. Run Lookup again."
        }
      });
      return { status: "stale" };
    }
    return {
      status: "ready",
      response: this.snapshot.response,
      applicableSkillCount: countApplicableHiscoresSkills(this.snapshot.response)
    };
  };

  recordApplied = (applicableSkillCount: number): void => {
    this.update({
      notice: {
        tone: applicableSkillCount ? "success" : "neutral",
        message: applicableSkillCount
          ? `Applied ${applicableSkillCount} skills`
          : "No current setup skills to apply"
      }
    });
  };

  replacePersistedPlayer = (player: string): boolean => {
    const persisted = this.persistPlayer(player);
    this.update({ player });
    return persisted;
  };
}
