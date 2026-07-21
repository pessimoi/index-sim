import { z } from "zod";
import {
  HISCORES_LAST_PLAYER_STORAGE_VERSION,
  LastHiscoresPlayerStateSchema
} from "@/adapters/hiscores";
import { DUEL_SNAPSHOTS_VERSION, DuelSnapshotsStateSchema } from "../state/duel-snapshots";
import { HIDDEN_GEAR_TIERS_VERSION, HiddenGearTiersStateSchema } from "../state/hidden-gear-tiers";
import { LOOT_PREFS_VERSION, LootPrefsStateSchema } from "../state/loot-prefs";
import { LOOT_SETTINGS_VERSION, LootSettingsByMonsterSchema } from "../state/loot-settings";
import {
  MANUAL_PRICE_OVERRIDES_VERSION,
  ManualPriceOverridesStateSchema
} from "../state/manual-price-overrides";
import { PLANNER_UI_VERSION, PlannerUiStateSchema } from "../state/planner";
import { PRICE_HISTORY_VERSION, BrowserPriceHistoryStateSchema } from "../state/price-history";
import {
  SELECTED_PRICE_SET_VERSION,
  SelectedPriceSetStateSchema
} from "../state/selected-price-set";
import { REWRITE_SETUP_VERSION, SavedSetupSchema } from "../state/ui-state";
import type { WorkspaceLiveState } from "../state/workspace-backup";
import { CROSS_TAB_AREA_REGISTRY, type CrossTabAreaId } from "./cross-tab-conflicts";
import type { LocalStateBatchOperation } from "./local-state-batch";

function persistedRaw<T>(version: number, schema: z.ZodType<T>, value: unknown, now: Date): string {
  return JSON.stringify({
    version,
    savedAt: now.toISOString(),
    data: schema.parse(value)
  });
}

export function createCrossTabKeepOperation(
  id: CrossTabAreaId,
  liveState: WorkspaceLiveState,
  now: Date
): LocalStateBatchOperation<CrossTabAreaId> {
  const key = CROSS_TAB_AREA_REGISTRY[id].key;
  const value = liveState[id];
  const clear =
    (id === "selected-price-set" && value === null) ||
    (id === "hiscores-last-player" && value === null) ||
    (id === "manual-price-overrides" &&
      Object.keys(ManualPriceOverridesStateSchema.parse(value).items).length === 0);
  if (clear) return { id, key, intent: "clear", targetRaw: null };

  let targetRaw: string;
  switch (id) {
    case "rewrite-setup":
      targetRaw = persistedRaw(REWRITE_SETUP_VERSION, SavedSetupSchema, value, now);
      break;
    case "planner-ui":
      targetRaw = persistedRaw(PLANNER_UI_VERSION, PlannerUiStateSchema, value, now);
      break;
    case "loot-prefs":
      targetRaw = persistedRaw(LOOT_PREFS_VERSION, LootPrefsStateSchema, value, now);
      break;
    case "loot-settings":
      targetRaw = persistedRaw(LOOT_SETTINGS_VERSION, LootSettingsByMonsterSchema, value, now);
      break;
    case "hidden-gear-tiers":
      targetRaw = persistedRaw(HIDDEN_GEAR_TIERS_VERSION, HiddenGearTiersStateSchema, value, now);
      break;
    case "duel-snapshots":
      targetRaw = persistedRaw(DUEL_SNAPSHOTS_VERSION, DuelSnapshotsStateSchema, value, now);
      break;
    case "price-history":
      targetRaw = persistedRaw(PRICE_HISTORY_VERSION, BrowserPriceHistoryStateSchema, value, now);
      break;
    case "selected-price-set":
      targetRaw = persistedRaw(
        SELECTED_PRICE_SET_VERSION,
        SelectedPriceSetStateSchema,
        { priceSet: value, selectedAt: now.toISOString() },
        now
      );
      break;
    case "manual-price-overrides":
      targetRaw = persistedRaw(
        MANUAL_PRICE_OVERRIDES_VERSION,
        ManualPriceOverridesStateSchema,
        value,
        now
      );
      break;
    case "hiscores-last-player":
      targetRaw = persistedRaw(
        HISCORES_LAST_PLAYER_STORAGE_VERSION,
        LastHiscoresPlayerStateSchema,
        value,
        now
      );
      break;
  }
  return { id, key, intent: "write", targetRaw };
}
