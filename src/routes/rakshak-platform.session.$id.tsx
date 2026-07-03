import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useSuspenseQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useEffect, useMemo, useState } from "react";
import { PlatformShell, Section, Eyebrow } from "@/components/rakshak-platform/Shell";
import { getSession } from "@/lib/rakshak-platform/mentor-sessions.functions";
import { useRPAuth } from "@/lib/rakshak-platform/auth";
import { ArrowLeft, Maximize2, Minimize2, ExternalLink, Pencil, Video } from "lucide-react";

export const Route = createFileRoute("/rakshak-platform/session/$id")({
  component: SessionPage,
  errorComponent: ({ error }) => (
    <PlatformShell><Section><p className="text-red-600">{String(error)}</p></Section></PlatformShell>
  ),
  notFoundComponent: () => (
    <PlatformShell><Section><p>Not found.</p></Section></PlatformShell>
  ),
});

function SessionPage() {
  const { id } = Route.useParams();
  const navigate = useNavigate();
  const { loading, userId } = useRPAuth();
  const fn = useServerFn(getSession);

  useEffect(() => {
    if (!loading && !userId) navigate({ to: "/rakshak-platform/auth" });
  }, [loading, userId, navigate]);

  const { data } = useSuspenseQuery({
    queryKey: ["rp-session", id],
    queryFn: () => fn({ data: { meeting_id: id } }),
  });

  const [tab, setTab] = useState<"video" | "whiteboard" | "both">("both");
  const [fs, setFs] = useState(false);

  const meetLink: string | null = data.meeting.meeting_link ?? null;
  const isGoogleMeet = !!meetLink && /meet\.google\.com/i.test(meetLink);
  const isLegacyRoom = !!data.meeting.video_room_id && !isGoogleMeet;

  const legacyVideoUrl = useMemo(() => {
    const room = data.meeting.video_room_id || `rakshak-${data.meeting.id}`;
    const name = encodeURIComponent(data.displayName);
    return `https://meet.jit.si/${room}#userInfo.displayName="${name}"&config.prejoinPageEnabled=false`;
  }, [data]);

  const whiteboardUrl = useMemo(() => {
    const room = data.meeting.whiteboard_room_id || `rakshak-${data.meeting.id}`;
    return `https://witeboard.com/${room}`;
  }, [data]);

  return (
    <PlatformShell>
      <Section>
        <Link to="/rakshak-platform/meetings" className="text-sm text-muted-foreground hover:text-brand inline-flex items-center gap-1 mb-4">
          <ArrowLeft className="size-4" /> Back to meetings
        </Link>
        <div className="flex items-center justify-between gap-4 flex-wrap">
          <div>
            <Eyebrow>Live session</Eyebrow>
            <h1 className="text-2xl md:text-3xl font-extrabold">{data.meeting.title}</h1>
            <p className="text-muted-foreground text-sm mt-1">
              {new Date(data.meeting.scheduled_start).toLocaleString()} · {data.meeting.rp_teams?.team_name ?? "1:1"}
            </p>
          </div>
          <div className="flex items-center gap-2">
            {isLegacyRoom && (
              <div className="rp-card flex p-1 text-xs">
                {(["both", "video", "whiteboard"] as const).map((t) => (
                  <button key={t} onClick={() => setTab(t)} className={`px-3 py-1.5 rounded-md capitalize ${tab === t ? "bg-brand text-white" : "text-muted-foreground hover:text-foreground"}`}>{t}</button>
                ))}
              </div>
            )}
            {isLegacyRoom && (
              <button onClick={() => setFs((v) => !v)} className="rp-btn-secondary inline-flex items-center gap-1">
                {fs ? <Minimize2 className="size-4" /> : <Maximize2 className="size-4" />}
                {fs ? "Exit fullscreen" : "Fullscreen"}
              </button>
            )}
          </div>
        </div>

        {data.meeting.agenda && (
          <p className="text-sm text-muted-foreground mt-3 whitespace-pre-line bg-muted/50 rounded-lg p-3">{data.meeting.agenda}</p>
        )}

        {isGoogleMeet ? (
          <div className="mt-6 rounded-2xl border border-border bg-background p-8 text-center">
            <Video className="mx-auto size-10 text-brand" />
            <h2 className="mt-3 font-heading text-xl">Google Meet</h2>
            <p className="mt-2 text-sm text-muted-foreground max-w-md mx-auto">
              Google Meet doesn't allow embedding. Click below to join in a new tab.
              Everyone on the calendar invite can join.
            </p>
            <a
              href={meetLink!}
              target="_blank"
              rel="noreferrer"
              className="mt-6 inline-flex items-center gap-2 h-11 px-6 rounded-full bg-brand text-brand-foreground text-sm font-medium"
            >
              <Video className="size-4" /> Join Google Meet <ExternalLink className="size-3.5" />
            </a>
            <div className="mt-3 text-xs text-muted-foreground break-all">{meetLink}</div>
          </div>
        ) : isLegacyRoom ? (
          <div className={`mt-4 grid gap-4 ${tab === "both" ? "lg:grid-cols-2" : "grid-cols-1"} ${fs ? "fixed inset-2 z-50 bg-background p-2 rounded-xl shadow-2xl" : ""}`}>
            {(tab === "video" || tab === "both") && (
              <Pane title="Video" icon={<Video className="size-4" />} url={legacyVideoUrl}>
                <iframe
                  src={legacyVideoUrl}
                  allow="camera; microphone; fullscreen; display-capture; autoplay"
                  className="w-full h-full rounded-lg border border-border"
                  title="Video room"
                />
              </Pane>
            )}
            {(tab === "whiteboard" || tab === "both") && (
              <Pane title="Whiteboard" icon={<Pencil className="size-4" />} url={whiteboardUrl}>
                <iframe
                  src={whiteboardUrl}
                  className="w-full h-full rounded-lg border border-border bg-white"
                  title="Whiteboard"
                />
              </Pane>
            )}
          </div>
        ) : (
          <div className="mt-6 rounded-2xl border border-dashed border-border bg-muted/30 p-8 text-center text-sm text-muted-foreground">
            No video link yet. If this is a mentor booking, it appears once your mentor approves the request.
          </div>
        )}

        {isLegacyRoom && (
          <div className="text-xs text-muted-foreground mt-4">
            Room: <code>{data.meeting.video_room_id}</code> · Whiteboard: <code>{data.meeting.whiteboard_room_id}</code>
          </div>
        )}
      </Section>
    </PlatformShell>
  );
}

function Pane({ title, icon, url, children }: { title: string; icon: React.ReactNode; url: string; children: React.ReactNode }) {
  return (
    <div className="flex flex-col bg-background rounded-xl border border-border overflow-hidden" style={{ height: "min(75vh, 720px)" }}>
      <div className="px-3 py-2 flex items-center justify-between border-b border-border bg-muted/40">
        <div className="text-sm font-medium inline-flex items-center gap-1.5">{icon} {title}</div>
        <a href={url} target="_blank" rel="noreferrer" className="text-xs text-brand hover:underline inline-flex items-center gap-1">
          Open in new tab <ExternalLink className="size-3" />
        </a>
      </div>
      <div className="flex-1 min-h-0">{children}</div>
    </div>
  );
}
