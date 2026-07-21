// @vitest-environment jsdom

import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import {
  SessionOnlyExitProtectionCore,
  type NonDurableReason
} from "../app/controllers/session-only-exit-protection";
import {
  protectSessionOnlyChangesBeforeUnload,
  useSessionOnlyBeforeUnload
} from "../app/controllers/use-session-only-before-unload";
import { DEFAULT_DUEL_SNAPSHOTS_STATE } from "../app/state/duel-snapshots";
import { DEFAULT_HIDDEN_GEAR_TIERS_STATE } from "../app/state/hidden-gear-tiers";
import { DEFAULT_LOOT_PREFS_STATE } from "../app/state/loot-prefs";
import { DEFAULT_LOOT_SETTINGS_STATE } from "../app/state/loot-settings";
import { DEFAULT_MANUAL_PRICE_OVERRIDES_STATE } from "../app/state/manual-price-overrides";
import { DEFAULT_PLANNER_UI_STATE } from "../app/state/planner";
import { DEFAULT_PRICE_HISTORY_STATE } from "../app/state/price-history";
import { DEFAULT_FORM_STATE, savedSetupFromForm } from "../app/state/ui-state";
import {
  WORKSPACE_AREA_REGISTRY,
  WORKSPACE_TRANSFER_AREA_IDS,
  type WorkspaceLiveState
} from "../app/state/workspace-backup";

function liveState(): WorkspaceLiveState {
  return {
    "rewrite-setup": savedSetupFromForm(DEFAULT_FORM_STATE),
    "planner-ui": DEFAULT_PLANNER_UI_STATE,
    "loot-prefs": DEFAULT_LOOT_PREFS_STATE,
    "loot-settings": DEFAULT_LOOT_SETTINGS_STATE,
    "hidden-gear-tiers": DEFAULT_HIDDEN_GEAR_TIERS_STATE,
    "duel-snapshots": DEFAULT_DUEL_SNAPSHOTS_STATE,
    "price-history": DEFAULT_PRICE_HISTORY_STATE,
    "selected-price-set": null,
    "manual-price-overrides": DEFAULT_MANUAL_PRICE_OVERRIDES_STATE,
    "hiscores-last-player": { player: "Private Hero" }
  };
}

function changedSetup(current: WorkspaceLiveState, attack: number): WorkspaceLiveState {
  return {
    ...current,
    "rewrite-setup": {
      ...current["rewrite-setup"],
      form: {
        ...current["rewrite-setup"].form,
        levels: { ...current["rewrite-setup"].form.levels, attack }
      }
    }
  };
}

function initialize(reason: NonDurableReason | null = "saved-data-ignored") {
  const core = new SessionOnlyExitProtectionCore();
  const baseline = liveState();
  core.initialize(baseline, reason);
  return { core, baseline };
}

