import { createFileRoute } from "@tanstack/react-router";
import { supabaseAdmin } from "@/integrations/supabase/client.server";

// Map public slugs -> storage object paths in the `public-docs` bucket.
// Served from our own origin so ad-blockers / corporate filters that block
// "*.supabase.co" don't break downloads for applicants.
const FILES: Record<string, { object: string; filename: string }> = {
  "mentor-jd": {
    object: "Project_Rakshak_Mentor_JD.pdf",
    filename: "Project_Rakshak_Mentor_JD.pdf",
  },
  "mentor-assignment": {
    object: "Project_Rakshak_Mentor_Assignment.pdf",
    filename: "Project_Rakshak_Mentor_Assignment.pdf",
  },
};

export const Route = createFileRoute("/api/docs/$file")({
  server: {
    handlers: {
      GET: async ({ params }) => {
        const slug = params.file.replace(/\.pdf$/i, "");
        const entry = FILES[slug];
        if (!entry) return new Response("Not found", { status: 404 });

        const { data, error } = await supabaseAdmin.storage
          .from("public-docs")
          .download(entry.object);

        if (error || !data) {
          return new Response("File unavailable", { status: 502 });
        }

        const buf = await data.arrayBuffer();
        return new Response(buf, {
          status: 200,
          headers: {
            "Content-Type": "application/pdf",
            "Content-Disposition": `attachment; filename="${entry.filename}"`,
            "Content-Length": String(buf.byteLength),
            "Cache-Control": "public, max-age=3600",
          },
        });
      },
    },
  },
});
