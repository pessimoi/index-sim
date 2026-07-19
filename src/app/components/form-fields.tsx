import { useEffect, useId, useRef, useState, type KeyboardEvent, type Ref } from "react";
import type { SetupSelectionOption } from "../state/ui-state";
import { formatNumber } from "../view-models/formatting";
import { expandedCompactLabel } from "../view-models/presentation-language";
import { useNumericDraftField } from "./use-numeric-draft-field";

export type SelectOption = { id: string; label: string; hint?: string };

export function SelectField({
  label,
  value,
  options,
  onChange,
  disabled = false,
  className,
  accessibleLabel
}: {
  label: string;
  value: string;
  options: Array<{ id: string; label: string }>;
  onChange: (value: string) => void;
  disabled?: boolean;
  className?: string;
  accessibleLabel?: string;
}) {
  const id = useId();
  const selectedLabel = options.find((option) => option.id === value)?.label ?? value;
  const resolvedAccessibleLabel = accessibleLabel ?? expandedCompactLabel(label) ?? undefined;
  return (
    <div className={`field ${className ?? ""}`.trim()}>
      <label htmlFor={id}>{label}</label>
      <select
        id={id}
        value={value}
        title={selectedLabel}
        aria-label={resolvedAccessibleLabel}
        disabled={disabled}
        onChange={(event) => onChange(event.target.value)}
      >
        {options.map((option) => (
          <option key={option.id} value={option.id}>
            {option.label}
          </option>
        ))}
      </select>
    </div>
  );
}

export function CompactSelectionSelectField({
  label,
  value,
  options,
  extraCount,
  onChange
}: {
  label: string;
  value: string;
  options: Array<{ id: string; label: string }>;
  extraCount: number;
  onChange: (value: string) => void;
}) {
  const id = useId();
  const selectedLabel = options.find((option) => option.id === value)?.label ?? value;
  return (
    <div className="field compact-selection-field">
      <label htmlFor={id}>{label}</label>
      <div className="compact-selection-control">
        <select
          id={id}
          value={value}
          title={selectedLabel}
          onChange={(event) => onChange(event.target.value)}
        >
          {options.map((option) => (
            <option key={option.id} value={option.id}>
              {option.label}
            </option>
          ))}
        </select>
        {extraCount > 0 && (
          <span className="selection-extra-badge" aria-label={`${extraCount} additional active`}>
            +{formatNumber(extraCount)}
          </span>
        )}
      </div>
    </div>
  );
}

export function MultiSelectionField({
  label,
  options,
  selectedIds,
  onToggle
}: {
  label: string;
  options: readonly SetupSelectionOption[];
  selectedIds: readonly string[];
  onToggle: (id: string, selected: boolean) => void;
}) {
  const selectedCount = selectedIds.length;
  return (
    <div className="selection-toggle-group">
      <div className="selection-toggle-header">
        <span>{label}</span>
        <span className={`status-pill ${selectedCount ? "ready" : ""}`}>
          {selectedCount ? `${formatNumber(selectedCount)} active` : "None"}
        </span>
      </div>
      <div className="multi-selection-grid" aria-label={`${label} selections`}>
        <label className="toggle">
          <input
            type="checkbox"
            checked={selectedCount === 0}
            onChange={(event) => onToggle("none", event.target.checked)}
          />
          <span>None</span>
        </label>
        {options.map((option) => (
          <label className="toggle selection-toggle" key={option.id}>
            <input
              type="checkbox"
              checked={selectedIds.includes(option.id)}
              onChange={(event) => onToggle(option.id, event.target.checked)}
            />
            <span>{option.label}</span>
            <small>{option.categoryLabel}</small>
          </label>
        ))}
      </div>
    </div>
  );
}

