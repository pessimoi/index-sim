import { createHash } from "node:crypto";
import { lstatSync, readFileSync, readdirSync } from "node:fs";
import { relative, resolve, sep } from "node:path";
import { gzipSync } from "node:zlib";
import { parseHiscoresStatusResponseJson } from "../src/data/schemas/live-integrations";
import {
  PriceHistorySchema,
  ScheduledPriceProvenanceArtifactSchema,
  createPriceSetFromLegacyRecords,
  stripLegacyPriceMetadata
} from "../src/data/schemas/price-set";
import { parseJsonWithDuplicateKeyCheck } from "../src/data/reliability";
import { DEPLOYMENT_CSP } from "../src/server/deployment-security";

const MARKET_FILES = [
  "prices.json",
  "price-provenance.json",
  "alch.json",
  "price-history.json"
] as const;
const CLOUDFLARE_HEADERS_FILE = "_headers";
const REQUIRED_ROOT_FILES = new Set(["index.html", CLOUDFLARE_HEADERS_FILE, ...MARKET_FILES]);
const HASHED_ASSET_PATTERN =
  /^assets\/[A-Za-z0-9_.-]+-[A-Za-z0-9_-]{8,}\.(?:avif|css|gif|ico|jpe?g|js|png|svg|webp|woff2?)$/;
const TEXT_FILE_PATTERN = /(?:^_headers$|\.(?:css|html|js|json|txt)$)/i;
const MAX_HTTP_BODY_BYTES = 5_000_000;
const MAX_API_BODY_BYTES = 100_000;
export const MAX_ENTRY_JAVASCRIPT_BYTES = 800_000;
export const MAX_ENTRY_JAVASCRIPT_GZIP_BYTES = 230_000;

export const DEPLOYMENT_SMOKE_TIMEOUT_MS = 15_000;
export { DEPLOYMENT_CSP };

export type DeploymentReadinessErrorCode =
  "artifact_invalid" | "network_failed" | "origin_invalid" | "response_invalid";

export class DeploymentReadinessError extends Error {
  readonly code: DeploymentReadinessErrorCode;

  constructor(code: DeploymentReadinessErrorCode, message: string) {
    super(message);
    this.name = "DeploymentReadinessError";
    this.code = code;
  }
}

export interface DeploymentArtifactReport {
  status: "ready";
  outDir: string;
  fileCount: number;
  assetCount: number;
  entryJavaScriptBytes: number;
  entryJavaScriptGzipBytes: number;
  javascriptChunkCount: number;
  totalBytes: number;
  sha256: string;
  marketScrapedAt: string;
  historySnapshots: number;
}

export type HiscoresDeploymentMode = "absent" | "disabled" | "enabled";

export interface PublicDeploymentSmokeReport {
  status: "passed";
  origin: string;
  assetCount: number;
  marketScrapedAt: string;
  historySnapshots: number;
  hiscoresMode: HiscoresDeploymentMode;
  hiscoresAvailable: boolean;
}

interface ArtifactFile {
  path: string;
  bytes: Uint8Array;
}

interface FetchResponseLike {
  ok: boolean;
  status: number;
  headers: { get(name: string): string | null };
  body: ReadableStream<Uint8Array> | null;
}

export type DeploymentFetchLike = (
  url: string,
  init: {
    method: "GET";
    headers: { Accept: string };
    redirect: "error";
    signal: AbortSignal;
  }
) => Promise<FetchResponseLike>;

interface FetchedResource {
  status: number;
  ok: boolean;
  headers: FetchResponseLike["headers"];
  text: string;
}

function failArtifact(message: string): never {
  throw new DeploymentReadinessError("artifact_invalid", message);
}

function repoRelativePath(projectRoot: string, target: string): string {
  const value = relative(projectRoot, target);
  if (!value || value === ".") return ".";
  return value.split(sep).join("/");
}

function resolveInsideProject(projectRoot: string, requestedPath: string): string {
  const root = resolve(projectRoot);
  const target = resolve(root, requestedPath);
  const pathFromRoot = relative(root, target);
  if (pathFromRoot.startsWith("..") || resolve(root, pathFromRoot) !== target) {
    failArtifact("Deployment artifact directory must stay inside the repository");
  }
  return target;
}

