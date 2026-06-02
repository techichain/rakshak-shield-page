import { createFileRoute } from "@tanstack/react-router";
import { z } from "zod";
import { supabaseAdmin } from "@/integrations/supabase/client.server";

const MAX_PHOTO_BYTES = 20 * 1024 * 1024;

const uploadSchema = z.object({
  observation_id: z.string().uuid(),
  context: z.enum(["road_environment", "notes"]),
});

const extensionFromType = (type: string) => {
  if (type.includes("png")) return "png";
  if (type.includes("webp")) return "webp";
  if (type.includes("heic")) return "heic";
  if (type.includes("heif")) return "heif";
  return "jpg";
};

const safeFileName = (name: string) =>
  (name || `photo-${new Date().toISOString()}.jpg`).replace(/[\r\n"]/g, "").slice(0, 200);

export const Route = createFileRoute("/api/gigrider/photo-upload")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const token = request.headers.get("authorization")?.replace(/^Bearer\s+/i, "");
        if (!token) return Response.json({ error: "Sign in required" }, { status: 401 });

        const { data: userData, error: userError } = await supabaseAdmin.auth.getUser(token);
        if (userError || !userData.user) {
          return Response.json(
            { error: "Session expired. Please sign in again." },
            { status: 401 },
          );
        }

        const form = await request.formData();
        const parsed = uploadSchema.safeParse({
          observation_id: form.get("observation_id"),
          context: form.get("context"),
        });
        if (!parsed.success)
          return Response.json({ error: "Invalid photo upload request" }, { status: 400 });

        const photo = form.get("photo");
        if (!(photo instanceof File))
          return Response.json({ error: "Photo file is missing" }, { status: 400 });
        if (photo.size <= 0)
          return Response.json({ error: "Photo file is empty" }, { status: 400 });
        if (photo.size > MAX_PHOTO_BYTES) {
          return Response.json({ error: "Photo must be under 20MB" }, { status: 413 });
        }
        if (
          photo.type &&
          !photo.type.startsWith("image/") &&
          photo.type !== "application/octet-stream"
        ) {
          return Response.json({ error: "Only image files can be uploaded" }, { status: 400 });
        }

        const { observation_id, context } = parsed.data;
        const { data: observation, error: observationError } = await supabaseAdmin
          .from("observations")
          .select("id")
          .eq("id", observation_id)
          .eq("observer_id", userData.user.id)
          .maybeSingle();

        if (observationError)
          return Response.json({ error: observationError.message }, { status: 500 });
        if (!observation) return Response.json({ error: "Observation not found" }, { status: 404 });

        const originalName = safeFileName(photo.name);
        const nameExt = originalName.includes(".")
          ? originalName.split(".").pop()?.toLowerCase()
          : null;
        const ext =
          nameExt && /^[a-z0-9]{2,8}$/.test(nameExt) ? nameExt : extensionFromType(photo.type);
        const storagePath = `${observation_id}/${context}/${Date.now()}-${crypto.randomUUID()}.${ext}`;
        const contentType = photo.type || "image/jpeg";

        const { error: uploadError } = await supabaseAdmin.storage
          .from("observation-photos")
          .upload(storagePath, await photo.arrayBuffer(), { contentType, upsert: false });

        if (uploadError) return Response.json({ error: uploadError.message }, { status: 502 });

        const { error: recordError } = await supabaseAdmin.from("observation_photos").insert({
          observation_id,
          storage_path: storagePath,
          file_name: originalName,
          mime_type: contentType,
          size_bytes: photo.size,
          photo_context: context,
        });

        if (recordError) {
          await supabaseAdmin.storage.from("observation-photos").remove([storagePath]);
          return Response.json({ error: recordError.message }, { status: 500 });
        }

        return Response.json({ storage_path: storagePath, file_name: originalName });
      },
    },
  },
});
