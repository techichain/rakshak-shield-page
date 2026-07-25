import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { z } from "zod";

export const EVIDENCE_TYPES = [
  "crash_data",
  "rti",
  "fir",
  "police_complaint",
  "media_report",
  "other",
] as const;

export const EVIDENCE_STATUSES = [
  "draft",
  "filed",
  "acknowledged",
  "responded",
  "closed",
] as const;

/**
 * Write access: team members (leader included) of the team, or an admin.
 * Mirrors ensureTeamMembership in submissions.functions.ts.
 */
async function ensureTeamWrite(supabase: any, userId: string, teamId: string) {
  const { data: t } = await supabase
    .from("rp_teams")
    .select("id, team_leader_id")
    .eq("id", teamId)
    .maybeSingle();
  if (!t) throw new Error("Team not found");
  if (t.team_leader_id === userId) return;
  const { data: m } = await supabase
    .from("rp_team_members")
    .select("id")
    .eq("team_id", teamId)
    .eq("profile_id", userId)
    .maybeSingle();
  if (m) return;
  const { data: isAdmin } = await supabase.rpc("rp_is_admin", { _user_id: userId });
  if (isAdmin) return;
  throw new Error("Forbidden: not a team member");
}

/** Read access: the above, plus the team's assigned mentor and evaluators. */
async function ensureTeamRead(supabase: any, userId: string, teamId: string) {
  const [{ data: isMember }, { data: isMentor }, { data: isAdmin }, { data: isEvaluator }] =
    await Promise.all([
      supabase.rpc("rp_is_team_member", { _team: teamId, _user: userId }),
      supabase.rpc("rp_is_team_mentor", { _team: teamId, _user: userId }),
      supabase.rpc("rp_is_admin", { _user_id: userId }),
      supabase.rpc("rp_has_role", { _user_id: userId, _role: "evaluator" }),
    ]);
  if (isMember || isMentor || isAdmin || isEvaluator) return;
  throw new Error("Forbidden: no access to this team");
}

/**
 * All evidence records for a team, newest first, each with its attached files.
 */
export const listEvidenceRecords = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => z.object({ team_id: z.string().uuid() }).parse(d))
  .handler(async ({ data, context }) => {
    await ensureTeamRead(context.supabase, context.userId, data.team_id);

    const { data: records, error } = await context.supabase
      .from("rp_evidence_records")
      .select("*")
      .eq("team_id", data.team_id)
      .order("created_at", { ascending: false });
    if (error) throw error;

    const ids = (records ?? []).map((r: any) => r.id);
    let files: any[] = [];
    if (ids.length > 0) {
      const { data: f, error: fErr } = await context.supabase
        .from("rp_evidence_files")
        .select("*")
        .in("record_id", ids)
        .order("created_at", { ascending: false });
      if (fErr) throw fErr;
      files = f ?? [];
    }

    const byRecord = new Map<string, any[]>();
    for (const f of files) {
      const arr = byRecord.get(f.record_id) ?? [];
      arr.push(f);
      byRecord.set(f.record_id, arr);
    }

    return {
      records: (records ?? []).map((r: any) => ({ ...r, files: byRecord.get(r.id) ?? [] })),
    };
  });

const recordInput = z.object({
  id: z.string().uuid().optional(),
  team_id: z.string().uuid(),
  phase_number: z.number().int().min(0).max(4).nullable().optional(),
  record_type: z.enum(EVIDENCE_TYPES),
  title: z.string().trim().min(1).max(400),
  reference_no: z.string().trim().max(200).nullable().optional(),
  filed_on: z.string().trim().max(20).nullable().optional(),
  authority: z.string().trim().max(300).nullable().optional(),
  status: z.enum(EVIDENCE_STATUSES).nullable().optional(),
  description: z.string().trim().max(8000).nullable().optional(),
});

