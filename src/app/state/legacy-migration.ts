import { z } from "zod";
import { LEGACY_STORAGE_KEYS } from "./legacy-storage-migration";

export const LEGACY_MIGRATION_DISMISSED_STORAGE_KEY = "index-sim:legacy-migration-dismissed";
export const LEGACY_MIGRATION_DISMISSED_VERSION = 1;

export const LegacyMigrationDismissedStateSchema = z
  .object({
    dismissedAt: z.string().min(1),
    foundKeys: z.array(z.enum(LEGACY_STORAGE_KEYS)).default([])
  })
  .strict();