function collectArtifactFiles(root: string, directory = root): ArtifactFile[] {
  const directoryStat = lstatSync(directory);
  if (directoryStat.isSymbolicLink()) {
    failArtifact("Deployment artifact must not contain symbolic links");
  }
  if (!directoryStat.isDirectory()) {
    failArtifact("Deployment artifact path is not a directory");
  }

  const files: ArtifactFile[] = [];
  for (const entry of readdirSync(directory, { withFileTypes: true })) {
    const fullPath = resolve(directory, entry.name);
    const path = relative(root, fullPath).split(sep).join("/");
    if (entry.isSymbolicLink()) {
      failArtifact(`Deployment artifact contains a symbolic link: ${path}`);
    }
    if (entry.isDirectory()) {
      files.push(...collectArtifactFiles(root, fullPath));
      continue;
    }
    if (!entry.isFile()) {
      failArtifact(`Deployment artifact contains an unsupported entry: ${path}`);
    }
    files.push({ path, bytes: readFileSync(fullPath) });
  }
  return files.sort((left, right) => left.path.localeCompare(right.path));
}

function assertArtifactPathPolicy(files: readonly ArtifactFile[]): void {
  for (const file of files) {
    const lower = file.path.toLowerCase();
    const rootFile = !file.path.includes("/");
    if (rootFile && !REQUIRED_ROOT_FILES.has(file.path)) {
      failArtifact(`Deployment artifact contains an unexpected root file: ${file.path}`);
    }
    if (!rootFile && !HASHED_ASSET_PATTERN.test(file.path)) {
      failArtifact(`Deployment artifact contains a non-hashed or unexpected asset: ${file.path}`);
    }
    if (
      lower.endsWith(".map") ||
      lower.endsWith(".ts") ||
      lower.endsWith(".tsx") ||
      lower.endsWith(".pem") ||
      lower.endsWith(".key") ||
      lower.endsWith(".log") ||
      lower.includes("/.env") ||
      lower.includes("/.git/") ||
      lower.includes("/node_modules/") ||
      lower.includes("/.sources/") ||
      lower.includes("/.vite/")
    ) {
      failArtifact(`Deployment artifact contains a forbidden file: ${file.path}`);
    }
  }
}

function assertArtifactTextHygiene(files: readonly ArtifactFile[]): void {
  const forbiddenContent = [
    /\/Users\/[A-Za-z0-9._-]+\//,
    /\/home\/[A-Za-z0-9._-]+\//,
    /[A-Za-z]:\\Users\\/,
    /-----BEGIN (?:RSA |EC |OPENSSH )?PRIVATE KEY-----/,
    /\bgithub_pat_[A-Za-z0-9_]+\b/,
    /\bghp_[A-Za-z0-9]+\b/,
    /\bsk_live_[A-Za-z0-9]+\b/
  ];

  for (const file of files) {
    if (!TEXT_FILE_PATTERN.test(file.path)) continue;
    const text = new TextDecoder().decode(file.bytes);
    if (forbiddenContent.some((pattern) => pattern.test(text))) {
      failArtifact(`Deployment artifact contains unsafe text in ${file.path}`);
    }
    if (/sourceMappingURL\s*=/.test(text)) {
      failArtifact(`Deployment artifact references a source map in ${file.path}`);
    }
  }
}

function parseCloudflareHeadersFile(text: string): Map<string, Map<string, string>> {
  const rules = new Map<string, Map<string, string>>();
  let currentRule: Map<string, string> | undefined;

  for (const rawLine of text.split(/\r?\n/)) {
    if (!rawLine.trim() || rawLine.trimStart().startsWith("#")) continue;
    if (!/^\s/.test(rawLine)) {
      const path = rawLine.trim();
      if (!path.startsWith("/") || rules.has(path)) {
        failArtifact("Deployment _headers contains an invalid or duplicate route rule");
      }
      currentRule = new Map<string, string>();
      rules.set(path, currentRule);
      continue;
    }

    if (!currentRule) failArtifact("Deployment _headers contains a header without a route");
    const match = /^\s+([^:]+):\s*(.+)$/.exec(rawLine);
    if (!match) failArtifact("Deployment _headers contains an invalid header line");
    const name = match[1].trim().toLowerCase();
    const value = match[2].trim();
    if (!name || !value || currentRule.has(name)) {
      failArtifact("Deployment _headers contains an invalid or duplicate header");
    }
    currentRule.set(name, value);
  }

  return rules;
}

