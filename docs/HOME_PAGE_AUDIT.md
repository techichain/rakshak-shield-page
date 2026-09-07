# Home Page (`/`) — Full Technical & Design Audit

**Scope:** the public home page only — route `/` and everything it renders.
Deliberately **excludes** `/rakshak-platform/*`, `/rakshak-mentor/*`, `/gigrider-checklist/*`.

**Purpose:** reference document for rebuilding the home page from scratch in a separate
file/project and then merging it back into this repo without a language/stack mismatch.

Audited at commit `41150d9` on branch `claude/home-page-audit-eozmeg`.

---

## 1. Stack — what the home page is actually built on

| Layer | Technology | Version | Notes |
|---|---|---|---|
| Meta-framework | **TanStack Start** | `1.167.50` | SSR + Nitro server. **Not** Next.js. |
| Router | **TanStack Router** (file-based) | `1.168.25` | Routes are flat files in `src/routes/`, dot-separated (`rakshak-platform.admin.index.tsx`), generated into `src/routeTree.gen.ts`. |
| UI runtime | **React** | `19.2.0` | React 19, no RSC (`components.json → "rsc": false`). |
| Build tool | **Vite** | `7.3.1` | Configured through `@lovable.dev/vite-tanstack-config@2.9.1` — a wrapper that already bundles `tanstackStart`, `viteReact`, `tailwindcss`, `tsConfigPaths`, the Cloudflare build plugin, the dev-only component tagger, `VITE_*` env injection, the `@/*` alias and React/TanStack dedupe. **Do not re-add these plugins manually or the app breaks with duplicate plugins.** |
| Server preset | **Nitro** | `3.0.260603-beta` | `preset: "node-server"`, entry `server` → `.output/server/index.mjs`. |
| CSS | **Tailwind CSS v4** | `4.2.1` | CSS-first config. Single file `src/styles.css` with `@import "tailwindcss" source(none)`, `@source "../src"`, `@theme inline { … }`. No `tailwind.config.js`. |
| Components | **shadcn/ui** | style `new-york`, baseColor `slate`, `cssVariables: true` | 50+ primitives in `src/components/ui/`. **The home page uses none of them.** |
| Icons | **lucide-react** | `0.575.0` | Used in the home page. |
| Map | **Leaflet** | `1.9.4` | Dynamically imported client-side. No react-leaflet. |
| Data fetching | TanStack React Query v5 | `5.83.0` | `QueryClient` provided in router context. **The home page never uses it.** |
| Database | Supabase JS | `2.105.4` | **The home page never touches it.** |
| Language | TypeScript `5.8.3`, `strict: true` | | `@/*` → `./src/*` |
| Lint/format | ESLint 9 flat config + Prettier 3 | | |
| Runtime | Node `>=22.12.0`, npm `10.9.2` | | `bun.lock` and `package-lock.json` both committed — npm is authoritative (`packageManager` field + nixpacks uses `npm ci`). |
| Deploy | Railway via Nixpacks | | `node .output/server/index.mjs`, **healthcheckPath `/`** — the home page must SSR a non-5xx or deploys fail. `wrangler.jsonc` also present (Cloudflare path). |
| Origin | Lovable (`lovable.dev`) | | `.lovable/`, project `59dce3d3-f156-4a7a-9ade-10f6ec85914e`. Live at `rakshak-shield-page.lovable.app`. |

### Non-negotiable stack constraints for the new home page
1. It must be a **TanStack Start route**, not a Next.js page — `createFileRoute("/")` with a `component` and optional `head`/`loader`.
2. **Tailwind v4 CSS-first.** New tokens go in `src/styles.css` inside `@theme inline` + `:root`, not a JS config.
3. **SSR safety is mandatory.** No `window`/`document`/Leaflet at module scope. `scripts/ssr-smoke.mjs` (`npm run verify`) boots the prod build and fetches `/` — it fails the build on `window is not defined`, `Cannot find module`, `ReferenceError`.
4. Any browser-only library must be `await import()`-ed inside `useEffect` (this is exactly what `MapView.tsx` does with Leaflet).

---

## 2. Route wiring

```
src/routes/__root.tsx          ← html shell, <head>, fonts, styles.css, QueryClientProvider,
                                  404 component, error component
  └── src/routes/index.tsx     ← route "/" — 27 lines, only sets <head> meta + renders <RakshakApp/>
        └── src/components/rakshak/RakshakApp.tsx   ← the entire home page
```

### `src/routes/index.tsx` — the only route-level config
```ts
export const Route = createFileRoute("/")({
  component: Index,
  head: () => ({ meta: [ title, description, og:title, og:description ] }),
});
```
- **title:** `Project Rakshak — Crashfree India Road Safety Audit Platform`
- **description:** `Documenting risks, demanding accountability, saving lives — a youth-led road safety audit platform across India.`
- **og:title:** `Project Rakshak — Crashfree India`
- **og:description:** `Interactive map of crash-prone locations across India, audit findings, and petition tools.`
- No `loader`, no `validateSearch`, no `errorComponent`, no `pendingComponent` → falls back to the root/router defaults.
- **No canonical, no og:image, no twitter card, no JSON-LD** on the home page. (`__root.tsx` supplies site-wide twitter tags, but they describe the *internal portal*, not the public page — see §8.)

