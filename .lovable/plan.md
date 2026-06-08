## Plan: Finish remaining Rakshak Platform features

### 1. Remove payments/checkout completely
- Delete any Stripe/checkout imports or references
- Remove Sponsor link from nav (keep the route functional as a pledge page, but remove payment language)
- Clean up payment_provider references in UI code

### 2. Cron webhooks — enrich alert thresholds/escalation
- Migration: add `rp_cron_alert_rules` table (hook_name, max_failures, max_stale_ms, notify_roles, is_active)
- Enrich `getCronHealth` server function to compute alert state using thresholds
- Add admin UI to configure thresholds per hook
- Auto-create `rp_notifications` when a hook exceeds thresholds (escalation)
- Show active alerts banner on cron health page

### 3. QA sweep — expand coverage
- New admin route `/rakshak-platform/admin/qa`
- Server function `runQAChecks` that returns:
  - Teams without members
  - Locations without coordinates  
  - Submissions past deadline without status approved
  - Mentors not assigned to any team
  - Orphaned feedback (submission deleted)
  - Duplicate serial numbers in certificates
- Visual dashboard with severity badges and one-click fixes

### 4. Certificates — verify complete
- Already has admin issue/revoke + public verify page
- Ensure verify route works end-to-end

### 5. Knowledge hub — verify complete
- Already has admin CRUD + public index + article reading
- Ensure markdown rendering handles all common cases

### 6. Leaderboard — verify complete
- Already built with cohort filter and podium

### 7. Map heatmap — verify complete
- Public map + admin map with severity/final filters already built

### 8. AI report checker — verify complete
- Already built with Gemini gateway integration

### 9. Exports — add PDF capability
- Add "Print PDF" button alongside CSV downloads
- Generate a print-optimized HTML report page (client-side print-to-PDF)
- Cover teams, submissions, and locations datasets

### 10. Finance dashboard — verify complete
- Already built with ledger + sponsorship tracking

### 11. Integrations placeholders
- New admin route `/rakshak-platform/admin/integrations`
- Display webhook endpoint URLs (admin-digest, meeting-reminders)
- Connection status cards for Resend email, AI Gateway
- Copy-to-clipboard for webhook URLs
- Placeholder cards for future integrations (Slack, WhatsApp, Google Sheets)

### Technical details
- Single migration for `rp_cron_alert_rules` table
- All new routes under `/rakshak-platform/admin/*`
- Reuse existing `PlatformShell` and design tokens
- Add nav links in `Shell.tsx` for new pages