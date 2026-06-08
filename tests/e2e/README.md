# E2E Tests

Opt-in regression suite. Not run as part of the Lovable build.

## Install once

```bash
bun add -d @playwright/test
bunx playwright install --with-deps chromium
```

## Run

```bash
bunx playwright test                                  # against published preview
PLAYWRIGHT_BASE_URL=http://localhost:3000 bunx playwright test
```

## Suites

- `auth.spec.ts` — sign-in form + protected redirect
- `public-and-health.spec.ts` — leaderboard, knowledge, certificate verify, integrations gate, `/api/public/hooks/health-ping`
- `responsive-a11y.spec.ts` — mobile viewport overflow check + skip-to-main keyboard link

For manual coverage (auth+role-gated screens that need a signed-in admin),
use the in-app checklist at `/rakshak-platform/admin/qa-checklist`.
