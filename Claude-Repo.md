# GrowthLab — AI Development Context

## What this file is

This is the context file used when building GrowthLab with Claude Code.
It documents the architecture decisions, constraints, and conventions
so any AI coding agent can contribute without breaking existing patterns.

## Project overview

GrowthLab is a competitive growth intelligence tool. Enter a site and up to
two competitors — four AI agents run in parallel to find keyword gaps, audit
SEO health, map monetisation opportunities, and analyse conversion problems.
The centrepiece is a presence matrix: a keyword × site grid showing where
competitors appear in search results and the target site doesn't.

## Stack

- Next.js 14 (App Router), TypeScript, Tailwind CSS
- Supabase (Postgres) — reports, results, tracking
- Cheerio — SEO crawling (no LLM)
- Tavily API — SERP presence signals
- Gemini 2.0 Flash (@google/genai) — long-form content generation
- Groq llama-3.3-70b (groq-sdk) — structured JSON agents
- Vercel Cron — scheduled re-audits
- next-themes — dark/light toggle

## LLM routing — never deviate

| Task               | Model                 |
| ------------------ | --------------------- |
| SEO scoring        | Cheerio only — no LLM |
| Topic extraction   | Groq                  |
| Presence checks    | Tavily API            |
| Monetisation agent | Groq                  |
| CRO agent          | Groq                  |
| Headline tester    | Groq                  |
| Comparison pages   | Gemini 2.0 Flash      |
| Content briefs     | Gemini 2.0 Flash      |

Gemini falls back to Groq automatically on 429. See `lib/llm/gemini.ts`.

## Hard constraints

- Free tier only on all APIs
- No auth, no billing
- Max 5 pages crawled per audit
- Never fabricate search volume or exact rankings
- `npm run build` must pass clean after every change
- Every Supabase API route must have `export const dynamic = 'force-dynamic'`
  and `cache: 'no-store'` headers — Next.js caches Supabase responses otherwise

## Critical known fixes — do not revert

1. `lib/supabase.ts` — createServerClient passes `cache: 'no-store'` to internal
   fetch to bypass Next.js fetch cache. Without this, Supabase reads return stale data.
2. `app/api/reports/[id]/status/route.ts` — has `export const dynamic = 'force-dynamic'`
   and `Cache-Control: no-store` response header. Without this, polling never stops.
3. `lib/crawl/fetcher.ts` — returns empty HTML on 403 instead of throwing.
   SEO auditor guards against empty HTML and returns score:0 with a note.
4. All dynamic route handlers use `const { id } = await params` — Next.js 15
   async params pattern. Never use `params.id` directly.

## Project structure

```
app/
  api/
    report/           POST — create competitive report
    reports/[id]/     status, matrix, seo, monetisation, cro, generate, track
    audit/            POST — create quick audit (single URL)
    audits/[id]/      status, pages, gaps
    generate/         comparison, headline, headline/combine
    cron/reaudit      GET — daily Vercel Cron job
  report/[id]/        competitive report dashboard
  dashboard/[id]/     quick audit dashboard
  audit/              quick audit input
  history/            report history + tracking
  tools/              comparison page, content brief, headline tester
lib/
  agents/             seo-auditor, content-gap, presence-matrix,
                      monetisation, cro, brief-generator, headline-tester
  llm/                gemini.ts, groq.ts
  crawl/              fetcher.ts
  supabase.ts
types/index.ts
supabase/schema.sql
vercel.json           Cron schedule
```

## Colour system (CSS variables in globals.css)

All pages use CSS variables — never hardcode colours.
Key vars: `--bg`, `--surface`, `--surface-2`, `--border`, `--text-primary`,
`--text-secondary`, `--text-muted`, `--accent`, `--navy`, `--present`,
`--missing`, `--commercial`. Dark/light values defined in `:root` and `.dark`.
