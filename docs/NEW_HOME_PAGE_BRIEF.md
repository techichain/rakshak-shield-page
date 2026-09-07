# Brief: build the new Project Rakshak home page

Paste this into a fresh session that is building the replacement home page.
It is a **constraints brief**, not a design brief — the UI, layout, interactions and
information architecture are all being redesigned from scratch. What follows is only the
stuff that causes merge pain if it drifts.

Deep detail on the current page lives in `docs/HOME_PAGE_AUDIT.md`.

---

## 0. What you are doing

You are building a **brand-new public home page** for Project Rakshak (Crashfree India) that
will later be merged into the existing repo `techichain/rakshak-shield-page`.

The existing home page (route `/`) is being **completely replaced** — new UI, new layout, new
user flows. Do **not** try to preserve its design, its component structure, or its
interaction model. Do **not** treat it as a reference for how things should look or behave.

What you **must** match is the host project's technical and brand language, so the merge is a
clean add rather than a rewrite. That is what the rest of this brief is about.

---

## 1. Stack — match this exactly

| Layer | What it is |
|---|---|
| Meta-framework | **TanStack Start** `1.167.x` (SSR via Nitro, `preset: node-server`) |
| Router | **TanStack Router** `1.168.x`, **file-based** |
| UI | **React 19.2** — no RSC, no server components |
| Build | **Vite 7** |
| CSS | **Tailwind CSS v4** — CSS-first config |
| Components | **shadcn/ui**, style `new-york`, baseColor `slate`, `cssVariables: true` |
| Icons | **lucide-react** |
| Maps | **Leaflet 1.9.4** (plain Leaflet, **not** react-leaflet) |
| Server data | TanStack **React Query v5** + TanStack **`createServerFn`** |
| DB/Auth/Storage | **Supabase** (`@supabase/supabase-js` 2.x) |
| Email | **Resend** (`resend` 6.x) + `@lovable.dev/email-js` + `@react-email/components` |
| Forms | `react-hook-form` + `zod` + `@hookform/resolvers` |
| Language | TypeScript 5.8, `strict: true`, alias `@/*` → `./src/*` |
| Runtime | Node `>=22.12`, package manager **npm** |

### Hard "do not" list — each of these breaks the build or the merge

1. ❌ **Not Next.js.** No `app/`, no `pages/`, no `next/link`, no `next/image`, no
   `"use client"`, no `getServerSideProps`. If you catch yourself writing any of those, stop.
2. ❌ **Do not create `tailwind.config.js` / `tailwind.config.ts`.** Tailwind v4 here is
   configured entirely inside `src/styles.css`.
3. ❌ **Do not touch `vite.config.ts`** beyond what already exists. It uses
   `defineConfig` from `@lovable.dev/vite-tanstack-config`, which **already bundles**
   `tanstackStart`, `viteReact`, `tailwindcss`, `tsConfigPaths`, the Cloudflare build plugin,
   the dev-only component tagger, `VITE_*` env injection, the `@` alias and React/TanStack
   dedupe. **Re-adding any of these plugins breaks the app with duplicate-plugin errors.**
4. ❌ **Do not hand-edit `src/routeTree.gen.ts`** — it is generated.
5. ❌ **Do not use bun.** `bun.lock` is committed but npm is authoritative
   (`packageManager: npm@10.9.2`, and CI/Nixpacks runs `npm ci`).
6. ❌ **Do not add a CSS `@import` for fonts** in `src/styles.css`. CSS `@import` must precede
   all rules and breaks this build. Fonts are loaded via a `<link>` in `src/routes/__root.tsx`.
7. ❌ **Do not add new dependencies** without checking `package.json` first — most of what you
   need is already there.

---

## 2. Route conventions

Routes are **flat files** in `src/routes/`, dot-separated for nesting:

```
src/routes/index.tsx                     →  /
src/routes/__root.tsx                    →  the html shell (head, providers, 404, error)
src/routes/rakshak-platform.index.tsx    →  /rakshak-platform
src/routes/rakshak-platform.admin.teams.$teamId.tsx  →  /rakshak-platform/admin/teams/:teamId
src/routes/rakshak-platform.impact_.cities.tsx       →  trailing _ opts out of the parent layout
```

The home page route shape:

