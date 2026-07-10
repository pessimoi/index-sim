import {
  createHiscoresApiHandler,
  type HiscoresApiHandlerOptions,
  type HiscoresApiResponse
} from "./hiscores-core";
import { createLostCityHiscoresProvider } from "./lostcity-hiscores-provider";
import { DEPLOYMENT_SECURITY_HEADERS } from "./deployment-security";

export interface CloudflareAssetsBinding {
  fetch(request: Request): Promise<Response>;
}

export interface CloudflareWorkerEnvironment {
  ASSETS: CloudflareAssetsBinding;
}

export interface CloudflareWorkerHandler {
  fetch(request: Request, environment: CloudflareWorkerEnvironment): Promise<Response>;
}

function withSecurityHeaders(response: Response): Response {
  const headers = new Headers(response.headers);
  for (const [name, value] of Object.entries(DEPLOYMENT_SECURITY_HEADERS)) {
    headers.set(name, value);
  }
  return new Response(response.body, {
    status: response.status,
    statusText: response.statusText,
    headers
  });
}

function apiResponse(response: HiscoresApiResponse): Response {
  return withSecurityHeaders(
    new Response(response.body, {
      status: response.status,
      headers: response.headers
    })
  );
}

function sanitizedApiError(status: number, code: "internal-error" | "not-found"): Response {
  return withSecurityHeaders(
    Response.json(
      {
        error: {
          code,
          message: code === "not-found" ? "API route was not found" : "Request failed"
        }
      },
      {
        status,
        headers: { "Cache-Control": "no-store" }
      }
    )
  );
}

function trustedClientAddress(request: Request): string | undefined {
  const value = request.headers.get("CF-Connecting-IP")?.trim();
  return value && value.length <= 64 ? value : undefined;
}

export function createCloudflareWorker(
  options: HiscoresApiHandlerOptions = {}
): CloudflareWorkerHandler {
  const handleHiscoresApiRequest = createHiscoresApiHandler({
    ...options,
    provider: options.provider ?? createLostCityHiscoresProvider()
  });

  return {
    async fetch(request, environment) {
      try {
        const url = new URL(request.url);
        const hiscoresResponse = await handleHiscoresApiRequest({
          method: request.method,
          url: `${url.pathname}${url.search}`,
          remoteAddress: trustedClientAddress(request)
        });

        if (hiscoresResponse) return apiResponse(hiscoresResponse);
        if (url.pathname === "/api" || url.pathname.startsWith("/api/")) {
          return sanitizedApiError(404, "not-found");
        }

        return withSecurityHeaders(await environment.ASSETS.fetch(request));
      } catch {
        return sanitizedApiError(500, "internal-error");
      }
    }
  };
}

export default createCloudflareWorker();
