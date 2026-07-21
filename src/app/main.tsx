import React, { lazy, Suspense } from "react";
import ReactDOM from "react-dom/client";
import { ApplicationErrorBoundary } from "./components/shell/application-error-boundary";
import { ApplicationEntryLoadError } from "./startup-guard-core";
import "./styles.css";

export const AppEntry = lazy(() =>
  import("./App")
    .then((module) => ({ default: module.App }))
    .catch(() => {
      throw new ApplicationEntryLoadError();
    })
);

ReactDOM.createRoot(document.getElementById("root") as HTMLElement).render(
  <React.StrictMode>
    <ApplicationErrorBoundary>
      <Suspense
        fallback={
          <main className="app-shell" data-app-startup-state="starting">
            <section className="loading" role="status" aria-live="polite">
              Starting 2004scape Combat Simulator...
            </section>
          </main>
        }
      >
        <AppEntry />
      </Suspense>
    </ApplicationErrorBoundary>
  </React.StrictMode>
);