function assertCloudflareHeadersContract(filesByPath: Map<string, ArtifactFile>): void {
  const file = filesByPath.get(CLOUDFLARE_HEADERS_FILE);
  if (!file) failArtifact(`Deployment artifact is missing ${CLOUDFLARE_HEADERS_FILE}`);
  const rules = parseCloudflareHeadersFile(new TextDecoder().decode(file.bytes));
  const requiredRule = (path: string): Map<string, string> => {
    const rule = rules.get(path);
    if (!rule) failArtifact(`Deployment _headers is missing the ${path} route rule`);
    return rule;
  };
  const headerView = (headers: Map<string, string>) => ({
    get: (name: string) => headers.get(name.toLowerCase()) ?? null
  });

  try {
    assertSecurityHeaders(headerView(requiredRule("/*")), "/*");
    assertShortCache(headerView(requiredRule("/")), "/");
    assertShortCache(headerView(requiredRule("/index.html")), "/index.html");
    assertImmutableCache(headerView(requiredRule("/assets/*")), "/assets/*");
    for (const fileName of MARKET_FILES) {
      assertShortCache(headerView(requiredRule(`/${fileName}`)), `/${fileName}`);
    }
  } catch (error) {
    if (error instanceof DeploymentReadinessError) {
      failArtifact("Deployment _headers does not satisfy the security and cache contract");
    }
    throw error;
  }
}

function parseArtifactJson(filesByPath: Map<string, ArtifactFile>, path: string): unknown {
  const file = filesByPath.get(path);
  if (!file) failArtifact(`Deployment artifact is missing ${path}`);
  try {
    return parseJsonWithDuplicateKeyCheck(new TextDecoder().decode(file.bytes), { source: path });
  } catch {
    failArtifact(`Deployment artifact contains invalid JSON in ${path}`);
  }
}

function validateMarketFiles(filesByPath: Map<string, ArtifactFile>): {
  marketScrapedAt: string;
  historySnapshots: number;
} {
  const prices = parseArtifactJson(filesByPath, "prices.json");
  const provenanceInput = parseArtifactJson(filesByPath, "price-provenance.json");
  const alchValues = parseArtifactJson(filesByPath, "alch.json");
  const history = parseArtifactJson(filesByPath, "price-history.json");
  try {
    const provenance = ScheduledPriceProvenanceArtifactSchema.parse(provenanceInput);
    const priceSet = createPriceSetFromLegacyRecords({
      id: "deployment-artifact",
      label: "Deployment artifact",
      source: "scraped",
      itemPrices: prices,
      itemPriceMetadata: provenance.items,
      alchValues
    });
    const parsedHistory = PriceHistorySchema.parse(history);
    if (priceSet.createdAt === "legacy-unknown") {
      failArtifact("Deployment prices.json is missing a valid _scraped_at value");
    }
    if (
      provenance.capturedAt !== priceSet.createdAt ||
      JSON.stringify(Object.keys(stripLegacyPriceMetadata(prices).values).sort()) !==
        JSON.stringify(Object.keys(provenance.items).sort())
    ) {
      failArtifact("Deployment price provenance does not match prices.json");
    }
    return {
      marketScrapedAt: priceSet.createdAt,
      historySnapshots: parsedHistory.snapshots.length
    };
  } catch (error) {
    if (error instanceof DeploymentReadinessError) throw error;
    failArtifact("Deployment market files do not satisfy the validated data contract");
  }
}

function extractAssetPaths(indexHtml: string): string[] {
  if (/<script\b(?![^>]*\bsrc=)[^>]*>/i.test(indexHtml)) {
    failArtifact("Deployment index contains an inline script incompatible with the CSP contract");
  }

  const references = [...indexHtml.matchAll(/\b(?:src|href)=["']([^"']+)["']/gi)].map(
    (match) => match[1]
  );
  if (references.some((reference) => /^(?:[a-z][a-z0-9+.-]*:|\/\/)/i.test(reference))) {
    failArtifact("Deployment index references an external asset");
  }

  const assets = references
    .filter((reference) => reference.startsWith("/assets/"))
    .map((reference) => reference.slice(1));
  if (!assets.some((asset) => asset.endsWith(".js"))) {
    failArtifact("Deployment index does not reference a hashed JavaScript asset");
  }
  if (!assets.some((asset) => asset.endsWith(".css"))) {
    failArtifact("Deployment index does not reference a hashed stylesheet asset");
  }
  if (assets.some((asset) => !HASHED_ASSET_PATTERN.test(asset))) {
    failArtifact("Deployment index references a non-hashed asset");
  }
  return [...new Set(assets)].sort();
}

