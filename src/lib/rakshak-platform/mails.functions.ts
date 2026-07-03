// In-app mail (threaded messaging) — team leader / member ↔ mentor / admin.
// Each new message also enqueues a notification email via the existing
// transactional email queue.

import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { z } from "zod";
import * as React from "react";
import { render } from "@react-email/components";
import { TEMPLATES } from "@/lib/email-templates/registry";

const SITE_NAME = "rakshak-crashfreeindia";
const SENDER_DOMAIN = "notify.rakshak.crashfreeindia.org";
const FROM_DOMAIN = "rakshak.crashfreeindia.org";
const SITE_URL = "https://rakshak.crashfreeindia.org";

async function isAdmin(supabase: any, userId: string) {
  const { data } = await supabase.rpc("rp_is_admin", { _user_id: userId });
  return !!data;
}

function tokenHex(): string {
  const b = new Uint8Array(32);
  crypto.getRandomValues(b);
  return Array.from(b).map((x) => x.toString(16).padStart(2, "0")).join("");
}

async function enqueueNotification(
  admin: any,
  recipientEmail: string,
  recipientName: string,
  senderName: string,
  subject: string,
  body: string,
  threadId: string,
) {
  const template = TEMPLATES["rp-mail-notification"];
  if (!template) return;

  const normalized = recipientEmail.toLowerCase();

  const { data: suppressed } = await admin
    .from("suppressed_emails").select("id").eq("email", normalized).maybeSingle();
  if (suppressed) return;

  // Reuse or create unsubscribe token
  let unsubscribeToken: string;
  const { data: existing } = await admin
    .from("email_unsubscribe_tokens").select("token, used_at").eq("email", normalized).maybeSingle();
  if (existing?.token && !existing.used_at) {
    unsubscribeToken = existing.token;
  } else if (!existing) {
    unsubscribeToken = tokenHex();
    await admin.from("email_unsubscribe_tokens").upsert(
      { token: unsubscribeToken, email: normalized },
      { onConflict: "email", ignoreDuplicates: true },
    );
    const { data: re } = await admin
      .from("email_unsubscribe_tokens").select("token").eq("email", normalized).maybeSingle();
    unsubscribeToken = re?.token ?? unsubscribeToken;
  } else {
    return;
  }

  const templateData = {
    recipient_name: recipientName,
    sender_name: senderName,
    subject,
    body_preview: body.slice(0, 400),
    cta_url: `${SITE_URL}/rakshak-platform/mails?thread=${threadId}`,
  };

  const element = React.createElement(template.component as any, templateData);
  const html = await render(element);
  const plainText = await render(element, { plainText: true });
  const subjectLine =
    typeof template.subject === "function" ? template.subject(templateData) : template.subject;

  const messageId = crypto.randomUUID();
  await admin.from("email_send_log").insert({
    message_id: messageId,
    template_name: "rp-mail-notification",
    recipient_email: recipientEmail,
    status: "pending",
    metadata: { thread_id: threadId },
  });

  await admin.rpc("enqueue_email", {
    queue_name: "transactional_emails",
    payload: {
      message_id: messageId,
      to: recipientEmail,
      from: `${SITE_NAME} <noreply@${FROM_DOMAIN}>`,
      sender_domain: SENDER_DOMAIN,
      subject: subjectLine,
      html,
      text: plainText,
      purpose: "transactional",
      label: "rp-mail-notification",
      idempotency_key: `mail:${messageId}`,
      unsubscribe_token: unsubscribeToken,
      queued_at: new Date().toISOString(),
    },
  });
}

