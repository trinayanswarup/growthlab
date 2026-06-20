# GrowthLab

**Competitive growth intelligence for affiliate and content sites.**

Enter your site and up to two competitors. GrowthLab finds every commercial keyword where competitors appear in search results and you don't, scores each gap by priority, and generates publish-ready content to close it — comparison pages, content briefs, and headline variants.

**[Live Demo →](https://growthlab.vercel.app)** | Built by [@trinayanswarup](https://github.com/trinayanswarup)

---

![GrowthLab Report](docs/screenshot-report.png)

---

## The core workflow

1. Enter your site + up to 2 competitors + topic niche
2. Four AI agents run in parallel — SEO crawl, presence check, monetisation mapping, CRO analysis
3. A presence matrix shows exactly which keywords competitors win and you don't
4. Click any gap → generate a content brief or comparison page inline
5. Track reports — re-audited automatically every 24 hours via Vercel Cron

**Demo:** `backlinko.com` vs `ahrefs.com` vs `semrush.com`, topic: `SEO tools`

---

## Features

### Competitive Presence Matrix

Runs 12 Tavily search queries per report. Shows a keyword × site grid: who appears in results, who doesn't. Gap rows (target absent, competitor present) are highlighted with commercial priority scoring. Only real SERP signals — no fabricated search volumes.

### Four parallel AI agents

All agents run concurrently via `Promise.allSettled`. Each writes independently to Supabase. The frontend polls every 2 seconds and renders each section as it completes.

| Agent          | What it does                                                                  | Model              |
| -------------- | ----------------------------------------------------------------------------- | ------------------ |
| SEO Auditor    | Crawls top 5 pages, scores 0–100 on 7 factors                                 | Cheerio (no LLM)   |
| Presence Check | 12 Tavily queries, checks all 3 sites per query                               | Tavily API         |
| Monetisation   | Maps site topics to affiliate categories + commission rates                   | Groq llama-3.3-70b |
| CRO Analysis   | Checks 5 conversion factors: value prop, CTAs, social proof, trust, freshness | Groq llama-3.3-70b |

### Content generation

- **Comparison pages** — full publish-ready HTML: feature table, pros/cons, verdict, FAQ, affiliate CTA placeholders. Researched via Tavily, written by Gemini 2.0 Flash.
- **Content briefs** — title tag, meta, H2/H3 structure, word count, competitor analysis, secondary keywords, commissioning note
- **Headline tester** — 5 AI-scored variants per goal (CTR, authority, curiosity, keyword, emotion). Combine best elements into one.

### Scheduled re-audits

Mark any report as tracked. A Vercel Cron job re-runs presence checks every 24 hours and updates the opportunity score. Turns a one-shot tool into a monitoring product.

### Quick Audit

Single-URL audit without competitors. SEO scoring + keyword gap detection + inline brief generation. Useful for auditing your own site before running a competitive report.

---

## Tech stack

| Layer          | Choice                       | Why                                             |
| -------------- | ---------------------------- | ----------------------------------------------- |
| Framework      | Next.js 14 (App Router)      | Server components + API routes in one repo      |
| Language       | TypeScript                   | Type safety across agents and API contracts     |
| Database       | Supabase (Postgres)          | Free tier, real-time polling via REST           |
| Crawling       | Cheerio                      | Deterministic SEO scoring without LLM cost      |
| Search         | Tavily API                   | Real SERP presence signal, free tier            |
| Long-form LLM  | Gemini 2.0 Flash             | 1M context, free tier, comparison page research |
| Short-form LLM | Groq llama-3.3-70b           | Fast structured JSON, free tier                 |
| Scheduling     | Vercel Cron                  | Daily re-audits, zero infrastructure            |
| Deployment     | Vercel                       | Free Hobby plan                                 |
| Styling        | Tailwind CSS + CSS variables | Dark/light toggle, semantic colour system       |

**Free tier only.** No paid APIs, no credit card required to run.

---

## Architecture

```
POST /api/report
  └── runReportBackground()
        ├── Promise.allSettled([
        │     runSEOAudit(),          // Cheerio, no LLM
        │     buildPresenceMatrix()   // 12 Tavily searches in parallel
        │   ])
        └── Promise.allSettled([
              runMonetisationAgent(), // Groq
              runCROAgent()           // Groq
            ])

Frontend polls /api/reports/[id]/status every 2s
Each section renders independently as its agent completes
```

**Key engineering decisions:**

- **Client-orchestrated polling** over server-sent events — simpler failure handling, each agent fails independently
- **Cheerio for SEO** not LLM — deterministic, testable, fast. LLMs hallucinate SEO scores.
- **No fabricated metrics** — presence = real Tavily SERP signal. Commercial priority = transparent heuristic. Never "estimated 12,000 monthly searches."
- **Supabase fetch cache bypass** — Next.js patches global `fetch` and caches Supabase responses by default. Fixed by passing `cache: 'no-store'` to the Supabase client's internal fetch.

---

## How I build with AI agents

Every session starts with `CLAUDE.md` — a context file that teaches Claude Code the architecture, LLM routing decisions, hard constraints, and critical fixes before any code is written. This is specification-first, AI-augmented development:

- I define what to build, why, and what the constraints are
- Claude Code executes
- I review, test, and own the output

The `CLAUDE.md` pattern is listed as a core job responsibility in several agentic engineering roles I'm targeting. This repo demonstrates it in practice across a real multi-agent system.

---

## Local setup

```bash
git clone https://github.com/trinayanswarup/growthlab
cd growthlab
npm install
cp .env.example .env.local
# Fill in your API keys
npm run dev
```

### Environment variables

```env
NEXT_PUBLIC_SUPABASE_URL=
NEXT_PUBLIC_SUPABASE_ANON_KEY=
SUPABASE_SERVICE_ROLE_KEY=
TAVILY_API_KEY=
GEMINI_API_KEY=
GROQ_API_KEY=
CRON_SECRET=
```

All free tier. Get keys at:

- [supabase.com](https://supabase.com) — database
- [tavily.com](https://tavily.com) — search API (1000 req/month free)
- [aistudio.google.com](https://aistudio.google.com) — Gemini API
- [console.groq.com](https://console.groq.com) — Groq API

### Database setup

Run `supabase/schema.sql` in your Supabase SQL editor.

---

## API routes

| Route                            | Method | Description                             |
| -------------------------------- | ------ | --------------------------------------- |
| `/api/report`                    | POST   | Create report, fire background pipeline |
| `/api/reports/[id]/status`       | GET    | Poll agent completion status            |
| `/api/reports/[id]/matrix`       | GET    | Presence matrix rows                    |
| `/api/reports/[id]/seo`          | GET    | SEO audit pages                         |
| `/api/reports/[id]/monetisation` | GET    | Monetisation opportunities              |
| `/api/reports/[id]/cro`          | GET    | CRO analysis factors                    |
| `/api/reports/[id]/generate`     | POST   | Generate content brief inline           |
| `/api/reports/[id]/track`        | PATCH  | Toggle daily re-audit tracking          |
| `/api/reports/recent`            | GET    | Last 5 reports for homepage             |
| `/api/reports/history`           | GET    | Full report history                     |
| `/api/generate/comparison`       | POST   | Standalone comparison page              |
| `/api/generate/headline`         | POST   | Headline variants                       |
| `/api/generate/headline/combine` | POST   | Combine variants into one               |
| `/api/audit`                     | POST   | Quick audit (single URL)                |
| `/api/audits/[id]/status`        | GET    | Quick audit status                      |
| `/api/cron/reaudit`              | GET    | Daily cron — re-audits tracked reports  |

---

## Development Notes

`CLAUDE.md` and `AGENTS.md` are excluded from this repository. The public
equivalents — `CLAUDE-REPO.md` and `AGENTS-REPO.md` — document the architecture,
agent specs, and engineering decisions for anyone reading the codebase.

The internal files contain session-by-session Claude Code prompts, Windows/PowerShell
quirks, mid-build debugging notes, and restore-point commit instructions. Useful
during a build sprint, noise to anyone reading the repo afterward.

If you're interested in how I structure AI-assisted development workflows,
`CLAUDE-REPO.md` covers the context engineering approach and `AGENTS-REPO.md`
covers the full agent pipeline design.
