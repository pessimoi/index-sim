import type { DropDefinition, DropEntry } from "../src/domain/shared";
import {
  configParamValue,
  lastConfigValue,
  resolvedConfigParamValue,
  type LostCityConfigCatalog,
  type LostCityConfigEntry
} from "./lostcity-content-config";
import {
  lostCityLootHandlerBlock,
  lostCityRuneScriptBlock,
  resolveLostCityLootHandler,
  type LostCityLootHandlerCatalog
} from "./lostcity-content-loot";
import {
  lostCityMonsterSourceId,
  lostCityRuntimeItemId
} from "./lostcity-content-runtime-mapping";

export type LostCityLootExtractionStatus = "complete" | "partial" | "unsupported";

export interface LostCityLootExtractionIssue {
  code:
    | "no_declared_drop"
    | "random_chain_missing"
    | "unsupported_drop_expression"
    | "unsupported_drop_condition"
    | "unsupported_handler_statement";
  message: string;
}

export interface LostCityLootExtractionExclusion {
  code: "quest_gated_drop" | "tertiary_clue_drop";
  message: string;
}

export interface LostCityMonsterLootSource {
  runtimeId: string;
  sourceId: string;
  sourceRef: string;
  status: LostCityLootExtractionStatus;
  loot: DropEntry[];
  issues: LostCityLootExtractionIssue[];
  exclusions: LostCityLootExtractionExclusion[];
}

interface ParsedDropCall {
  itemExpression: string;
  quantityExpression: string;
}

interface RandomAssignment {
  lineIndex: number;
  variable: string;
  denominator: number;
}

function splitTopLevelArgs(value: string): string[] {
  const parts: string[] = [];
  let depth = 0;
  let start = 0;
  for (let index = 0; index < value.length; index += 1) {
    const char = value[index];
    if (char === "(") depth += 1;
    else if (char === ")") depth -= 1;
    else if (char === "," && depth === 0) {
      parts.push(value.slice(start, index).trim());
      start = index + 1;
    }
  }
  parts.push(value.slice(start).trim());
  return parts;
}

function parseDropCall(line: string): ParsedDropCall | undefined {
  const call = line.match(/obj_add(?:all)?\((.*)\);/);
  if (!call) return undefined;
  const args = splitTopLevelArgs(call[1]);
  if (args[0] !== "npc_coord" || (args.length !== 3 && args.length !== 4)) return undefined;
  return {
    itemExpression: args[1],
    quantityExpression: args.length === 4 ? args[2] : "1"
  };
}

function objectName(id: string, objects: LostCityConfigCatalog): string {
  return lastConfigValue(objects.entries.get(id), "name") ?? id.replaceAll("_", " ");
}

function quantityValue(expression: string): number | undefined {
  if (/^[0-9]+$/.test(expression)) return Number(expression);
  const range = expression.match(/^~random_range\((-?[0-9]+),\s*(-?[0-9]+)\)$/);
  return range ? (Number(range[1]) + Number(range[2])) / 2 : undefined;
}

const DYNAMIC_TABLES: Record<string, { name: string; tag: string }> = {
  "~randomherb": { name: "Random herb", tag: "herb" },
  "~randomjewel": { name: "Random jewel (gem table)", tag: "gem" },
  "~ultrarare_getitem": { name: "Ultra-rare drop table", tag: "ultrarare" }
};

const ITEM_TAGS: Readonly<Record<string, string>> = {
  casket: "casket"
};

const CACHE_SYMBOL_ITEM_FALLBACKS: Readonly<Record<string, string>> = {
  cert_coal: "coal",
  cert_raw_mackerel: "raw_mackerel",
  cert_raw_tuna: "raw_tuna"
};

