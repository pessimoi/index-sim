import {
  COMPACT_ACCESSIBLE_LABELS,
  createEntityDisplayLabel,
  expandedCompactLabel,
  formatSemanticUnitValue
} from "../app/view-models/presentation-language";

describe("presentation language", () => {
  it("prefers game-data and row-source names while retaining exact technical ids", () => {
    expect(
      createEntityDisplayLabel({
        technicalId: "uncut_dragonstone",
        gameDataName: "Uncut dragonstone",
        rowSourceName: "Dragonstone"
      })
    ).toEqual({
      name: "Uncut dragonstone",
      technicalId: "uncut_dragonstone",
      source: "game-data"
    });
    expect(
      createEntityDisplayLabel({
        technicalId: "rune_spear",
        rowSourceName: "Rune spear"
      })
    ).toEqual({
      name: "Rune spear",
      technicalId: "rune_spear",
      source: "row-source"
    });
  });

  it("humanizes snapshot-external ids only as a marked presentation fallback", () => {
    expect(createEntityDisplayLabel({ technicalId: "historical_rune_spear" })).toEqual({
      name: "Historical rune spear",
      technicalId: "historical_rune_spear",
      source: "fallback"
    });
  });

  it("keeps compact tokens visible while exposing every required expanded meaning", () => {
    for (const token of [
      "HP",
      "ACC",
      "ACC+",
      "M+%",
      "DMG",
      "DMG+",
      "DMG%",
      "SPD",
      "HIT %",
      "MAX",
      "DPS",
      "TTK",
      "K/HR",
      "XP/HR",
      "XP/KL",
      "GP/KL",
      "GP/HR",
      "NET GP/HR",
      "GP/XP",
      "SUPPLY/KILL",
      "F/KL",
      "EV",
      "Delta/hr",
      "Qty",
      "s",
      "sec",
      "min",
      "hr",
      "tick",
      "ticks",
      "GP",
      "XP"
    ]) {
      expect(COMPACT_ACCESSIBLE_LABELS[token], token).toBeTruthy();
      expect(expandedCompactLabel(token), token).toBe(COMPACT_ACCESSIBLE_LABELS[token]);
    }
    expect(Object.keys(COMPACT_ACCESSIBLE_LABELS).some((token) => /gp|xp/.test(token))).toBe(false);
  });

  it("formats singular and plural time values without changing the supplied precision", () => {
    expect(formatSemanticUnitValue("1", 1, "second")).toEqual({
      visible: "1 s",
      accessible: "1 second"
    });
    expect(formatSemanticUnitValue("2.4", 2.4, "second")).toEqual({
      visible: "2.4 s",
      accessible: "2.4 seconds"
    });
    expect(formatSemanticUnitValue("1", 1, "minute").accessible).toBe("1 minute");
    expect(formatSemanticUnitValue("2", 2, "minute").accessible).toBe("2 minutes");
    expect(formatSemanticUnitValue("1", 1, "tick")).toEqual({
      visible: "1 tick",
      accessible: "1 game tick"
    });
    expect(formatSemanticUnitValue("6", 6, "tick")).toEqual({
      visible: "6 ticks",
      accessible: "6 game ticks"
    });
    expect(formatSemanticUnitValue("1", 1, "hour").accessible).toBe("1 hour");
    expect(formatSemanticUnitValue("2", 2, "hour").accessible).toBe("2 hours");
    expect(formatSemanticUnitValue("1", 1, "day").accessible).toBe("1 day");
    expect(formatSemanticUnitValue("2", 2, "day").accessible).toBe("2 days");
  });

  it("keeps GP and XP uppercase in visible values with expanded accessible units", () => {
    expect(formatSemanticUnitValue("500", 500, "gp")).toEqual({
      visible: "500 GP",
      accessible: "500 gold pieces"
    });
    expect(formatSemanticUnitValue("30", 30, "xp")).toEqual({
      visible: "30 XP",
      accessible: "30 experience points"
    });
  });
});
