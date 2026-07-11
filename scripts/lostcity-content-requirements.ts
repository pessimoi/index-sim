import { existsSync, readFileSync, readdirSync, statSync } from "node:fs";
import { relative, resolve, sep } from "node:path";
import {
  EQUIPMENT_SLOTS,
  type DataProvenance,
  type EntityId,
  type GameDataSnapshot,
  type ItemRequirementDefinition,
  type ItemRequirementSkill
} from "../src/domain/shared";
import { extractLostCityEquipmentSource } from "./lostcity-content-equipment";
import { LostCityContentSourceError, type LostCityConfigCatalog } from "./lostcity-content-config";
import { lostCityWeaponSourceId } from "./lostcity-content-runtime-mapping";

type RequirementSkills = ItemRequirementDefinition["skills"];

interface ParsedRequirementTrigger {
  sourceItemId: EntityId;
  skills: RequirementSkills;
  sourceRef: string;
}

interface RequirementDefinitionEvidence {
  sourceRef: string;
  body: string;
}

const REQUIREMENT_ROW =
  /^\s*\[opheld2,([A-Za-z0-9_]+)\]\s+@levelrequire_([a-z_]+)\(([^)]*)\);(?:\s*\/\/.*)?\s*$/;
const REQUIREMENT_HEADER = /^\s*\[opheld2,([A-Za-z0-9_]+)\]\s*$/;
const REQUIREMENT_CALL = /^\s*@levelrequire_([a-z_]+)\(([^)]*)\);(?:\s*\/\/.*)?\s*$/;

const DEFINITION_EVIDENCE: Readonly<Record<string, readonly string[]>> = {
  attack: ["stat_base(attack) < $level"],
  attack_caps: ["stat_base(attack) < $level"],
  defence: ["stat_base(defence) < $level"],
  defence_caps: ["stat_base(defence) < $level"],
  ranged: ["stat_base(ranged) < $level"],
  ranged_lower: ["stat_base(ranged) < $level"],
  magic: ["stat_base(magic) < $level"],
  magic_and_attack: ["stat_base(magic) < $magic_level", "stat_base(attack) < $attack_level"],
  ranged_and_defence: ["stat_base(ranged) < $ranged_level", "stat_base(defence) < $defence_level"],
  defence_and_strength: ["stat_base(strength) < $level", "stat_base(defence) < $level"],
  magic_and_defence: ["stat_base(magic) < $magic_level", "stat_base(defence) < $defence_level"],
  dragon_slayer_quest_defence: ["@levelrequire_defence($level, $slot);"],
  dragon_slayer_quest_ranged_and_defence: [
    "@levelrequire_ranged_and_defence($ranged_level, $defence_level, $slot);"
  ],
  heroes_quest_attack: ["@levelrequire_attack_caps($level, $slot);"],
  legends_quest_defence: ["@levelrequire_defence_caps($level, $slot);"],
  zanaris_quest_attack: ["@levelrequire_attack_caps($level, $slot);"],
  viking_quest_helm: ["@levelrequire_defence($level, $slot);"],
  iban_staff: ["stat_base(magic) < 50", "stat_base(attack) < 50"],
  attack_and_strength: [
    "stat_base(attack) < $attack_level",
    "stat_base(strength) < $strength_level"
  ],
  regicide_quest_attack_strength: ["@levelrequire_attack_and_strength($attack, $strength, $slot);"]
};

function pathInside(root: string, target: string): boolean {
  const pathFromRoot = relative(root, target);
  return pathFromRoot === "" || (!pathFromRoot.startsWith(`..${sep}`) && pathFromRoot !== "..");
}

function requirementError(sourceRef: string, message: string): never {
  throw new LostCityContentSourceError(
    "config_invalid",
    `LostCity requirement ${sourceRef} is invalid: ${message}`
  );
}

function level(sourceRef: string, value: string | undefined): number {
  if (!value || !/^[0-9]+$/.test(value)) {
    return requirementError(sourceRef, "expected a numeric skill level");
  }
  const parsed = Number(value);
  if (parsed < 1 || parsed > 99) {
    return requirementError(sourceRef, "skill level must be between 1 and 99");
  }
  return parsed;
}

function exactLevels(sourceRef: string, args: string[], count: number): number[] {
  if (args.at(-1) !== "last_slot" || args.length !== count + 1) {
    return requirementError(sourceRef, "unexpected levelrequire argument shape");
  }
  return args.slice(0, count).map((value) => level(sourceRef, value));
}

