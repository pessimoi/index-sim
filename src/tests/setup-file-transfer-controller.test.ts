import { createGeneratedRuntimeContext } from "../adapters/generated";
import {
  SetupFileTransferControllerCore,
  describeSetupFileTransferError,
  type SetupFileTransferDependencies
} from "../app/controllers/setup-file-transfer";
import {
  REWRITE_SETUP_TRANSFER_KIND,
  REWRITE_SETUP_TRANSFER_VERSION,
  SETUP_IMPORT_MAX_BYTES,
  SetupImportError,
  createRewriteSetupTransferEnvelope
} from "../app/state/setup-import";
import {
  DEFAULT_FORM_STATE,
  REWRITE_SETUP_VERSION,
  savedSetupFromForm,
  type SavedSetupState
} from "../app/state/ui-state";

const FIXED_NOW = new Date("2026-07-13T12:34:56.000Z");

interface TestFile {
  id: string;
  text: string;
}

function setupFixture(monsterId = "dagannoth"): SavedSetupState {
  const form = {
    ...DEFAULT_FORM_STATE,
    monsterId,
    levels: { ...DEFAULT_FORM_STATE.levels, attack: 73, strength: 74 }
  };
  return savedSetupFromForm(
    form,
    {
      sort: { key: "monsterName", direction: "asc" },
      monsterFilter: "dragon",
      dropFilter: "bones",
      showIrrelevant: true,
      irrelevantMonsterIds: ["rock_crab"]
    },
    { [monsterId]: { enabled: true, targets: 4, respawnSec: 45 } },
    { [monsterId]: form },
    form,
    "custom"
  );
}