```tsx
import { createFileRoute } from "@tanstack/react-router";

export const Route = createFileRoute("/")({
  component: HomePage,
  // optional, for live data:
  // loader: ({ context }) => context.queryClient.ensureQueryData({ queryKey, queryFn }),
  // optional, for URL state:
  // validateSearch: …
  head: () => ({ meta: [ /* title, description, og:*, twitter:*, canonical */ ] }),
});
```

- Router context already provides `{ queryClient }` — get it with `Route.useRouteContext()`.
- Internal navigation uses `<Link to="…">` from `@tanstack/react-router`, not `<a href>`.
- `__root.tsx` already supplies the `<html>` shell, `<HeadContent/>`, `<Scripts/>`,
  `QueryClientProvider`, the stylesheet link, the font link, a 404 component and an error
  component. **Your page renders inside that — do not create another html/head/body.**

### ⚠️ `__root.tsx` currently carries wrong site-wide meta
Its `og:site_name`, `og:type`, `twitter:*` and `author` tags all describe *"Rakshak's Portal —
the internal operations platform"*. The public home page must **override** these in its own
`head()` (and it currently has no `og:image`, no canonical, no JSON-LD). Fix that as part of
the new page.

---

## 3. Styling contract — the most important section

### 3.1 Everything is Tailwind v4, CSS-first, in one file
`src/styles.css` starts with:
```css
@import "tailwindcss" source(none);
@source "../src";
@import "tw-animate-css";
@custom-variant dark (&:is(.dark *));
```
Tokens are declared as CSS variables in `:root` / `.dark` and **registered** for Tailwind in
`@theme inline { --color-<name>: var(--<name>) }`. New tokens go there. Nowhere else.

### 3.2 Use these existing semantic tokens — do not invent new ones

**Brand / status (already registered as Tailwind utilities):**
```
bg-brand            text-brand              #4A35FF   primary action, metrics, emphasis
bg-brand-lite                               #F3F1FF   soft brand tint / section wash
text-brand-foreground                       #FFFFFF   text on brand
bg-danger           text-danger             #F10015   critical / failure / death stats ONLY
                    text-warning            #F57C00   caution
bg-success          text-success            #00AA44   success / improvement
text-foreground                             #1a1c1c   body + headings
text-muted-foreground                       #777589   secondary text, captions
border-border                               #EDEEF2   ALL borders, hairlines, dividers
bg-background  bg-card                      #FFFFFF
bg-muted                                    #EEEEEE
```
Plus the full shadcn/slate set: `background foreground card popover primary secondary muted
accent destructive border input ring chart-1..5 sidebar*` (defined in oklch).

**Fonts (registered tokens):**
```
font-heading  →  'Montserrat', ui-sans-serif, system-ui, sans-serif
font-body     →  'Geist', ui-sans-serif, system-ui, sans-serif
```

**Existing component classes you can reuse:** `.rp-btn-primary`, `.rp-btn-secondary`,
`.rp-input` (scoped under `.rp-platform`).

### 3.3 The rules
- ❌ **No raw hex anywhere in `src/`.** No `bg-[#4A35FF]`, no `border-[#E5E5E5]`.
  Semantic tokens only. If a colour you need has no token, add one to `:root` + `@theme inline`.
- ✅ **Only Montserrat (headings) + Geist (body).** No Inter, Poppins, Roboto, Fraunces,
  DM Sans, DM Mono.
- ✅ **4px spacing grid.** `gap-2/3/4/6`, `p-6/7`, `py-24 lg:py-32`, `px-6 md:px-10`.
  No odd values like `3px`, `7px`, `9px`, `11px`, `13px`.
- ✅ **Radii:** `rounded-full` buttons/chips, `rounded-2xl` cards, `rounded-3xl` featured panels.
- ✅ **Section dividers:** `border-t border-border` only. No `<hr>`, no decorative rules.
- ✅ **Section backgrounds rotate** `bg-background` → `bg-brand-lite` → `bg-brand`. Never a
  near-black/gray dark section — a dark section is always `bg-brand`.
- ✅ **Standard section wrapper:**
  ```tsx
  <section className="border-t border-border bg-background">
    <div className="mx-auto w-full max-w-7xl px-6 py-24 md:px-10 lg:py-32">…</div>
  </section>
  ```
  Stick to `max-w-7xl`; don't mix in `max-w-5xl`/`max-w-6xl` for full-width sections.
- ✅ **Buttons:** `h-12 rounded-full bg-brand px-7 text-base text-brand-foreground hover:bg-brand/90`.
  Never `text-transform: uppercase`. Min 44px touch target.
