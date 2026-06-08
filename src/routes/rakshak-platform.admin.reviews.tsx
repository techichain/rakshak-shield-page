import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect } from "react";
import { PlatformShell, Section, Eyebrow } from "@/components/rakshak-platform/Shell";
import { ReviewPanel } from "@/components/rakshak-platform/ReviewPanel";
import { useRPAuth } from "@/lib/rakshak-platform/auth";

export const Route = createFileRoute("/rakshak-platform/admin/reviews")({
  component: AdminReviewsPage,
  errorComponent: ({ error }) => (
    <PlatformShell><Section><p className="text-red-600">{String(error)}</p></Section></PlatformShell>
  ),
  notFoundComponent: () => (
    <PlatformShell><Section><p>Not found.</p></Section></PlatformShell>
  ),
});

function AdminReviewsPage() {
  const { loading, userId, isAdmin } = useRPAuth();
  const navigate = useNavigate();
  useEffect(() => {
    if (loading) return;
    if (!userId) { navigate({ to: "/rakshak-platform/auth" }); return; }
    if (!isAdmin) { navigate({ to: "/rakshak-platform/dashboard" }); }
  }, [loading, userId, isAdmin, navigate]);

  if (loading || !isAdmin) {
    return <PlatformShell><Section>Loading…</Section></PlatformShell>;
  }

  return (
    <PlatformShell>
      <Section>
        <Eyebrow>Admin · Approval queue</Eyebrow>
        <h1 className="mt-6 mb-10 font-heading text-4xl sm:text-5xl font-bold leading-[1.05]">
          Final
          <br /><span className="text-brand">approvals.</span>
        </h1>
        <ReviewPanel role="admin" />
      </Section>
    </PlatformShell>
  );
}
