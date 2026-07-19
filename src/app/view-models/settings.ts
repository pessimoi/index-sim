import {
  GEAR_TIER_DEFS,
  type GearTierId,
  type HiddenGearTiersState
} from "../state/hidden-gear-tiers";
import { requireGameDataRevisionContext } from "../../data/schemas/game-data";
import type { GameDataSnapshot } from "../../domain/shared";

export interface GameRevisionViewModel {
  revisionLabel: string;
  snapshotLabel: string;
  snapshotId: string;
  sourceLabel: string;
  sourceCommit: string | null;
  sourceCommitShort: string | null;
  generatedAt: string;
}

export interface HiddenGearTierPresentation {
  id: GearTierId;
  label: string;
  description: string;
  hidden: boolean;
}

export interface SettingsPaneViewModel {
  gameRevision: GameRevisionViewModel;
  hiddenGearTiers: HiddenGearTierPresentation[];
  hiddenGearTierCount: number;
  hasHiddenGearTiers: boolean;
}

export function createGameRevisionViewModel(gameData: GameDataSnapshot): GameRevisionViewModel {
  const context = requireGameDataRevisionContext(gameData);
  return {
    revisionLabel: `Revision ${context.gameRevision}`,
    snapshotLabel: gameData.label,
    snapshotId: gameData.id,
    sourceLabel: context.sourceName,
    sourceCommit: context.sourceCommit ?? null,
    sourceCommitShort: context.sourceCommit?.slice(0, 12) ?? null,
    generatedAt: context.generatedAt
  };
}

export function createSettingsPaneViewModel(
  hiddenGearTiers: HiddenGearTiersState,
  gameRevision: GameRevisionViewModel
): SettingsPaneViewModel {
  const rows = GEAR_TIER_DEFS.map((tier) => ({
    id: tier.id,
    label: tier.label,
    description: "description" in tier ? tier.description : `Hide ${tier.label.toLowerCase()} gear`,
    hidden: !!hiddenGearTiers[tier.id]
  }));
  const hiddenGearTierCount = rows.filter((tier) => tier.hidden).length;
  return {
    gameRevision,
    hiddenGearTiers: rows,
    hiddenGearTierCount,
    hasHiddenGearTiers: hiddenGearTierCount > 0
  };
}
