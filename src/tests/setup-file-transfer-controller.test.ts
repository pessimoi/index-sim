import { createGeneratedRuntimeContext } from "../adapters/generated";
import {
  SetupFileTransferControllerCore,
  describeSetupFileTransferError,
  type SetupFileTransferDependencies
} from "../app/controllers/setup-file-transfer";
import { SETUP_IMPORT_MAX_BYTES, SetupImportError } from "../app/state/setup-import";
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
  return savedSetupFromForm({
    ...DEFAULT_FORM_STATE,
    monsterId,
    levels: { ...DEFAULT_FORM_STATE.levels, attack: 73, strength: 74 }
  });
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
  const events: string[] = [];
  const downloads: Array<{ fileName: string; value: unknown }> = [];
  const readFileText = vi.fn(async (file: TestFile) => {
    events.push(`read:${file.id}`);
    return file.text;
  });
  const persistSetup = vi.fn(() => {
    events.push("persist");
    return true;
  });
  const unblockReplaced = vi.fn(() => events.push("unblock:rewrite-setup"));
  const refreshLocalStateHealth = vi.fn(() => events.push("refresh"));
  const downloadJsonFile = vi.fn((fileName: string, value: unknown) => {
    downloads.push({ fileName, value });
  });
  const core = new SetupFileTransferControllerCore<TestFile>({
    readFileText,
    persistSetup,
    unblockReplaced,
    refreshLocalStateHealth,
    downloadJsonFile,
    now: () => FIXED_NOW,
    ...overrides
  });
  return {
    core,
    events,
    downloads,
    readFileText,
    persistSetup,
    unblockReplaced,
    refreshLocalStateHealth,
    downloadJsonFile
  };
}