function dropFromCall(input: {
  call: ParsedDropCall;
  chance: number;
  npc: LostCityConfigEntry;
  objects: LostCityConfigCatalog;
  params: LostCityConfigCatalog;
  issues: LostCityLootExtractionIssue[];
}): DropDefinition | undefined {
  const quantity = quantityValue(input.call.quantityExpression);
  if (quantity === undefined) {
    input.issues.push({
      code: "unsupported_drop_expression",
      message: `Unsupported quantity expression \`${input.call.quantityExpression}\`.`
    });
    return undefined;
  }
  const dynamic = DYNAMIC_TABLES[input.call.itemExpression];
  if (dynamic) {
    return { name: dynamic.name, tag: dynamic.tag, chance: input.chance, qtyAvg: quantity };
  }
  const isDefaultDrop = input.call.itemExpression === "npc_param(death_drop)";
  const sourceItemId = isDefaultDrop
    ? resolvedConfigParamValue(input.npc, input.params, "death_drop")
    : /^[A-Za-z0-9_]+$/.test(input.call.itemExpression)
      ? input.call.itemExpression
      : undefined;
  if (isDefaultDrop && !sourceItemId) return undefined;
  if (!sourceItemId) {
    input.issues.push({
      code: "unsupported_drop_expression",
      message: `Unsupported item expression \`${input.call.itemExpression}\`.`
    });
    return undefined;
  }
  const sourceObjectId = CACHE_SYMBOL_ITEM_FALLBACKS[sourceItemId] ?? sourceItemId;
  const itemId = lostCityRuntimeItemId(sourceObjectId);
  const baseName = objectName(sourceObjectId, input.objects);
  return {
    name: quantity === 1 ? baseName : `${baseName} x${quantity}`,
    key: itemId,
    ...(ITEM_TAGS[itemId] ? { tag: ITEM_TAGS[itemId] } : {}),
    chance: input.chance,
    qtyAvg: quantity,
    ...(sourceItemId !== sourceObjectId
      ? {
          notes:
            "Source cache symbol has no object config; valued through the documented underlying-item fallback without an inferred certificate multiplier."
        }
      : {})
  };
}

function randomAssignment(lines: string[]): RandomAssignment | undefined {
  for (let lineIndex = 0; lineIndex < lines.length; lineIndex += 1) {
    const match = lines[lineIndex]
      .trim()
      .match(/^def_int \$([A-Za-z0-9_]+) = (random|randominc)\(([0-9]+)\);$/);
    if (!match) continue;
    const argument = Number(match[3]);
    return {
      lineIndex,
      variable: match[1],
      denominator: match[2] === "randominc" ? argument + 1 : argument
    };
  }
  return undefined;
}

