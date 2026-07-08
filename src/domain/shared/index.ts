export const BONUS_KEYS = [
  "stabAtt",
  "slashAtt",
  "crushAtt",
  "magAtt",
  "rngAtt",
  "stabDef",
  "slashDef",
  "crushDef",
  "magDef",
  "rngDef",
  "str",
  "rngStr",
  "magDmg",
  "prayer"
] as const;

export const EQUIPMENT_SLOTS = [
  "helm",
  "amulet",
  "body",
  "legs",
  "shield",
  "gloves",
  "boots",
  "cape",
  "ring"
] as const;

export type EntityId = string;
export type CombatStyle = "melee" | "ranged" | "magic";
export type AttackType = "stab" | "slash" | "crush";
export type BonusKey = (typeof BONUS_KEYS)[number];
export type EquipmentSlot = (typeof EQUIPMENT_SLOTS)[number];
export type EquipmentBonuses = Record<BonusKey, number>;
export type PriceSource = "bundled" | "imported" | "scraped" | "manual";

export interface DataProvenance {
  source: "generated" | "manual" | "scraped" | "approximation" | "hypothetical";
  sourceRef?: string;
  verifiedAt?: string;
  notes?: string;
}

export interface PlayerLevels {
  attack: number;
  strength: number;
  defence: number;
  ranged: number;
  magic: number;
  prayer: number;
}

export type GearSelection = Partial<Record<EquipmentSlot, EntityId>>;

export interface Loadout {
  weaponId: EntityId;
  ammoId?: EntityId;
  gear: GearSelection;
}

export interface WeaponDefinition {
  name: string;
  type: CombatStyle;
  wclass?: string;
  sub?: "bow" | "thrown" | string;
  ammoKey?: EntityId;
  accBonus: number;
  dmgBonus: number;
  speed: number;
  acc?: Partial<Record<AttackType, number>>;
  twoHand?: boolean;
  poisonSeverity?: number;
  provides?: EntityId;
  alch?: number;
}

export interface AmmoDefinition {
  name: string;
  rangeBonus: number;
  kind?: string;
  priceKey?: EntityId;
  alch?: number;
  price?: number;
}

export interface SpellDefinition {
  name: string;
  base: number;
  lvl?: number;
  baseXp?: number;
  god?: boolean;
  staff?: string;
  label?: string;
  runes?: Record<EntityId, number>;
}

export type EquipmentItemDefinition = {
  name: string;
  alch?: number;
  note?: string;
  approx?: boolean;
  recoil?: boolean;
} & Partial<Record<BonusKey, number>>;

export type EquipmentRegistry = Record<EquipmentSlot, Record<EntityId, EquipmentItemDefinition>>;

export interface ItemDefinition {
  id: EntityId;
  name: string;
  price?: number;
  alch?: number;
  stackable?: boolean;
  provenance?: DataProvenance;
  notes?: string;
}

export interface DropDefinition {
  name: string;
  key?: EntityId;
  chance: number;
  qtyAvg: number;
  price?: number;
  alchValue?: number;
  tag?: string;
  slotFrac?: number;
  prayerXp?: number;
  provenance?: DataProvenance;
  notes?: string;
  _expand?: Array<Record<string, unknown>>;
  [extraField: string]: unknown;
}

export type DropEntry = DropDefinition | DropDefinition[];

export interface MonsterDefinition {
  id: EntityId;
  name: string;
  level?: number;
  hp: number;
  attack?: number;
  strength?: number;
  defLevel?: number;
  attackSpeed?: number;
  attBonus?: number;
  strBonus?: number;
  magicLevel?: number;
  defStab?: number;
  defSlash?: number;
  defCrush?: number;
  defRange?: number;
  defMagic?: number;
  loot?: DropEntry[];
  provenance?: DataProvenance;
}

export interface GameDataSnapshot {
  id: EntityId;
  label: string;
  items: Record<EntityId, ItemDefinition>;
  monsters: Record<EntityId, MonsterDefinition>;
  weapons: Record<EntityId, WeaponDefinition>;
  ammo: Record<EntityId, AmmoDefinition>;
  spells: Record<EntityId, SpellDefinition>;
  equipment: EquipmentRegistry;
  provenance?: DataProvenance;
}

export interface PriceSet {
  id: EntityId;
  label: string;
  source: PriceSource;
  createdAt: string;
  itemPrices: Record<EntityId, number>;
  alchValues: Record<EntityId, number>;
  provenance?: DataProvenance;
}

export type IntegrationSeverity = "info" | "warning" | "error";
export type HiscoresSkill =
  "attack" | "strength" | "defence" | "hitpoints" | "prayer" | "ranged" | "magic";

export interface IntegrationWarning {
  code: string;
  severity: IntegrationSeverity;
  message: string;
  itemId?: EntityId;
  skill?: HiscoresSkill;
}

