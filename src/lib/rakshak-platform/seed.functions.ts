import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { z } from "zod";

const DEMO_USERS: Array<{ email: string; password: string; full_name: string; role: string }> = [
  { email: "demo.admin@rakshak.test",     password: "RakshakDemo!23", full_name: "Demo Admin",     role: "cfi_admin" },
  { email: "demo.mentor@rakshak.test",    password: "RakshakDemo!23", full_name: "Demo Mentor",    role: "mentor" },
  { email: "demo.team@rakshak.test",      password: "RakshakDemo!23", full_name: "Demo Team Lead", role: "team_leader" },
  { email: "demo.evaluator@rakshak.test", password: "RakshakDemo!23", full_name: "Demo Evaluator", role: "evaluator" },
  { email: "demo.finance@rakshak.test",   password: "RakshakDemo!23", full_name: "Demo Finance",   role: "finance" },
  { email: "demo.authority@rakshak.test", password: "RakshakDemo!23", full_name: "Demo Authority", role: "authority" },
];

async function assertAdmin(ctx: any) {
  const { data: roles } = await ctx.supabase
    .from("rp_user_roles").select("role").eq("user_id", ctx.userId);
  const ok = (roles ?? []).some((r: any) =>
    ["cfi_admin", "super_admin"].includes(r.role));
  if (!ok) throw new Error("Forbidden");
}

export const seedDemoAccounts = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    await assertAdmin(context);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

    const created: Array<{ email: string; role: string; status: string }> = [];

    for (const u of DEMO_USERS) {
      // Try to create; if already exists, look it up
      let userId: string | null = null;
      const { data: createRes, error: createErr } = await supabaseAdmin.auth.admin.createUser({
        email: u.email,
        password: u.password,
        email_confirm: true,
        user_metadata: { name: u.full_name },
      });
      if (createRes?.user) {
        userId = createRes.user.id;
      } else if (createErr) {
        // Find existing user
        const { data: list } = await supabaseAdmin.auth.admin.listUsers({ perPage: 200 });
        const existing = list?.users?.find((x) => x.email?.toLowerCase() === u.email.toLowerCase());
        if (existing) userId = existing.id;
      }
      if (!userId) {
        created.push({ email: u.email, role: u.role, status: "could not create" });
        continue;
      }

      await supabaseAdmin.from("rp_profiles").upsert(
        { id: userId, full_name: u.full_name } as any,
        { onConflict: "id" },
      );
      await supabaseAdmin.from("rp_user_roles").upsert(
        { user_id: userId, role: u.role as any } as any,
        { onConflict: "user_id,role" },
      );
      created.push({ email: u.email, role: u.role, status: createRes?.user ? "created" : "updated" });
    }

    return { accounts: created };
  });

export const seedDemoContent = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => z.object({ confirm: z.literal(true) }).parse(d))
  .handler(async ({ context }) => {
    await assertAdmin(context);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

    // Cohort
    const { data: cohort } = await supabaseAdmin
      .from("rp_cohorts")
      .upsert(
        { name: "Demo Cohort 2026", start_date: "2026-01-15", end_date: "2026-06-30", status: "active" } as any,
        { onConflict: "name" },
      )
      .select("id")
      .single();

    const cohortId = cohort?.id;
    if (!cohortId) throw new Error("Cohort upsert failed");

    // Find a demo team lead user for ownership
    const { data: list } = await supabaseAdmin.auth.admin.listUsers({ perPage: 200 });
    const teamLead = list?.users?.find((x) => x.email === "demo.team@rakshak.test");

    // Teams
    const teamRows = [
      { team_name: "Team Mumbai West",  city: "Mumbai",    state: "Maharashtra", college_name: "IIT Bombay" },
      { team_name: "Team Delhi South",  city: "Delhi",     state: "Delhi",       college_name: "DTU" },
      { team_name: "Team Bengaluru East", city: "Bengaluru", state: "Karnataka",   college_name: "RVCE" },
      { team_name: "Team Pune Central",  city: "Pune",      state: "Maharashtra", college_name: "COEP" },
    ];
    const teams: any[] = [];
    for (const t of teamRows) {
      const { data: tr } = await supabaseAdmin.from("rp_teams").insert({
        ...t,
        cohort_id: cohortId,
        status: "active",
        team_leader_id: teamLead?.id ?? null,
      } as any).select("id, city").single();
      if (tr) teams.push(tr);
    }

    // Locations (5 per team in their city)
    const cityLatLng: Record<string, [number, number]> = {
      Mumbai:    [19.07, 72.87],
      Delhi:     [28.61, 77.21],
      Bengaluru: [12.97, 77.59],
      Pune:      [18.52, 73.85],
    };
    const issues = ["pothole", "missing_signage", "broken_signal", "unsafe_crossing", "encroachment"];
    const severities = ["low", "medium", "high", "critical"];
    const locationsToInsert: any[] = [];
    teams.forEach((t, ti) => {
      const [lat, lng] = cityLatLng[t.city] ?? [20.5, 78.9];
      for (let i = 0; i < 5; i++) {
        locationsToInsert.push({
          team_id: t.id,
          phase_number: 2,
          location_name: `${t.city} hazard #${i + 1}`,
          city: t.city,
          state: teamRows[ti].state,
          latitude: lat + (Math.random() - 0.5) * 0.1,
          longitude: lng + (Math.random() - 0.5) * 0.1,
          issue_type: issues[i % issues.length],
          severity: severities[i % severities.length],
          description: `Demo hazard documented by ${t.city} team`,
          is_final_selected: i === 0,
        });
      }
    });
    await supabaseAdmin.from("rp_locations").insert(locationsToInsert as any);

    // Paid demo sponsorships (so impact + sponsor wall has content)
    const sponsors = [
      { sponsor_name: "Acme Foundation",  sponsor_org: "Acme",     tier: "gold",     amount_inr: 200000 },
      { sponsor_name: "Civic Trust",      sponsor_org: "Civic",    tier: "silver",   amount_inr: 50000 },
      { sponsor_name: "Riya Sharma",      sponsor_org: null,       tier: "bronze",   amount_inr: 10000 },
      { sponsor_name: "Mobility Corp",    sponsor_org: "Mobility", tier: "platinum", amount_inr: 1000000 },
    ];
    for (const s of sponsors) {
      await supabaseAdmin.from("rp_sponsorships").insert({
        ...s,
        status: "paid",
        is_public: true,
        paid_at: new Date().toISOString(),
        message: "Backing the next generation of road safety leaders.",
      } as any);
    }

    return { cohort_id: cohortId, teams: teams.length, locations: locationsToInsert.length, sponsors: sponsors.length };
  });
