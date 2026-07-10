import { existsSync, mkdirSync, readFileSync, statSync, writeFileSync } from "node:fs";
import { dirname, isAbsolute, join, relative, resolve, sep } from "node:path";
import { z } from "zod";
import { parseJsonWithDuplicateKeyCheck } from "../src/data/reliability";
import {
  GameDataSnapshotSchema,
  NonNegativeNumberSchema,
  NumericSchema,
  ProbabilitySchema,
  parseGameDataSnapshot
} from "../src/data/schemas/game-data";
import { createPriceSetFromLegacyRecords } from "../src/data/schemas/price-set";
import {
  simulateFullSimulation,
  type FullSimulationInput,
  type FullSimulationResult
} from "../src/domain/simulation";
import {
  BONUS_KEYS,
  EQUIPMENT_SLOTS,
  ITEM_REQUIREMENT_SKILLS,
  type AmmoDefinition,
  type DataProvenance,
  type DropDefinition,
  type DropEntry,
  type EquipmentItemDefinition,
  type EquipmentSlot,
  type EntityId,
  type GameDataSnapshot,
  type ItemRequirementDefinition,
  type ItemRequirementSkill,
  type ItemDefinition,
  type MonsterDefinition,
  type PriceSet,
  type SimulationContext,
  type SpellDefinition,
  type WeaponDefinition
} from "../src/domain/shared";
import { createGeneratedRuntimePriceSet } from "../src/adapters/generated/price-fallback";
import { createLostCityRawSnapshot } from "./lostcity-content-snapshot";
import { LostCityContentSourceError } from "./lostcity-content-config";

export const GAME_DATA_GENERATOR_VERSION = "raw-lostcity-runtime-catalog-2";
export const DEFAULT_GAME_DATA_SOURCE_DIR = ".sources/lostcity-content";
export const FOUNDATION_SOURCE_MANIFEST_FILE = "generator-foundation.json";
export const SOURCE_BACKED_SLICE_DIR = "index-sim-source-slice";
export const RAW_RUNTIME_REFERENCE_PATH =
  "src/data/generated/legacy-derived-runtime-game-data.json";
export const DEFAULT_IMPACT_OUTLIER_LIMIT = 25;

const SOURCE_BACKED_SLICE_FILES = {
  items: "items.json",
  monsters: "monsters.json",
  weapons: "weapons.json",
  ammo: "ammo.json",
  spells: "spells.json",
  equipment: "equipment.json"
} as const;

export const GENERATED_GAME_DATA_OUTPUT_PATHS = {
  sourcePin: "src/data/generated/source-pin.json",
  gameData: "src/data/generated/game-data.json",
  revisionImpact: "docs/project/revision-impact/current.md"
} as const;

export type GeneratedGameDataOutputKey = keyof typeof GENERATED_GAME_DATA_OUTPUT_PATHS;

export type GameDataGeneratorErrorCode =
  | "invalid_argument"
  | "source_missing"
  | "source_not_directory"
  | "source_manifest_invalid"
  | "source_slice_invalid"
  | "raw_reference_invalid"
  | "source_outside_repo"
  | "output_outside_repo"
  | "output_validation_failed";

export class GameDataGeneratorError extends Error {
  readonly code: GameDataGeneratorErrorCode;

  constructor(code: GameDataGeneratorErrorCode, message: string) {
    super(message);
    this.name = "GameDataGeneratorError";
    this.code = code;
  }
}

export interface GameDataGenerationPlanOptions {
  repoRoot?: string;
  sourceDir?: string;
  outputRoot?: string;
}

export interface GameDataGenerationOutputPath {
  key: GeneratedGameDataOutputKey;
  targetPath: string;
  absolutePath: string;
  pathLabel: string;
}

export interface GameDataGenerationPlan {
  generatorVersion: typeof GAME_DATA_GENERATOR_VERSION;
  parserStatus: "raw-lostcity" | "source-backed-slice" | "foundation-manifest" | "foundation-empty";
  repoRoot: string;
  sourceDir: string;
  sourceDirLabel: string;
  outputRoot: string;
  outputRootLabel: string;
  outputs: Record<GeneratedGameDataOutputKey, GameDataGenerationOutputPath>;
  notes: string[];
}

export interface GeneratedGameDataSourcePin {
  schemaVersion: 1;
  source: {
    name: string;
    path: string;
    revision?: string;
    commit?: string;
  };
  generatedAt: string;
  generator: {
    name: "index-sim-data-generator";
    version: typeof GAME_DATA_GENERATOR_VERSION;
    command: string;
  };
  outputs: {
    sourcePin: string;
    gameData: string;
    revisionImpact: string;
  };
  scope: {
    status: "source-backed-raw" | "source-backed-slice" | "foundation";
    parser: GameDataGenerationPlan["parserStatus"];
    runtimeBootstrap:
      "legacy-adapter" | "legacy-derived-static-bridge" | "source-backed-generated-snapshot";
    notes: string[];
  };
}

export interface GeneratedGameDataOutputs {
  plan: GameDataGenerationPlan;
  sourcePin: GeneratedGameDataSourcePin;
  gameData: GameDataSnapshot;
  sourcePinText: string;
  gameDataText: string;
  revisionImpactText: string;
  changedFiles: string[];
}

export interface GeneratedGameDataOutputTexts {
  sourcePinText: string;
  gameDataText: string;
  revisionImpactText: string;
}

export interface CreateGeneratedGameDataOutputOptions extends GameDataGenerationPlanOptions {
  generatedAt?: Date | string;
  command?: string;
  skipCalculationImpact?: boolean;
  impactCaseFilter?: string;
  impactOutlierLimit?: number;
  priceSet?: PriceSet;
  rawReference?: GameDataSnapshot;
}

export interface WriteGeneratedGameDataOutputOptions extends CreateGeneratedGameDataOutputOptions {
  dryRun?: boolean;
}

type SnapshotSectionKey = "items" | "monsters" | "weapons" | "ammo" | "spells" | "requirements";

interface SnapshotDiffSection {
  section: string;
  added: string[];
  removed: string[];
  changed: string[];
}

interface RevisionImpactBaseline {
  status: "not-found" | "valid" | "invalid";
  pathLabel: string;
}

interface RevisionImpactSummary {
  baseline: RevisionImpactBaseline;
  sections: SnapshotDiffSection[];
  calculationImpact: CalculationImpactSummary;
  allMonsterScan: AllMonsterScanSummary;
}

export type CalculationImpactCaseStatus = "pass" | "needs-review" | "failed";
export type CalculationImpactSuiteStatus = CalculationImpactCaseStatus | "skipped";

export type CalculationImpactMetricId =
  "dps" | "killsPerHour" | "xpPerHour" | "gpPerHour" | "gpPerXp";

export interface CalculationImpactMetricDelta {
  id: CalculationImpactMetricId;
  label: string;
  baseline: number | null;
  candidate: number | null;
  delta: number | null;
  percentDelta: number | null;
  changed: boolean;
}

interface RequiredGearItem {
  slot: EquipmentSlot;
  itemId: EntityId;
}

export interface RepresentativeCalculationImpactCase {
  id: string;
  label: string;
  tags: readonly string[];
  input: FullSimulationInput;
  requiredItems: readonly EntityId[];
  requiredGear?: readonly RequiredGearItem[];
}

export interface CalculationImpactCaseResult {
  id: string;
  label: string;
  tags: readonly string[];
  status: CalculationImpactCaseStatus;
  metrics: CalculationImpactMetricDelta[];
  notes: string[];
}

export interface CalculationImpactSummary {
  status: CalculationImpactSuiteStatus;
  skippedReason?: string;
  filter?: string;
  priceSetLabel?: string;
  notes: string[];
  cases: CalculationImpactCaseResult[];
  totals: {
    total: number;
    pass: number;
    needsReview: number;
    failed: number;
  };
}

export type AllMonsterScanStatus = "clean" | "outliers-found" | "skipped";
export type AllMonsterScanFindingKind =
  "threshold-outlier" | "warning-count-increase" | "monster-added" | "monster-removed" | "failed";

export interface AllMonsterScanBaseline {
  id: string;
  label: string;
  combatStyle: FullSimulationInput["request"]["combatStyle"];
  requiredItems: readonly EntityId[];
  requiredGear?: readonly RequiredGearItem[];
  inputForMonster: (monsterId: EntityId) => FullSimulationInput;
}

export interface AllMonsterScanFinding {
  baselineId: string;
  baselineLabel: string;
  combatStyle: FullSimulationInput["request"]["combatStyle"];
  monsterId: EntityId;
  monsterName: string;
  kind: AllMonsterScanFindingKind;
  reasons: string[];
  metrics: CalculationImpactMetricDelta[];
  baselineWarningCount: number | null;
  candidateWarningCount: number | null;
}

export interface AllMonsterScanSummary {
  status: AllMonsterScanStatus;
  skippedReason?: string;
  priceSetLabel?: string;
  outlierLimit: number;
  baselines: readonly AllMonsterScanBaseline[];
  monsterCount: number;
  evaluationCount: number;
  totalOutliers: number;
  outliers: AllMonsterScanFinding[];
  notes: string[];
}

export interface CalculationImpactEvidence {
  representative: CalculationImpactSummary;
  allMonsterScan: AllMonsterScanSummary;
}

const REPRESENTATIVE_TRIP_POLICY: FullSimulationInput["trip"] = {
  foodKey: "none",
  foodCount: 0,
  teleport: false,
  bankSeconds: 0,
  prayerMode: "none",
  prayerRestore: false,
  safespot: true,
  recoverAmmo: true
};

const REPRESENTATIVE_LEVELS = {
  attack: 40,
  strength: 40,
  defence: 40,
  ranged: 40,
  magic: 40,
  prayer: 31
} as const;

const LOW_LEVEL_REPRESENTATIVE_LEVELS = {
  attack: 5,
  strength: 5,
  defence: 5,
  ranged: 5,
  magic: 5,
  prayer: 1
} as const;

function representativeInput(
  request: FullSimulationInput["request"],
  options: Partial<Omit<FullSimulationInput, "request">> = {}
): FullSimulationInput {
  return {
    request,
    trip: { ...REPRESENTATIVE_TRIP_POLICY, ...(options.trip ?? {}) },
    lootPrefs: options.lootPrefs ?? {},
    ringOfWealth: options.ringOfWealth ?? false,
    legendsComplete: options.legendsComplete ?? true,
    jewelSpot: options.jewelSpot ?? "underground",
    overheadSec: options.overheadSec ?? 0,
    cannon: options.cannon ?? null
  };
}