export interface IntegrationErrorResponse {
  error: {
    code:
      | "bad-request"
      | "not-found"
      | "rate-limited"
      | "upstream-unavailable"
      | "upstream-invalid"
      | "internal-error";
    message: string;
    retryAfterSeconds?: number;
  };
  warnings?: IntegrationWarning[];
}

export interface HiscoresSource {
  id: EntityId;
  label: string;
  url?: string;
}

export interface HiscoresStatusResponse {
  available: boolean;
  source: HiscoresSource;
  limits?: {
    requestsPerMinute?: number;
  };
}

export interface HiscoresLookupRequest {
  player: string;
}

export interface HiscoresSkillValue {
  level: number;
  xp?: number;
  rank?: number;
}

export interface HiscoresResponse {
  player: string;
  normalizedPlayer: string;
  source: HiscoresSource;
  fetchedAt: string;
  skills: Partial<Record<HiscoresSkill, HiscoresSkillValue>>;
  warnings: IntegrationWarning[];
}

export interface MarketSource {
  id: EntityId;
  label: string;
  origin?: string;
}

export interface MarketStatusResponse {
  available: boolean;
  source: MarketSource;
  cache?: {
    enabled: boolean;
    ttlSeconds?: number;
  };
  limits: {
    maxItemsPerRequest: number;
    requestsPerSecond: number;
  };
}

export type MarketSyncScope = "monster" | "all-supported" | "items";

export interface MarketSyncRequest {
  scope: MarketSyncScope;
  monsterId?: EntityId;
  itemIds?: EntityId[];
  includeAlch?: boolean;
}

export interface MarketItemReport {
  itemId: EntityId;
  sourceSlug?: string;
  status: "updated" | "skipped" | "failed";
  price?: number;
  alchValue?: number;
  sampleSize?: number;
  reason?: string;
}

export interface MarketSyncReport {
  requested: number;
  updated: number;
  skipped: number;
  failed: number;
  startedAt: string;
  finishedAt: string;
  source: MarketSource;
  items: MarketItemReport[];
  warnings: IntegrationWarning[];
}

export interface MarketSyncResponse {
  priceSet: PriceSet;
  report: MarketSyncReport;
}

export interface MarketSourceMapping {
  itemId: EntityId;
  sourceSlug: string;
  source: "markets.lostcity.rs";
  tradeable: boolean;
  syncPrice: boolean;
  syncAlch: boolean;
  notes?: string;
}

export interface PrayerSelection {
  keys: readonly EntityId[];
}

export interface BoostSelection {
  keys: readonly EntityId[];
}

export interface SpecialAttackSelection {
  weaponId: EntityId;
  ammoId?: EntityId;
}

export interface ManualCombatOverrides {
  accuracyBonus?: number | null;
  damageBonus?: number | null;
  attackSpeedSec?: number | null;
}

export interface SimulationRequest {
  combatStyle: CombatStyle;
  monsterId: EntityId;
  levels: PlayerLevels;
  loadout: Loadout;
  styleId: EntityId;
  prayers: PrayerSelection;
  boosts: BoostSelection;
  sustained?: boolean;
  repotThreshold?: number | null;
  spellId?: EntityId;
  charge?: boolean;
  specialAttack?: SpecialAttackSelection;
  manualOverrides?: ManualCombatOverrides;
}

export interface SimulationContext {
  gameData: GameDataSnapshot;
  priceSet: PriceSet;
}

export interface SimulationWarning {
  code: string;
  message: string;
  severity: "info" | "warning" | "error";
}

export interface SpecialAttackResult {
  key: EntityId;
  weaponName: string;
  specsPerHour: number;
  expPerSpec: number;
  maxHit: number;
  hits: number;
  hitChance: number;
  dpsBase: number;
  dpsWithSpec: number;
  dpsGainPct: number;
}

export interface PoisonResult {
  severity: number;
  hit: number;
  intervalSec: number;
  dps: number;
  directFraction: number;
}

export interface DbaInfo {
  drainAtt: number;
  drainDef: number;
  drainRng: number;
  drainMag: number;
  totalBoost: number;
}

export interface CombatSimulationResult {
  combatStyle: CombatStyle;
  monsterId: EntityId;
  maxHit: number;
  peakMaxHit: number;
  hitChance: number;
  avgHit: number;
  dps: number;
  effectiveDps: number;
  attackRoll: number;
  defenceRoll: number;
  attackTicks: number;
  attackSpeedSec: number;
  ttkSec: number;
  directDamageFraction: number;
  specialAttack: SpecialAttackResult | null;
  poison: PoisonResult | null;
  dbaInfo: DbaInfo | null;
  warnings: SimulationWarning[];
  debug: {
    effectiveAccuracy: number;
    effectiveDamage: number;
    accuracyBonus: number;
    damageBonus: number;
    defenceField: string;
    styleId: EntityId;
    attackType?: AttackType;
  };
}