/** Create a new evidence record, or update an existing one owned by the team. */
export const upsertEvidenceRecord = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => recordInput.parse(d))
  .handler(async ({ data, context }) => {
    await ensureTeamWrite(context.supabase, context.userId, data.team_id);

    const payload = {
      team_id: data.team_id,
      phase_number: data.phase_number ?? null,
      record_type: data.record_type,
      title: data.title,
      reference_no: data.reference_no || null,
      filed_on: data.filed_on || null,
      authority: data.authority || null,
      status: data.status ?? "draft",
      description: data.description || null,
    };

    if (data.id) {
      const { data: existing } = await context.supabase
        .from("rp_evidence_records")
        .select("id, team_id")
        .eq("id", data.id)
        .maybeSingle();
      if (!existing) throw new Error("Record not found");
      if (existing.team_id !== data.team_id) throw new Error("Forbidden: wrong team");
      const { data: row, error } = await context.supabase
        .from("rp_evidence_records")
        .update(payload)
        .eq("id", data.id)
        .select("*")
        .single();
      if (error) throw error;
      return { record: row };
    }

    const { data: row, error } = await context.supabase
      .from("rp_evidence_records")
      .insert({ ...payload, created_by: context.userId })
      .select("*")
      .single();
    if (error) throw error;
    return { record: row };
  });

/** Delete an evidence record. Its files cascade away with it. */
export const deleteEvidenceRecord = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => z.object({ id: z.string().uuid() }).parse(d))
  .handler(async ({ data, context }) => {
    const { data: rec } = await context.supabase
      .from("rp_evidence_records")
      .select("id, team_id")
      .eq("id", data.id)
      .maybeSingle();
    if (!rec) throw new Error("Record not found");
    await ensureTeamWrite(context.supabase, context.userId, rec.team_id);
    const { error } = await context.supabase
      .from("rp_evidence_records")
      .delete()
      .eq("id", data.id);
    if (error) throw error;
    return { ok: true };
  });

/** Attach one uploaded file to a record. A record may hold many files. */
export const attachEvidenceFile = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) =>
    z
      .object({
        record_id: z.string().uuid(),
        team_id: z.string().uuid(),
        file_name: z.string().trim().min(1).max(400),
        storage_path: z.string().trim().min(1).max(1000),
        mime_type: z.string().trim().max(200).nullable().optional(),
        file_size: z.number().int().nonnegative().nullable().optional(),
      })
      .parse(d),
  )
  .handler(async ({ data, context }) => {
    await ensureTeamWrite(context.supabase, context.userId, data.team_id);

    const { data: rec } = await context.supabase
      .from("rp_evidence_records")
      .select("id, team_id")
      .eq("id", data.record_id)
      .maybeSingle();
    if (!rec) throw new Error("Record not found");
    if (rec.team_id !== data.team_id) throw new Error("Forbidden: wrong team");
    // Storage RLS keys on the leading team-id path segment; keep files inside it.
    if (!data.storage_path.startsWith(`${data.team_id}/`)) {
      throw new Error("Invalid storage path for this team");
    }

    const { data: row, error } = await context.supabase
      .from("rp_evidence_files")
      .insert({
        record_id: data.record_id,
        team_id: data.team_id,
        file_name: data.file_name,
        storage_path: data.storage_path,
        mime_type: data.mime_type || null,
        file_size: data.file_size ?? null,
        uploaded_by: context.userId,
      })
      .select("*")
      .single();
    if (error) throw error;
    return { file: row };
  });

/** Remove one attached file from a record. */
export const removeEvidenceFile = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => z.object({ file_id: z.string().uuid() }).parse(d))
  .handler(async ({ data, context }) => {
    const { data: f } = await context.supabase
      .from("rp_evidence_files")
      .select("id, team_id")
      .eq("id", data.file_id)
      .maybeSingle();
    if (!f) throw new Error("File not found");
    await ensureTeamWrite(context.supabase, context.userId, f.team_id);
    const { error } = await context.supabase
      .from("rp_evidence_files")
      .delete()
      .eq("id", data.file_id);
    if (error) throw error;
    return { ok: true };
  });