### `src/routes/__root.tsx` — what it gives the home page for free
- `<html lang="en">` shell, `<HeadContent/>`, `<Scripts/>`.
- `QueryClientProvider` wrapping `<Outlet/>`.
- `installClientErrorReporter()` on mount (global `error` + `unhandledrejection` → console).
- Google Fonts stylesheet: **Fraunces, DM Sans, DM Mono, Montserrat, Geist** (one request, `display=swap`, with preconnects).
- `src/styles.css`.
- **Root-level meta that the home page does not override:** `og:site_name`, `og:type`, `twitter:card/title/description`, `author` — all currently say *"Rakshak's Portal — the internal operations platform…"*, which is wrong for the public landing page.

---

## 3. Component tree & file inventory

All under `src/components/rakshak/` — **12 files, ~48 KB of source**, completely self-contained.

```
RakshakApp.tsx        3.4K   State owner + layout shell (.rk-app)
├── Nav.tsx           2.2K   Top bar: logo | title+tagline | 4 actions
├── StatsBar.tsx      1.8K   4 hardcoded KPIs + contextual selected-location block
├── (div.main)
│   ├── Sidebar.tsx   6.5K   Search + 3 filter groups + selected card + location list
│   ├── MapView.tsx  10.9K   Leaflet map, 31 markers, India GeoJSON, risk legend, reset btn
│   └── DetailPanel.tsx 6.3K Full audit dossier for the selected location
├── Footer.tsx        1.3K   Copyright + 20 academic-partner logos
├── PetitionModal.tsx 4.2K   Letter generator (copy / mailto / download)
├── ReportModal.tsx   6.9K   Hazard report form → mailto
├── StatusLegend.tsx  2.5K   Status legend + exported STATUS_DESCRIPTIONS map
├── data.ts           2.3K   Typed re-exports of all JSON + 3 helper fns
└── types.ts          0.9K   Location / Risk / StatusKey / StatusMeta / FiltersState
```

### Layout geometry (fixed pixels, CSS in `src/styles.css`)
```
┌──────────────────────────────────────────────────────────────┐
│ .nav                                    height 62px         │
├──────────────────────────────────────────────────────────────┤
│ .stats-bar                              height 52px         │
├───────────┬──────────────────────────────┬───────────────────┤
│ .sidebar  │ .map-wrap                    │ .detail           │
│  230px    │ flex:1                       │ 0 → 370px         │
│  fixed    │                              │ (width transition │
│           │                              │  .25s ease)       │
├───────────┴──────────────────────────────┴───────────────────┤
│ .footer                                 auto (~58px)        │
└──────────────────────────────────────────────────────────────┘
Root: position:fixed; inset:0; height:100dvh; width:100vw; overflow:hidden
Plus: html:has(.rk-app), body:has(.rk-app) { height:100%; overflow:hidden }
```
This is an **app shell, not a scrolling page.** Only `.sb-filters`, `.loc-scroll`, `.d-scroll`, `.state-chips-wrap` and `.m-body` scroll internally.

---

## 4. State model

All state lives in **`RakshakApp.tsx`** — 4 `useState` hooks, no context, no store, no URL state.

```ts
filters:   { auth: string; status: string; state: string; search: string }  // all default "all" / ""
activeId:  number | null    // selected location
petitionId: number | null   // which location's petition modal is open
reportId:  number | null    // which location's report modal is open
```

Derived with `useMemo`:
- `visible` — `LOC` filtered by auth AND status AND state AND a case-insensitive substring match over `` `${n} ${ci} ${st}` ``.
- `visibleIds` — `Set<number>` handed to `MapView` to toggle marker visibility.
- `active` / `petitionLoc` / `reportLoc` — `LOC.find(...)` lookups.

**Map imperative bridge:** `MapView` receives a `registerApi` callback and hands back `{ zoomToState, resetIndia }`, stored in `mapApi` (a `useRef`). The sidebar's state filter calls `mapApi.current?.zoomToState(s)`. This is the one non-declarative seam in the page.

### Known state smells to fix in the rebuild
- **No URL state.** You cannot deep-link a location or share a filtered view. 31 rich audit dossiers are unreachable by URL and invisible to search engines. → in TanStack Start, use `validateSearch` (`?loc=`, `?state=`, `?status=`) or a real `/audit/$slug` child route.
- `openPetitionGlobal()` / `openReportGlobal()` (nav buttons with nothing selected) **default to location `id: 1`** and use `setTimeout(..., 250)` to wait out the panel animation. Arbitrary and fragile.
- `MapView` assigns `onSelectRef.current = onSelect` **during render** (side effect in the render body).
- `invalidateMapSize()` is exported from `MapView.tsx` and **never called anywhere** — so Leaflet never re-measures when the 370 px detail panel opens/closes. Live layout bug.

---

## 5. Data — every dataset the home page reads

**Everything is static JSON, imported at build time and bundled into the client.** No API, no database, no loader, no revalidation. Typed via `as` casts in `data.ts` (no runtime schema validation).

