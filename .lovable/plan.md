## Goal

Ship 4 workstreams plus mobile responsiveness pass across the Rakshak admin/team surfaces.

## 1. Integrations smoke tests (in-app + script)

- Add `runIntegrationSmoke` server fn in `src/lib/rakshak-platform/integrations.functions.ts`:
  - For each placeholder hook (cron health ping, webhook signature echo, AI gateway ping, storage bucket reachability, supabase admin ping) return `{ name, status: 'pass'|'fail'|'skip', latencyMs, detail }`.
  - Real checks where cheap (env var presence, `select 1` on supabase, HEAD on cron endpoint, AI gateway models list). Placeholder integrations return `skip` with reason.
- Update `rakshak-platform.admin.integrations.tsx`:
  - Per-row "Run smoke test" button + "Run all" header button.
  - Badge column for last result, timestamp, latency, detail tooltip.
  - Results held in component state (no DB persistence for v1).
- Add `/api/public/hooks/health-ping` route returning `{ ok: true, ts }` so smoke test has a real target.

## 2. Cron monitoring upgrade

- `cron-alerts.functions.ts`: add `listGroupedHealth` returning hooks grouped by status bucket (`healthy`, `degraded`, `failing`, `stale`, `unknown`) with counts and per-hook last-run/last-error.
- `rakshak-platform.admin.cron-health.tsx`:
  - Render grouped accordions, group counts in header chips, color-coded.
  - "Acknowledge" + "Open alert rule" actions per row.
  - Top summary bar with totals + last evaluation time.
- `rakshak-platform.admin.alerts.tsx`:
  - Clearer rule editor: failure threshold, stale-minutes, severity, notify-roles multi-select.
  - Show recent triggered alerts (read `rp_notifications` filtered by type `cron_alert_*`).
- Notification trigger improvements: include hook name, last error excerpt, deep link to cron-health filtered row in `action_link`.

## 3. Accessibility audit + fixes

Targets: leaderboard (`rakshak-platform.leaderboard.tsx`, `.print.tsx`), admin shell + key admin pages (cron-health, alerts, qa, integrations, exports, evaluator-leaderboard), certificate verification (`rakshak-platform.verify.$code.tsx` or equivalent).

Fixes applied directly:
- Replace icon-only buttons with `aria-label`.
- Ensure single `<main>` per route; add landmarks (`<nav>`, `<section aria-labelledby>`).
- Add visible labels / `htmlFor` for filter selects and date inputs.
- Replace `text-gray-*` / low-contrast tokens with semantic tokens.
- Heading order pass (single h1, sequential h2/h3).
- `aria-live="polite"` regions for async filter results and smoke-test output.
- Tap-target sizing `min-h-11 min-w-11` on icon buttons; `h-dvh` swap where `h-screen` blocks mobile chrome.
- Tables: `<caption>` + `scope="col"` on headers; add "Skip to content" link in admin shell.

## 4. Mobile / responsive pass

- Admin Shell: collapsible nav with Sheet trigger on `<md`, sticky top bar with hamburger.
- Tables (leaderboard, evaluator-leaderboard, qa, exports): wrap in `overflow-x-auto`, add stacked card view on `sm:` for leaderboard.
- Filter bars: switch to `flex-wrap gap-2`, full-width inputs on mobile.
- Verify cert page: center card, `max-w-md` mobile, larger QR area.
- Set responsive font sizing via `text-base md:text-lg` where headings overflowed.

## 5. End-to-end regression suite

- Add Playwright: `bun add -d @playwright/test`, `playwright.config.ts` pointing at preview URL via `PLAYWRIGHT_BASE_URL` env.
- Test specs under `tests/e2e/`:
  - `auth.spec.ts` — sign-in form renders, validation errors show, redirect to `/auth` when hitting protected route.
  - `admin-dashboards.spec.ts` — admin home loads, nav links resolve, cron-health groups render.
  - `qa-sweep.spec.ts` — `/rakshak-platform/admin/qa` renders, severity filter changes count.
  - `certificates.spec.ts` — verify page handles invalid code + valid code (mocked).
  - `exports.spec.ts` — print route renders dataset table.
  - `integrations-smoke.spec.ts` — "Run all" populates result badges.
- In-app QA checklist page `rakshak-platform.admin.qa-checklist.tsx` listing manual scenarios + pass/fail toggles (persisted to localStorage) for cases Playwright can't cover (real webhook delivery, real OAuth).
- README note: tests are opt-in (`bun run test:e2e`), not part of Lovable build.

## Out of scope

- New DB tables (reuse `rp_cron_alert_rules`, `rp_notifications`).
- Persisting smoke-test history (v1 in-memory only).
- Rewriting existing certificate generation logic.

## Delivery order this turn

1. Integrations smoke tests + health-ping route.
2. Cron monitoring upgrade (grouping + alert UI polish).
3. A11y + mobile responsiveness pass on the listed pages.
4. Playwright config + spec files + in-app checklist.

Confirm and I'll start.
