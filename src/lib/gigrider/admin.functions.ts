import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { supabaseAdmin } from "@/integrations/supabase/client.server";

export const USERNAME_EMAIL_DOMAIN = "gigrider.local";

const createObserverInput = z.object({
  username: z
    .string()
    .trim()
    .toLowerCase()
    .min(3)
    .max(32)
    .regex(/^[a-z0-9._-]+$/, "lowercase letters, digits, . _ - only"),
  name: z.string().trim().min(1).max(100),
  password: z.string().min(6).max(72),
});

export const createObserver = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input) => createObserverInput.parse(input))
  .handler(async ({ data, context }) => {
    // Verify caller is admin
    const { data: roles, error: roleErr } = await context.supabase
      .from("user_roles")
      .select("role")
      .eq("user_id", context.userId);
    if (roleErr) throw new Error(roleErr.message);
    const isAdmin = (roles ?? []).some((r) => r.role === "admin");
    if (!isAdmin) throw new Error("Forbidden: admin only");

    const email = `${data.username}@${USERNAME_EMAIL_DOMAIN}`;

    // Ensure username is unique
    const { data: existing } = await supabaseAdmin
      .from("profiles")
      .select("id")
      .eq("username", data.username)
      .maybeSingle();
    if (existing) throw new Error("Username already taken");

    const { data: created, error } = await supabaseAdmin.auth.admin.createUser({
      email,
      password: data.password,
      email_confirm: true,
      user_metadata: { name: data.name, username: data.username },
    });
    if (error) throw new Error(error.message);
    const newUserId = created.user?.id;
    if (!newUserId) throw new Error("Failed to create user");

    // Trigger handle_new_user creates profile + observer role automatically.
    // Make sure username is set even if metadata path missed.
    await supabaseAdmin
      .from("profiles")
      .update({ name: data.name, username: data.username })
      .eq("id", newUserId);

    return { id: newUserId, username: data.username, email };
  });

export const listObservers = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { data: roles } = await context.supabase
      .from("user_roles")
      .select("role")
      .eq("user_id", context.userId);
    const isAdmin = (roles ?? []).some((r) => r.role === "admin");
    if (!isAdmin) throw new Error("Forbidden: admin only");

    const { data: observerRoles, error } = await supabaseAdmin
      .from("user_roles")
      .select("user_id")
      .eq("role", "observer");
    if (error) throw new Error(error.message);
    const ids = (observerRoles ?? []).map((r) => r.user_id);
    if (ids.length === 0) return { observers: [] };

    const { data: profiles } = await supabaseAdmin
      .from("profiles")
      .select("id, name, username, is_active, created_at")
      .in("id", ids)
      .order("created_at", { ascending: false });

    return { observers: profiles ?? [] };
  });

async function assertAdmin(supabase: any, userId: string) {
  const { data: roles } = await supabase.from("user_roles").select("role").eq("user_id", userId);
  if (!(roles ?? []).some((r: any) => r.role === "admin")) {
    throw new Error("Forbidden: admin only");
  }
}

export const listAllObservations = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    await assertAdmin(context.supabase, context.userId);

    const [{ data: obs, error }, { data: hotspots }, { data: surveyors }, { data: profiles }] = await Promise.all([
      supabaseAdmin
        .from("observations")
        .select("*")
        .order("updated_at", { ascending: false }),
      supabaseAdmin.from("hotspots").select("id, name, city, sublabel"),
      supabaseAdmin.from("surveyors").select("id, name"),
      supabaseAdmin.from("profiles").select("id, name, username"),
    ]);
    if (error) throw new Error(error.message);

    const hMap = new Map((hotspots ?? []).map((h) => [h.id, h]));
    const sMap = new Map((surveyors ?? []).map((s) => [s.id, s]));
    const pMap = new Map((profiles ?? []).map((p) => [p.id, p]));

    // Fetch photos for all observations + build signed URLs (bucket is private)
    const obsIds = (obs ?? []).map((o) => o.id);
    const photoMap = new Map<string, { file_name: string; url: string | null; photo_context: string }[]>();
    if (obsIds.length) {
      const { data: photos } = await supabaseAdmin
        .from("observation_photos")
        .select("observation_id, storage_path, file_name, photo_context")
        .in("observation_id", obsIds);
      for (const p of photos ?? []) {
        const { data: signed } = await supabaseAdmin.storage
          .from("observation-photos")
          .createSignedUrl(p.storage_path, 3600);
        const arr = photoMap.get(p.observation_id) ?? [];
        arr.push({ file_name: p.file_name, url: signed?.signedUrl ?? null, photo_context: (p as any).photo_context ?? "road_environment" });
        photoMap.set(p.observation_id, arr);
      }
    }

    return (obs ?? []).map((o) => {
      const photos = photoMap.get(o.id) ?? [];
      return {
        ...o,
        hotspot: o.hotspot_id ? hMap.get(o.hotspot_id) ?? null : null,
        surveyor: o.surveyor_id ? sMap.get(o.surveyor_id) ?? null : null,
        observer: o.observer_id ? pMap.get(o.observer_id) ?? null : null,
        photos,
        photo_count: photos.length,
        photo_urls: photos.map((p) => p.url).filter(Boolean).join(" | "),
      };
    });
  });

export const getObservationAdmin = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: { id: string }) => z.object({ id: z.string().uuid() }).parse(d))
  .handler(async ({ context, data }) => {
    await assertAdmin(context.supabase, context.userId);

    const { data: obs, error } = await supabaseAdmin
      .from("observations").select("*").eq("id", data.id).maybeSingle();
    if (error) throw new Error(error.message);
    if (!obs) return null;

    const [hotspot, surveyor, observer, photos] = await Promise.all([
      obs.hotspot_id
        ? supabaseAdmin.from("hotspots").select("id, name, city, sublabel").eq("id", obs.hotspot_id).maybeSingle().then((r) => r.data)
        : Promise.resolve(null),
      obs.surveyor_id
        ? supabaseAdmin.from("surveyors").select("id, name").eq("id", obs.surveyor_id).maybeSingle().then((r) => r.data)
        : Promise.resolve(null),
      supabaseAdmin.from("profiles").select("id, name, username").eq("id", obs.observer_id).maybeSingle().then((r) => r.data),
      supabaseAdmin.from("observation_photos").select("id, storage_path, file_name, photo_context").eq("observation_id", data.id),
    ]);

    const photoList = photos.data ?? [];
    const signed = await Promise.all(photoList.map(async (p) => {
      const { data: s } = await supabaseAdmin.storage
        .from("observation-photos").createSignedUrl(p.storage_path, 3600);
      return { id: p.id, file_name: p.file_name, photo_context: (p as any).photo_context ?? "road_environment", url: s?.signedUrl ?? null };
    }));

    return { ...obs, hotspot, surveyor, observer, photos: signed };
  });