describe("session-only exit protection core", () => {
  it("uses every Workspace transfer registration and excludes only the registry exclusion", () => {
    expect(WORKSPACE_TRANSFER_AREA_IDS).toEqual(
      Object.values(WORKSPACE_AREA_REGISTRY)
        .filter((area) => area.policy !== "excluded")
        .map((area) => area.id)
    );
    expect(WORKSPACE_AREA_REGISTRY["legacy-migration-dismissed"].policy).toBe("excluded");
  });

  it("does not arm for mode alone, arms after an edit and clears on exact revert", () => {
    const { core, baseline } = initialize();
    expect(core.getSnapshot()).toMatchObject({ initialized: true, armed: false });

    core.reconcileCurrent(changedSetup(baseline, 61), "saved-data-ignored");
    expect(core.getSnapshot()).toMatchObject({
      armed: true,
      sessionOnlyChangeCount: 1,
      affectedAreas: [{ id: "rewrite-setup", label: "Rewrite setup", reason: "saved-data-ignored" }]
    });

    core.reconcileCurrent(baseline, "saved-data-ignored");
    expect(core.getSnapshot()).toMatchObject({
      armed: false,
      sessionOnlyChangeCount: 0,
      affectedAreas: []
    });
  });

  it("advances only a verified durable area's baseline and keeps a session-only write armed", () => {
    const { core, baseline } = initialize(null);
    const changed = changedSetup(baseline, 62);
    core.recordNonDurable("rewrite-setup", changed["rewrite-setup"], "session-only-write");
    expect(core.getSnapshot().armed).toBe(true);

    core.recordDurable("rewrite-setup", changed["rewrite-setup"]);
    expect(core.getSnapshot()).toMatchObject({ armed: false, sessionOnlyChangeCount: 0 });

    const next = changedSetup(changed, 63);
    core.recordNonDurable("rewrite-setup", next["rewrite-setup"], "storage-unavailable");
    expect(core.getSnapshot().affectedAreas[0]).toMatchObject({
      id: "rewrite-setup",
      reason: "storage-unavailable"
    });
  });

  it("acknowledges only exact included values and re-arms after a later edit", () => {
    const { core, baseline } = initialize();
    const changed = changedSetup(baseline, 64);
    core.reconcileCurrent(changed, "saved-data-ignored");
    core.acknowledgeBackup(WORKSPACE_TRANSFER_AREA_IDS, changed);

    expect(core.getSnapshot()).toMatchObject({
      armed: false,
      sessionOnlyChangeCount: 1,
      sensitiveAreaOmitted: false,
      backupOutcome: { status: "requested" }
    });

    core.reconcileCurrent(changedSetup(changed, 65), "saved-data-ignored");
    expect(core.getSnapshot().armed).toBe(true);
  });

  it("keeps omitted sensitive state armed and a failed backup acknowledges nothing", () => {
    const { core, baseline } = initialize();
    const changed = {
      ...baseline,
      "hiscores-last-player": { player: "Another Private Hero" }
    } satisfies WorkspaceLiveState;
    core.reconcileCurrent(changed, "saved-data-ignored");
    core.acknowledgeBackup(
      WORKSPACE_TRANSFER_AREA_IDS.filter((id) => id !== "hiscores-last-player"),
      changed
    );
    expect(core.getSnapshot()).toMatchObject({
      armed: true,
      sensitiveAreaOmitted: true,
      affectedAreas: [{ id: "hiscores-last-player" }]
    });

    core.recordBackupFailure();
    expect(core.getSnapshot()).toMatchObject({
      armed: true,
      backupOutcome: { status: "failed" }
    });
  });
});

function ListenerFixture({ armed }: { armed: boolean }) {
  useSessionOnlyBeforeUnload(armed);
  return null;
}

describe("session-only beforeunload listener", () => {
  let container: HTMLDivElement;
  let root: Root;

  beforeEach(() => {
    Object.assign(globalThis, { IS_REACT_ACT_ENVIRONMENT: true });
    container = document.createElement("div");
    document.body.replaceChildren(container);
    root = createRoot(container);
  });

  afterEach(async () => {
    await act(async () => root.unmount());
    Object.assign(globalThis, { IS_REACT_ACT_ENVIRONMENT: false });
  });

  it("is absent, installs exactly one stable handler while armed and removes it", async () => {
    const add = vi.spyOn(window, "addEventListener");
    const remove = vi.spyOn(window, "removeEventListener");
    try {
      await act(async () => root.render(<ListenerFixture armed={false} />));
      expect(add.mock.calls.filter(([type]) => type === "beforeunload")).toHaveLength(0);

      await act(async () => root.render(<ListenerFixture armed />));
      const additions = add.mock.calls.filter(([type]) => type === "beforeunload");
      expect(additions).toHaveLength(1);
      const handler = additions[0]?.[1];

      const event = new Event("beforeunload", { cancelable: true }) as BeforeUnloadEvent;
      window.dispatchEvent(event);
      expect(event.defaultPrevented).toBe(true);

      await act(async () => root.render(<ListenerFixture armed={false} />));
      expect(
        remove.mock.calls.filter(
          ([type, removed]) => type === "beforeunload" && removed === handler
        )
      ).toHaveLength(1);
    } finally {
      add.mockRestore();
      remove.mockRestore();
    }
  });

  it("prevents leaving and assigns the legacy returnValue without other work", () => {
    const event = {
      preventDefault: vi.fn(),
      returnValue: "unchanged"
    } as unknown as BeforeUnloadEvent;
    protectSessionOnlyChangesBeforeUnload(event);
    expect(event.preventDefault).toHaveBeenCalledOnce();
    expect(event.returnValue).toBe("");
  });
});
