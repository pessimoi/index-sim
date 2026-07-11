import { z } from "zod";
import { MARKET_SOURCE_ID } from "../src/data/schemas";
import { NonNegativeNumberSchema } from "../src/data/schemas/game-data";
import { parseJsonWithDuplicateKeyCheck } from "../src/data/reliability";
import type { MarketSourceMapping } from "../src/domain/shared";
import {
  ScheduledMarketWriterError,
  type ScheduledMarketUpstreamItem
} from "./scheduled-market-writer-core";

const TradeOfferItemSchema = z
  .object({
    quantity: z.number().int().positive(),
    item: z
      .object({
        slug: z.string().min(1)
      })
      .passthrough()
  })
  .passthrough();

const TradeOfferSchema = z
  .object({
    items: z.array(TradeOfferItemSchema).max(20)
  })
  .passthrough();

const CompletedTradeSchema = z
  .object({
    price: NonNegativeNumberSchema.refine((value) => value > 0, "Price must be positive")
      .nullable()
      .optional(),
    quantity: z.number().int().positive(),
    type: z.enum(["buy", "sell"]),
    soldAt: z
      .string()
      .min(1)
      .refine((value) => Number.isFinite(Date.parse(value)), "Invalid sold timestamp"),
    offers: z.array(TradeOfferSchema).max(20).default([])
  })
  .passthrough();

const SoldListingsSchema = z
  .object({
    data: z.array(CompletedTradeSchema).max(10),
    current_page: z.number().int().positive().optional(),
    currentPage: z.number().int().positive().optional()
  })
  .passthrough();

const ItemPageSchema = z
  .object({
    component: z.literal("items/show/page"),
    props: z
      .object({
        item: z
          .object({
            slug: z.string().min(1).optional()
          })
          .passthrough(),
        soldListings: SoldListingsSchema
      })
      .passthrough()
  })
  .passthrough();

function decodeHtmlAttribute(value: string): string {
  return value
    .replace(/&#(\d+);/g, (_match, code: string) => String.fromCodePoint(Number(code)))
    .replace(/&#x([0-9a-f]+);/gi, (_match, code: string) =>
      String.fromCodePoint(Number.parseInt(code, 16))
    )
    .replaceAll("&quot;", '"')
    .replaceAll("&#039;", "'")
    .replaceAll("&lt;", "<")
    .replaceAll("&gt;", ">")
    .replaceAll("&amp;", "&");
}

function inertiaPayloadFromHtml(html: string): unknown {
  const match = html.match(/\sdata-page=(?:"([\s\S]*?)"|'([\s\S]*?)')/i);
  if (!match) {
    throw new ScheduledMarketWriterError(
      "invalid_upstream",
      "Market item page did not contain an Inertia payload"
    );
  }

  try {
    return parseJsonWithDuplicateKeyCheck(decodeHtmlAttribute(match[1] ?? match[2] ?? ""), {
      source: "Market Inertia payload"
    });
  } catch {
    throw new ScheduledMarketWriterError(
      "invalid_upstream",
      "Market item page contained an invalid Inertia payload"
    );
  }
}

function itemPagePayload(text: string, contentType: string): unknown {
  if (contentType.toLowerCase().startsWith("application/json")) {
    try {
      return parseJsonWithDuplicateKeyCheck(text, { source: "Market item page response" });
    } catch {
      throw new ScheduledMarketWriterError(
        "invalid_upstream",
        "Market item page response is not valid JSON"
      );
    }
  }
  if (contentType.toLowerCase().startsWith("text/html")) return inertiaPayloadFromHtml(text);
  throw new ScheduledMarketWriterError(
    "invalid_upstream",
    "Market item page response has an unsupported content type"
  );
}

function formatIssue(issue: { path: PropertyKey[]; message: string }): string {
  const path = issue.path.length ? issue.path.map(String).join(".") : "<root>";
  return `${path}: ${issue.message}`;
}

function completedTradeUnitPrice(trade: z.infer<typeof CompletedTradeSchema>): number | null {
  if (trade.price !== null && trade.price !== undefined) return trade.price;
  if (trade.offers.length !== 1) return null;
  const items = trade.offers[0]?.items ?? [];
  if (items.length !== 1 || items[0]?.item.slug !== "coins") return null;
  return items[0].quantity;
}

export function parseMarketsLostcityItemPage(input: {
  text: string;
  contentType: string;
  mapping: MarketSourceMapping;
}): ScheduledMarketUpstreamItem {
  const result = ItemPageSchema.safeParse(itemPagePayload(input.text, input.contentType));
  if (!result.success) {
    throw new ScheduledMarketWriterError(
      "invalid_upstream",
      "Market item page failed schema validation",
      result.error.issues.map(formatIssue)
    );
  }

  const page = result.data;
  const currentPage = page.props.soldListings.current_page ?? page.props.soldListings.currentPage;
  if (currentPage !== undefined && currentPage !== 1) {
    throw new ScheduledMarketWriterError(
      "invalid_upstream",
      "Market item page returned an unexpected pagination page",
      [`itemId: ${input.mapping.itemId}`]
    );
  }
  if (page.props.item.slug && page.props.item.slug !== input.mapping.sourceSlug) {
    throw new ScheduledMarketWriterError(
      "unknown_source_slug",
      "Market item page returned an unexpected source item",
      [`itemId: ${input.mapping.itemId}`]
    );
  }

  const history = page.props.soldListings.data.flatMap((trade) => {
    const price = completedTradeUnitPrice(trade);
    return price === null
      ? []
      : [
          {
            price,
            quantity: trade.quantity,
            type: trade.type,
            soldAt: trade.soldAt
          }
        ];
  });

  return {
    itemId: input.mapping.itemId,
    sourceSlug: input.mapping.sourceSlug,
    status: history.length ? "updated" : "skipped",
    ...(history.length
      ? { history }
      : { reason: "No completed coin-denominated trades on item page" })
  };
}

export function createMarketsLostcityItemPageResponse(input: {
  items: ScheduledMarketUpstreamItem[];
  fetchedAt: Date;
}) {
  return {
    source: MARKET_SOURCE_ID,
    fetchedAt: input.fetchedAt.toISOString(),
    items: input.items
  } as const;
}