function artifactDigest(files: readonly ArtifactFile[]): string {
  const hash = createHash("sha256");
  for (const file of files) {
    hash.update(file.path);
    hash.update("\0");
    hash.update(file.bytes);
    hash.update("\0");
  }
  return hash.digest("hex");
}

function entryJavaScriptReport(
  assets: readonly string[],
  files: readonly ArtifactFile[],
  filesByPath: ReadonlyMap<string, ArtifactFile>
): Pick<
  DeploymentArtifactReport,
  "entryJavaScriptBytes" | "entryJavaScriptGzipBytes" | "javascriptChunkCount"
> {
  const entryFiles = assets
    .filter((asset) => asset.endsWith(".js"))
    .map((asset) => filesByPath.get(asset))
    .filter((file): file is ArtifactFile => file !== undefined);
  const entryJavaScriptBytes = entryFiles.reduce((total, file) => total + file.bytes.byteLength, 0);
  const entryJavaScriptGzipBytes = entryFiles.reduce(
    (total, file) => total + gzipSync(file.bytes).byteLength,
    0
  );
  if (entryJavaScriptBytes > MAX_ENTRY_JAVASCRIPT_BYTES) {
    failArtifact(
      `Deployment entry JavaScript exceeds ${MAX_ENTRY_JAVASCRIPT_BYTES} bytes (${entryJavaScriptBytes})`
    );
  }
  if (entryJavaScriptGzipBytes > MAX_ENTRY_JAVASCRIPT_GZIP_BYTES) {
    failArtifact(
      `Deployment entry JavaScript gzip exceeds ${MAX_ENTRY_JAVASCRIPT_GZIP_BYTES} bytes (${entryJavaScriptGzipBytes})`
    );
  }
  return {
    entryJavaScriptBytes,
    entryJavaScriptGzipBytes,
    javascriptChunkCount: files.filter((file) => file.path.endsWith(".js")).length
  };
}

export function verifyDeploymentArtifact(
  options: {
    outDir?: string;
    projectRoot?: string;
  } = {}
): DeploymentArtifactReport {
  const projectRoot = resolve(options.projectRoot ?? process.cwd());
  const outDir = resolveInsideProject(projectRoot, options.outDir ?? "dist");
  let files: ArtifactFile[];
  try {
    files = collectArtifactFiles(outDir);
  } catch (error) {
    if (error instanceof DeploymentReadinessError) throw error;
    failArtifact("Deployment artifact directory cannot be read");
  }
  const filesByPath = new Map(files.map((file) => [file.path, file]));

  for (const required of REQUIRED_ROOT_FILES) {
    if (!filesByPath.has(required)) failArtifact(`Deployment artifact is missing ${required}`);
  }
  assertArtifactPathPolicy(files);
  assertArtifactTextHygiene(files);
  assertCloudflareHeadersContract(filesByPath);

  const indexFile = filesByPath.get("index.html");
  if (!indexFile) failArtifact("Deployment artifact is missing index.html");
  const assets = extractAssetPaths(new TextDecoder().decode(indexFile.bytes));
  for (const asset of assets) {
    if (!filesByPath.has(asset)) {
      failArtifact(`Deployment index references a missing asset: ${asset}`);
    }
  }

  const market = validateMarketFiles(filesByPath);
  const entryJavaScript = entryJavaScriptReport(assets, files, filesByPath);
  return {
    status: "ready",
    outDir: repoRelativePath(projectRoot, outDir),
    fileCount: files.length,
    assetCount: assets.length,
    ...entryJavaScript,
    totalBytes: files.reduce((sum, file) => sum + file.bytes.byteLength, 0),
    sha256: artifactDigest(files),
    ...market
  };
}

