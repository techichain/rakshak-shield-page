import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { z } from "zod";

/* ------------------------------------------------------------------ */
/* Config                                                              */
/* ------------------------------------------------------------------ */

export const ROLE_CAPS = {
  team_leader: 120,
  team_member: 240,
  mentor: 50,
  evaluator: 30,
} as const;

export const ROLE_PREFIX: Record<keyof typeof ROLE_CAPS, string> = {
  team_leader: "TL",
  team_member: "TM",
  mentor: "MT",
  evaluator: "EV",
};

const ROLE_ENUM = z.enum(["team_leader", "team_member", "mentor", "evaluator"]);
type CredRole = z.infer<typeof ROLE_ENUM>;

const SYNTH_DOMAIN = "rakshak.credentials.local";

/* ------------------------------------------------------------------ */
/* Helpers                                                             */
/* ------------------------------------------------------------------ */

async function assertAdmin(supabase: any, userId: string) {
  const { data } = await supabase.rpc("rp_is_admin", { _user_id: userId });
  if (!data) throw new Error("Admin only");
}

function sanitizeLoginId(raw: string): string {
  // email-safe local-part chars: letters, digits, dot, underscore, hyphen
  const cleaned = raw.trim().toLowerCase().replace(/[^a-z0-9._-]+/g, "");
  if (!cleaned || cleaned.length < 3 || cleaned.length > 40) {
    throw new Error("Login ID must be 3–40 chars (letters, digits, . _ -).");
  }
  return cleaned;
}

async function countByRole(supabaseAdmin: any, role: CredRole): Promise<number> {
  const { count, error } = await supabaseAdmin
    .from("rp_user_roles")
    .select("user_id", { count: "exact", head: true })
    .eq("role", role);
  if (error) throw error;
  return count ?? 0;
}

/* ------------------------------------------------------------------ */
/* Validators                                                          */
/* ------------------------------------------------------------------ */

const createSchema = z.object({
  role: ROLE_ENUM,
  login_id: z.string().min(3).max(60),
  password: z.string().min(8).max(200),
  full_name: z.string().trim().min(1).max(160),
  phone: z.string().trim().max(40).optional().nullable(),
  email: z.string().trim().email().optional().nullable(),
  college: z.string().trim().max(200).optional().nullable(),
});

const resetSchema = z.object({
  user_id: z.string().uuid(),
  new_password: z.string().min(8).max(200),
});

const listSchema = z.object({
  role: ROLE_ENUM.optional(),
});

const suggestSchema = z.object({ role: ROLE_ENUM });

const resolveSchema = z.object({
  login_id: z.string().trim().min(1).max(60),
});

/* ------------------------------------------------------------------ */
/* getCredentialCounts                                                 */
/* ------------------------------------------------------------------ */

export const getCredentialCounts = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    await assertAdmin(context.supabase, context.userId);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const roles: CredRole[] = ["team_leader", "team_member", "mentor", "evaluator"];
    const entries = await Promise.all(
      roles.map(async (r) => [r, await countByRole(supabaseAdmin, r)] as const),
    );
    return {
      counts: Object.fromEntries(entries) as Record<CredRole, number>,
      caps: { ...ROLE_CAPS },
    };
  });

/* ------------------------------------------------------------------ */
/* suggestNextLoginId                                                  */
/* ------------------------------------------------------------------ */

export const suggestNextLoginId = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => suggestSchema.parse(d))
  .handler(async ({ data, context }) => {
    await assertAdmin(context.supabase, context.userId);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const prefix = ROLE_PREFIX[data.role];
    const { data: rows } = await supabaseAdmin
      .from("rp_profiles")
      .select("login_id")
      .not("login_id", "is", null)
      .ilike("login_id", `${prefix}%`);
    let max = 0;
    const re = new RegExp(`^${prefix.toLowerCase()}(\\d{1,6})$`);
    for (const r of rows ?? []) {
      const m = String(r.login_id).toLowerCase().match(re);
      if (m) {
        const n = parseInt(m[1], 10);
        if (n > max) max = n;
      }
    }
    const next = max + 1;
    return { login_id: `${prefix}${String(next).padStart(4, "0")}` };
  });

/* ------------------------------------------------------------------ */
/* createCredential                                                    */
/* ------------------------------------------------------------------ */