// ============ List my threads ============
export const listMyMailThreads = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { supabase, userId } = context;

    const { data: parts } = await supabase
      .from("rp_mail_participants")
      .select("thread_id, last_read_at")
      .eq("profile_id", userId);
    const ids = (parts ?? []).map((p: any) => p.thread_id);
    const lastReadById = new Map((parts ?? []).map((p: any) => [p.thread_id, p.last_read_at]));

    if (ids.length === 0) return { threads: [] };

    const { data: threads } = await supabase
      .from("rp_mail_threads")
      .select("id, subject, related_team_id, scope, last_message_at, last_message_preview, created_by, created_at")
      .in("id", ids)
      .order("last_message_at", { ascending: false });

    // Fetch all participants + profiles for these threads
    const { data: allParts } = await supabase
      .from("rp_mail_participants")
      .select("thread_id, profile_id, rp_profiles:profile_id(id, full_name, email)")
      .in("thread_id", ids);

    // Unread counts
    const { data: recentMsgs } = await supabase
      .from("rp_mail_messages")
      .select("thread_id, sender_id, sent_at")
      .in("thread_id", ids);

    const partsByThread = new Map<string, any[]>();
    for (const p of allParts ?? []) {
      const arr = partsByThread.get(p.thread_id) ?? [];
      arr.push(p);
      partsByThread.set(p.thread_id, arr);
    }
    const unreadByThread = new Map<string, number>();
    for (const m of recentMsgs ?? []) {
      if (m.sender_id === userId) continue;
      const lr = lastReadById.get(m.thread_id);
      if (!lr || new Date(m.sent_at) > new Date(lr as string)) {
        unreadByThread.set(m.thread_id, (unreadByThread.get(m.thread_id) ?? 0) + 1);
      }
    }

    return {
      threads: (threads ?? []).map((t: any) => ({
        ...t,
        participants: (partsByThread.get(t.id) ?? []).map((p: any) => ({
          profile_id: p.profile_id,
          full_name: p.rp_profiles?.full_name,
          email: p.rp_profiles?.email,
        })),
        unread_count: unreadByThread.get(t.id) ?? 0,
      })),
    };
  });

// ============ Get one thread ============
export const getMailThread = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => z.object({ threadId: z.string().uuid() }).parse(d))
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;

    const { data: thread, error } = await supabase
      .from("rp_mail_threads")
      .select("id, subject, related_team_id, scope, last_message_at, created_by, created_at")
      .eq("id", data.threadId)
      .maybeSingle();
    if (error || !thread) throw new Error("Thread not found");

    const [{ data: participants }, { data: messages }] = await Promise.all([
      supabase
        .from("rp_mail_participants")
        .select("profile_id, role_in_thread, last_read_at, added_at, rp_profiles:profile_id(id, full_name, email)")
        .eq("thread_id", data.threadId),
      supabase
        .from("rp_mail_messages")
        .select("id, sender_id, body, sent_at, rp_profiles:sender_id(id, full_name, email)")
        .eq("thread_id", data.threadId)
        .order("sent_at", { ascending: true }),
    ]);

    // Mark current user as read (idempotent upsert on last_read_at)
    await supabase
      .from("rp_mail_participants")
      .update({ last_read_at: new Date().toISOString() })
      .eq("thread_id", data.threadId)
      .eq("profile_id", userId);

    return {
      thread,
      participants: participants ?? [],
      messages: messages ?? [],
    };
  });