function setupEnvelope(setup = setupFixture()): string {
  return JSON.stringify({
    version: REWRITE_SETUP_VERSION,
    savedAt: "2026-07-12T00:00:00.000Z",
    data: setup
  });
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

function controller(overrides: Partial<SetupFileTransferDependencies<TestFile>> = {}) {
  const downloads: Array<{ fileName: string; value: unknown }> = [];
  const readFileText = vi.fn(async (file: TestFile) => file.text);
  const downloadJsonFile = vi.fn((fileName: string, value: unknown) => {
    downloads.push({ fileName, value });
  });
  const core = new SetupFileTransferControllerCore<TestFile>({
    readFileText,
    downloadJsonFile,
    now: () => FIXED_NOW,
    ...overrides
  });
  return { core, downloads, readFileText, downloadJsonFile };
}

describe("rewrite setup file-transfer controller", () => {
  it("starts idle and exports the supplied setup without changing import state", () => {
    const { context } = createGeneratedRuntimeContext();
    const setup = setupFixture();
    const harness = controller();

    expect(harness.core.getSnapshot()).toEqual({ phase: "idle", notice: null, review: null });
    harness.core.exportSetup(setup, context.gameData);

    expect(harness.downloads).toEqual([
      {
        fileName: "index-sim-rewrite-setup.json",
        value: {
          kind: REWRITE_SETUP_TRANSFER_KIND,
          version: REWRITE_SETUP_TRANSFER_VERSION,
          exportedAt: FIXED_NOW.toISOString(),
          context: {
            gameDataId: context.gameData.id,
            gameRevision: 274
          },
          data: setup
        }
      }
    ]);
    expect(harness.core.getSnapshot()).toEqual({ phase: "idle", notice: null, review: null });
  });

  it("prepares one validated in-memory review with resolved bounded metadata", async () => {
    const { context } = createGeneratedRuntimeContext();
    const setup = setupFixture();
    const harness = controller();
    const listener = vi.fn();
    harness.core.subscribe(listener);

    const outcome = await harness.core.prepareImport(
      { id: "valid", text: setupEnvelope(setup) },
      context.gameData
    );

    expect(outcome).toEqual({ status: "review", reviewId: 1 });
    expect(harness.readFileText).toHaveBeenCalledWith(
      expect.objectContaining({ id: "valid" }),
      SETUP_IMPORT_MAX_BYTES
    );
    expect(harness.core.getSnapshot()).toMatchObject({
      phase: "review",
      notice: null,
      review: {
        id: 1,
        setup,
        context: {
          match: "unknown",
          tone: "warning",
          source: null
        },
        summary: {
          targetLabel: context.gameData.monsters.dagannoth?.name,
          combatStyle: "melee",
          setupMode: "custom",
          customSetupCount: 1,
          cannonMonsterCount: 1,
          denseSort: { key: "monsterName", direction: "asc" },
          irrelevantMonsterCount: 1
        }
      }
    });
    expect(listener).toHaveBeenCalledTimes(2);
  });

  it("carries exact and mismatched contextual files into review without applying them", async () => {
    const { context } = createGeneratedRuntimeContext();
    const exact = createRewriteSetupTransferEnvelope(setupFixture(), context.gameData, FIXED_NOW);
    const harness = controller();

    await harness.core.prepareImport(
      { id: "exact", text: JSON.stringify(exact) },
      context.gameData
    );
    expect(harness.core.getSnapshot().review?.context).toMatchObject({
      match: "exact-snapshot",
      tone: "ready"
    });

    const different = structuredClone(exact);
    different.context.gameRevision = 273;
    await harness.core.prepareImport(
      { id: "different", text: JSON.stringify(different) },
      context.gameData
    );
    expect(harness.core.getSnapshot().review?.context).toMatchObject({
      match: "different-revision",
      tone: "warning",
      message:
        "Created for Revision 273; this app uses Revision 274. Available ids are compatible, but combat, loot and requirements may differ."
    });
  });

  it("dismisses or consumes only the current review and consumes it once", async () => {
    const { context } = createGeneratedRuntimeContext();
    const setup = setupFixture();
    const harness = controller();

    await harness.core.prepareImport(
      { id: "dismiss", text: setupEnvelope(setup) },
      context.gameData
    );
    expect(harness.core.dismissReview(999)).toBe(false);
    expect(harness.core.dismissReview(1)).toBe(true);
    expect(harness.core.consumeReview(1)).toBeNull();

    await harness.core.prepareImport(
      { id: "consume", text: setupEnvelope(setup) },
      context.gameData
    );
    expect(harness.core.consumeReview(1)).toBeNull();
    expect(harness.core.consumeReview(2)).toMatchObject({
      setup,
      context: { match: "unknown" }
    });
    expect(harness.core.consumeReview(2)).toBeNull();
    expect(harness.core.getSnapshot()).toEqual({ phase: "idle", notice: null, review: null });
  });

  it("maps browser-reader and UTF-8 parser size failures to the same fixed copy", async () => {
    const { context } = createGeneratedRuntimeContext();
    const readerFailure = controller({
      readFileText: vi.fn(async () => {
        throw new Error(`File exceeds ${SETUP_IMPORT_MAX_BYTES} bytes`);
      })
    });
    const parserFailure = controller();

    await expect(
      readerFailure.core.prepareImport({ id: "reader-large", text: "" }, context.gameData)
    ).resolves.toEqual({ status: "rejected" });
    await expect(
      parserFailure.core.prepareImport(
        { id: "utf8-large", text: "é".repeat(SETUP_IMPORT_MAX_BYTES / 2 + 1) },
        context.gameData
      )
    ).resolves.toEqual({ status: "rejected" });

    const expectedNotice = {
      tone: "error",
      message:
        "Setup import failed: the file is too large. Choose an exported setup JSON under 250 KB."
    };
    expect(readerFailure.core.getSnapshot()).toEqual({
      phase: "idle",
      notice: expectedNotice,
      review: null
    });
    expect(parserFailure.core.getSnapshot()).toEqual({
      phase: "idle",
      notice: expectedNotice,
      review: null
    });
  });

  it.each([
    {
      label: "duplicate keys",
      text: setupEnvelope().replace(
        `"version":${REWRITE_SETUP_VERSION}`,
        `"version":${REWRITE_SETUP_VERSION},"version":${REWRITE_SETUP_VERSION}`
      ),
      message: "Setup import failed: the JSON contains duplicate keys."
    },
    {
      label: "malformed JSON",
      text: "{bad",
      message: "Setup import failed: the file is not valid JSON."
    },
    {
      label: "unsupported version",
      text: setupEnvelope().replace(
        `"version":${REWRITE_SETUP_VERSION}`,
        `"version":${REWRITE_SETUP_VERSION + 1}`
      ),
      message:
        "Setup import failed: this app supports contextual setup file version 1 or legacy rewrite setup version 3. Export a fresh setup and try again."
    },
    {
      label: "invalid data",
      text: JSON.stringify({
        version: REWRITE_SETUP_VERSION,
        savedAt: FIXED_NOW.toISOString(),
        data: {}
      }),
      message: "Setup import failed: the file is not a valid rewrite setup export."
    },
    {
      label: "incompatible entity",
      text: (() => {
        const setup = setupFixture();
        setup.form.monsterId = "private_missing_monster";
        return setupEnvelope(setup);
      })(),
      message: "Setup import failed: the setup references data unavailable in this game version."
    }
  ])("rejects $label without creating a review", async ({ text, message }) => {
    const { context } = createGeneratedRuntimeContext();
    const harness = controller();

    await expect(
      harness.core.prepareImport({ id: "invalid", text }, context.gameData)
    ).resolves.toEqual({ status: "rejected" });
    expect(harness.core.getSnapshot()).toMatchObject({
      phase: "idle",
      notice: { tone: "error", message },
      review: null
    });
    expect(JSON.stringify(harness.core.getSnapshot())).not.toContain("private_missing_monster");
  });

  it("sanitizes unexpected reader failures and parser issue details", async () => {
    const { context } = createGeneratedRuntimeContext();
    const harness = controller({
      readFileText: vi.fn(async () => {
        throw new Error("private reader failure at /Users/person/secret.json");
      })
    });

    await harness.core.prepareImport({ id: "reader-failure", text: "" }, context.gameData);
    expect(harness.core.getSnapshot()).toEqual({
      phase: "idle",
      notice: { tone: "error", message: "Setup import failed. Check the file and try again." },
      review: null
    });
    expect(JSON.stringify(harness.core.getSnapshot())).not.toContain("private reader");

    const notice = describeSetupFileTransferError(
      new SetupImportError(
        "invalid_data",
        Array.from(
          { length: 7 },
          (_, index) =>
            `form.${index}: /Users/person/private-${index}.json   ${"detail ".repeat(60)}\nend`
        )
      )
    );
    expect(notice.details).toHaveLength(5);
    for (const detail of notice.details ?? []) {
      expect(detail.length).toBeLessThanOrEqual(180);
      expect(detail).not.toContain("/Users/person");
      expect(detail).not.toContain("\n");
      expect(detail).not.toMatch(/\s{2,}/);
    }
  });

  it("keeps only the latest attempt when reads settle out of order", async () => {
    const { context } = createGeneratedRuntimeContext();
    const firstRead = deferred<string>();
    const secondRead = deferred<string>();
    const harness = controller({
      readFileText: (file) => (file.id === "first" ? firstRead.promise : secondRead.promise)
    });
    const firstOutcome = harness.core.prepareImport({ id: "first", text: "" }, context.gameData);
    const secondOutcome = harness.core.prepareImport({ id: "second", text: "" }, context.gameData);

    secondRead.resolve(setupEnvelope(setupFixture("rock_crab")));
    await expect(secondOutcome).resolves.toEqual({ status: "review", reviewId: 2 });
    firstRead.resolve(setupEnvelope(setupFixture("dagannoth")));
    await expect(firstOutcome).resolves.toEqual({ status: "stale" });
    expect(harness.core.getSnapshot().review).toMatchObject({
      id: 2,
      setup: { form: { monsterId: "rock_crab" } }
    });
  });

  it("ignores a late error from an invalidated attempt", async () => {
    const { context } = createGeneratedRuntimeContext();
    const firstRead = deferred<string>();
    const harness = controller({
      readFileText: (file) =>
        file.id === "first" ? firstRead.promise : Promise.resolve(setupEnvelope())
    });
    const firstOutcome = harness.core.prepareImport({ id: "first", text: "" }, context.gameData);
    await harness.core.prepareImport({ id: "second", text: "" }, context.gameData);

    firstRead.reject(new Error("private stale error"));
    await expect(firstOutcome).resolves.toEqual({ status: "stale" });
    expect(harness.core.getSnapshot()).toMatchObject({
      phase: "review",
      notice: null,
      review: { id: 2 }
    });
  });
});
