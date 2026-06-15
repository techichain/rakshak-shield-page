// Public-facing server functions for mentor applications.
// Insert is unauthenticated by design — the public form is anonymous —
// but the handler validates input and writes via the service role.
import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

const applySchema = z.object({
  full_name: z.string().min(1).max(160),
  email: z.string().email().max(200),
  phone: z.string().max(40).optional().nullable(),
  city: z.string().max(120).optional().nullable(),
  state: z.string().max(120).optional().nullable(),
  organization: z.string().max(200).optional().nullable(),
  designation: z.string().max(200).optional().nullable(),
  expertise: z.string().max(2000).optional().nullable(),
  years_experience: z.number().int().min(0).max(80).optional().nullable(),
  linkedin_url: z.string().max(400).optional().nullable(),
  motivation: z.string().max(4000).optional().nullable(),
});

export const submitMentorApplication = createServerFn({ method: "POST" })
  .inputValidator((data: unknown) => applySchema.parse(data))
  .handler(async ({ data }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

    const { data: inserted, error } = await supabaseAdmin
      .from("rp_mentor_applications")
      .insert({ ...data, status: "pending" })
      .select("id")
      .single();
    if (error) throw new Error(error.message);

    try {
      const { notifyAdminsOfRoleRequest } = await import("./admin-notify.server");
      await notifyAdminsOfRoleRequest({
        requesterId: inserted.id,
        requesterName: data.full_name,
        requesterEmail: data.email,
        requestedRole: "mentor",
        notes: data.motivation ?? null,
        source: "mentor application form",
        approvalId: inserted.id,
      });
    } catch (err) {
      console.error("notifyAdminsOfRoleRequest (mentor app) failed", err);
    }

    return { ok: true, id: inserted.id };
  });
