import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { z } from "zod";

export const listArticles = createServerFn({ method: "GET" }).handler(async () => {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  const { data, error } = await supabaseAdmin
    .from("rp_knowledge_articles")
    .select("id, slug, title, category, excerpt, hero_image_url, tags, published_at, is_published")
    .eq("is_published", true)
    .order("published_at", { ascending: false })
    .limit(100);
  if (error) throw error;
  return { articles: data ?? [] };
});

export const getArticleBySlug = createServerFn({ method: "GET" })
  .inputValidator((d: { slug: string }) => z.object({ slug: z.string().min(1).max(160) }).parse(d))
  .handler(async ({ data }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: row, error } = await supabaseAdmin
      .from("rp_knowledge_articles")
      .select("id, slug, title, category, excerpt, body_md, hero_image_url, tags, published_at, is_published")
      .eq("slug", data.slug)
      .eq("is_published", true)
      .maybeSingle();
    if (error) throw error;
    if (!row) throw new Error("Article not found");
    return { article: row };
  });

const ArticleInput = z.object({
  id: z.string().uuid().optional(),
  slug: z.string().min(1).max(160).regex(/^[a-z0-9-]+$/),
  title: z.string().min(1).max(200),
  category: z.string().min(1).max(60),
  excerpt: z.string().max(500).optional().nullable(),
  body_md: z.string().min(1).max(50000),
  hero_image_url: z.string().url().max(500).optional().nullable(),
  tags: z.array(z.string().max(40)).max(20).optional(),
  is_published: z.boolean(),
});

export const upsertArticle = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => ArticleInput.parse(d))
  .handler(async ({ data, context }) => {
    const { data: roles } = await context.supabase
      .from("rp_user_roles").select("role").eq("user_id", context.userId);
    const isAdmin = (roles ?? []).some((r: any) => r.role === "cfi_admin" || r.role === "super_admin");
    if (!isAdmin) throw new Error("Forbidden");
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const payload: any = {
      ...data,
      author_id: context.userId,
      published_at: data.is_published ? new Date().toISOString() : null,
    };
    const { data: row, error } = await supabaseAdmin
      .from("rp_knowledge_articles")
      .upsert(payload, { onConflict: "slug" })
      .select()
      .single();
    if (error) throw error;
    return { article: row };
  });

export const listAllArticlesAdmin = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { data: roles } = await context.supabase
      .from("rp_user_roles").select("role").eq("user_id", context.userId);
    const isAdmin = (roles ?? []).some((r: any) => r.role === "cfi_admin" || r.role === "super_admin");
    if (!isAdmin) throw new Error("Forbidden");
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data, error } = await supabaseAdmin
      .from("rp_knowledge_articles")
      .select("id, slug, title, category, is_published, published_at, updated_at")
      .order("updated_at", { ascending: false });
    if (error) throw error;
    return { articles: data ?? [] };
  });
