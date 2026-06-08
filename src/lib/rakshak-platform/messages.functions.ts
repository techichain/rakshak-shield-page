import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { z } from "zod";

// List messages (rp_feedback rows) on a submission. Caller must be a team member,
// the assigned mentor/evaluator, or an admin — enforced via RLS on rp_submissions.
export const listSubmissionMessages = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => z.object({ submissionId: z.string().uuid() }).parse(d))
  .handler(async ({ data, context }) => {
    const { supabase } = context;
    // Confirm access by reading the submission (RLS will reject if not allowed)
    const sub = await supabase
      .from("rp_submissions")
      .select("id, team_id, phase_number")
      .eq("id", data.submissionId)
      .maybeSingle();
    if (sub.error || !sub.data) throw new Error("Submission not found");
    const { data: rows, error } = await supabase
      .from("rp_feedback")
      .select("id, submission_id, reviewer_id, reviewer_role, feedback_text, status, score, created_at")
      .eq("submission_id", data.submissionId)
      .order("created_at", { ascending: true });
    if (error) throw error;
    return { messages: rows ?? [], submission: sub.data };
  });

export const postSubmissionMessage = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) =>
    z.object({
      submissionId: z.string().uuid(),
      message: z.string().min(1).max(4000),
    }).parse(d),
  )
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    const sub = await supabase
      .from("rp_submissions")
      .select("id, team_id, phase_number")
      .eq("id", data.submissionId)
      .maybeSingle();
    if (sub.error || !sub.data) throw new Error("Submission not found");

    const { data: roles } = await supabase
      .from("rp_user_roles").select("role").eq("user_id", userId);
    const rset = new Set((roles ?? []).map((r: any) => r.role));
    let reviewer_role = "team_member";
    if (rset.has("cfi_admin") || rset.has("super_admin")) reviewer_role = "admin";
    else if (rset.has("evaluator")) reviewer_role = "evaluator";
    else if (rset.has("mentor")) reviewer_role = "mentor";

    const { data: row, error } = await supabase
      .from("rp_feedback")
      .insert({
        submission_id: data.submissionId,
        team_id: sub.data.team_id,
        phase_number: sub.data.phase_number,
        reviewer_id: userId,
        reviewer_role,
        feedback_text: data.message,
        status: "comment",
      })
      .select("id, submission_id, reviewer_id, reviewer_role, feedback_text, status, created_at")
      .single();
    if (error) throw error;
    return { message: row };
  });
