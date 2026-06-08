// Captures uncaught client errors. In development they're logged with full
// detail; in production they're logged compactly so they show up in the
// browser console / monitoring without leaking stacks to the UI.

const isDev =
  typeof import.meta !== "undefined" &&
  (import.meta as any).env &&
  (import.meta as any).env.DEV;

let installed = false;

export function installClientErrorReporter() {
  if (installed || typeof window === "undefined") return;
  installed = true;

  window.addEventListener("error", (event) => {
    const err = event.error ?? new Error(event.message);
    report("window.error", err, {
      filename: event.filename,
      lineno: event.lineno,
      colno: event.colno,
    });
  });

  window.addEventListener("unhandledrejection", (event) => {
    report("unhandledrejection", event.reason);
  });
}

export function report(source: string, error: unknown, extra?: Record<string, unknown>) {
  const e = error instanceof Error ? error : new Error(String(error));
  if (isDev) {
    // Full detail in dev — keeps the original Error so DevTools shows the stack.
    console.group(`[client-error:${source}] ${e.message}`);
    console.error(e);
    if (extra) console.info(extra);
    console.groupEnd();
  } else {
    // Compact one-line log in prod.
    console.error(
      `[client-error:${source}] ${e.name}: ${e.message}`,
      extra ?? {},
    );
  }
}

export function isDevMode() {
  return Boolean(isDev);
}
