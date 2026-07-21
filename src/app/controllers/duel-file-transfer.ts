import type { JsonDownloadRequestResult } from "@/adapters/browser";
import type { GameDataSnapshot } from "@/domain/shared";
import { createDuelSnapshotsExport, type DuelSnapshotsState } from "../state/duel-snapshots";
import { requestFileExport, type FileExportOutcome } from "./file-export-outcome";

export interface ExportDuelSnapshotsInput {
  snapshots: DuelSnapshotsState;
  gameData: GameDataSnapshot;
  now: Date;
  downloadJsonFile(fileName: string, value: unknown): JsonDownloadRequestResult;
}

export function exportDuelSnapshotsFile(input: ExportDuelSnapshotsInput): FileExportOutcome {
  const fileName = "index-sim-saved-setups.json";
  return requestFileExport("saved-setup", fileName, () =>
    input.downloadJsonFile(
      fileName,
      createDuelSnapshotsExport(input.snapshots, input.gameData, input.now)
    )
  );
}
