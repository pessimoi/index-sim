import { z } from "zod";
import {
  type GameDataSnapshot,
  ITEM_REQUIREMENT_SKILLS,
  type ItemDefinition,
  type ItemRequirementDefinition,
  type ItemRequirementSkill,
  type PriceSource,
  BONUS_KEYS,
  EQUIPMENT_SLOTS
} from "../../domain/shared";

export const NumericSchema = z.number().finite();
export const NonNegativeNumberSchema = NumericSchema.min(0);
export const ProbabilitySchema = NonNegativeNumberSchema.max(1);
export const EntityIdSchema = z.string().min(1);

export const DataProvenanceSchema = z.object({
  source: z.enum(["generated", "manual", "scraped", "approximation", "hypothetical"]),
  sourceRef: z.string().min(1).optional(),
  verifiedAt: z.string().min(1).optional(),
  notes: z.string().min(1).optional()
});

export const PriceSourceSchema: z.ZodType<PriceSource> = z.enum([
  "bundled",
  "imported",
  "scraped",
  "manual"
]);

export const EquipmentBonusesSchema = z.object(
  Object.fromEntries(BONUS_KEYS.map((key) => [key, NumericSchema])) as Record<
    (typeof BONUS_KEYS)[number],
    typeof NumericSchema
  >
);

const OptionalEquipmentBonusesSchema = z.object(
  Object.fromEntries(BONUS_KEYS.map((key) => [key, NumericSchema.optional()])) as Record<
    (typeof BONUS_KEYS)[number],
    z.ZodOptional<typeof NumericSchema>
  >
);

export const ItemDefinitionSchema: z.ZodType<ItemDefinition> = z.object({
  id: EntityIdSchema,
  name: z.string().min(1),
  price: NonNegativeNumberSchema.optional(),
  alch: NonNegativeNumberSchema.optional(),
  stackable: z.boolean().optional(),
  provenance: DataProvenanceSchema.optional(),
  notes: z.string().min(1).optional()
});

const ItemRequirementLevelSchema = z.number().int().min(1).max(99);

export const ItemRequirementSkillsSchema = z
  .object(
    Object.fromEntries(
      ITEM_REQUIREMENT_SKILLS.map((skill) => [skill, ItemRequirementLevelSchema.optional()])
    ) as Record<ItemRequirementSkill, z.ZodOptional<typeof ItemRequirementLevelSchema>>
  )
  .strict()
  .superRefine((skills, ctx) => {
    if (ITEM_REQUIREMENT_SKILLS.some((skill) => skills[skill] !== undefined)) return;
    ctx.addIssue({
      code: "custom",
      message: "item requirement must include at least one supported skill"
    });
  });

export const ItemRequirementDefinitionSchema: z.ZodType<ItemRequirementDefinition> = z
  .object({
    itemId: EntityIdSchema,
    skills: ItemRequirementSkillsSchema,
    provenance: DataProvenanceSchema.optional(),
    notes: z.string().min(1).optional()
  })
  .strict();

export const DropExpansionEntrySchema = z
  .object({
    name: z.string().min(1),
    key: EntityIdSchema.optional(),
    weight: z.union([NonNegativeNumberSchema, z.string().min(1)]).optional(),
    chance: ProbabilitySchema.optional(),
    qty: NonNegativeNumberSchema.optional(),
    qtyAvg: NonNegativeNumberSchema.optional(),
    price: NonNegativeNumberSchema.optional(),
    tag: z.string().min(1).optional(),
    talisman: z.boolean().optional(),
    mega: z.boolean().optional()
  })
  .passthrough()
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

export const DropDefinitionSchema = z
  .object({
    name: z.string().min(1),
    key: EntityIdSchema.optional(),
    chance: ProbabilitySchema,
    qtyAvg: NonNegativeNumberSchema,
    price: NonNegativeNumberSchema.optional(),
    alchValue: NonNegativeNumberSchema.optional(),
    tag: z.string().min(1).optional(),
    slotFrac: NonNegativeNumberSchema.optional(),
    prayerXp: NonNegativeNumberSchema.optional(),
    provenance: DataProvenanceSchema.optional(),
    notes: z.string().min(1).optional(),
    _expand: z.array(DropExpansionEntrySchema).optional()
  })
  .passthrough();

export const DropEntrySchema = z.union([DropDefinitionSchema, z.array(DropDefinitionSchema)]);