| File | Size | Shape | Contents |
|---|---|---|---|
| `src/data/locations.json` | **51 KB** | `Location[]` | **31 audit sites** (ids 1–31) |
| `src/data/statusMeta.json` | 800 B | `Record<StatusKey, StatusMeta>` | 7 statuses: label, colour, bg, icon (all empty), step index |
| `src/data/riskMeta.json` | 179 B | `{RC, RL}` | 3 risk colours + labels |
| `src/data/progressSteps.json` | 345 B | `{k,l}[]` | 6 ordered pipeline steps (`stalled` excluded) |
| `src/data/authCategories.json` | 337 B | `{k,l,d}[]` | 4 authority categories |
| `src/data/stateBounds.json` | 1.3 KB | `Record<string,[[lat,lng],[lat,lng]]>` | Fallback bounding boxes for 13 states |
| `src/data/geoNameMap.json` | 61 B | `Record<string,string>` | 2 aliases: `NCT of Delhi→Delhi`, `Uttaranchal→Uttarakhand` |
| `src/data/siteMaps.json` | 1.3 KB | `Record<string,string>` | **28** Google Drive file IDs (missing for ids **12, 29, 31**) |
| `src/data/universities.json` | 1.4 KB | `{name,file}[]` | 20 academic partners |
| `src/data/logo.ts` | **41 KB** | base64 data URI | **DEAD CODE — nothing imports it. Delete.** |
| `src/assets/universities/*.png` | 20 files | | Resolved via `import.meta.glob(..., {eager:true, query:"?url"})` |
| `src/assets/brand/cfi-logo-white.svg` | 19 KB | | Used in `Nav`. All 15 marks are `#FFFFFF`. See the logo bug in §6.1. |
| `src/assets/brand/cfi-logo-primary.svg` | 19 KB | | **Unused.** Same geometry, marks in `#4736FE` — note this is *not* the design-system blue `#4A35FF`. |

### `Location` record — the full schema (terse keys)
```ts
{
  id: number;          // 1–31
  n: string;           // location name        e.g. "Kunnamangalam Junction"
  ci: string;          // city                 e.g. "Kozhikode"
  st: string;          // state                e.g. "Kerala"
  lat: number; lng: number;
  risk: "high" | "medium" | "low";
  auth: "nhai" | "state_pwd" | "municipal" | "dev_auth";   // filter category
  type: string;        // e.g. "Y-Junction on NH 766"
  status: StatusKey;
  crash: string;       // 1–3 sentence crash-prone narrative w/ fatality counts
  findings: string[];  // 3–5 audit findings
  sols: { i: string; c: string }[];   // intervention + cost ("₹8–15 lakh")
  impact: string;      // "Estimated 35–40% crash reduction…"
  auths: { n: string; r: string; p?: boolean }[];  // authorities; p = PRIMARY
  why: string;         // "Why not yet implemented"
  team: string;        // audit team name, e.g. "CrashZero"
  pto: string;         // petition addressee, e.g. "Executive Engineer, PWD NH Division, Kozhikode"
  pmail: string;       // petition mailto target, e.g. "dc.kozhikode@kerala.gov.in"
}
```

### Actual data distribution (computed from the JSON)
```
Total locations         31
Distinct cities         16     ← StatsBar displays "18"
Distinct states         13     Andhra Pradesh, Arunachal Pradesh, Assam, Delhi, Gujarat,
                               Kerala, Madhya Pradesh, Maharashtra, Punjab, Tamil Nadu,
                               Uttar Pradesh, Uttarakhand, West Bengal
Risk        high 7   |  medium 15  |  low 9
Authority   municipal 13 | state_pwd 10 | nhai 7 | dev_auth 1
Status      in_principle_approval 15 | implementation_ongoing 7 | submitted 6
            implemented 1 | audit_complete 1 | stalled 1 | in_audit 0
```

### Status taxonomy (`statusMeta.json` + `StatusLegend.tsx`)
| key | label | step | colour | description (source of truth for copy) |
|---|---|---|---|---|
| `in_audit` | In Audit | 1 | `#9333EA` | Team is currently auditing this site and collecting evidence. |
| `audit_complete` | Audited | 2 | `#6B7280` | Audit is finished; report is being prepared. |
| `submitted` | Report Submitted | 3 | `#2563EB` | Report submitted to the responsible authority for review. |
| `in_principle_approval` | Approved | 4 | `#7C3AED` | Authority has approved the proposed intervention. |
| `implementation_ongoing` | In Progress | 5 | `#D97706` | Civil work or remediation is actively in progress. |
| `implemented` | Implemented | 6 | `#059669` | Fix is completed and verified on the ground. |
| `stalled` | Stalled | **-1** | `#DC2626` | No response from authority — escalation required. |

`stalled` has step `-1` so `DetailPanel` short-circuits the 6-step progress bar and renders a red banner instead.

### Risk taxonomy (`riskMeta.json`)
| key | label | colour |
|---|---|---|
| `high` | High Risk | `#C8201A` |
| `medium` | Medium Risk | `#C45D0A` |
| `low` | Lower Risk | `#1A6E3A` |

### Helpers in `data.ts` (reusable — keep them)
- `uniLogoUrl(file)` → resolves a university logo URL from the Vite glob map.
- `getSiteMapUrl(id)` → `https://drive.google.com/thumbnail?id=<fileId>&sz=w800` or `null`.
- `getAuthShort(authStr)` → shortens an authority name for button labels ("NHAI", the text in `(BRACKETS)`, or a 24-char truncation). Drives the `Write to {authShort}` CTA.

> ⚠️ **`data.ts` is a shared dependency.** `UNIS` and `uniLogoUrl` are imported by
> `src/routes/rakshak-platform.impact.tsx` and `src/routes/rakshak-platform.impact_.institutions.tsx`.
> If the home page is replaced, **keep or relocate `data.ts`** — do not delete it.

---

## 6. Feature inventory — every interaction on the page

