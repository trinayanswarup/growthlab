# GrowthLab — Product Requirements Document

## Problem

Affiliate and content sites leave revenue on the table because:

1. SEO audit tools (Ahrefs, Screaming Frog) are technical — they don't connect findings to content action
2. No tool shows you exactly which commercial keywords competitors win that you don't, and then generates the content to close those gaps
3. Monitoring competitors requires expensive subscriptions or manual work

GrowthLab automates the workflow a content strategist at an affiliate site runs manually every week.

## Target users

- **Mediatech Vilnius** — runs cybernews.com, investorsobserver.com. Needs comparison pages and keyword gap detection at scale.
- **Paradise Media** — iGaming affiliate network. Needs competitor tracking, internal dashboards, scheduled jobs.
- **Content/affiliate site operators** — any site monetising through affiliate programmes that needs to find and close keyword gaps.

## Core user story

> "I enter my site and two competitors. GrowthLab finds commercial keywords where competitors appear in search results and I don't. I click one gap and get a publish-ready content brief or comparison page in under 60 seconds."

---

## Features

### F1 — Competitive Report (primary flow)

Input: target URL + up to 2 competitor URLs + topic/niche

Four agents run in parallel:

- SEO Auditor (Cheerio) — scores top 5 pages 0–100 across 7 factors
- Presence Matrix (Tavily) — 12 queries, checks all 3 sites per query
- Monetisation Agent (Groq) — maps topics to affiliate categories
- CRO Agent (Groq) — checks 5 conversion factors

Output: presence matrix, opportunity score, quick wins, SEO audit, monetisation opportunities, CRO findings

### F2 — Presence Matrix

12 keyword queries per report. For each query:

- Check if target appears in Tavily top 10
- Check if each competitor appears
- Classify intent: commercial / transactional / informational
- Classify commercial priority: High / Medium / Low / No signal

Gap rows = target absent + at least one competitor present. Only gap rows show Generate buttons and priority scores. Rows where everyone is absent show "No signal" — no false urgency.

**Credibility constraint:** Never claim exact Google rankings. Never fabricate search volume. Every number is a transparent heuristic or real Tavily signal.

### F3 — Inline Content Generation

Click any gap row → inline panel with two tabs:

**Content Brief** (Gemini 2.0 Flash):

- Title tag + meta description
- Full H2/H3 article structure
- Recommended word count
- Secondary keywords
- Competitor analysis
- Affiliate CTA suggestions
- Commissioning note for writers

**Comparison Page** (Gemini 2.0 Flash + Tavily):

- Researches both products via Tavily
- Generates full HTML: feature table, pros/cons, verdict, FAQ
- Affiliate CTA placeholders: `{{AFFILIATE_LINK_PRODUCT1}}`
- Publish-ready first draft — label as such, verify before publishing

### F4 — Headline Tester

Input: headline + goal (CTR / authority / curiosity / keyword / emotion)
Output: 5 AI-scored variants (Groq) with angle, reasoning, AI score
"Combine" button: synthesises strongest elements into one headline

### F5 — Quick Audit

Single URL audit, no competitors required.
Same SEO audit + keyword gap detection.
Inline brief generation on any gap row.
Entry point for users who don't have competitors to compare yet.

### F6 — Report History + Tracking

History table: all reports with opportunity score, status, date.
Track toggle: marks report for daily re-audit.
Vercel Cron runs at 08:00 UTC — re-runs presence matrix for all tracked reports, updates opportunity score.

---

## Data model

### `reports`

id, target_url, competitor_urls[], status, seo_status, presence_status, monetisation_status, cro_status, topic, opportunity_score, tracked, created_at

### `presence_results`

id, report_id, keyword, intent, target_present, competitor1_present, competitor2_present, target_domain, competitor1_domain, competitor2_domain, top_result_domain, revenue_potential, created_at

### `report_seo_pages`

id, report_id, url, title, seo_score, word_count, load_time_ms, issues (jsonb), created_at

### `report_monetisation`

id, report_id, category, commission_rate, programmes (jsonb), matching_pages (jsonb), cta_missing_pages (jsonb), priority, created_at

### `report_cro`

id, report_id, factor, passed, recommendation, created_at

### `report_generated_content`

id, report_id, keyword, type, title, content, created_at

### `audits` (quick audit)

id, url, status, seo_status, content_status, monetisation_status, cro_status, topic, overall_score, created_at

### `audit_pages`, `keyword_gaps`, `monetisation_opportunities`, `cro_findings`, `generated_content`

Supporting tables for quick audit flow.

---

## Non-requirements (explicitly out of scope)

- User authentication or billing
- Full site crawl (>5 pages per audit)
- Exact Google rank tracking (requires paid API)
- Real search volume data (fabricated numbers destroy credibility with SEO professionals)
- PDF export (window.print() is sufficient)
- Chrome extension

---

## LLM strategy

| Task                 | Model              | Reason                                         |
| -------------------- | ------------------ | ---------------------------------------------- |
| SEO scoring          | Cheerio only       | Deterministic, testable, no hallucination risk |
| Topic extraction     | Groq llama-3.3-70b | Short prompt, fast                             |
| Monetisation mapping | Groq llama-3.3-70b | Short structured JSON                          |
| CRO analysis         | Groq llama-3.3-70b | Short structured JSON                          |
| Headline variants    | Groq llama-3.3-70b | Short structured JSON                          |
| Comparison pages     | Gemini 2.0 Flash   | Long context needed for fetched page content   |
| Content briefs       | Gemini 2.0 Flash   | Long structured output                         |

Groq fallback: if Gemini hits quota (free tier: 1500 req/day), geminiComplete() automatically falls back to groqComplete(). Output quality degrades slightly but feature never breaks.

---

## Success criteria

- Audit completes in under 60 seconds for a real URL
- Presence matrix shows real SERP signals, no fabricated data
- Comparison page output is publish-ready HTML
- Content brief covers all 9 required fields
- Tracked reports re-audit automatically without manual intervention
- Deployed on Vercel with live URL
- Demo runs cleanly: backlinko.com vs ahrefs.com vs semrush.com, topic: SEO tools
