import { fileURLToPath } from "node:url";
import { resolve } from "node:path";
import {
  DeploymentReadinessError,
  smokePublicDeployment,
  verifyDeploymentArtifact,
  type HiscoresDeploymentMode
} from "./deployment-readiness-core";

interface ArtifactOptions {
  command: "artifact";
  outDir: string;
}

interface HttpOptions {
  command: "http";
  origin: string;
  hiscoresMode: HiscoresDeploymentMode;
}

type CliOptions = ArtifactOptions | HttpOptions;

export function usage(): string {
  return [
    "Usage:",
    "  npm run deploy:verify-artifact -- [--out-dir dist]",
    "  npm run deploy:smoke -- --origin https://preview.example --hiscores-mode absent|disabled|enabled",
    "",
    "The HTTP smoke accepts only a credential-free HTTPS origin root. Enabled mode validates",
    "the status contract only; a player lookup remains gated by the production access-log policy."
  ].join("\n");
}

function readValue(argv: string[], index: number, flag: string): string {
  const value = argv[index + 1];
  if (!value || value.startsWith("--")) throw new Error(`Missing value for ${flag}`);
  return value;
}

export function parseArgs(argv: string[]): CliOptions {
  const command = argv[0];
  if (command !== "artifact" && command !== "http") {
    throw new Error("Expected artifact or http command");
  }
  let outDir = "dist";
  let origin = "";
  let hiscoresMode: HiscoresDeploymentMode = "absent";

  for (let index = 1; index < argv.length; index += 1) {
    const arg = argv[index];
    if (arg === "--help") {
      console.log(usage());
      process.exit(0);
    }
    if (arg === "--out-dir" && command === "artifact") {
      outDir = readValue(argv, index, arg);
      index += 1;
      continue;
    }
    if (arg === "--origin" && command === "http") {
      origin = readValue(argv, index, arg);
      index += 1;
      continue;
    }
    if (arg === "--hiscores-mode" && command === "http") {
      const value = readValue(argv, index, arg);
      if (value !== "absent" && value !== "disabled" && value !== "enabled") {
        throw new Error("--hiscores-mode must be absent, disabled or enabled");
      }
      hiscoresMode = value;
      index += 1;
      continue;
    }
    throw new Error(`Unknown argument ${arg}`);
  }

  if (command === "artifact") return { command, outDir };
  if (!origin) throw new Error("--origin is required for the http command");
  return { command, origin, hiscoresMode };
}

export async function main(argv = process.argv.slice(2)): Promise<void> {
  const options = parseArgs(argv);
  const report =
    options.command === "artifact"
      ? verifyDeploymentArtifact({ outDir: options.outDir })
      : await smokePublicDeployment({
          origin: options.origin,
          hiscoresMode: options.hiscoresMode
        });
  console.log(JSON.stringify(report, null, 2));
}

function isDirectCliRun(): boolean {
  const currentFile = fileURLToPath(import.meta.url);
  const argvHasCurrentFile = process.argv.some((arg) => resolve(arg) === currentFile);
  const viteNodeScriptRun =
    process.env.VITEST !== "true" &&
    currentFile.replace(/\\/g, "/").endsWith("/scripts/verify-public-deployment.ts");
  return argvHasCurrentFile || viteNodeScriptRun;
}

if (isDirectCliRun()) {
  main().catch((error: unknown) => {
    const message =
      error instanceof DeploymentReadinessError || error instanceof Error
        ? error.message
        : "internal-error";
    console.error(`deployment verification failed: ${message}`);
    process.exitCode = 1;
  });
}
