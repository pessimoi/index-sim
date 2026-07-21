import type { CannonOverlayResult } from "@/domain/trip";
import { MetricList } from "../app-presenters";
import { NumberField } from "../form-fields";
import { formatNumber } from "../../view-models/formatting";

export interface CannonPaneProps {
  hidden: boolean;
  enabled: boolean;
  targets: number;
  respawnSeconds: number;
  tripSparseLinked: boolean;
  hasCustomSettings: boolean;
  output: CannonOverlayResult | null;
  effectiveXpPerHour: number;
  effectiveNetGpPerHour: number;
  hitChance: number;
  tripSparseEnabled: boolean;
  tripSparseMaxKph: number;
  cannonReserveActive: boolean;
  onEnabledChange(enabled: boolean): void;
  onTargetsChange(targets: number): void;
  onRespawnChange(respawnSeconds: number): void;
  onTripSparseLinkedChange(linked: boolean): void;
  onReset(): void;
}

export function CannonPane({
  hidden,
  enabled,
  targets,
  respawnSeconds,
  tripSparseLinked,
  hasCustomSettings,
  output,
  effectiveXpPerHour,
  effectiveNetGpPerHour,
  hitChance,
  tripSparseEnabled,
  tripSparseMaxKph,
  cannonReserveActive,
  onEnabledChange,
  onTargetsChange,
  onRespawnChange,
  onTripSparseLinkedChange,
  onReset
}: CannonPaneProps) {
  const status = !enabled
    ? "off"
    : output?.idle
      ? "idle"
      : output?.respawnBound
        ? "respawn-bound"
        : "active";
  const sparseSummary = !enabled
    ? "Off"
    : tripSparseLinked
      ? "Linked"
      : tripSparseEnabled
        ? "Trip differs"
        : "Cannon only";
  const reserveSummary = enabled && cannonReserveActive ? "5 slots" : "-";
  const notice = !enabled
    ? "Cannon is off for this monster."
    : output?.idle
      ? "Idle: this spot is too sparse for the cannon to fire."
      : output?.respawnBound
        ? "Respawn-bound: cannon uptime is limited by target respawns."
        : tripSparseLinked
          ? "Trip sparse assumptions use the same target count and respawn as Cannon."
          : tripSparseEnabled
            ? "Trip sparse assumptions differ from this Cannon spot."
            : "Cannon affects ranged XP, supply cost and inventory reserve slots.";

  return (
    <section className="cannon-strip" aria-label="Cannon" hidden={hidden}>
      <div className="section-title-row">
        <h2 id="cannon-heading" tabIndex={-1}>
          Dwarf multicannon
        </h2>
        <span className={`status-pill ${enabled && !output?.idle ? "ready" : ""}`}>{status}</span>
      </div>
      <div className="cannon-body">
        <label className="toggle">
          <input
            type="checkbox"
            checked={enabled}
            onChange={(event) => onEnabledChange(event.target.checked)}
          />
          <span>Set up cannon</span>
        </label>
        <NumberField
          label="Mobs at spot"
          value={targets}
          min={1}
          max={8}
          onChange={onTargetsChange}
        />
        <NumberField
          label="Respawn (seconds)"
          value={respawnSeconds}
          min={1}
          max={3600}
          onChange={onRespawnChange}
        />
        <label className="toggle cannon-sparse-toggle">
          <input
            type="checkbox"
            checked={tripSparseLinked}
            disabled={!enabled}
            onChange={(event) => onTripSparseLinkedChange(event.target.checked)}
          />
          <span>Link Trip sparse</span>
        </label>
        <div className="cannon-actions">
          <button type="button" disabled={!hasCustomSettings} onClick={onReset}>
            Reset monster cannon
          </button>
        </div>
        <div
          className={`cannon-notice ${enabled && output?.respawnBound ? "warning" : ""}`}
          role="status"
          aria-label="Cannon sparse status"
        >
          {notice}
        </div>
        <div className="cannon-output" aria-label="Cannon output">
          {enabled && output ? (
            <div className="cannon-output-grid">
              <MetricList
                items={[
                  { label: "Effective targets", value: formatNumber(output.effTargets, 1) },
                  {
                    label: "Cannon DPS",
                    value: formatNumber(output.cannonDps, 2),
                    tone: "teal"
                  },
                  {
                    label: "Cannon only DPS",
                    value: formatNumber(output.cannonOnlyDps, 2),
                    tone: "teal"
                  },
                  { label: "Balls/hr", value: formatNumber(output.ballsPerHour) },
                  { label: "Balls/kill", value: formatNumber(output.ballsPerKill, 2) },
                  {
                    label: "On-site cannon Ranged XP/hr",
                    value: formatNumber(output.rangedXpPerHour),
                    tone: "teal"
                  },
                  {
                    label: "Effective XP/hr",
                    value: formatNumber(effectiveXpPerHour),
                    tone: "teal"
                  },
                  {
                    label: "Effective net GP/hr",
                    value: formatNumber(effectiveNetGpPerHour),
                    tone: "gold"
                  },
                  {
                    label: "On-site ball cost/hr",
                    value: formatNumber(output.ballCostPerHour),
                    tone: "gold"
                  },
                  {
                    label: "Ball cost/kill",
                    value: formatNumber(output.ballCostPerKill),
                    tone: "gold"
                  },
                  { label: "Ball price", value: formatNumber(output.ballPrice) },
                  {
                    label: "Cannonballs/trip",
                    value: output.ballsPerTrip == null ? "-" : formatNumber(output.ballsPerTrip)
                  },
                  {
                    label: "Ball GP/trip",
                    value:
                      output.ballCostPerTrip == null ? "-" : formatNumber(output.ballCostPerTrip),
                    tone: "gold"
                  },
                  {
                    label: "On-site kills/hr uplift",
                    value:
                      output.kphNoCannon > 0
                        ? `${formatNumber(
                            (output.kphWithCannon / output.kphNoCannon - 1) * 100,
                            1
                          )}%`
                        : "-"
                  }
                ]}
              />
              <MetricList
                items={[
                  { label: "Accuracy rule", value: `${formatNumber(hitChance * 100, 1)}% roll` },
                  { label: "XP rule", value: "Ranged XP" },
                  {
                    label: "Supply impact",
                    value: `${formatNumber(output.ballCostPerKill)} GP/kill`,
                    tone: "gold"
                  },
                  { label: "Sparse link", value: sparseSummary },
                  { label: "Inventory reserve", value: reserveSummary },
                  {
                    label: "Trip on-site sparse cap (kills/hr)",
                    value: tripSparseEnabled ? formatNumber(tripSparseMaxKph) : "-"
                  }
                ]}
              />
            </div>
          ) : (
            <div className="cannon-output-grid">
              <MetricList
                items={[
                  { label: "Effective targets", value: "0.0" },
                  { label: "Cannon DPS", value: "0.00" },
                  { label: "Cannon only DPS", value: "0.00" },
                  { label: "Balls/hr", value: "0" },
                  { label: "On-site cannon Ranged XP/hr", value: "0" },
                  { label: "Effective XP/hr", value: formatNumber(effectiveXpPerHour) },
                  {
                    label: "Effective net GP/hr",
                    value: formatNumber(effectiveNetGpPerHour),
                    tone: "gold"
                  },
                  { label: "On-site ball cost/hr", value: "0" },
                  { label: "Cannonballs/trip", value: "-" },
                  { label: "Accuracy rule", value: "-" },
                  { label: "XP rule", value: "-" },
                  { label: "Supply impact", value: "-" },
                  { label: "Sparse link", value: sparseSummary },
                  { label: "Inventory reserve", value: "-" }
                ]}
              />
            </div>
          )}
        </div>
      </div>
    </section>
  );
}