export function SearchableSelectField({
  label,
  value,
  options,
  onChange,
  disabled = false,
  searchPlaceholder = "Search",
  className,
  accessibleLabel
}: {
  label: string;
  value: string;
  options: SelectOption[];
  onChange: (value: string) => void;
  disabled?: boolean;
  searchPlaceholder?: string;
  className?: string;
  accessibleLabel?: string;
}) {
  const labelId = useId();
  const triggerId = useId();
  const listboxId = useId();
  const triggerRef = useRef<HTMLButtonElement>(null);
  const searchInputRef = useRef<HTMLInputElement>(null);
  const optionRefs = useRef<Array<HTMLButtonElement | null>>([]);
  const [expanded, setExpanded] = useState(false);
  const [query, setQuery] = useState("");
  const [activeIndex, setActiveIndex] = useState(0);
  const normalizedQuery = query.trim().toLocaleLowerCase();
  const selectedOption = options.find((option) => option.id === value);
  const selectedLabel = selectedOption?.label ?? value;
  const resolvedAccessibleLabel = accessibleLabel ?? expandedCompactLabel(label) ?? undefined;
  const filteredOptions =
    normalizedQuery.length === 0
      ? options
      : options.filter((option) =>
          [option.label, option.id, option.hint ?? ""]
            .join(" ")
            .toLocaleLowerCase()
            .includes(normalizedQuery)
        );
  const boundedActiveIndex = Math.max(
    0,
    Math.min(activeIndex, Math.max(0, filteredOptions.length - 1))
  );
  const activeOption = filteredOptions[boundedActiveIndex];

  useEffect(() => {
    if (expanded) searchInputRef.current?.focus();
  }, [expanded]);

  useEffect(() => {
    if (!expanded) return;
    optionRefs.current[boundedActiveIndex]?.scrollIntoView({ block: "nearest" });
  }, [boundedActiveIndex, expanded]);

  const openOptions = () => {
    if (disabled) return;
    setQuery("");
    setActiveIndex(
      Math.max(
        0,
        options.findIndex((option) => option.id === value)
      )
    );
    setExpanded(true);
  };

  const closeOptions = (restoreTriggerFocus = false) => {
    setExpanded(false);
    setQuery("");
    if (restoreTriggerFocus) triggerRef.current?.focus();
  };

  const commitOption = (option: SelectOption) => {
    onChange(option.id);
    setQuery("");
    setExpanded(false);
    triggerRef.current?.focus();
  };

  const handleSearchKeyDown = (event: KeyboardEvent<HTMLInputElement>) => {
    if (event.key === "ArrowDown") {
      event.preventDefault();
      setActiveIndex((current) => Math.min(current + 1, filteredOptions.length - 1));
      return;
    }
    if (event.key === "ArrowUp") {
      event.preventDefault();
      setActiveIndex((current) => Math.max(0, current - 1));
      return;
    }
    if (event.key === "Home") {
      event.preventDefault();
      setActiveIndex(0);
      return;
    }
    if (event.key === "End") {
      event.preventDefault();
      setActiveIndex(Math.max(0, filteredOptions.length - 1));
      return;
    }
    if (event.key === "Enter" && activeOption) {
      event.preventDefault();
      commitOption(activeOption);
      return;
    }
    if (event.key === "Escape") {
      event.preventDefault();
      closeOptions(true);
    }
  };

  return (
    <div
      className={`field searchable-field ${expanded ? "expanded" : ""} ${className ?? ""}`.trim()}
      onBlur={(event) => {
        if (!event.currentTarget.contains(event.relatedTarget as Node | null)) closeOptions();
      }}
    >
      <label id={labelId}>{label}</label>
      <button
        ref={triggerRef}
        id={triggerId}
        type="button"
        role="combobox"
        className="searchable-combobox-trigger"
        title={selectedLabel}
        aria-label={resolvedAccessibleLabel}
        aria-labelledby={resolvedAccessibleLabel ? undefined : labelId}
        aria-controls={listboxId}
        aria-expanded={expanded}
        aria-haspopup="listbox"
        data-selected-id={value}
        disabled={disabled}
        onClick={() => (expanded ? closeOptions() : openOptions())}
        onKeyDown={(event) => {
          if (event.key === "ArrowDown" || event.key === "ArrowUp") {
            event.preventDefault();
            openOptions();
          }
          if (event.key === "Escape" && expanded) {
            event.preventDefault();
            closeOptions(true);
          }
        }}
      >
        <span>{selectedLabel}</span>
        <span aria-hidden="true">{expanded ? "▲" : "▼"}</span>
      </button>
      {expanded && (
        <div className="searchable-combobox-popover">
          <div className="searchable-combobox-search">
            <input
              ref={searchInputRef}
              type="search"
              value={query}
              placeholder={searchPlaceholder}
              autoComplete="off"
              aria-label={`Search ${label} options`}
              aria-controls={listboxId}
              aria-activedescendant={
                activeOption ? `${listboxId}-option-${boundedActiveIndex}` : undefined
              }
              onChange={(event) => {
                setQuery(event.target.value);
                setActiveIndex(0);
              }}
              onKeyDown={handleSearchKeyDown}
            />
            <span className="searchable-combobox-status" role="status" aria-live="polite">
              {formatNumber(filteredOptions.length)} of {formatNumber(options.length)} options
            </span>
          </div>
          <div
            id={listboxId}
            className="searchable-combobox-list"
            role="listbox"
            aria-label={`${label} options`}
          >
            {filteredOptions.length ? (
              filteredOptions.map((option, index) => (
                <button
                  ref={(element) => {
                    optionRefs.current[index] = element;
                  }}
                  id={`${listboxId}-option-${index}`}
                  type="button"
                  role="option"
                  className={`searchable-combobox-option ${index === boundedActiveIndex ? "active" : ""}`}
                  aria-label={option.label}
                  aria-selected={option.id === value}
                  key={option.id}
                  onMouseDown={(event) => event.preventDefault()}
                  onClick={() => commitOption(option)}
                >
                  <span>{option.label}</span>
                  {option.hint && <small aria-hidden="true">{option.hint}</small>}
                  {option.id === value && <em aria-hidden="true">Selected</em>}
                </button>
              ))
            ) : (
              <p className="searchable-combobox-empty">No matching options</p>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

export function NumberField({
  label,
  value,
  onChange,
  min = 1,
  max = 99,
  disabled = false,
  description,
  accessibleLabel
}: {
  label: string;
  value: number;
  onChange: (value: number) => void;
  min?: number;
  max?: number;
  disabled?: boolean;
  description?: string;
  accessibleLabel?: string;
}) {
  const id = useId();
  const resolvedAccessibleLabel = accessibleLabel ?? expandedCompactLabel(label) ?? undefined;
  const field = useNumericDraftField({
    value,
    onChange: (nextValue) => {
      if (nextValue !== null) onChange(nextValue);
    },
    constraints: { kind: "integer", min, max, step: 1, optional: false },
    disabled,
    hasDescription: description != null
  });
  return (
    <div className="field">
      <label htmlFor={id}>{label}</label>
      <input
        id={id}
        type="text"
        inputMode={min < 0 ? "decimal" : "numeric"}
        min={min}
        max={max}
        step={1}
        disabled={disabled}
        value={field.draft}
        aria-label={resolvedAccessibleLabel}
        aria-invalid={field.invalid || undefined}
        aria-describedby={field.describedBy}
        onChange={field.handleChange}
        onFocus={field.handleFocus}
        onBlur={field.handleBlur}
        onKeyDown={field.handleKeyDown}
      />
      {description && (
        <p id={field.descriptionId} className="numeric-field-description">
          {description}
        </p>
      )}
      {field.feedback && (
        <p
          id={field.feedbackId}
          className={`numeric-field-feedback ${field.feedback.kind}`}
          role={field.feedback.kind === "external" ? "status" : undefined}
          aria-live={field.feedback.kind === "external" ? "polite" : undefined}
        >
          {field.feedback.message}
        </p>
      )}
    </div>
  );
}

export function DecimalField({
  label,
  value,
  onChange,
  min = 0,
  max = 999,
  step = 0.05,
  disabled = false,
  description,
  inputRef,
  accessibleLabel
}: {
  label: string;
  value: number;
  onChange: (value: number) => void;
  min?: number;
  max?: number;
  step?: number;
  disabled?: boolean;
  description?: string;
  inputRef?: Ref<HTMLInputElement>;
  accessibleLabel?: string;
}) {
  const id = useId();
  const resolvedAccessibleLabel = accessibleLabel ?? expandedCompactLabel(label) ?? undefined;
  const field = useNumericDraftField({
    value,
    onChange: (nextValue) => {
      if (nextValue !== null) onChange(nextValue);
    },
    constraints: { kind: "decimal", min, max, step, optional: false },
    disabled,
    hasDescription: description != null
  });
  return (
    <div className="field">
      <label htmlFor={id}>{label}</label>
      <input
        ref={inputRef}
        id={id}
        type="text"
        inputMode="decimal"
        min={min}
        max={max}
        step={step}
        disabled={disabled}
        value={field.draft}
        aria-label={resolvedAccessibleLabel}
        aria-invalid={field.invalid || undefined}
        aria-describedby={field.describedBy}
        onChange={field.handleChange}
        onFocus={field.handleFocus}
        onBlur={field.handleBlur}
        onKeyDown={field.handleKeyDown}
      />
      {description && (
        <p id={field.descriptionId} className="numeric-field-description">
          {description}
        </p>
      )}
      {field.feedback && (
        <p
          id={field.feedbackId}
          className={`numeric-field-feedback ${field.feedback.kind}`}
          role={field.feedback.kind === "external" ? "status" : undefined}
          aria-live={field.feedback.kind === "external" ? "polite" : undefined}
        >
          {field.feedback.message}
        </p>
      )}
    </div>
  );
}

export function OptionalNumberField({
  label,
  value,
  onChange,
  min,
  max,
  step = 1,
  placeholder,
  resetLabel = "Reset",
  compactReset = false,
  disabled = false,
  description,
  accessibleLabel
}: {
  label: string;
  value: number | null;
  onChange: (value: number | null) => void;
  min: number;
  max: number;
  step?: number;
  placeholder?: string;
  resetLabel?: string;
  compactReset?: boolean;
  disabled?: boolean;
  description?: string;
  accessibleLabel?: string;
}) {
  const id = useId();
  const resolvedAccessibleLabel = accessibleLabel ?? expandedCompactLabel(label) ?? undefined;
  const field = useNumericDraftField({
    value,
    onChange,
    constraints: {
      kind: step === 1 ? "integer" : "decimal",
      min,
      max,
      step,
      optional: true
    },
    disabled,
    hasDescription: description != null
  });
  return (
    <div className={`field optional-number-field ${compactReset ? "compact" : ""}`.trim()}>
      <label htmlFor={id}>{label}</label>
      <div className="optional-number-control">
        <input
          id={id}
          type="text"
          inputMode={step === 1 && min >= 0 ? "numeric" : "decimal"}
          min={min}
          max={max}
          step={step}
          disabled={disabled}
          value={field.draft}
          placeholder={placeholder}
          aria-label={resolvedAccessibleLabel}
          aria-invalid={field.invalid || undefined}
          aria-describedby={field.describedBy}
          onChange={field.handleChange}
          onFocus={field.handleFocus}
          onBlur={field.handleBlur}
          onKeyDown={field.handleKeyDown}
        />
        <button
          type="button"
          aria-label={compactReset ? `${resetLabel} ${label}` : undefined}
          title={compactReset ? `${resetLabel} ${label} to derived value` : undefined}
          disabled={disabled || value == null}
          onMouseDown={(event) => event.preventDefault()}
          onClick={field.resetOptional}
        >
          {compactReset ? "↺" : resetLabel}
        </button>
      </div>
      {description && (
        <p id={field.descriptionId} className="numeric-field-description">
          {description}
        </p>
      )}
      {field.feedback && (
        <p
          id={field.feedbackId}
          className={`numeric-field-feedback ${field.feedback.kind}`}
          role={field.feedback.kind === "external" ? "status" : undefined}
          aria-live={field.feedback.kind === "external" ? "polite" : undefined}
        >
          {field.feedback.message}
        </p>
      )}
    </div>
  );
}

export function ReadOnlyField({
  label,
  value,
  disabled = false,
  accessibleLabel
}: {
  label: string;
  value: string;
  disabled?: boolean;
  accessibleLabel?: string;
}) {
  const labelId = useId();
  const resolvedAccessibleLabel = accessibleLabel ?? expandedCompactLabel(label) ?? undefined;
  return (
    <div className={`field readonly-field ${disabled ? "disabled" : ""}`}>
      <span id={labelId} aria-hidden={resolvedAccessibleLabel ? true : undefined}>
        {label}
      </span>
      <output
        aria-label={resolvedAccessibleLabel ? `${resolvedAccessibleLabel}: ${value}` : undefined}
        aria-labelledby={resolvedAccessibleLabel ? undefined : labelId}
      >
        {value}
      </output>
    </div>
  );
}