function validateDefinition(
  triggerSourceRef: string,
  family: string,
  definitions: Map<string, RequirementDefinitionEvidence>
): void {
  const expected = DEFINITION_EVIDENCE[family];
  if (!expected) {
    requirementError(triggerSourceRef, `unsupported levelrequire family \`${family}\``);
  }
  const definition = definitions.get(family);
  if (!definition || expected.some((snippet) => !definition.body.includes(snippet))) {
    requirementError(
      definition?.sourceRef ?? triggerSourceRef,
      `reviewed definition for \`${family}\` does not match accepted skill semantics`
    );
  }
}

function skillsForCall(
  sourceRef: string,
  family: string,
  args: string[],
  definitions: Map<string, RequirementDefinitionEvidence>
): RequirementSkills {
  validateDefinition(sourceRef, family, definitions);
  const one = (skill: ItemRequirementSkill): RequirementSkills => {
    const [required] = exactLevels(sourceRef, args, 1);
    return { [skill]: required };
  };

  switch (family) {
    case "attack":
    case "attack_caps":
    case "heroes_quest_attack":
    case "zanaris_quest_attack":
      return one("attack");
    case "defence":
    case "defence_caps":
    case "dragon_slayer_quest_defence":
    case "legends_quest_defence":
    case "viking_quest_helm":
      return one("defence");
    case "ranged":
    case "ranged_lower":
      return one("ranged");
    case "magic":
      return one("magic");
    case "attack_and_strength":
    case "regicide_quest_attack_strength": {
      const [attack, strength] = exactLevels(sourceRef, args, 2);
      return { attack, strength };
    }
    case "defence_and_strength": {
      const [required] = exactLevels(sourceRef, args, 1);
      return { defence: required, strength: required };
    }
    case "magic_and_attack": {
      const [magic, attack] = exactLevels(sourceRef, args, 2);
      return { magic, attack };
    }
    case "magic_and_defence": {
      const [magic, defence] = exactLevels(sourceRef, args, 2);
      return { magic, defence };
    }
    case "ranged_and_defence":
    case "dragon_slayer_quest_ranged_and_defence": {
      const [ranged, defence] = exactLevels(sourceRef, args, 2);
      return { ranged, defence };
    }
    case "iban_staff":
      exactLevels(sourceRef, args, 0);
      return { attack: 50, magic: 50 };
    default:
      return requirementError(sourceRef, `unsupported levelrequire family \`${family}\``);
  }
}

function readRequirementDefinitions(scriptsDir: string, sourceDir: string) {
  const file = resolve(scriptsDir, "levelrequire.rs2");
  const sourceRef = relative(sourceDir, file).replaceAll(sep, "/");
  if (!existsSync(file) || !statSync(file).isFile()) {
    throw new LostCityContentSourceError(
      "scripts_missing",
      "LostCity content source does not contain the levelrequire definition script."
    );
  }
  const lines = readFileSync(file, "utf8").split(/\r?\n/);
  const definitions = new Map<string, RequirementDefinitionEvidence>();
  for (let index = 0; index < lines.length; index += 1) {
    const match = /^\[label,levelrequire_([a-z_]+)\]/.exec(lines[index] ?? "");
    if (!match) continue;
    const family = match[1];
    const end = lines.findIndex((line, nextIndex) => nextIndex > index && line.startsWith("["));
    const body = lines.slice(index, end === -1 ? lines.length : end).join("\n");
    if (definitions.has(family)) {
      requirementError(`${sourceRef}:${index + 1}`, `duplicate definition for \`${family}\``);
    }
    definitions.set(family, { sourceRef: `${sourceRef}:${index + 1}`, body });
  }
  return definitions;
}

