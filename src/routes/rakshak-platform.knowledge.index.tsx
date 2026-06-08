import { createFileRoute, Link } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useQuery } from "@tanstack/react-query";
import { useMemo, useState } from "react";
import { PlatformShell, Section, Eyebrow } from "@/components/rakshak-platform/Shell";
import { listArticles } from "@/lib/rakshak-platform/knowledge.functions";
import { BookOpen } from "lucide-react";

export const Route = createFileRoute("/rakshak-platform/knowledge/")({
  head: () => ({
    meta: [
      { title: "Knowledge Hub — Project Rakshak" },
      { name: "description", content: "Guides, playbooks, and case studies for youth-led road safety audits in India." },
      { property: "og:title", content: "Knowledge Hub — Project Rakshak" },
      { property: "og:description", content: "Guides, playbooks, and case studies for youth-led road safety audits in India." },
    ],
  }),
  component: KnowledgeIndex,
});

function KnowledgeIndex() {
  const fetchArticles = useServerFn(listArticles);
  const { data, isLoading } = useQuery({ queryKey: ["rp-articles"], queryFn: () => fetchArticles() });
  const [cat, setCat] = useState("all");
  const articles = data?.articles ?? [];
  const categories = useMemo(() => {
    const s = new Set<string>(["all"]);
    articles.forEach((a: any) => a.category && s.add(a.category));
    return Array.from(s);
  }, [articles]);
  const filtered = cat === "all" ? articles : articles.filter((a: any) => a.category === cat);

  return (
    <PlatformShell>
      <Section>
        <Eyebrow>Knowledge Hub</Eyebrow>
        <h1 className="mt-6 font-heading text-4xl sm:text-5xl font-bold leading-[1.05]">
          Field-tested playbooks<br />
          <span className="text-brand">for safer Indian roads.</span>
        </h1>
        <p className="mt-4 max-w-2xl text-muted-foreground">
          Short, practical reads written by Crashfree India staff, mentors, and alumni teams.
        </p>

        <div className="mt-8 flex flex-wrap gap-2">
          {categories.map((c) => (
            <button
              key={c}
              onClick={() => setCat(c)}
              className={`h-9 px-4 rounded-full text-sm border ${cat === c ? "bg-brand text-brand-foreground border-brand" : "border-border hover:border-brand/40"}`}
            >
              {c === "all" ? "All" : c}
            </button>
          ))}
        </div>

        {isLoading ? (
          <p className="mt-10 text-sm text-muted-foreground">Loading articles…</p>
        ) : filtered.length === 0 ? (
          <div className="mt-10 rounded-2xl border border-dashed border-border bg-card p-12 text-center text-sm text-muted-foreground">
            <BookOpen className="mx-auto h-8 w-8 mb-3 text-brand" />
            No articles in this category yet.
          </div>
        ) : (
          <div className="mt-10 grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
            {filtered.map((a: any) => (
              <Link
                key={a.id}
                to="/rakshak-platform/knowledge/$slug"
                params={{ slug: a.slug }}
                className="group rounded-2xl border border-border bg-card p-6 hover:border-brand/40 transition"
              >
                <div className="text-xs uppercase tracking-wider text-brand">{a.category}</div>
                <h3 className="mt-3 font-heading text-xl font-semibold leading-snug group-hover:text-brand">{a.title}</h3>
                {a.excerpt && <p className="mt-3 text-sm text-muted-foreground">{a.excerpt}</p>}
                <div className="mt-4 text-xs text-muted-foreground">
                  {a.published_at ? new Date(a.published_at).toLocaleDateString() : ""}
                </div>
              </Link>
            ))}
          </div>
        )}
      </Section>
    </PlatformShell>
  );
}
