import { BOOST_SELECTION_OPTIONS, PRAYER_SELECTION_OPTIONS } from "../../state/ui-state";
import { formatNumber } from "../../view-models/formatting";
import type { MonsterCardViewModel } from "../../view-models/monster-card";
import { SearchableSelectField, type SelectOption } from "../form-fields";
import { signedInteger, yesNo } from "../presentation-formatters";
import { formatSemanticUnitValue } from "../../view-models/presentation-language";

export interface MonsterCardPanelProps {
  card: MonsterCardViewModel;
  monsterOptions: SelectOption[];
  selectedMonsterId: string;
  onTargetChange(monsterId: string): void;
}

const PRAYER_OPTIONS: SelectOption[] = [
  { id: "none", label: "None" },
  ...PRAYER_SELECTION_OPTIONS.map(({ id, label }) => ({ id, label }))
];

const BOOST_OPTIONS: SelectOption[] = [
  { id: "none", label: "None" },
  ...BOOST_SELECTION_OPTIONS.map(({ id, label }) => ({ id, label }))
];

function selectedOptionLabel(options: readonly SelectOption[], ids: readonly string[]): string {
  const value = ids.find((id) => id !== "none") ?? "none";
  return options.find((option) => option.id === value)?.label ?? value;
}

function optionalNumber(value: number | null): string {
  return value === null ? "-" : formatNumber(value);
}

export function MonsterCardPanel({
  card,
  monsterOptions,
  selectedMonsterId,
  onTargetChange
}: MonsterCardPanelProps) {
  const setup = card.setupOverview;
  const setupSpeed = formatSemanticUnitValue(
    formatNumber(setup.attackSpeedSec, 1),
    setup.attackSpeedSec,
    "second"
  );
  const setupRows: Array<{ label: string; value: string; accessible?: string } | null> = [
    { label: "Weapon", value: setup.weapon.label },
    setup.ammo ? { label: "Ammo", value: setup.ammo.label } : null,
    setup.spell ? { label: "Spell", value: setup.spell.label } : null,
    { label: "Style", value: setup.styleLabel },
    {
      label: "Attack type",
      value: setup.attackType ? setup.attackType.toString() : "-"
    },
    { label: "Prayer", value: selectedOptionLabel(PRAYER_OPTIONS, setup.prayerIds) },
    { label: "Boost", value: selectedOptionLabel(BOOST_OPTIONS, setup.boostIds) },
    { label: "Attack speed", value: setupSpeed.visible, accessible: setupSpeed.accessible },
    { label: "Accuracy", value: signedInteger(setup.accuracyBonus) },
    { label: "Damage", value: signedInteger(setup.damageBonus) },
    { label: "Sustained", value: yesNo(setup.sustained) },
    { label: "Ring", value: setup.ring?.label ?? "-" }
  ];
  const visibleSetupRows = setupRows.filter(
    (row): row is { label: string; value: string; accessible?: string } => row !== null
  );

  return (
    <aside id="monster-card-panel" className="monster-rail" aria-label="Monster card">
      <section className="monster-card-panel">
        <a className="mobile-monster-back" href="#workbench-active-panel">
          Back to Compare
        </a>
        <div className="section-title-row">
          <div>
            <h2>{card.monsterName}</h2>
            <p className="monster-card-subtitle">
              <span>Monster ID</span> <code>{card.monsterId}</code>
              {card.monsterDisplayLabel.source === "fallback" ? (
                <span className="monster-card-name-source">Source name unavailable</span>
              ) : null}
            </p>
          </div>
          <span
            className={`status-pill ${card.setupBadge.tone === "custom" ? "ready" : ""}`}
            aria-label="Current setup state"
          >
            {card.setupBadge.label}
          </span>
        </div>

        <div className="monster-card-controls" aria-label="Monster target controls">
          <SearchableSelectField
            label="Target"
            value={selectedMonsterId}
            options={monsterOptions}
            onChange={onTargetChange}
            searchPlaceholder="Search monsters"
          />
        </div>

        <section className="monster-card-section" aria-label="Monster stats">
          <h3>Stats</h3>
          <dl className="monster-stat-grid">
            {card.stats.map((stat) => (
              <div key={stat.key} className={stat.missing ? "missing" : undefined}>
                <dt>{stat.label}</dt>
                <dd
                  aria-label={
                    stat.accessibleValue !== stat.displayValue ? stat.accessibleValue : undefined
                  }
                >
                  {stat.displayValue}
                </dd>
              </div>
            ))}
          </dl>
        </section>

        <section className="monster-card-section" aria-label="Monster defence">
          <h3>Defence</h3>
          <ul className="monster-defence-list">
            {card.defenceRows.map((row) => (
              <li
                key={row.key}
                className={row.active ? "active" : undefined}
                aria-current={row.active ? "true" : undefined}
                data-defence-key={row.key}
              >
                <span>{row.label}</span>
                <strong>{optionalNumber(row.value)}</strong>
                {row.active && <em>Active</em>}
              </li>
            ))}
          </ul>
        </section>

        <section className="monster-card-section" aria-label="Monster setup overview">
          <h3>Setup overview</h3>
          <dl className="monster-setup-grid">
            {visibleSetupRows.map((row) => (
              <div key={row.label}>
                <dt>{row.label}</dt>
                <dd aria-label={row.accessible}>{row.value}</dd>
              </div>
            ))}
          </dl>
        </section>
      </section>
    </aside>
  );
}
