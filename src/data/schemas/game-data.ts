import { z } from "zod";
import {
  type GameDataRevisionContext,
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

const GameDataSourceNameSchema = z.string().trim().min(1).max(120);
const GameDataSourceCommitSchema = z.string().regex(/^[0-9a-f]{7,64}$/);
const GeneratedAtSchema = z.iso.datetime({ offset: true }).max(64);

export const GameDataRevisionContextSchema: z.ZodType<GameDataRevisionContext> = z
  .object({
    gameRevision: z.number().int().min(1).max(9_999),
    sourceName: GameDataSourceNameSchema,
    sourceCommit: GameDataSourceCommitSchema.optional(),
    generatedAt: GeneratedAtSchema
  })
  .strict();

export const GameDataSourcePinRevisionSchema = z
  .object({
    source: z
      .object({
        name: GameDataSourceNameSchema,
        revision: z.string().regex(/^[1-9][0-9]{0,3}$/),
        commit: GameDataSourceCommitSchema.optional()
      })
      .passthrough(),
    generatedAt: GeneratedAtSchema
  })
  .passthrough();

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

const DropEligibilitySchema = z.discriminatedUnion("kind", [
  z
    .object({
      kind: z.literal("quest"),
      policyId: EntityIdSchema,
      description: z.string().min(1).max(240)
    })
    .strict(),
  z
    .object({
      kind: z.literal("clue"),
      tier: z.enum(["easy", "medium", "hard"]),
      membersOnly: z.literal(true),
      requiresNoClue: z.literal(true)
    })
    .strict()
]);

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
    eligibility: DropEligibilitySchema.optional(),
    provenance: DataProvenanceSchema.optional(),
    notes: z.string().min(1).optional(),
    _expand: z.array(DropExpansionEntrySchema).optional()
  })
  .passthrough();

export const DropEntrySchema = z.union([DropDefinitionSchema, z.array(DropDefinitionSchema)]);

const IncomingAttackFormulaInputsSchema = z.discriminatedUnion("kind", [
  z
    .object({
      kind: z.literal("standard"),
      level: z.number().int().min(0).max(1_000_000),
      bonus: z.number().int().min(-64).max(1_000_000)
    })
    .strict(),
  z
    .object({
      kind: z.literal("source-value"),
      value: z.number().int().min(0).max(1_000_000)
    })
    .strict()
]);

const IncomingAttackAccuracySchema = z.discriminatedUnion("kind", [
  z
    .object({
      kind: z.literal("standard"),
      level: z.number().int().min(0).max(1_000_000),
      bonus: z.number().int().min(-64).max(1_000_000)
    })
    .strict(),
  z.object({ kind: z.literal("always") }).strict(),
  z.object({ kind: z.literal("mean-only") }).strict()
]);

const IncomingAttackSelectionSchema = z.discriminatedUnion("kind", [
  z.object({ kind: z.literal("always") }).strict(),
  z
    .object({
      kind: z.literal("weighted"),
      weight: z.number().finite().positive().max(1_000_000)
    })
    .strict(),
  z
    .object({
      kind: z.literal("contextual"),
      reason: z.enum([
        "selection-policy-required",
        "non-damaging-spell-selection",
        "separate-overlay",
        "unsupported-source-path"
      ])
    })
    .strict()
]);

export const IncomingAttackProfileSchema = z
  .object({
    id: EntityIdSchema,
    attackType: z.enum(["melee", "ranged", "magic"]),
    attackSpeedTicks: z.number().int().positive().max(1_000_000),
    maxHit: z.number().int().min(0).max(1_000_000),
    formulaId: z.enum([
      "standard-melee-v1",
      "standard-ranged-v1",
      "spell-row-v1",
      "forced-max-hit-v1",
      "scripted-fixed-v1"
    ]),
    formulaInputs: IncomingAttackFormulaInputsSchema,
    accuracy: IncomingAttackAccuracySchema,
    selection: IncomingAttackSelectionSchema,
    coverage: z.enum(["exact", "partial", "fallback"]),
    provenance: DataProvenanceSchema
  })
  .strict();