function readRequirementTriggers(input: {
  repoRoot?: string;
  sourceDir: string;
}): ParsedRequirementTrigger[] {
  const repoRoot = resolve(input.repoRoot ?? process.cwd());
  const sourceDir = resolve(repoRoot, input.sourceDir);
  if (!pathInside(repoRoot, sourceDir)) {
    throw new LostCityContentSourceError(
      "source_outside_repo",
      "LostCity content source directory must stay inside the repository."
    );
  }
  const scriptsDir = resolve(sourceDir, "scripts", "levelrequire", "scripts");
  if (!existsSync(scriptsDir) || !statSync(scriptsDir).isDirectory()) {
    throw new LostCityContentSourceError(
      "scripts_missing",
      "LostCity content source does not contain the levelrequire scripts directory."
    );
  }

  const files = readdirSync(scriptsDir)
    .filter((name) => /^tier[0-9]+\.rs2$/.test(name))
    .sort((left, right) => left.localeCompare(right, "en", { numeric: true }));
  if (files.length === 0) {
    throw new LostCityContentSourceError(
      "scripts_missing",
      "LostCity content source does not contain tier requirement scripts."
    );
  }

  const triggers: ParsedRequirementTrigger[] = [];
  const definitions = readRequirementDefinitions(scriptsDir, sourceDir);
  for (const filename of files) {
    const file = resolve(scriptsDir, filename);
    const fileLabel = relative(sourceDir, file).replaceAll(sep, "/");
    const lines = readFileSync(file, "utf8").split(/\r?\n/);
    let pendingSourceItemId: EntityId | undefined;
    for (let index = 0; index < lines.length; index += 1) {
      const line = lines[index] ?? "";
      const header = REQUIREMENT_HEADER.exec(line);
      if (header) {
        pendingSourceItemId = header[1];
        continue;
      }
      if (!line.includes("@levelrequire_")) continue;
      const sourceRef = `${fileLabel}:${index + 1}`;
      const inline = REQUIREMENT_ROW.exec(line);
      const standalone = REQUIREMENT_CALL.exec(line);
      const sourceItemId = inline?.[1] ?? pendingSourceItemId;
      const family = inline?.[2] ?? standalone?.[1];
      const argumentText = inline?.[3] ?? standalone?.[2];
      if (!sourceItemId || !family || argumentText === undefined) {
        requirementError(sourceRef, "unexpected levelrequire trigger shape");
      }
      const args = argumentText.split(",").map((value) => value.trim());
      triggers.push({
        sourceItemId,
        skills: skillsForCall(sourceRef, family, args, definitions),
        sourceRef
      });
      pendingSourceItemId = undefined;
    }
  }
  return triggers;
}

function runtimeIdsBySourceItem(
  reference: GameDataSnapshot,
  objects: LostCityConfigCatalog
): Map<EntityId, Set<EntityId>> {
  const mapped = new Map<EntityId, Set<EntityId>>();
  const add = (sourceItemId: EntityId | undefined, runtimeId: EntityId): void => {
    if (!sourceItemId || runtimeId === "none") return;
    const runtimeIds = mapped.get(sourceItemId) ?? new Set<EntityId>();
    runtimeIds.add(runtimeId);
    mapped.set(sourceItemId, runtimeIds);
  };

  for (const runtimeId of Object.keys(reference.weapons)) {
    add(lostCityWeaponSourceId(runtimeId), runtimeId);
  }
  for (const slot of EQUIPMENT_SLOTS) {
    for (const [runtimeId, runtime] of Object.entries(reference.equipment[slot])) {
      const source = extractLostCityEquipmentSource({ slot, runtimeId, runtime, objects });
      add(source.sourceItemId, runtimeId);
    }
  }
  return mapped;
}

function sameSkills(left: RequirementSkills, right: RequirementSkills): boolean {
  const keys: ItemRequirementSkill[] = ["attack", "strength", "defence", "ranged", "magic"];
  return keys.every((skill) => left[skill] === right[skill]);
}

export function readLostCityItemRequirements(input: {
  repoRoot?: string;
  sourceDir: string;
  reference: GameDataSnapshot;
  objects: LostCityConfigCatalog;
  sourceRevision: string;
  generatedAt?: string;
}): Record<EntityId, ItemRequirementDefinition> {
  const runtimeIds = runtimeIdsBySourceItem(input.reference, input.objects);
  const requirements: Record<EntityId, ItemRequirementDefinition> = {};
  for (const trigger of readRequirementTriggers(input)) {
    for (const runtimeId of runtimeIds.get(trigger.sourceItemId) ?? []) {
      const previous = requirements[runtimeId];
      if (previous && !sameSkills(previous.skills, trigger.skills)) {
        requirementError(
          trigger.sourceRef,
          `conflicting requirement for runtime item \`${runtimeId}\``
        );
      }
      const sourceRefs = new Set(
        [previous?.provenance?.sourceRef, trigger.sourceRef].filter(
          (value): value is string => value !== undefined
        )
      );
      const provenance: DataProvenance = {
        source: "generated",
        sourceRef: [...sourceRefs].sort().join(", "),
        ...(input.generatedAt ? { verifiedAt: input.generatedAt } : {}),
        notes: `Numeric skill gates parsed from pinned levelrequire triggers and definitions; quest completion clauses are outside this contract. Source revision: ${input.sourceRevision}.`
      };
      requirements[runtimeId] = {
        itemId: runtimeId,
        skills: trigger.skills,
        provenance
      };
    }
  }
  return Object.fromEntries(
    Object.entries(requirements).sort(([left], [right]) => left.localeCompare(right))
  );
}
