import { z } from "zod";
import { requireGameDataRevisionContext } from "@/data/schemas/game-data";
import type { GameDataSnapshot } from "@/domain/shared";

export const SETUP_TRANSFER_CONTEXT_VERSION = 1;

export interface SetupTransferContextV1 {
  gameDataId: string;
  gameRevision: number;
}

export type SetupTransferContextMatch =
  "exact-snapshot" | "same-revision" | "different-revision" | "unknown";

export interface SetupTransferContextReview {
  match: SetupTransferContextMatch;
  tone: "ready" | "warning";
  message: string;
  current: SetupTransferContextV1;
  source: SetupTransferContextV1 | null;
}

export const SetupTransferContextV1Schema: z.ZodType<SetupTransferContextV1> = z
  .object({
    gameDataId: z
      .string()
      .trim()
      .min(1)
      .max(160)
      .regex(/^[A-Za-z0-9:_-]+$/),
    gameRevision: z.number().int().min(1).max(9_999)
  })
  .strict();

export function createSetupTransferContext(gameData: GameDataSnapshot): SetupTransferContextV1 {
  const revision = requireGameDataRevisionContext(gameData);
  return SetupTransferContextV1Schema.parse({
    gameDataId: gameData.id,
    gameRevision: revision.gameRevision
  });
}

export function compareSetupTransferContext(
  source: SetupTransferContextV1 | null,
  gameData: GameDataSnapshot
): SetupTransferContextReview {
  const current = createSetupTransferContext(gameData);
  const parsedSource = source === null ? null : SetupTransferContextV1Schema.parse(source);
  const match: SetupTransferContextMatch =
    parsedSource === null
      ? "unknown"
      : parsedSource.gameDataId === current.gameDataId &&
          parsedSource.gameRevision === current.gameRevision
        ? "exact-snapshot"
        : parsedSource.gameRevision === current.gameRevision
          ? "same-revision"
          : "different-revision";

  return {
    match,
    tone: match === "exact-snapshot" ? "ready" : "warning",
    message: setupTransferContextMessage(match, current.gameRevision, parsedSource?.gameRevision),
    current,
    source: parsedSource
  };
}

export function compareLegacyGameDataId(
  gameDataId: string,
  gameData: GameDataSnapshot
): SetupTransferContextReview {
  const current = createSetupTransferContext(gameData);
  if (gameDataId === current.gameDataId) {
    return {
      match: "exact-snapshot",
      tone: "ready",
      message: setupTransferContextMessage("exact-snapshot", current.gameRevision),
      current,
      source: null
    };
  }
  return {
    match: "unknown",
    tone: "warning",
    message: setupTransferContextMessage("unknown", current.gameRevision),
    current,
    source: null
  };
}

function setupTransferContextMessage(
  match: SetupTransferContextMatch,
  currentRevision: number,
  sourceRevision?: number
): string {
  if (match === "exact-snapshot") {
    return `Created with this exact Revision ${currentRevision} data snapshot.`;
  }
  if (match === "same-revision") {
    return `Created with another Revision ${currentRevision} snapshot. Available ids are compatible, but results may differ.`;
  }
  if (match === "different-revision") {
    return `Created for Revision ${sourceRevision ?? "unknown"}; this app uses Revision ${currentRevision}. Available ids are compatible, but combat, loot and requirements may differ.`;
  }
  return `This older format does not record a game revision. It will use the current Revision ${currentRevision} data.`;
}
