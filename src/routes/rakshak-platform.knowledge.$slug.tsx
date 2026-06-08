import { createFileRoute, Link, useParams } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useQuery } from "@tanstack/react-query";
import { PlatformShell, Section } from "@/components/rakshak-platform/Shell";
import { getArticleBySlug } from "@/lib/rakshak-platform/knowledge.functions";
import { ArrowLeft } from "lucide-react";

export const Route = createFileRoute("/rakshak-platform/knowledge/$slug")({
  component: ArticlePage,
});

function renderMd(md: string) {
  // Tiny markdown renderer: headings, lists, paragraphs. Safe-ish (no HTML pass-through).
  const lines = md.split(/\r?\n/);
  const out: React.ReactNode[] = [];
  let para: string[] = [];
  const flush = () => {
    if (para.length) {
      out.push(<p key={out.length} className="text-base leading-relaxed text-foreground/90 my-4">{para.join(" ")}</p>);
      para = [];
    }
  };
  let i = 0;
  while (i < lines.length) {
    const line = lines[i];
    if (/^# /.test(line)) { flush(); out.push(<h1 key={out.length} className="font-heading text-4xl font-bold mt-10 mb-4">{line.slice(2)}</h1>); }
    else if (/^## /.test(line)) { flush(); out.push(<h2 key={out.length} className="font-heading text-2xl font-bold mt-10 mb-3">{line.slice(3)}</h2>); }
    else if (/^### /.test(line)) { flush(); out.push(<h3 key={out.length} className="font-heading text-xl font-semibold mt-8 mb-2">{line.slice(4)}</h3>); }
    else if (/^[-*] /.test(line)) {
      flush();
      const items: string[] = [];
      while (i < lines.length && /^[-*] /.test(lines[i])) { items.push(lines[i].slice(2)); i++; }
      out.push(<ul key={out.length} className="list-disc pl-6 my-4 space-y-1">{items.map((t, k) => <li key={k}>{t}</li>)}</ul>);
      continue;
    }
    else if (/^\d+\. /.test(line)) {
      flush();
      const items: string[] = [];
      while (i < lines.length && /^\d+\. /.test(lines[i])) { items.push(lines[i].replace(/^\d+\.\s/, "")); i++; }
      out.push(<ol key={out.length} className="list-decimal pl-6 my-4 space-y-1">{items.map((t, k) => <li key={k}>{t}</li>)}</ol>);
      continue;
    }
    else if (line.trim() === "") flush();
    else para.push(line);
    i++;
  }
  flush();
  return out;
}

function ArticlePage() {
  const { slug } = useParams({ from: "/rakshak-platform/knowledge/$slug" });
  const fetchArticle = useServerFn(getArticleBySlug);
  const { data, isLoading, error } = useQuery({
    queryKey: ["rp-article", slug],
    queryFn: () => fetchArticle({ data: { slug } }),
  });

  if (isLoading) return <PlatformShell><Section>Loading…</Section></PlatformShell>;
  if (error || !data?.article) {
    return (
      <PlatformShell>
        <Section>
          <p className="text-sm text-muted-foreground">Article not found.</p>
          <Link to="/rakshak-platform/knowledge" className="text-brand text-sm">Back to hub</Link>
        </Section>
      </PlatformShell>
    );
  }
  const a = data.article;

  return (
    <PlatformShell>
      <Section>
        <Link to="/rakshak-platform/knowledge" className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-brand">
          <ArrowLeft className="h-4 w-4" /> All articles
        </Link>
        <div className="mt-6 text-xs uppercase tracking-wider text-brand">{a.category}</div>
        <h1 className="mt-3 font-heading text-4xl sm:text-5xl font-bold leading-tight">{a.title}</h1>
        {a.excerpt && <p className="mt-4 text-lg text-muted-foreground max-w-2xl">{a.excerpt}</p>}
        <div className="mt-2 text-xs text-muted-foreground">
          {a.published_at ? new Date(a.published_at).toLocaleDateString() : ""}
        </div>
        {a.hero_image_url && (
          <img src={a.hero_image_url} alt={a.title} className="mt-8 w-full rounded-2xl border border-border" />
        )}
        <article className="mt-8 max-w-3xl">{renderMd(a.body_md || "")}</article>
      </Section>
    </PlatformShell>
  );
}
