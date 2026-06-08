#!/usr/bin/env node
/**
 * SSR smoke test — boots the production build via wrangler/vite preview
 * and fetches a set of routes to catch:
 *   - missing module imports (e.g. @tanstack/zod-adapter)
 *   - `window is not defined` / browser-only globals at module scope
 *     (Leaflet, framer-motion, etc.)
 *   - h3-swallowed 500s
 *
 * Exit code 0 = all routes returned <500. Non-zero = at least one failure.
 */
import { spawn } from "node:child_process";
import { setTimeout as delay } from "node:timers/promises";

const ROUTES = [
  "/",
  "/rakshak-platform",
  "/rakshak-platform/auth",
  "/rakshak-platform/dashboard",
  "/rakshak-platform/admin",
  "/rakshak-platform/mentor",
  "/rakshak-platform/team",
];

const PORT = process.env.SMOKE_PORT || "4173";
const HOST = `http://127.0.0.1:${PORT}`;
const FAIL_PATTERNS = [
  /Cannot find module/i,
  /window is not defined/i,
  /document is not defined/i,
  /ReferenceError/i,
  /"unhandled":true/i,
];

function startServer() {
  const proc = spawn(
    "npx",
    ["vite", "preview", "--port", PORT, "--strictPort", "--host", "127.0.0.1"],
    { stdio: ["ignore", "pipe", "pipe"], env: process.env },
  );
  let log = "";
  proc.stdout.on("data", (d) => {
    log += d.toString();
    process.stdout.write(d);
  });
  proc.stderr.on("data", (d) => {
    log += d.toString();
    process.stderr.write(d);
  });
  return { proc, getLog: () => log };
}

async function waitForReady(timeoutMs = 30_000) {
  const start = Date.now();
  while (Date.now() - start < timeoutMs) {
    try {
      const res = await fetch(HOST + "/");
      if (res.status < 500) return;
    } catch {}
    await delay(500);
  }
  throw new Error("Preview server did not become ready in time");
}

async function checkRoute(path) {
  const url = HOST + path;
  try {
    const res = await fetch(url);
    const body = await res.text();
    const matched = FAIL_PATTERNS.find((re) => re.test(body));
    if (res.status >= 500 || matched) {
      return {
        path,
        ok: false,
        status: res.status,
        reason: matched ? `body matched ${matched}` : `status ${res.status}`,
        snippet: body.slice(0, 400),
      };
    }
    return { path, ok: true, status: res.status };
  } catch (err) {
    return { path, ok: false, status: 0, reason: String(err) };
  }
}

const { proc, getLog } = startServer();
let failed = false;
try {
  await waitForReady();
  const results = await Promise.all(ROUTES.map(checkRoute));
  for (const r of results) {
    if (r.ok) {
      console.log(`PASS ${r.status} ${r.path}`);
    } else {
      failed = true;
      console.error(`FAIL ${r.status} ${r.path} — ${r.reason}`);
      if (r.snippet) console.error(r.snippet);
    }
  }
  const log = getLog();
  for (const re of FAIL_PATTERNS) {
    if (re.test(log)) {
      console.error(`FAIL server log matched ${re}`);
      failed = true;
    }
  }
} catch (err) {
  console.error("Smoke test error:", err);
  failed = true;
} finally {
  proc.kill("SIGTERM");
}
process.exit(failed ? 1 : 0);
