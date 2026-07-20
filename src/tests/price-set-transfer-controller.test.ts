import { createGeneratedRuntimeContext } from "../adapters/generated";
import {
  PriceSetTransferControllerCore,
  type ImportPriceSetFileInput,
  type PriceSetTransferDependencies
} from "../app/controllers/price-set-transfer";
import {
  DEFAULT_MANUAL_PRICE_OVERRIDES_STATE,
  setManualPriceOverride
} from "../app/state/manual-price-overrides";
import { DEFAULT_PRICE_HISTORY_STATE } from "../app/state/price-history";
import { PRICE_SET_IMPORT_MAX_BYTES } from "../data/schemas";
import type { GameDataSnapshot, PriceSet } from "../domain/shared";

const FIXED_NOW = new Date("2026-07-13T14:15:16.000Z");

interface TestFile {
  id: string;
  text: string;
}

function deferred<T>() {
  let resolve!: (value: T) => void;
  let reject!: (reason?: unknown) => void;
  const promise = new Promise<T>((promiseResolve, promiseReject) => {
    resolve = promiseResolve;
    reject = promiseReject;
  });
  return { promise, resolve, reject };
}

function gameData(): GameDataSnapshot {
  return createGeneratedRuntimeContext().context.gameData;
}

function priceSetText(overrides: Partial<PriceSet> = {}): string {
  return JSON.stringify({
    id: "imported-prices",
    label: "Imported fixture prices",
    source: "manual",
    createdAt: "2026-07-12T10:00:00.000Z",
    itemPrices: { rune_scimitar: 15_000, lobster: 220 },
    alchValues: { rune_scimitar: 1, lobster: 2 },
    ...overrides
  });
}

function importInput(data: GameDataSnapshot = gameData()): ImportPriceSetFileInput {
  return {
    gameData: data,
    manualPriceOverrides: DEFAULT_MANUAL_PRICE_OVERRIDES_STATE
  };
}

function harness(overrides: Partial<PriceSetTransferDependencies<TestFile>> = {}) {
  const events: string[] = [];
  const downloads: Array<{ fileName: string; value: unknown }> = [];
  const readFileText = vi.fn(async (file: TestFile) => {
    events.push(`read:${file.id}`);
    return file.text;
  });
  const saveSelectedPriceSet = vi.fn((priceSet: PriceSet) => {
    events.push(`save:${priceSet.id}`);
  });
  const clearSelectedPriceSet = vi.fn(() => events.push("clear-selected"));
  const clearStorageFailures = vi.fn(() => events.push("clear-failure"));
  const recordStorageFailure = vi.fn((_id, reason) => events.push(`failure:${reason}`));
  const markPersistenceUnavailable = vi.fn(() => events.push("unavailable"));
  const unblockReplaced = vi.fn(() => events.push("unblock"));
  const refreshLocalStateHealth = vi.fn(() => events.push("refresh"));
  const downloadJsonFile = vi.fn((fileName: string, value: unknown) => {
    events.push(`download:${fileName}`);
    downloads.push({ fileName, value });
  });
  const core = new PriceSetTransferControllerCore<TestFile>({
    readFileText,
    downloadJsonFile,
    saveSelectedPriceSet,
    clearSelectedPriceSet,
    storageUnavailable: false,
    clearStorageFailures,
    recordStorageFailure,
    markPersistenceUnavailable,
    unblockReplaced,
    refreshLocalStateHealth,
    now: () => FIXED_NOW,
    ...overrides
  });
  return {
    core,
    events,
    downloads,
    readFileText,
    saveSelectedPriceSet,
    clearSelectedPriceSet,
    clearStorageFailures,
    recordStorageFailure,
    markPersistenceUnavailable,
    unblockReplaced,
    refreshLocalStateHealth,
    downloadJsonFile
  };
}