export const REPRESENTATIVE_CALCULATION_IMPACT_CASES = [
  {
    id: "fixture_melee_source_giant",
    label: "Fixture melee Source Giant",
    tags: ["fixture", "combat", "melee", "gear", "loot"],
    input: representativeInput({
      combatStyle: "melee",
      monsterId: "source_giant",
      levels: REPRESENTATIVE_LEVELS,
      loadout: {
        weaponId: "bronze_sword",
        gear: {
          helm: "bronze_med_helm",
          shield: "bronze_sq_shield"
        }
      },
      styleId: "aggressive",
      prayers: { keys: ["none"] },
      boosts: { keys: ["none"] },
      sustained: false,
      repotThreshold: null
    }),
    requiredItems: ["bronze_sword", "bronze_med_helm", "bronze_sq_shield", "big_bones", "coins"],
    requiredGear: [
      { slot: "helm", itemId: "bronze_med_helm" },
      { slot: "shield", itemId: "bronze_sq_shield" }
    ]
  },
  {
    id: "fixture_ranged_source_giant",
    label: "Fixture ranged Source Giant",
    tags: ["fixture", "combat", "ranged", "ammo", "supply"],
    input: representativeInput({
      combatStyle: "ranged",
      monsterId: "source_giant",
      levels: REPRESENTATIVE_LEVELS,
      loadout: {
        weaponId: "training_shortbow",
        ammoId: "bronze_arrow",
        gear: {}
      },
      styleId: "rapid",
      prayers: { keys: ["none"] },
      boosts: { keys: ["none"] },
      sustained: false,
      repotThreshold: null
    }),
    requiredItems: ["training_shortbow", "bronze_arrow", "big_bones", "coins"]
  },
  {
    id: "fixture_magic_source_giant",
    label: "Fixture magic Source Giant",
    tags: ["fixture", "combat", "magic", "spell", "runes"],
    input: representativeInput({
      combatStyle: "magic",
      monsterId: "source_giant",
      levels: REPRESENTATIVE_LEVELS,
      loadout: {
        weaponId: "bronze_sword",
        gear: {}
      },
      styleId: "accurate",
      prayers: { keys: ["none"] },
      boosts: { keys: ["none"] },
      spellId: "wind_strike",
      charge: false,
      sustained: false,
      repotThreshold: null
    }),
    requiredItems: ["bronze_sword", "air_rune", "mind_rune", "big_bones", "coins"]
  },
  {
    id: "fixture_cannon_source_giant",
    label: "Fixture cannon Source Giant",
    tags: ["fixture", "combat", "ranged", "cannon", "supply"],
    input: representativeInput(
      {
        combatStyle: "ranged",
        monsterId: "source_giant",
        levels: REPRESENTATIVE_LEVELS,
        loadout: {
          weaponId: "training_shortbow",
          ammoId: "bronze_arrow",
          gear: {}
        },
        styleId: "rapid",
        prayers: { keys: ["none"] },
        boosts: { keys: ["none"] },
        sustained: false,
        repotThreshold: null
      },
      {
        cannon: {
          enabled: true,
          targets: 2,
          respawnSec: 30
        }
      }
    ),
    requiredItems: ["training_shortbow", "bronze_arrow", "big_bones", "coins"]
  },
  {
    id: "fixture_recoil_training_dummy",
    label: "Fixture recoil Training Dummy",
    tags: ["fixture", "combat", "melee", "recoil", "low-level"],
    input: representativeInput(
      {
        combatStyle: "melee",
        monsterId: "training_dummy",
        levels: LOW_LEVEL_REPRESENTATIVE_LEVELS,
        loadout: {
          weaponId: "bronze_sword",
          gear: {}
        },
        styleId: "aggressive",
        prayers: { keys: ["none"] },
        boosts: { keys: ["none"] },
        sustained: false,
        repotThreshold: null
      },
      {
        trip: {
          safespot: false,
          recoilRings: 1,
          protect: "none"
        }
      }
    ),
    requiredItems: ["bronze_sword", "bones"]
  },
  {
    id: "fixture_alch_policy_source_giant",
    label: "Fixture alch policy Source Giant",
    tags: ["fixture", "economy", "alch", "loot"],
    input: representativeInput(
      {
        combatStyle: "magic",
        monsterId: "source_giant",
        levels: REPRESENTATIVE_LEVELS,
        loadout: {
          weaponId: "bronze_sword",
          gear: {}
        },
        styleId: "accurate",
        prayers: { keys: ["none"] },
        boosts: { keys: ["none"] },
        spellId: "wind_strike",
        charge: false,
        sustained: false,
        repotThreshold: null
      },
      {
        trip: {
          alching: true,
          runeSlots: 2
        },
        lootPrefs: {
          "Uncut sapphire": "alch"
        }
      }
    ),
    requiredItems: ["bronze_sword", "air_rune", "mind_rune", "uncut_sapphire"]
  },
  {
    id: "fixture_loot_heavy_source_giant",
    label: "Fixture loot-heavy Source Giant",
    tags: ["fixture", "economy", "loot-heavy", "nested-loot"],
    input: representativeInput(
      {
        combatStyle: "melee",
        monsterId: "source_giant",
        levels: REPRESENTATIVE_LEVELS,
        loadout: {
          weaponId: "bronze_sword",
          gear: {
            helm: "bronze_med_helm",
            shield: "bronze_sq_shield"
          }
        },
        styleId: "aggressive",
        prayers: { keys: ["none"] },
        boosts: { keys: ["none"] },
        sustained: false,
        repotThreshold: null
      },
      {
        ringOfWealth: true,
        lootPrefs: {
          "Gem table": "value",
          "Uncut sapphire": "loot",
          "Air rune": "loot",
          "Mind rune": "loot"
        }
      }
    ),
    requiredItems: [
      "bronze_sword",
      "bronze_med_helm",
      "bronze_sq_shield",
      "uncut_sapphire",
      "air_rune",
      "mind_rune"
    ],
    requiredGear: [
      { slot: "helm", itemId: "bronze_med_helm" },
      { slot: "shield", itemId: "bronze_sq_shield" }
    ]
  },
  {
    id: "fixture_high_defence_pressure_source_giant",
    label: "Fixture high-defence pressure Source Giant",
    tags: ["fixture", "combat", "melee", "high-defence"],
    input: representativeInput({
      combatStyle: "melee",
      monsterId: "source_giant",
      levels: LOW_LEVEL_REPRESENTATIVE_LEVELS,
      loadout: {
        weaponId: "bronze_sword",
        gear: {
          helm: "bronze_med_helm",
          shield: "bronze_sq_shield"
        }
      },
      styleId: "aggressive",
      prayers: { keys: ["none"] },
      boosts: { keys: ["none"] },
      sustained: false,
      repotThreshold: null
    }),
    requiredItems: ["bronze_sword", "bronze_med_helm", "bronze_sq_shield", "big_bones"],
    requiredGear: [
      { slot: "helm", itemId: "bronze_med_helm" },
      { slot: "shield", itemId: "bronze_sq_shield" }
    ]
  },
  {
    id: "fixture_low_level_training_dummy",
    label: "Fixture low-level Training Dummy",
    tags: ["fixture", "combat", "melee", "low-level"],
    input: representativeInput({
      combatStyle: "melee",
      monsterId: "training_dummy",
      levels: LOW_LEVEL_REPRESENTATIVE_LEVELS,
      loadout: {
        weaponId: "bronze_sword",
        gear: {}
      },
      styleId: "aggressive",
      prayers: { keys: ["none"] },
      boosts: { keys: ["none"] },
      sustained: false,
      repotThreshold: null
    }),
    requiredItems: ["bronze_sword", "bones"]
  }
] as const satisfies readonly RepresentativeCalculationImpactCase[];

export const INFORMATIONAL_ALL_MONSTER_SCAN_BASELINES = [
  {
    id: "simple_melee",
    label: "Simple melee",
    combatStyle: "melee",
    requiredItems: ["bronze_sword"],
    requiredGear: [
      { slot: "helm", itemId: "bronze_med_helm" },
      { slot: "shield", itemId: "bronze_sq_shield" }
    ],
    inputForMonster: (monsterId) =>
      representativeInput({
        combatStyle: "melee",
        monsterId,
        levels: REPRESENTATIVE_LEVELS,
        loadout: {
          weaponId: "bronze_sword",
          gear: {
            helm: "bronze_med_helm",
            shield: "bronze_sq_shield"
          }
        },
        styleId: "aggressive",
        prayers: { keys: ["none"] },
        boosts: { keys: ["none"] },
        sustained: false,
        repotThreshold: null
      })
  },
  {
    id: "simple_ranged",
    label: "Simple ranged",
    combatStyle: "ranged",
    requiredItems: ["training_shortbow", "bronze_arrow"],
    inputForMonster: (monsterId) =>
      representativeInput({
        combatStyle: "ranged",
        monsterId,
        levels: REPRESENTATIVE_LEVELS,
        loadout: {
          weaponId: "training_shortbow",
          ammoId: "bronze_arrow",
          gear: {}
        },
        styleId: "rapid",
        prayers: { keys: ["none"] },
        boosts: { keys: ["none"] },
        sustained: false,
        repotThreshold: null
      })
  },
  {
    id: "simple_magic",
    label: "Simple magic",
    combatStyle: "magic",
    requiredItems: ["bronze_sword", "air_rune", "mind_rune"],
    inputForMonster: (monsterId) =>
      representativeInput({
        combatStyle: "magic",
        monsterId,
        levels: REPRESENTATIVE_LEVELS,
        loadout: {
          weaponId: "bronze_sword",
          gear: {}
        },
        styleId: "accurate",
        prayers: { keys: ["none"] },
        boosts: { keys: ["none"] },
        spellId: "wind_strike",
        charge: false,
        sustained: false,
        repotThreshold: null
      })
  }
] as const satisfies readonly AllMonsterScanBaseline[];

function rawRuntimeImpactInput(
  monsterId: EntityId,
  combatStyle: FullSimulationInput["request"]["combatStyle"],
  weaponId: EntityId,
  ammoId?: EntityId
): FullSimulationInput {
  return representativeInput({
    combatStyle,
    monsterId,
    levels: {
      attack: 70,
      strength: 70,
      defence: 70,
      ranged: 70,
      magic: 70,
      prayer: 43
    },
    loadout: { weaponId, ...(ammoId ? { ammoId } : {}), gear: {} },
    styleId:
      combatStyle === "ranged" ? "rapid" : combatStyle === "magic" ? "accurate" : "aggressive",
    prayers: { keys: ["none"] },
    boosts: { keys: ["none"] },
    ...(combatStyle === "magic" ? { spellId: "wind_strike", charge: false } : {}),
    sustained: false,
    repotThreshold: null
  });
}

const RAW_RUNTIME_STYLE_CONFIG = [
  {
    combatStyle: "melee",
    weaponId: "rune_scimitar",
    ammoId: undefined,
    requiredItems: ["rune_scimitar"]
  },
  {
    combatStyle: "ranged",
    weaponId: "shortbow",
    ammoId: "bronze_arrow",
    requiredItems: ["shortbow", "bronze_arrow"]
  },
  {
    combatStyle: "magic",
    weaponId: "staff_of_air",
    ammoId: undefined,
    requiredItems: ["staff_of_air"]
  }
] as const;

export const RAW_LOSTCITY_REPRESENTATIVE_CALCULATION_IMPACT_CASES = [
  ...["giant", "black_dragon", "dark_wizard_20"].flatMap((monsterId) =>
    RAW_RUNTIME_STYLE_CONFIG.map(({ combatStyle, weaponId, ammoId, requiredItems }) => ({
      id: `raw_${combatStyle}_${monsterId}`,
      label: `Raw ${combatStyle} ${monsterId}`,
      tags: ["raw-source", combatStyle, monsterId],
      input: rawRuntimeImpactInput(monsterId, combatStyle, weaponId, ammoId),
      requiredItems
    }))
  ),
  {
    id: "raw_thrown_rune_knife_black_dragon",
    label: "Raw thrown Rune knife Black Dragon",
    tags: ["raw-source", "ranged", "thrown", "high-tier"],
    input: rawRuntimeImpactInput("black_dragon", "ranged", "rune_knife_w"),
    requiredItems: ["rune_knife_w", "rune_knife"]
  }
] satisfies readonly RepresentativeCalculationImpactCase[];

export const RAW_LOSTCITY_ALL_MONSTER_SCAN_BASELINES = RAW_RUNTIME_STYLE_CONFIG.map(
  ({ combatStyle, weaponId, ammoId, requiredItems }) => ({
    id: `raw_${combatStyle}`,
    label: `Raw ${combatStyle}`,
    combatStyle,
    requiredItems,
    inputForMonster: (monsterId: EntityId) =>
      rawRuntimeImpactInput(monsterId, combatStyle, weaponId, ammoId)
  })
) satisfies readonly AllMonsterScanBaseline[];

const RAW_LOSTCITY_ACCEPTED_CALCULATION_CHANGES: Readonly<Record<string, string>> =
  Object.fromEntries(
    RAW_LOSTCITY_REPRESENTATIVE_CALCULATION_IMPACT_CASES.map((testCase) => [
      testCase.id,
      testCase.id === "raw_thrown_rune_knife_black_dragon"
        ? "Accepted source-backed thrown-weapon accuracy delta under D-057."
        : "Accepted source-backed monster combat and core-loot delta under D-055."
    ])
  );

const SourceMetadataSchema = z
  .object({
    name: z.string().min(1).optional(),
    revision: z.string().min(1).optional(),
    commit: z.string().min(1).optional()
  })
  .strict();

const FoundationSourceManifestSchema = z
  .object({
    source: SourceMetadataSchema.optional(),
    snapshot: GameDataSnapshotSchema.optional()
  })
  .strict();

type FoundationSourceManifest = z.infer<typeof FoundationSourceManifestSchema>;

const SourceEntityIdSchema = z.string().min(1);

const SourceRequirementLevelSchema = z.number().int().min(1).max(99);

const SourceRequirementSkillsSchema = z
  .object(
    Object.fromEntries(
      ITEM_REQUIREMENT_SKILLS.map((skill) => [skill, SourceRequirementLevelSchema.optional()])
    ) as Record<ItemRequirementSkill, z.ZodOptional<typeof SourceRequirementLevelSchema>>
  )
  .strict()
  .superRefine((skills, ctx) => {
    if (ITEM_REQUIREMENT_SKILLS.some((skill) => skills[skill] !== undefined)) return;
    ctx.addIssue({
      code: "custom",
      message: "item requirement must include at least one supported skill"
    });
  });

const SourceItemRequirementSchema = z
  .object({
    skills: SourceRequirementSkillsSchema,
    notes: z.string().min(1).optional(),
    sourceRef: z.string().min(1).optional()
  })
  .strict();

const SourceItemSchema = z
  .object({
    id: SourceEntityIdSchema,
    name: z.string().min(1),
    price: NonNegativeNumberSchema.optional(),
    alch: NonNegativeNumberSchema.optional(),
    stackable: z.boolean().optional(),
    requirements: SourceItemRequirementSchema.optional(),
    notes: z.string().min(1).optional(),
    sourceRef: z.string().min(1).optional()
  })
  .strict();

const SourceAttackBonusesSchema = z
  .object({
    stab: NumericSchema.optional(),
    slash: NumericSchema.optional(),
    crush: NumericSchema.optional()
  })
  .strict();

const SourceWeaponSchema = z
  .object({
    id: SourceEntityIdSchema,
    name: z.string().min(1),
    type: z.enum(["melee", "ranged", "magic"]),
    wclass: z.string().min(1).optional(),
    sub: z.string().min(1).optional(),
    ammoKey: SourceEntityIdSchema.optional(),
    accBonus: NumericSchema,
    dmgBonus: NumericSchema,
    speed: NonNegativeNumberSchema,
    acc: SourceAttackBonusesSchema.optional(),
    twoHand: z.boolean().optional(),
    poisonSeverity: NonNegativeNumberSchema.optional(),
    provides: SourceEntityIdSchema.optional(),
    alch: NonNegativeNumberSchema.optional(),
    requirements: SourceItemRequirementSchema.optional()
  })
  .strict();

const SourceAmmoSchema = z
  .object({
    id: SourceEntityIdSchema,
    name: z.string().min(1),
    rangeBonus: NumericSchema,
    kind: z.string().min(1).optional(),
    fam: z.string().min(1).optional(),
    tier: NonNegativeNumberSchema.optional(),
    barKey: SourceEntityIdSchema.optional(),
    priceKey: SourceEntityIdSchema.optional(),
    alch: NonNegativeNumberSchema.optional(),
    price: NonNegativeNumberSchema.optional()
  })
  .strict();

const SourceSpellSchema = z
  .object({
    id: SourceEntityIdSchema,
    name: z.string().min(1),
    base: NonNegativeNumberSchema,
    lvl: NonNegativeNumberSchema.optional(),
    baseXp: NonNegativeNumberSchema.optional(),
    god: z.boolean().optional(),
    staff: z.string().min(1).optional(),
    label: z.string().min(1).optional(),
    runes: z.record(SourceEntityIdSchema, NonNegativeNumberSchema).optional()
  })
  .strict();

const SourceEquipmentBonusesSchema = z
  .object(
    Object.fromEntries(BONUS_KEYS.map((key) => [key, NumericSchema.optional()])) as Record<
      (typeof BONUS_KEYS)[number],
      z.ZodOptional<typeof NumericSchema>
    >
  )
  .strict();

