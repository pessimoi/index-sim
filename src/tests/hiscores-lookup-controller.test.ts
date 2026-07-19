import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import {
  HISCORES_LAST_PLAYER_STORAGE_KEY,
  HiscoresAdapterError,
  loadLastHiscoresPlayer,
  saveLastHiscoresPlayer
} from "../adapters/hiscores";
import { createMemoryStorage, type KeyValueStorage } from "../adapters/storage";
import { HiscoresPanel } from "../app/components/topbar/hiscores-panel";
import {
  describeHiscoresError,
  HiscoresLookupControllerCore,
  type HiscoresLookupDependencies
} from "../app/controllers/hiscores-lookup";
import type { HiscoresResponse, HiscoresStatusResponse } from "../domain/shared";

const AVAILABLE_STATUS: HiscoresStatusResponse = {
  available: true,
  source: { id: "mock-hiscores", label: "Mock hiscores" }
};

function hiscoresResponse(
  player: string,
  skills: HiscoresResponse["skills"] = {
    attack: { level: 61 },
    hitpoints: { level: 63 }
  }
): HiscoresResponse {
  return {
    player,
    normalizedPlayer: player,
    source: { id: "mock-hiscores", label: "Mock hiscores" },
    fetchedAt: "2026-07-13T12:00:00.000Z",
    skills,
    warnings: []
  };
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

interface ControllerOptions {
  storage?: KeyValueStorage;
  fetchStatus?: HiscoresLookupDependencies["fetchStatus"];
  lookupPlayer?: HiscoresLookupDependencies["lookupPlayer"];
}

function controller(options: ControllerOptions = {}) {
  const clearStorageFailures = vi.fn();
  const recordStorageFailure = vi.fn();
  const unblockReplaced = vi.fn();
  const refreshLocalStateHealth = vi.fn();
  const lookupPlayer =
    options.lookupPlayer ?? vi.fn(async (player: string) => hiscoresResponse(player));
  const core = new HiscoresLookupControllerCore({
    storage: options.storage ?? createMemoryStorage(),
    fetchStatus: options.fetchStatus ?? vi.fn(async () => AVAILABLE_STATUS),
    lookupPlayer,
    clearStorageFailures,
    recordStorageFailure,
    unblockReplaced,
    refreshLocalStateHealth
  });
  return {
    core,
    lookupPlayer,
    clearStorageFailures,
    recordStorageFailure,
    unblockReplaced,
    refreshLocalStateHealth
  };
}

async function enableLookup(core: HiscoresLookupControllerCore): Promise<void> {
  await core.loadStatus();
  expect(core.getSnapshot().statusLabel).toBe("available");
}

describe("Hiscores lookup controller", () => {
  it("loads the stored player and transitions status without creating a response", async () => {
    const storage = createMemoryStorage();
    saveLastHiscoresPlayer(storage, "Fixture Player");
    const { core } = controller({ storage });

    expect(core.getSnapshot()).toMatchObject({
      status: null,
      statusLabel: "checking",
      available: false,
      player: "Fixture Player",
      response: null,
      busy: false,
      previewOpen: false,
      notice: null
    });

    await core.loadStatus();

    expect(core.getSnapshot()).toMatchObject({
      status: AVAILABLE_STATUS,
      statusLabel: "available",
      available: true,
      response: null,
      notice: null
    });
  });

  it("covers disabled, unavailable, rejected and cancelled status outcomes", async () => {
    const disabled = controller({
      fetchStatus: vi.fn(async () => ({
        available: false,
        source: { id: "disabled", label: "Disabled" }
      }))
    }).core;
    await disabled.loadStatus();
    expect(disabled.getSnapshot()).toMatchObject({
      statusLabel: "disabled",
      available: false,
      notice: {
        tone: "neutral",
        message:
          "Live hiscores lookup is not configured in this run. Use the Player level fields above to edit levels manually."
      }
    });

    const unavailable = controller({
      fetchStatus: vi.fn(async () => ({
        available: false,
        source: { id: "offline", label: "Offline" }
      }))
    }).core;
    await unavailable.loadStatus();
    expect(unavailable.getSnapshot()).toMatchObject({
      statusLabel: "unavailable",
      notice: {
        tone: "neutral",
        message:
          "Hiscores lookup is unavailable right now. Use the Player level fields above to edit levels manually."
      }
    });

    const rejected = controller({
      fetchStatus: vi.fn().mockRejectedValue(new Error("private upstream detail"))
    }).core;
    await rejected.loadStatus();
    expect(rejected.getSnapshot()).toMatchObject({
      status: null,
      statusLabel: "checking",
      notice: {
        tone: "error",
        message: "Hiscores lookup failed. Player level fields still work for manual edits."
      }
    });
    expect(rejected.getSnapshot().notice?.message).not.toContain("private upstream detail");

    const pending = deferred<HiscoresStatusResponse>();
    const cancelled = controller({ fetchStatus: () => pending.promise }).core;
    const statusRequest = cancelled.loadStatus(() => true);
    pending.resolve(AVAILABLE_STATUS);
    await statusRequest;
    expect(cancelled.getSnapshot()).toMatchObject({
      status: null,
      statusLabel: "checking",
      notice: null
    });
  });

  it("does not call lookup for empty input or an unavailable service", async () => {
    const empty = controller();
    await empty.core.lookup();
    expect(empty.lookupPlayer).not.toHaveBeenCalled();
    expect(empty.core.getSnapshot().notice).toEqual({
      tone: "error",
      message: "Enter a player name"
    });

    const unavailable = controller({
      fetchStatus: vi.fn(async () => ({
        available: false,
        source: { id: "disabled", label: "Disabled" }
      }))
    });
    unavailable.core.changePlayer("Fixture Player");
    await unavailable.core.loadStatus();
    await unavailable.core.lookup();
    expect(unavailable.lookupPlayer).not.toHaveBeenCalled();
    expect(unavailable.core.getSnapshot().notice).toEqual({
      tone: "error",
      message:
        "Live hiscores lookup is not configured in this run. Use the Player level fields above to edit levels manually."
    });
  });

  it("opens and persists only a matching fresh response through the recovery bridge", async () => {
    const storage = createMemoryStorage();
    const lookupPlayer = vi.fn(async () => hiscoresResponse("Fixture Player"));
    const harness = controller({ storage, lookupPlayer });
    harness.core.changePlayer("  Fixture   Player  ");
    await enableLookup(harness.core);

    await harness.core.lookup();

    expect(lookupPlayer).toHaveBeenCalledWith("  Fixture   Player  ");
    expect(harness.core.getSnapshot()).toMatchObject({
      response: { player: "Fixture Player" },
      previewOpen: true,
      busy: false,
      notice: { tone: "success", message: "Hiscores preview ready" }
    });
    expect(loadLastHiscoresPlayer(storage)).toBe("Fixture Player");
    expect(storage.getItem(HISCORES_LAST_PLAYER_STORAGE_KEY)).not.toContain("skills");
    expect(harness.clearStorageFailures).toHaveBeenCalledWith(["hiscores-last-player"]);
    expect(harness.recordStorageFailure).not.toHaveBeenCalled();
    expect(harness.unblockReplaced).toHaveBeenCalledWith(["hiscores-last-player"]);
    expect(harness.refreshLocalStateHealth).toHaveBeenCalledTimes(1);
  });

  it("rejects a latest late response when the player changed", async () => {
    const pending = deferred<HiscoresResponse>();
    const storage = createMemoryStorage();
    const harness = controller({ storage, lookupPlayer: () => pending.promise });
    harness.core.changePlayer("Fixture Player");
    await enableLookup(harness.core);
    const request = harness.core.lookup();

    harness.core.changePlayer("Other Player");
    pending.resolve(hiscoresResponse("Fixture Player"));
    await request;

    expect(harness.core.getSnapshot()).toMatchObject({
      player: "Other Player",
      response: null,
      previewOpen: false,
      busy: false,
      notice: {
        tone: "neutral",
        message: "Player changed before lookup completed. Run Lookup again."
      }
    });
    expect(storage.getItem(HISCORES_LAST_PLAYER_STORAGE_KEY)).toBeNull();
    expect(harness.unblockReplaced).not.toHaveBeenCalled();
  });

  it("ignores superseded responses and errors without clearing a newer busy state", async () => {
    const first = deferred<HiscoresResponse>();
    const second = deferred<HiscoresResponse>();
    const third = deferred<HiscoresResponse>();
    const fourth = deferred<HiscoresResponse>();
    const requests = [first, second, third, fourth];
    const harness = controller({
      lookupPlayer: vi.fn(() => requests.shift()?.promise ?? Promise.reject(new Error("extra")))
    });
    await enableLookup(harness.core);

    harness.core.changePlayer("First Player");
    const firstRequest = harness.core.lookup();
    harness.core.changePlayer("Second Player");
    const secondRequest = harness.core.lookup();
    first.resolve(hiscoresResponse("First Player"));
    await firstRequest;
    expect(harness.core.getSnapshot()).toMatchObject({
      player: "Second Player",
      response: null,
      busy: true,
      notice: { tone: "neutral", message: "Looking up hiscores" }
    });
    second.resolve(hiscoresResponse("Second Player"));
    await secondRequest;
    expect(harness.core.getSnapshot()).toMatchObject({
      response: { player: "Second Player" },
      busy: false
    });

    harness.core.changePlayer("Third Player");
    const thirdRequest = harness.core.lookup();
    harness.core.changePlayer("Fourth Player");
    const fourthRequest = harness.core.lookup();
    third.reject(new Error("private old error"));
    await thirdRequest;
    expect(harness.core.getSnapshot()).toMatchObject({
      player: "Fourth Player",
      response: null,
      busy: true,
      notice: { tone: "neutral", message: "Looking up hiscores" }
    });
    fourth.resolve(hiscoresResponse("Fourth Player"));
    await fourthRequest;
    expect(harness.core.getSnapshot()).toMatchObject({
      response: { player: "Fourth Player" },
      busy: false,
      notice: { tone: "success", message: "Hiscores preview ready" }
    });
  });

  it("keeps normalized-same previews and clears only stale response success state", async () => {
    const harness = controller({
      lookupPlayer: vi.fn(async () => hiscoresResponse("Fixture Player"))
    });
    harness.core.changePlayer("Fixture Player");
    await enableLookup(harness.core);
    await harness.core.lookup();

    harness.core.changePlayer("  FIXTURE   PLAYER ");
    expect(harness.core.getSnapshot()).toMatchObject({
      response: { player: "Fixture Player" },
      previewOpen: true,
      notice: { tone: "success", message: "Hiscores preview ready" }
    });

    harness.core.changePlayer("Other Player");
    expect(harness.core.getSnapshot()).toMatchObject({
      response: null,
      previewOpen: false,
      notice: null
    });
  });

  it.each([
    [new HiscoresAdapterError("bad-request", "raw bad request"), "Check the player name"],
    [new HiscoresAdapterError("not-found", "raw missing"), "Player not found"],
    [new HiscoresAdapterError("rate-limited", "raw rate"), "Rate limited"],
    [
      new HiscoresAdapterError("rate-limited", "raw rate", { retryAfterSeconds: 12 }),
      "Rate limited. Try again in 12 s"
    ],
    [
      new HiscoresAdapterError("upstream-unavailable", "raw unavailable"),
      "Hiscores lookup is unavailable right now. Use the Player level fields above to edit levels manually."
    ],
    [new HiscoresAdapterError("upstream-invalid", "raw invalid"), "Hiscores response invalid"],
    [
      new HiscoresAdapterError("internal-error", "raw internal"),
      "Hiscores lookup failed. Player level fields still work for manual edits."
    ],
    [
      new Error("raw private failure"),
      "Hiscores lookup failed. Player level fields still work for manual edits."
    ]
  ])("maps adapter failures to fixed sanitized copy", (error, expected) => {
    expect(describeHiscoresError(error)).toBe(expected);
    expect(describeHiscoresError(error)).not.toContain(error.message);
  });

  it("keeps a fresh preview when last-player persistence fails", async () => {
    const backing = createMemoryStorage();
    const storage: KeyValueStorage = {
      getItem: backing.getItem,
      removeItem: backing.removeItem,
      setItem: () => {
        throw new Error("private storage detail");
      }
    };
    const harness = controller({
      storage,
      lookupPlayer: vi.fn(async () => hiscoresResponse("Fixture Player"))
    });
    harness.core.changePlayer("Fixture Player");
    await enableLookup(harness.core);

    await harness.core.lookup();

    expect(harness.core.getSnapshot()).toMatchObject({
      response: { player: "Fixture Player" },
      previewOpen: true,
      notice: { tone: "success", message: "Hiscores preview ready" }
    });
    expect(harness.recordStorageFailure).toHaveBeenCalledWith(
      "hiscores-last-player",
      "save_failed"
    );
    expect(harness.clearStorageFailures).not.toHaveBeenCalled();
    expect(harness.unblockReplaced).toHaveBeenCalledWith(["hiscores-last-player"]);
    expect(harness.refreshLocalStateHealth).toHaveBeenCalledTimes(1);
  });

  it("replaces a compatible legacy player without lookup and exposes typed Apply outcomes", async () => {
    const storage = createMemoryStorage();
    const harness = controller({
      storage,
      lookupPlayer: vi.fn(async () => hiscoresResponse("Fixture Player"))
    });

    expect(harness.core.replacePersistedPlayer("Legacy Player")).toBe(true);
    expect(harness.core.getSnapshot().player).toBe("Legacy Player");
    expect(loadLastHiscoresPlayer(storage)).toBe("Legacy Player");
    expect(harness.lookupPlayer).not.toHaveBeenCalled();

    harness.core.changePlayer("Fixture Player");
    await enableLookup(harness.core);
    await harness.core.lookup();
    const ready = harness.core.prepareApply();
    expect(ready).toMatchObject({
      status: "ready",
      response: { player: "Fixture Player" },
      applicableSkillCount: 2
    });
    harness.core.recordApplied(2);
    expect(harness.core.getSnapshot().notice).toEqual({
      tone: "success",
      message: "Applied 2 skills"
    });

    harness.core.changePlayer("Other Player");
    expect(harness.core.prepareApply()).toEqual({ status: "stale" });
    expect(harness.core.getSnapshot()).toMatchObject({
      response: null,
      notice: {
        tone: "neutral",
        message: "Hiscores preview no longer matches Player. Run Lookup again."
      }
    });
  });
});

describe("Hiscores topbar panel", () => {
  const baseProps = {
    statusLabel: "available" as const,
    available: true,
    player: "Fixture Player",
    response: null,
    busy: false,
    previewOpen: false,
    notice: null,
    previewRows: [],
    canApply: false,
    onPlayerChange: () => undefined,
    onLookup: async () => undefined,
    onPreviewOpenChange: () => undefined,
    onApply: () => undefined
  };

  it("preserves the landmark, form names, notice roles and busy state", () => {
    const idle = renderToStaticMarkup(createElement(HiscoresPanel, baseProps));
    const error = renderToStaticMarkup(
      createElement(HiscoresPanel, {
        ...baseProps,
        statusLabel: "disabled",
        available: false,
        notice: { tone: "error", message: "Player not found" }
      })
    );
    const busy = renderToStaticMarkup(createElement(HiscoresPanel, { ...baseProps, busy: true }));

    expect(idle).toContain('<section class="topbar-hiscores" aria-label="Hiscores">');
    expect(idle).toContain('<label class="visually-hidden" for="hiscores-player">Player</label>');
    expect(idle).toContain('id="hiscores-player"');
    expect(idle).toContain('placeholder="Player name"');
    expect(idle).toContain("Lookup</button>");
    expect(error).toContain('class="inline-status error" role="alert"');
    expect(error).toContain("Player not found");
    expect(error).toContain("disabled");
    expect(busy).toContain("Looking up</button>");
    expect(busy).toContain("disabled");
  });

  it("preserves preview metadata, disclosure, table and Apply DOM", () => {
    const response = hiscoresResponse("Fixture Player");
    const markup = renderToStaticMarkup(
      createElement(HiscoresPanel, {
        ...baseProps,
        response,
        previewOpen: true,
        notice: { tone: "success", message: "Hiscores preview ready" },
        previewRows: [{ skill: "attack", currentLevel: 60, fetchedLevel: 61, canApply: true }],
        canApply: true
      })
    );

    expect(markup).toContain('<details class="hiscores-preview-details" open="">');
    expect(markup).toContain("Review 1 levels");
    expect(markup).toContain("Preview for <strong>Fixture Player</strong>");
    expect(markup).toContain("Source: Mock hiscores");
    expect(markup).toContain("Fetched: 2026-07-13T12:00:00.000Z");
    expect(markup).toContain('<table aria-label="Hiscores preview">');
    expect(markup).toContain("<th>Current</th>");
    expect(markup).toContain("<th>Hiscores</th>");
    expect(markup).toContain("Apply</button>");
    expect(markup).toContain('class="inline-status success" role="status"');
  });
});
