import {
  DEFAULT_DENSE_COMPARE_SORT_STATE,
  DEFAULT_DENSE_COMPARE_STATE,
  DEFAULT_FORM_STATE,
  createDenseCompareRows,
  createDenseCompareScaleModel,
  createSimulationViewModel,
  loadBundledLegacyContext,
  normalizeFormState,
  setCustomSetupForMonster,
  sortDenseCompareRows,
  switchCombatStyleLoadout
} from "./ui-view-model-fixture";
import type { DenseCompareRowViewModel } from "./ui-view-model-fixture";

describe("rewrite UI view models", () => {
  it("builds dense compare rows for every monster with the active target marked", async () => {
    const { context } = await loadBundledLegacyContext();
    const rows = createDenseCompareRows(DEFAULT_FORM_STATE, context);
    const activeVm = createSimulationViewModel(DEFAULT_FORM_STATE, context);
    const monsterCount = Object.keys(context.gameData.monsters).length;

    expect(rows).toHaveLength(monsterCount);
    expect(rows.length).toBeGreaterThan(8);
    expect(rows[0]?.effectiveXpPerHour).toBeGreaterThanOrEqual(rows[1]?.effectiveXpPerHour ?? 0);

    const activeRow = rows.find((row) => row.isActiveTarget);
    expect(activeRow).toMatchObject({
      monsterId: DEFAULT_FORM_STATE.monsterId,
      isActiveTarget: true
    });
    expect(activeRow?.monsterName).toBe(
      context.gameData.monsters[DEFAULT_FORM_STATE.monsterId].name
    );
    expect(activeRow?.hitChance).toBeGreaterThanOrEqual(0);
    expect(activeRow?.maxHit).toBeGreaterThan(0);
    expect(activeRow?.dps).toBeGreaterThan(0);
    expect(activeRow?.ttkSec).toBeGreaterThan(0);
    expect(activeRow?.effectiveKph).toBeGreaterThan(0);
    expect(activeRow?.gpPerKill).toBeGreaterThanOrEqual(0);
    expect(Number.isFinite(activeRow?.effectiveGpPerHour)).toBe(true);
    expect(Number.isFinite(activeRow?.effectiveNetGpPerHour)).toBe(true);
    expect(activeRow?.dps).toBe(activeVm.result.rates.effectiveDps);
    expect(activeRow?.effectiveKph).toBe(activeVm.result.rates.effectiveKph);
    expect(activeRow?.effectiveXpPerHour).toBe(activeVm.result.xp.effectiveXpPerHour);
    expect(activeRow?.effectiveGpPerHour).toBe(activeVm.result.rates.effectiveGpPerHour);
    expect(activeRow?.effectiveNetGpPerHour).toBe(activeVm.result.rates.effectiveNetGpPerHour);
    expect(activeRow?.effectiveKph).not.toBe(activeVm.result.rates.killsPerHour);
    expect(activeRow?.effectiveGpPerHour).not.toBe(activeVm.result.rates.gpPerHour);
    const scales = createDenseCompareScaleModel(rows);
    const killsBestRows = rows.filter((row) => scales[row.monsterId].bestKph);
    const grossGpBestRows = rows.filter((row) => scales[row.monsterId].bestGp);
    expect(killsBestRows.length).toBeGreaterThan(0);
    expect(grossGpBestRows.length).toBeGreaterThan(0);
    expect(killsBestRows[0]?.effectiveKph).toBe(Math.max(...rows.map((row) => row.effectiveKph)));
    expect(grossGpBestRows[0]?.effectiveGpPerHour).toBe(
      Math.max(...rows.map((row) => row.effectiveGpPerHour))
    );
  }, 15_000);

  it("uses monster-specific custom setup snapshots in dense compare rows", async () => {
    const { context } = await loadBundledLegacyContext();
    const customRockCrab = normalizeFormState({
      ...switchCombatStyleLoadout(DEFAULT_FORM_STATE, "ranged"),
      monsterId: "rock_crab",
      weaponId: "magic_shortbow",
      ammoId: "rune_arrow",
      boosts: ["ranging"]
    });
    const customSetups = setCustomSetupForMonster({}, customRockCrab);
    const rows = createDenseCompareRows(
      DEFAULT_FORM_STATE,
      context,
      DEFAULT_DENSE_COMPARE_SORT_STATE,
      {},
      {},
      customSetups
    );
    const rockCrabRow = rows.find((row) => row.monsterId === "rock_crab");
    const customVm = createSimulationViewModel(customRockCrab, context);

    expect(rockCrabRow).toMatchObject({
      monsterId: "rock_crab",
      hasCustomSetup: true
    });
    expect(rockCrabRow?.markers.map((marker) => marker.id)).toContain("custom");
    expect(rockCrabRow?.dps).toBe(customVm.result.rates.effectiveDps);
    expect(rockCrabRow?.effectiveXpPerHour).toBe(customVm.result.xp.effectiveXpPerHour);
    expect(rockCrabRow?.effectiveNetGpPerHour).toBe(customVm.result.rates.effectiveNetGpPerHour);
    expect(rows.find((row) => row.monsterId === DEFAULT_FORM_STATE.monsterId)?.hasCustomSetup).toBe(
      false
    );
  }, 15_000);

  it("adds dense compare markers for rewrite-owned per-monster state", async () => {
    const { context } = await loadBundledLegacyContext();
    const customGreenDragon = normalizeFormState({
      ...DEFAULT_FORM_STATE,
      monsterId: "green_dragon"
    });
    const rows = createDenseCompareRows(
      DEFAULT_FORM_STATE,
      context,
      {
        ...DEFAULT_DENSE_COMPARE_STATE,
        showIrrelevant: true,
        irrelevantMonsterIds: ["green_dragon"]
      },
      {},
      {},
      setCustomSetupForMonster({}, customGreenDragon),
      {
        green_dragon: {
          highAlch: false,
          overheadSec: 12.5,
          talismanSpot: "overground"
        }
      }
    );
    const greenDragonRow = rows.find((row) => row.monsterId === "green_dragon");

    expect(greenDragonRow).toMatchObject({
      hasCustomSetup: true,
      hasHighAlchOverride: true,
      hasOverheadOverride: true,
      isIrrelevant: true
    });
    expect(greenDragonRow?.markers.map((marker) => marker.id)).toEqual([
      "custom",
      "alch",
      "overhead",
      "hidden"
    ]);
    expect(greenDragonRow?.markers.find((marker) => marker.id === "alch")).toMatchObject({
      label: "alch",
      ariaLabel: "High alch override"
    });
  }, 15_000);

  it("sorts dense compare rows with explicit keys and falls back on invalid sort state", async () => {
    const { context } = await loadBundledLegacyContext();
    const defaultRows = createDenseCompareRows(
      DEFAULT_FORM_STATE,
      context,
      DEFAULT_DENSE_COMPARE_SORT_STATE
    );
    const sortedByName = sortDenseCompareRows(defaultRows, {
      key: "monsterName",
      direction: "asc"
    });
    const invalidSortRows = createDenseCompareRows(DEFAULT_FORM_STATE, context, {
      key: "not-a-sort-key",
      direction: "desc"
    });

    expect(sortedByName.map((row) => row.monsterName)).toEqual(
      [...sortedByName.map((row) => row.monsterName)].sort((left, right) =>
        left.localeCompare(right)
      )
    );
    expect(invalidSortRows.map((row) => row.monsterId)).toEqual(
      defaultRows.map((row) => row.monsterId)
    );
    const oldKillsPreference = sortDenseCompareRows(defaultRows, {
      key: "killsPerHour",
      direction: "desc"
    });
    const oldGrossGpPreference = sortDenseCompareRows(defaultRows, {
      key: "gpPerHour",
      direction: "desc"
    });
    expect(oldKillsPreference.map((row) => row.effectiveKph)).toEqual(
      [...oldKillsPreference.map((row) => row.effectiveKph)].sort((left, right) => right - left)
    );
    expect(oldGrossGpPreference.map((row) => row.effectiveGpPerHour)).toEqual(
      [...oldGrossGpPreference.map((row) => row.effectiveGpPerHour)].sort(
        (left, right) => right - left
      )
    );
  }, 15_000);

  it("filters dense compare rows by monster name and keeps the current target visible", async () => {
    const { context } = await loadBundledLegacyContext();
    const rows = createDenseCompareRows(DEFAULT_FORM_STATE, context, {
      ...DEFAULT_DENSE_COMPARE_STATE,
      monsterFilter: "rock crab"
    });
    const rockCrabRow = rows.find((row) => row.monsterId === "rock_crab");
    const activeRow = rows.find((row) => row.monsterId === DEFAULT_FORM_STATE.monsterId);

    expect(rockCrabRow?.monsterName).toBe("Rock Crab");
    expect(activeRow).toMatchObject({
      isActiveTarget: true,
      isForcedVisible: true
    });
    expect(rows.every((row) => row.monsterId === "rock_crab" || row.isActiveTarget)).toBe(true);
  }, 15_000);

  it("filters dense compare rows by drop names, item keys and nested expanded rows", async () => {
    const { context } = await loadBundledLegacyContext();
    const bigBoneRows = createDenseCompareRows(DEFAULT_FORM_STATE, context, {
      ...DEFAULT_DENSE_COMPARE_STATE,
      dropFilter: "big_bones"
    });
    const nestedGemRows = createDenseCompareRows(DEFAULT_FORM_STATE, context, {
      ...DEFAULT_DENSE_COMPARE_STATE,
      dropFilter: "diamond"
    });

    expect(bigBoneRows.length).toBeGreaterThan(1);
    expect(bigBoneRows.some((row) => row.monsterId === DEFAULT_FORM_STATE.monsterId)).toBe(true);
    expect(nestedGemRows.length).toBeGreaterThan(1);
    expect(nestedGemRows.some((row) => row.isActiveTarget)).toBe(true);
    expect(nestedGemRows.some((row) => !row.isActiveTarget)).toBe(true);
  }, 15_000);

  it("scales dense compare XP and net GP affordances against the visible rows", () => {
    const row = (
      monsterId: string,
      effectiveXpPerHour: number,
      effectiveNetGpPerHour: number
    ): DenseCompareRowViewModel => ({
      monsterId,
      monsterName: monsterId,
      monsterLevel: null,
      isActiveTarget: false,
      isForcedVisible: false,
      isIrrelevant: false,
      hasCustomSetup: false,
      hasHighAlchOverride: false,
      hasOverheadOverride: false,
      markers: [],
      hitChance: 0,
      maxHit: 0,
      dps: 0,
      ttkSec: 0,
      effectiveKph: 0,
      effectiveXpPerHour,
      gpPerKill: 0,
      effectiveGpPerHour: 0,
      effectiveNetGpPerHour,
      bound: "none"
    });
    const rows = [
      row("visible-low", 50, -100),
      row("visible-best", 200, 300),
      row("visible-loss", 100, -400)
    ];
    const scales = createDenseCompareScaleModel(rows);

    expect(scales["visible-best"].xpPerHour).toMatchObject({
      value: 200,
      widthPercent: 100,
      tone: "positive"
    });
    expect(scales["visible-low"].xpPerHour.widthPercent).toBeCloseTo(25);
    expect(scales["visible-best"].netGpPerHour).toMatchObject({
      value: 300,
      widthPercent: 100,
      tone: "positive"
    });
    expect(scales["visible-loss"].netGpPerHour).toMatchObject({
      value: -400,
      widthPercent: 100,
      tone: "negative"
    });
    expect(scales["visible-low"].netGpPerHour.widthPercent).toBeCloseTo(25);
    expect(scales["visible-loss"].netGpPerHour.ariaLabel).toContain("loss scaled to visible rows");
  });

  it("hides irrelevant dense compare rows unless showIrrelevant is enabled", async () => {
    const { context } = await loadBundledLegacyContext();
    const hiddenRows = createDenseCompareRows(DEFAULT_FORM_STATE, context, {
      ...DEFAULT_DENSE_COMPARE_STATE,
      irrelevantMonsterIds: [DEFAULT_FORM_STATE.monsterId, "rock_crab"]
    });
    const shownRows = createDenseCompareRows(DEFAULT_FORM_STATE, context, {
      ...DEFAULT_DENSE_COMPARE_STATE,
      showIrrelevant: true,
      irrelevantMonsterIds: [DEFAULT_FORM_STATE.monsterId, "rock_crab"]
    });

    expect(hiddenRows.find((row) => row.monsterId === "rock_crab")).toBeUndefined();
    expect(hiddenRows.find((row) => row.monsterId === DEFAULT_FORM_STATE.monsterId)).toMatchObject({
      isActiveTarget: true,
      isForcedVisible: true,
      isIrrelevant: true
    });
    expect(
      hiddenRows
        .find((row) => row.monsterId === DEFAULT_FORM_STATE.monsterId)
        ?.markers.map((marker) => marker.id)
    ).toEqual(["hidden", "target"]);
    expect(shownRows.find((row) => row.monsterId === "rock_crab")).toMatchObject({
      isIrrelevant: true
    });
  }, 15_000);
});
