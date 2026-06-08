import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { z } from "zod";

/**
 * AI-powered submission checker. Uses Lovable AI Gateway (Gemini) to grade
 * a team's draft submission text against Project Rakshak rubric criteria and
 * return structured feedback the team can use to improve before submitting.
 */
const Input = z.object({
  phase_number: z.number().int().min(0).max(4),
  title: z.string().min(1).max(400),
  text: z.string().min(50).max(20000),
});

const SYSTEM = `You are a senior road safety auditor and mentor for "Project Rakshak", a youth-led road safety audit programme in India. Your job is to review a student team's draft phase submission and give pragmatic, actionable feedback.

For each review, output STRICT JSON only — no prose, no code fences — with this exact shape:
{
  "overall_score": <integer 0-100>,
  "summary": "<one-paragraph verdict, max 3 sentences>",
  "strengths": ["...", "..."],
  "gaps": ["...", "..."],
  "next_actions": ["actionable bullets the team can do this week"],
  "rubric": {
    "problem_clarity": <0-10>,
    "evidence_quality": <0-10>,
    "feasibility": <0-10>,
    "report_quality": <0-10>
  }
}
Be honest. Indian English. No fluff.`;

export const aiCheckSubmission = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => Input.parse(d))
  .handler(async ({ data }) => {
    const key = process.env.LOVABLE_API_KEY;
    if (!key) throw new Error("AI gateway not configured");

    const user = `Phase: ${data.phase_number}\nTitle: ${data.title}\n\nDRAFT:\n${data.text}`;

    const res = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${key}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "google/gemini-2.5-flash",
        messages: [
          { role: "system", content: SYSTEM },
          { role: "user", content: user },
        ],
        temperature: 0.3,
      }),
    });

    if (res.status === 429) throw new Error("AI rate limit reached. Try again in a minute.");
    if (res.status === 402) throw new Error("AI credits exhausted. Top up Lovable AI in workspace settings.");
    if (!res.ok) throw new Error(`AI gateway error ${res.status}`);

    const json = await res.json();
    const raw = json?.choices?.[0]?.message?.content ?? "";
    const cleaned = String(raw).replace(/^```json\s*|\s*```$/g, "").trim();

    let parsed: any;
    try {
      parsed = JSON.parse(cleaned);
    } catch {
      return {
        review: {
          overall_score: 0,
          summary: "AI returned a response we could not parse. Please try again.",
          strengths: [],
          gaps: [],
          next_actions: [],
          rubric: { problem_clarity: 0, evidence_quality: 0, feasibility: 0, report_quality: 0 },
          raw,
        },
      };
    }

    return { review: parsed };
  });
