import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";

const INTERACTIVE_MARKET_PATTERNS = [
  /\/api\/market\/(?:status|sync)/,
  /\bfetchMarketStatus\s*\(/,
  /\bsyncMarketPrices\s*\(/,
  /\bapplyMarketSyncResponse\s*\(/,
  /\bkeepMarketSyncFailureContext\s*\(/
] as const;

function sourceFiles(root: string): string[] {
  const files: string[] = [];
  for (const entry of readdirSync(root, { withFileTypes: true })) {
    const filePath = join(root, entry.name);
    if (entry.isDirectory()) files.push(...sourceFiles(filePath));
    if (entry.isFile() && /\.(ts|tsx)$/.test(entry.name)) files.push(filePath);
  }
  return files;
}

describe("market compatibility scaffolding boundary", () => {
  it("keeps interactive market status and sync out of current application callers", () => {
    const compatibilityOwner = join("src", "app", "state", "market-sync.ts");
    const offenders = sourceFiles("src/app")
      .filter((filePath) => filePath !== compatibilityOwner)
      .filter((filePath) => {
        const source = readFileSync(filePath, "utf8");
        return INTERACTIVE_MARKET_PATTERNS.some((pattern) => pattern.test(source));
      });

    expect(offenders).toEqual([]);
  });
});
