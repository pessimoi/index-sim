import { useEffect, useId, useRef, useState, type KeyboardEvent } from "react";
import type { SetupSelectionOption } from "../state/ui-state";
import { formatNumber } from "../view-models/simulation";

export type SelectOption = { id: string; label: string; hint?: string };

function numberValue(value: string, fallback: number, min = 1, max = 99): number {
  const parsed = Number.parseInt(value, 10);
  if (!Number.isFinite(parsed)) return fallback;
  return Math.max(min, Math.min(max, parsed));
}

function decimalValue(value: string, fallback: number, min = 0, max = 999): number {
  const parsed = Number.parseFloat(value);
  if (!Number.isFinite(parsed)) return fallback;
  return Math.max(min, Math.min(max, parsed));
}

function stepDecimalValue(
  value: string,
  fallback: number,
  min: number,
  max: number,
  step: number
): number {
  const clamped = decimalValue(value, fallback, min, max);
  if (!(step > 0)) return clamped;
  return Number((Math.round(clamped / step) * step).toFixed(6));
}

export function SelectField({
  label,
  value,
  options,
  onChange,
  disabled = false,
  className
}: {
  label: string;
  value: string;
  options: Array<{ id: string; label: string }>;
  onChange: (value: string) => void;
  disabled?: boolean;
  className?: string;
}) {
  const id = useId();
  const selectedLabel = options.find((option) => option.id === value)?.label ?? value;
  return (
    <div className={`field ${className ?? ""}`.trim()}>
      <label htmlFor={id}>{label}</label>
      <select
        id={id}
        value={value}
        title={selectedLabel}
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
  className
}: {
  label: string;
  value: string;
  options: SelectOption[];
  onChange: (value: string) => void;
  disabled?: boolean;
  searchPlaceholder?: string;
  className?: string;
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
        aria-labelledby={labelId}
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
  disabled = false
}: {
  label: string;
  value: number;
  onChange: (value: number) => void;
  min?: number;
  max?: number;
  disabled?: boolean;
}) {
  const id = useId();
  return (
    <div className="field">
      <label htmlFor={id}>{label}</label>
      <input
        id={id}
        type="number"
        min={min}
        max={max}
        disabled={disabled}
        value={value}
        onChange={(event) => onChange(numberValue(event.target.value, value, min, max))}
      />
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
  disabled = false
}: {
  label: string;
  value: number;
  onChange: (value: number) => void;
  min?: number;
  max?: number;
  step?: number;
  disabled?: boolean;
}) {
  const id = useId();
  return (
    <div className="field">
      <label htmlFor={id}>{label}</label>
      <input
        id={id}
        type="number"
        min={min}
        max={max}
        step={step}
        disabled={disabled}
        value={value}
        onChange={(event) => onChange(stepDecimalValue(event.target.value, value, min, max, step))}
      />
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
  compactReset = false
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
}) {
  const id = useId();
  return (
    <div className={`field optional-number-field ${compactReset ? "compact" : ""}`.trim()}>
      <label htmlFor={id}>{label}</label>
      <div className="optional-number-control">
        <input
          id={id}
          type="number"
          min={min}
          max={max}
          step={step}
          value={value ?? ""}
          placeholder={placeholder}
          onChange={(event) => {
            const rawValue = event.target.value;
            if (rawValue.trim() === "") {
              onChange(null);
              return;
            }
            const parsed =
              step === 1 ? numberValue(rawValue, 0, min, max) : decimalValue(rawValue, 0, min, max);
            onChange(parsed);
          }}
        />
        <button
          type="button"
          aria-label={compactReset ? `${resetLabel} ${label}` : undefined}
          title={compactReset ? `${resetLabel} ${label} to derived value` : undefined}
          disabled={value == null}
          onClick={() => onChange(null)}
        >
          {compactReset ? "↺" : resetLabel}
        </button>
      </div>
    </div>
  );
}

export function ReadOnlyField({
  label,
  value,
  disabled = false
}: {
  label: string;
  value: string;
  disabled?: boolean;
}) {
  const labelId = useId();
  return (
    <div className={`field readonly-field ${disabled ? "disabled" : ""}`}>
      <span id={labelId}>{label}</span>
      <output aria-labelledby={labelId}>{value}</output>
    </div>
  );
}
