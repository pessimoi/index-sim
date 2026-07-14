import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { MonsterCardPanel } from "../app/components/panes/monster-card-panel";
import type { MonsterCardViewModel } from "../app/view-models/simulation";

const card: MonsterCardViewModel = {
  monsterId: "fixture_monster",
  monsterName: "Fixture Monster",
  stats: [
    { key: "combat", label: "Combat", value: 42, missing: false },
    { key: "magic", label: "Magic", value: null, missing: true }
  ],
  defenceRows: [
    {
      key: "range",
      label: "Ranged",
      field: "defRange",
      value: 18,
      active: true,
      missing: false
    },
    {
      key: "magic",
      label: "Magic",
      field: "defMagic",
      value: null,
      active: false,
      missing: true
    }
  ],
  activeDefenceField: "defRange",
  activeDefenceKey: "range",
  setupBadge: {
    mode: "custom",
    label: "Custom setup",
    tone: "custom",
    hasCustomSetup: true
  },
  setupOverview: {
    combatStyle: "ranged",
    styleId: "accurate",
    styleLabel: "Accurate",
    attackType: "ranged",
    weapon: { id: "fixture_bow", label: "Fixture bow" },
    ammo: { id: "fixture_arrow", label: "Fixture arrow" },
    spell: null,
    accuracyBonus: 12,
    damageBonus: -3,
    attackSpeedSec: 2.4,
    prayerIds: ["none", "incredible"],
    boostIds: ["super_att"],
    sustained: true,
    ring: null,
    summary: []
  }
};

describe("Monster card panel", () => {
  it("preserves the extracted target, stats, defence and setup presentation contract", () => {
    const markup = renderToStaticMarkup(
      createElement(MonsterCardPanel, {
        card,
        monsterOptions: [
          { id: "other_monster", label: "Other Monster" },
          { id: "fixture_monster", label: "Fixture Monster" }
        ],
        selectedMonsterId: "fixture_monster",
        onTargetChange: () => undefined
      })
    );

    expect(markup).toContain('<aside class="monster-rail" aria-label="Monster card">');
    expect(markup).toContain("<h2>Fixture Monster</h2>");
    expect(markup).toContain('class="status-pill ready"');
    expect(markup).toContain('aria-label="Monster target controls"');
    expect(markup).toContain('aria-label="Monster stats"');
    expect(markup).toContain('class="missing"><dt>Magic</dt><dd>-</dd>');
    expect(markup).toContain('aria-current="true" data-defence-key="range"');
    expect(markup).toContain("<em>Active</em>");

    for (const expected of [
      "Fixture bow",
      "Fixture arrow",
      "Accurate",
      "ranged",
      "incredible",
      "super att",
      "2.4s",
      "+12",
      "-3",
      "On"
    ]) {
      expect(markup).toContain(expected);
    }
    expect(markup).not.toContain("<dt>Spell</dt>");
  });
});