- ✅ **Cards:** `rounded-2xl border border-border bg-card p-6`, shadow on hover only.
- ✅ **Responsive is mandatory:** 375 / 768 / 1200. (The old page had **zero** media queries
  and was desktop-only — that is the single worst thing about it. Do not repeat it.)
- ✅ Prefer **shadcn/ui primitives** (`Dialog`, `Sheet`, `Badge`, `Input`, `Checkbox`,
  `Accordion`, `Tabs`) from `@/components/ui/*` over hand-rolled CSS. They are already
  installed; `components.json` aliases are configured, so `npx shadcn@latest add <x>` works.
- ✅ Icons from `lucide-react`: `h-4 w-4` inline, `h-5 w-5` standard, `h-6 w-6` large.

### 3.4 The legacy stylesheet you are replacing
`src/styles.css` lines ~254–516 are a `.rk-app` block: ~256 lines of hand-written global CSS
with raw hex, unprefixed class names (`.nav`, `.stat`, `.chip`, `.sidebar`, `.detail`,
`.modal`, `.overlay`, `.footer`, `.legend`, `.search`, `.f-inp`, `.btn-p`, `.btn-o`, …), a
warm-paper palette (`#F7F5F0`), navy `#0F1B30` as the action colour, and Fraunces/DM Sans/
DM Mono typography. It is a direct port of `public/legacy.html`.

**Do not extend it, do not imitate it, and do not reuse any of those class names.** It is
scoped to the old home page only and gets deleted at cutover.

---

## 4. SSR safety — this will break your build if you get it wrong

The app server-renders every route. `npm run verify` (= `vite build && node
scripts/ssr-smoke.mjs`) boots the production build and fetches `/` among other routes, failing
on `window is not defined`, `document is not defined`, `Cannot find module`, `ReferenceError`.
Railway's healthcheck path is **`/`**, so a 5xx on the home page fails deploys.

Rules:
1. **Nothing browser-global at module scope.** No `window`, `document`, `localStorage`,
   `navigator`, `IntersectionObserver` at the top level of a module.
2. **Browser-only libraries are dynamically imported inside `useEffect`:**
   ```tsx
   useEffect(() => {
     let disposed = false;
     (async () => {
       const L = await import("leaflet");
       if (disposed) return;
       // …init
     })();
     return () => { disposed = true; /* teardown */ };
   }, []);
   ```
   This is exactly how the current `MapView.tsx` loads Leaflet. Keep the pattern.
3. A static `import "leaflet/dist/leaflet.css"` at the top of a component file **is** fine —
   Vite handles it.
4. Guard anything else with `typeof window === "undefined"`.

---

## 5. Data contract

The current page reads **only static JSON bundled at build time** — no API, no DB, no loader.
Files in `src/data/`. Keep these shapes (or rename deliberately and update the JSON in the
same commit), because the content is the product.

### `locations.json` — 31 audit sites, the core content
```ts
{
  id: number;          // 1–31
  n: string;           // location name   "Kunnamangalam Junction"
  ci: string;          // city            "Kozhikode"
  st: string;          // state           "Kerala"
  lat: number; lng: number;
  risk: "high" | "medium" | "low";
  auth: "nhai" | "state_pwd" | "municipal" | "dev_auth";
  type: string;        // "Y-Junction on NH 766"
  status: StatusKey;   // see below
  crash: string;       // crash-prone narrative with fatality/injury counts
  findings: string[];  // 3–5 audit findings
  sols: { i: string; c: string }[];        // intervention + cost, "₹8–15 lakh"
  impact: string;      // "Estimated 35–40% crash reduction…"
  auths: { n: string; r: string; p?: boolean }[];   // authorities; p = PRIMARY
  why: string;         // why not yet implemented
  team: string;        // audit team name
  pto: string;         // petition addressee (officer + office)
  pmail: string;       // petition mailto target
}
```
The terse keys are ugly; renaming them to readable fields is welcome, but do it as a data
migration, not by writing an adapter layer.

### Taxonomies — keep the keys stable
`statusMeta.json` — 7 statuses, `s` = step index in the pipeline:
| key | label | step |
|---|---|---|
| `in_audit` | In Audit | 1 |
| `audit_complete` | Audited | 2 |
| `submitted` | Report Submitted | 3 |
| `in_principle_approval` | Approved | 4 |
| `implementation_ongoing` | In Progress | 5 |
| `implemented` | Implemented | 6 |
| `stalled` | Stalled | **-1** (short-circuits the progress bar) |

