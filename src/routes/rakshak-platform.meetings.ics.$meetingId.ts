import { createFileRoute } from "@tanstack/react-router";
import { supabaseAdmin } from "@/integrations/supabase/client.server";

export const Route = createFileRoute(
  "/rakshak-platform/meetings/ics/$meetingId",
)({
  server: {
    handlers: {
      GET: async ({ params }) => {
        const { meetingId } = params;
        const { data: meeting } = await supabaseAdmin
          .from("rp_meetings")
          .select(
            "id, title, agenda, scheduled_start, scheduled_end, meeting_link, location, created_by",
          )
          .eq("id", meetingId)
          .maybeSingle();

        if (!meeting) {
          return new Response("Meeting not found", { status: 404 });
        }

        const fmt = (iso: string) =>
          new Date(iso).toISOString().replace(/[-:]/g, "").replace(/\.\d{3}/, "");
        const now = fmt(new Date().toISOString());
        const description = [
          meeting.agenda ?? "",
          meeting.meeting_link ? `Join: ${meeting.meeting_link}` : "",
        ]
          .filter(Boolean)
          .join("\\n\\n");

        const ics = [
          "BEGIN:VCALENDAR",
          "VERSION:2.0",
          "PRODID:-//Crashfree India//Rakshak Platform//EN",
          "METHOD:PUBLISH",
          "BEGIN:VEVENT",
          `UID:rp-${meeting.id}@rakshak.crashfreeindia.org`,
          `DTSTAMP:${now}`,
          `DTSTART:${fmt(meeting.scheduled_start as string)}`,
          `DTEND:${fmt(meeting.scheduled_end as string)}`,
          `SUMMARY:${String(meeting.title).replace(/\n/g, " ")}`,
          `DESCRIPTION:${description}`,
          meeting.location ? `LOCATION:${meeting.location}` : "",
          meeting.meeting_link ? `URL:${meeting.meeting_link}` : "",
          "STATUS:CONFIRMED",
          "BEGIN:VALARM",
          "TRIGGER:-PT1H",
          "ACTION:DISPLAY",
          "DESCRIPTION:Meeting reminder",
          "END:VALARM",
          "END:VEVENT",
          "END:VCALENDAR",
        ]
          .filter(Boolean)
          .join("\r\n");

        const safeTitle = String(meeting.title)
          .replace(/[^a-z0-9]/gi, "-")
          .toLowerCase();
        return new Response(ics, {
          status: 200,
          headers: {
            "Content-Type": "text/calendar; charset=utf-8",
            "Content-Disposition": `attachment; filename="${safeTitle}.ics"`,
            "Cache-Control": "no-store",
          },
        });
      },
    },
  },
});
