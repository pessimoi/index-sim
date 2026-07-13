import type { GameDataSnapshot } from "@/domain/shared";
import type { LocalStateHealthItemId } from "../state/local-state-health";
import {
  SETUP_IMPORT_MAX_BYTES,
  SetupImportError,
  parseSavedSetupExportText
} from "../state/setup-import";
import { REWRITE_SETUP_VERSION, type SavedSetupState } from "../state/ui-state";

export interface SetupFileTransferNotice {
  tone: "success" | "error";
  message: string;
  details?: string[];
}

export interface SetupFileTransferSnapshot {
  notice: SetupFileTransferNotice | null;
}

export type SetupImportOutcome =
  | {
      status: "ready";
      setup: SavedSetupState;
      persisted: boolean;
      appStatus: "Imported rewrite setup" | "Imported rewrite setup for this session";
    }
  | { status: "rejected" };

export interface SetupFileTransferDependencies<TFile> {
  readFileText(file: TFile, maxBytes: number): Promise<string>;
  persistSetup(setup: SavedSetupState): boolean;
  unblockReplaced(ids: readonly LocalStateHealthItemId[]): void;
  refreshLocalStateHealth(): void;
  downloadJsonFile(fileName: string, value: unknown): void;
  now(): Date;
}

function sanitizeImportDetail(value: string): string {
  return value
    .replace(/(?:[A-Za-z]:)?[\\/][^\s"']+/g, "[path]")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, 180);
}

function sanitizedIssues(error: SetupImportError): string[] | undefined {
  const details = error.issues.slice(0, 5).map(sanitizeImportDetail).filter(Boolean);
  return details.length > 0 ? details : undefined;
}

export function describeSetupFileTransferError(error: unknown): SetupFileTransferNotice {
  if (error instanceof Error && /^File exceeds \d+ bytes$/.test(error.message)) {
    return {
      tone: "error",
      message:
        "Setup import failed: the file is too large. Choose an exported setup JSON under 250 KB."
    };
  }

  if (error instanceof SetupImportError) {
    if (error.code === "body_too_large") {
      return {
        tone: "error",
        message:
          "Setup import failed: the file is too large. Choose an exported setup JSON under 250 KB."
      };
    }
    if (error.code === "duplicate_keys") {
      return {
        tone: "error",
        message: "Setup import failed: the JSON contains duplicate keys."
      };
    }
    if (error.code === "invalid_json") {
      return { tone: "error", message: "Setup import failed: the file is not valid JSON." };
    }
    if (error.code === "unsupported_version") {
      return {
        tone: "error",
        message: `Setup import failed: this app only supports rewrite setup version ${REWRITE_SETUP_VERSION}. Export a fresh setup and try again.`
      };
    }
    if (error.code === "incompatible_entities") {
      return {
        tone: "error",
        message: "Setup import failed: the setup references data unavailable in this game version.",
        details: sanitizedIssues(error)
      };
    }
    return {
      tone: "error",
      message: "Setup import failed: the file is not a valid rewrite setup export.",
      details: sanitizedIssues(error)
    };
  }

  return { tone: "error", message: "Setup import failed. Check the file and try again." };
}

export class SetupFileTransferControllerCore<TFile> {
  private readonly listeners = new Set<() => void>();
  private snapshot: SetupFileTransferSnapshot = { notice: null };

  constructor(private readonly dependencies: SetupFileTransferDependencies<TFile>) {}

  subscribe = (listener: () => void): (() => void) => {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  };

  getSnapshot = (): SetupFileTransferSnapshot => this.snapshot;

  private setNotice(notice: SetupFileTransferNotice | null): void {
    if (this.snapshot.notice === notice) return;
    this.snapshot = { notice };
    for (const listener of this.listeners) listener();
  }

  importFile = async (file: TFile, gameData: GameDataSnapshot): Promise<SetupImportOutcome> => {
    this.setNotice(null);
    try {
      const text = await this.dependencies.readFileText(file, SETUP_IMPORT_MAX_BYTES);
      const setup = parseSavedSetupExportText(text, gameData, SETUP_IMPORT_MAX_BYTES).data;
      const persisted = this.dependencies.persistSetup(setup);
      this.dependencies.unblockReplaced(["rewrite-setup"]);
      this.dependencies.refreshLocalStateHealth();
      const appStatus = persisted
        ? "Imported rewrite setup"
        : "Imported rewrite setup for this session";
      this.setNotice({
        tone: "success",
        message: persisted
          ? "Imported rewrite setup."
          : "Imported rewrite setup for this session. Local storage is unavailable, so changes may not persist after reload."
      });
      return { status: "ready", setup, persisted, appStatus };
    } catch (error) {
      this.setNotice(describeSetupFileTransferError(error));
      return { status: "rejected" };
    }
  };

  exportSetup = (setup: SavedSetupState): void => {
    this.dependencies.downloadJsonFile("index-sim-rewrite-setup.json", {
      version: REWRITE_SETUP_VERSION,
      savedAt: this.dependencies.now().toISOString(),
      data: setup
    });
  };
}