`riskMeta.json` — `high` / `medium` / `low` → labels `High Risk` / `Medium Risk` / `Lower Risk`.
`authCategories.json` — `nhai` NHAI · `state_pwd` State PWD · `municipal` Municipal Corp ·
`dev_auth` Dev. Authority.
`progressSteps.json` — the 6 non-stalled statuses in order.

**Map the legacy risk/status hex onto brand semantics** rather than carrying the old colours:
high → `danger`, medium → `warning`, low → `success`. The 7 status colours should become a
documented data-viz ramp using brand tokens, not ad-hoc hex.

### Other data files
- `stateBounds.json` — fallback bounding boxes for 13 states.
- `geoNameMap.json` — GeoJSON name aliases (`NCT of Delhi`→`Delhi`, `Uttaranchal`→`Uttarakhand`).
- `siteMaps.json` — 28 Google Drive file IDs keyed by location id (**missing for 12, 29, 31**).
- `universities.json` + `src/assets/universities/*.png` — 20 academic partners.

### Real numbers (the old KPI strip was hardcoded and had drifted)
```
31 locations · 16 distinct cities · 13 states
risk:      high 7   | medium 15 | low 9
authority: municipal 13 | state_pwd 10 | nhai 7 | dev_auth 1
status:    approved 15 | in progress 7 | submitted 6 | implemented 1 | audited 1 | stalled 1
```
The old page displayed `31 / 18 cities / 25 approvals / 30%`. **"18 cities" and "25 approvals"
are wrong.** Derive KPIs from data — never hardcode them again.

### ⚠️ Shared module — do not break it
`src/components/rakshak/data.ts` exports `UNIS` and `uniLogoUrl`, which are imported by
`src/routes/rakshak-platform.impact.tsx` and `src/routes/rakshak-platform.impact_.institutions.tsx`.
If you move or delete it, update both importers in the same commit. Relocating it to
`src/lib/partners.ts` is a reasonable call.

---

## 6. Backend reality — nothing on the home page submits anything today

There is **no petition table, no report table, no API route, and no server function** behind
the current page. Both "actions" are client-side dead ends:
- **Petition** = generates a formal letter, then clipboard-copy / `mailto:` / `.txt` download.
  No signature is ever counted or stored.
- **Report** = a form that `window.open("mailto:info@crashfreeindia.org?…")`, **discards the
  uploaded photo** (only the filename is kept in state), and then shows a success screen
  claiming *"shared with the Crashfree India team… we'll notify progress at <email>"* — which
  is false.

If the new page keeps petition/report functionality, **build it properly**:
- Server-side via TanStack `createServerFn` + Supabase.
- New tables need a migration in `supabase/migrations/` following the existing `rp_*`
  conventions, **with RLS policies** (read the newest migration for the house style).
- Photo uploads → Supabase Storage. Enforce the limits the UI advertises.
- Transactional email → **Resend** (already a dependency), not `mailto:`.
- Only show a success state after a server acknowledgement. Never claim something was sent
  when it wasn't.

### Live data that already exists and you can use
`src/lib/rakshak-platform/stats.functions.ts → getPublicImpactStats()` is a real server
function returning live Supabase counts (teams, locations, authority reports, certificates,
phase-2 submissions) plus distinct institutions/cities/states and a live location list.
`/rakshak-platform/impact` consumes it via `queryClient.ensureQueryData`.

**Recommended posture: hybrid.** Drive the KPI strip from `getPublicImpactStats()` so it can
never drift from the platform's numbers, and keep the 31 dossiers as versioned editorial
content. Note that `rp_locations` is a thin table (`location_name, address, city, state,
latitude, longitude, issue_type, severity, description, is_final_selected,
authority_jurisdiction`) — it has **no** findings, solutions, costs, impact, authorities,
`why`, `team`, or the 7-state status workflow. Going fully live would need a schema extension
first.

---

## 7. Copy & tone — keep this, it's already on-brand

Crashfree India tone: **institutional, rigorous, uncompromising. Empirical over emotive,
direct over nice, solutions-focused over problems-only.**

