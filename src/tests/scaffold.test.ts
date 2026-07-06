import { describe, expect, it } from "vitest";
import { ToolchainHealthSchema } from "@/data/schemas";

describe("rewrite toolchain scaffold", () => {
  it("validates the scaffold health schema", () => {
    const parsed = ToolchainHealthSchema.parse({
      status: "ready",
      legacyEntrypoint: "index.html"
    });

    expect(parsed.status).toBe("ready");
    expect(parsed.legacyEntrypoint).toBe("index.html");
  });
});
