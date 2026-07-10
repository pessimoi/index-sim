import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import type { HiscoresProvider, HiscoresRateLimiter } from "../server/hiscores-core";
import {
  createCloudflareWorker,
  type CloudflareWorkerEnvironment
} from "../server/cloudflare-worker";
import { DEPLOYMENT_CSP } from "../server/deployment-security";
import type { HiscoresResponse } from "../domain/shared";

const fixture = JSON.parse(
  readFileSync(resolve("src/tests/fixtures/live-integrations/hiscores-api-success.json"), "utf8")
) as HiscoresResponse;

function provider(): HiscoresProvider {
  return {
    status: () => ({
      available: true,
      source: { id: "fixture", label: "Fixture hiscores" }
    }),
    lookup: (request) => ({
      ...fixture,
      player: request.player,
      normalizedPlayer: request.player
    })
  };
}

function assets(response = new Response("asset", { status: 200 })): {
  environment: CloudflareWorkerEnvironment;
  fetch: ReturnType<typeof vi.fn>;
} {
  const fetch = vi.fn(async () => response);
  return { environment: { ASSETS: { fetch } }, fetch };
}

function expectSecurityHeaders(response: Response): void {
  expect(response.headers.get("Content-Security-Policy")).toBe(DEPLOYMENT_CSP);
  expect(response.headers.get("Permissions-Policy")).toBe(
    "camera=(), microphone=(), geolocation=(), payment=()"
  );
  expect(response.headers.get("Referrer-Policy")).toBe("no-referrer");
  expect(response.headers.get("X-Content-Type-Options")).toBe("nosniff");
}

describe("Cloudflare production worker", () => {
  it("routes Hiscores status and lookup through the production provider core", async () => {
    const worker = createCloudflareWorker({ provider: provider() });
    const { environment, fetch } = assets();

    const status = await worker.fetch(
      new Request("https://index-sim.example/api/hiscores/status"),
      environment
    );
    expect(status.status).toBe(200);
    expect(status.headers.get("Cache-Control")).toBe("no-store");
    expect(await status.json()).toMatchObject({ available: true, source: { id: "fixture" } });
    expectSecurityHeaders(status);

    const lookup = await worker.fetch(
      new Request("https://index-sim.example/api/hiscores?player=Fixture%20Player"),
      environment
    );
    expect(lookup.status).toBe(200);
    expect(await lookup.json()).toMatchObject({ player: "Fixture Player" });
    expectSecurityHeaders(lookup);
    expect(fetch).not.toHaveBeenCalled();
  });

  it("uses the bounded Cloudflare client address only as the in-memory rate-limit key", async () => {
    const keys: string[] = [];
    const rateLimiter: HiscoresRateLimiter = {
      requestsPerMinute: 30,
      check(key) {
        keys.push(key);
        return { allowed: true };
      }
    };
    const worker = createCloudflareWorker({ provider: provider(), rateLimiter });
    const { environment } = assets();
    await worker.fetch(
      new Request("https://index-sim.example/api/hiscores?player=Fixture", {
        headers: { "CF-Connecting-IP": "192.0.2.10" }
      }),
      environment
    );
    await worker.fetch(
      new Request("https://index-sim.example/api/hiscores?player=Fixture", {
        headers: { "CF-Connecting-IP": "x".repeat(65) }
      }),
      environment
    );

    expect(keys).toEqual(["192.0.2.10", "same-origin-client"]);
  });

  it("returns a sanitized API 404 before the SPA fallback", async () => {
    const worker = createCloudflareWorker({ provider: provider() });
    const { environment, fetch } = assets(new Response("<html>SPA</html>"));
    for (const path of ["/api", "/api/not-a-route"]) {
      const response = await worker.fetch(
        new Request(`https://index-sim.example${path}`),
        environment
      );
      expect(response.status).toBe(404);
      expect(response.headers.get("Cache-Control")).toBe("no-store");
      expect(response.headers.get("Content-Type")).toContain("application/json");
      expect(await response.text()).not.toContain("SPA");
      expectSecurityHeaders(response);
    }
    expect(fetch).not.toHaveBeenCalled();
  });

  it("delegates non-API requests to static assets and sanitizes binding failures", async () => {
    const worker = createCloudflareWorker({ provider: provider() });
    const { environment } = assets(
      new Response("<html>app</html>", {
        headers: { "Content-Type": "text/html", "Cache-Control": "no-cache" }
      })
    );
    const response = await worker.fetch(new Request("https://index-sim.example/"), environment);
    expect(response.status).toBe(200);
    expect(await response.text()).toBe("<html>app</html>");
    expectSecurityHeaders(response);

    const failure = await worker.fetch(new Request("https://index-sim.example/"), {
      ASSETS: { fetch: async () => Promise.reject(new Error("private binding details")) }
    });
    expect(failure.status).toBe(500);
    expect(await failure.text()).not.toContain("private binding details");
    expectSecurityHeaders(failure);
  });

  it("pins routing, SPA behavior and log collection off in Wrangler configuration", () => {
    const config = JSON.parse(readFileSync(resolve("wrangler.jsonc"), "utf8")) as {
      main: string;
      compatibility_date: string;
      workers_dev: boolean;
      preview_urls: boolean;
      logpush: boolean;
      observability: { enabled: boolean };
      assets: Record<string, unknown>;
    };

    expect(config).toMatchObject({
      main: "src/server/cloudflare-worker.ts",
      compatibility_date: "2026-07-11",
      workers_dev: true,
      preview_urls: true,
      logpush: false,
      observability: { enabled: false },
      assets: {
        directory: "./dist",
        binding: "ASSETS",
        not_found_handling: "single-page-application",
        run_worker_first: ["/api", "/api/*"]
      }
    });
    for (const statefulKey of [
      "vars",
      "kv_namespaces",
      "d1_databases",
      "durable_objects",
      "r2_buckets",
      "queues",
      "tail_consumers"
    ]) {
      expect(config).not.toHaveProperty(statefulKey);
    }
  });
});