function directDropsBeforeRandom(input: {
  lines: string[];
  end: number;
  npc: LostCityConfigEntry;
  objects: LostCityConfigCatalog;
  params: LostCityConfigCatalog;
  issues: LostCityLootExtractionIssue[];
  exclusions: LostCityLootExtractionExclusion[];
}): DropEntry[] {
  const loot: DropEntry[] = [];
  const conditions: string[] = [];
  for (const rawLine of input.lines.slice(0, input.end)) {
    const line = rawLine.replace(/\/\/.*$/, "").trim();
    if (!line) continue;
    if (line.startsWith("}")) conditions.pop();
    const condition = line.match(/^(?:else\s+)?if\s*\((.*)\)\s*\{$/)?.[1];
    if (condition) conditions.push(condition);
    const call = parseDropCall(line);
    if (!call) continue;
    const supportedCondition = conditions.every(
      (value) => value.includes("npc_findhero") || value.includes("map_members")
    );
    if (!supportedCondition) {
      input.exclusions.push({
        code: "quest_gated_drop",
        message: "Quest- or NPC-state-gated drop is outside the current snapshot scope."
      });
      continue;
    }
    const drop = dropFromCall({ ...input, call, chance: 1 });
    if (drop) loot.push(drop);
  }
  return loot;
}

interface ThresholdBranch {
  threshold: number;
  lines: string[];
  condition?: string;
}

function thresholdBranches(lines: string[], variable: string): ThresholdBranch[] {
  const normalized = lines.flatMap((line) => line.replace(/}\s*else\s+if/g, "}\nelse if").split("\n"));
  const branches: ThresholdBranch[] = [];
  let current: ThresholdBranch | undefined;
  let depth = 0;
  const startPattern = new RegExp(`^(?:else\\s+)?if\\s*\\(\\s*\\$${variable}\\s*<\\s*([0-9]+)(?:\\s*&\\s*([^)]*))?\\s*\\)\\s*\\{$`);
  const inlinePattern = new RegExp(`^(?:else\\s+)?if\\s*\\(\\s*\\$${variable}\\s*<\\s*([0-9]+)(?:\\s*&\\s*([^)]*))?\\s*\\)\\s+(.+)$`);
  for (const rawLine of normalized) {
    const line = rawLine.replace(/\/\/.*$/, "").trim();
    if (!current) {
      const start = line.match(startPattern);
      if (start) {
        current = {
          threshold: Number(start[1]),
          lines: [],
          ...(start[2] ? { condition: start[2] } : {})
        };
        depth = 1;
        continue;
      }
      const inline = line.match(inlinePattern);
      if (inline) {
        branches.push({
          threshold: Number(inline[1]),
          lines: [inline[3]],
          ...(inline[2] ? { condition: inline[2] } : {})
        });
        continue;
      }
      const finalElse = line.match(/^else\s+(.+)$/);
      if (finalElse && branches.length) {
        branches.push({ threshold: Number.MAX_SAFE_INTEGER, lines: [finalElse[1]] });
        continue;
      }
    }
    if (!current) continue;
    const opens = (line.match(/{/g) ?? []).length;
    const closes = (line.match(/}/g) ?? []).length;
    depth += opens - closes;
    if (depth <= 0) {
      branches.push(current);
      current = undefined;
      depth = 0;
      continue;
    }
    current.lines.push(line);
  }
  if (current) branches.push(current);
  return branches;
}