export const MonsterDefinitionSchema = z
  .object({
    id: EntityIdSchema,
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
    loot: z.array(DropEntrySchema).optional(),
    provenance: DataProvenanceSchema.optional()
  })
  .passthrough();

export const WeaponDefinitionSchema = z
  .object({
    name: z.string().min(1),
    type: z.enum(["melee", "ranged", "magic"]),
    wclass: z.string().min(1).optional(),
    sub: z.string().min(1).optional(),
    ammoKey: EntityIdSchema.optional(),
    accBonus: NumericSchema,
    dmgBonus: NumericSchema,
    speed: NonNegativeNumberSchema,
    acc: z
      .object({
        stab: NumericSchema.optional(),
        slash: NumericSchema.optional(),
        crush: NumericSchema.optional()
      })
      .optional(),
    twoHand: z.boolean().optional(),
    poisonSeverity: NonNegativeNumberSchema.optional(),
    provides: EntityIdSchema.optional(),
    alch: NonNegativeNumberSchema.optional()
  })
  .passthrough();

export const AmmoDefinitionSchema = z
  .object({
    name: z.string().min(1),
    rangeBonus: NumericSchema,
    kind: z.string().min(1).optional(),
    fam: z.string().min(1).optional(),
    tier: NonNegativeNumberSchema.optional(),
    barKey: EntityIdSchema.optional(),
    priceKey: EntityIdSchema.optional(),
    alch: NonNegativeNumberSchema.optional(),
    price: NonNegativeNumberSchema.optional()
  })
  .passthrough();

export const SpellDefinitionSchema = z
  .object({
    name: z.string().min(1),
    base: NonNegativeNumberSchema,
    lvl: NonNegativeNumberSchema.optional(),
    baseXp: NonNegativeNumberSchema.optional(),
    god: z.boolean().optional(),
    staff: z.string().min(1).optional(),
    label: z.string().min(1).optional(),
    runes: z.record(EntityIdSchema, NonNegativeNumberSchema).optional()
  })
  .passthrough();

export const EquipmentItemDefinitionSchema = z
  .object({
    name: z.string().min(1),
    alch: NonNegativeNumberSchema.optional(),
    note: z.string().min(1).optional(),
    approx: z.boolean().optional(),
    recoil: z.boolean().optional()
  })
  .merge(OptionalEquipmentBonusesSchema)
  .passthrough();

const EquipmentSlotItemsSchema = z.record(EntityIdSchema, EquipmentItemDefinitionSchema);

export const EquipmentRegistrySchema = z.object(
  Object.fromEntries(EQUIPMENT_SLOTS.map((slot) => [slot, EquipmentSlotItemsSchema])) as Record<
    (typeof EQUIPMENT_SLOTS)[number],
    typeof EquipmentSlotItemsSchema
  >
);

export const GameDataSnapshotSchema = z
  .object({
    id: EntityIdSchema,
    label: z.string().min(1),
    items: z.record(EntityIdSchema, ItemDefinitionSchema),
    monsters: z.record(EntityIdSchema, MonsterDefinitionSchema),
    weapons: z.record(EntityIdSchema, WeaponDefinitionSchema),
    ammo: z.record(EntityIdSchema, AmmoDefinitionSchema),
    spells: z.record(EntityIdSchema, SpellDefinitionSchema),
    equipment: EquipmentRegistrySchema,
    requirements: z.record(EntityIdSchema, ItemRequirementDefinitionSchema).optional(),
    provenance: DataProvenanceSchema.optional()
  })
  .superRefine((snapshot, ctx) => {
    const requirements = snapshot.requirements;
    if (!requirements) return;
    for (const [itemId, requirement] of Object.entries(requirements)) {
      if (requirement.itemId !== itemId) {
        ctx.addIssue({
          code: "custom",
          path: ["requirements", itemId, "itemId"],
          message: "requirement itemId must match record key"
        });
      }
      if (!snapshot.items[itemId]) {
        ctx.addIssue({
          code: "custom",
          path: ["requirements", itemId],
          message: "requirement item must exist in items"
        });
      }
    }
  });

export type ValidatedGameDataSnapshot = z.infer<typeof GameDataSnapshotSchema>;

export function parseGameDataSnapshot(input: unknown): GameDataSnapshot {
  return GameDataSnapshotSchema.parse(input) as GameDataSnapshot;
}