- Brand name is always **`Crashfree India`** — never all-caps, never an `uppercase` class on it.
- Lead with the number, then the context. Cite sources for statistics.
- Forbidden register: "tragic", "heartbreaking", "victims", "help us", "awareness", emoji in
  headers or CTAs.
- Strings from the old page worth carrying over verbatim:
  - `Documenting risks · Demanding accountability · Saving lives`
  - `Why This Location is Crash-Prone` / `Why Not Yet Implemented`
  - `Stalled — No response from responsible authorities. Escalation needed.`
  - `Write to NHAI` (authority-specific CTA, not "Contact us")
  - Costs in `₹ lakh`; impact as a `%` range; the Motor Vehicles (Amendment) Act 2019 §215B
    hook in the petition letter.
- ❌ One line to **drop**: `"Together we can make India's roads safer."` — wrong register, and
  it currently sits on a success screen that is lying to the user.

If you need the full rulebook, invoke the `crashfree-india-design-system` skill.

### Logo
Use `src/assets/brand/cfi-logo-primary.svg` (blue marks) on light backgrounds and
`cfi-logo-white.svg` on `bg-brand`. Never an `invert()` filter hack.
🔴 The old nav renders the **white** logo with `filter:none` on a **white** bar — the logo is
literally invisible. Don't reproduce that. Also note the committed "primary" asset is
`#4736FE`, not the design-system `#4A35FF` — worth sourcing a corrected asset.

---

## 8. Where to put the new code, so the merge is a clean add

- Route stays at `src/routes/index.tsx` (`/` is the Railway healthcheck path — don't move it).
- New components go in a **new folder**, e.g. `src/components/home/` — **do not** build inside
  `src/components/rakshak/`, so old and new can coexist during cutover.
- Optionally mount the new page at a temporary route first (e.g. `src/routes/preview.tsx`),
  verify it, then swap `index.tsx` over in one small commit.
- **Leave the legacy files alone in this session.** Deleting them is a separate,
  post-verification commit: `src/components/rakshak/*` (minus `data.ts`), `styles.css`
  ~254–516, `public/legacy.html`, `src/data/logo.ts` (41 KB base64, zero importers), and the
  Fraunces / DM Sans / DM Mono entries in the `__root.tsx` font URL.

---

## 9. Verification — what actually gates a merge

```bash
npx tsc --noEmit      # baseline today: 0 errors. Keep it at 0.
npm run build         # must pass
npm run smoke         # SSR-fetches "/" and friends; fails on window/document/module errors
# or both at once:
npm run verify
```

⚠️ **Two traps:**
1. `npm run lint` currently reports **~9,379 errors / 44 warnings** repo-wide (8,588 of them
   Prettier formatting). It is **not** a usable gate. Lint only the files you touched.
2. **Never run `npm run format` (repo-wide Prettier).** It rewrites thousands of unrelated
   files across the platform / mentor / gigrider routes and will make your diff
   unreviewable and the merge a nightmare. Format only your own new files.

There are currently **no e2e tests that visit `/`**. `playwright.config.ts` defines
`desktop-chromium` and `mobile-pixel-5` projects — adding coverage for the new home page is
in scope and welcome.

---

## 10. Quick self-check before you hand the work back

- [ ] Route is `createFileRoute("/")`; no Next.js idioms anywhere
- [ ] No `tailwind.config.*` created; no new Vite plugins added
- [ ] Zero raw hex in `src/`; only semantic tokens
- [ ] Only Montserrat + Geist
- [ ] 4px spacing grid; `max-w-7xl`; `border-t border-border` dividers
- [ ] Works at 375 / 768 / 1200
- [ ] Touch targets ≥ 44px; interactive elements are real `<button>`/`<a>` with proper ARIA
- [ ] Contrast ≥ 4.5:1 (the old page used 9–11px text at ~2.9:1 — it failed AA)
- [ ] No browser globals at module scope; Leaflet dynamically imported in `useEffect`
- [ ] `npx tsc --noEmit` and `npm run verify` both pass
- [ ] KPIs derived from data, not hardcoded
- [ ] No success message for something that wasn't actually submitted
- [ ] `UNIS` / `uniLogoUrl` still resolve for the two `rakshak-platform.impact*` routes
- [ ] Route `head()` overrides the root's "internal operations platform" meta; has
      title, description, canonical, `og:image`, twitter card
- [ ] Legacy files untouched; new code in its own folder
- [ ] Did not run repo-wide Prettier
