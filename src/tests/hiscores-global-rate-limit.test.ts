import {
  HISCORES_GLOBAL_RATE_LIMIT_OBJECT_NAME,
  HiscoresGlobalRateLimit,
  consumeHiscoresGlobalProviderBudget,
  createCloudflareHiscoresProviderBudgetGate,
  type CloudflareDurableObjectStorage,
  type CloudflareDurableObjectTransaction
} from "../server/hiscores-global-rate-limit";

class MemoryDurableObjectStorage implements CloudflareDurableObjectStorage {
  private readonly values = new Map<string, unknown>();
  private chain: Promise<unknown> = Promise.resolve();

  transaction<T>(
    closure: (transaction: CloudflareDurableObjectTransaction) => Promise<T>
  ): Promise<T> {
    const transaction: CloudflareDurableObjectTransaction = {
      get: async <Value>(key: string) => this.values.get(key) as Value | undefined,
      put: async <Value>(key: string, value: Value) => {
        this.values.set(key, value);
      }
    };
    const result = this.chain.then(() => closure(transaction));
    this.chain = result.then(
      () => undefined,
      () => undefined
    );
    return result;
  }

  seed(key: string, value: unknown): void {
    this.values.set(key, value);
  }
}

describe("Hiscores global provider budget", () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("atomically caps concurrent grants and rolls the persistent window", async () => {
    const storage = new MemoryDurableObjectStorage();
    const decisions = await Promise.all([
      consumeHiscoresGlobalProviderBudget(storage, 2, 1_000),
      consumeHiscoresGlobalProviderBudget(storage, 2, 1_000),
      consumeHiscoresGlobalProviderBudget(storage, 2, 1_000)
    ]);

    expect(decisions).toEqual([
      { allowed: true },
      { allowed: true },
      { allowed: false, retryAfterSeconds: 60 }
    ]);
    expect(await consumeHiscoresGlobalProviderBudget(storage, 2, 60_999)).toEqual({
      allowed: false,
      retryAfterSeconds: 1
    });
    expect(await consumeHiscoresGlobalProviderBudget(storage, 2, 61_000)).toEqual({
      allowed: true
    });
  });

  it("fails closed for corrupt persistent state or a backwards clock", async () => {
    const corruptStorage = new MemoryDurableObjectStorage();
    corruptStorage.seed("hiscores-provider-budget-v1", { version: 1, used: -1 });
    await expect(consumeHiscoresGlobalProviderBudget(corruptStorage, 2, 1_000)).rejects.toThrow(
      "Invalid Hiscores global rate-limit state"
    );

    const storage = new MemoryDurableObjectStorage();
    await consumeHiscoresGlobalProviderBudget(storage, 2, 2_000);
    await expect(consumeHiscoresGlobalProviderBudget(storage, 2, 1_999)).rejects.toThrow(
      "clock moved backwards"
    );
  });

  it("persists aggregate-only state across coordinator instances", async () => {
    const storage = new MemoryDurableObjectStorage();
    vi.spyOn(Date, "now").mockReturnValue(5_000);
    const first = new HiscoresGlobalRateLimit({ storage });
    const second = new HiscoresGlobalRateLimit({ storage });

    const request = () =>
      new Request("https://hiscores-global-rate-limit.internal/check", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ requestsPerMinute: 1 })
      });
    expect(await (await first.fetch(request())).json()).toEqual({ allowed: true });
    expect(await (await second.fetch(request())).json()).toEqual({
      allowed: false,
      retryAfterSeconds: 60
    });

    const invalid = await second.fetch(
      new Request("https://hiscores-global-rate-limit.internal/check", {
        method: "POST",
        body: JSON.stringify({ requestsPerMinute: 1, player: "must-not-be-accepted" })
      })
    );
    expect(invalid.status).toBe(400);
  });

  it("keeps the production gate disabled without calling a binding", async () => {
    const getByName = vi.fn(() => ({
      fetch: vi.fn(async () => Response.json({ allowed: false, retryAfterSeconds: 60 }))
    }));
    await expect(createCloudflareHiscoresProviderBudgetGate({}).check()).resolves.toEqual({
      allowed: true
    });
    await expect(
      createCloudflareHiscoresProviderBudgetGate({
        HISCORES_GLOBAL_RATE_LIMIT_MODE: "off",
        HISCORES_GLOBAL_RATE_LIMIT_REQUESTS_PER_MINUTE: "invalid",
        HISCORES_GLOBAL_RATE_LIMITER: { getByName }
      }).check()
    ).resolves.toEqual({ allowed: true });
    expect(getByName).not.toHaveBeenCalled();
  });

  it("uses one deterministic provider object and validates its decision", async () => {
    const getByName = vi.fn(() => ({
      fetch: vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
        expect(String(input)).toBe("https://hiscores-global-rate-limit.internal/check");
        expect(init?.method).toBe("POST");
        expect(JSON.parse(String(init?.body))).toEqual({ requestsPerMinute: 7 });
        return Response.json({ allowed: false, retryAfterSeconds: 9 });
      })
    }));
    const gate = createCloudflareHiscoresProviderBudgetGate({
      HISCORES_GLOBAL_RATE_LIMIT_MODE: "enforce",
      HISCORES_GLOBAL_RATE_LIMIT_REQUESTS_PER_MINUTE: "7",
      HISCORES_GLOBAL_RATE_LIMITER: { getByName }
    });

    await expect(gate.check()).resolves.toEqual({
      allowed: false,
      retryAfterSeconds: 9
    });
    expect(getByName).toHaveBeenCalledWith(HISCORES_GLOBAL_RATE_LIMIT_OBJECT_NAME);
  });

  it("rejects invalid enforcing configuration and coordinator responses", async () => {
    await expect(
      createCloudflareHiscoresProviderBudgetGate({
        HISCORES_GLOBAL_RATE_LIMIT_MODE: "enforce",
        HISCORES_GLOBAL_RATE_LIMIT_REQUESTS_PER_MINUTE: "30"
      }).check()
    ).rejects.toThrow("Missing Hiscores global rate-limit binding");

    await expect(
      createCloudflareHiscoresProviderBudgetGate({
        HISCORES_GLOBAL_RATE_LIMIT_MODE: "unexpected",
        HISCORES_GLOBAL_RATE_LIMIT_REQUESTS_PER_MINUTE: "30"
      }).check()
    ).rejects.toThrow("Invalid Hiscores global rate-limit mode");

    const invalidResponseGate = createCloudflareHiscoresProviderBudgetGate({
      HISCORES_GLOBAL_RATE_LIMIT_MODE: "enforce",
      HISCORES_GLOBAL_RATE_LIMIT_REQUESTS_PER_MINUTE: "30",
      HISCORES_GLOBAL_RATE_LIMITER: {
        getByName: () => ({ fetch: async () => Response.json({ allowed: false }) })
      }
    });
    await expect(invalidResponseGate.check()).rejects.toThrow(
      "Invalid Hiscores global rate-limit response"
    );
  });
});
