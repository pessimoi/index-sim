import { z } from "zod";
import { createMemoryStorage, loadPersisted } from "../adapters/storage";

const FixtureSchema = z.object({ value: z.string() }).strict();

describe("versioned storage adapter", () => {
  it("distinguishes an absent value from a present empty value", () => {
    const missing = loadPersisted({
      key: "fixture",
      version: 1,
      schema: FixtureSchema,
      storage: createMemoryStorage()
    });
    const empty = loadPersisted({
      key: "fixture",
      version: 1,
      schema: FixtureSchema,
      storage: createMemoryStorage({ fixture: "" })
    });

    expect(missing).toEqual({ status: "missing", value: null });
    expect(empty).toEqual({ status: "invalid", value: null, reason: "invalid_json" });
  });
});
