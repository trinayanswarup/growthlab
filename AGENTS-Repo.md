# GrowthLab — Agent Architecture

## How the agent pipeline works

A report fans out to four agents running concurrently via `Promise.allSettled`.
Each agent writes independently to Supabase. The frontend polls every 2 seconds
and renders each section as its agent completes — no waiting for the full pipeline.

```
POST /api/report
  └── runReportBackground()
        ├── fetchPage(targetUrl)           // homepage HTML for topic
        ├── extractTopic(html)             // Groq, 2-3 word niche
        │
        ├── Promise.allSettled([           // Batch 1: parallel
        │     runSEOAudit(url),            // Cheerio, 5 pages
        │     buildPresenceMatrix(...)     // 12 Tavily searches
        │   ])
        │
        └── Promise.allSettled([           // Batch 2: parallel
              runMonetisationAgent(...),   // Groq
              runCROAgent(html)            // Groq
            ])
```

Each agent updates its own status column (`seo_status`, `presence_status` etc.)
on completion or failure. The top-level `status` is set to `done` only after
all agents have finished — success or failure.

## Agent specs

### SEO Auditor (`lib/agents/seo-auditor.ts`)

- Input: target URL
- Method: Cheerio (no LLM — deterministic and testable)
- Crawls homepage + top 4 linked internal pages (max 5 total)
- Scores each page 0–100 across 7 weighted factors:
  title (15) | meta (10) | H1 (20) | word count (15) | alt text (15) | load time (15) | canonical (10)
- Returns: `PageAudit[]`
- Failure mode: returns score:0 with "site may be blocking" message if HTML is empty

### Presence Matrix (`lib/agents/presence-matrix.ts`)

- Input: target URL, competitor URLs[], topic, reportId
- Runs 12 Tavily searches covering commercial, transactional, informational intent
- For each query: checks if target and each competitor appear in top 10 results
- Gap row = target absent + at least one competitor present
- No signal = everyone absent (shown as neutral, no priority score)
- Returns: `PresenceResult[]` with intent + priority classification

### Monetisation Agent (`lib/agents/monetisation.ts`)

- Input: topic, page URLs
- Model: Groq llama-3.3-70b
- Maps site topics to affiliate categories (VPN, SaaS, finance, hosting etc.)
- Returns: category, commission range, programme names, matching pages, priority
- Must return valid JSON array — has try/catch returning [] on parse failure

### CRO Agent (`lib/agents/cro.ts`)

- Input: homepage HTML
- Model: Groq llama-3.3-70b
- Checks 5 factors: valueProp, ctaPresence, socialProof, trustSignals, contentFreshness
- Returns: `pass | warning | fail` per factor (not boolean — 3 states)
- If HTML is empty/blocked: returns `warning` for all, never `fail`
- Must return exactly 5 objects — has hardcoded fallback array

### Content Brief Generator (`lib/agents/brief-generator.ts`)

- Input: keyword
- Model: Gemini 2.0 Flash (falls back to Groq on 429)
- Returns structured JSON: title, meta, H2/H3 structure, word count,
  secondary keywords, competitors, CTAs, commissioning note
- Output is a first draft — UI shows disclaimer: "Verify before publishing"

### Headline Tester (`lib/agents/headline-tester.ts`)

- Input: headline, goal
- Model: Groq llama-3.3-70b
- Returns 5 variants: `{ variant, angle, reasoning, estimatedCTRScore }`
- Second function `combineHeadlines()` synthesises best elements into one

## Scheduled re-audit (`app/api/cron/reaudit/route.ts`)

- Triggered by Vercel Cron at 08:00 UTC daily (`vercel.json`)
- Authenticated via `Authorization: Bearer {CRON_SECRET}` header
- Fetches all reports where `tracked = true` AND `status = done`
- Re-runs `buildPresenceMatrix()` for each
- Deletes old presence_results, inserts fresh ones
- Recomputes and stores updated opportunity_score

## Opportunity score formula

```
commercialGaps = rows where intent !== 'informational'
                 AND target_present === false
                 AND (competitor1_present OR competitor2_present)

opportunityScore = (commercialGaps.length / commercialTotal) * 100
```

Transparent heuristic — labelled as "Competitive Gap Score" in UI.
Never presented as an exact metric.

## Gemini fallback pattern

```typescript
// lib/llm/gemini.ts
try {
  // attempt Gemini
} catch (err) {
  if (isQuotaError(err)) {
    console.warn("[Gemini quota hit] falling back to Groq");
    return groqComplete(prompt);
  }
  throw err;
}
```