### 6.1 Nav (`Nav.tsx`)
| Element | Type | Behaviour |
|---|---|---|
| CFI logo | `<img>` | Decorative. `cursor:pointer` but **no click handler**. 🔴 **See logo bug below.** |
| "Project Rakshak" + tagline | text | `Documenting risks · Demanding accountability · Saving lives` |
| **Impact** | `<a href="/rakshak-platform/impact">` | Full page navigation (not a router `<Link>`) |
| **Report a Road Hazard** | `<button>` | Opens `ReportModal` (defaults to location 1 if none selected) |
| **Sign a Petition** | `<button>` | Opens `PetitionModal` (defaults to location 1 if none selected) |
| **Portal Sign In** | `<a href="/rakshak-platform/auth">` | Inline-styled `#4A35FF` — the only brand-blue element on the whole page |

> 🔴 **Logo bug.** `Nav.tsx` renders `cfi-logo-white.svg` — whose 15 marks are all `#FFFFFF` —
> with an inline `style={{ filter: "none" }}` that cancels the stylesheet's
> `.nav-logo-img { filter: invert(1) }`. The nav background is `#fff`. **White logo on a white
> bar: the Crashfree India logo is invisible.** The brand-correct fix is
> `cfi-logo-primary.svg` (blue marks) with no filter — never an `invert()` hack, which the
> design system's logo rules forbid. Note the primary asset is `#4736FE`, not the
> design-system `#4A35FF`; get a corrected asset while you are in there.

### 6.2 StatsBar (`StatsBar.tsx`)
Four **hardcoded** KPIs — no computation, no data source:
| Displayed | Label | Reality check |
|---|---|---|
| `31` | Audited Sites | ✅ matches `locations.json` |
| `18` | Cities | ❌ actual distinct cities = **16** |
| `25` | Approvals | ❌ doesn't reconcile: `in_principle_approval` = 15; approved-or-beyond = 23 |
| `30%` | Crash Reduction Est. | ⚠️ not derived from any field (per-location `impact` strings say 30–40%) |

Plus a contextual right-hand block (`.stat-ctx`, width matched to the 370 px detail panel) that appears on selection: risk dot + `City (State)` + `Primary: <authShort>` + a close button.

### 6.3 Sidebar (`Sidebar.tsx`)
1. **Search** — free-text over name + city + state, live substring filter.
2. **Selected Location card** — name, primary authority, status pill (with tooltip from `STATUS_DESCRIPTIONS`), "Clear selection".
3. **Responsible Authority filter** — "All" + 4 category chips, each with a live count.
4. **Status filter** — 6 chips: All / In Progress / Approved / Submitted / Audited / Stalled. (`in_audit` and `implemented` are **not filterable** despite existing in the taxonomy.)
5. **Status legend** — `<StatusLegend compact />`, 7 statuses in a 2-col grid.
6. **State filter** — "All" + 13 state chips in a `max-height:130px` scroller. Selecting a state also **flies the map** to that state.
7. **Location list** — risk dot + name + city + status dot, click to select, `.active` highlight, empty state `"No locations match your filters"`.

> ⚠️ The authority chips and state chips are `<span onClick>` — **not keyboard reachable**, no `role`, no `aria-pressed`. Only the status chips are real `<button>`s. Fix in the rebuild.

### 6.4 MapView (`MapView.tsx`)
- Leaflet `L.map` at `[22.5, 80.5]` zoom 5, `minZoom:4`, `maxZoom:14`, `maxBounds [[2,60],[40,102]]`, attribution off. **No tile layer** — the basemap is the India GeoJSON polygon fill (`#EDE8DE`, hover `#DDD7C8`).
- **India state outlines fetched at runtime** from a 3-URL fallback chain:
  1. `gist.githubusercontent.com/jbrobst/56c13bbbf9d97d187fea01ca62ea5112/...india_states.geojson`
  2. `raw.githubusercontent.com/geohacker/india/master/state/india_state.geojson`
  3. `raw.githubusercontent.com/datameet/maps/master/States/India_State_Boundary.geojson`
  Property key is auto-detected (`ST_NM` → `NAME_1` → `name`) and normalised through `geoNameMap.json`.
  On total failure: `report("geojson-fetch-failed")`, an alert card, and a **Retry** button. Markers still work.
- **31 custom `divIcon` markers** coloured by risk. Popup on hover (`mouseover`/`mouseout`) with name, city, risk pill, status, "Click to view full audit →". Click → select + `zoomToState`.
- Marker visibility toggled by `visibleIds` on every filter change.
- **"India View"** reset button (top-right) and a static **Risk Level legend** (bottom-left, `pointer-events:none`).

> ⚠️ The map outline depends on **third-party GitHub gists**. Self-host the GeoJSON in `public/` for the rebuild.

### 6.5 DetailPanel (`DetailPanel.tsx`) — the content payload
Slides in to 370 px. Sections in order:
1. **Hero** — close button, risk badge, `City (State)`, location name (Fraunces), type chip.
2. **Site Map** — Google Drive thumbnail image (28 of 31 locations). Has a "Full view" affordance and `cursor:pointer` but **no lightbox / no click handler**.
3. **Implementation Progress** — 6-step progress bar driven by `statusMeta.s`, or a red "Stalled" banner. Plus `Audit Team: {team}`.
4. **Why This Location is Crash-Prone** — `crash`.
5. **Audit Findings** — bulleted `findings[]`.
6. **Recommended Solutions & Costs** — `sols[]`, cost in DM Mono.
7. **Estimated Impact** — `impact`, green gradient box.
8. **Responsible Authorities** — `auths[]`, PRIMARY tagged and left-bordered.
9. **Why Not Yet Implemented** — `why`, amber box.
10. **CTA row** — `Write to {authShort}` (→ PetitionModal) + `Report an Issue` (→ ReportModal).

