import type { KeyValueStorage } from "@/adapters/storage";
import { HiscoresPlayerNameSchema } from "@/data/schemas";
import type {
  DropDefinition,
  EntityId,
  GameDataSnapshot,
  MonsterDefinition
} from "@/domain/shared";
import { lootPreferenceKey, lootPreferenceKeysForMonster } from "@/domain/trip";
import {
  DenseCompareSortStateSchema,
  type DenseCompareSortKey,
  type DenseCompareSortState
} from "../dense-compare";
import { GEAR_TIER_DEFS, HiddenGearTiersStateSchema, type GearTierId } from "../hidden-gear-tiers";
import { LootActionSchema, LootPrefsStateSchema, type LootPrefsState } from "../loot-prefs";
import {
  DEFAULT_MAX_LEGACY_HISCORES_BYTES,
  DEFAULT_MAX_LEGACY_LOOT_PREFS_BYTES,
  DEFAULT_MAX_LEGACY_UI_STATE_BYTES,
  type LegacySetupMigrationOptions,
  type LegacySetupMigrationReport
} from "./contracts";
import {
  byteLength,
  importField,
  isRecord,
  parseLegacyJsonStorageValue,
  readNumber,
  readString,
  skip,
  warn,
  type LegacyRecord
} from "./report";

interface LootPreferenceCandidate {
  monsterId: EntityId;
  rowId: string;
  ambiguous: boolean;
}

const MAX_LEGACY_LOOT_PREF_KEYS = 500;
const MAX_LEGACY_IRRELEVANT_MONSTER_IDS = 500;
const HIDDEN_GEAR_TIER_IDS = new Set<GearTierId>(GEAR_TIER_DEFS.map((tier) => tier.id));
const LEGACY_COMPARE_SORT_KEY_MAP: Partial<Record<string, DenseCompareSortKey>> = {
  name: "monsterName",
  monsterName: "monsterName",
  hitChance: "hitChance",
  maxHit: "maxHit",
  dps: "dps",
  ttkSec: "ttkSec",
  killsPerHour: "killsPerHour",
  effectiveXpPerHour: "xpPerHour",
  xpPerHour: "xpPerHour",
  gpPerKill: "gpPerKill",
  gpPerHour: "gpPerHour",
  effectiveNetGpPerHour: "netGpPerHour",
  netGpPerHour: "netGpPerHour"
};

export function inspectLegacyHiscoresPlayer(
  storage: KeyValueStorage,
  report: LegacySetupMigrationReport,
  maxBytes = DEFAULT_MAX_LEGACY_HISCORES_BYTES
): void {
  const rawPlayer = storage.getItem("sim_hiscore_player");
  if (rawPlayer == null) return;

  if (byteLength(rawPlayer) > maxBytes) {
    skip(report, "hiscores.player", "legacy hiscores player exceeds safe size limit");
    warn(report, "Legacy hiscores player was ignored because it exceeds the safe size limit.");
    return;
  }

  const parsed = HiscoresPlayerNameSchema.safeParse(rawPlayer);
  if (!parsed.success) {
    skip(report, "hiscores.player", "invalid hiscores player name");
    warn(report, "Legacy hiscores player was ignored because it failed validation.");
    return;
  }

  report.hiscoresPlayer = parsed.data;
  importField(report, "hiscores.player");
}

