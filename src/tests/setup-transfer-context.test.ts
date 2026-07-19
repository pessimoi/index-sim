import { createGeneratedRuntimeContext } from "../adapters/generated";
import {
  SetupTransferContextV1Schema,
  compareLegacyGameDataId,
  compareSetupTransferContext,
  createSetupTransferContext
} from "../app/state/setup-transfer-context";

describe("setup transfer context", () => {
  const gameData = createGeneratedRuntimeContext().context.gameData;
  const current = createSetupTransferContext(gameData);

  it("builds a strict bounded stamp only from the ready revision context", () => {
    expect(current).toEqual({
      gameDataId: "lostcity-376072662e78-runtime",
      gameRevision: 274
    });
    expect(() =>
      SetupTransferContextV1Schema.parse({ ...current, sourceCommit: "secret" })
    ).toThrow();
    expect(() =>
      SetupTransferContextV1Schema.parse({ ...current, gameDataId: "../private/path" })
    ).toThrow();
    expect(() =>
      createSetupTransferContext({ ...gameData, revisionContext: undefined })
    ).toThrowError("Generated runtime game data is missing revision context.");
  });

  it.each([
    ["exact-snapshot", current, "Created with this exact Revision 274 data snapshot.", "ready"],
    [
      "same-revision",
      { gameDataId: "another-safe-snapshot", gameRevision: 274 },
      "Created with another Revision 274 snapshot. Available ids are compatible, but results may differ.",
      "warning"
    ],
    [
      "different-revision",
      { gameDataId: current.gameDataId, gameRevision: 273 },
      "Created for Revision 273; this app uses Revision 274. Available ids are compatible, but combat, loot and requirements may differ.",
      "warning"
    ],
    [
      "unknown",
      null,
      "This older format does not record a game revision. It will use the current Revision 274 data.",
      "warning"
    ]
  ])("classifies %s deterministically", (match, source, message, tone) => {
    expect(compareSetupTransferContext(source, gameData)).toMatchObject({ match, message, tone });
  });

  it("treats matching-id share v1 as exact and a different id as unknown", () => {
    expect(compareLegacyGameDataId(current.gameDataId, gameData).match).toBe("exact-snapshot");
    expect(compareLegacyGameDataId("older-safe-id", gameData)).toMatchObject({
      match: "unknown",
      source: null
    });
  });
});
