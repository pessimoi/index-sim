import { useEffect, useId, useMemo, useRef, useState } from "react";
import type { ChangeEvent, KeyboardEvent } from "react";
import {
  assertNumericFieldConstraints,
  canonicalNumericDraft,
  numericCommitMessage,
  validateNumericDraft,
  type NumericFieldConstraints
} from "./numeric-field-core";

type NumericFieldValue = number | null;
type NumericFeedback =
  | { kind: "error"; message: string }
  | { kind: "external"; message: "Value updated by another action." }
  | null;

export interface NumericDraftFieldInput {
  value: NumericFieldValue;
  onChange(value: NumericFieldValue): void;
  constraints: NumericFieldConstraints;
  disabled: boolean;
  hasDescription: boolean;
}

export function useNumericDraftField({
  value,
  onChange,
  constraints: rawConstraints,
  disabled,
  hasDescription
}: NumericDraftFieldInput) {
  const { kind, min, max, step, optional } = rawConstraints;
  const constraints = useMemo(
    () => ({ kind, min, max, step, optional }),
    [kind, max, min, optional, step]
  );
  assertNumericFieldConstraints(constraints);

  const descriptionId = useId();
  const feedbackId = useId();
  const [draft, setDraft] = useState(() => canonicalNumericDraft(value));
  const [feedback, setFeedback] = useState<NumericFeedback>(null);
  const focusedRef = useRef(false);
  const lastEmittedRef = useRef<NumericFieldValue>(value);
  const previousValueRef = useRef<NumericFieldValue>(value);
  const previousDisabledRef = useRef(disabled);
  const constraintsKey = `${constraints.kind}:${constraints.min}:${constraints.max}:${constraints.step ?? "none"}:${constraints.optional}`;
  const previousConstraintsKeyRef = useRef(constraintsKey);

  useEffect(() => {
    const valueChanged = !Object.is(previousValueRef.current, value);
    const disabledChanged = previousDisabledRef.current !== disabled;
    const constraintsChanged = previousConstraintsKeyRef.current !== constraintsKey;
    previousValueRef.current = value;
    previousDisabledRef.current = disabled;
    previousConstraintsKeyRef.current = constraintsKey;

    if (disabled) {
      if (valueChanged || disabledChanged) {
        setDraft(canonicalNumericDraft(value));
        setFeedback(null);
        lastEmittedRef.current = value;
      }
      return;
    }
    if (valueChanged) {
      if (focusedRef.current && Object.is(value, lastEmittedRef.current)) return;
      setDraft(canonicalNumericDraft(value));
      setFeedback(
        focusedRef.current
          ? { kind: "external", message: "Value updated by another action." }
          : null
      );
      lastEmittedRef.current = value;
      return;
    }
    if (disabledChanged) {
      setDraft(canonicalNumericDraft(value));
      setFeedback(null);
      lastEmittedRef.current = value;
      return;
    }
    if (constraintsChanged) {
      const result = validateNumericDraft(draft, constraints);
      setFeedback(result.status === "invalid" ? { kind: "error", message: result.message } : null);
    }
  }, [constraints, constraintsKey, disabled, draft, value]);

  const emit = (nextValue: NumericFieldValue): void => {
    if (Object.is(lastEmittedRef.current, nextValue)) return;
    lastEmittedRef.current = nextValue;
    onChange(nextValue);
  };

  const commit = (): void => {
    const result = validateNumericDraft(draft, constraints);
    if (result.status === "accepted") {
      emit(result.value);
      setDraft(result.canonical);
      setFeedback(null);
      return;
    }
    setFeedback({
      kind: "error",
      message: result.status === "invalid" ? result.message : numericCommitMessage(constraints)
    });
  };

  const handleChange = (event: ChangeEvent<HTMLInputElement>): void => {
    const nextDraft = event.currentTarget.value;
    setDraft(nextDraft);
    const result = validateNumericDraft(nextDraft, constraints);
    if (result.status === "accepted" && result.value !== null) emit(result.value);
    setFeedback(result.status === "invalid" ? { kind: "error", message: result.message } : null);
  };

  const handleFocus = (): void => {
    focusedRef.current = true;
    lastEmittedRef.current = value;
    setDraft(canonicalNumericDraft(value));
    setFeedback(null);
  };

  const handleBlur = (): void => {
    focusedRef.current = false;
    if (disabled) {
      setDraft(canonicalNumericDraft(value));
      setFeedback(null);
      return;
    }
    commit();
  };

  const handleKeyDown = (event: KeyboardEvent<HTMLInputElement>): void => {
    if (event.key === "Enter") {
      event.preventDefault();
      commit();
    }
    if (event.key === "Escape") {
      event.preventDefault();
      lastEmittedRef.current = value;
      setDraft(canonicalNumericDraft(value));
      setFeedback(null);
    }
  };

  const resetOptional = (): void => {
    setDraft("");
    setFeedback(null);
    emit(null);
  };

  const describedBy = [hasDescription ? descriptionId : null, feedback ? feedbackId : null]
    .filter((id): id is string => id !== null)
    .join(" ");

  return {
    draft,
    feedback,
    descriptionId,
    feedbackId,
    describedBy: describedBy || undefined,
    invalid: feedback?.kind === "error",
    handleChange,
    handleFocus,
    handleBlur,
    handleKeyDown,
    resetOptional
  };
}