describe("rewrite setup file-transfer controller", () => {
  it("starts without a notice and exports the supplied setup without side effects", () => {
    const setup = setupFixture();
    const harness = controller();

    expect(harness.core.getSnapshot()).toEqual({ notice: null });

    harness.core.exportSetup(setup);

    expect(harness.downloadJsonFile).toHaveBeenCalledTimes(1);
    expect(harness.downloads).toEqual([
      {
        fileName: "index-sim-rewrite-setup.json",
        value: {
          version: REWRITE_SETUP_VERSION,
          savedAt: FIXED_NOW.toISOString(),
          data: setup
        }
      }
    ]);
    expect(harness.persistSetup).not.toHaveBeenCalled();
    expect(harness.unblockReplaced).not.toHaveBeenCalled();
    expect(harness.refreshLocalStateHealth).not.toHaveBeenCalled();
    expect(harness.core.getSnapshot()).toEqual({ notice: null });
  });

  it("returns the exact validated setup and sequences persistence before recovery", async () => {
    const { context } = createGeneratedRuntimeContext();
    const setup = setupFixture();
    const harness = controller();
    const listener = vi.fn();
    const unsubscribe = harness.core.subscribe(listener);

    const outcome = await harness.core.importFile(
      { id: "valid", text: setupEnvelope(setup) },
      context.gameData
    );

    expect(outcome).toEqual({
      status: "ready",
      setup,
      persisted: true,
      appStatus: "Imported rewrite setup"
    });
    expect(harness.readFileText).toHaveBeenCalledWith(
      expect.objectContaining({ id: "valid" }),
      SETUP_IMPORT_MAX_BYTES
    );
    expect(harness.persistSetup).toHaveBeenCalledTimes(1);
    expect(harness.persistSetup).toHaveBeenCalledWith(setup);
    expect(harness.unblockReplaced).toHaveBeenCalledWith(["rewrite-setup"]);
    expect(harness.refreshLocalStateHealth).toHaveBeenCalledTimes(1);
    expect(harness.events).toEqual(["read:valid", "persist", "unblock:rewrite-setup", "refresh"]);
    expect(harness.core.getSnapshot().notice).toEqual({
      tone: "success",
      message: "Imported rewrite setup."
    });
    expect(listener).toHaveBeenCalledTimes(1);

    unsubscribe();
  });

  it("keeps a valid import ready when persistence is unavailable", async () => {
    const { context } = createGeneratedRuntimeContext();
    const setup = setupFixture();
    const persistSetup = vi.fn(() => false);
    const harness = controller({ persistSetup });

    const outcome = await harness.core.importFile(
      { id: "session-only", text: setupEnvelope(setup) },
      context.gameData
    );

    expect(outcome).toEqual({
      status: "ready",
      setup,
      persisted: false,
      appStatus: "Imported rewrite setup for this session"
    });
    expect(persistSetup).toHaveBeenCalledOnce();
    expect(harness.unblockReplaced).toHaveBeenCalledWith(["rewrite-setup"]);
    expect(harness.refreshLocalStateHealth).toHaveBeenCalledOnce();
    expect(harness.core.getSnapshot().notice).toEqual({
      tone: "success",
      message:
        "Imported rewrite setup for this session. Local storage is unavailable, so changes may not persist after reload."
    });
  });

  it("maps browser-reader and UTF-8 parser size failures to the same fixed copy", async () => {
    const { context } = createGeneratedRuntimeContext();
    const readerFailure = controller({
      readFileText: vi.fn(async () => {
        throw new Error(`File exceeds ${SETUP_IMPORT_MAX_BYTES} bytes`);
      })
    });

    await expect(
      readerFailure.core.importFile({ id: "reader-large", text: "" }, context.gameData)
    ).resolves.toEqual({ status: "rejected" });

    const parserFailure = controller();
    await expect(
      parserFailure.core.importFile(
        { id: "utf8-large", text: "é".repeat(SETUP_IMPORT_MAX_BYTES / 2 + 1) },
        context.gameData
      )
    ).resolves.toEqual({ status: "rejected" });

    const expectedNotice = {
      tone: "error",
      message:
        "Setup import failed: the file is too large. Choose an exported setup JSON under 250 KB."
    };
    expect(readerFailure.core.getSnapshot().notice).toEqual(expectedNotice);
    expect(parserFailure.core.getSnapshot().notice).toEqual(expectedNotice);
    expect(readerFailure.persistSetup).not.toHaveBeenCalled();
    expect(parserFailure.persistSetup).not.toHaveBeenCalled();
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
        "Setup import failed: this app only supports rewrite setup version 3. Export a fresh setup and try again."
    },
    {
      label: "invalid data",
      text: JSON.stringify({
        version: REWRITE_SETUP_VERSION,
        savedAt: "2026-07-12T00:00:00.000Z",
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
  ])("rejects $label without persistence or recovery", async ({ text, message }) => {
    const { context } = createGeneratedRuntimeContext();
    const harness = controller();

    const outcome = await harness.core.importFile({ id: "invalid", text }, context.gameData);

    expect(outcome).toEqual({ status: "rejected" });
    expect(harness.core.getSnapshot().notice).toMatchObject({ tone: "error", message });
    expect(JSON.stringify(harness.core.getSnapshot())).not.toContain("private_missing_monster");
    expect(harness.persistSetup).not.toHaveBeenCalled();
    expect(harness.unblockReplaced).not.toHaveBeenCalled();
    expect(harness.refreshLocalStateHealth).not.toHaveBeenCalled();
  });

  it("sanitizes unexpected reader and persistence failures without mutation authority", async () => {
    const { context } = createGeneratedRuntimeContext();
    const readerFailure = controller({
      readFileText: vi.fn(async () => {
        throw new Error("private reader failure at /Users/person/secret.json");
      })
    });
    const readerOutcome = await readerFailure.core.importFile(
      { id: "reader-failure", text: "" },
      context.gameData
    );
    expect(readerOutcome).toEqual({ status: "rejected" });
    expect(readerFailure.core.getSnapshot().notice).toEqual({
      tone: "error",
      message: "Setup import failed. Check the file and try again."
    });
    expect(JSON.stringify(readerFailure.core.getSnapshot())).not.toContain("private reader");

    const persistSetup = vi.fn(() => {
      throw new Error("private persistence failure at C:\\Users\\person\\secret.json");
    });
    const persistenceFailure = controller({ persistSetup });
    const persistenceOutcome = await persistenceFailure.core.importFile(
      { id: "persist-failure", text: setupEnvelope() },
      context.gameData
    );
    expect(persistenceOutcome).toEqual({ status: "rejected" });
    expect(persistSetup).toHaveBeenCalledOnce();
    expect(persistenceFailure.unblockReplaced).not.toHaveBeenCalled();
    expect(persistenceFailure.refreshLocalStateHealth).not.toHaveBeenCalled();
    expect(persistenceFailure.core.getSnapshot().notice).toEqual({
      tone: "error",
      message: "Setup import failed. Check the file and try again."
    });
    expect(JSON.stringify(persistenceFailure.core.getSnapshot())).not.toContain(
      "private persistence"
    );
  });

  it("bounds, normalizes and path-sanitizes parser issue details", () => {
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

    expect(notice).toMatchObject({
      tone: "error",
      message: "Setup import failed: the file is not a valid rewrite setup export."
    });
    expect(notice.details).toHaveLength(5);
    for (const detail of notice.details ?? []) {
      expect(detail.length).toBeLessThanOrEqual(180);
      expect(detail).not.toContain("/Users/person");
      expect(detail).not.toContain("\n");
      expect(detail).not.toMatch(/\s{2,}/);
    }
  });

  it("preserves settlement order without hidden sequencing or cancellation", async () => {
    const { context } = createGeneratedRuntimeContext();
    const firstRead = deferred<string>();
    const secondRead = deferred<string>();
    const persistedMonsterIds: string[] = [];
    const harness = controller({
      readFileText: (file) => (file.id === "first" ? firstRead.promise : secondRead.promise),
      persistSetup: (setup) => {
        persistedMonsterIds.push(setup.form.monsterId);
        return true;
      }
    });
    const firstSetup = setupFixture("dagannoth");
    const secondSetup = setupFixture("rock_crab");

    const firstOutcome = harness.core.importFile({ id: "first", text: "" }, context.gameData);
    const secondOutcome = harness.core.importFile({ id: "second", text: "" }, context.gameData);

    secondRead.resolve(setupEnvelope(secondSetup));
    await expect(secondOutcome).resolves.toMatchObject({
      status: "ready",
      setup: { form: { monsterId: "rock_crab" } }
    });
    firstRead.resolve(setupEnvelope(firstSetup));
    await expect(firstOutcome).resolves.toMatchObject({
      status: "ready",
      setup: { form: { monsterId: "dagannoth" } }
    });
    expect(persistedMonsterIds).toEqual(["rock_crab", "dagannoth"]);
    expect(harness.unblockReplaced).toHaveBeenCalledTimes(2);
    expect(harness.refreshLocalStateHealth).toHaveBeenCalledTimes(2);
  });
});