export function inspectLegacyLootPrefs(
  options: LegacySetupMigrationOptions,
  report: LegacySetupMigrationReport,
  maxBytes = DEFAULT_MAX_LEGACY_LOOT_PREFS_BYTES
): void {
  const rawValue = options.storage.getItem("sim_loot_prefs_v1");
  if (rawValue == null) return;

  const parsed = parseLegacyJsonStorageValue(
    rawValue,
    "sim_loot_prefs_v1",
    maxBytes,
    report,
    "Legacy loot preferences"
  );
  if (!parsed.ok) return;
  if (!isRecord(parsed.value)) {
    skip(report, "lootPrefs", "expected an object");
    warn(report, "Legacy loot preferences were ignored because the value is not an object.");
    return;
  }

  const entries = Object.entries(parsed.value);
  if (entries.length > MAX_LEGACY_LOOT_PREF_KEYS) {
    skip(report, "lootPrefs", "legacy loot preference map exceeds safe key limit");
    warn(report, "Legacy loot preferences were ignored because they contain too many keys.");
    return;
  }

  const candidatesByName = createLootPreferenceCandidatesByName(options.gameData);
  const nextPrefs: LootPrefsState = {};
  let importedRows = 0;

  for (const [rawDropName, rawAction] of entries) {
    const dropName = rawDropName.trim();
    const fieldName = dropName ? `lootPrefs.${dropName}` : "lootPrefs";
    if (!dropName || dropName.length > 180) {
      skip(report, "lootPrefs", "expected a non-empty drop name up to 180 characters");
      continue;
    }

    const action = LootActionSchema.safeParse(rawAction);
    if (!action.success) {
      skip(report, fieldName, "unknown loot action");
      continue;
    }

    const candidates = candidatesByName.get(dropName);
    if (!candidates || candidates.length === 0) {
      skip(report, fieldName, "unknown loot preference row name");
      continue;
    }

    let importedForName = 0;
    for (const candidate of candidates) {
      if (candidate.ambiguous) {
        skip(
          report,
          `lootPrefs.${candidate.monsterId}.${dropName}`,
          "ambiguous legacy drop name for monster"
        );
        continue;
      }
      nextPrefs[candidate.monsterId] = {
        ...(nextPrefs[candidate.monsterId] ?? {}),
        [candidate.rowId]: action.data
      };
      importedRows += 1;
      importedForName += 1;
    }
    if (importedForName === 0) {
      warn(report, `Legacy loot preference '${dropName}' did not resolve to an importable row.`);
    }
  }

  if (importedRows === 0) {
    if (entries.length > 0) {
      warn(report, "Legacy loot preferences did not contain any safely importable rows.");
    }
    return;
  }

  const validated = LootPrefsStateSchema.safeParse(nextPrefs);
  if (!validated.success) {
    skip(report, "lootPrefs", "legacy loot preferences failed rewrite validation");
    warn(report, "Legacy loot preferences were ignored because they failed rewrite validation.");
    return;
  }

  report.lootPrefs = validated.data;
  importField(report, "lootPrefs");
}

export function inspectLegacyHiddenGearTiers(
  storage: KeyValueStorage,
  report: LegacySetupMigrationReport,
  maxBytes = DEFAULT_MAX_LEGACY_UI_STATE_BYTES
): void {
  const rawValue = storage.getItem("sim_hidden_tiers_v1");
  if (rawValue == null) return;

  const parsed = parseLegacyJsonStorageValue(
    rawValue,
    "sim_hidden_tiers_v1",
    maxBytes,
    report,
    "Legacy hidden gear tiers"
  );
  if (!parsed.ok) return;
  if (!isRecord(parsed.value)) {
    skip(report, "hiddenGearTiers", "expected an object");
    warn(report, "Legacy hidden gear tiers were ignored because the value is not an object.");
    return;
  }

  const flags: Partial<Record<GearTierId, boolean>> = {};
  let knownFlagCount = 0;
  for (const [tierId, value] of Object.entries(parsed.value)) {
    if (!HIDDEN_GEAR_TIER_IDS.has(tierId as GearTierId)) {
      skip(report, `hiddenGearTiers.${tierId}`, "unknown hidden tier id");
      continue;
    }
    if (typeof value !== "boolean") {
      skip(report, `hiddenGearTiers.${tierId}`, "expected a boolean");
      continue;
    }
    flags[tierId as GearTierId] = value;
    knownFlagCount += 1;
  }

  if (knownFlagCount === 0) {
    warn(report, "Legacy hidden gear tiers did not contain any known tier flags.");
    return;
  }

  const validated = HiddenGearTiersStateSchema.safeParse(flags);
  if (!validated.success) {
    skip(report, "hiddenGearTiers", "legacy hidden tiers failed rewrite validation");
    warn(report, "Legacy hidden gear tiers were ignored because they failed rewrite validation.");
    return;
  }

  report.hiddenGearTiers = validated.data;
  importField(report, "hiddenGearTiers");
}

export function inspectLegacyCompareSort(
  storage: KeyValueStorage,
  report: LegacySetupMigrationReport,
  maxBytes = DEFAULT_MAX_LEGACY_UI_STATE_BYTES
): void {
  const rawValue = storage.getItem("sim_compare_sort_v1");
  if (rawValue == null) return;

  const parsed = parseLegacyJsonStorageValue(
    rawValue,
    "sim_compare_sort_v1",
    maxBytes,
    report,
    "Legacy compare sort"
  );
  if (!parsed.ok) return;
  if (!isRecord(parsed.value)) {
    skip(report, "compare.sort", "expected an object");
    warn(report, "Legacy compare sort was ignored because the value is not an object.");
    return;
  }

  const legacyKey = readString(parsed.value, ["key"]);
  const mappedKey = legacyKey ? LEGACY_COMPARE_SORT_KEY_MAP[legacyKey] : null;
  if (!legacyKey || !mappedKey) {
    skip(report, "compare.sort", "unknown compare sort key");
    warn(report, "Legacy compare sort was ignored because its sort key is not supported.");
    return;
  }

  const direction = legacyCompareSortDirection(legacyKey, parsed.value);
  if (!direction) {
    skip(report, "compare.sort", "unknown compare sort direction");
    warn(report, "Legacy compare sort was ignored because its direction is not supported.");
    return;
  }

  const validated = DenseCompareSortStateSchema.safeParse({ key: mappedKey, direction });
  if (!validated.success) {
    skip(report, "compare.sort", "legacy compare sort failed rewrite validation");
    warn(report, "Legacy compare sort was ignored because it failed rewrite validation.");
    return;
  }

  report.denseCompareSort = validated.data;
  importField(report, "compare.sort");
}