function parseCsp(value: string): Map<string, Set<string>> {
  const directives = new Map<string, Set<string>>();
  for (const rawDirective of value.split(";")) {
    const tokens = rawDirective.trim().split(/\s+/).filter(Boolean);
    const name = tokens.shift();
    if (name) directives.set(name.toLowerCase(), new Set(tokens));
  }
  return directives;
}

function assertSecurityHeaders(headers: FetchResponseLike["headers"], path: string): void {
  const csp = parseCsp(headers.get("Content-Security-Policy") ?? "");
  const requiredCsp: Record<string, readonly string[]> = {
    "default-src": ["'self'"],
    "script-src": ["'self'"],
    "style-src": ["'self'"],
    "img-src": ["'self'", "data:", "blob:"],
    "connect-src": ["'self'"],
    "object-src": ["'none'"],
    "base-uri": ["'self'"],
    "form-action": ["'none'"]
  };
  for (const [directive, values] of Object.entries(requiredCsp)) {
    const actual = csp.get(directive);
    if (!actual || values.some((value) => !actual.has(value)) || actual.size !== values.length) {
      throw new DeploymentReadinessError(
        "response_invalid",
        `Deployment response ${path} does not match required CSP directive ${directive}`
      );
    }
  }
  if ([...csp.values()].some((values) => values.has("*") || values.has("'unsafe-eval'"))) {
    throw new DeploymentReadinessError(
      "response_invalid",
      `Deployment response ${path} has an unsafe CSP value`
    );
  }
  if ((headers.get("Referrer-Policy") ?? "").toLowerCase() !== "no-referrer") {
    throw new DeploymentReadinessError(
      "response_invalid",
      `Deployment response ${path} is missing Referrer-Policy`
    );
  }
  if ((headers.get("X-Content-Type-Options") ?? "").toLowerCase() !== "nosniff") {
    throw new DeploymentReadinessError(
      "response_invalid",
      `Deployment response ${path} is missing X-Content-Type-Options`
    );
  }
  const permissions = (headers.get("Permissions-Policy") ?? "").replace(/\s+/g, "");
  for (const policy of ["camera=()", "microphone=()", "geolocation=()", "payment=()"]) {
    if (!permissions.includes(policy)) {
      throw new DeploymentReadinessError(
        "response_invalid",
        `Deployment response ${path} is missing Permissions-Policy ${policy}`
      );
    }
  }
}

function cacheMaxAge(value: string): number | null {
  const match = /(?:^|,)\s*max-age=(\d+)/i.exec(value);
  return match ? Number(match[1]) : null;
}

function assertShortCache(headers: FetchResponseLike["headers"], path: string): void {
  const value = headers.get("Cache-Control") ?? "";
  const maxAge = cacheMaxAge(value);
  if (!/\b(?:no-cache|no-store)\b/i.test(value) && (maxAge === null || maxAge > 300)) {
    throw new DeploymentReadinessError(
      "response_invalid",
      `Deployment response ${path} must use no-cache or short revalidation`
    );
  }
}

function assertImmutableCache(headers: FetchResponseLike["headers"], path: string): void {
  const value = headers.get("Cache-Control") ?? "";
  const maxAge = cacheMaxAge(value);
  if (!/\bimmutable\b/i.test(value) || maxAge === null || maxAge < 31_536_000) {
    throw new DeploymentReadinessError(
      "response_invalid",
      `Deployment response ${path} must use long-lived immutable caching`
    );
  }
}

function assertNoStore(headers: FetchResponseLike["headers"], path: string): void {
  if (!/\bno-store\b/i.test(headers.get("Cache-Control") ?? "")) {
    throw new DeploymentReadinessError(
      "response_invalid",
      `Deployment response ${path} must use no-store caching`
    );
  }
}

function assertContentType(
  headers: FetchResponseLike["headers"],
  path: string,
  accepted: readonly string[]
): void {
  const contentType = (headers.get("Content-Type") ?? "").toLowerCase();
  if (!accepted.some((value) => contentType.startsWith(value))) {
    throw new DeploymentReadinessError(
      "response_invalid",
      `Deployment response ${path} has an unexpected content type`
    );
  }
}

