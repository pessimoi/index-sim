import {
  DEFAULT_FORM_STATE,
  MAX_DUEL_SNAPSHOTS,
  createDuelComparisonViewModel,
  createDuelMatrixViewModel,
  createDuelSnapshot,
  createSimulationViewModel,
  loadCurrentTestContext,
  normalizeFormState,
  switchCombatStyleLoadout
} from "./ui-view-model-fixture";
import {
  DEFAULT_DUEL_COMPARISON_SORT_STATE,
  DEFAULT_DUEL_MATRIX_SORT_STATE,
  nextDuelComparisonSortState,
  nextDuelMatrixSortState,
  sortDuelComparisonRows,
  sortDuelMatrixRows
} from "../app/view-models/duel";

describe("rewrite UI view models", () => {
  it("builds duel comparison rows for live and snapshots on the current monster", async () => {
    const { context } = await loadCurrentTestContext();
    const snapshotForm = normalizeFormState({
      ...switchCombatStyleLoadout(DEFAULT_FORM_STATE, "ranged"),
      monsterId: "firegiant",
      weaponId: "magic_shortbow",
      ammoId: "mith_arrow",
      prayers: ["none"],
      boosts: ["ranging"]
    });
    const snapshot = createDuelSnapshot("snap-ranged", "Ranged saved", snapshotForm);

    const duel = createDuelComparisonViewModel(
      DEFAULT_FORM_STATE,
      { snapshots: [snapshot] },
      context
    );
    const snapshotRow = duel.snapshotRows[0]!;
    const liveVm = createSimulationViewModel(DEFAULT_FORM_STATE, context);
    const snapshotVm = createSimulationViewModel(
      normalizeFormState({
        ...snapshot.form,
        monsterId: DEFAULT_FORM_STATE.monsterId
      }),
      context
    );

    expect(duel).toMatchObject({
      monsterId: DEFAULT_FORM_STATE.monsterId,
      monsterName: context.gameData.monsters[DEFAULT_FORM_STATE.monsterId]?.name,
      snapshotCount: 1,
      snapshotLimit: MAX_DUEL_SNAPSHOTS
    });
    expect(duel.rows).toHaveLength(2);
    expect(duel.liveRow).toMatchObject({
      id: "duel-live",
      source: "live",
      snapshotId: null,
      name: "Live loadout",
      monsterId: DEFAULT_FORM_STATE.monsterId,
      combatStyle: "melee"
    });
    expect(snapshotRow).toMatchObject({
      source: "snapshot",
      snapshotId: "snap-ranged",
      name: "Ranged saved",
      monsterId: DEFAULT_FORM_STATE.monsterId,
      combatStyle: "ranged"
    });
    expect(snapshot.form.monsterId).toBe("firegiant");
    expect(snapshotRow.dps).toBeGreaterThan(0);
    expect(Number.isFinite(snapshotRow.effectiveXpPerHour)).toBe(true);
    expect(Number.isFinite(snapshotRow.effectiveNetGpPerHour)).toBe(true);
    expect(duel.liveRow.dps).toBe(liveVm.result.rates.effectiveDps);
    expect(duel.liveRow.effectiveXpPerHour).toBe(liveVm.result.xp.effectiveXpPerHour);
    expect(duel.liveRow.effectiveNetGpPerHour).toBe(liveVm.result.rates.effectiveNetGpPerHour);
    expect(duel.liveRow.effectiveKph).toBe(liveVm.result.rates.effectiveKph);
    expect(duel.liveRow.effectiveKph).not.toBe(liveVm.result.rates.killsPerHour);
    expect(snapshotRow.dps).toBe(snapshotVm.result.rates.effectiveDps);
    expect(snapshotRow.effectiveXpPerHour).toBe(snapshotVm.result.xp.effectiveXpPerHour);
    expect(snapshotRow.effectiveNetGpPerHour).toBe(snapshotVm.result.rates.effectiveNetGpPerHour);
    expect(snapshotRow.effectiveKph).toBe(snapshotVm.result.rates.effectiveKph);
    expect(snapshotRow.deltas.dps).toBeCloseTo(snapshotRow.dps - duel.liveRow.dps);
    expect(duel.liveRow.setupDiff).toBeNull();
    expect(snapshotRow.setupDiff).toMatchObject({
      sharedContextNote: expect.stringContaining("current target"),
      groups: expect.arrayContaining([
        expect.objectContaining({ id: "combat" }),
        expect.objectContaining({ id: "loadout" }),
        expect.objectContaining({ id: "prayers-boosts" })
      ])
    });
    const diffItems = snapshotRow.setupDiff!.groups.flatMap((group) => group.items);
    expect(diffItems).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          id: "combat-style",
          liveValue: "Melee",
          snapshotValue: "Ranged"
        }),
        expect.objectContaining({
          id: "weapon",
          snapshotValue: "Magic shortbow"
        }),
        expect.objectContaining({
          id: "ammo",
          snapshotValue: "Mithril arrow"
        })
      ])
    );
    expect(diffItems.map((item) => item.id)).not.toEqual(
      expect.arrayContaining(["monster", "planner-targets", "per-style-loadouts"])
    );
    expect(snapshotRow.deltas).toMatchObject({
      maxHit: snapshotRow.maxHit - duel.liveRow.maxHit,
      hitChance: snapshotRow.hitChance - duel.liveRow.hitChance,
      ttkSec: snapshotRow.ttkSec - duel.liveRow.ttkSec,
      killsPerTrip: snapshotRow.killsPerTrip - duel.liveRow.killsPerTrip,
      effectiveKph: snapshotRow.effectiveKph - duel.liveRow.effectiveKph,
      supplyCostPerHour: snapshotRow.supplyCostPerHour - duel.liveRow.supplyCostPerHour
    });
    expect(
      duel.rows.some(
        (row) =>
          row.best.effectiveKph ||
          row.best.effectiveXpPerHour ||
          row.best.effectiveNetGpPerHour ||
          row.best.gpPerXp
      )
    ).toBe(true);
    expect(JSON.stringify(snapshot)).not.toContain("effectiveXpPerHour");
  }, 15_000);

  it("excludes shared target and inactive setup caches from Duel setup diffs", async () => {
    const { context } = await loadCurrentTestContext();
    const snapshotForm = normalizeFormState({
      ...DEFAULT_FORM_STATE,
      monsterId: "firegiant",
      plannerTargets: { attack: 99 },
      perStyleLoadouts: {
        ...DEFAULT_FORM_STATE.perStyleLoadouts,
        ranged: {
          ...DEFAULT_FORM_STATE.perStyleLoadouts.ranged,
          weaponId: "yew_shortbow"
        }
      }
    });
    const snapshot = createDuelSnapshot("excluded-state", "Excluded state", snapshotForm);
    const duel = createDuelComparisonViewModel(
      DEFAULT_FORM_STATE,
      { snapshots: [snapshot] },
      context
    );

    expect(duel.snapshotRows[0]?.setupDiff).toMatchObject({
      changeCount: 0,
      groups: []
    });
  }, 15_000);

  it("builds an all-monster Duel matrix only from live and saved setup inputs", async () => {
    const { context } = await loadCurrentTestContext();
    const snapshotForm = normalizeFormState({
      ...switchCombatStyleLoadout(DEFAULT_FORM_STATE, "ranged"),
      monsterId: "firegiant",
      weaponId: "magic_shortbow",
      ammoId: "mith_arrow",
      prayers: ["none"],
      boosts: ["ranging"]
    });
    const snapshot = createDuelSnapshot("snap-ranged", "Ranged saved", snapshotForm);
    const matrix = createDuelMatrixViewModel(
      DEFAULT_FORM_STATE,
      { snapshots: [snapshot] },
      context
    );
    const currentTargetRow = matrix.rows.find(
      (row) => row.monsterId === DEFAULT_FORM_STATE.monsterId
    );
    const currentTargetLive = createSimulationViewModel(DEFAULT_FORM_STATE, context);
    const currentTargetSaved = createSimulationViewModel(
      { ...snapshotForm, monsterId: DEFAULT_FORM_STATE.monsterId },
      context
    );

    expect(matrix).toMatchObject({
      currentMonsterId: DEFAULT_FORM_STATE.monsterId,
      monsterCount: Object.keys(context.gameData.monsters).length,
      setupCount: 2,
      cellCount: Object.keys(context.gameData.monsters).length * 2
    });
    expect(matrix.setups).toMatchObject([
      { id: "duel-live", source: "live", name: "Live setup", combatStyle: "melee" },
      {
        id: "duel-snapshot:snap-ranged",
        snapshotId: "snap-ranged",
        source: "snapshot",
        name: "Ranged saved",
        combatStyle: "ranged"
      }
    ]);
    expect(matrix.rows.map((row) => row.monsterName)).toEqual(
      [...matrix.rows.map((row) => row.monsterName)].sort((left, right) =>
        left.localeCompare(right)
      )
    );
    expect(currentTargetRow).toMatchObject({
      monsterId: DEFAULT_FORM_STATE.monsterId,
      isCurrentTarget: true
    });
    expect(currentTargetRow?.cells).toHaveLength(2);
    expect(currentTargetRow?.cells[0]?.values).toMatchObject({
      dps: currentTargetLive.result.rates.effectiveDps,
      effectiveXpPerHour: currentTargetLive.result.xp.effectiveXpPerHour,
      effectiveNetGpPerHour: currentTargetLive.result.rates.effectiveNetGpPerHour
    });
    expect(currentTargetRow?.cells[1]?.values).toMatchObject({
      dps: currentTargetSaved.result.rates.effectiveDps,
      effectiveXpPerHour: currentTargetSaved.result.xp.effectiveXpPerHour,
      effectiveNetGpPerHour: currentTargetSaved.result.rates.effectiveNetGpPerHour
    });
    expect(currentTargetRow?.cells.some((cell) => cell.best.effectiveXpPerHour)).toBe(true);
    expect(snapshot.form.monsterId).toBe("firegiant");
    expect(JSON.stringify(matrix)).not.toContain("sourceRef");
  }, 30_000);

  it("sorts current-target setup rows by labels and outcomes without mutating source order", async () => {
    const { context } = await loadCurrentTestContext();
    const snapshot = createDuelSnapshot(
      "snap-ranged",
      "Alpha ranged",
      normalizeFormState({
        ...switchCombatStyleLoadout(DEFAULT_FORM_STATE, "ranged"),
        weaponId: "magic_shortbow",
        ammoId: "mith_arrow"
      })
    );
    const comparison = createDuelComparisonViewModel(
      DEFAULT_FORM_STATE,
      { snapshots: [snapshot] },
      context
    );
    const rows = [
      ...comparison.rows,
      {
        ...comparison.snapshotRows[0]!,
        id: "duel-snapshot:missing-gp-xp",
        name: "Zulu setup",
        gpPerXp: null
      }
    ];
    const sourceIds = rows.map((row) => row.id);

    expect(
      sortDuelComparisonRows(rows, DEFAULT_DUEL_COMPARISON_SORT_STATE).map((row) => row.id)
    ).toEqual(sourceIds);

    const setupSort = nextDuelComparisonSortState(DEFAULT_DUEL_COMPARISON_SORT_STATE, "setup");
    expect(setupSort).toEqual({ key: "setup", direction: "asc" });
    expect(sortDuelComparisonRows(rows, setupSort).map((row) => row.name)).toEqual([
      "Alpha ranged",
      "Live loadout",
      "Zulu setup"
    ]);

    const dpsRows = sortDuelComparisonRows(rows, { key: "dps", direction: "desc" });
    expect(dpsRows.map((row) => row.dps)).toEqual(
      [...dpsRows.map((row) => row.dps)].sort((left, right) => right - left)
    );
    const gpPerXpRows = sortDuelComparisonRows(rows, { key: "gpPerXp", direction: "desc" });
    expect(gpPerXpRows.at(-1)?.gpPerXp).toBeNull();
    expect(rows.map((row) => row.id)).toEqual(sourceIds);
  }, 15_000);

  it("sorts the Duel matrix by monster or the selected metric for a setup", async () => {
    const { context } = await loadCurrentTestContext();
    const snapshot = createDuelSnapshot(
      "snap-ranged",
      "Ranged saved",
      normalizeFormState({
        ...switchCombatStyleLoadout(DEFAULT_FORM_STATE, "ranged"),
        weaponId: "magic_shortbow",
        ammoId: "mith_arrow"
      })
    );
    const matrix = createDuelMatrixViewModel(
      DEFAULT_FORM_STATE,
      { snapshots: [snapshot] },
      context
    );
    const sourceIds = matrix.rows.map((row) => row.monsterId);

    expect(
      sortDuelMatrixRows(matrix.rows, DEFAULT_DUEL_MATRIX_SORT_STATE, "dps").map(
        (row) => row.monsterId
      )
    ).toEqual(sourceIds);

    const monsterSort = nextDuelMatrixSortState(DEFAULT_DUEL_MATRIX_SORT_STATE, {
      kind: "monster"
    });
    const monsterNames = sortDuelMatrixRows(matrix.rows, monsterSort, "dps").map(
      (row) => row.monsterName
    );
    expect(monsterNames).toEqual(
      [...monsterNames].sort((left, right) =>
        left.localeCompare(right, undefined, { numeric: true, sensitivity: "base" })
      )
    );

    const setupId = matrix.setups[0]!.id;
    const setupSort = nextDuelMatrixSortState(DEFAULT_DUEL_MATRIX_SORT_STATE, {
      kind: "setup",
      setupId
    });
    const setupRows = sortDuelMatrixRows(matrix.rows, setupSort, "effectiveXpPerHour");
    const availableValues = setupRows
      .map((row) => row.cells.find((cell) => cell.setupId === setupId)?.values.effectiveXpPerHour)
      .filter((value): value is number => value != null);
    expect(availableValues).toEqual([...availableValues].sort((left, right) => right - left));
    expect(nextDuelMatrixSortState(setupSort, { kind: "setup", setupId })).toEqual({
      target: { kind: "setup", setupId },
      direction: "asc"
    });
    expect(matrix.rows.map((row) => row.monsterId)).toEqual(sourceIds);
  }, 30_000);
});
