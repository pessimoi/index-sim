import { createGeneratedRuntimeContext } from "../adapters/generated";
import { exportDuelSnapshotsFile } from "../app/controllers/duel-file-transfer";
import { createDuelSnapshot } from "../app/state/duel-snapshots";
import { DEFAULT_FORM_STATE } from "../app/state/ui-state";

const FIXED_NOW = new Date("2026-07-21T10:00:00.000Z");

describe("saved Duel setup export", () => {
  it("builds the contextual envelope and reports only a started request", () => {
    const { context } = createGeneratedRuntimeContext();
    const snapshots = {
      snapshots: [createDuelSnapshot("duel-one", "Fixture one", DEFAULT_FORM_STATE)]
    };
    const downloads: Array<{ fileName: string; value: unknown }> = [];

    const outcome = exportDuelSnapshotsFile({
      snapshots,
      gameData: context.gameData,
      now: FIXED_NOW,
      downloadJsonFile: (fileName, value) => {
        downloads.push({ fileName, value });
        return { status: "requested", fileName, byteLength: JSON.stringify(value).length };
      }
    });

    expect(downloads).toEqual([
      {
        fileName: "index-sim-saved-setups.json",
        value: {
          kind: "index-sim-saved-setups",
          version: 1,
          exportedAt: FIXED_NOW.toISOString(),
          context: {
            gameDataId: context.gameData.id,
            gameRevision: 274
          },
          data: snapshots
        }
      }
    ]);
    expect(outcome).toEqual({
      status: "requested",
      fileName: "index-sim-saved-setups.json",
      appStatus:
        "Saved setup download started: index-sim-saved-setups.json. Check your browser downloads.",
      notice: {
        tone: "neutral",
        message:
          "Saved setup download started: index-sim-saved-setups.json. Check your browser downloads."
      }
    });
  });

  it("normalizes a thrown adapter failure without exposing its error", () => {
    const { context } = createGeneratedRuntimeContext();
    const outcome = exportDuelSnapshotsFile({
      snapshots: { snapshots: [] },
      gameData: context.gameData,
      now: FIXED_NOW,
      downloadJsonFile: () => {
        throw new Error("private saved setup failure");
      }
    });

    expect(outcome).toEqual({
      status: "failed",
      appStatus: "Saved setup download could not be started. Try again.",
      notice: {
        tone: "error",
        message: "Saved setup download could not be started. Try again."
      }
    });
    expect(JSON.stringify(outcome)).not.toContain("private saved setup failure");
  });
});
