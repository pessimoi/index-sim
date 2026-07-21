import { createGeneratedRuntimeContext } from "../adapters/generated";
import {
  COMPACT_ACCESSIBLE_LABELS,
  ENTITY_SEMANTIC_DESCRIPTORS,
  createEntityCollisionIndex,
  createEntityDisplayLabel,
  createRowCollisionLabels,
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

  it("disambiguates reviewed collisions and uses labelled exact ids for uncertain names", () => {
    const collisionIndex = createEntityCollisionIndex({
      items: {
        loop_half_key: { name: " Half   of a key " },
        tooth_half_key: { name: "half of A KEY" },
        dragonhide_black: { name: "Dragonhide" },
        dragonhide_blue: { name: "Dragonhide" },
        guam_leaf: { name: "Guam leaf" },
        herb_guam: { name: "Guam leaf" },
        punctuation_one: { name: "Rune sword" },
        punctuation_two: { name: "Rune-sword" }
      }
    });
    const resolve = (technicalId: string, gameDataName: string) =>
      createEntityDisplayLabel({
        technicalId,
        gameDataName,
        collisionIndex,
        entityKind: "item"
      }).name;

    expect(resolve("loop_half_key", "Half of a key")).toBe("Half of a key — loop half");
    expect(resolve("tooth_half_key", "Half of a key")).toBe("Half of a key — tooth half");
    expect(resolve("dragonhide_black", "Dragonhide")).toBe("Dragonhide — black");
    expect(resolve("dragonhide_blue", "Dragonhide")).toBe("Dragonhide — blue");
    expect(resolve("guam_leaf", "Guam leaf")).toBe("Guam leaf — ID guam_leaf");
    expect(resolve("herb_guam", "Guam leaf")).toBe("Guam leaf — ID herb_guam");
    expect(resolve("punctuation_one", "Rune sword")).toBe("Rune sword");
    expect(resolve("punctuation_two", "Rune-sword")).toBe("Rune-sword");
    expect(ENTITY_SEMANTIC_DESCRIPTORS).toEqual({
      loop_half_key: "loop half",
      tooth_half_key: "tooth half",
      dragonhide_black: "black",
      dragonhide_blue: "blue",
      dragonhide_green: "green",
      dragonhide_red: "red"
    });
  });

  it("adds row facts before a deterministic source-order ordinal", () => {
    const labels = createRowCollisionLabels([
      {
        stableId: "coins-a",
        baseLabel: "Coins",
        sourceOrder: 4,
        quantityLabel: "1.0",
        chanceLabel: "2.34%"
      },
      {
        stableId: "coins-b",
        baseLabel: "Coins",
        sourceOrder: 5,
        quantityLabel: "1.0",
        chanceLabel: "0.78%"
      },
      {
        stableId: "same-a",
        baseLabel: "Repeated",
        sourceOrder: 8,
        quantityLabel: "2.0",
        chanceLabel: "1.00%"
      },
      {
        stableId: "same-b",
        baseLabel: "Repeated",
        sourceOrder: 9,
        quantityLabel: "2.0",
        chanceLabel: "1.00%"
      }
    ]);

    expect(labels.get("coins-a")).toBe("Coins — qty 1.0 · chance 2.34%");
    expect(labels.get("coins-b")).toBe("Coins — qty 1.0 · chance 0.78%");
    expect(labels.get("same-a")).toBe("Repeated — qty 2.0 · chance 1.00% · row 1");
    expect(labels.get("same-b")).toBe("Repeated — qty 2.0 · chance 1.00% · row 2");
  });

  it("freezes the reviewed active-snapshot collision inventory", () => {
    const { context } = createGeneratedRuntimeContext();
    const index = createEntityCollisionIndex(context.gameData);
    const itemGroups = [...index.item.entries()]
      .filter(([, ids]) => ids.length > 1)
      .map(([name, ids]) => [name, [...ids].sort()] as const)
      .sort(([left], [right]) => left.localeCompare(right));
    const monsterGroups = [...index.monster.entries()].filter(([, ids]) => ids.length > 1);

    expect(itemGroups).toEqual([
      ["adamant arrow", ["adamant_arrow", "addy_arrow"]],
      ["adamant dart", ["adamant_dart", "addy_dart"]],
      ["adamant kiteshield", ["adamant_kite", "adamant_kiteshield"]],
      ["adamant knife", ["adamant_knife", "addy_knife"]],
      ["antipoison(3)", ["3doseantipoison", "antipoison3"]],
      ["black kiteshield", ["black_kite", "black_kiteshield"]],
      ["cape", ["black_cape", "red_cape"]],
      [
        "dragon vambraces",
        ["black_vambraces", "blue_vambraces", "green_vambraces", "red_vambraces"]
      ],
      ["dragonhide", ["dragonhide_black", "dragonhide_blue", "dragonhide_green", "dragonhide_red"]],
      [
        "dragonhide body",
        [
          "black_dhide_body",
          "blue_dhide_body",
          "dragonhide_body",
          "green_dhide_body",
          "red_dhide_body"
        ]
      ],
      [
        "dragonhide chaps",
        [
          "black_dhide_legs",
          "blue_dhide_legs",
          "dragonhide_chaps",
          "green_dhide_legs",
          "red_dhide_legs"
        ]
      ],
      ["druid's robe", ["druidrobebottom", "druidrobetop"]],
      ["guam leaf", ["guam_leaf", "herb_guam"]],
      ["half of a key", ["loop_half_key", "tooth_half_key"]],
      ["iron kiteshield", ["iron_kite", "iron_kiteshield"]],
      ["mithril arrow", ["mith_arrow", "mithril_arrow"]],
      ["mithril dart", ["mith_dart", "mithril_dart"]],
      ["mithril kiteshield", ["mithril_kite", "mithril_kiteshield"]],
      ["mithril knife", ["mith_knife", "mithril_knife"]],
      ["monk's robe", ["monk_robe_bottom", "monk_robe_top"]],
      ["rune 2h sword", ["rune_2h", "rune_2h_sword"]],
      ["rune kiteshield", ["rune_kite", "rune_kiteshield"]],
      ["steel kiteshield", ["steel_kite", "steel_kiteshield"]],
      ["unidentified herb", ["unidentified_rogues_purse", "unidentified_snake_weed"]],
      ["wizards hat", ["blackwizhat", "bluewizhat"]]
    ]);
    expect(monsterGroups).toEqual([]);

    for (const [, ids] of itemGroups) {
      const labels = ids.map(
        (id) =>
          createEntityDisplayLabel({
            technicalId: id,
            gameDataName: context.gameData.items[id]!.name,
            collisionIndex: index,
            entityKind: "item"
          }).name
      );
      expect(new Set(labels).size, ids.join(", ")).toBe(labels.length);
    }
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
      "EFF. K/HR",
      "EFF. XP/HR",
      "GP/KL",
      "EFF. GP/HR",
      "EFF. NET GP/HR",
      "SUPPLY/KILL",
      "F/KL",
      "Delta/hr",
      "Qty"
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
