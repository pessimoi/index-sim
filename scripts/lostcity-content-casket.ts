import { LostCityContentSourceError } from "./lostcity-content-config";
import {
  lostCityRuneScriptBlockKey,
  readLostCityRuneScriptCatalog,
  type ReadLostCityRuneScriptCatalogOptions
} from "./lostcity-content-runescript";
import { lostCityRuntimeItemId } from "./lostcity-content-runtime-mapping";

export const LOSTCITY_CASKET_ROLL_DENOMINATOR = 128;
export const LOSTCITY_CASKET_COIN_AMOUNTS = [20, 40, 80, 160, 320, 640] as const;
export const LOSTCITY_CASKET_COIN_EXPRESSION = "multiply(pow(2, add(random(6), 1)), 10)";

const EXPECTED_CASKET_BRANCHES = [
  {
    threshold: 60,
    sourceItemId: "coins",
    runtimeItemId: "coins",
    quantityExpression: LOSTCITY_CASKET_COIN_EXPRESSION
  },
  {
    threshold: 92,
    sourceItemId: "uncut_sapphire",
    runtimeItemId: "uncut_sapphire",
    quantityExpression: "1"
  },
  {
    threshold: 108,
    sourceItemId: "uncut_emerald",
    runtimeItemId: "uncut_emerald",
    quantityExpression: "1"
  },
  {
    threshold: 116,
    sourceItemId: "uncut_ruby",
    runtimeItemId: "uncut_ruby",
    quantityExpression: "1"
  },
  {
    threshold: 124,
    sourceItemId: "cosmic_talisman",
    runtimeItemId: "cosmic_talisman",
    quantityExpression: "1"
  },
  {
    threshold: 126,
    sourceItemId: "uncut_diamond",
    runtimeItemId: "uncut_diamond",
    quantityExpression: "1"
  },
  {
    threshold: 127,
    sourceItemId: "keyhalf1",
    runtimeItemId: "tooth_half_key",
    quantityExpression: "1"
  },
  {
    threshold: 128,
    sourceItemId: "keyhalf2",
    runtimeItemId: "loop_half_key",
    quantityExpression: "1"
  }
] as const;

export interface LostCityCasketSourceRow {
  threshold: number;
  weight: number;
  sourceItemId: string;
  runtimeItemId: string;
  quantityExpression: string;
}

export interface LostCityCasketSourceContract {
  sourceRef: string;
  denominator: number;
  coinAmounts: readonly number[];
  rows: LostCityCasketSourceRow[];
}

function casketSourceError(message: string): never {
  throw new LostCityContentSourceError(
    "config_invalid",
    `LostCity ordinary casket source contract drifted: ${message}`
  );
}

function normalizeExpression(expression: string): string {
  return expression.replace(/\s+/g, "");
}

function parseCasketBranches(lines: readonly string[]): Array<{
  threshold: number;
  sourceItemId: string;
  quantityExpression: string;
}> {
  const branches: Array<{
    threshold: number;
    sourceItemId: string;
    quantityExpression: string;
  }> = [];

  for (let index = 0; index < lines.length; index += 1) {
    const thresholdMatch = lines[index]
      .trim()
      .match(/^(?:if|}\s*else if)\s*\(\$random\s*<\s*(\d+)\)/);
    if (!thresholdMatch) continue;

    const threshold = Number(thresholdMatch[1]);
    let reward: { sourceItemId: string; quantityExpression: string } | undefined;
    for (let rewardIndex = index + 1; rewardIndex < lines.length; rewardIndex += 1) {
      const line = lines[rewardIndex].replace(/\s*\/\/.*$/, "").trim();
      if (/^(?:if|}\s*else if)\s*\(\$random\s*</.test(line)) break;
      const rewardMatch = line.match(/^inv_add\(inv,\s*([a-zA-Z0-9_]+),\s*(.+)\);$/);
      if (!rewardMatch) continue;
      reward = {
        sourceItemId: rewardMatch[1],
        quantityExpression: rewardMatch[2].trim()
      };
      break;
    }
    if (!reward) casketSourceError(`branch below threshold ${threshold} has no inventory reward`);
    branches.push({ threshold, ...reward });
  }

  return branches;
}

export function readLostCityCasketSourceContract(
  options: ReadLostCityRuneScriptCatalogOptions
): LostCityCasketSourceContract {
  const catalog = readLostCityRuneScriptCatalog(options);
  const key = lostCityRuneScriptBlockKey("opheld1", "casket");
  const blocks = catalog.blocksByKey.get(key) ?? [];
  if (blocks.length !== 1) {
    casketSourceError(`expected one [opheld1,casket] trigger, found ${blocks.length}`);
  }
  const block = blocks[0];
  const denominatorLine = block.lines.find((line) =>
    /def_int\s+\$random\s*=\s*random\(/.test(line)
  );
  const denominatorMatch = denominatorLine?.match(/def_int\s+\$random\s*=\s*random\((\d+)\)\s*;/);
  const denominator = denominatorMatch ? Number(denominatorMatch[1]) : NaN;
  if (denominator !== LOSTCITY_CASKET_ROLL_DENOMINATOR) {
    casketSourceError(
      `expected random(${LOSTCITY_CASKET_ROLL_DENOMINATOR}), found ${Number.isFinite(denominator) ? `random(${denominator})` : "no supported roll"}`
    );
  }

  const branches = parseCasketBranches(block.lines);
  if (branches.length !== EXPECTED_CASKET_BRANCHES.length) {
    casketSourceError(
      `expected ${EXPECTED_CASKET_BRANCHES.length} reward branches, found ${branches.length}`
    );
  }

  let previousThreshold = 0;
  const rows = branches.map((branch, index): LostCityCasketSourceRow => {
    const expected = EXPECTED_CASKET_BRANCHES[index];
    const runtimeItemId = lostCityRuntimeItemId(branch.sourceItemId);
    if (
      branch.threshold !== expected.threshold ||
      branch.sourceItemId !== expected.sourceItemId ||
      runtimeItemId !== expected.runtimeItemId ||
      normalizeExpression(branch.quantityExpression) !==
        normalizeExpression(expected.quantityExpression)
    ) {
      casketSourceError(
        `branch ${index + 1} no longer matches threshold ${expected.threshold}, reward ${expected.sourceItemId} and quantity ${expected.quantityExpression}`
      );
    }
    const row = {
      threshold: branch.threshold,
      weight: branch.threshold - previousThreshold,
      sourceItemId: branch.sourceItemId,
      runtimeItemId,
      quantityExpression: branch.quantityExpression
    };
    previousThreshold = branch.threshold;
    return row;
  });

  if (previousThreshold !== denominator) {
    casketSourceError(
      `final threshold ${previousThreshold} does not cover denominator ${denominator}`
    );
  }

  return {
    sourceRef: block.sourceRef,
    denominator,
    coinAmounts: LOSTCITY_CASKET_COIN_AMOUNTS,
    rows
  };
}