### 6.6 Footer (`Footer.tsx`)
Copyright line `© 2025 Crashfree India · Vision Zero Trust · info@crashfreeindia.org` + "Academic Partners" + 20 horizontally-scrolling university logos (initials badge fallback). Partner names render only as `title` tooltips (`.uni-name` is `display:none`).

---

## 7. ⚠️ The petition & report flows — **is anything actually being sent?**

### Short answer: **No. Nothing is submitted, stored, counted, or emailed by the system.**

Both "actions" are 100 % client-side. There is **no Supabase call, no server function, no API route, no `fetch` POST, no react-query mutation** anywhere in `src/components/rakshak/`. The only network request the whole page makes is the GeoJSON `GET` in `MapView`. Confirmed by search: no `petition`/`hazard_report`/`community_report` table exists in `supabase/migrations/`, and no matching route exists in `src/routes/api/`.

### 7.1 PetitionModal — a letter *generator*
`buildLetter(loc)` composes a plain-text formal petition from the location record:
```
Date: <today, en-IN long format>
To, <loc.pto>
Subject: Road Safety Petition — <loc.n>, <loc.ci>

… preamble naming Project Rakshak, Crashfree India, IIT Delhi & IIT Kharagpur oversight …

KEY PROBLEMS IDENTIFIED:      → numbered loc.findings
RECOMMENDED INTERVENTIONS:    → numbered loc.sols[].i
ESTIMATED IMPACT:             → loc.impact

4 numbered requests (nodal officer / inspection in 30 days / next budget cycle / written response)
Legal hook: Motor Vehicles (Amendment) Act 2019, Section 215B — DRSC mandate

Yours faithfully,
[Your Name]
[Your Address & Contact]

cc: DRSC <loc.ci> — <loc.pmail>
    <every non-primary authority from loc.auths>
    Crashfree India | info@crashfreeindia.org
```

Three buttons, and that is the entire capability:

| Button | Implementation | Actually happens |
|---|---|---|
| **Copy Letter** | `navigator.clipboard.writeText(letter)` | Text on clipboard. "Copied" flash for 2.2 s. Nothing recorded. **No `.catch()`** — silently dead on insecure contexts / denied permission. |
| **Send via Email ↗** | `window.open("mailto:" + loc.pmail + "?subject=…&body=…")` | Hands off to the OS mail client. **We never learn whether it was sent.** |
| **Download .txt** | `Blob` + synthetic `<a download>` | Saves `Petition_<name>_<city>.txt` locally. |

**Consequences / gaps:**
- **No signature count.** A petition tool that cannot count signatures has no evidence of public demand — the single biggest product gap on this page.
- No record of who petitioned which authority, so no follow-up, no escalation trigger, no "25 people wrote to NHAI about this junction".
- `mailto:` with a **~1.5–2.5 KB URL-encoded body** is unreliable: several mail clients truncate long `mailto` bodies, and users on webmail (Gmail in a browser) usually have no `mailto` handler at all → the button appears to do nothing.
- The letter placeholders `[Your Name]` / `[Your Address & Contact]` are never filled — the user must edit them manually in their mail client.
- `pmail` is the **DRSC/District Collector** address for every Kerala location (`dc.kozhikode@kerala.gov.in`), while `pto` names a different officer. The addressee and the recipient disagree.

### 7.2 ReportModal — a mailto form
Fields: **Email** (required), **description** (optional, 400-char cap with counter), **photo** (optional), **"also sign the community petition"** checkbox (default **checked**).

On **Submit Report**:
1. Validate: `email.trim().includes("@")` — that's the whole check.
2. Compose a plain-text body: date, reporter email, location, risk level, description, `Sign Petition: YES/No`.
3. `window.open("mailto:info@crashfreeindia.org?subject=…&body=…")`.
4. `setSubmitted(true)` → success screen.

**Bugs / integrity problems:**
- 🔴 **The photo is never uploaded.** Only `e.target.files[0].name` is stored in React state. The `File` is never read, validated, or transmitted. The UI promises `JPG or PNG · max 5MB` and shows a ✓ with the filename — none of it is enforced or honoured.
- 🔴 **The success screen lies.** `"Thank you for reporting! Your experience has been shared with the Crashfree India team."` and `"We'll notify progress at <email>"` are shown unconditionally after `window.open()` — even if the mail client never opened, or the user closed the draft without sending. Nothing was shared and no one can notify that address, because the address was never stored.
- The petition checkbox produces one line of text in an email body. No petition record, no aggregate.
- Email validation accepts `@`.
- No rate limiting, no spam protection, no consent/privacy notice for collecting an email address.

### 7.3 What *is* connected (the complete external-dependency list)
| Dependency | Direction | Purpose | Risk |
|---|---|---|---|
| GitHub gists ×3 (`gist.githubusercontent.com`, `raw.githubusercontent.com`) | `GET` at runtime | India state GeoJSON | 3rd-party, unversioned, no SLA. Has a fallback chain + retry UI. |
| `drive.google.com/thumbnail?id=…` | `<img>` hotlink | 28 site-map images | Public-link dependent, unauthenticated, no CDN, rate-limitable |
| `fonts.googleapis.com` / `fonts.gstatic.com` | `<link>` | 5 font families | Standard |
| `/rakshak-platform/impact` | outbound link | Impact dashboard | Internal |
| `/rakshak-platform/auth` | outbound link | Portal sign-in | Internal |
| `mailto:` | outbound | Petition + report | Client-dependent, unobservable |
| **Supabase** | — | **not used by this page** | |
| **Analytics** | — | **none, anywhere on the page** | |

