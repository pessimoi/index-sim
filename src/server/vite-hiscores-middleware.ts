import type { IncomingMessage, ServerResponse } from "node:http";
import type { Plugin } from "vite";
import {
  createHiscoresApiHandler,
  type HiscoresApiHandlerOptions,
  type HiscoresApiResponse
} from "./hiscores-core";

function writeResponse(response: ServerResponse, apiResponse: HiscoresApiResponse): void {
  response.statusCode = apiResponse.status;
  for (const [name, value] of Object.entries(apiResponse.headers)) {
    response.setHeader(name, value);
  }
  response.end(apiResponse.body);
}

function createMiddleware(options: HiscoresApiHandlerOptions) {
  const handleHiscoresApiRequest = createHiscoresApiHandler(options);

  return (request: IncomingMessage, response: ServerResponse, next: () => void) => {
    void handleHiscoresApiRequest({
      method: request.method ?? "GET",
      url: request.url ?? "/",
      remoteAddress: request.socket.remoteAddress
    })
      .then((apiResponse) => {
        if (!apiResponse) {
          next();
          return;
        }
        writeResponse(response, apiResponse);
      })
      .catch(() => {
        writeResponse(response, {
          status: 500,
          headers: {
            "Cache-Control": "no-store",
            "Content-Type": "application/json; charset=utf-8"
          },
          body: JSON.stringify({
            error: {
              code: "internal-error",
              message: "Hiscores lookup failed"
            }
          })
        });
      });
  };
}

export function hiscoresApiPlugin(options: HiscoresApiHandlerOptions = {}): Plugin {
  return {
    name: "index-sim-hiscores-api",
    configureServer(server) {
      server.middlewares.use(createMiddleware(options));
    },
    configurePreviewServer(server) {
      server.middlewares.use(createMiddleware(options));
    }
  };
}
