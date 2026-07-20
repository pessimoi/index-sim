import type { PriceDateTimePresentation } from "../view-models/price-time";

export function PriceTime({
  presentation,
  display = "exact"
}: {
  presentation: PriceDateTimePresentation;
  display?: "exact" | "relative" | "full";
}) {
  if (!presentation.dateTime) return <span>{presentation.exactVisible}</span>;

  const relativeVisible = presentation.relativeVisible ?? "Exact time not recorded";
  const relativeAccessible = presentation.relativeAccessible ?? "Exact time not recorded";
  const visible =
    display === "relative"
      ? relativeVisible
      : display === "full"
        ? `${presentation.exactVisible} · ${relativeVisible}`
        : presentation.exactVisible;
  const accessible =
    display === "relative"
      ? `${relativeAccessible}; exact local time ${presentation.exactAccessible}`
      : display === "full"
        ? `${presentation.exactAccessible}; ${relativeAccessible}`
        : presentation.exactAccessible;

  return (
    <time
      dateTime={presentation.dateTime}
      title={presentation.exactUtcTitle ?? undefined}
      aria-label={accessible}
    >
      {visible}
    </time>
  );
}

export function PriceTimeFactPair({
  presentation,
  exactLabel,
  relativeLabel
}: {
  presentation: PriceDateTimePresentation;
  exactLabel: string;
  relativeLabel: string;
}) {
  if (!presentation.dateTime) {
    return (
      <span>
        {exactLabel} <span>{presentation.exactVisible}</span>
      </span>
    );
  }
  const relativeVisible = presentation.relativeVisible ?? "Exact time not recorded";
  const relativeAccessible = presentation.relativeAccessible ?? "Exact time not recorded";
  return (
    <>
      <span>
        {exactLabel}{" "}
        <time
          dateTime={presentation.dateTime}
          title={presentation.exactUtcTitle ?? undefined}
          aria-label={`${presentation.exactAccessible}; ${relativeAccessible}`}
        >
          {presentation.exactVisible}
        </time>
      </span>
      <span aria-hidden="true">
        {relativeLabel} {relativeVisible}
      </span>
    </>
  );
}