export function inspectLegacyIrrelevantMonsters(
  options: LegacySetupMigrationOptions,
  report: LegacySetupMigrationReport,
  maxBytes = DEFAULT_MAX_LEGACY_UI_STATE_BYTES
): void {
  const rawValue = options.storage.getItem("sim_irrelevant_v1");
  if (rawValue == null) return;

  const parsed = parseLegacyJsonStorageValue(
    rawValue,
    "sim_irrelevant_v1",
    maxBytes,
    report,
    "Legacy compare relevance"
  );
  if (!parsed.ok) return;
  if (!Array.isArray(parsed.value)) {
    skip(report, "compare.irrelevantMonsterIds", "expected an array");
    warn(report, "Legacy compare relevance was ignored because the value is not an array.");
    return;
  }
  if (parsed.value.length > MAX_LEGACY_IRRELEVANT_MONSTER_IDS) {
    skip(
      report,
      "compare.irrelevantMonsterIds",
      "legacy irrelevant monster list exceeds safe size limit"
    );
    warn(report, "Legacy compare relevance was ignored because it has too many monster ids.");
    return;
  }

  const validMonsterIds = new Set(Object.keys(options.gameData.monsters));
  const nextIds: string[] = [];
  const seen = new Set<string>();
  let acceptedInputCount = 0;
  for (const value of parsed.value) {
    if (typeof value !== "string" || !value.trim()) {
      skip(report, "compare.irrelevantMonsterIds", "expected monster id strings");
      continue;
    }
    const monsterId = value.trim();
    if (!validMonsterIds.has(monsterId)) {
      skip(report, `compare.irrelevantMonsterIds.${monsterId}`, "unknown monster id");
      continue;
    }
    acceptedInputCount += 1;
    if (!seen.has(monsterId)) {
      seen.add(monsterId);
      nextIds.push(monsterId);
    }
  }

  if (parsed.value.length > 0 && acceptedInputCount === 0) {
    warn(report, "Legacy compare relevance did not contain any known monster ids.");
    return;
  }

  report.irrelevantMonsterIds = nextIds;
  importField(report, "compare.irrelevantMonsterIds");
}

function legacyCompareSortDirection(
  legacyKey: string,
  legacySort: LegacyRecord
): DenseCompareSortState["direction"] | null {
  const direction = readString(legacySort, ["direction"]);
  if (direction === "asc" || direction === "desc") return direction;

  const legacyDir = readNumber(legacySort, ["dir"]);
  if (legacyDir == null || legacyDir === 0) return null;
  if (legacyKey === "name" || legacyKey === "monsterName") {
    return legacyDir < 0 ? "asc" : "desc";
  }
  return legacyDir < 0 ? "desc" : "asc";
}

function createLootPreferenceCandidatesByName(
  gameData: GameDataSnapshot
): Map<string, LootPreferenceCandidate[]> {
  const candidates = new Map<string, LootPreferenceCandidate[]>();
  for (const monster of Object.values(gameData.monsters)) {
    const drops = flattenMonsterLoot(monster);
    const rowIds = lootPreferenceKeysForMonster(monster);
    const nameCounts = new Map<string, number>();
    for (const drop of drops) {
      nameCounts.set(drop.name, (nameCounts.get(drop.name) ?? 0) + 1);
    }

    for (const [index, drop] of drops.entries()) {
      const rowId = rowIds[index] ?? lootPreferenceKey(drop, index);
      const list = candidates.get(drop.name) ?? [];
      list.push({
        monsterId: monster.id,
        rowId,
        ambiguous: (nameCounts.get(drop.name) ?? 0) > 1
      });
      candidates.set(drop.name, list);
    }
  }
  return candidates;
}

function flattenMonsterLoot(monster: MonsterDefinition): DropDefinition[] {
  const drops: DropDefinition[] = [];
  for (const entry of monster.loot ?? []) {
    if (Array.isArray(entry)) drops.push(...entry);
    else drops.push(entry);
  }
  return drops;
}
