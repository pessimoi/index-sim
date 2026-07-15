export const APP_STARTUP_STATE_ATTRIBUTE = "data-app-startup-state";
export const APP_STARTUP_ERROR_MESSAGE =
  "The simulator could not start. Reload the page and try again.";

function startupIsPending(documentRef: Document): boolean {
  return documentRef.querySelector(`[${APP_STARTUP_STATE_ATTRIBUTE}="starting"]`) !== null;
}

export function renderStartupError(documentRef: Document): void {
  if (!startupIsPending(documentRef)) return;

  const root = documentRef.getElementById("root");
  if (!root) return;

  const shell = documentRef.createElement("main");
  shell.className = "app-shell";
  shell.setAttribute(APP_STARTUP_STATE_ATTRIBUTE, "error");

  const alert = documentRef.createElement("section");
  alert.className = "fatal";
  alert.setAttribute("role", "alert");

  const heading = documentRef.createElement("h1");
  heading.textContent = "2004scape Combat Simulator";

  const message = documentRef.createElement("p");
  message.textContent = APP_STARTUP_ERROR_MESSAGE;

  alert.append(heading, message);
  shell.append(alert);
  root.replaceChildren(shell);
}

export function installStartupGuard(windowRef: Window, documentRef: Document): () => void {
  const entryScript = documentRef.querySelector<HTMLScriptElement>("script[data-app-entry]");
  const handleStartupFailure = () => renderStartupError(documentRef);

  entryScript?.addEventListener("error", handleStartupFailure);
  windowRef.addEventListener("error", handleStartupFailure);
  windowRef.addEventListener("unhandledrejection", handleStartupFailure);

  return () => {
    entryScript?.removeEventListener("error", handleStartupFailure);
    windowRef.removeEventListener("error", handleStartupFailure);
    windowRef.removeEventListener("unhandledrejection", handleStartupFailure);
  };
}
