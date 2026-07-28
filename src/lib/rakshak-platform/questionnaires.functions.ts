import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { z } from "zod";

async function isAdmin(supabase: any, userId: string) {
  const { data } = await supabase.rpc("rp_is_admin", { _user_id: userId });
  return !!data;
}

async function isOnTeam(supabase: any, teamId: string, userId: string) {
  const { data } = await supabase.rpc("rp_is_team_member", { _team: teamId, _user: userId });
  return !!data;
}

export const createQuestionnaire = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) =>
    z
      .object({
        team_id: z.string().uuid(),
        phase_number: z.number().int().min(0).max(4).nullable().optional(),
        title: z.string().trim().min(1).max(240),
        questions: z.array(z.string().trim().min(1).max(1000)).min(1).max(30),
      })
      .parse(d),
  )
  .handler(async ({ data, context }) => {
    if (!(await isAdmin(context.supabase, context.userId))) throw new Error("Admin only");
    const { data: row, error } = await context.supabase
      .from("rp_admin_questionnaires")
      .insert({
        team_id: data.team_id,
        phase_number: data.phase_number ?? null,
        title: data.title,
        questions: data.questions,
        created_by: context.userId,
      })
      .select()
      .single();
    if (error) throw error;
    return { questionnaire: row };
  });

export const listQuestionnairesForTeam = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) =>
    z
      .object({
        team_id: z.string().uuid(),
        phase_number: z.number().int().min(0).max(4).optional(),
      })
      .parse(d),
  )
  .handler(async ({ data, context }) => {
    const admin = await isAdmin(context.supabase, context.userId);
    if (!admin) {
      const onTeam = await isOnTeam(context.supabase, data.team_id, context.userId);
      if (!onTeam) throw new Error("Forbidden");
    }

    let qq = context.supabase
      .from("rp_admin_questionnaires")
      .select("id, team_id, phase_number, title, questions, created_by, created_at, updated_at")
      .eq("team_id", data.team_id)
      .order("created_at", { ascending: false });
    if (data.phase_number !== undefined) qq = qq.eq("phase_number", data.phase_number);
    const { data: questionnaires, error } = await qq;
    if (error) throw error;

    const ids = (questionnaires ?? []).map((q: any) => q.id);
    let responses: any[] = [];
    if (ids.length) {
      const { data: rows, error: rErr } = await context.supabase
        .from("rp_questionnaire_responses")
        .select("id, questionnaire_id, team_id, respondent_id, answers, submitted_at, updated_at, rp_profiles:rp_profiles_public!respondent_id(full_name, email)")
        .in("questionnaire_id", ids);
      if (rErr) throw rErr;
      responses = rows ?? [];
    }
    const responsesByQ = new Map<string, any[]>();
    for (const r of responses) {
      const arr = responsesByQ.get(r.questionnaire_id) ?? [];
      arr.push(r);
      responsesByQ.set(r.questionnaire_id, arr);
    }
    const enriched = (questionnaires ?? []).map((q: any) => ({
      ...q,
      responses: responsesByQ.get(q.id) ?? [],
    }));
    return { questionnaires: enriched };
  });

export const submitQuestionnaireResponse = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) =>
    z
      .object({
        questionnaire_id: z.string().uuid(),
        team_id: z.string().uuid(),
        answers: z.array(z.string().max(4000)).min(1).max(30),
      })
      .parse(d),
  )
  .handler(async ({ data, context }) => {
    // Must be on the team (leader or member).
    const onTeam = await isOnTeam(context.supabase, data.team_id, context.userId);
    if (!onTeam) throw new Error("Forbidden: not on team");

    // Verify questionnaire belongs to this team.
    const { data: q } = await context.supabase
      .from("rp_admin_questionnaires")
      .select("id, team_id, questions")
      .eq("id", data.questionnaire_id)
      .maybeSingle();
    if (!q) throw new Error("Questionnaire not found");
    if (q.team_id !== data.team_id) throw new Error("Team mismatch");

    const { data: row, error } = await context.supabase
      .from("rp_questionnaire_responses")
      .upsert(
        {
          questionnaire_id: data.questionnaire_id,
          team_id: data.team_id,
          respondent_id: context.userId,
          answers: data.answers,
          submitted_at: new Date().toISOString(),
        },
        { onConflict: "questionnaire_id,respondent_id" },
      )
      .select()
      .single();
    if (error) throw error;
    return { response: row };
  });