const SourceEquipmentItemSchema = z
  .object({
    slot: z.enum(EQUIPMENT_SLOTS),
    id: SourceEntityIdSchema,
    name: z.string().min(1),
    alch: NonNegativeNumberSchema.optional(),
    note: z.string().min(1).optional(),
    approx: z.boolean().optional(),
    recoil: z.boolean().optional(),
    bonuses: SourceEquipmentBonusesSchema.optional(),
    requirements: SourceItemRequirementSchema.optional()
  })
  .strict();

const SourceItemsFileSchema = z.object({ items: z.array(SourceItemSchema) }).strict();
const SourceWeaponsFileSchema = z.object({ weapons: z.array(SourceWeaponSchema) }).strict();
const SourceAmmoFileSchema = z.object({ ammo: z.array(SourceAmmoSchema) }).strict();
const SourceSpellsFileSchema = z.object({ spells: z.array(SourceSpellSchema) }).strict();
const SourceEquipmentFileSchema = z
  .object({ equipment: z.array(SourceEquipmentItemSchema) })
  .strict();

const SourceDropExpansionEntrySchema = z
  .object({
    name: z.string().min(1),
    key: SourceEntityIdSchema.optional(),
    weight: z.union([NonNegativeNumberSchema, z.string().min(1)]).optional(),
    chance: ProbabilitySchema.optional(),
    qty: NonNegativeNumberSchema.optional(),
    qtyAvg: NonNegativeNumberSchema.optional(),
    price: NonNegativeNumberSchema.optional(),
    tag: z.string().min(1).optional(),
    talisman: z.boolean().optional(),
    mega: z.boolean().optional()
  })
  .strict()
  .superRefine((entry, ctx) => {
    if (
      entry.key === undefined &&
      entry.weight === undefined &&
      entry.chance === undefined &&
      entry.qty === undefined &&
      entry.qtyAvg === undefined &&
      entry.price === undefined &&
      entry.tag === undefined
    ) {
      ctx.addIssue({
        code: "custom",
        message: "nested loot row must include key, weight, chance, quantity, price or tag detail"
      });
    }
  });

const SourceDropSchema = z
  .object({
    name: z.string().min(1),
    key: SourceEntityIdSchema.optional(),
    chance: ProbabilitySchema,
    qtyAvg: NonNegativeNumberSchema,
    price: NonNegativeNumberSchema.optional(),
    alchValue: NonNegativeNumberSchema.optional(),
    tag: z.string().min(1).optional(),
    slotFrac: NonNegativeNumberSchema.optional(),
    prayerXp: NonNegativeNumberSchema.optional(),
    notes: z.string().min(1).optional(),
    sourceRef: z.string().min(1).optional(),
    _expand: z.array(SourceDropExpansionEntrySchema).optional()
  })
  .strict();

const SourceDropEntrySchema = z.union([SourceDropSchema, z.array(SourceDropSchema).min(1)]);

const SourceMonsterSchema = z
  .object({
    id: SourceEntityIdSchema,
    name: z.string().min(1),
    level: NumericSchema.optional(),
    hp: NonNegativeNumberSchema,
    attack: NumericSchema.optional(),
    strength: NumericSchema.optional(),
    defLevel: NumericSchema.optional(),
    attackSpeed: NonNegativeNumberSchema.optional(),
    attBonus: NumericSchema.optional(),
    strBonus: NumericSchema.optional(),
    magicLevel: NumericSchema.optional(),
    defStab: NumericSchema.optional(),
    defSlash: NumericSchema.optional(),
    defCrush: NumericSchema.optional(),
    defRange: NumericSchema.optional(),
    defMagic: NumericSchema.optional(),
    loot: z.array(SourceDropEntrySchema).optional(),
    notes: z.string().min(1).optional(),
    sourceRef: z.string().min(1).optional()
  })
  .strict();

const SourceMonstersFileSchema = z.object({ monsters: z.array(SourceMonsterSchema) }).strict();

type SourceItem = z.infer<typeof SourceItemSchema>;
type SourceWeapon = z.infer<typeof SourceWeaponSchema>;
type SourceAmmo = z.infer<typeof SourceAmmoSchema>;
type SourceSpell = z.infer<typeof SourceSpellSchema>;
type SourceEquipmentItem = z.infer<typeof SourceEquipmentItemSchema>;
type SourceItemRequirement = z.infer<typeof SourceItemRequirementSchema>;
type SourceDrop = z.infer<typeof SourceDropSchema>;
type SourceDropEntry = z.infer<typeof SourceDropEntrySchema>;
type SourceMonster = z.infer<typeof SourceMonsterSchema>;

type GeneratedRequirements = NonNullable<GameDataSnapshot["requirements"]>;

interface SourceRequirementCandidate {
  itemId: EntityId;
  skills: ItemRequirementDefinition["skills"];
  sourceRef: string;
  notes?: string;
}

interface SourceBackedSlice {
  items: GameDataSnapshot["items"];
  monsters: GameDataSnapshot["monsters"];
  weapons: GameDataSnapshot["weapons"];
  ammo: GameDataSnapshot["ammo"];
  spells: GameDataSnapshot["spells"];
  equipment: GameDataSnapshot["equipment"];
  requirements?: GeneratedRequirements;
}

function toPosixPath(path: string): string {
  return path.split(sep).join("/");
}

function isInsideOrEqual(parent: string, child: string): boolean {
  const relativePath = relative(parent, child);
  return relativePath === "" || (!relativePath.startsWith("..") && !isAbsolute(relativePath));
}

function labelRepoPath(repoRoot: string, absolutePath: string): string {
  if (!isInsideOrEqual(repoRoot, absolutePath)) return "<outside-repository>";
  const relativePath = relative(repoRoot, absolutePath);
  return relativePath ? toPosixPath(relativePath) : ".";
}

function assertRepoLocalPath(
  repoRoot: string,
  absolutePath: string,
  code: GameDataGeneratorErrorCode
) {
  if (isInsideOrEqual(repoRoot, absolutePath)) return;
  const noun = code === "source_outside_repo" ? "source" : "output root";
  throw new GameDataGeneratorError(
    code,
    `Game data ${noun} path must stay inside this repository. Pass a repository-relative path.`
  );
}

export function createGameDataGenerationPlan(
  options: GameDataGenerationPlanOptions = {}
): GameDataGenerationPlan {
  const repoRoot = resolve(options.repoRoot ?? process.cwd());
  const sourceDir = resolve(repoRoot, options.sourceDir ?? DEFAULT_GAME_DATA_SOURCE_DIR);
  const outputRoot = resolve(repoRoot, options.outputRoot ?? ".");
  const sourceDirLabel = labelRepoPath(repoRoot, sourceDir);
  const outputRootLabel = labelRepoPath(repoRoot, outputRoot);

  assertRepoLocalPath(repoRoot, sourceDir, "source_outside_repo");
  assertRepoLocalPath(repoRoot, outputRoot, "output_outside_repo");

  if (!existsSync(sourceDir)) {
    throw new GameDataGeneratorError(
      "source_missing",
      `Game data source not found at ${sourceDirLabel}. Add a local LostCityRS/Content checkout there or pass --source-dir <repo-relative path>.`
    );
  }

  if (!statSync(sourceDir).isDirectory()) {
    throw new GameDataGeneratorError(
      "source_not_directory",
      `Game data source at ${sourceDirLabel} is not a directory.`
    );
  }

  const outputs = Object.fromEntries(
    Object.entries(GENERATED_GAME_DATA_OUTPUT_PATHS).map(([key, targetPath]) => {
      const absolutePath = resolve(outputRoot, targetPath);
      return [
        key,
        {
          key,
          targetPath,
          absolutePath,
          pathLabel: labelRepoPath(repoRoot, absolutePath)
        }
      ];
    })
  ) as Record<GeneratedGameDataOutputKey, GameDataGenerationOutputPath>;

  const manifestPath = join(sourceDir, FOUNDATION_SOURCE_MANIFEST_FILE);
  const sourceSliceDir = join(sourceDir, SOURCE_BACKED_SLICE_DIR);
  let parserStatus: GameDataGenerationPlan["parserStatus"];
  if (existsSync(sourceSliceDir)) {
    if (!statSync(sourceSliceDir).isDirectory()) {
      throw new GameDataGeneratorError(
        "source_slice_invalid",
        `Game data source-backed slice ${SOURCE_BACKED_SLICE_DIR} is not a directory.`
      );
    }
    parserStatus = "source-backed-slice";
  } else if (existsSync(join(sourceDir, "scripts"))) {
    if (!statSync(join(sourceDir, "scripts")).isDirectory()) {
      throw new GameDataGeneratorError(
        "source_slice_invalid",
        "LostCity raw content source scripts path is not a directory."
      );
    }
    parserStatus = "raw-lostcity";
  } else {
    parserStatus = existsSync(manifestPath) ? "foundation-manifest" : "foundation-empty";
  }

  return {
    generatorVersion: GAME_DATA_GENERATOR_VERSION,
    parserStatus,
    repoRoot,
    sourceDir,
    sourceDirLabel,
    outputRoot,
    outputRootLabel,
    outputs,
    notes: [
      "This generator validates the local source checkout and writes a schema-valid normalized snapshot.",
      "The raw LostCity parser reads monster, drop, item, equipment, weapon, ammo and spell fields directly from the pinned checkout when scripts/ is present.",
      "Normalized source-slice fixtures remain supported for isolated generator contract tests.",
      "It does not change runtime data loading."
    ]
  };
}

export function formatGameDataGenerationPlan(plan: GameDataGenerationPlan): string {
  return [
    `Game data generator ${plan.generatorVersion} ready.`,
    `Source: ${plan.sourceDirLabel}`,
    `Output root: ${plan.outputRootLabel}`,
    "Planned outputs:",
    `- source pin: ${plan.outputs.sourcePin.pathLabel}`,
    `- game data snapshot: ${plan.outputs.gameData.pathLabel}`,
    `- revision impact report: ${plan.outputs.revisionImpact.pathLabel}`,
    `Parser status: ${plan.parserStatus}.`,
    "No files were written."
  ].join("\n");
}

function stableSort(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(stableSort);
  if (value === null || typeof value !== "object") return value;
  return Object.fromEntries(
    Object.entries(value as Record<string, unknown>)
      .sort(([left], [right]) => (left < right ? -1 : left > right ? 1 : 0))
      .map(([key, nestedValue]) => [key, stableSort(nestedValue)])
  );
}

function stableJson(value: unknown): string {
  return `${JSON.stringify(stableSort(value), null, 2)}\n`;
}

function inlineCode(value: string): string {
  return `\`${value.replace(/`/g, "'")}\``;
}

const FORBIDDEN_GENERATED_DATA_KEYS = new Map(
  [
    "raw",
    "rawSource",
    "rawUpstream",
    "upstreamDump",
    "sourceFiles",
    "historicalSnapshots",
    "priceHistory",
    "marketPriceHistory"
  ].map((key) => [key.toLowerCase(), key])
);