async function readBoundedBody(
  response: FetchResponseLike,
  maxBytes: number,
  signal: AbortSignal
): Promise<string> {
  const declared = response.headers.get("Content-Length");
  if (declared && /^\d+$/.test(declared) && Number(declared) > maxBytes) {
    throw new DeploymentReadinessError(
      "response_invalid",
      "Deployment response exceeds the smoke-test size limit"
    );
  }
  if (!response.body) return "";

  const reader = response.body.getReader();
  const chunks: Uint8Array[] = [];
  let length = 0;
  try {
    while (true) {
      if (signal.aborted) {
        throw new DeploymentReadinessError("network_failed", "Deployment request timed out");
      }
      const { done, value } = await reader.read();
      if (done) break;
      length += value.byteLength;
      if (length > maxBytes) {
        await reader.cancel();
        throw new DeploymentReadinessError(
          "response_invalid",
          "Deployment response exceeds the smoke-test size limit"
        );
      }
      chunks.push(value);
    }
  } finally {
    reader.releaseLock();
  }

  const bytes = new Uint8Array(length);
  let offset = 0;
  for (const chunk of chunks) {
    bytes.set(chunk, offset);
    offset += chunk.byteLength;
  }
  return new TextDecoder().decode(bytes);
}

async function fetchResource(
  origin: URL,
  path: string,
  fetchImpl: DeploymentFetchLike,
  timeoutMs: number,
  maxBytes = MAX_HTTP_BODY_BYTES
): Promise<FetchedResource> {
  const controller = new AbortController();
  let timeoutId: ReturnType<typeof setTimeout> | undefined;
  const timeout = new Promise<never>((_, reject) => {
    timeoutId = setTimeout(() => {
      controller.abort();
      reject(new DeploymentReadinessError("network_failed", "Deployment request timed out"));
    }, timeoutMs);
  });
  const action = async () => {
    const response = await fetchImpl(new URL(path, origin).href, {
      method: "GET",
      headers: { Accept: "text/html, application/json, text/css, application/javascript" },
      redirect: "error",
      signal: controller.signal
    });
    return {
      status: response.status,
      ok: response.ok,
      headers: response.headers,
      text: await readBoundedBody(response, maxBytes, controller.signal)
    };
  };

  try {
    return await Promise.race([action(), timeout]);
  } catch (error) {
    if (error instanceof DeploymentReadinessError) throw error;
    throw new DeploymentReadinessError("network_failed", "Deployment request failed");
  } finally {
    if (timeoutId !== undefined) clearTimeout(timeoutId);
  }
}

function parseDeploymentOrigin(value: string): URL {
  let target: URL;
  try {
    target = new URL(value);
  } catch {
    throw new DeploymentReadinessError("origin_invalid", "Deployment origin is not a valid URL");
  }
  if (
    target.protocol !== "https:" ||
    target.username ||
    target.password ||
    target.pathname !== "/" ||
    target.search ||
    target.hash
  ) {
    throw new DeploymentReadinessError(
      "origin_invalid",
      "Deployment origin must be a credential-free HTTPS origin root"
    );
  }
  return target;
}

function assertOk(resource: FetchedResource, path: string): void {
  if (!resource.ok) {
    throw new DeploymentReadinessError(
      "response_invalid",
      `Deployment response ${path} returned status ${resource.status}`
    );
  }
}

function parseRemoteMarketFiles(
  resources: Record<(typeof MARKET_FILES)[number], FetchedResource>
): {
  marketScrapedAt: string;
  historySnapshots: number;
} {
  try {
    const prices = parseJsonWithDuplicateKeyCheck(resources["prices.json"].text, {
      source: "prices.json"
    });
    const provenance = ScheduledPriceProvenanceArtifactSchema.parse(
      parseJsonWithDuplicateKeyCheck(resources["price-provenance.json"].text, {
        source: "price-provenance.json"
      })
    );
    const alchValues = parseJsonWithDuplicateKeyCheck(resources["alch.json"].text, {
      source: "alch.json"
    });
    const history = PriceHistorySchema.parse(
      parseJsonWithDuplicateKeyCheck(resources["price-history.json"].text, {
        source: "price-history.json"
      })
    );
    const priceSet = createPriceSetFromLegacyRecords({
      id: "deployed-market",
      label: "Deployed market",
      source: "scraped",
      itemPrices: prices,
      itemPriceMetadata: provenance.items,
      alchValues
    });
    if (priceSet.createdAt === "legacy-unknown") {
      throw new Error("missing timestamp");
    }
    if (
      provenance.capturedAt !== priceSet.createdAt ||
      JSON.stringify(Object.keys(stripLegacyPriceMetadata(prices).values).sort()) !==
        JSON.stringify(Object.keys(provenance.items).sort())
    ) {
      throw new Error("provenance mismatch");
    }
    return {
      marketScrapedAt: priceSet.createdAt,
      historySnapshots: history.snapshots.length
    };
  } catch {
    throw new DeploymentReadinessError(
      "response_invalid",
      "Deployed market files do not satisfy the validated data contract"
    );
  }
}

