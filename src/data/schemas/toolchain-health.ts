import { z } from "zod";

export const ToolchainHealthSchema = z.object({
  status: z.literal("ready"),
  legacyEntrypoint: z.literal("index.html")
});

export type ToolchainHealth = z.infer<typeof ToolchainHealthSchema>;
