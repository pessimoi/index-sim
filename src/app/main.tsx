import React from "react";
import ReactDOM from "react-dom/client";
import { App } from "./App";
import { ApplicationErrorBoundary } from "./components/shell/application-error-boundary";
import "./styles.css";

ReactDOM.createRoot(document.getElementById("root") as HTMLElement).render(
  <React.StrictMode>
    <ApplicationErrorBoundary>
      <App />
    </ApplicationErrorBoundary>
  </React.StrictMode>
);