export const createCredential = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => createSchema.parse(d))
  .handler(async ({ data, context }) => {
    await assertAdmin(context.supabase, context.userId);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

    // Enforce role cap
    const current = await countByRole(supabaseAdmin, data.role);
    const cap = ROLE_CAPS[data.role];
    if (current >= cap) {
      throw new Error(
        `Cap reached: ${cap} ${data.role.replace("_", " ")} accounts already exist. Cannot create more.`,
      );
    }

    const login_id = sanitizeLoginId(data.login_id);

    // Uniqueness check on login_id
    const { data: existingByLogin } = await supabaseAdmin
      .from("rp_profiles")
      .select("id")
      .eq("login_id", login_id)
      .maybeSingle();
    if (existingByLogin) {
      throw new Error(`Login ID "${login_id}" is already in use.`);
    }

    const email = (data.email && data.email.trim())
      ? data.email.trim().toLowerCase()
      : `${login_id}@${SYNTH_DOMAIN}`;

    // Also check the email isn't already taken in profiles
    const { data: existingByEmail } = await supabaseAdmin
      .from("rp_profiles")
      .select("id")
      .eq("email", email)
      .maybeSingle();
    if (existingByEmail) {
      throw new Error(`An account with email "${email}" already exists.`);
    }

    // Create auth user
    const { data: created, error: createErr } = await supabaseAdmin.auth.admin.createUser({
      email,
      password: data.password,
      email_confirm: true,
      user_metadata: { full_name: data.full_name, login_id, provisioned: true },
    });
    if (createErr || !created.user) {
      throw new Error(createErr?.message || "Could not create user.");
    }
    const user = created.user;

    // Upsert profile
    const { error: profileErr } = await supabaseAdmin
      .from("rp_profiles")
      .upsert(
        {
          id: user.id,
          full_name: data.full_name,
          email,
          login_id,
          phone: data.phone ?? null,
          organization: data.college ?? null,
        },
        { onConflict: "id" },
      );
    if (profileErr) {
      // Best-effort rollback of the auth user so admin can retry
      await supabaseAdmin.auth.admin.deleteUser(user.id).catch(() => {});
      throw profileErr;
    }

    // Insert role
    const { error: roleErr } = await supabaseAdmin
      .from("rp_user_roles")
      .upsert(
        { user_id: user.id, role: data.role },
        { onConflict: "user_id,role" },
      );
    if (roleErr) {
      await supabaseAdmin.auth.admin.deleteUser(user.id).catch(() => {});
      throw roleErr;
    }

    // Mentor row if applicable
    if (data.role === "mentor") {
      await supabaseAdmin
        .from("rp_mentors")
        .upsert({ profile_id: user.id }, { onConflict: "profile_id" });
    }

    return {
      user_id: user.id,
      login_id,
      email,
      password: data.password,
    };
  });

/* ------------------------------------------------------------------ */
/* resetCredentialPassword                                             */
/* ------------------------------------------------------------------ */

export const resetCredentialPassword = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => resetSchema.parse(d))
  .handler(async ({ data, context }) => {
    await assertAdmin(context.supabase, context.userId);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { error } = await supabaseAdmin.auth.admin.updateUserById(data.user_id, {
      password: data.new_password,
    });
    if (error) throw new Error(error.message);
    return { ok: true as const };
  });

/* ------------------------------------------------------------------ */
/* listCredentials                                                     */
/* ------------------------------------------------------------------ */

export const listCredentials = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => listSchema.parse(d))
  .handler(async ({ data, context }) => {
    await assertAdmin(context.supabase, context.userId);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

    const { data: profiles, error } = await supabaseAdmin
      .from("rp_profiles")
      .select("id, full_name, email, phone, organization, login_id, created_at")
      .not("login_id", "is", null)
      .order("login_id", { ascending: true });
    if (error) throw error;

    const ids = (profiles ?? []).map((p: any) => p.id);
    if (ids.length === 0) return { items: [] };

    const { data: rolesRows } = await supabaseAdmin
      .from("rp_user_roles")
      .select("user_id, role")
      .in("user_id", ids);
    const rolesByUser = new Map<string, string[]>();
    for (const r of rolesRows ?? []) {
      const arr = rolesByUser.get(r.user_id) ?? [];
      arr.push(r.role);
      rolesByUser.set(r.user_id, arr);
    }

    // Pull last_sign_in_at from auth.users via admin listUsers (paginated).
    // For sub-1000 accounts this is fine.
    const lastSignInByUser = new Map<string, string | null>();
    try {
      let page = 1;
      // 1000 total cap covers 120+240+50+30 = 440 well.
      while (page <= 5) {
        const { data: authList, error: authErr } =
          await supabaseAdmin.auth.admin.listUsers({ page, perPage: 200 });
        if (authErr) break;
        for (const u of authList.users) {
          lastSignInByUser.set(u.id, (u as any).last_sign_in_at ?? null);
        }
        if (authList.users.length < 200) break;
        page += 1;
      }
    } catch {
      // Non-fatal — leave last_sign_in_at as unknown.
    }

    const items = (profiles ?? [])
      .map((p: any) => {
        const roles = rolesByUser.get(p.id) ?? [];
        const roleFilter = data.role;
        if (roleFilter && !roles.includes(roleFilter)) return null;
        // Primary role: first credential-relevant role we know about
        const primary =
          (["team_leader", "team_member", "mentor", "evaluator"] as const).find((r) =>
            roles.includes(r),
          ) ?? null;
        return {
          user_id: p.id,
          login_id: p.login_id as string,
          full_name: p.full_name,
          email: p.email,
          phone: p.phone,
          organization: p.organization,
          role: primary,
          roles,
          created_at: p.created_at,
          last_sign_in_at: lastSignInByUser.get(p.id) ?? null,
        };
      })
      .filter((x): x is NonNullable<typeof x> => x !== null);

    return { items };
  });

/* ------------------------------------------------------------------ */
/* resolveLoginIdToEmail — public (no auth)                            */
/* Minimal surface: returns { email } or { email: null } only.         */
/* ------------------------------------------------------------------ */

export const resolveLoginIdToEmail = createServerFn({ method: "POST" })
  .inputValidator((d: unknown) => resolveSchema.parse(d))
  .handler(async ({ data }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const login_id = data.login_id.trim().toLowerCase();
    if (!login_id) return { email: null as string | null };
    console.log("[resolveLoginId]", login_id);
    const { data: row } = await supabaseAdmin
      .from("rp_profiles")
      .select("email")
      .eq("login_id", login_id)
      .maybeSingle();
    console.log("[resolveLoginId] result:", row?.email ?? "NOT FOUND");
    return { email: (row?.email as string | undefined) ?? null };
  });
