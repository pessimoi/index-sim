import { z } from "zod";

export const DENSE_COMPARE_SORT_KEYS = [
  "monsterName",
  "hitChance",
  "maxHit",
  "dps",
  "ttkSec",
  "killsPerHour",
  "xpPerHour",
  "gpPerKill",
  "gpPerHour",
  "netGpPerHour"
] as const;

export const DENSE_COMPARE_SORT_DIRECTIONS = ["asc", "desc"] as const;
const MAX_DENSE_COMPARE_FILTER_LENGTH = 80;
const MAX_IRRELEVANT_MONSTER_IDS = 500;

export const DenseCompareSortKeySchema = z.enum(DENSE_COMPARE_SORT_KEYS);
export const DenseCompareSortDirectionSchema = z.enum(DENSE_COMPARE_SORT_DIRECTIONS);
const DenseCompareFilterTextSchema = z
  .string()
  .catch("")
  .default("")
  .transform((value) => value.trim().slice(0, MAX_DENSE_COMPARE_FILTER_LENGTH));
const IrrelevantMonsterIdsSchema = z
  .array(z.string().max(80).catch(""))
  .max(MAX_IRRELEVANT_MONSTER_IDS)
  .catch([])
  .default([])
  .transform((ids) =>
    Array.from(new Set(ids.map((id) => id.trim()).filter(Boolean))).slice(
      0,
      MAX_IRRELEVANT_MONSTER_IDS
    )
  );

export const DenseCompareSortStateSchema = z
  .object({
    key: DenseCompareSortKeySchema,
    direction: DenseCompareSortDirectionSchema
  })
  .strict();

export type DenseCompareSortKey = z.infer<typeof DenseCompareSortKeySchema>;
export type DenseCompareSortState = z.infer<typeof DenseCompareSortStateSchema>;

export const DEFAULT_DENSE_COMPARE_SORT_STATE: DenseCompareSortState = {
  key: "xpPerHour",
  direction: "desc"
};

export const DEFAULT_DENSE_COMPARE_STATE = {
  sort: DEFAULT_DENSE_COMPARE_SORT_STATE,
  monsterFilter: "",
  dropFilter: "",
  showIrrelevant: false,
  irrelevantMonsterIds: [] as string[]
};

export const DenseCompareUiStateSchema = z
  .object({
    sort: DenseCompareSortStateSchema.catch(DEFAULT_DENSE_COMPARE_SORT_STATE).default(
      DEFAULT_DENSE_COMPARE_SORT_STATE
    ),
    monsterFilter: DenseCompareFilterTextSchema,
    dropFilter: DenseCompareFilterTextSchema,
    showIrrelevant: z.boolean().catch(false).default(false),
    irrelevantMonsterIds: IrrelevantMonsterIdsSchema
  })
  .strict()
  .catch(DEFAULT_DENSE_COMPARE_STATE)
  .default(DEFAULT_DENSE_COMPARE_STATE);

export type DenseCompareUiState = z.infer<typeof DenseCompareUiStateSchema>;

export function normalizeDenseCompareSortState(input: unknown): DenseCompareSortState {
  const result = DenseCompareSortStateSchema.safeParse(input);
  return result.success ? result.data : DEFAULT_DENSE_COMPARE_SORT_STATE;
}

export function normalizeDenseCompareUiState(input: unknown): DenseCompareUiState {
  const stateResult = DenseCompareUiStateSchema.safeParse(input);
  if (stateResult.success) return stateResult.data;
  const sortResult = DenseCompareSortStateSchema.safeParse(input);
  return {
    ...DEFAULT_DENSE_COMPARE_STATE,
    sort: sortResult.success ? sortResult.data : DEFAULT_DENSE_COMPARE_SORT_STATE
  };
}

export function cleanDenseCompareStateForMonsterIds(
  state: DenseCompareUiState,
  validMonsterIds: Iterable<string>
): DenseCompareUiState {
  const valid = new Set(validMonsterIds);
  const irrelevantMonsterIds = state.irrelevantMonsterIds.filter((monsterId) =>
    valid.has(monsterId)
  );
  return irrelevantMonsterIds.length === state.irrelevantMonsterIds.length
    ? state
    : { ...state, irrelevantMonsterIds };
}

export function resetDenseCompareFilters(state: DenseCompareUiState): DenseCompareUiState {
  return {
    ...state,
    monsterFilter: "",
    dropFilter: "",
    showIrrelevant: false
  };
}

export function toggleDenseCompareMonsterIrrelevant(
  state: DenseCompareUiState,
  monsterId: string
): DenseCompareUiState {
  if (!monsterId) return state;
  const ids = new Set(state.irrelevantMonsterIds);
  if (ids.has(monsterId)) {
    ids.delete(monsterId);
  } else if (ids.size < MAX_IRRELEVANT_MONSTER_IDS) {
    ids.add(monsterId);
  }
  return {
    ...state,
    irrelevantMonsterIds: Array.from(ids).sort((left, right) => left.localeCompare(right))
  };
}

export function nextDenseCompareSortState(
  current: unknown,
  key: DenseCompareSortKey
): DenseCompareSortState {
  const normalized = normalizeDenseCompareSortState(current);
  if (normalized.key !== key) {
    return { key, direction: key === "monsterName" ? "asc" : "desc" };
  }
  return { key, direction: normalized.direction === "asc" ? "desc" : "asc" };
}
