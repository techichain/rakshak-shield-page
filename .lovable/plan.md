## Goal
Convert the single 1307-line `rakshak_platform_v5.html` (Crashfree India Road Safety Audit dashboard) into a properly modular React app on the existing TanStack Start stack. Keep the **exact same UI, colors, sizes, behavior**. No visual changes without your confirmation. Every button color, padding, font becomes a named CSS class or component prop you can edit in one place.

## What the app does (so we're aligned)
- Full-screen dashboard: top nav, stats bar, left sidebar (filters + location list), Leaflet map of India with risk pins, right detail panel that slides open, footer with university partner logos.
- Two modals: **Petition** (auto-generates a formal letter to the responsible authority — copy / email / download as .txt) and **Report Issue** (form → mailto submission).
- 31 hard-coded audit locations across India, each with risk level, status (7-stage workflow), authorities, findings, recommended fixes & costs, site map image (Google Drive), audit team.
- Filters: search, responsible authority, status, state. Selecting a state zooms the map; clicking a pin opens its detail panel and zooms to that state.

## File / folder plan

```
src/
  routes/
    index.tsx                 → assembles full dashboard layout
  components/rakshak/
    TopNav.tsx                → logo + title + Sign Petition / Report buttons
    StatsBar.tsx              → 6 stats + contextual selected-location block
    Sidebar.tsx               → search, selected card, filter chips, location list
    MapView.tsx               → Leaflet map, India GeoJSON, risk markers
    DetailPanel.tsx           → slide-in right panel with all audit details
    Footer.tsx                → copyright + scrolling university logos
    PetitionModal.tsx         → letter generator + copy / email / download
    ReportModal.tsx           → email / description / photo / petition checkbox
    ProgressSteps.tsx         → 6-step implementation progress bar
  data/
    locations.ts              → all 31 LOC entries (typed)
    siteMaps.ts               → Google Drive file IDs per location
    universities.ts           → UNIS array (base64 logos preserved)
    constants.ts              → RC, RL, ST, PROG, AUTH_CATS, SB, GEO_NAME_MAP
  types/rakshak.ts            → Location, Authority, Solution, Status types
  store/rakshakStore.ts       → Zustand store: filters, activeId, modal state
  styles.css                  → all original CSS classes added (scoped under .rakshak-app)
public/
  rakshak-logo.png            → extracted nav logo (decoded from base64)
```

## State (Zustand)
```ts
{
  filters: { auth, status, state, search },
  activeLocationId: number | null,
  petitionModalOpen: boolean,
  reportModalOpen: boolean,
  reportLocationId: number | null,
  setFilter, setActiveId, openPetition, closePetition, openReport, closeReport
}
```
Map instance + Leaflet markers stay as refs inside `MapView.tsx` (not in the store) — they're imperative.

## CSS strategy
The original uses ~400 lines of plain CSS with CSS variables (`--bg`, `--high`, `--navy`, etc.). I'll port them verbatim into `src/styles.css` under a `.rakshak-app` wrapper so they don't leak. **Every color, font size, padding stays under a CSS variable or named class** — to change a button color you edit one line in `styles.css`. I will NOT migrate to Tailwind utility classes; that would change pixel-level appearance.

## Dependencies to add
- `leaflet` and `@types/leaflet` (Leaflet 1.9.x, same version as the HTML CDN)
- `zustand` (small state store)

Leaflet CSS imported directly from the npm package.

## Behavior parity checklist (verify against HTML)
- [ ] Filter chips toggle and update marker visibility + sidebar list
- [ ] Selecting state chip flies map to that state's bounds
- [ ] Clicking a marker opens detail panel AND zooms to its state
- [ ] Hover marker shows popup with risk + status
- [ ] Detail panel: hero, site map image, 6-step progress, findings, solutions, impact, authorities, "why not implemented", CTAs
- [ ] Stalled status shows red banner instead of progress bar
- [ ] Petition modal generates formatted letter with date / CC list
- [ ] Copy / Email / Download .txt all work
- [ ] Report modal validates email, supports photo upload, opens mailto on submit, then shows success state
- [ ] "Reset to India View" button flies map back to India bounds
- [ ] Footer university logos scroll horizontally

## What I will NOT touch without asking
- Color palette, font choices, spacing, button sizes
- The 31 locations' content (kept verbatim)
- The petition letter wording
- The status workflow (7 stages)

## What you (optionally) might want later — not in scope now
- Backend persistence for reports/petitions (currently mailto only)
- Auth or admin to add/edit locations
- Real Google Sheets/DB instead of hard-coded `LOC` array

## Order of work
1. Add dependencies (leaflet, zustand)
2. Port `styles.css` (all CSS variables + classes)
3. Create `data/`, `types/`, `constants.ts`
4. Build store
5. Build leaf components (Footer, ProgressSteps, modals)
6. Build Sidebar, StatsBar, TopNav, DetailPanel
7. Build MapView (Leaflet integration with `useEffect`)
8. Wire everything in `routes/index.tsx`
9. Verify in preview, fix any runtime issues

If you approve, I'll proceed end-to-end without further questions and report back when it's running.
