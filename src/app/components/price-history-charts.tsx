import { formatNumber } from "../view-models/formatting";
import type {
  PriceHistoryMoverRowPresentation,
  PriceHistoryTrendPresentation
} from "../view-models/price-data";
import {
  itemPriceMetadataLabel,
  optionalDelta,
  optionalPercent,
  optionalPrice
} from "./presentation-formatters";
import { PriceTime } from "./price-time";

function trendPointTimeDetail(point: PriceHistoryTrendPresentation["points"][number]): string {
  const clauses = [`Snapshot captured ${point.captureTime.exactAccessible}`];
  if (point.observedTime.precision === "instant" || point.observedTime.precision === "date") {
    clauses.push(`value observed ${point.observedTime.exactAccessible}`);
  }
  if (point.evaluatedTime.precision === "instant" || point.evaluatedTime.precision === "date") {
    clauses.push(`last evaluated ${point.evaluatedTime.exactAccessible}`);
  }
  return clauses.join("; ");
}

export function PriceTrendChart({ trend }: { trend: PriceHistoryTrendPresentation }) {
  if (trend.points.length === 0) {
    return (
      <div className="economy-trend empty" aria-label="Item price trend">
        <div className="section-title-row">
          <h3>Item trend</h3>
          <span className="status-pill">empty</span>
        </div>
        <p>No price points</p>
      </div>
    );
  }

  const width = 720;
  const height = 176;
  const paddingX = 26;
  const paddingTop = 18;
  const paddingBottom = 24;
  const plotWidth = width - paddingX * 2;
  const plotHeight = height - paddingTop - paddingBottom;
  const minimum = trend.minimumPrice ?? 0;
  const maximum = trend.maximumPrice ?? minimum;
  const range = Math.max(1, maximum - minimum);
  const denominator = Math.max(1, trend.points.length - 1);
  const points = trend.points.map((point, index) => ({
    ...point,
    x: paddingX + (index / denominator) * plotWidth,
    y: paddingTop + ((maximum - point.price) / range) * plotHeight
  }));
  const linePoints = points.map((point) => `${point.x},${point.y}`).join(" ");

  return (
    <div className="economy-trend" aria-label="Item price trend">
      <div className="section-title-row">
        <h3>{trend.itemLabel}</h3>
        <span className="status-pill">{formatNumber(trend.points.length)} points</span>
      </div>
      <dl className="economy-trend-summary">
        <div>
          <dt>Latest</dt>
          <dd>{optionalPrice(trend.latestPrice)}</dd>
        </div>
        <div>
          <dt>Minimum</dt>
          <dd>{optionalPrice(trend.minimumPrice)}</dd>
        </div>
        <div>
          <dt>Maximum</dt>
          <dd>{optionalPrice(trend.maximumPrice)}</dd>
        </div>
        <div>
          <dt>Net change</dt>
          <dd
            className={
              trend.netGpDelta === null || trend.netGpDelta === 0
                ? undefined
                : trend.netGpDelta > 0
                  ? "gain"
                  : "loss"
            }
          >
            {optionalDelta(trend.netGpDelta)} / {optionalPercent(trend.netPercentDelta)}
          </dd>
        </div>
      </dl>
      <svg
        className="economy-trend-chart"
        viewBox={`0 0 ${width} ${height}`}
        role="img"
        aria-label={`${trend.itemLabel} price trend`}
      >
        <title>{`${trend.itemLabel} price trend from ${optionalPrice(
          trend.firstPrice
        )} to ${optionalPrice(trend.latestPrice)}`}</title>
        <line
          className="economy-trend-axis"
          x1={paddingX}
          x2={width - paddingX}
          y1={height - paddingBottom}
          y2={height - paddingBottom}
        />
        <polyline className="economy-trend-line" points={linePoints} />
        {points.map((point, index) => (
          <circle
            className="economy-trend-point"
            key={`${point.snapshotKey}-${index}`}
            cx={point.x}
            cy={point.y}
            r="4"
          >
            <title>{`${trendPointTimeDetail(point)}: ${formatNumber(point.price)} (${itemPriceMetadataLabel(point.priceStatus)})`}</title>
          </circle>
        ))}
      </svg>
      <ol
        className="economy-trend-points"
        aria-label={`Price points for ${trend.itemLabel}`}
        tabIndex={0}
      >
        {trend.points.map((point, index) => (
          <li key={`${point.snapshotKey}-${index}`}>
            <PriceTime presentation={point.captureTime} />
            <strong>{formatNumber(point.price)}</strong>
            <span>{optionalDelta(point.gpDeltaFromPrevious)}</span>
            <span>{itemPriceMetadataLabel(point.priceStatus)}</span>
            {(point.observedTime.precision === "instant" ||
              point.observedTime.precision === "date") && (
              <small>
                Value observed <PriceTime presentation={point.observedTime} />
              </small>
            )}
            {(point.evaluatedTime.precision === "instant" ||
              point.evaluatedTime.precision === "date") && (
              <small>
                Last evaluated <PriceTime presentation={point.evaluatedTime} />
              </small>
            )}
          </li>
        ))}
      </ol>
    </div>
  );
}

export function PriceTrendSparkline({ row }: { row: PriceHistoryMoverRowPresentation }) {
  const width = 96;
  const height = 28;
  const padding = 3;
  const minimum = row.trendPrices.length ? Math.min(...row.trendPrices) : 0;
  const maximum = row.trendPrices.length ? Math.max(...row.trendPrices) : minimum;
  const range = Math.max(1, maximum - minimum);
  const denominator = Math.max(1, row.trendPrices.length - 1);
  const points = row.trendPrices.map((price, index) => ({
    price,
    x: padding + (index / denominator) * (width - padding * 2),
    y: padding + ((maximum - price) / range) * (height - padding * 2)
  }));

  if (points.length === 0) return <span>-</span>;

  return (
    <svg
      className="economy-sparkline"
      viewBox={`0 0 ${width} ${height}`}
      role="img"
      aria-label={`${row.itemLabel} price trend from ${row.firstCaptureTime?.exactAccessible ?? "an unavailable date"} to ${row.latestCaptureTime?.exactAccessible ?? "an unavailable date"}, ${row.trendPrices.map(formatNumber).join(" to ")}`}
    >
      <polyline points={points.map((point) => `${point.x},${point.y}`).join(" ")} />
      {points.map((point, index) => (
        <circle key={`${point.price}-${index}`} cx={point.x} cy={point.y} r="2" />
      ))}
    </svg>
  );
}
