export const NUMERIC_DRAFT_MAX_LENGTH = 64;

export interface NumericFieldConstraints {
  kind: "integer" | "decimal";
  min: number;
  max: number;
  step?: number;
  optional: boolean;
}

export type NumericDraftResult =
  | { status: "transitional" }
  | { status: "accepted"; value: number | null; canonical: string }
  | {
      status: "invalid";
      reason: "syntax" | "too-long" | "below-min" | "above-max" | "step";
      message: string;
    };

function constraintNumber(value: number): string {
  return String(value);
}

export function assertNumericFieldConstraints(constraints: NumericFieldConstraints): void {
  if (!Number.isFinite(constraints.min) || !Number.isFinite(constraints.max)) {
    throw new Error("Numeric field bounds must be finite");
  }
  if (constraints.min > constraints.max) {
    throw new Error("Numeric field minimum must not exceed maximum");
  }
  if (
    constraints.step !== undefined &&
    (!Number.isFinite(constraints.step) || constraints.step <= 0)
  ) {
    throw new Error("Numeric field step must be a positive finite number");
  }
}

export function numericCommitMessage(constraints: NumericFieldConstraints): string {
  return `Not applied — enter a value from ${constraintNumber(constraints.min)} to ${constraintNumber(constraints.max)}.`;
}

function syntaxMessage(kind: NumericFieldConstraints["kind"]): string {
  return kind === "integer"
    ? "Not applied — enter a whole number."
    : "Not applied — enter a number using a decimal point.";
}

function isTransitionalDraft(draft: string, constraints: NumericFieldConstraints): boolean {
  if (draft === "") return !constraints.optional;
  const negativeAllowed = constraints.min < 0;
  if (draft === "-") return negativeAllowed;
  if (constraints.kind !== "decimal") return false;
  if (draft === "." || draft === "-.") return draft === "." || negativeAllowed;
  return /^-?[0-9]+\.$/.test(draft) && (negativeAllowed || !draft.startsWith("-"));
}

export function validateNumericDraft(
  draft: string,
  constraints: NumericFieldConstraints
): NumericDraftResult {
  assertNumericFieldConstraints(constraints);
  if (draft.length > NUMERIC_DRAFT_MAX_LENGTH) {
    return {
      status: "invalid",
      reason: "too-long",
      message: "Not applied — value is too long."
    };
  }
  if (draft === "" && constraints.optional) {
    return { status: "accepted", value: null, canonical: "" };
  }
  if (isTransitionalDraft(draft, constraints)) return { status: "transitional" };

  const syntax =
    constraints.kind === "integer" ? /^-?[0-9]+$/ : /^-?(?:[0-9]+(?:\.[0-9]+)?|\.[0-9]+)$/;
  if (!syntax.test(draft) || (draft.startsWith("-") && constraints.min >= 0)) {
    return { status: "invalid", reason: "syntax", message: syntaxMessage(constraints.kind) };
  }

  const value = Number(draft);
  if (!Number.isFinite(value)) {
    return { status: "invalid", reason: "syntax", message: syntaxMessage(constraints.kind) };
  }
  if (value < constraints.min) {
    return {
      status: "invalid",
      reason: "below-min",
      message: `Not applied — minimum is ${constraintNumber(constraints.min)}.`
    };
  }
  if (value > constraints.max) {
    return {
      status: "invalid",
      reason: "above-max",
      message: `Not applied — maximum is ${constraintNumber(constraints.max)}.`
    };
  }
  if (constraints.step !== undefined) {
    const quotient = (value - constraints.min) / constraints.step;
    if (Math.abs(quotient - Math.round(quotient)) > 1e-9) {
      return {
        status: "invalid",
        reason: "step",
        message: `Not applied — use increments of ${constraintNumber(constraints.step)}.`
      };
    }
  }
  return { status: "accepted", value, canonical: String(value) };
}

export function canonicalNumericDraft(value: number | null): string {
  return value === null ? "" : String(value);
}