export async function smokePublicDeployment(options: {
  origin: string;
  hiscoresMode: HiscoresDeploymentMode;
  fetchImpl?: DeploymentFetchLike;
  timeoutMs?: number;
}): Promise<PublicDeploymentSmokeReport> {
  const origin = parseDeploymentOrigin(options.origin);
  const fetchImpl = options.fetchImpl ?? fetch;
  const timeoutMs = options.timeoutMs ?? DEPLOYMENT_SMOKE_TIMEOUT_MS;

  const root = await fetchResource(origin, "/", fetchImpl, timeoutMs);
  assertOk(root, "/");
  assertContentType(root.headers, "/", ["text/html"]);
  assertSecurityHeaders(root.headers, "/");
  assertShortCache(root.headers, "/");

  const assetPaths = extractAssetPaths(root.text).map((path) => `/${path}`);
  for (const path of assetPaths) {
    const asset = await fetchResource(origin, path, fetchImpl, timeoutMs);
    assertOk(asset, path);
    assertSecurityHeaders(asset.headers, path);
    assertImmutableCache(asset.headers, path);
    assertContentType(
      asset.headers,
      path,
      path.endsWith(".css") ? ["text/css"] : ["application/javascript", "text/javascript"]
    );
  }

  const marketResources = {} as Record<(typeof MARKET_FILES)[number], FetchedResource>;
  for (const fileName of MARKET_FILES) {
    const path = `/${fileName}`;
    const resource = await fetchResource(origin, path, fetchImpl, timeoutMs);
    assertOk(resource, path);
    assertContentType(resource.headers, path, ["application/json"]);
    assertSecurityHeaders(resource.headers, path);
    assertShortCache(resource.headers, path);
    marketResources[fileName] = resource;
  }
  const market = parseRemoteMarketFiles(marketResources);

  const unknownApi = await fetchResource(
    origin,
    "/api/__index_sim_deployment_probe__",
    fetchImpl,
    timeoutMs,
    MAX_API_BODY_BYTES
  );
  if (unknownApi.ok) {
    throw new DeploymentReadinessError(
      "response_invalid",
      "Unknown API route returned a successful response and may be masked by SPA fallback"
    );
  }

  const hiscoresStatus = await fetchResource(
    origin,
    "/api/hiscores/status",
    fetchImpl,
    timeoutMs,
    MAX_API_BODY_BYTES
  );
  let hiscoresAvailable = false;
  if (options.hiscoresMode === "absent") {
    if (hiscoresStatus.ok) {
      throw new DeploymentReadinessError(
        "response_invalid",
        "Hiscores status route exists although the selected deployment mode is absent"
      );
    }
  } else {
    assertOk(hiscoresStatus, "/api/hiscores/status");
    assertContentType(hiscoresStatus.headers, "/api/hiscores/status", ["application/json"]);
    assertSecurityHeaders(hiscoresStatus.headers, "/api/hiscores/status");
    assertNoStore(hiscoresStatus.headers, "/api/hiscores/status");
    try {
      hiscoresAvailable = parseHiscoresStatusResponseJson(hiscoresStatus.text).available;
    } catch {
      throw new DeploymentReadinessError(
        "response_invalid",
        "Hiscores status response does not satisfy the validated contract"
      );
    }
    if (hiscoresAvailable !== (options.hiscoresMode === "enabled")) {
      throw new DeploymentReadinessError(
        "response_invalid",
        "Hiscores status does not match the selected deployment mode"
      );
    }
  }

  return {
    status: "passed",
    origin: origin.origin,
    assetCount: assetPaths.length,
    ...market,
    hiscoresMode: options.hiscoresMode,
    hiscoresAvailable
  };
}