### 7.4 There *is* a live data path — it's just not wired to the home page
`src/lib/rakshak-platform/stats.functions.ts → getPublicImpactStats()` is a real TanStack `createServerFn` that reads live Supabase counts (`rp_teams`, `rp_locations`, `rp_authority_reports`, `rp_certificates`, `rp_submissions`) plus distinct institutions/cities/states and a live location list. `/rakshak-platform/impact` consumes it through `queryClient.ensureQueryData`.

**But `rp_locations` is a thin table** — `location_name, address, city, state, latitude, longitude, issue_type, severity, description, is_final_selected, authority_jurisdiction`. It has **no** `findings`, `sols` + costs, `impact`, `auths`, `why`, `team`, `pto`, `pmail`, or the 7-state status workflow.

**So:** `locations.json` is the *only* home for the rich editorial audit content, and it duplicates city/state/lat/lng with the live table.

Pick one of three postures for the new home page and be explicit about it:
- **A. Keep static JSON** (fastest, SSG-friendly, zero DB risk) — but keep fixing counts by hand and accept that home-page numbers drift from the platform's live numbers.
- **B. Hybrid (recommended):** derive the **KPI strip** from `getPublicImpactStats()` (so it can never drift) and keep the 31 dossiers in versioned JSON/MDX as editorial content.
- **C. Fully live** — requires extending `rp_locations` (or a new `rp_public_audits` view) with the findings/solutions/authorities/status columns first. Real migration work.

---

## 8. Design language — this is the part that will bite you

**There are two different, incompatible design languages in this repository, and the home page is the odd one out.**

### 8.1 Home page language (`.rk-app`) — "warm editorial / newspaper"
Defined in `src/styles.css` **lines 254–516** (≈256 lines of hand-written global CSS). It is a **direct port of `public/legacy.html`** (1,307 lines, still shipping in `public/`).

**Palette — all raw hex, all bespoke:**
```
--bg        #F7F5F0   warm paper background
--surface   #FFFFFF   --surface2  #FAFAF7
--rk-border #E8E3DA   --rk-border2 #D4CEBF
--text      #1A1714   --text2 #5C5650   --text3 #9C9690
--navy      #0F1B30   ← the primary action colour (buttons, active chips, progress)
--high      #C8201A   bg #FEF0EF  bdr #FBCECA
--med       #C45D0A   bg #FFF5EC  bdr #FDD9B0
--low       #1A6E3A   bg #EEF9F2  bdr #AADDC0
--rk-radius 10px      --detail-w 370px
3 shadow tokens: --sh / --sh-md / --sh-lg
```

**Typography:**
| Role | Font | Notes |
|---|---|---|
| Display (nav title, location name, modal title, stat values, success title) | **Fraunces** (serif) | 14–18 px |
| Body / UI | **DM Sans** | base 14 px, most UI at 9–12 px |
| Costs (`.sol-c`) | **DM Mono** | 10 px |
| Petition letter block (`.letter`) | **Montserrat** | 11 px |

**Idioms:** 100 dvh fixed app shell · dense micro-typography (9–12 px, heavy uppercase tracking on labels) · 100 px pill chips · 10 px radii · hairline `#E8E3DA` borders everywhere · navy as the single action colour · gradient accents (`.sb-selected`, `.impact-box`) · `.overlay` + `.modal` at `z-index 2000`.

**Critical:** **`@media` query count in the entire stylesheet = 0.** The home page has **no responsive behaviour at all.** With `position:fixed; inset:0; overflow:hidden` and fixed 230 px / 370 px columns, below roughly 1100 px the nav's 4 buttons collide and below ~900 px the map is squeezed to nothing. On a phone it is effectively unusable. (`playwright.config.ts` does define a `mobile-pixel-5` project — but no e2e test visits `/`.)

### 8.2 Platform language (`.rp-platform`) — the *brand* system
Also in `src/styles.css` (lines 146–253), and it is what every other route uses:
```
--brand       #4A35FF   --brand-lite #F3F1FF   --brand-foreground #FFFFFF
--rp-danger   #F10015   --rp-warning #F57C00   --rp-success #00AA44
--rp-border   #EDEEF2
--foreground  #1a1c1c   --muted-foreground #777589
--font-heading 'Montserrat'   --font-body 'Geist'
```
Exposed as Tailwind tokens via `@theme inline`: `bg-brand`, `text-brand`, `border-border`, `text-danger`, `font-heading`, … plus `.rp-btn-primary` / `.rp-btn-secondary` / `.rp-input` component classes, shadcn/ui primitives, `rounded-2xl` cards, `rounded-full h-12` buttons.

### 8.3 Side-by-side
| | Home page (`.rk-app`) | Platform (`.rp-platform`) | **CFI Design System** |
|---|---|---|---|
| Primary action colour | `#0F1B30` navy | `#4A35FF` | **`#4A35FF`** |
| Danger | `#C8201A` | `#F10015` | **`#F10015`** |
| Warning | `#C45D0A` | `#F57C00` | **`#F57C00`** |
| Success | `#1A6E3A` | `#00AA44` | **`#00AA44`** |
| Border | `#E8E3DA` | `#EDEEF2` | **`#EDEEF2`** |
| Background | `#F7F5F0` warm | `#FFFFFF` | **`#FFFFFF` / `#F3F1FF` / `#4A35FF` rotation** |
| Heading font | **Fraunces** | Montserrat | **Montserrat** |
| Body font | **DM Sans** | Geist | **Geist** |
| Styling method | hand-written global CSS, raw hex | Tailwind semantic tokens | **semantic tokens, no hex** |
| Radii | 7–14 px bespoke | `rounded-2xl` / `rounded-full` | **`rounded-2xl` cards, `rounded-full` buttons** |
| Component library | none | shadcn/ui | shadcn/ui |
| Responsive | **none** | yes | **375 / 768 / 1200 required** |
| Spacing | arbitrary odd px (3, 7, 9, 11, 13) | 4 px grid | **4 px grid only** |

