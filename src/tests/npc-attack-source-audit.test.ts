import { appendFileSync, mkdirSync, rmSync, symlinkSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import {
  assertBoundedNpcAttackSource,
  createNpcAttackSourceAudit,
  type NpcAttackSourceAudit
} from "../../scripts/lostcity-content-npc-attacks";
import { LOSTCITY_SOURCE_MAX_FILE_BYTES } from "../../scripts/lostcity-content-runescript";
import {
  assertBoundedNpcAttackAuditOutput,
  formatNpcAttackSourceAuditMarkdown,
  NPC_ATTACK_AUDIT_MAX_OUTPUT_BYTES,
  parseNpcAttackAuditArgs
} from "../../scripts/report-npc-attack-source-audit";
import type { GameDataSnapshot } from "../domain/shared";

const TEST_ROOT = join(process.cwd(), ".vite", "npc-attack-audit-test");

function emptyEquipment(): GameDataSnapshot["equipment"] {
  return {
    helm: {},
    amulet: {},
    body: {},
    legs: {},
    shield: {},
    gloves: {},
    boots: {},
    cape: {},
    ring: {}
  };
}

function reference(monsterIds: string[]): GameDataSnapshot {
  return {
    id: "npc-attack-audit-fixture",
    label: "NPC attack audit fixture",
    items: {},
    monsters: Object.fromEntries(monsterIds.map((id) => [id, { id, name: id, hp: 10 }])),
    weapons: {},
    ammo: {},
    spells: {},
    equipment: emptyEquipment()
  };
}

function npcRow(id: string, extra = ""): string {
  return `[${id}]
name=${id}
vislevel=10
hitpoints=10
attack=10
strength=10
defence=10
ranged=10
magic=10
param=attackrate,4
param=attackbonus,2
param=strengthbonus,6
param=rangeattack,3
param=rangebonus,8
param=magicattack,4
${extra}`;
}

function writeFixture(name: string, input?: { duplicateRangedHandler?: boolean }): string {
  const root = join(TEST_ROOT, name);
  const scripts = join(root, "scripts");
  mkdirSync(scripts, { recursive: true });
  writeFileSync(
    join(scripts, "fixture.npc"),
    [
      npcRow("melee_npc"),
      npcRow("ranged_npc"),
      npcRow("wizard_npc"),
      npcRow("forced_npc"),
      npcRow("scripted_npc"),
      npcRow("effect_npc"),
      npcRow("dragon_npc", "param=poison_severity,15\n")
    ].join("\n")
  );
  writeFileSync(join(scripts, "fixture.param"), "[attackrate]\ndefault=4\n");
  writeFileSync(
    join(scripts, "fixture.dbrow"),
    `[magic_spell_water_strike]
table=magic_spell_table
data=spell,^water_strike
data=maxhit,4

[magic_spell_confuse]
table=magic_spell_table
data=spell,^confuse
`
  );
  writeFileSync(
    join(scripts, "combat.rs2"),
    `[ai_opplayer2,_] ~npc_default_attack;
[proc,npc_default_attack]
~npc_meleeattack;
[proc,npc_meleeattack]
def_int $maxhit = ~npc_melee_maxhit;
[proc,npc_melee_maxhit]
return(~combat_maxhit(1));
[proc,npc_melee_attack_roll]
return(1);

[ai_opplayer2,ranged_npc] npc_setmode(applayer2);
[ai_applayer2,ranged_npc] ~npc_rangeattack;
[proc,npc_rangeattack]
def_int $maxhit = ~npc_ranged_maxhit;
[proc,npc_ranged_maxhit]
return(~combat_maxhit(1));
[proc,npc_ranged_attack_roll]
return(1);

[ai_opplayer2,wizard_npc] @wizard_attack;
[label,wizard_attack]
if (random(2) = 0) {
  ~npc_cast_spell(^confuse, 4);
} else {
  ~npc_cast_spell(^water_strike, 4);
}
[proc,npc_cast_spell]
~npc_cast_spell_with_forced_max_hit(0, 4, null);
[proc,npc_cast_spell_with_forced_max_hit]
~npc_spell_success;
[proc,npc_spell_success]

[ai_opplayer2,forced_npc] ~npc_cast_spell_with_forced_max_hit(^water_strike, 4, 8);

[ai_opplayer2,scripted_npc] ~fixed_rangeattack(8);
[proc,fixed_rangeattack]
def_int $attack_roll = ~npc_ranged_attack_roll;
queue(combat_damage_player, 0, randominc(8));

[ai_opplayer2,effect_npc] @effect_attack;
[label,effect_attack]
if (random(2) = 0) {
  ~effect_spell;
} else {
  ~npc_default_attack;
}
[proc,effect_spell]
def_int $duration = ~npc_spell_cast(0, 4);
if (~npc_player_hit_roll(^magic_style) = true) {
  ~npc_spell_success(0, null, $duration);
}

[ai_opplayer2,dragon_npc] @dragon_ai_opplayer2;
[label,dragon_ai_opplayer2]
if (random(4) = 0) {
  ~dragon_fire;
} else {
  ~dragon_melee;
}
[proc,dragon_melee]
~npc_meleeattack;
[proc,dragon_fire]
queue(combat_damage_player, 0, 30);
`
  );
  if (input?.duplicateRangedHandler) {
    writeFileSync(join(scripts, "duplicate.rs2"), "[ai_applayer2,ranged_npc] ~npc_rangeattack;\n");
  }
  return root;
}

function addNpcAndScript(root: string, id: string, script: string, npcExtra = ""): void {
  appendFileSync(join(root, "scripts", "fixture.npc"), `\n${npcRow(id, npcExtra)}`);
  appendFileSync(join(root, "scripts", "combat.rs2"), `\n${script}\n`);
}

function audit(sourceDir: string, extraMonsterIds: string[] = []): NpcAttackSourceAudit {
  return createNpcAttackSourceAudit({
    sourceDir,
    sourceRevision: "a".repeat(40),
    reference: reference([
      "melee_npc",
      "ranged_npc",
      "wizard_npc",
      "forced_npc",
      "scripted_npc",
      "effect_npc",
      "dragon_npc",
      ...extraMonsterIds
    ])
  });
}

beforeEach(() => {
  rmSync(TEST_ROOT, { recursive: true, force: true });
});

afterAll(() => {
  rmSync(TEST_ROOT, { recursive: true, force: true });
});

describe("Revision-pinned NPC attack source audit", () => {
  it("classifies standard and contextual handlers without inventing weights", () => {
    const report = audit(writeFixture("coverage"));
    const melee = report.rows.find((row) => row.runtimeId === "melee_npc")!;
    const ranged = report.rows.find((row) => row.runtimeId === "ranged_npc")!;
    const wizard = report.rows.find((row) => row.runtimeId === "wizard_npc")!;
    const forced = report.rows.find((row) => row.runtimeId === "forced_npc")!;
    const scripted = report.rows.find((row) => row.runtimeId === "scripted_npc")!;
    const effect = report.rows.find((row) => row.runtimeId === "effect_npc")!;
    const dragon = report.rows.find((row) => row.runtimeId === "dragon_npc")!;

    expect(report.runtimeMonsterCount).toBe(7);
    expect(melee).toMatchObject({ coverage: "exact", selection: "always" });
    expect(melee.profiles[0]).toMatchObject({
      attackType: "melee",
      maxHitRule: "standard-melee",
      maxHitCandidates: [2],
      accuracy: { kind: "standard", level: 10, bonus: 2 }
    });
    expect(ranged).toMatchObject({ coverage: "exact", selection: "always" });
    expect(ranged.profiles[0]).toMatchObject({
      attackType: "ranged",
      maxHitRule: "standard-ranged",
      maxHitCandidates: [2],
      accuracy: { kind: "standard", level: 10, bonus: 3 }
    });
    expect(wizard.coverage).toBe("partial");
    expect(wizard.selection).toBe("contextual");
    expect(wizard.profiles[0].maxHitCandidates).toEqual([0, 4]);
    expect(wizard.issues).toContain("non-damaging-spell-selection");
    expect(forced).toMatchObject({ coverage: "exact", selection: "always" });
    expect(forced.profiles[0]).toMatchObject({
      attackType: "magic",
      maxHitRule: "forced",
      maxHitCandidates: [8],
      accuracy: { kind: "standard", level: 10, bonus: 4 }
    });
    expect(scripted).toMatchObject({ coverage: "exact", selection: "always" });
    expect(scripted.profiles[0]).toMatchObject({
      attackType: "ranged",
      maxHitRule: "scripted",
      maxHitCandidates: [8],
      accuracy: { kind: "standard", level: 10, bonus: 3 }
    });
    expect(effect.coverage).toBe("partial");
    expect(effect.selection).toBe("contextual");
    expect(effect.profiles.map((entry) => entry.attackType)).toEqual(["melee", "magic"]);
    expect(effect.profiles[1]).toMatchObject({
      maxHitCandidates: [0],
      accuracy: { kind: "standard", level: 10, bonus: 4 }
    });
    expect(dragon.coverage).toBe("partial");
    expect(dragon.selection).toBe("source-weighted");
    expect(dragon.selectionEvidence).toBe("dragonfire=1/4, melee=3/4");
    expect(dragon.overlays).toEqual({ poisonSeverity: 15, dragonfire: true });
    expect(dragon.profiles.map((entry) => entry.attackType)).toEqual(["melee", "magic"]);
    expect(dragon.profiles[1].maxHitCandidates).toEqual([]);
    expect(report.rows.flatMap((row) => row.provenance).join("\n")).not.toContain(process.cwd());
  });

  it("is byte-stable for identical source inputs", () => {
    const sourceDir = writeFixture("deterministic");
    expect(JSON.stringify(audit(sourceDir))).toBe(JSON.stringify(audit(sourceDir)));
  });

  it("fails closed on conflicting attack triggers", () => {
    const sourceDir = writeFixture("duplicate", { duplicateRangedHandler: true });
    expect(() => audit(sourceDir)).toThrow(/ai_applayer2 trigger `ranged_npc` is duplicated/);
  });

  it("fails closed on conflicting, unknown, invalid and over-deep attack shapes", () => {
    const conflictRoot = writeFixture("conflicting-profile");
    addNpcAndScript(
      conflictRoot,
      "conflict_npc",
      "[ai_opplayer2,conflict_npc] ~npc_meleeattack; ~npc_rangeattack;"
    );
    expect(() => audit(conflictRoot, ["conflict_npc"])).toThrow(
      /conflicting profiles without a resolved selection rule/
    );

    const unknownRoot = writeFixture("unknown-shape");
    addNpcAndScript(
      unknownRoot,
      "unknown_npc",
      `[ai_opplayer2,unknown_npc] ~mystery_attack;
[proc,mystery_attack]
queue(combat_damage_player, 0, 5);`
    );
    expect(() => audit(unknownRoot, ["unknown_npc"])).toThrow(/unknown parser shape/);

    const invalidRoot = writeFixture("invalid-numeric");
    addNpcAndScript(invalidRoot, "invalid_npc", "", "param=attackrate,0\n");
    expect(() => audit(invalidRoot, ["invalid_npc"])).toThrow(/non-positive attack rate/);

    const deepRoot = writeFixture("over-deep");
    const deepBlocks = Array.from({ length: 100 }, (_, index) => {
      const next = index === 99 ? "~npc_meleeattack;" : `~deep_attack_${index + 1};`;
      return `[proc,deep_attack_${index}]\n${next}`;
    }).join("\n");
    addNpcAndScript(deepRoot, "deep_npc", `[ai_opplayer2,deep_npc] ~deep_attack_0;\n${deepBlocks}`);
    expect(() => audit(deepRoot, ["deep_npc"])).toThrow(/handler graph .* is too large/);
  });

  it("rejects symlink, oversized-source and oversized-report boundaries", () => {
    const symlinkRoot = writeFixture("symlink");
    const target = join(TEST_ROOT, "outside-source.rs2");
    writeFileSync(target, "[proc,outside_attack]\n");
    symlinkSync(target, join(symlinkRoot, "scripts", "linked.rs2"));
    expect(() => assertBoundedNpcAttackSource({ sourceDir: symlinkRoot })).toThrow(
      /must not be a symbolic link/
    );

    const oversizedRoot = writeFixture("oversized");
    writeFileSync(
      join(oversizedRoot, "scripts", "oversized.rs2"),
      "x".repeat(LOSTCITY_SOURCE_MAX_FILE_BYTES + 1)
    );
    expect(() => assertBoundedNpcAttackSource({ sourceDir: oversizedRoot })).toThrow(
      /exceeds the bounded file size/
    );
    expect(() =>
      assertBoundedNpcAttackAuditOutput("x".repeat(NPC_ATTACK_AUDIT_MAX_OUTPUT_BYTES + 1))
    ).toThrow(/exceeds the bounded report size/);
  });

  it("renders the accepted bounded policy without broadening future formula acceptance", () => {
    const markdown = formatNpcAttackSourceAuditMarkdown(audit(writeFixture("markdown")));
    expect(markdown).toContain("Goal 2 — typed profiles and generated data | `DONE`");
    expect(markdown).toContain("only explicit source weights are normalized");
    expect(markdown).toContain("does not approve future formula or baseline changes");
    expect(markdown).toContain("future contextual weights, overlay migration and baseline changes");
    expect(markdown).not.toContain(process.cwd());
    expect(markdown).not.toContain("queue(combat_damage_player");
    expect(parseNpcAttackAuditArgs(["--check"])).toMatchObject({
      check: true,
      write: false,
      format: "markdown"
    });
    expect(() => parseNpcAttackAuditArgs(["--check", "--write"])).toThrow(/mutually exclusive/);
  });
});