const FORBIDDEN_GENERATED_DATA_TEXT_PATTERNS = [
  {
    pattern: /(^|[\s"`'])\/Users\//,
    label: "absolute user-home path"
  },
  {
    pattern: /(^|[\s"`'])\/home\//,
    label: "absolute user-home path"
  },
  {
    pattern: /[A-Za-z]:\\Users\\/,
    label: "absolute user-home path"
  },
  {
    pattern: /src\/data\/generated\/(?:archive|history|snapshots)\//,
    label: "historical generated snapshot archive path"
  },
  {
    pattern: /docs\/project\/revision-impact\/(?:archive|history|snapshots)\//,
    label: "historical revision-impact archive path"
  }
];

function collectObjectKeys(value: unknown, keys = new Set<string>()): Set<string> {
  if (Array.isArray(value)) {
    value.forEach((entry) => collectObjectKeys(entry, keys));
    return keys;
  }
  if (value === null || typeof value !== "object") return keys;
  for (const [key, nestedValue] of Object.entries(value as Record<string, unknown>)) {
    keys.add(key);
    collectObjectKeys(nestedValue, keys);
  }
  return keys;
}

function parseGeneratedOutputJson(text: string, label: string): unknown {
  try {
    return JSON.parse(text) as unknown;
  } catch {
    throw new GameDataGeneratorError(
      "output_validation_failed",
      `Generated output ${label} is not valid JSON.`
    );
  }
}

export function assertGeneratedDataOutputHygiene(outputs: GeneratedGameDataOutputTexts): void {
  const keys = new Set<string>();
  collectObjectKeys(parseGeneratedOutputJson(outputs.sourcePinText, "source-pin.json"), keys);
  collectObjectKeys(parseGeneratedOutputJson(outputs.gameDataText, "game-data.json"), keys);

  for (const key of keys) {
    const forbiddenKey = FORBIDDEN_GENERATED_DATA_KEYS.get(key.toLowerCase());
    if (!forbiddenKey) continue;
    throw new GameDataGeneratorError(
      "output_validation_failed",
      `Generated outputs must not contain forbidden generated-data key ${inlineCode(forbiddenKey)}.`
    );
  }

  const combinedText = [
    outputs.sourcePinText,
    outputs.gameDataText,
    outputs.revisionImpactText
  ].join("\n");
  for (const { pattern, label } of FORBIDDEN_GENERATED_DATA_TEXT_PATTERNS) {
    if (!pattern.test(combinedText)) continue;
    throw new GameDataGeneratorError(
      "output_validation_failed",
      `Generated outputs must not contain ${label}.`
    );
  }
}

function readManifest(sourceDir: string): FoundationSourceManifest {
  const manifestPath = join(sourceDir, FOUNDATION_SOURCE_MANIFEST_FILE);
  if (!existsSync(manifestPath)) return {};

  try {
    const parsed = parseJsonWithDuplicateKeyCheck(readFileSync(manifestPath, "utf8"), {
      source: FOUNDATION_SOURCE_MANIFEST_FILE
    });
    return FoundationSourceManifestSchema.parse(parsed);
  } catch {
    throw new GameDataGeneratorError(
      "source_manifest_invalid",
      `Game data foundation source manifest ${FOUNDATION_SOURCE_MANIFEST_FILE} is invalid.`
    );
  }
}

function sourceSliceLabel(fileName: string): string {
  return `${SOURCE_BACKED_SLICE_DIR}/${fileName}`;
}

function readSourceSliceFile<T>(sourceDir: string, fileName: string, schema: z.ZodType<T>): T {
  const path = join(sourceDir, SOURCE_BACKED_SLICE_DIR, fileName);
  const label = sourceSliceLabel(fileName);

  if (!existsSync(path) || !statSync(path).isFile()) {
    throw new GameDataGeneratorError(
      "source_slice_invalid",
      `Game data source-backed slice file ${label} is missing.`
    );
  }

  try {
    const parsed = parseJsonWithDuplicateKeyCheck(readFileSync(path, "utf8"), {
      source: label
    });
    return schema.parse(parsed);
  } catch {
    throw new GameDataGeneratorError(
      "source_slice_invalid",
      `Game data source-backed slice file ${label} is invalid.`
    );
  }
}

function assertUniqueSourceIds(
  entries: readonly { id: string }[],
  label: string,
  getScope: (entry: { id: string }) => string = () => ""
): void {
  const seen = new Map<string, number>();
  for (const [index, entry] of entries.entries()) {
    const scopedId = `${getScope(entry)}:${entry.id}`;
    const previous = seen.get(scopedId);
    if (previous === undefined) {
      seen.set(scopedId, index);
      continue;
    }
    throw new GameDataGeneratorError(
      "source_slice_invalid",
      `Game data source-backed slice file ${label} contains duplicate id ${inlineCode(entry.id)}.`
    );
  }
}

function sourceBackedProvenance(
  fileName: string,
  id: string,
  sourceRef?: string,
  notes = "Parsed from repository-local source-backed slice; raw source files are not embedded."
): DataProvenance {
  return {
    source: "generated",
    sourceRef: sourceRef ?? `${sourceSliceLabel(fileName)}#${id}`,
    notes
  };
}

function orderedRequirementSkills(
  skills: SourceItemRequirement["skills"]
): ItemRequirementDefinition["skills"] {
  return Object.fromEntries(
    ITEM_REQUIREMENT_SKILLS.flatMap((skill) =>
      skills[skill] === undefined ? [] : [[skill, skills[skill]]]
    )
  ) as ItemRequirementDefinition["skills"];
}

function requirementSkillsKey(skills: ItemRequirementDefinition["skills"]): string {
  return JSON.stringify(orderedRequirementSkills(skills));
}

function sourceRequirementCandidate(
  fileName: string,
  entry: { id: string; requirements?: SourceItemRequirement }
): SourceRequirementCandidate | undefined {
  if (!entry.requirements) return undefined;
  return {
    itemId: entry.id,
    skills: orderedRequirementSkills(entry.requirements.skills),
    sourceRef:
      entry.requirements.sourceRef ?? `${sourceSliceLabel(fileName)}#${entry.id}.requirements`,
    ...(entry.requirements.notes ? { notes: entry.requirements.notes } : {})
  };
}

function mergeRequirementCandidates(
  candidates: readonly SourceRequirementCandidate[]
): GeneratedRequirements {
  const merged = new Map<
    EntityId,
    {
      skills: ItemRequirementDefinition["skills"];
      sourceRefs: Set<string>;
      notes: Set<string>;
    }
  >();

  for (const candidate of candidates) {
    const existing = merged.get(candidate.itemId);
    if (!existing) {
      merged.set(candidate.itemId, {
        skills: candidate.skills,
        sourceRefs: new Set([candidate.sourceRef]),
        notes: new Set(candidate.notes ? [candidate.notes] : [])
      });
      continue;
    }

    if (requirementSkillsKey(existing.skills) !== requirementSkillsKey(candidate.skills)) {
      throw new GameDataGeneratorError(
        "source_slice_invalid",
        `Game data source-backed requirements contain conflicting values for item ${inlineCode(candidate.itemId)}.`
      );
    }

    existing.sourceRefs.add(candidate.sourceRef);
    if (candidate.notes) existing.notes.add(candidate.notes);
  }

  return Object.fromEntries(
    [...merged.entries()]
      .sort(([left], [right]) => (left < right ? -1 : left > right ? 1 : 0))
      .map(([itemId, entry]) => {
        const sourceRefs = [...entry.sourceRefs].sort();
        const notes = [...entry.notes].sort();
        const requirement: ItemRequirementDefinition = {
          itemId,
          skills: orderedRequirementSkills(entry.skills),
          provenance: {
            source: "generated",
            sourceRef: sourceRefs.join(", "),
            notes:
              "Parsed from repository-local source-backed requirement slices; raw source files are not embedded."
          },
          ...(notes.length ? { notes: notes.join(" | ") } : {})
        };
        return [itemId, requirement];
      })
  );
}

function assertRequirementItemsExist(
  requirements: GeneratedRequirements,
  items: GameDataSnapshot["items"]
): void {
  for (const itemId of Object.keys(requirements)) {
    if (items[itemId]) continue;
    throw new GameDataGeneratorError(
      "source_slice_invalid",
      `Game data source-backed requirements reference unknown item ${inlineCode(itemId)}.`
    );
  }
}

function toItemDefinition(entry: SourceItem): ItemDefinition {
  return {
    id: entry.id,
    name: entry.name,
    ...(entry.price !== undefined ? { price: entry.price } : {}),
    ...(entry.alch !== undefined ? { alch: entry.alch } : {}),
    ...(entry.stackable !== undefined ? { stackable: entry.stackable } : {}),
    provenance: sourceBackedProvenance(SOURCE_BACKED_SLICE_FILES.items, entry.id, entry.sourceRef),
    ...(entry.notes ? { notes: entry.notes } : {})
  };
}

function toWeaponDefinition(entry: SourceWeapon): WeaponDefinition {
  return {
    name: entry.name,
    type: entry.type,
    ...(entry.wclass ? { wclass: entry.wclass } : {}),
    ...(entry.sub ? { sub: entry.sub } : {}),
    ...(entry.ammoKey ? { ammoKey: entry.ammoKey } : {}),
    accBonus: entry.accBonus,
    dmgBonus: entry.dmgBonus,
    speed: entry.speed,
    ...(entry.acc ? { acc: entry.acc } : {}),
    ...(entry.twoHand !== undefined ? { twoHand: entry.twoHand } : {}),
    ...(entry.poisonSeverity !== undefined ? { poisonSeverity: entry.poisonSeverity } : {}),
    ...(entry.provides ? { provides: entry.provides } : {}),
    ...(entry.alch !== undefined ? { alch: entry.alch } : {})
  };
}

function toAmmoDefinition(entry: SourceAmmo): AmmoDefinition {
  return {
    name: entry.name,
    rangeBonus: entry.rangeBonus,
    ...(entry.kind ? { kind: entry.kind } : {}),
    ...(entry.fam ? { fam: entry.fam } : {}),
    ...(entry.tier !== undefined ? { tier: entry.tier } : {}),
    ...(entry.barKey ? { barKey: entry.barKey } : {}),
    ...(entry.priceKey ? { priceKey: entry.priceKey } : {}),
    ...(entry.alch !== undefined ? { alch: entry.alch } : {}),
    ...(entry.price !== undefined ? { price: entry.price } : {})
  };
}

function toSpellDefinition(entry: SourceSpell): SpellDefinition {
  return {
    name: entry.name,
    base: entry.base,
    ...(entry.lvl !== undefined ? { lvl: entry.lvl } : {}),
    ...(entry.baseXp !== undefined ? { baseXp: entry.baseXp } : {}),
    ...(entry.god !== undefined ? { god: entry.god } : {}),
    ...(entry.staff ? { staff: entry.staff } : {}),
    ...(entry.label ? { label: entry.label } : {}),
    ...(entry.runes ? { runes: entry.runes } : {})
  };
}

function toEquipmentItemDefinition(entry: SourceEquipmentItem): EquipmentItemDefinition {
  return {
    name: entry.name,
    ...(entry.alch !== undefined ? { alch: entry.alch } : {}),
    ...(entry.note ? { note: entry.note } : {}),
    ...(entry.approx !== undefined ? { approx: entry.approx } : {}),
    ...(entry.recoil !== undefined ? { recoil: entry.recoil } : {}),
    ...(entry.bonuses ?? {})
  };
}

function toDropDefinition(
  entry: SourceDrop,
  monsterId: string,
  sourcePath: string
): DropDefinition {
  return {
    name: entry.name,
    ...(entry.key ? { key: entry.key } : {}),
    chance: entry.chance,
    qtyAvg: entry.qtyAvg,
    ...(entry.price !== undefined ? { price: entry.price } : {}),
    ...(entry.alchValue !== undefined ? { alchValue: entry.alchValue } : {}),
    ...(entry.tag ? { tag: entry.tag } : {}),
    ...(entry.slotFrac !== undefined ? { slotFrac: entry.slotFrac } : {}),
    ...(entry.prayerXp !== undefined ? { prayerXp: entry.prayerXp } : {}),
    provenance: sourceBackedProvenance(
      SOURCE_BACKED_SLICE_FILES.monsters,
      `${monsterId}.loot.${sourcePath}`,
      entry.sourceRef,
      "Parsed from repository-local source-backed monster/drop slice; raw source files are not embedded."
    ),
    ...(entry.notes ? { notes: entry.notes } : {}),
    ...(entry._expand ? { _expand: entry._expand } : {})
  };
}

function toDropEntry(entry: SourceDropEntry, monsterId: string, index: number): DropEntry {
  if (Array.isArray(entry)) {
    return entry.map((drop, groupIndex) =>
      toDropDefinition(drop, monsterId, `${index}.${groupIndex}`)
    );
  }
  return toDropDefinition(entry, monsterId, String(index));
}

function toMonsterDefinition(entry: SourceMonster): MonsterDefinition {
  const provenanceNotes = [
    "Parsed from repository-local source-backed monster/drop slice; raw source files are not embedded.",
    entry.notes
  ]
    .filter((note): note is string => Boolean(note))
    .join(" ");

  return {
    id: entry.id,
    name: entry.name,
    ...(entry.level !== undefined ? { level: entry.level } : {}),
    hp: entry.hp,
    ...(entry.attack !== undefined ? { attack: entry.attack } : {}),
    ...(entry.strength !== undefined ? { strength: entry.strength } : {}),
    ...(entry.defLevel !== undefined ? { defLevel: entry.defLevel } : {}),
    ...(entry.attackSpeed !== undefined ? { attackSpeed: entry.attackSpeed } : {}),
    ...(entry.attBonus !== undefined ? { attBonus: entry.attBonus } : {}),
    ...(entry.strBonus !== undefined ? { strBonus: entry.strBonus } : {}),
    ...(entry.magicLevel !== undefined ? { magicLevel: entry.magicLevel } : {}),
    ...(entry.defStab !== undefined ? { defStab: entry.defStab } : {}),
    ...(entry.defSlash !== undefined ? { defSlash: entry.defSlash } : {}),
    ...(entry.defCrush !== undefined ? { defCrush: entry.defCrush } : {}),
    ...(entry.defRange !== undefined ? { defRange: entry.defRange } : {}),
    ...(entry.defMagic !== undefined ? { defMagic: entry.defMagic } : {}),
    ...(entry.loot
      ? { loot: entry.loot.map((drop, index) => toDropEntry(drop, entry.id, index)) }
      : {}),
    provenance: sourceBackedProvenance(
      SOURCE_BACKED_SLICE_FILES.monsters,
      entry.id,
      entry.sourceRef,
      provenanceNotes
    )
  };
}

function recordById<T extends { id: string }, U>(
  entries: readonly T[],
  label: string,
  transform: (entry: T) => U
): Record<string, U> {
  assertUniqueSourceIds(entries, label);
  return Object.fromEntries(entries.map((entry) => [entry.id, transform(entry)]));
}

function parseSourceBackedSlice(sourceDir: string): SourceBackedSlice {
  const itemsFile = readSourceSliceFile(
    sourceDir,
    SOURCE_BACKED_SLICE_FILES.items,
    SourceItemsFileSchema
  );
  const monstersFile = readSourceSliceFile(
    sourceDir,
    SOURCE_BACKED_SLICE_FILES.monsters,
    SourceMonstersFileSchema
  );
  const weaponsFile = readSourceSliceFile(
    sourceDir,
    SOURCE_BACKED_SLICE_FILES.weapons,
    SourceWeaponsFileSchema
  );
  const ammoFile = readSourceSliceFile(
    sourceDir,
    SOURCE_BACKED_SLICE_FILES.ammo,
    SourceAmmoFileSchema
  );
  const spellsFile = readSourceSliceFile(
    sourceDir,
    SOURCE_BACKED_SLICE_FILES.spells,
    SourceSpellsFileSchema
  );
  const equipmentFile = readSourceSliceFile(
    sourceDir,
    SOURCE_BACKED_SLICE_FILES.equipment,
    SourceEquipmentFileSchema
  );

  assertUniqueSourceIds(
    equipmentFile.equipment,
    sourceSliceLabel(SOURCE_BACKED_SLICE_FILES.equipment),
    (entry) => (entry as SourceEquipmentItem).slot
  );
  assertUniqueSourceIds(itemsFile.items, sourceSliceLabel(SOURCE_BACKED_SLICE_FILES.items));

  const equipment = emptyEquipment();
  for (const entry of equipmentFile.equipment) {
    equipment[entry.slot as EquipmentSlot][entry.id] = toEquipmentItemDefinition(entry);
  }
  const items = Object.fromEntries(
    itemsFile.items.map((entry) => [entry.id, toItemDefinition(entry)])
  );
  const requirements = mergeRequirementCandidates(
    [
      ...itemsFile.items.flatMap((entry) => [
        sourceRequirementCandidate(SOURCE_BACKED_SLICE_FILES.items, entry)
      ]),
      ...weaponsFile.weapons.flatMap((entry) => [
        sourceRequirementCandidate(SOURCE_BACKED_SLICE_FILES.weapons, entry)
      ]),
      ...equipmentFile.equipment.flatMap((entry) => [
        sourceRequirementCandidate(SOURCE_BACKED_SLICE_FILES.equipment, entry)
      ])
    ].filter((candidate): candidate is SourceRequirementCandidate => candidate !== undefined)
  );
  assertRequirementItemsExist(requirements, items);

  const slice: SourceBackedSlice = {
    items,
    monsters: recordById(
      monstersFile.monsters,
      sourceSliceLabel(SOURCE_BACKED_SLICE_FILES.monsters),
      toMonsterDefinition
    ),
    weapons: recordById(
      weaponsFile.weapons,
      sourceSliceLabel(SOURCE_BACKED_SLICE_FILES.weapons),
      toWeaponDefinition
    ),
    ammo: recordById(
      ammoFile.ammo,
      sourceSliceLabel(SOURCE_BACKED_SLICE_FILES.ammo),
      toAmmoDefinition
    ),
    spells: recordById(
      spellsFile.spells,
      sourceSliceLabel(SOURCE_BACKED_SLICE_FILES.spells),
      toSpellDefinition
    ),
    equipment
  };
  if (Object.keys(requirements).length) slice.requirements = requirements;
  return slice;
}

function emptyEquipment(): GameDataSnapshot["equipment"] {
  return Object.fromEntries(
    EQUIPMENT_SLOTS.map((slot) => [slot, {}])
  ) as GameDataSnapshot["equipment"];
}

function createEmptyFoundationSnapshot(provenance: DataProvenance): GameDataSnapshot {
  return parseGameDataSnapshot({
    id: "generated-foundation-empty",
    label: "Generated game data foundation empty snapshot",
    items: {},
    monsters: {},
    weapons: {},
    ammo: {},
    spells: {},
    equipment: emptyEquipment(),
    provenance
  });
}

function isoTimestamp(value: Date | string | undefined): string {
  const date = value instanceof Date ? value : new Date(value ?? Date.now());
  if (Number.isNaN(date.getTime())) {
    throw new GameDataGeneratorError("invalid_argument", "Invalid generatedAt timestamp");
  }
  return date.toISOString();
}

function readGitCommit(sourceDir: string): string | undefined {
  const gitDir = join(sourceDir, ".git");
  if (!existsSync(gitDir) || !statSync(gitDir).isDirectory()) return undefined;

  try {
    const head = readFileSync(join(gitDir, "HEAD"), "utf8").trim();
    if (/^[0-9a-f]{7,40}$/i.test(head)) return head;
    const refMatch = /^ref: (.+)$/.exec(head);
    if (!refMatch) return undefined;
    const refPath = join(gitDir, refMatch[1]);
    const commit = readFileSync(refPath, "utf8").trim();
    return /^[0-9a-f]{7,40}$/i.test(commit) ? commit : undefined;
  } catch {
    return undefined;
  }
}

function readRawRuntimeReference(
  plan: GameDataGenerationPlan,
  override?: GameDataSnapshot
): GameDataSnapshot {
  if (override) return parseGameDataSnapshot(override);
  const path = join(plan.repoRoot, RAW_RUNTIME_REFERENCE_PATH);
  try {
    return parseGameDataSnapshot(
      parseJsonWithDuplicateKeyCheck(readFileSync(path, "utf8"), {
        source: RAW_RUNTIME_REFERENCE_PATH
      })
    );
  } catch {
    throw new GameDataGeneratorError(
      "raw_reference_invalid",
      `Raw LostCity generation requires a valid runtime identity reference at ${RAW_RUNTIME_REFERENCE_PATH}.`
    );
  }
}

function createRawLostCityGameData(input: Parameters<typeof createLostCityRawSnapshot>[0]) {
  try {
    return createLostCityRawSnapshot(input).snapshot;
  } catch (error) {
    if (error instanceof LostCityContentSourceError) {
      throw new GameDataGeneratorError("source_slice_invalid", error.message);
    }
    if (error instanceof z.ZodError) {
      const paths = [...new Set(error.issues.map((issue) => issue.path.join(".")))]
        .filter(Boolean)
        .slice(0, 5)
        .join(", ");
      throw new GameDataGeneratorError(
        "source_slice_invalid",
        `Raw LostCity snapshot failed schema validation${paths ? ` at ${paths}` : ""}.`
      );
    }
    if (
      error instanceof Error &&
      /^LostCity loot extraction is incomplete for /.test(error.message)
    ) {
      throw new GameDataGeneratorError("source_slice_invalid", error.message);
    }
    throw error;
  }
}

function commandForPlan(
  plan: GameDataGenerationPlan,
  generatedAt: string,
  options: Pick<
    CreateGeneratedGameDataOutputOptions,
    "skipCalculationImpact" | "impactCaseFilter" | "impactOutlierLimit"
  > = {}
): string {
  const parts = [
    "npm run data:generate --",
    `--source-dir ${plan.sourceDirLabel}`,
    `--output-root ${plan.outputRootLabel}`,
    `--generated-at ${generatedAt}`
  ];
  if (options.skipCalculationImpact) {
    parts.push("--skip-calculation-impact");
  }
  if (options.impactCaseFilter) {
    parts.push(`--impact-case-filter ${options.impactCaseFilter}`);
  }
  if (options.impactOutlierLimit !== undefined) {
    parts.push(`--impact-outlier-limit ${options.impactOutlierLimit}`);
  }
  return parts.join(" ");
}

function objectRecord(value: unknown): Record<string, unknown> {
  return value !== null && typeof value === "object" && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : {};
}

function diffRecord(section: string, previous: unknown, next: unknown): SnapshotDiffSection {
  const previousRecord = objectRecord(previous);
  const nextRecord = objectRecord(next);
  const previousIds = new Set(Object.keys(previousRecord));
  const nextIds = new Set(Object.keys(nextRecord));
  const sharedIds = [...nextIds].filter((id) => previousIds.has(id));

  return {
    section,
    added: [...nextIds].filter((id) => !previousIds.has(id)).sort(),
    removed: [...previousIds].filter((id) => !nextIds.has(id)).sort(),
    changed: sharedIds
      .filter((id) => stableJson(previousRecord[id]) !== stableJson(nextRecord[id]))
      .sort()
  };
}

function flattenEquipment(snapshot: GameDataSnapshot): Record<string, unknown> {
  const flattened: Record<string, unknown> = {};
  for (const slot of EQUIPMENT_SLOTS) {
    for (const [itemId, item] of Object.entries(snapshot.equipment[slot] ?? {})) {
      flattened[`${slot}.${itemId}`] = item;
    }
  }
  return flattened;
}

function flattenDrops(snapshot: GameDataSnapshot): Record<string, unknown> {
  const flattened: Record<string, unknown> = {};
  for (const [monsterId, monster] of Object.entries(snapshot.monsters)) {
    for (const [rowIndex, entry] of (monster.loot ?? []).entries()) {
      if (Array.isArray(entry)) {
        for (const [groupIndex, drop] of entry.entries()) {
          flattened[`${monsterId}.${rowIndex}.${groupIndex}`] = drop;
        }
      } else {
        flattened[`${monsterId}.${rowIndex}`] = entry;
      }
    }
  }
  return flattened;
}

function sanitizeMessage(message: string): string {
  return message
    .replaceAll(process.cwd(), "<repo>")
    .replace(/\/Users\/[^\s`"')]+/g, "<user-home>")
    .replace(/\/home\/[^\s`"')]+/g, "<user-home>");
}

function readCurrentCalculationPriceSet(plan: GameDataGenerationPlan): {
  priceSet?: PriceSet;
  label: string;
  error?: string;
} {
  const label = "Current prices.json + alch.json";
  try {
    const itemPrices = parseJsonWithDuplicateKeyCheck(
      readFileSync(join(plan.repoRoot, "prices.json"), "utf8"),
      { source: "prices.json" }
    );
    const alchValues = parseJsonWithDuplicateKeyCheck(
      readFileSync(join(plan.repoRoot, "alch.json"), "utf8"),
      { source: "alch.json" }
    );
    return {
      label,
      priceSet: createPriceSetFromLegacyRecords({
        id: "current-prices-json-alch-json",
        label,
        source: "bundled",
        itemPrices,
        alchValues,
        provenance: {
          source: "manual",
          sourceRef: "prices.json + alch.json",
          notes:
            "Calculation-impact suite reads current prices and alch values only; price-history.json is intentionally excluded."
        }
      })
    };
  } catch (error) {
    const message = error instanceof Error ? sanitizeMessage(error.message) : "unknown error";
    return {
      label,
      error: `current price set could not be loaded from prices.json + alch.json: ${message}`
    };
  }
}

function selectedCalculationImpactCases(
  caseFilter?: string,
  cases: readonly RepresentativeCalculationImpactCase[] = REPRESENTATIVE_CALCULATION_IMPACT_CASES
): readonly RepresentativeCalculationImpactCase[] {
  const filter = caseFilter?.trim();
  if (!filter) return cases;
  return cases.filter(
    (testCase) => testCase.id === filter || (testCase.tags as readonly string[]).includes(filter)
  );
}

function missingEntityNote(
  snapshotLabel: "baseline" | "candidate",
  entityKind: string,
  entityId: string
): string {
  return `${snapshotLabel} missing ${entityKind} ${inlineCode(entityId)}`;
}

function validateCalculationImpactRequirements(
  testCase: RepresentativeCalculationImpactCase,
  snapshot: GameDataSnapshot,
  snapshotLabel: "baseline" | "candidate"
): string[] {
  const notes: string[] = [];
  const request = testCase.input.request;
  const weaponId = request.loadout.weaponId;
  const ammoId = request.loadout.ammoId;
  const spellId = request.spellId;

  if (!snapshot.monsters[request.monsterId]) {
    notes.push(missingEntityNote(snapshotLabel, "monster", request.monsterId));
  }
  if (!snapshot.weapons[weaponId]) {
    notes.push(missingEntityNote(snapshotLabel, "weapon", weaponId));
  }
  if (ammoId && !snapshot.ammo[ammoId]) {
    notes.push(missingEntityNote(snapshotLabel, "ammo", ammoId));
  }
  if (spellId && !snapshot.spells[spellId]) {
    notes.push(missingEntityNote(snapshotLabel, "spell", spellId));
  }
  for (const itemId of testCase.requiredItems) {
    if (!snapshot.items[itemId]) {
      notes.push(missingEntityNote(snapshotLabel, "item", itemId));
    }
  }
  for (const gear of testCase.requiredGear ?? []) {
    if (!snapshot.equipment[gear.slot]?.[gear.itemId]) {
      notes.push(`${snapshotLabel} missing ${gear.slot} gear ${inlineCode(gear.itemId)}`);
    }
  }

  return notes;
}

function evaluateCalculationImpactCase(
  testCase: RepresentativeCalculationImpactCase,
  snapshot: GameDataSnapshot,
  priceSet: PriceSet,
  snapshotLabel: "baseline" | "candidate"
): { result?: FullSimulationResult; notes: string[] } {
  const notes = validateCalculationImpactRequirements(testCase, snapshot, snapshotLabel);
  if (notes.length) return { notes };

  try {
    const context: SimulationContext = {
      gameData: snapshot,
      priceSet
    };
    return {
      result: simulateFullSimulation(testCase.input, context),
      notes
    };
  } catch (error) {
    const message = error instanceof Error ? sanitizeMessage(error.message) : "unknown error";
    return {
      notes: [`${snapshotLabel} simulation failed for ${inlineCode(testCase.id)}: ${message}`]
    };
  }
}

const CALCULATION_IMPACT_METRICS = [
  {
    id: "dps",
    label: "DPS",
    value: (result: FullSimulationResult) => result.rates.effectiveDps
  },
  {
    id: "killsPerHour",
    label: "kills/hr",
    value: (result: FullSimulationResult) => result.rates.effectiveKph
  },
  {
    id: "xpPerHour",
    label: "XP/hr",
    value: (result: FullSimulationResult) => result.xp.totalXpPerHour
  },
  {
    id: "gpPerHour",
    label: "GP/hr",
    value: (result: FullSimulationResult) => result.rates.effectiveNetGpPerHour
  },
  {
    id: "gpPerXp",
    label: "GP/XP",
    value: (result: FullSimulationResult) => {
      const xpPerHour = result.xp.totalXpPerHour;
      if (!Number.isFinite(xpPerHour) || xpPerHour <= 0) return null;
      return result.rates.effectiveNetGpPerHour / xpPerHour;
    }
  }
] as const satisfies ReadonlyArray<{
  id: CalculationImpactMetricId;
  label: string;
  value: (result: FullSimulationResult) => number | null;
}>;

function finiteMetric(value: number | null): number | null {
  return typeof value === "number" && Number.isFinite(value) ? value : null;
}

function calculationMetricDelta(
  metric: (typeof CALCULATION_IMPACT_METRICS)[number],
  baseline: FullSimulationResult,
  candidate: FullSimulationResult
): CalculationImpactMetricDelta {
  const baselineValue = finiteMetric(metric.value(baseline));
  const candidateValue = finiteMetric(metric.value(candidate));
  const delta =
    baselineValue != null && candidateValue != null ? candidateValue - baselineValue : null;
  const percentDelta =
    delta != null && baselineValue != null && baselineValue !== 0
      ? (delta / baselineValue) * 100
      : null;
  const changed =
    baselineValue == null || candidateValue == null
      ? baselineValue !== candidateValue
      : Math.abs(candidateValue - baselineValue) > 1e-9;

  return {
    id: metric.id,
    label: metric.label,
    baseline: baselineValue,
    candidate: candidateValue,
    delta,
    percentDelta,
    changed
  };
}

function failedCalculationImpactCase(
  testCase: RepresentativeCalculationImpactCase,
  notes: string[]
): CalculationImpactCaseResult {
  return {
    id: testCase.id,
    label: testCase.label,
    tags: testCase.tags,
    status: "failed",
    metrics: [],
    notes
  };
}

function calculateImpactCaseResult(
  testCase: RepresentativeCalculationImpactCase,
  baseline: GameDataSnapshot,
  candidate: GameDataSnapshot,
  priceSet: PriceSet,
  acceptedChange?: string
): CalculationImpactCaseResult {
  const baselineResult = evaluateCalculationImpactCase(testCase, baseline, priceSet, "baseline");
  const candidateResult = evaluateCalculationImpactCase(testCase, candidate, priceSet, "candidate");
  const notes = [...baselineResult.notes, ...candidateResult.notes];
  if (!baselineResult.result || !candidateResult.result) {
    return failedCalculationImpactCase(testCase, notes);
  }

  const metrics = CALCULATION_IMPACT_METRICS.map((metric) =>
    calculationMetricDelta(metric, baselineResult.result!, candidateResult.result!)
  );
  const changed = metrics.some((metric) => metric.changed);
  return {
    id: testCase.id,
    label: testCase.label,
    tags: testCase.tags,
    status: changed && !acceptedChange ? "needs-review" : "pass",
    metrics,
    notes: [...notes, ...(changed && acceptedChange ? [acceptedChange] : [])]
  };
}

function summarizeCalculationImpactCases(
  cases: CalculationImpactCaseResult[],
  options: {
    filter?: string;
    priceSetLabel?: string;
    skippedReason?: string;
    notes?: string[];
  } = {}
): CalculationImpactSummary {
  const totals = {
    total: cases.length,
    pass: cases.filter((testCase) => testCase.status === "pass").length,
    needsReview: cases.filter((testCase) => testCase.status === "needs-review").length,
    failed: cases.filter((testCase) => testCase.status === "failed").length
  };
  const status: CalculationImpactSuiteStatus = options.skippedReason
    ? "skipped"
    : totals.failed > 0
      ? "failed"
      : totals.needsReview > 0
        ? "needs-review"
        : "pass";

  return {
    status,
    ...(options.skippedReason ? { skippedReason: options.skippedReason } : {}),
    ...(options.filter ? { filter: options.filter } : {}),
    ...(options.priceSetLabel ? { priceSetLabel: options.priceSetLabel } : {}),
    notes: options.notes ?? [],
    cases,
    totals
  };
}

function createCalculationImpactSummary(input: {
  baseline: RevisionImpactBaseline;
  baselineSnapshot?: GameDataSnapshot;
  candidate: GameDataSnapshot;
  plan?: GameDataGenerationPlan;
  skipCalculationImpact?: boolean;
  impactCaseFilter?: string;
  priceSet?: PriceSet;
  cases?: readonly RepresentativeCalculationImpactCase[];
  acceptedChanges?: Readonly<Record<string, string>>;
}): CalculationImpactSummary {
  const filter = input.impactCaseFilter?.trim() || undefined;
  const selectedCases = selectedCalculationImpactCases(filter, input.cases);

  if (input.skipCalculationImpact) {
    return summarizeCalculationImpactCases([], {
      filter,
      skippedReason: "--skip-calculation-impact",
      notes: ["Calculation-impact suite was skipped by CLI option."]
    });
  }

  if (!selectedCases.length) {
    return summarizeCalculationImpactCases([], {
      filter,
      notes: [`No representative calculation-impact cases matched ${inlineCode(filter ?? "")}.`]
    });
  }

  if (!input.baselineSnapshot) {
    const baselineNote =
      input.baseline.status === "not-found"
        ? `Valid baseline snapshot was not found at ${inlineCode(input.baseline.pathLabel)}.`
        : `Baseline snapshot at ${inlineCode(input.baseline.pathLabel)} did not validate.`;
    return summarizeCalculationImpactCases(
      selectedCases.map((testCase) => failedCalculationImpactCase(testCase, [baselineNote])),
      { filter, notes: [baselineNote] }
    );
  }

  const priceSetResult = input.priceSet
    ? { priceSet: input.priceSet, label: input.priceSet.label }
    : input.plan
      ? readCurrentCalculationPriceSet(input.plan)
      : {
          error: "Calculation-impact price set was not supplied.",
          label: "not supplied"
        };
  if (!priceSetResult.priceSet) {
    const note = priceSetResult.error ?? "Calculation-impact price set is unavailable.";
    return summarizeCalculationImpactCases(
      selectedCases.map((testCase) => failedCalculationImpactCase(testCase, [note])),
      {
        filter,
        priceSetLabel: priceSetResult.label,
        notes: [note]
      }
    );
  }
  const calculationPriceSet =
    input.plan?.parserStatus === "raw-lostcity"
      ? createGeneratedRuntimePriceSet(priceSetResult.priceSet, input.candidate)
      : priceSetResult.priceSet;
  const priceSetLabel =
    input.plan?.parserStatus === "raw-lostcity"
      ? `${priceSetResult.label} + generated item fallbacks`
      : priceSetResult.label;

  return summarizeCalculationImpactCases(
    selectedCases.map((testCase) =>
      calculateImpactCaseResult(
        testCase,
        input.baselineSnapshot!,
        input.candidate,
        calculationPriceSet,
        input.acceptedChanges?.[testCase.id]
      )
    ),
    {
      filter,
      priceSetLabel
    }
  );
}

function normalizeImpactOutlierLimit(value: number | undefined): number {
  if (value === undefined) return DEFAULT_IMPACT_OUTLIER_LIMIT;
  if (!Number.isFinite(value) || !Number.isInteger(value) || value < 0) {
    throw new GameDataGeneratorError(
      "invalid_argument",
      "--impact-outlier-limit must be a non-negative integer"
    );
  }
  return value;
}

function allMonsterIds(
  baseline: GameDataSnapshot | undefined,
  candidate: GameDataSnapshot
): string[] {
  return [
    ...new Set([...Object.keys(baseline?.monsters ?? {}), ...Object.keys(candidate.monsters)])
  ].sort();
}

function monsterNameForScan(
  baseline: GameDataSnapshot | undefined,
  candidate: GameDataSnapshot,
  monsterId: EntityId
): string {
  return candidate.monsters[monsterId]?.name ?? baseline?.monsters[monsterId]?.name ?? monsterId;
}

function allMonsterScanRequiredCase(
  baseline: AllMonsterScanBaseline,
  monsterId: EntityId
): RepresentativeCalculationImpactCase {
  return {
    id: `${baseline.id}:${monsterId}`,
    label: `${baseline.label} ${monsterId}`,
    tags: ["all-monster-scan", baseline.combatStyle],
    input: baseline.inputForMonster(monsterId),
    requiredItems: baseline.requiredItems,
    requiredGear: baseline.requiredGear
  };
}

function evaluateAllMonsterScanSetup(input: {
  baseline: AllMonsterScanBaseline;
  snapshot: GameDataSnapshot;
  monsterId: EntityId;
  priceSet: PriceSet;
  snapshotLabel: "baseline" | "candidate";
}): { result?: FullSimulationResult; warningCount: number | null; notes: string[] } {
  const requiredCase = allMonsterScanRequiredCase(input.baseline, input.monsterId);
  const evaluation = evaluateCalculationImpactCase(
    requiredCase,
    input.snapshot,
    input.priceSet,
    input.snapshotLabel
  );
  return {
    result: evaluation.result,
    warningCount: evaluation.result?.warnings.length ?? null,
    notes: evaluation.notes
  };
}

function thresholdForMetric(metric: CalculationImpactMetricDelta): number {
  return metric.id === "gpPerHour" || metric.id === "gpPerXp" ? 25 : 10;
}

function metricOutlierReason(metric: CalculationImpactMetricDelta): string | null {
  if (metric.percentDelta == null) {
    if (metric.changed && (metric.baseline == null || metric.candidate == null)) {
      return `${metric.label} availability changed`;
    }
    return null;
  }
  const threshold = thresholdForMetric(metric);
  if (Math.abs(metric.percentDelta) <= threshold) return null;
  return `${metric.label} changed ${formatSignedNumber(metric.percentDelta)}% over ${threshold}%`;
}

function createAllMonsterScanFinding(input: {
  baseline: AllMonsterScanBaseline;
  monsterId: EntityId;
  monsterName: string;
  kind: AllMonsterScanFindingKind;
  reasons: string[];
  metrics?: CalculationImpactMetricDelta[];
  baselineWarningCount?: number | null;
  candidateWarningCount?: number | null;
}): AllMonsterScanFinding {
  return {
    baselineId: input.baseline.id,
    baselineLabel: input.baseline.label,
    combatStyle: input.baseline.combatStyle,
    monsterId: input.monsterId,
    monsterName: input.monsterName,
    kind: input.kind,
    reasons: input.reasons,
    metrics: input.metrics ?? [],
    baselineWarningCount: input.baselineWarningCount ?? null,
    candidateWarningCount: input.candidateWarningCount ?? null
  };
}

function compareAllMonsterScanCase(input: {
  baselineSetup: AllMonsterScanBaseline;
  baselineSnapshot: GameDataSnapshot;
  candidate: GameDataSnapshot;
  monsterId: EntityId;
  priceSet: PriceSet;
}): AllMonsterScanFinding | null {
  const monsterName = monsterNameForScan(input.baselineSnapshot, input.candidate, input.monsterId);
  const baselineHasMonster = Boolean(input.baselineSnapshot.monsters[input.monsterId]);
  const candidateHasMonster = Boolean(input.candidate.monsters[input.monsterId]);

  if (!baselineHasMonster && candidateHasMonster) {
    return createAllMonsterScanFinding({
      baseline: input.baselineSetup,
      monsterId: input.monsterId,
      monsterName,
      kind: "monster-added",
      reasons: ["monster entered scan in candidate"]
    });
  }
  if (baselineHasMonster && !candidateHasMonster) {
    return createAllMonsterScanFinding({
      baseline: input.baselineSetup,
      monsterId: input.monsterId,
      monsterName,
      kind: "monster-removed",
      reasons: ["monster left scan in candidate"]
    });
  }

  const baseline = evaluateAllMonsterScanSetup({
    baseline: input.baselineSetup,
    snapshot: input.baselineSnapshot,
    monsterId: input.monsterId,
    priceSet: input.priceSet,
    snapshotLabel: "baseline"
  });
  const candidate = evaluateAllMonsterScanSetup({
    baseline: input.baselineSetup,
    snapshot: input.candidate,
    monsterId: input.monsterId,
    priceSet: input.priceSet,
    snapshotLabel: "candidate"
  });
  const notes = [...baseline.notes, ...candidate.notes];
  if (!baseline.result || !candidate.result) {
    return createAllMonsterScanFinding({
      baseline: input.baselineSetup,
      monsterId: input.monsterId,
      monsterName,
      kind: "failed",
      reasons: notes.length ? notes : ["simulation failed"],
      baselineWarningCount: baseline.warningCount,
      candidateWarningCount: candidate.warningCount
    });
  }

  const metrics = CALCULATION_IMPACT_METRICS.map((metric) =>
    calculationMetricDelta(metric, baseline.result!, candidate.result!)
  );
  const metricReasons = metrics
    .map(metricOutlierReason)
    .filter((reason): reason is string => reason !== null);
  const warningReasons =
    candidate.warningCount != null &&
    baseline.warningCount != null &&
    candidate.warningCount > baseline.warningCount
      ? [`warning count increased from ${baseline.warningCount} to ${candidate.warningCount}`]
      : [];
  const reasons = [...metricReasons, ...warningReasons];
  if (!reasons.length) return null;

  return createAllMonsterScanFinding({
    baseline: input.baselineSetup,
    monsterId: input.monsterId,
    monsterName,
    kind: metricReasons.length ? "threshold-outlier" : "warning-count-increase",
    reasons,
    metrics,
    baselineWarningCount: baseline.warningCount,
    candidateWarningCount: candidate.warningCount
  });
}

function sortAllMonsterScanFindings(findings: AllMonsterScanFinding[]): AllMonsterScanFinding[] {
  return [...findings].sort(
    (left, right) =>
      left.baselineId.localeCompare(right.baselineId) ||
      left.monsterId.localeCompare(right.monsterId) ||
      left.kind.localeCompare(right.kind)
  );
}

function skippedAllMonsterScanSummary(input: {
  reason: string;
  outlierLimit: number;
  baselines: readonly AllMonsterScanBaseline[];
  notes?: string[];
}): AllMonsterScanSummary {
  return {
    status: "skipped",
    skippedReason: input.reason,
    outlierLimit: input.outlierLimit,
    baselines: input.baselines,
    monsterCount: 0,
    evaluationCount: 0,
    totalOutliers: 0,
    outliers: [],
    notes: input.notes ?? []
  };
}

function createAllMonsterScanSummary(input: {
  baseline: RevisionImpactBaseline;
  baselineSnapshot?: GameDataSnapshot;
  candidate: GameDataSnapshot;
  plan?: GameDataGenerationPlan;
  skipCalculationImpact?: boolean;
  impactOutlierLimit?: number;
  priceSet?: PriceSet;
  baselines?: readonly AllMonsterScanBaseline[];
}): AllMonsterScanSummary {
  const outlierLimit = normalizeImpactOutlierLimit(input.impactOutlierLimit);
  const baselines = input.baselines ?? INFORMATIONAL_ALL_MONSTER_SCAN_BASELINES;
  if (input.skipCalculationImpact) {
    return skippedAllMonsterScanSummary({
      reason: "--skip-calculation-impact",
      outlierLimit,
      baselines,
      notes: ["Informational all-monster scan was skipped by CLI option."]
    });
  }
  if (!input.baselineSnapshot) {
    const baselineNote =
      input.baseline.status === "not-found"
        ? `Valid baseline snapshot was not found at ${inlineCode(input.baseline.pathLabel)}.`
        : `Baseline snapshot at ${inlineCode(input.baseline.pathLabel)} did not validate.`;
    return skippedAllMonsterScanSummary({
      reason: "baseline unavailable",
      outlierLimit,
      baselines,
      notes: [baselineNote]
    });
  }

  const priceSetResult = input.priceSet
    ? { priceSet: input.priceSet, label: input.priceSet.label }
    : input.plan
      ? readCurrentCalculationPriceSet(input.plan)
      : {
          error: "Calculation-impact price set was not supplied.",
          label: "not supplied"
        };
  if (!priceSetResult.priceSet) {
    return skippedAllMonsterScanSummary({
      reason: "price set unavailable",
      outlierLimit,
      baselines,
      notes: [priceSetResult.error ?? "Calculation-impact price set is unavailable."]
    });
  }
  const calculationPriceSet =
    input.plan?.parserStatus === "raw-lostcity"
      ? createGeneratedRuntimePriceSet(priceSetResult.priceSet, input.candidate)
      : priceSetResult.priceSet;
  const priceSetLabel =
    input.plan?.parserStatus === "raw-lostcity"
      ? `${priceSetResult.label} + generated item fallbacks`
      : priceSetResult.label;

  const monsterIds = allMonsterIds(input.baselineSnapshot, input.candidate);
  const findings: AllMonsterScanFinding[] = [];
  for (const baselineSetup of baselines) {
    for (const monsterId of monsterIds) {
      const finding = compareAllMonsterScanCase({
        baselineSetup,
        baselineSnapshot: input.baselineSnapshot,
        candidate: input.candidate,
        monsterId,
        priceSet: calculationPriceSet
      });
      if (finding) findings.push(finding);
    }
  }

  const sortedFindings = sortAllMonsterScanFindings(findings);
  return {
    status: sortedFindings.length ? "outliers-found" : "clean",
    priceSetLabel,
    outlierLimit,
    baselines,
    monsterCount: monsterIds.length,
    evaluationCount: monsterIds.length * baselines.length,
    totalOutliers: sortedFindings.length,
    outliers: sortedFindings.slice(0, outlierLimit),
    notes: []
  };
}

function readBaselineSnapshot(plan: GameDataGenerationPlan): {
  baseline: RevisionImpactBaseline;
  snapshot?: GameDataSnapshot;
} {
  const baselinePath =
    plan.parserStatus === "raw-lostcity"
      ? join(plan.repoRoot, RAW_RUNTIME_REFERENCE_PATH)
      : plan.outputs.gameData.absolutePath;
  const pathLabel =
    plan.parserStatus === "raw-lostcity"
      ? RAW_RUNTIME_REFERENCE_PATH
      : plan.outputs.gameData.pathLabel;
  if (!existsSync(baselinePath)) {
    return {
      baseline: {
        status: "not-found",
        pathLabel
      }
    };
  }

  try {
    const parsed = parseJsonWithDuplicateKeyCheck(readFileSync(baselinePath, "utf8"), {
      source: pathLabel
    });
    return {
      baseline: {
        status: "valid",
        pathLabel
      },
      snapshot: parseGameDataSnapshot(parsed)
    };
  } catch {
    return {
      baseline: {
        status: "invalid",
        pathLabel
      }
    };
  }
}

function createRevisionImpactSummary(
  plan: GameDataGenerationPlan,
  gameData: GameDataSnapshot,
  options: Pick<
    CreateGeneratedGameDataOutputOptions,
    "skipCalculationImpact" | "impactCaseFilter" | "impactOutlierLimit" | "priceSet"
  > = {}
): RevisionImpactSummary {
  const baseline = readBaselineSnapshot(plan);
  const rawSourceProfile = plan.parserStatus === "raw-lostcity";
  const calculationImpact = createCalculationImpactSummary({
    baseline: baseline.baseline,
    baselineSnapshot: baseline.snapshot,
    candidate: gameData,
    plan,
    skipCalculationImpact: options.skipCalculationImpact,
    impactCaseFilter: options.impactCaseFilter,
    priceSet: options.priceSet,
    ...(rawSourceProfile
      ? {
          cases: RAW_LOSTCITY_REPRESENTATIVE_CALCULATION_IMPACT_CASES,
          acceptedChanges: RAW_LOSTCITY_ACCEPTED_CALCULATION_CHANGES
        }
      : {})
  });
  const allMonsterScan = createAllMonsterScanSummary({
    baseline: baseline.baseline,
    baselineSnapshot: baseline.snapshot,
    candidate: gameData,
    plan,
    skipCalculationImpact: options.skipCalculationImpact,
    impactOutlierLimit: options.impactOutlierLimit,
    priceSet: options.priceSet,
    ...(rawSourceProfile ? { baselines: RAW_LOSTCITY_ALL_MONSTER_SCAN_BASELINES } : {})
  });

  if (!baseline.snapshot) {
    return {
      baseline: baseline.baseline,
      sections: [],
      calculationImpact,
      allMonsterScan
    };
  }

  const sections: SnapshotDiffSection[] = [
    ...(
      ["items", "monsters", "weapons", "ammo", "spells", "requirements"] as SnapshotSectionKey[]
    ).map((key) => diffRecord(key, baseline.snapshot?.[key], gameData[key])),
    diffRecord("equipment", flattenEquipment(baseline.snapshot), flattenEquipment(gameData)),
    diffRecord("drops", flattenDrops(baseline.snapshot), flattenDrops(gameData))
  ];

  return {
    baseline: baseline.baseline,
    sections,
    calculationImpact,
    allMonsterScan
  };
}

function formatList(values: string[], limit = 8): string {
  if (!values.length) return "none";
  const visible = values.slice(0, limit).map(inlineCode).join(", ");
  const hidden = values.length > limit ? `, +${values.length - limit} more` : "";
  return `${visible}${hidden}`;
}

function totalCount(section: SnapshotDiffSection): number {
  return section.added.length + section.removed.length + section.changed.length;
}

function validationStatusLines(summary: RevisionImpactSummary): string[] {
  const baselineStatus =
    summary.baseline.status === "not-found"
      ? `not found at ${inlineCode(summary.baseline.pathLabel)}; first-run diff baseline is unavailable`
      : summary.baseline.status === "invalid"
        ? `invalid at ${inlineCode(summary.baseline.pathLabel)}; diff skipped`
        : `valid at ${inlineCode(summary.baseline.pathLabel)}`;
  const calculation = summary.calculationImpact;
  const calculationStatus =
    calculation.status === "skipped"
      ? `skipped (${calculation.skippedReason ?? "requested"})`
      : `${calculation.status} (${calculation.totals.pass} pass, ${calculation.totals.needsReview} needs-review, ${calculation.totals.failed} failed)`;
  const scan = summary.allMonsterScan;
  const scanStatus =
    scan.status === "skipped"
      ? `skipped (${scan.skippedReason ?? "requested"})`
      : `${scan.status} (${scan.totalOutliers} outliers, ${scan.outliers.length} shown)`;

  return [
    "- `GameDataSnapshotSchema`: pass",
    "- `game-data.json`: generated and schema-valid",
    "- `source-pin.json`: generated JSON",
    "- `revision-impact/current.md`: generated",
    "- Output hygiene: pass",
    "- Source item id uniqueness and alias-map collision gates: pass",
    `- Diff baseline: ${baselineStatus}`,
    `- Calculation-impact suite: ${calculationStatus}`,
    `- Informational all-monster scan: ${scanStatus}`
  ];
}

function diffSummaryLines(summary: RevisionImpactSummary): string[] {
  if (summary.baseline.status === "not-found") {
    return [
      "No previous `game-data.json` baseline was found at the configured output path.",
      "Added/removed/changed counts are intentionally not inferred for this first-run path."
    ];
  }
  if (summary.baseline.status === "invalid") {
    return [
      "A previous `game-data.json` file exists, but it did not validate with `GameDataSnapshotSchema`.",
      "Added/removed/changed counts are skipped until the baseline is valid."
    ];
  }

  const table = [
    "| Section | Added | Removed | Changed |",
    "| --- | ---: | ---: | ---: |",
    ...summary.sections.map(
      (section) =>
        `| ${section.section} | ${section.added.length} | ${section.removed.length} | ${section.changed.length} |`
    )
  ];
  const details = summary.sections
    .filter((section) => totalCount(section) > 0)
    .flatMap((section) => [
      "",
      `- ${section.section} added: ${formatList(section.added)}`,
      `- ${section.section} removed: ${formatList(section.removed)}`,
      `- ${section.section} changed: ${formatList(section.changed)}`
    ]);

  return [
    ...table,
    ...(details.length ? details : ["", "No schema-level snapshot changes detected."])
  ];
}

function formatNumber(value: number): string {
  if (!Number.isFinite(value) || Math.abs(value) < 1e-9) return "0";
  const decimals = Math.abs(value) >= 1000 ? 2 : 6;
  return value
    .toFixed(decimals)
    .replace(/(\.\d*?)0+$/, "$1")
    .replace(/\.$/, "");
}

function formatSignedNumber(value: number): string {
  const formatted = formatNumber(value);
  if (formatted === "0") return "0";
  return value > 0 ? `+${formatted}` : formatted;
}

function formatMetricDelta(metric: CalculationImpactMetricDelta | undefined): string {
  if (!metric || metric.delta == null) return "n/a";
  const delta = formatSignedNumber(metric.delta);
  if (metric.percentDelta == null) return delta;
  return `${delta} (${formatSignedNumber(metric.percentDelta)}%)`;
}

function calculationImpactCaseMetric(
  testCase: CalculationImpactCaseResult,
  id: CalculationImpactMetricId
): CalculationImpactMetricDelta | undefined {
  return testCase.metrics.find((metric) => metric.id === id);
}

function calculationImpactSummaryLines(summary: CalculationImpactSummary): string[] {
  const acceptedChangedCases = summary.cases.filter(
    (testCase) => testCase.status === "pass" && testCase.metrics.some((metric) => metric.changed)
  ).length;
  const lines = [
    `- Representative suite: ${summary.status}`,
    `- Cases: ${summary.totals.total} run, ${summary.totals.pass} pass, ${summary.totals.needsReview} needs-review, ${summary.totals.failed} failed`,
    `- Case filter: ${summary.filter ? inlineCode(summary.filter) : "none"}`,
    `- Price set: ${summary.priceSetLabel ?? "not loaded"}`,
    "- Metrics: DPS, kills/hr, XP/hr, GP/hr and GP/XP deltas only.",
    acceptedChangedCases
      ? `- Accepted changed cases: ${acceptedChangedCases}; each accepted delta cites its owning decision in the case notes.`
      : "- No changed calculation outputs are accepted as intentional deltas by this report."
  ];

  if (summary.skippedReason) {
    lines.splice(1, 0, `- Skipped by: ${inlineCode(summary.skippedReason)}`);
  }
  for (const note of summary.notes) {
    lines.push(`- Note: ${note}`);
  }
  if (!summary.cases.length) {
    return [...lines, "", "No representative calculation-impact cases were evaluated."];
  }

  return [
    ...lines,
    "",
    "| Case | Tags | Status | DPS Δ | Kills/hr Δ | XP/hr Δ | GP/hr Δ | GP/XP Δ | Notes |",
    "| --- | --- | --- | ---: | ---: | ---: | ---: | ---: | --- |",
    ...summary.cases.map((testCase) => {
      const notes = testCase.notes.length ? testCase.notes.join("; ") : "-";
      return [
        inlineCode(testCase.id),
        testCase.tags.map(inlineCode).join(", "),
        testCase.status,
        formatMetricDelta(calculationImpactCaseMetric(testCase, "dps")),
        formatMetricDelta(calculationImpactCaseMetric(testCase, "killsPerHour")),
        formatMetricDelta(calculationImpactCaseMetric(testCase, "xpPerHour")),
        formatMetricDelta(calculationImpactCaseMetric(testCase, "gpPerHour")),
        formatMetricDelta(calculationImpactCaseMetric(testCase, "gpPerXp")),
        notes
      ]
        .join(" | ")
        .replace(/^/, "| ")
        .replace(/$/, " |");
    })
  ];
}

function allMonsterScanMetric(
  finding: AllMonsterScanFinding,
  id: CalculationImpactMetricId
): CalculationImpactMetricDelta | undefined {
  return finding.metrics.find((metric) => metric.id === id);
}

function formatWarningCounts(finding: AllMonsterScanFinding): string {
  if (finding.baselineWarningCount == null && finding.candidateWarningCount == null) return "n/a";
  return `${finding.baselineWarningCount ?? "n/a"} -> ${finding.candidateWarningCount ?? "n/a"}`;
}

function allMonsterScanSummaryLines(summary: AllMonsterScanSummary): string[] {
  const hiddenOutliers = summary.totalOutliers - summary.outliers.length;
  const lines = [
    `- Informational all-monster scan: ${summary.status}`,
    `- Baselines: ${summary.baselines.map((baseline) => inlineCode(baseline.id)).join(", ")}`,
    `- Monsters scanned: ${summary.monsterCount}`,
    `- Evaluations: ${summary.evaluationCount}`,
    `- Outliers: ${summary.totalOutliers} found, ${summary.outliers.length} shown`,
    `- Outlier limit: ${summary.outlierLimit}`,
    `- Price set: ${summary.priceSetLabel ?? "not loaded"}`,
    "- Thresholds: DPS/kills/hr/XP/hr over 10%; GP/hr/GP/XP over 25%.",
    "- This scan is informational and does not change representative merge-blocking status."
  ];

  if (summary.skippedReason) {
    lines.splice(1, 0, `- Skipped by: ${inlineCode(summary.skippedReason)}`);
  }
  for (const note of summary.notes) {
    lines.push(`- Note: ${note}`);
  }
  if (summary.status === "skipped") {
    return [...lines, "", "No informational all-monster scan rows were evaluated."];
  }
  if (!summary.outliers.length) {
    return [...lines, "", "No informational all-monster scan outliers found."];
  }

  return [
    ...lines,
    ...(hiddenOutliers > 0 ? [`- Hidden by limit: ${hiddenOutliers}`] : []),
    "",
    "| Baseline | Monster | Kind | Reasons | DPS Δ | Kills/hr Δ | XP/hr Δ | GP/hr Δ | GP/XP Δ | Warnings |",
    "| --- | --- | --- | --- | ---: | ---: | ---: | ---: | ---: | ---: |",
    ...summary.outliers.map((finding) => {
      const monster = `${inlineCode(finding.monsterId)} / ${finding.monsterName}`;
      return [
        `${finding.baselineLabel} (${finding.combatStyle})`,
        monster,
        finding.kind,
        finding.reasons.join("; "),
        formatMetricDelta(allMonsterScanMetric(finding, "dps")),
        formatMetricDelta(allMonsterScanMetric(finding, "killsPerHour")),
        formatMetricDelta(allMonsterScanMetric(finding, "xpPerHour")),
        formatMetricDelta(allMonsterScanMetric(finding, "gpPerHour")),
        formatMetricDelta(allMonsterScanMetric(finding, "gpPerXp")),
        formatWarningCounts(finding)
      ]
        .join(" | ")
        .replace(/^/, "| ")
        .replace(/$/, " |");
    })
  ];
}

export function createCalculationImpactEvidence(input: {
  baseline: GameDataSnapshot;
  candidate: GameDataSnapshot;
  priceSet: PriceSet;
  baselineLabel?: string;
  impactCaseFilter?: string;
  impactOutlierLimit?: number;
  representativeCases?: readonly RepresentativeCalculationImpactCase[];
  allMonsterBaselines?: readonly AllMonsterScanBaseline[];
}): CalculationImpactEvidence {
  const baseline: RevisionImpactBaseline = {
    status: "valid",
    pathLabel: input.baselineLabel ?? input.baseline.label
  };
  return {
    representative: createCalculationImpactSummary({
      baseline,
      baselineSnapshot: input.baseline,
      candidate: input.candidate,
      impactCaseFilter: input.impactCaseFilter,
      priceSet: input.priceSet,
      cases: input.representativeCases
    }),
    allMonsterScan: createAllMonsterScanSummary({
      baseline,
      baselineSnapshot: input.baseline,
      candidate: input.candidate,
      impactOutlierLimit: input.impactOutlierLimit,
      priceSet: input.priceSet,
      baselines: input.allMonsterBaselines
    })
  };
}

export function formatCalculationImpactEvidenceMarkdown(
  evidence: CalculationImpactEvidence
): string {
  return [
    "## Representative Calculation Impact",
    "",
    ...calculationImpactSummaryLines(evidence.representative),
    "",
    "## Informational All-monster Scan",
    "",
    ...allMonsterScanSummaryLines(evidence.allMonsterScan)
  ].join("\n");
}

function createRevisionImpactReport(
  outputs: Omit<GeneratedGameDataOutputs, "revisionImpactText" | "changedFiles">,
  options: Pick<
    CreateGeneratedGameDataOutputOptions,
    "skipCalculationImpact" | "impactCaseFilter" | "impactOutlierLimit" | "priceSet"
  > = {}
): string {
  const summary = createRevisionImpactSummary(outputs.plan, outputs.gameData, options);
  const sourceRef = [
    outputs.sourcePin.source.name,
    outputs.sourcePin.source.revision,
    outputs.sourcePin.source.commit
  ]
    .filter(Boolean)
    .join(" / ");
  const reportStatus =
    outputs.plan.parserStatus === "raw-lostcity"
      ? "raw LostCity source report"
      : outputs.plan.parserStatus === "source-backed-slice"
        ? "source-backed slice report"
        : "foundation report";
  const currentScopeLines =
    outputs.plan.parserStatus === "raw-lostcity"
      ? [
          "- Runtime monster combat fields and reviewed core loot are parsed directly from pinned LostCity NPC config and RuneScript handlers.",
          "- Runtime item, weapon, ammo, spell and equipment calculation fields are parsed directly from pinned LostCity object, param and dbrow configs.",
          "- Simulator-only synthetic identities remain explicitly app-owned; quest-gated drops, clue tertiaries and generated requirement skill mapping remain outside the raw candidate.",
          "- The root browser runtime consumes this committed source-backed generated snapshot; the legacy-derived static bridge remains reference and rollback evidence.",
          "- Source object costs provide item/alch fallbacks; scheduled PriceSet values remain outside this generator and take precedence in the staged generated runtime adapter."
        ]
      : [
          "- Runtime monster ids and simulator-consumed combat stats are covered by normalized source-backed monster slice rows; most added runtime monster rows intentionally omit loot/drop data.",
          "- Runtime item, weapon, ammo, spell and equipment ids plus simulator-consumed fields are covered by normalized source-backed slice rows.",
          "- Runtime item rows carry embedded price/alch fallbacks where the reference catalog defines them; scheduled PriceSet values remain outside this generator and take precedence in the staged generated runtime adapter.",
          "- Drops and item requirements are parsed from normalized source-backed slice files when those rows are present.",
          "- Normalized slice contract tests continue to use fixture-owned representative cases."
        ];

  return [
    "# Current Game Revision Impact",
    "",
    `Status: ${reportStatus}.`,
    "",
    "## Source",
    "",
    `- Source ref: ${sourceRef}`,
    `- Source path: ${inlineCode(outputs.sourcePin.source.path)}`,
    `- Generated at: ${outputs.sourcePin.generatedAt}`,
    `- Generator version: ${outputs.sourcePin.generator.version}`,
    `- Generator command: ${inlineCode(outputs.sourcePin.generator.command)}`,
    "",
    "## Runtime Status",
    "",
    ...(outputs.plan.parserStatus === "raw-lostcity"
      ? [
          "- Runtime bootstrap: source-backed generated snapshot.",
          "- The Vite app loads committed `src/data/generated/game-data.json` with scheduled static prices and generated item fallbacks.",
          "- The legacy-derived static bridge remains regression/reference evidence and is not the root runtime."
        ]
      : [
          "- Runtime bootstrap: source-backed generated snapshot.",
          "- The normalized fixture output is generator contract evidence and is not the root runtime.",
          "- This report does not accept fixture values as runtime truth."
        ]),
    "",
    "## Validation Status",
    "",
    ...validationStatusLines(summary),
    "",
    "## Snapshot Diff Summary",
    "",
    ...diffSummaryLines(summary),
    "",
    "## Calculation Impact",
    "",
    ...calculationImpactSummaryLines(summary.calculationImpact),
    "",
    "### Informational All-Monster Scan",
    "",
    ...allMonsterScanSummaryLines(summary.allMonsterScan),
    "",
    "## Current Scope",
    "",
    ...currentScopeLines,
    "- The committed calculation-impact report and the focused direct-source impact commands remain separate evidence views over the same normalized domain contract.",
    "- Generated item requirements are consumed by Planner/setup checks and gear quick action reason copy when the runtime snapshot supplies them; the active raw snapshot has no authoritative requirement map, so those consumers use the D-051 manual fallback.",
    "- NPC-size, dragon halberd behavior and final special-case source truth are not decided here.",
    "- Market prices and market price history are outside this game-data snapshot workflow.",
    "- Historical generated snapshot archives are intentionally not committed.",
    "",
    "## Open Questions",
    "",
    "- Which authoritative source semantics should map object level requirements into attack, defence, ranged and magic requirement skills without relying on manual classification?",
    "- When can the transitional legacy-derived runtime identity reference be replaced by an app-owned generated catalog manifest?",
    ""
  ].join("\n");
}

function provenanceForPlan(
  plan: GameDataGenerationPlan,
  generatedAt: string,
  manifest: FoundationSourceManifest
): DataProvenance {
  const sourceRef = [
    manifest.source?.name ?? "LostCityRS/Content",
    manifest.source?.revision ?? readGitCommit(plan.sourceDir) ?? "unresolved-revision"
  ].join(" ");

  return {
    source:
      plan.parserStatus === "source-backed-slice" || plan.parserStatus === "raw-lostcity"
        ? "generated"
        : "manual",
    sourceRef,
    verifiedAt: generatedAt,
    notes:
      plan.parserStatus === "raw-lostcity"
        ? "Generated directly from pinned LostCity config and RuneScript sources for the root browser runtime; the legacy-derived static bridge remains regression/reference evidence."
        : plan.parserStatus === "source-backed-slice"
          ? "Normalized source-backed fixture output for generator contract tests; the root runtime remains the separately committed raw source-backed snapshot."
          : "Foundation generated snapshot. This output is schema-valid and normalized, but LostCityRS/Content file parsing and authoritative field extraction are not implemented yet."
  };
}

export function createGeneratedGameDataOutputs(
  options: CreateGeneratedGameDataOutputOptions = {}
): GeneratedGameDataOutputs {
  const plan = createGameDataGenerationPlan(options);
  const generatedAt = isoTimestamp(options.generatedAt);
  const manifest = readManifest(plan.sourceDir);
  const sourceCommit = manifest.source?.commit ?? readGitCommit(plan.sourceDir);
  const sourceRevision = manifest.source?.revision ?? sourceCommit ?? "unresolved-revision";
  const provenance = provenanceForPlan(plan, generatedAt, manifest);
  const baseGameData = manifest.snapshot
    ? parseGameDataSnapshot({
        ...manifest.snapshot,
        provenance
      })
    : createEmptyFoundationSnapshot(provenance);
  const gameData =
    plan.parserStatus === "raw-lostcity"
      ? createRawLostCityGameData({
          sourceDir: plan.sourceDirLabel,
          repoRoot: plan.repoRoot,
          reference: readRawRuntimeReference(plan, options.rawReference),
          sourceRevision,
          generatedAt
        })
      : plan.parserStatus === "source-backed-slice"
        ? parseGameDataSnapshot({
            ...baseGameData,
            ...parseSourceBackedSlice(plan.sourceDir),
            provenance
          })
        : baseGameData;

  const sourcePin: GeneratedGameDataSourcePin = {
    schemaVersion: 1,
    source: {
      name: manifest.source?.name ?? "LostCityRS/Content",
      path: plan.sourceDirLabel,
      ...(manifest.source?.revision ? { revision: manifest.source.revision } : {}),
      ...(sourceCommit ? { commit: sourceCommit } : {})
    },
    generatedAt,
    generator: {
      name: "index-sim-data-generator",
      version: GAME_DATA_GENERATOR_VERSION,
      command:
        options.command ??
        commandForPlan(plan, generatedAt, {
          skipCalculationImpact: options.skipCalculationImpact,
          impactCaseFilter: options.impactCaseFilter,
          impactOutlierLimit: options.impactOutlierLimit
        })
    },
    outputs: {
      sourcePin: plan.outputs.sourcePin.pathLabel,
      gameData: plan.outputs.gameData.pathLabel,
      revisionImpact: plan.outputs.revisionImpact.pathLabel
    },
    scope: {
      status:
        plan.parserStatus === "raw-lostcity"
          ? "source-backed-raw"
          : plan.parserStatus === "source-backed-slice"
            ? "source-backed-slice"
            : "foundation",
      parser: plan.parserStatus,
      runtimeBootstrap:
        plan.parserStatus === "raw-lostcity"
          ? "source-backed-generated-snapshot"
          : "source-backed-generated-snapshot",
      notes: [
        plan.parserStatus === "raw-lostcity"
          ? "Generated output is the committed root runtime game-data artifact."
          : "Generated output is committed as a parser contract-test artifact only.",
        ...(plan.parserStatus === "raw-lostcity"
          ? [
              "Runtime loads this committed source-backed generated snapshot with scheduled static prices and generated item fallbacks."
            ]
          : [
              "Runtime loads the committed source-backed raw generated snapshot; normalized source-slice output remains contract-test evidence."
            ]),
        ...(plan.parserStatus === "raw-lostcity"
          ? [
              "Runtime monster combat/core-loot, item, weapon, ammo, spell and equipment fields are parsed directly from pinned LostCity config and RuneScript sources.",
              "Simulator-only synthetic identities remain app-owned, and requirement skill classification remains outside the raw candidate.",
              `Expected runtime identities are checked against ${RAW_RUNTIME_REFERENCE_PATH} as a regression/reference baseline.`
            ]
          : [
              `Runtime monster combat stats, items, weapons, ammo, spells and equipment plus current drops and item requirements come from ${SOURCE_BACKED_SLICE_DIR}/ when parser is source-backed-slice.`,
              "Combat-stat-only monster rows intentionally do not claim loot/drop coverage.",
              "Runtime catalog rows are normalized migration slices, not accepted raw upstream field authority."
            ]),
        "Raw upstream file bodies, market price history and historical game-data snapshots are intentionally excluded."
      ]
    }
  };

  const gameDataText = stableJson(GameDataSnapshotSchema.parse(gameData));
  const sourcePinText = stableJson(sourcePin);

  try {
    parseGameDataSnapshot(JSON.parse(gameDataText) as unknown);
  } catch {
    throw new GameDataGeneratorError(
      "output_validation_failed",
      "Generated game-data.json failed GameDataSnapshotSchema validation."
    );
  }

  const baseOutputs = {
    plan,
    sourcePin,
    gameData,
    sourcePinText,
    gameDataText
  };
  const revisionImpactText = createRevisionImpactReport(baseOutputs, {
    skipCalculationImpact: options.skipCalculationImpact,
    impactCaseFilter: options.impactCaseFilter,
    impactOutlierLimit: options.impactOutlierLimit,
    priceSet: options.priceSet
  });
  assertGeneratedDataOutputHygiene({
    sourcePinText,
    gameDataText,
    revisionImpactText
  });

  return {
    ...baseOutputs,
    revisionImpactText,
    changedFiles: []
  };
}

function writeIfChanged(filePath: string, text: string, dryRun: boolean): boolean {
  const previous = (() => {
    try {
      return readFileSync(filePath, "utf8");
    } catch {
      return null;
    }
  })();
  if (previous === text) return false;
  if (!dryRun) {
    mkdirSync(dirname(filePath), { recursive: true });
    writeFileSync(filePath, text);
  }
  return true;
}

export function writeGeneratedGameDataOutputs(
  options: WriteGeneratedGameDataOutputOptions = {}
): GeneratedGameDataOutputs {
  const outputs = createGeneratedGameDataOutputs(options);
  const dryRun = options.dryRun ?? false;
  const changedFiles = [
    writeIfChanged(outputs.plan.outputs.sourcePin.absolutePath, outputs.sourcePinText, dryRun)
      ? outputs.plan.outputs.sourcePin.pathLabel
      : null,
    writeIfChanged(outputs.plan.outputs.gameData.absolutePath, outputs.gameDataText, dryRun)
      ? outputs.plan.outputs.gameData.pathLabel
      : null,
    writeIfChanged(
      outputs.plan.outputs.revisionImpact.absolutePath,
      outputs.revisionImpactText,
      dryRun
    )
      ? outputs.plan.outputs.revisionImpact.pathLabel
      : null
  ].filter((fileName): fileName is string => fileName !== null);

  return {
    ...outputs,
    changedFiles
  };
}