// ============ Create a new thread ============
export const createMailThread = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) =>
    z.object({
      subject: z.string().trim().min(1).max(200),
      body: z.string().trim().min(1).max(8000),
      recipientIds: z.array(z.string().uuid()).min(1).max(20),
      relatedTeamId: z.string().uuid().optional().nullable(),
    }).parse(d),
  )
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;

    const { data: thread, error: tErr } = await supabase
      .from("rp_mail_threads")
      .insert({
        subject: data.subject,
        created_by: userId,
        related_team_id: data.relatedTeamId ?? null,
        scope: "direct",
        last_message_preview: data.body.slice(0, 160),
      })
      .select("id")
      .single();
    if (tErr || !thread) throw new Error(tErr?.message || "Could not create thread");

    // Participants: current user + recipients (dedup)
    const all = Array.from(new Set([userId, ...data.recipientIds]));
    const rows = all.map((pid) => ({
      thread_id: thread.id,
      profile_id: pid,
      role_in_thread: pid === userId ? "creator" : "recipient",
      last_read_at: pid === userId ? new Date().toISOString() : null,
    }));
    const { error: pErr } = await supabase.from("rp_mail_participants").insert(rows);
    if (pErr) throw new Error(pErr.message);

    const { data: msg, error: mErr } = await supabase
      .from("rp_mail_messages")
      .insert({ thread_id: thread.id, sender_id: userId, body: data.body })
      .select("id, sent_at")
      .single();
    if (mErr || !msg) throw new Error(mErr?.message || "Could not send message");

    // Fire notification emails
    try {
      const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
      const { data: sender } = await supabaseAdmin
        .from("rp_profiles").select("full_name, email").eq("id", userId).maybeSingle();
      const { data: recipientProfiles } = await supabaseAdmin
        .from("rp_profiles").select("id, full_name, email").in("id", data.recipientIds);
      for (const r of recipientProfiles ?? []) {
        if (!r.email) continue;
        await enqueueNotification(
          supabaseAdmin,
          r.email,
          r.full_name || "there",
          (sender as any)?.full_name || (sender as any)?.email || "A Rakshak user",
          data.subject,
          data.body,
          thread.id,
        );
      }
    } catch (e) {
      console.error("[mails] notification enqueue failed", e);
    }

    return { threadId: thread.id };
  });

// ============ Reply to a thread ============
export const replyToMailThread = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) =>
    z.object({
      threadId: z.string().uuid(),
      body: z.string().trim().min(1).max(8000),
    }).parse(d),
  )
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;

    const { data: msg, error } = await supabase
      .from("rp_mail_messages")
      .insert({ thread_id: data.threadId, sender_id: userId, body: data.body })
      .select("id, sent_at")
      .single();
    if (error || !msg) throw new Error(error?.message || "Could not send message");

    // Mark self as read
    await supabase
      .from("rp_mail_participants")
      .update({ last_read_at: new Date().toISOString() })
      .eq("thread_id", data.threadId)
      .eq("profile_id", userId);

    try {
      const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
      const { data: thread } = await supabaseAdmin
        .from("rp_mail_threads").select("id, subject").eq("id", data.threadId).maybeSingle();
      const { data: sender } = await supabaseAdmin
        .from("rp_profiles").select("full_name, email").eq("id", userId).maybeSingle();
      const { data: participants } = await supabaseAdmin
        .from("rp_mail_participants")
        .select("profile_id, rp_profiles:profile_id(full_name, email)")
        .eq("thread_id", data.threadId)
        .neq("profile_id", userId);
      for (const p of participants ?? []) {
        const prof: any = p.rp_profiles;
        if (!prof?.email) continue;
        await enqueueNotification(
          supabaseAdmin,
          prof.email,
          prof.full_name || "there",
          (sender as any)?.full_name || (sender as any)?.email || "A Rakshak user",
          (thread as any)?.subject || "New message",
          data.body,
          data.threadId,
        );
      }
    } catch (e) {
      console.error("[mails] reply notification failed", e);
    }

    return { messageId: msg.id };
  });

