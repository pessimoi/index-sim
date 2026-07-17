import type { EntityId, SimulationWarning } from "@/domain/shared";

export interface SelectOptionViewModel {
  id: EntityId;
  label: string;
  hint?: string;
}

export interface CalculationWarningViewModel {
  code: string;
  severity: SimulationWarning["severity"];
  message: string;
  itemId?: EntityId;
  priceContext?: SimulationWarning["priceContext"];
}

export interface InlineNoticeViewModel {
  tone: "success" | "error";
  message: string;
  details?: string[];
}
