const MONEY_WARNING_CODE_VALUES = [
  "missing-price",
  "missing-alch-value",
  "price-alias-used",
  "price-fallback-used",
  "price-generated-fallback",
  "price-market-retained",
  "price-freshness-unknown",
  "approximate-data-source",
  "unidentified-herb-price-approximation"
] as const;

const PRICE_ISSUE_WARNING_CODE_VALUES = [
  "missing-price",
  "missing-alch-value",
  "price-fallback-used"
] as const;

const MONEY_WARNING_CODES = new Set<string>(MONEY_WARNING_CODE_VALUES);
const PRICE_ISSUE_WARNING_CODES = new Set<string>(PRICE_ISSUE_WARNING_CODE_VALUES);

export const PRICE_WARNING_PRIORITY: Readonly<Record<string, number>> = {
  "missing-price": 0,
  "missing-alch-value": 1,
  "price-fallback-used": 2,
  "price-generated-fallback": 3,
  "price-market-retained": 4,
  "price-freshness-unknown": 5,
  "price-alias-used": 6,
  "approximate-data-source": 7,
  "unidentified-herb-price-approximation": 8
};

export function normalizeWarningMessage(message: string): string {
  return message.replace(/\s+/g, " ").trim().slice(0, 240);
}

export function isMoneyWarningCode(code: string): boolean {
  return MONEY_WARNING_CODES.has(code);
}

export function isPriceIssueWarningCode(code: string): boolean {
  return PRICE_ISSUE_WARNING_CODES.has(code);
}

export interface FriendlyPriceWarningCopy {
  summary: string;
  detail: string;
}

export function friendlyPriceWarningCopy(
  code: string,
  itemLabel: string
): FriendlyPriceWarningCopy {
  if (code === "missing-price") {
    return {
      summary: "Missing price",
      detail: `${itemLabel} has no usable price, so its active value is incomplete.`
    };
  }
  if (code === "missing-alch-value") {
    return {
      summary: "Missing alch value",
      detail: `${itemLabel} has no usable alch value for the selected action.`
    };
  }
  if (code === "price-fallback-used") {
    return {
      summary: "Fallback used",
      detail: `${itemLabel} uses a fallback value in the current calculation.`
    };
  }
  if (code === "price-generated-fallback") {
    return {
      summary: "Estimated price",
      detail: `${itemLabel} uses a game-data estimate instead of an observed market price.`
    };
  }
  if (code === "price-market-retained") {
    return {
      summary: "Previous price retained",
      detail: `${itemLabel} keeps its previous accepted price because the latest evaluation could not replace it.`
    };
  }
  if (code === "price-freshness-unknown") {
    return {
      summary: "Price date unknown",
      detail: `${itemLabel} has a usable price but no verified market observation time.`
    };
  }
  if (code === "price-alias-used") {
    return {
      summary: "Related item price",
      detail: `${itemLabel} uses a compatible related-item price because its canonical price is missing.`
    };
  }
  if (code === "unidentified-herb-price-approximation") {
    return {
      summary: "Estimated herb price",
      detail: "Unidentified herbs use a shared proxy where species-specific prices are unavailable."
    };
  }
  return {
    summary: "Approximate source",
    detail: `${itemLabel} uses approximate source data in the current valuation.`
  };
}
