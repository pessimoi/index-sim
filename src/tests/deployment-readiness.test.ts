import { mkdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import {
  DEPLOYMENT_CSP,
  DeploymentReadinessError,
  smokePublicDeployment,
  verifyDeploymentArtifact,
  type DeploymentFetchLike
} from "../../scripts/deployment-readiness-core";
import { parseArgs } from "../../scripts/verify-public-deployment";

const TEST_ROOT = resolve(".vite/deployment-readiness-test");
const INDEX_HTML = [
  "<!doctype html>",
  '<html><head><link rel="stylesheet" href="/assets/index-12345678.css"></head>',
  '<body><div id="root"></div><script type="module" src="/assets/index-abcdefgh.js"></script></body></html>'
].join("");

function write(path: string, value: string): void {
  const target = join(TEST_ROOT, path);
  mkdirSync(dirname(target), { recursive: true });
  writeFileSync(target, value);
}

function createArtifact(): void {
  rmSync(TEST_ROOT, { recursive: true, force: true });
  write("index.html", INDEX_HTML);
  write("assets/index-12345678.css", "body { color: black; }");
  write("assets/index-abcdefgh.js", 'document.querySelector("#root");');
  for (const fileName of ["prices.json", "alch.json", "price-history.json"]) {
    write(fileName, readFileSync(resolve(fileName), "utf8"));
  }
}

function securityHeaders(contentType: string, cacheControl: string): Record<string, string> {
  return {
    "Content-Type": contentType,
    "Cache-Control": cacheControl,
    "Content-Security-Policy": DEPLOYMENT_CSP,
    "Referrer-Policy": "no-referrer",
    "X-Content-Type-Options": "nosniff",
    "Permissions-Policy": "camera=(), microphone=(), geolocation=(), payment=()"
  };
}

function responseFor(path: string, overrides: Record<string, Response> = {}): Response {
  if (overrides[path]) return overrides[path];
  if (path === "/") {
    return new Response(INDEX_HTML, {
      status: 200,
      headers: securityHeaders("text/html; charset=utf-8", "no-cache")
    });
  }
  if (path.endsWith(".css")) {
    return new Response("body { color: black; }", {
      status: 200,
      headers: securityHeaders("text/css; charset=utf-8", "public, max-age=31536000, immutable")
    });
  }
  if (path.endsWith(".js")) {
    return new Response('document.querySelector("#root");', {
      status: 200,
      headers: securityHeaders(
        "application/javascript; charset=utf-8",
        "public, max-age=31536000, immutable"
      )
    });
  }
  if (["/prices.json", "/alch.json", "/price-history.json"].includes(path)) {
    return new Response(readFileSync(resolve(path.slice(1)), "utf8"), {
      status: 200,
      headers: securityHeaders("application/json; charset=utf-8", "no-cache")
    });
  }
  return new Response('{"error":"not-found"}', {
    status: 404,
    headers: { "Content-Type": "application/json", "Cache-Control": "no-store" }
  });
}

function createFetch(overrides: Record<string, Response> = {}): DeploymentFetchLike {
  return async (url, init) => {
    expect(init.redirect).toBe("error");
    expect(init.signal).toBeInstanceOf(AbortSignal);
    return responseFor(new URL(url).pathname, overrides);
  };
}

afterEach(() => {
  rmSync(TEST_ROOT, { recursive: true, force: true });
});

describe("deployment readiness", () => {
  it("validates a deterministic root-path build artifact and market contract", () => {
    createArtifact();
    const first = verifyDeploymentArtifact({ outDir: TEST_ROOT });
    const second = verifyDeploymentArtifact({ outDir: TEST_ROOT });

    expect(first).toMatchObject({
      status: "ready",
      outDir: ".vite/deployment-readiness-test",
      fileCount: 6,
      assetCount: 2,
      historySnapshots: expect.any(Number),
      marketScrapedAt: expect.stringMatching(/^\d{4}-/)
    });
    expect(first.sha256).toMatch(/^[a-f0-9]{64}$/);
    expect(second.sha256).toBe(first.sha256);
  });

  it("rejects non-hashed files, source maps and local paths from the artifact", () => {
    for (const [path, content] of [
      ["debug.js.map", "{}"],
      ["assets/debug.js", "console.log('debug')"],
      ["assets/raw-source-12345678.json", "{}"],
      ["assets/debug-12345678.js", "/Users/example/private/source.ts"]
    ]) {
      createArtifact();
      write(path, content);
      expect(() => verifyDeploymentArtifact({ outDir: TEST_ROOT })).toThrow(
        DeploymentReadinessError
      );
    }
  });

  it("sanitizes an unreadable artifact directory", () => {
    try {
      verifyDeploymentArtifact({ outDir: join(TEST_ROOT, "missing") });
      throw new Error("Expected deployment artifact validation to fail");
    } catch (error) {
      expect(error).toMatchObject({
        code: "artifact_invalid",
        message: "Deployment artifact directory cannot be read"
      });
      expect((error as Error).message).not.toContain(process.cwd());
    }
  });

  it("rejects missing asset references and invalid market JSON", () => {
    createArtifact();
    write("index.html", INDEX_HTML.replace("index-abcdefgh.js", "missing-abcdefgh.js"));
    expect(() => verifyDeploymentArtifact({ outDir: TEST_ROOT })).toThrow(
      "Deployment index references a missing asset"
    );

    createArtifact();
    write(
      "index.html",
      INDEX_HTML.replace("</body>", '<script src="//scripts.example/app.js"></script></body>')
    );
    expect(() => verifyDeploymentArtifact({ outDir: TEST_ROOT })).toThrow(
      "Deployment index references an external asset"
    );

    createArtifact();
    write("prices.json", '{"_scraped_at":1,"lobster":1,"lobster":2}');
    expect(() => verifyDeploymentArtifact({ outDir: TEST_ROOT })).toThrow(
      "invalid JSON in prices.json"
    );
  });

  it("validates HTTPS routes, headers, caches, market files and absent Hiscores", async () => {
    const report = await smokePublicDeployment({
      origin: "https://preview.example/",
      hiscoresMode: "absent",
      fetchImpl: createFetch()
    });

    expect(report).toMatchObject({
      status: "passed",
      origin: "https://preview.example",
      assetCount: 2,
      hiscoresMode: "absent",
      hiscoresAvailable: false
    });
  });

  it("validates disabled and enabled Hiscores status without issuing a player lookup", async () => {
    for (const [mode, available] of [
      ["disabled", false],
      ["enabled", true]
    ] as const) {
      const statusResponse = new Response(
        JSON.stringify({
          available,
          source: { id: "lostcity-2004scape", label: "2004Scape Hiscores" }
        }),
        {
          status: 200,
          headers: securityHeaders("application/json; charset=utf-8", "no-store")
        }
      );
      const fetchImpl = createFetch({ "/api/hiscores/status": statusResponse });
      const report = await smokePublicDeployment({
        origin: "https://preview.example/",
        hiscoresMode: mode,
        fetchImpl
      });
      expect(report.hiscoresAvailable).toBe(available);
    }
  });

  it("rejects missing security headers and an API route masked by SPA fallback", async () => {
    const unsafeRoot = new Response(INDEX_HTML, {
      status: 200,
      headers: { "Content-Type": "text/html", "Cache-Control": "no-cache" }
    });
    await expect(
      smokePublicDeployment({
        origin: "https://preview.example/",
        hiscoresMode: "absent",
        fetchImpl: createFetch({ "/": unsafeRoot })
      })
    ).rejects.toMatchObject({ code: "response_invalid" });

    const spaFallback = new Response(INDEX_HTML, {
      status: 200,
      headers: securityHeaders("text/html", "no-store")
    });
    await expect(
      smokePublicDeployment({
        origin: "https://preview.example/",
        hiscoresMode: "absent",
        fetchImpl: createFetch({ "/api/__index_sim_deployment_probe__": spaFallback })
      })
    ).rejects.toThrow("masked by SPA fallback");
  });

  it("rejects extra CSP origins, oversized responses and sanitized network failures", async () => {
    const extraOriginHeaders = securityHeaders("text/html", "no-cache");
    extraOriginHeaders["Content-Security-Policy"] = DEPLOYMENT_CSP.replace(
      "script-src 'self'",
      "script-src 'self' https://scripts.example"
    );
    await expect(
      smokePublicDeployment({
        origin: "https://preview.example/",
        hiscoresMode: "absent",
        fetchImpl: createFetch({
          "/": new Response(INDEX_HTML, { status: 200, headers: extraOriginHeaders })
        })
      })
    ).rejects.toThrow("does not match required CSP directive script-src");

    const oversizedHeaders = securityHeaders("text/html", "no-cache");
    oversizedHeaders["Content-Length"] = "5000001";
    await expect(
      smokePublicDeployment({
        origin: "https://preview.example/",
        hiscoresMode: "absent",
        fetchImpl: createFetch({
          "/": new Response(INDEX_HTML, { status: 200, headers: oversizedHeaders })
        })
      })
    ).rejects.toMatchObject({ code: "response_invalid" });

    await expect(
      smokePublicDeployment({
        origin: "https://preview.example/",
        hiscoresMode: "absent",
        fetchImpl: async () => {
          throw new TypeError("private redirect or network target");
        }
      })
    ).rejects.toMatchObject({
      code: "network_failed",
      message: "Deployment request failed"
    });
  });

  it("aborts a deployment request at the bounded timeout", async () => {
    let signal: AbortSignal | undefined;
    await expect(
      smokePublicDeployment({
        origin: "https://preview.example/",
        hiscoresMode: "absent",
        timeoutMs: 1,
        fetchImpl: async (_url, init) => {
          signal = init.signal;
          return new Promise((_resolve, reject) => {
            init.signal.addEventListener("abort", () => reject(new Error("private timeout")), {
              once: true
            });
          });
        }
      })
    ).rejects.toMatchObject({ code: "network_failed", message: "Deployment request timed out" });
    expect(signal?.aborted).toBe(true);
  });

  it("rejects non-HTTPS, credentialed and path-prefixed deployment origins", async () => {
    for (const origin of [
      "http://preview.example/",
      "https://user:pass@preview.example/",
      "https://preview.example/app/"
    ]) {
      await expect(
        smokePublicDeployment({ origin, hiscoresMode: "absent", fetchImpl: createFetch() })
      ).rejects.toMatchObject({ code: "origin_invalid" });
    }
  });

  it("parses provider-neutral artifact and HTTP CLI options", () => {
    expect(parseArgs(["artifact"])).toEqual({ command: "artifact", outDir: "dist" });
    expect(
      parseArgs(["http", "--origin", "https://preview.example", "--hiscores-mode", "disabled"])
    ).toEqual({
      command: "http",
      origin: "https://preview.example",
      hiscoresMode: "disabled"
    });
  });
});
