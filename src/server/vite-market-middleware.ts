import type { IncomingMessage, ServerResponse } from "node:http";
import type { Plugin } from "vite";
import {
  createMarketApiHandler,
  type MarketApiHandlerOptions,
  type MarketApiResponse
} from "./market-core";
import { LIVE_INTEGRATION_JSON_MAX_BYTES } from "../data/schemas";

function writeResponse(response: ServerResponse, apiResponse: MarketApiResponse): void {
  response.statusCode = apiResponse.status;
  for (const [name, value] of Object.entries(apiResponse.headers)) {
    response.setHeader(name, value);
  }
  response.end(apiResponse.body);
}

function bodyTooLargeResponse(): MarketApiResponse {
  return {
    status: 400,
    headers: {
      "Cache-Control": "no-store",
      "Content-Type": "application/json; charset=utf-8"
    },
    body: JSON.stringify({
      error: {
        code: "bad-request",
        message: "Invalid market sync request"
      }
    })
  };
}

function readBody(request: IncomingMessage): Promise<string> {
  return new Promise((resolve, reject) => {
    let body = "";
    request.setEncoding("utf8");
    request.on("data", (chunk: string) => {
      body += chunk;
      if (new TextEncoder().encode(body).byteLength > LIVE_INTEGRATION_JSON_MAX_BYTES) {
        reject(new Error("body_too_large"));
        request.destroy();
      }
    });
    request.on("end", () => resolve(body));
    request.on("error", reject);
  });
}

function createMiddleware(options: MarketApiHandlerOptions) {
  const handleMarketApiRequest = createMarketApiHandler(options);

  return (request: IncomingMessage, response: ServerResponse, next: () => void) => {
    const shouldReadBody =
      request.method?.toUpperCase() === "POST" && request.url?.startsWith("/api/market/sync");

    void (shouldReadBody ? readBody(request) : Promise.resolve(undefined))
      .then((body) =>
        handleMarketApiRequest({
          method: request.method ?? "GET",
          url: request.url ?? "/",
          body,
          remoteAddress: request.socket.remoteAddress
        })
      )
      .then((apiResponse) => {
        if (!apiResponse) {
          next();
          return;
        }
        writeResponse(response, apiResponse);
      })
      .catch(() => {
        writeResponse(response, bodyTooLargeResponse());
      });
  };
}

export function marketApiPlugin(options: MarketApiHandlerOptions = {}): Plugin {
  return {
    name: "index-sim-market-api",
    configureServer(server) {
      server.middlewares.use(createMiddleware(options));
    },
    configurePreviewServer(server) {
      server.middlewares.use(createMiddleware(options));
    }
  };
}
