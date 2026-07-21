import type { JsonDownloadRequestResult } from "@/adapters/browser";
import type { GameDataSnapshot } from "@/domain/shared";
import { createDuelSnapshotsExport, type DuelSnapshotsState } from "../state/duel-snapshots";
import { createSetupTransferContext } from "../state/setup-transfer-context";
import { createTransferArtifactFileName } from "../transfer-artifact-file-name";
import {
  failedFileExportOutcome,
  requestFileExport,
  type FileExportOutcome
} from "./file-export-outcome";

export interface ExportDuelSnapshotsInput {
  snapshots: DuelSnapshotsState;
  gameData: GameDataSnapshot;
  now: Date;
  downloadJsonFile(fileName: string, value: unknown): JsonDownloadRequestResult;
}

export function exportDuelSnapshotsFile(input: ExportDuelSnapshotsInput): FileExportOutcome {
  try {
    const fileName = createTransferArtifactFileName({
      artifact: "saved-setup-collection",
      revision: createSetupTransferContext(input.gameData).gameRevision,
      now: input.now
    });
    return requestFileExport("saved-setup", fileName, () =>
      input.downloadJsonFile(
        fileName,
        createDuelSnapshotsExport(input.snapshots, input.gameData, input.now)
      )
    );
  } catch {
    return failedFileExportOutcome("saved-setup");
  }
}