**Conclusion:** the home page currently violates the Crashfree India design system on colour, typography, hardcoded hex, spacing grid, and responsiveness. The rest of the app complies. **The new home page should be built in the platform/brand language (§8.2), not the legacy one.** The only element on the current page already in brand is the inline `#4A35FF` on the "Portal Sign In" button.

### 8.4 Copy & tone (currently on the page — keep, it's on-brand)
The written voice already matches the CFI tone rules (empirical, direct, accountability-focused):
- `Documenting risks · Demanding accountability · Saving lives`
- `Why This Location is Crash-Prone` / `Why Not Yet Implemented`
- `Stalled — No response from responsible authorities. Escalation needed.`
- `Write to NHAI` (not "Contact us")
- Costs stated in ₹ lakh; impact stated as a % range; the MV Act §215B legal hook.
- One deviation: the report success screen's `"Together we can make India's roads safer."` is the soft/emotive register the brand tone rules exclude — and it is factually wrong (§7.2).

---

## 9. User flows (as built today)

### Flow A — explore
```
land on /  →  SSR shell (nav / stats / sidebar / footer render immediately)
           →  useEffect: dynamic import leaflet → mount map → 31 markers
           →  fetch India GeoJSON (fallback chain) → flyToBounds(India)
           →  hover marker  → popup card
           →  click marker  → select + zoomToState + open detail panel (370px)
           →  read dossier: site map, 6-step progress, crash cause, findings,
              solutions + costs, impact, authorities, why-not-implemented
```

### Flow B — filter
```
sidebar: search text | authority chip | status chip | state chip
      →  visible[] recomputed  →  location list re-renders
      →  visibleIds  →  markers added/removed on the map
      →  (state chip only) map flies to that state's bounds
      →  "India View" button resets  |  "Clear selection" closes the panel
```

### Flow C — petition (**terminates in the user's mail client; nothing reaches us**)
```
"Sign a Petition" (nav, defaults to id 1)  OR  "Write to <Authority>" (detail CTA)
      →  PetitionModal: pre-built formal letter, addressee + subject shown
      →  Copy Letter  →  clipboard
      →  Send via Email ↗  →  mailto:<loc.pmail>  →  OS mail client, prefilled
      →  Download .txt  →  local file
      →  END. No record, no count, no confirmation, no follow-up.
```

### Flow D — report a hazard (**same dead end, plus a false confirmation**)
```
"Report a Road Hazard" (nav, defaults to id 1)  OR  "Report an Issue" (detail CTA)
      →  ReportModal: email* + description + photo + petition checkbox
      →  Submit  →  email must contain "@"  →  mailto:info@crashfreeindia.org
      →  success screen: "shared with the Crashfree India team",
         "we'll notify progress at <email>"     ← NOT TRUE
      →  photo discarded, email never stored, petition tick never recorded
```

---

## 10. Coupling — what breaks when you swap the home page in

| Item | Status | Action |
|---|---|---|
| `src/components/rakshak/data.ts` (`UNIS`, `uniLogoUrl`) | **SHARED** — imported by `rakshak-platform.impact.tsx` and `rakshak-platform.impact_.institutions.tsx` | **Keep or relocate** (e.g. `src/lib/partners.ts`) and update both importers |
| `src/assets/universities/*` (20 PNGs) | Shared via the glob in `data.ts` | Keep |
| `styles.css` lines 254–516 (`.rk-app` block) | **Home-page only.** Verified: no other route uses `.nav`, `.stat`, `.chip`, `.modal`, `.overlay`, `.footer`, `.legend`, `.search`, `.detail`, `.f-inp`. (`.btn-p`/`.btn-o` only matched `rp-btn-primary` as a substring — no real collision.) | **Safe to delete** once the new page ships. Deleting it drops ~256 lines of global CSS. |
| Legacy `:root` block (line 262) defining `--bg`, `--text`, `--navy`, … | Global scope but distinct names from the Tailwind tokens | Remove with the block |
| Fonts in `__root.tsx` (`Fraunces`, `DM Mono`) | Only the home page uses them | Drop from the Google Fonts URL → smaller font payload |
| `public/legacy.html` (1,307 lines) | Dead artefact, still publicly served | Delete |
| `src/data/logo.ts` (41 KB base64) | **Dead code**, zero importers | Delete |
| `src/routes/index.tsx` head meta | Home-page only | Rewrite (add `og:image`, canonical, JSON-LD) |
| `__root.tsx` site-wide meta | Currently describes the *internal portal* | Fix — the public page should not inherit "internal operations platform" as its twitter/og description |
| Railway `healthcheckPath: "/"` | Deploy gate | The new `/` must SSR non-5xx |
| `scripts/ssr-smoke.mjs` | Fetches `/` in CI | Must keep passing (`npm run verify`) |
| E2E tests | **None touch `/`** | Add coverage while rebuilding |

---

## 11. Punch list for the rebuild