function randomDrops(input: {
  assignment: RandomAssignment;
  lines: string[];
  npc: LostCityConfigEntry;
  objects: LostCityConfigCatalog;
  params: LostCityConfigCatalog;
  issues: LostCityLootExtractionIssue[];
  exclusions: LostCityLootExtractionExclusion[];
}): DropEntry[] {
  const branches = thresholdBranches(
    input.lines.slice(input.assignment.lineIndex + 1),
    input.assignment.variable
  );
  if (!branches.length) {
    input.issues.push({
      code: "random_chain_missing",
      message: "Random assignment has no supported threshold chain."
    });
    return [];
  }
  const loot: DropEntry[] = [];
  let previousThreshold = 0;
  for (const branch of branches) {
    const threshold = Math.min(branch.threshold, input.assignment.denominator);
    const weight = threshold - previousThreshold;
    previousThreshold = threshold;
    if (weight <= 0 || threshold > input.assignment.denominator) {
      input.issues.push({
        code: "unsupported_handler_statement",
        message: "Random threshold chain is not strictly increasing within its denominator."
      });
      continue;
    }
    if (branch.condition) {
      input.exclusions.push({
        code: "quest_gated_drop",
        message: "Quest-gated weighted drop is outside the current snapshot scope."
      });
      continue;
    }
    if (branch.lines.some((line) => /random(?:inc)?\(/.test(line))) {
      input.issues.push({
        code: "unsupported_drop_condition",
        message: "Nested random branch requires review."
      });
    }
    const drops = branch.lines.flatMap((line) => {
      const call = parseDropCall(line);
      if (!call) return [];
      const drop = dropFromCall({
        ...input,
        call,
        chance: weight / input.assignment.denominator
      });
      return drop ? [drop] : [];
    });
    if (drops.length === 1) loot.push(drops[0]);
    else if (drops.length > 1) loot.push(drops);
    else if (branch.lines.some((line) => line && !/^[{}]$/.test(line))) {
      input.issues.push({
        code: "unsupported_handler_statement",
        message: "Random branch does not contain a supported object drop."
      });
    }
  }
  return loot;
}

export function extractLostCityMonsterLootSource(input: {
  runtimeId: string;
  npcs: LostCityConfigCatalog;
  objects: LostCityConfigCatalog;
  params: LostCityConfigCatalog;
  handlers: LostCityLootHandlerCatalog;
}): LostCityMonsterLootSource {
  const sourceId = lostCityMonsterSourceId(input.runtimeId);
  const npc = input.npcs.entries.get(sourceId);
  if (!npc) throw new Error(`LostCity NPC mapping for ${input.runtimeId} is unresolved.`);
  const resolution = resolveLostCityLootHandler(sourceId, npc, input.handlers);
  const defaultDrop = resolvedConfigParamValue(npc, input.params, "death_drop");
  if (!resolution) {
    if (!defaultDrop) {
      const explicitDefaultDrop = configParamValue(npc, "death_drop");
      if (explicitDefaultDrop === "null") {
        return {
          runtimeId: input.runtimeId,
          sourceId,
          sourceRef: npc.sourceRef,
          status: "complete",
          loot: [],
          issues: [],
          exclusions: []
        };
      }
      return {
        runtimeId: input.runtimeId,
        sourceId,
        sourceRef: npc.sourceRef,
        status: "unsupported",
        loot: [],
        issues: [{ code: "no_declared_drop", message: "No handler or default death drop." }],
        exclusions: []
      };
    }
    const issues: LostCityLootExtractionIssue[] = [];
    const exclusions: LostCityLootExtractionExclusion[] = [];
    const drop = dropFromCall({
      call: { itemExpression: defaultDrop, quantityExpression: "1" },
      chance: 1,
      npc,
      objects: input.objects,
      params: input.params,
      issues
    });
    return {
      runtimeId: input.runtimeId,
      sourceId,
      sourceRef: npc.sourceRef,
      status: issues.length ? "partial" : "complete",
      loot: drop ? [drop] : [],
      issues,
      exclusions
    };
  }

  const block = lostCityLootHandlerBlock(resolution, input.handlers);
  const delegatedProcedureLines = randomAssignment(block.lines)
    ? []
    : block.lines.flatMap((line) => {
        const procedureId = line.trim().match(/^~([A-Za-z0-9_]+);$/)?.[1];
        const procedure = procedureId
          ? lostCityRuneScriptBlock(input.handlers, "proc", procedureId)
          : undefined;
        return procedure && randomAssignment(procedure.lines) ? procedure.lines : [];
      });
  const lines = [...block.lines, ...delegatedProcedureLines];
  const issues: LostCityLootExtractionIssue[] = [];
  const exclusions: LostCityLootExtractionExclusion[] = lines
    .filter((line) => /~trail_(?:easy|medium|hard)cluedrop\(/.test(line))
    .map(() => ({
      code: "tertiary_clue_drop" as const,
      message: "Clue-scroll tertiary expected value is outside the current snapshot scope."
    }));
  const assignment = randomAssignment(lines);
  const direct = directDropsBeforeRandom({
    lines,
    end: assignment?.lineIndex ?? lines.length,
    npc,
    objects: input.objects,
    params: input.params,
    issues,
    exclusions
  });
  const random = assignment
    ? randomDrops({
        assignment,
        lines,
        npc,
        objects: input.objects,
        params: input.params,
        issues,
        exclusions
      })
    : [];
  return {
    runtimeId: input.runtimeId,
    sourceId,
    sourceRef: block.sourceRef,
    status: issues.length ? (direct.length || random.length ? "partial" : "unsupported") : "complete",
    loot: [...direct, ...random],
    issues,
    exclusions
  };
}
