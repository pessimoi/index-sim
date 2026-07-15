// @vitest-environment jsdom

import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import {
  APP_STARTUP_ERROR_MESSAGE,
  installStartupGuard,
  renderStartupError
} from "../app/startup-guard-core";

function startingDocument(): void {
  document.body.innerHTML = `
    <div id="root">
      <main data-app-startup-state="starting">
        <section role="status">Starting 2004scape Combat Simulator...</section>
      </main>
    </div>
    <script type="module" data-app-entry src="/src/app/main.tsx"></script>
  `;
}

describe("application startup guard", () => {
  it("keeps a readable static startup and no-script fallback in the HTML entry", () => {
    const indexHtml = readFileSync(resolve("index.html"), "utf8");

    expect(indexHtml).toContain('data-app-startup-state="starting"');
    expect(indexHtml).toContain("Starting 2004scape Combat Simulator...");
    expect(indexHtml).toContain(
      "<noscript>JavaScript is required to run the simulator.</noscript>"
    );
    expect(indexHtml).toContain('type="module" src="/src/app/startup-guard.ts"');
    expect(indexHtml).toContain('type="module" data-app-entry src="/src/app/main.tsx"');
    expect(indexHtml.indexOf("/src/app/startup-guard.ts")).toBeLessThan(
      indexHtml.indexOf("/src/app/main.tsx")
    );
  });

  it("replaces pending startup content with one sanitized error state", () => {
    startingDocument();

    renderStartupError(document);

    const markers = document.querySelectorAll("[data-app-startup-state]");
    expect(markers).toHaveLength(1);
    expect(markers[0]?.getAttribute("data-app-startup-state")).toBe("error");
    expect(document.querySelector('[role="alert"]')?.textContent).toContain(
      APP_STARTUP_ERROR_MESSAGE
    );
    expect(document.body.textContent).not.toContain("private/source.ts");
  });

  it("handles entry-script errors while startup is pending", () => {
    startingDocument();
    const cleanup = installStartupGuard(window, document);

    document.querySelector("script[data-app-entry]")?.dispatchEvent(new Event("error"));

    expect(document.querySelector('[data-app-startup-state="error"]')).not.toBeNull();
    cleanup();
  });

  it("does not reclassify errors after the app is ready", () => {
    startingDocument();
    const marker = document.querySelector<HTMLElement>("[data-app-startup-state]");
    marker?.setAttribute("data-app-startup-state", "ready");
    const cleanup = installStartupGuard(window, document);

    window.dispatchEvent(new Event("error"));

    expect(document.querySelector('[data-app-startup-state="ready"]')).not.toBeNull();
    expect(document.querySelector('[data-app-startup-state="error"]')).toBeNull();
    cleanup();
  });
});
