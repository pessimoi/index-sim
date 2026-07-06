import { z } from "zod";

export const HIDDEN_GEAR_TIERS_STORAGE_KEY = "index-sim:hidden-gear-tiers";
export const HIDDEN_GEAR_TIERS_VERSION = 1;

export const GEAR_TIER_DEFS = [
  { id: "bronze", label: "Bronze" },
  { id: "iron", label: "Iron" },
  { id: "steel", label: "Steel" },
  { id: "black", label: "Black" },
  { id: "mithril", label: "Mithril" },
  { id: "adamant", label: "Adamant" },
  { id: "green_dhide", label: "Green d-hide" },
  { id: "blue_dhide", label: "Blue d-hide" },
  { id: "red_dhide", label: "Red d-hide" },
  { id: "leather", label: "Leather" },
  { id: "low_bows", label: "Low-level bows", description: "Hide low-level bows below magic shortbow" },
  { id: "mage_1def", label: "1 defence magic" }
] as const;

export type GearTierId = (typeof GEAR_TIER_DEFS)[number]["id"];
export type HiddenGearTiersState = Partial<Record<GearTierId, boolean>>;

export const DEFAULT_HIDDEN_GEAR_TIERS_STATE: HiddenGearTiersState = {};

const HiddenGearTierFlagsSchema = z
  .object({
    bronze: z.boolean().optional(),
    iron: z.boolean().optional(),
    steel: z.boolean().optional(),
    black: z.boolean().optional(),
    mithril: z.boolean().optional(),
    adamant: z.boolean().optional(),
    green_dhide: z.boolean().optional(),
    blue_dhide: z.boolean().optional(),
    red_dhide: z.boolean().optional(),
    leather: z.boolean().optional(),
    low_bows: z.boolean().optional(),
    mage_1def: z.boolean().optional()
  })
  .strict();

export const HiddenGearTiersStateSchema: z.ZodType<HiddenGearTiersState> =
  HiddenGearTierFlagsSchema.transform((value): HiddenGearTiersState => {
    const next: HiddenGearTiersState = {};
    for (const tier of GEAR_TIER_DEFS) {
      if (value[tier.id]) next[tier.id] = true;
    }
    return next;
  });

const MAGE_1DEF_KEYS = new Set(["green_hat", "zamorak_robe_bottom", "wizard_robe_top"]);
const LEATHER_KEYS = new Set([
  "coif",
  "leather_body",
  "hardleather_body",
  "studded_body",
  "leather_chaps",
  "studded_chaps",
  "leather_vambraces"
]);
const LOW_BOW_KEYS = new Set([
  "shortbow",
  "oak_shortbow",
  "willow_shortbow",
  "maple_shortbow",
  "yew_shortbow",
  "yew_longbow"
]);

export function gearTierForItemId(itemId: string | null | undefined): GearTierId | null {
  if (!itemId) return null;
  const key = itemId.toLocaleLowerCase();
  if (LOW_BOW_KEYS.has(key)) return "low_bows";
  if (LEATHER_KEYS.has(key)) return "leather";
  if (MAGE_1DEF_KEYS.has(key)) return "mage_1def";
  if (/dhide|d-hide|vamb/.test(key)) {
    if (key.startsWith("green")) return "green_dhide";
    if (key.startsWith("blue")) return "blue_dhide";
    if (key.startsWith("red")) return "red_dhide";
    return null;
  }
  if (key.startsWith("bronze")) return "bronze";
  if (key.startsWith("iron")) return "iron";
  if (key.startsWith("steel")) return "steel";
  if (key.startsWith("black")) return "black";
  if (key.startsWith("mithril") || key.startsWith("mith_")) return "mithril";
  if (key.startsWith("adamant") || key.startsWith("addy")) return "adamant";
  return null;
}

export function isGearTierHidden(
  itemId: string | null | undefined,
  hiddenTiers: HiddenGearTiersState
): boolean {
  const tier = gearTierForItemId(itemId);
  return !!(tier && hiddenTiers[tier]);
}

export function filterHiddenGearTierOptions<T extends { id: string }>(
  options: readonly T[],
  hiddenTiers: HiddenGearTiersState,
  currentValue?: string | null
): T[] {
  return options.filter(
    (option) =>
      option.id === "none" ||
      option.id === currentValue ||
      !isGearTierHidden(option.id, hiddenTiers)
  );
}

export function setHiddenGearTier(
  state: HiddenGearTiersState,
  tierId: GearTierId,
  hidden: boolean
): HiddenGearTiersState {
  return HiddenGearTiersStateSchema.parse({
    ...state,
    [tierId]: hidden || undefined
  });
}

export function hideAllGearTiers(): HiddenGearTiersState {
  return HiddenGearTiersStateSchema.parse(
    Object.fromEntries(GEAR_TIER_DEFS.map((tier) => [tier.id, true]))
  );
}