// ============ List possible recipients for composer ============
export const listMailRecipients = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { supabase, userId } = context;
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

    const admin = await isAdmin(supabase, userId);

    const groups: {
      label: string;
      recipients: { id: string; name: string; email: string; role: string }[];
    }[] = [];

    // Admins list — visible to everyone
    const { data: adminRoles } = await supabaseAdmin
      .from("rp_user_roles").select("user_id").in("role", ["cfi_admin", "super_admin"]);
    const adminIds = Array.from(new Set((adminRoles ?? []).map((r: any) => r.user_id))).filter((id) => id !== userId);
    if (adminIds.length) {
      const { data: adminProfiles } = await supabaseAdmin
        .from("rp_profiles").select("id, full_name, email").in("id", adminIds);
      groups.push({
        label: "Admins",
        recipients: (adminProfiles ?? []).map((p: any) => ({
          id: p.id, name: p.full_name || p.email, email: p.email, role: "admin",
        })),
      });
    }

    if (admin) {
      // Admin sees: all team leaders + all mentors
      const { data: teams } = await supabaseAdmin
        .from("rp_teams")
        .select("id, team_name, team_leader_id, assigned_mentor_id, leader:team_leader_id(id, full_name, email)");
      const leaderRecipients: any[] = [];
      const mentorIds = new Set<string>();
      for (const t of teams ?? []) {
        const l: any = t.leader;
        if (l?.id && l.id !== userId) {
          leaderRecipients.push({
            id: l.id, name: `${l.full_name || l.email} · ${t.team_name}`, email: l.email, role: "team_leader",
          });
        }
        if (t.assigned_mentor_id) mentorIds.add(t.assigned_mentor_id);
      }
      if (leaderRecipients.length) groups.push({ label: "Team leaders", recipients: leaderRecipients });
      if (mentorIds.size) {
        const { data: mentors } = await supabaseAdmin
          .from("rp_mentors").select("id, profile_id, rp_profiles:profile_id(id, full_name, email)")
          .in("id", Array.from(mentorIds));
        const mentorRecipients = (mentors ?? [])
          .map((m: any) => m.rp_profiles)
          .filter((p: any) => p?.id && p.id !== userId)
          .map((p: any) => ({ id: p.id, name: p.full_name || p.email, email: p.email, role: "mentor" }));
        if (mentorRecipients.length) groups.push({ label: "Mentors", recipients: mentorRecipients });
      }
      return { groups };
    }

    // Non-admin: find the teams the user is on (as leader OR member)
    const { data: leaderTeams } = await supabase
      .from("rp_teams")
      .select("id, team_name, assigned_mentor_id")
      .eq("team_leader_id", userId);
    const { data: memberRows } = await supabase
      .from("rp_team_members")
      .select("team_id")
      .eq("profile_id", userId);
    const teamIds = Array.from(new Set([
      ...(leaderTeams ?? []).map((t: any) => t.id),
      ...(memberRows ?? []).map((r: any) => r.team_id),
    ]));

    if (teamIds.length) {
      const { data: teams } = await supabaseAdmin
        .from("rp_teams")
        .select("id, team_name, team_leader_id, assigned_mentor_id, leader:team_leader_id(id, full_name, email)")
        .in("id", teamIds);

      // Mentors of my teams
      const mentorIds = Array.from(new Set(
        (teams ?? []).map((t: any) => t.assigned_mentor_id).filter(Boolean),
      ));
      if (mentorIds.length) {
        const { data: mentors } = await supabaseAdmin
          .from("rp_mentors").select("id, profile_id, rp_profiles:profile_id(id, full_name, email)")
          .in("id", mentorIds);
        const mentorRecipients = (mentors ?? [])
          .map((m: any) => m.rp_profiles)
          .filter((p: any) => p?.id && p.id !== userId)
          .map((p: any) => ({ id: p.id, name: p.full_name || p.email, email: p.email, role: "mentor" }));
        if (mentorRecipients.length) groups.push({ label: "My mentor", recipients: mentorRecipients });
      }

      // Team leader & members of my teams
      const { data: members } = await supabaseAdmin
        .from("rp_team_members")
        .select("profile_id, full_name, email, team_id, role_in_team")
        .in("team_id", teamIds);
      const teammate: any[] = [];
      for (const t of teams ?? []) {
        const l: any = t.leader;
        if (l?.id && l.id !== userId) {
          teammate.push({ id: l.id, name: `${l.full_name || l.email} · Leader (${t.team_name})`, email: l.email, role: "team_leader" });
        }
      }
      for (const m of members ?? []) {
        if (!m.profile_id || m.profile_id === userId || !m.email) continue;
        teammate.push({
          id: m.profile_id, name: `${m.full_name || m.email} · ${m.role_in_team || "Member"}`, email: m.email, role: "team_member",
        });
      }
      if (teammate.length) {
        // Dedupe by id
        const seen = new Set<string>();
        const uniq = teammate.filter((r) => (seen.has(r.id) ? false : (seen.add(r.id), true)));
        groups.push({ label: "My team", recipients: uniq });
      }
    }

    return { groups };
  });
