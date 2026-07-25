## Health scan results (read-only — nothing was changed)

### Headline
| Check | Result |
|---|---|
| TypeScript (`tsc --noEmit`) | **PASS** — 0 errors |
| Production build (`npm run build`) | **PASS** — built in 25s, 0 errors |
| ESLint (`eslint .`) | **FAIL** — 9,379 errors, 44 warnings (8,588 are Prettier formatting) |
| Broken/unresolved imports | **None** — a clean build proves every import resolves |
| TODO / FIXME / HACK in shipping code | **None found** |

No Critical issues. Nothing is currently broken in production from a static-analysis standpoint.

---

## Critical
None.

## High
None. (Everything below is contained, non-crashing, or formatting-only.)

## Medium

1. **`src/lib/rakshak-platform/team-members.functions.ts:73`** — `await (supabaseAdmin as any).auth.admin.getUserByEmail?.(email)` then destructuring `{ data }`. If the SDK method doesn't exist, the optional chain yields `undefined` and destructuring throws — it is inside a `try`, so it silently falls through to the paginated `listUsers` fallback, which only scans the **first 200 users**. Beyond 200 users this silently fails to find an existing account and can create a duplicate. *Behavioral / needs review.* **FLAGGED — auth/session logic, not auto-fixing.**
2. **`react-hooks/exhaustive-deps` × 21** — no infinite loops present (all offenders use empty or stable dep arrays with `eslint-disable`), but they carry stale-closure risk. Rakshak hot paths: `DoubtsCard.tsx:74`, `ResolveDoubtsPanel.tsx:55`, `AdminMentorTeamRequestsPanel.tsx:44`, `admin.doubts.tsx:43`, `team.locations.index.tsx:63`, `team.locations.$id.tsx:36`. The `logical expression could change every render` set (`authority.tsx:35`, `evaluator.index.tsx:42`, `evaluator.reports.tsx:35`, `knowledge.index.tsx:25`, `leaderboard.tsx:53`, `team.phases.$phase.tsx:67`, `team.reports.index.tsx:72`) causes needless re-computation, not loops. *Behavioral / needs review case by case.*
3. **Unhandled promise rejections — fire-and-forget `.then()` with no `.catch()`** on client fetches: `rakshak-platform.admin.emails.tsx:96`, `admin.data.tsx:80`, `admin.credentials.tsx:116`, `admin.analytics.tsx:134`, `rakshak-platform.index.tsx:22`, `lib/rakshak-platform/auth.ts:111,189`. A transient network failure produces a console rejection and a permanently-stuck loading state rather than an error message. *Mechanical/safe* to add `.catch()`.
4. **`src/lib/rakshak-platform/mentor-team-requests.functions.ts:250,258`** — `.then(() => null, () => null)` swallows all errors including real failures ("ignore dupe-pending"). Blind-swallow makes production failures invisible. *Behavioral / needs review.*

## Low

5. **Prettier formatting: 8,588 errors** repo-wide (`prettier/prettier`). Purely cosmetic; `npm run format` fixes all. *Mechanical/safe* — but it would touch gigrider-checklist / rakshak-mentor / public-rakshak files, so it should be scoped or skipped.
6. **`@typescript-eslint/no-explicit-any` × 781** — pervasive `any` on server-fn payloads and query rows. No runtime impact; it just removes type safety in exactly the places that carry data. *Behavioral / needs review* (typing them properly is real work).
7. **Unused expressions (possible intent bug)** — `src/routes/rakshak-platform.admin.index.tsx:814` and `rakshak-mentor.admin.index.tsx:197` use `n.has(id) ? n.delete(id) : n.add(id);` as a statement. Works correctly (Set mutation), but flagged by lint. *Mechanical/safe* → rewrite as `if/else`.
8. **`prefer-const` × 5** — `admin-teams.functions.ts:136`, `compare.functions.ts:46`, `mass-email.functions.ts:103,104`, `mentor.resources.tsx:95`. *Mechanical/safe.*
9. **Empty catch blocks** — `mentor.availability.tsx:78` (`try { form.reset(); } catch {}`), `rakshak-platform.t.$slug.tsx:76` (clipboard write). Both are legitimately-ignorable failures; only worth adding a comment. *Mechanical/safe.*
10. **Unused `eslint-disable` directives × 3** — `DoubtsCard.tsx:74`, `ResolveDoubtsPanel.tsx:55`, `admin.doubts.tsx:43`. *Mechanical/safe.*
11. **`react-refresh/only-export-components` × 20** — dev-only fast-refresh warnings, mostly shadcn `ui/*` files. No production impact. Recommend leaving alone.
12. **Deprecation warnings in build output** — `createServerFn().inputValidator()` is deprecated in favour of `.validator()`, reported for `rakshak-platform.m.$id.tsx:10` and `rakshak-platform.t.$slug.tsx:9`. Non-breaking today; a future TanStack Start upgrade will break it. Note: the codebase uses `inputValidator` project-wide, so this is a repo-scale migration, not a two-file fix. *Mechanical/safe but wide.*

---

## Flagged for your review — NOT included in any auto-fix
Per your instruction, these are reported only:
- **Auth/session:** `lib/rakshak-platform/auth.ts` (unhandled `.then` at 111, 189), `team-members.functions.ts:73` user-lookup fallback, `lib/gigrider/auth.ts:18`, `lib/mentor/auth.ts:28`.
- **Supabase RLS policies:** no static issues detectable from the repo; unchanged.
- **Finance/sponsorship:** `finance.functions.ts` — `assertFinanceAccess` uses `any` typing and hand-rolled role arrays instead of the `rp_has_role` RPC used elsewhere. Functionally correct, inconsistent. No change proposed.
- **Email-sending:** `mass-email.functions.ts:103,104` (`prefer-const`) — trivial, but in an email path, so held back.
- **Database migrations:** none run, none proposed.

---

## Proposed remediation plan (for your approval — no code written yet)

**Stage 1 — zero-risk, Rakshak-scoped only**
- Remove the 3 unused `eslint-disable` directives.
- Fix the 4 non-email `prefer-const` hits.
- Rewrite the 2 ternary-as-statement toggles as `if/else`.
- Add explanatory comments to the 2 empty catch blocks.

**Stage 2 — low-risk resilience (needs your OK)**
- Add `.catch()` + error state to the 5 non-auth fire-and-forget `.then()` chains on admin pages, so a failed fetch shows an error instead of a permanent spinner.

**Stage 3 — decide, don't act yet**
- Prettier: run `npm run format` repo-wide (touches other projects), scope it to `rakshak-platform` paths only, or skip entirely.
- `exhaustive-deps`: audit the 6 Rakshak `useEffect` cases individually rather than bulk-adding deps (bulk changes here can introduce refetch loops).
- `inputValidator` → `validator` migration: schedule as its own pass before any TanStack Start upgrade.

**Stage 4 — your review required before anything is touched**
- Everything in the "Flagged" section above.

Which stages do you want me to proceed with?
