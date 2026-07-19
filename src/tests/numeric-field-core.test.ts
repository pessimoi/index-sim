import {
  NUMERIC_DRAFT_MAX_LENGTH,
  assertNumericFieldConstraints,
  numericCommitMessage,
  validateNumericDraft,
  type NumericFieldConstraints
} from "../app/components/numeric-field-core";

const integer: NumericFieldConstraints = {
  kind: "integer",
  min: 0,
  max: 99,
  step: 1,
  optional: false
};
const decimal: NumericFieldConstraints = {
  kind: "decimal",
  min: 0,
  max: 10,
  step: 0.05,
  optional: false
};

describe("numeric field core", () => {
  it("accepts complete integers and canonicalizes leading zeros", () => {
    expect(validateNumericDraft("0007", integer)).toEqual({
      status: "accepted",
      value: 7,
      canonical: "7"
    });
    expect(validateNumericDraft("0", integer)).toEqual({
      status: "accepted",
      value: 0,
      canonical: "0"
    });
  });

  it("allows a minus transition only when the range permits negatives", () => {
    expect(validateNumericDraft("-", integer)).toMatchObject({
      status: "invalid",
      reason: "syntax"
    });
    expect(validateNumericDraft("-", { ...integer, min: -99 })).toEqual({
      status: "transitional"
    });
    expect(validateNumericDraft("-7", { ...integer, min: -99 })).toMatchObject({
      status: "accepted",
      value: -7
    });
  });

  it.each(["+1", "1.5", "1e2", " 1", "1 ", "0x10", "Infinity", "NaN"])(
    "rejects non-canonical integer syntax %s",
    (draft) => {
      expect(validateNumericDraft(draft, integer)).toEqual({
        status: "invalid",
        reason: "syntax",
        message: "Not applied — enter a whole number."
      });
    }
  );

  it("accepts canonical decimals without collapsing an editing draft", () => {
    expect(validateNumericDraft(".5", decimal)).toEqual({
      status: "accepted",
      value: 0.5,
      canonical: "0.5"
    });
    expect(validateNumericDraft("0.50", decimal)).toEqual({
      status: "accepted",
      value: 0.5,
      canonical: "0.5"
    });
    expect(validateNumericDraft("1.", decimal)).toEqual({ status: "transitional" });
    expect(validateNumericDraft(".", decimal)).toEqual({ status: "transitional" });
  });

  it("rejects off-step decimals instead of rounding them", () => {
    expect(validateNumericDraft("0.53", decimal)).toEqual({
      status: "invalid",
      reason: "step",
      message: "Not applied — use increments of 0.05."
    });
    expect(validateNumericDraft("0.3", { ...decimal, step: 0.1 })).toMatchObject({
      status: "accepted",
      value: 0.3
    });
    expect(validateNumericDraft("0.15", { ...decimal, min: 0.05, step: 0.1 })).toMatchObject({
      status: "accepted",
      value: 0.15
    });
  });

  it("applies inclusive bounds without clamping", () => {
    expect(validateNumericDraft("0", decimal)).toMatchObject({ status: "accepted", value: 0 });
    expect(validateNumericDraft("10", decimal)).toMatchObject({ status: "accepted", value: 10 });
    expect(validateNumericDraft("-0.05", decimal)).toEqual({
      status: "invalid",
      reason: "syntax",
      message: "Not applied — enter a number using a decimal point."
    });
    expect(validateNumericDraft("10.05", decimal)).toEqual({
      status: "invalid",
      reason: "above-max",
      message: "Not applied — maximum is 10."
    });
    expect(validateNumericDraft("4", { ...integer, min: 5 })).toEqual({
      status: "invalid",
      reason: "below-min",
      message: "Not applied — minimum is 5."
    });
  });

  it("keeps required empty transitional but accepts optional empty as null", () => {
    expect(validateNumericDraft("", integer)).toEqual({ status: "transitional" });
    expect(validateNumericDraft("", { ...integer, optional: true })).toEqual({
      status: "accepted",
      value: null,
      canonical: ""
    });
    expect(numericCommitMessage(integer)).toBe("Not applied — enter a value from 0 to 99.");
  });

  it("bounds draft length before syntax or conversion", () => {
    expect(validateNumericDraft("1".repeat(NUMERIC_DRAFT_MAX_LENGTH + 1), integer)).toEqual({
      status: "invalid",
      reason: "too-long",
      message: "Not applied — value is too long."
    });
  });

  it("rejects programmer-invalid constraints", () => {
    expect(() => assertNumericFieldConstraints({ ...integer, min: 2, max: 1 })).toThrow("minimum");
    expect(() => assertNumericFieldConstraints({ ...integer, min: Number.NaN })).toThrow("finite");
    expect(() => assertNumericFieldConstraints({ ...integer, step: 0 })).toThrow("positive");
    expect(() =>
      assertNumericFieldConstraints({ ...integer, step: Number.POSITIVE_INFINITY })
    ).toThrow("positive");
  });
});
