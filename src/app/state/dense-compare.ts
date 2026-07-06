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

export const DenseCompareSortKeySchema = z.enum(DENSE_COMPARE_SORT_KEYS);
export const DenseCompareSortDirectionSchema = z.enum(DENSE_COMPARE_SORT_DIRECTIONS);

export const DenseCompareSortStateSchema = z
  .object({
    key: DenseCompareSortKeySchema,
    direction: DenseCompareSortDirectionSchema
  })
  .strict();

export type DenseCompareSortKey = z.infer<typeof DenseCompareSortKeySchema>;
export type DenseCompareSortDirection = z.infer<typeof DenseCompareSortDirectionSchema>;
export type DenseCompareSortState = z.infer<typeof DenseCompareSortStateSchema>;

export const DEFAULT_DENSE_COMPARE_SORT_STATE: DenseCompareSortState = {
  key: "xpPerHour",
  direction: "desc"
};

export const DEFAULT_DENSE_COMPARE_STATE = {
  sort: DEFAULT_DENSE_COMPARE_SORT_STATE
} as const;

export const DenseCompareUiStateSchema = z
  .object({
    sort: DenseCompareSortStateSchema.catch(DEFAULT_DENSE_COMPARE_SORT_STATE).default(
      DEFAULT_DENSE_COMPARE_SORT_STATE
    )
  })
  .strict()
  .catch(DEFAULT_DENSE_COMPARE_STATE)
  .default(DEFAULT_DENSE_COMPARE_STATE);

export type DenseCompareUiState = z.infer<typeof DenseCompareUiStateSchema>;

export function normalizeDenseCompareSortState(input: unknown): DenseCompareSortState {
  const result = DenseCompareSortStateSchema.safeParse(input);
  return result.success ? result.data : DEFAULT_DENSE_COMPARE_SORT_STATE;
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