export const MonsterDefinitionSchema = z
  .object({
    id: EntityIdSchema,
    name: z.string().min(1),
    level: NumericSchema.optional(),
    size: z.number().int().positive().optional(),
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
    incomingAttacks: z.array(IncomingAttackProfileSchema).max(32).optional(),
    incomingAttackCoverage: z.enum(["exact", "partial", "fallback"]).optional(),
    loot: z.array(DropEntrySchema).optional(),
    provenance: DataProvenanceSchema.optional()
  })
  .passthrough()
  .superRefine((monster, ctx) => {
    if (monster.incomingAttacks === undefined && monster.incomingAttackCoverage === undefined) {
      return;
    }
    if (monster.incomingAttackCoverage === undefined) {
      ctx.addIssue({
        code: "custom",
        path: ["incomingAttackCoverage"],
        message: "incoming attack profiles require an explicit coverage classification"
      });
      return;
    }
    if (!monster.incomingAttacks?.length) {
      ctx.addIssue({
        code: "custom",
        path: ["incomingAttacks"],
        message: "classified incoming attacks require at least one profile"
      });
      return;
    }
    const ids = new Set<string>();
    for (const [index, profile] of monster.incomingAttacks.entries()) {
      if (ids.has(profile.id)) {
        ctx.addIssue({
          code: "custom",
          path: ["incomingAttacks", index, "id"],
          message: "incoming attack profile ids must be unique within a monster"
        });
      }
      ids.add(profile.id);
      if (profile.coverage !== monster.incomingAttackCoverage) {
        ctx.addIssue({
          code: "custom",
          path: ["incomingAttacks", index, "coverage"],
          message: "profile coverage must match the monster incoming attack coverage"
        });
      }
      if (monster.incomingAttackCoverage === "exact" && profile.selection.kind === "contextual") {
        ctx.addIssue({
          code: "custom",
          path: ["incomingAttacks", index, "selection"],
          message: "an exact incoming attack profile cannot use contextual selection"
        });
      }
    }
  });

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
    revisionContext: GameDataRevisionContextSchema.optional(),
    items: z.record(EntityIdSchema, ItemDefinitionSchema),
    monsters: z.record(EntityIdSchema, MonsterDefinitionSchema),
    weapons: z.record(EntityIdSchema, WeaponDefinitionSchema),
    ammo: z.record(EntityIdSchema, AmmoDefinitionSchema),
    spells: z.record(EntityIdSchema, SpellDefinitionSchema),
    equipment: EquipmentRegistrySchema,
    requirements: z.record(EntityIdSchema, ItemRequirementDefinitionSchema).optional(),
    provenance: DataProvenanceSchema.optional()
  })
  .strict()
  .superRefine((snapshot, ctx) => {
    for (const [itemId, item] of Object.entries(snapshot.items)) {
      if (item.id === itemId) continue;
      ctx.addIssue({
        code: "custom",
        path: ["items", itemId, "id"],
        message: "item id must match record key"
      });
    }
    for (const [monsterId, monster] of Object.entries(snapshot.monsters)) {
      if (monster.id === monsterId) continue;
      ctx.addIssue({
        code: "custom",
        path: ["monsters", monsterId, "id"],
        message: "monster id must match record key"
      });
    }
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

export function parseGameDataSnapshot(input: unknown): GameDataSnapshot {
  return GameDataSnapshotSchema.parse(input) as GameDataSnapshot;
}

export function requireGameDataRevisionContext(
  snapshot: GameDataSnapshot
): GameDataRevisionContext {
  if (!snapshot.revisionContext) {
    throw new Error("Generated runtime game data is missing revision context.");
  }
  return snapshot.revisionContext;
}

export function assertGameDataSourcePinAgreement(
  snapshot: GameDataSnapshot,
  sourcePin: unknown
): GameDataRevisionContext {
  const context = requireGameDataRevisionContext(snapshot);
  const pin = GameDataSourcePinRevisionSchema.parse(sourcePin);
  const matches =
    Number(pin.source.revision) === context.gameRevision &&
    pin.source.name === context.sourceName &&
    (pin.source.commit ?? null) === (context.sourceCommit ?? null) &&
    pin.generatedAt === context.generatedAt;
  if (!matches) {
    throw new Error("Generated game-data revision context does not match source-pin.json.");
  }
  return context;
}