describe("PriceSet transfer controller", () => {
  it("accepts one bounded file as canonical generated alch plus a manual runtime overlay", async () => {
    const data = gameData();
    const generatedAlch = data.items.rune_scimitar?.alch;
    expect(generatedAlch).toBeTypeOf("number");
    const overrides = setManualPriceOverride(
      DEFAULT_MANUAL_PRICE_OVERRIDES_STATE,
      "rune_scimitar",
      99_999,
      new Date("2026-07-13T12:00:00.000Z")
    );
    const test = harness();
    const listener = vi.fn();
    test.core.subscribe(listener);

    const outcome = await test.core.importFile(
      { id: "valid", text: priceSetText() },
      { ...importInput(data), manualPriceOverrides: overrides }
    );

    expect(outcome.status).toBe("ready");
    if (outcome.status !== "ready") throw new Error("expected ready PriceSet");
    expect(test.readFileText).toHaveBeenCalledWith(
      expect.objectContaining({ id: "valid" }),
      PRICE_SET_IMPORT_MAX_BYTES
    );
    expect(test.saveSelectedPriceSet).toHaveBeenCalledWith(
      expect.objectContaining({
        id: "imported-prices",
        itemPrices: { rune_scimitar: 15_000, lobster: 220 },
        alchValues: expect.objectContaining({ rune_scimitar: generatedAlch })
      }),
      FIXED_NOW
    );
    expect(outcome.basePriceSet.itemPrices.rune_scimitar).toBe(15_000);
    expect(outcome.basePriceSet.alchValues.rune_scimitar).toBe(generatedAlch);
    expect(outcome.activePriceSet.itemPrices.rune_scimitar).toBe(99_999);
    expect(outcome.activePriceSet.alchValues.rune_scimitar).toBe(generatedAlch);
    expect(outcome.activePriceSet.source).toBe("manual");
    expect(outcome.activePriceSetOrigin).toBe("selected");
    expect(outcome.selectedPersisted).toBe(true);
    expect(outcome.appStatus).toBe("Imported price set");
    expect(outcome.marketNotice).toEqual({
      tone: "success",
      message:
        "Imported price set: Imported fixture prices. High alch uses current generated game data."
    });

    const currentHistory = {
      snapshots: [
        {
          capturedAt: "2026-07-11T00:00:00.000Z",
          sourcePriceSetId: "existing",
          label: "Existing",
          itemPrices: { lobster: 200 }
        }
      ]
    };
    const nextHistory = outcome.priceHistoryUpdate(currentHistory);
    expect(nextHistory.snapshots).toHaveLength(2);
    expect(nextHistory.snapshots.at(0)).toMatchObject({
      capturedAt: FIXED_NOW.toISOString(),
      sourcePriceSetId: "imported-prices",
      itemPrices: { rune_scimitar: 15_000, lobster: 220 }
    });
    expect(test.events).toEqual([
      "read:valid",
      "save:imported-prices",
      "clear-failure",
      "refresh",
      "unblock"
    ]);
    expect(test.unblockReplaced).toHaveBeenCalledWith(["price-history", "selected-price-set"]);
    expect(test.core.getSnapshot()).toEqual({
      importNotice: {
        tone: "success",
        message:
          "Imported market prices: Imported fixture prices. High alch values use current generated game data."
      },
      resetPending: false
    });
    expect(listener).toHaveBeenCalledOnce();
  });

  it("runs the accepted-import boundary only after parsing succeeds", async () => {
    const beforeAccept = vi.fn();
    const test = harness();
    const input = { ...importInput(), beforeAccept };

    await expect(
      test.core.importFile({ id: "valid", text: priceSetText() }, input)
    ).resolves.toMatchObject({ status: "ready" });
    expect(beforeAccept).toHaveBeenCalledTimes(1);

    await expect(test.core.importFile({ id: "invalid", text: "{bad" }, input)).resolves.toEqual({
      status: "rejected"
    });
    expect(beforeAccept).toHaveBeenCalledTimes(1);
  });

  it.each([
    {
      label: "storage unavailable",
      overrides: { storageUnavailable: true },
      expectedEvent: "unavailable"
    },
    {
      label: "save throws",
      overrides: {
        saveSelectedPriceSet: vi.fn(() => {
          throw new Error("private storage path");
        })
      },
      expectedEvent: "failure:save_failed"
    }
  ])("keeps a valid import ready when $label", async ({ overrides, expectedEvent }) => {
    const events: string[] = [];
    const test = harness({
      ...overrides,
      markPersistenceUnavailable: vi.fn(() => events.push("unavailable")),
      recordStorageFailure: vi.fn((_id, reason) => events.push(`failure:${reason}`))
    });

    const outcome = await test.core.importFile(
      { id: "session-only", text: priceSetText() },
      importInput()
    );

    expect(outcome.status).toBe("ready");
    if (outcome.status !== "ready") throw new Error("expected ready PriceSet");
    expect(outcome.selectedPersisted).toBe(false);
    expect(outcome.marketNotice).toEqual({
      tone: "neutral",
      message:
        "Imported price set: Imported fixture prices. High alch uses current generated game data. Local restore was not saved."
    });
    expect(events).toContain(expectedEvent);
    expect(test.unblockReplaced).toHaveBeenCalledWith(["price-history", "selected-price-set"]);
  });

  it.each([
    {
      label: "browser size guard",
      text: "",
      readFileText: vi.fn(async () => {
        throw new Error(`File exceeds ${PRICE_SET_IMPORT_MAX_BYTES} bytes`);
      }),
      code: "body_too_large"
    },
    {
      label: "UTF-8 text size guard",
      text: "é".repeat(PRICE_SET_IMPORT_MAX_BYTES / 2 + 1),
      readFileText: undefined,
      code: "body_too_large"
    },
    {
      label: "duplicate keys",
      text: priceSetText().replace('"lobster":220', '"lobster":220,"lobster":221'),
      readFileText: undefined,
      code: "duplicate_keys"
    },
    {
      label: "malformed JSON",
      text: "{bad",
      readFileText: undefined,
      code: "invalid_json"
    },
    {
      label: "invalid schema",
      text: priceSetText({ itemPrices: { lobster: -1 } }),
      readFileText: undefined,
      code: "validation_failed"
    }
  ])("rejects $label without acceptance side effects", async ({ text, readFileText, code }) => {
    const test = harness(readFileText ? { readFileText } : {});

    await expect(test.core.importFile({ id: "invalid", text }, importInput())).resolves.toEqual({
      status: "rejected"
    });

    expect(test.core.getSnapshot().importNotice).toMatchObject({
      tone: "error",
      code
    });
    expect(JSON.stringify(test.core.getSnapshot())).not.toContain(process.cwd());
    expect(test.saveSelectedPriceSet).not.toHaveBeenCalled();
    expect(test.unblockReplaced).not.toHaveBeenCalled();
    expect(test.refreshLocalStateHealth).not.toHaveBeenCalled();
  });

  it("uses the same direct acceptance transaction for legacy data without changing file notice", async () => {
    const test = harness();
    await test.core.importFile({ id: "bad", text: "{bad" }, importInput());
    const previousNotice = test.core.getSnapshot().importNotice;
    const incoming = JSON.parse(priceSetText({ id: "legacy-price-set", label: "Legacy prices" }));

    const outcome = test.core.acceptPriceSet({
      priceSet: incoming,
      acceptedAt: FIXED_NOW,
      nextStatus: "Imported compatible legacy PriceSet",
      gameData: gameData(),
      manualPriceOverrides: DEFAULT_MANUAL_PRICE_OVERRIDES_STATE
    });

    expect(outcome.appStatus).toBe("Imported compatible legacy PriceSet");
    expect(outcome.basePriceSet.id).toBe("legacy-price-set");
    expect(outcome.priceHistoryUpdate(DEFAULT_PRICE_HISTORY_STATE).snapshots).toHaveLength(1);
    expect(test.core.getSnapshot().importNotice).toBe(previousNotice);
  });

  it("retains promise-settlement ordering for concurrent imports", async () => {
    const first = deferred<string>();
    const second = deferred<string>();
    const test = harness({
      readFileText: vi.fn((file: TestFile) =>
        file.id === "first" ? first.promise : second.promise
      )
    });

    const firstImport = test.core.importFile({ id: "first", text: "" }, importInput());
    const secondImport = test.core.importFile({ id: "second", text: "" }, importInput());
    second.resolve(priceSetText({ id: "second-prices", label: "Second prices" }));
    await expect(secondImport).resolves.toMatchObject({ status: "ready" });
    expect(test.core.getSnapshot().importNotice).toMatchObject({ tone: "success" });
    first.resolve("{bad");
    await expect(firstImport).resolves.toEqual({ status: "rejected" });

    expect(test.saveSelectedPriceSet).toHaveBeenCalledOnce();
    expect(test.core.getSnapshot().importNotice).toMatchObject({
      tone: "error",
      code: "invalid_json"
    });
  });

  it("exports the unchanged PriceSet with a sanitized name and closes reset confirmation", () => {
    const test = harness();
    const priceSet = JSON.parse(
      priceSetText({ id: " / active custom ! ", label: "Export me" })
    ) as PriceSet;
    test.core.requestReset("scheduled prices");

    const outcome = test.core.exportPriceSet(priceSet);

    expect(test.downloads).toEqual([
      { fileName: "index-sim-price-set-active-custom.json", value: priceSet }
    ]);
    expect(test.core.getSnapshot().resetPending).toBe(false);
    expect(outcome).toEqual({
      appStatus: "Exported active PriceSet",
      marketNotice: { tone: "success", message: "Exported active PriceSet: Export me" }
    });
  });

  it("notifies only real reset confirmation transitions", () => {
    const test = harness();
    const listener = vi.fn();
    test.core.subscribe(listener);

    expect(test.core.requestReset("bundled prices")).toEqual({
      tone: "neutral",
      message:
        "Confirm reset imported PriceSet to bundled prices. Manual item prices and local price history will be kept."
    });
    test.core.requestReset("bundled prices");
    test.core.cancelReset();
    test.core.cancelReset();

    expect(listener).toHaveBeenCalledTimes(2);
    expect(test.core.getSnapshot().resetPending).toBe(false);
  });

  it.each([
    {
      label: "available storage",
      overrides: {},
      persistedReset: true,
      tone: "success",
      appStatus: "Reset to scheduled prices",
      expectedEvent: "clear-failure"
    },
    {
      label: "unavailable storage",
      overrides: { storageUnavailable: true },
      persistedReset: false,
      tone: "neutral",
      appStatus: "Reset to scheduled prices for this session",
      expectedEvent: "unavailable"
    },
    {
      label: "failed clear",
      overrides: {
        clearSelectedPriceSet: vi.fn(() => {
          throw new Error("private storage path");
        })
      },
      persistedReset: false,
      tone: "neutral",
      appStatus: "Reset to scheduled prices for this session",
      expectedEvent: "failure:clear_failed"
    }
  ])(
    "resets to a manual-overlay fallback with $label",
    ({ overrides, persistedReset, tone, appStatus, expectedEvent }) => {
      const events: string[] = [];
      const test = harness({
        ...overrides,
        clearStorageFailures: vi.fn(() => events.push("clear-failure")),
        markPersistenceUnavailable: vi.fn(() => events.push("unavailable")),
        recordStorageFailure: vi.fn((_id, reason) => events.push(`failure:${reason}`)),
        refreshLocalStateHealth: vi.fn(() => events.push("refresh"))
      });
      const fallback = JSON.parse(
        priceSetText({ id: "scheduled", label: "Scheduled", itemPrices: { lobster: 200 } })
      ) as PriceSet;
      const manual = setManualPriceOverride(
        DEFAULT_MANUAL_PRICE_OVERRIDES_STATE,
        "lobster",
        777,
        FIXED_NOW
      );
      test.core.requestReset("scheduled prices");

      const outcome = test.core.resetToFallback({
        fallbackPriceSet: fallback,
        fallbackOrigin: "scheduled",
        fallbackLabel: "scheduled prices",
        manualPriceOverrides: manual
      });

      expect(outcome).toMatchObject({
        status: "ready",
        basePriceSet: fallback,
        activePriceSet: { itemPrices: { lobster: 777 } },
        activePriceSetOrigin: "scheduled",
        persistedReset,
        appStatus,
        marketNotice: { tone }
      });
      expect(events).toContain(expectedEvent);
      expect(events.at(-1)).toBe("refresh");
      expect(test.core.getSnapshot().resetPending).toBe(false);
    }
  );
});