### Correctness / integrity (do these)
1. **Make the petition real** — persist signatures (`rp_petitions` + `rp_petition_signatures`), show live counts per location, send via Resend (already a dependency, `resend@6.12.4` + `@lovable.dev/email-js`) instead of `mailto:`.
2. **Make the report real** — a server function that writes the row, uploads the photo to Supabase Storage, and emails the team. Enforce the advertised 5 MB / JPG-PNG limit.
3. **Stop showing a success screen for something that did not happen** — confirm only after a server acknowledgement.
4. **Derive the KPI strip from data** (or from `getPublicImpactStats()`). `18 cities` is wrong; `25 approvals` is unexplained.
5. Wire the detail panel's site map to a real lightbox, or remove the "Full view" affordance.
6. Fill `[Your Name]` / `[Your Address & Contact]` from form fields instead of leaving placeholders.
7. Reconcile `pto` (officer) vs `pmail` (District Collector) per location.

### Architecture
8. **Put state in the URL** — `validateSearch` for filters + a `loc`/slug param, so locations are deep-linkable, shareable and indexable. 31 rich dossiers currently have zero SEO surface.
9. **Self-host the India GeoJSON** in `public/` (versioned) instead of fetching third-party gists.
10. Move site maps off Google Drive hotlinks into Supabase Storage or `public/`.
11. Add a runtime schema (zod is already a dependency) for `locations.json` instead of `as Location[]`.
12. Consider renaming the terse keys (`n`, `ci`, `st`, `sols`, `auths`, `pto`, `pmail`) to readable fields — this file is edited by humans.
13. Call `map.invalidateSize()` when the detail panel opens/closes (`invalidateMapSize` exists and is never used).
14. Add analytics events — there are currently none on the page.
15. Remove the `setTimeout(250)` + "default to id 1" hack in the nav CTAs (open a location-agnostic petition/report flow instead).

### Design / brand
16. **Rebuild in the CFI brand language:** `#4A35FF` brand, `#F10015`/`#F57C00`/`#00AA44` semantics, `#EDEEF2` borders, Montserrat headings + Geist body, semantic Tailwind tokens (no raw hex), 4 px spacing grid, `rounded-2xl` cards, `rounded-full h-12` buttons.
17. **Make it responsive** — 375 / 768 / 1200. The three-column fixed shell needs a mobile pattern (bottom sheet for the detail panel, drawer for filters, full-bleed map).
18. Map the legacy risk/status colours onto the brand semantics: high→`danger`, medium→`warning`, low→`success`; and keep the 7 status colours as a documented data-viz ramp rather than ad-hoc hex.
19. Use shadcn/ui primitives (`Dialog`, `Sheet`, `Badge`, `Input`, `Checkbox`) instead of hand-rolled `.overlay`/`.modal`/`.chip`.
20. Fix the duplicate `background` declaration in `.nav-btn-outline` (or drop it with the legacy block).
21. **Fix the invisible nav logo** (§6.1) and source a `#4A35FF` logo asset — the committed "primary" SVG is `#4736FE`.

### Accessibility
22. Authority and state chips → real `<button>` with `aria-pressed`.
23. Modals → `role="dialog"`, `aria-modal`, focus trap, Escape to close, focus restore.
24. `navigator.clipboard.writeText` needs a `.catch()` and a fallback.
25. Verify 4.5:1 contrast — much of the UI is 9–11 px in `--text3 #9C9690` on `#FFFFFF` (**≈2.9:1 — fails WCAG AA**).
26. Touch targets to 44 px minimum (chips are currently ~20 px tall).

### Hygiene
27. Delete `src/data/logo.ts`, `public/legacy.html`, and the `.rk-app` CSS block after cutover.
28. Add e2e coverage for `/` (no test visits it today).
29. Fill the 3 missing site maps (locations **12, 29, 31**).
29. Fix `onSelectRef.current = onSelect` being assigned during render.

---

## 12. Merge checklist — bringing the new home page into this repo

- [ ] New page is a TanStack Start route: `createFileRoute("/")` in `src/routes/index.tsx` (keep the path; `/` is the Railway healthcheck).
- [ ] Components live under `src/components/<new-name>/` — do not reuse `src/components/rakshak/` so both can coexist during the cutover (e.g. temporarily mount the new page at `/preview` first).
- [ ] Styling uses the existing `@theme inline` tokens in `src/styles.css`. New tokens are added there, not in a JS config.
- [ ] No raw hex in `src/` — semantic tokens only.
- [ ] Only Montserrat + Geist. Remove Fraunces / DM Sans / DM Mono from the `__root.tsx` font URL once the legacy page is gone.
- [ ] Browser-only libs (Leaflet) are `await import()`-ed inside `useEffect`; nothing browser-global at module scope.
- [ ] `npm run build && npm run smoke` (`npm run verify`) passes — `/` must return < 500.
- [ ] `npx tsc --noEmit` clean (baseline today: 0 errors).
- [ ] `UNIS` / `uniLogoUrl` still resolve for `rakshak-platform.impact.tsx` and `…impact_.institutions.tsx`.
- [ ] Route `head` includes title, description, canonical, `og:image`, twitter card — and the public page no longer inherits the "internal operations platform" description from `__root.tsx`.
- [ ] Any new petition/report persistence ships with a Supabase migration + RLS policies (follow the `rp_*` conventions in `supabase/migrations/`).
- [ ] Legacy removal happens in a **separate commit** after the new page is verified: `src/components/rakshak/*` (minus `data.ts`), `styles.css` 254–516, `public/legacy.html`, `src/data/logo.ts`.
