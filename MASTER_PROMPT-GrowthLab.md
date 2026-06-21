# GrowthLab — MASTER_PROMPT.md

Copy the relevant session prompt into Claude Code at the start of each session.
Always `git add -A && git commit -m "checkpoint"` before starting.

---

## SESSION 1 — Scaffold + Supabase schema

```
Read CLAUDE.md and PRD.md before writing any code.

Set up the GrowthLab project:

1. Install deps: cheerio @types/cheerio @supabase/supabase-js @google/genai groq-sdk
   Also install: (Tavily has no official SDK — use fetch directly to Tavily REST API)

2. Create /lib/supabase.ts with:
   - Browser client (NEXT_PUBLIC_ keys)
   - Server client (service role key, for API routes)

3. Create /supabase/schema.sql with CREATE TABLE statements for all 6 tables from PRD.md.
   Include: enable uuid-ossp extension, all FK constraints, created_at DEFAULT now().

4. Create /types/index.ts with all TypeScript interfaces from CLAUDE.md.

5. Create base layout in /app/layout.tsx:
   - Dark background (#0a0a0a)
   - Left sidebar with nav links: Audit, History, Tools
   - Clean, minimal. No gradients. Monospace accent font for the logo "GrowthLab".

6. Placeholder pages: /app/page.tsx (redirect to /audit), /app/audit/page.tsx,
   /app/dashboard/[id]/page.tsx, /app/tools/page.tsx, /app/history/page.tsx

7. /app/api/health/route.ts — returns { status: 'ok', timestamp }

Run npm run build. Fix all errors. Do not leave any TypeScript errors.
```

---

## SESSION 2 — SEO Auditor

```
Read CLAUDE.md before writing any code. Run git log --oneline -3 to orient.

Build the SEO auditor (Cheerio only, no LLM):

1. /lib/crawl/fetcher.ts
   - fetchPage(url: string): Promise<{ html: string; loadTimeMs: number; finalUrl: string }>
   - 8 second timeout using AbortController
   - Follow redirects, record final URL
   - Throw typed error if fetch fails

2. /lib/agents/seo-auditor.ts
   - extractInternalLinks(html: string, baseUrl: string): string[] — top 4 unique internal links
   - auditPage(url: string): Promise<PageAudit> — run all 9 checks, compute score
   - runSEOAudit(url: string): Promise<PageAudit[]> — homepage + top 4 internal pages

   Scoring weights (must match PRD.md):
   title present+length: 15pts, meta present+length: 10pts, single H1: 20pts,
   word count >300: 15pts, all images have alt: 15pts, load time <3s: 15pts, canonical: 10pts

3. /app/api/audit/route.ts POST
   - Body: { url: string }
   - Create audit row (status: queued, all agent statuses: pending)
   - Immediately return { auditId }
   - Run SEO audit async (don't await before returning), update Supabase on complete/fail
   - Write PageAudit results to audit_pages table

4. /app/api/audits/[id]/status/route.ts GET
   - Return full audit row from Supabase (status + all agent statuses + overall_score)

5. /app/audit/page.tsx
   - URL input + "Run Audit" button
   - On submit: POST /api/audit, redirect to /dashboard/[id]

6. /app/dashboard/[id]/page.tsx
   - Poll /api/audits/[id]/status every 2 seconds
   - SEO section: renders when seo_status === 'done'
   - Show loading skeleton when seo_status === 'pending' | 'running'
   - Page cards: URL, score badge (colour: green ≥80, yellow 50-79, red <50), issues list

Run npm run build. Fix all errors.
```

---

## SESSION 3 — Content Gap Agent

```
Read CLAUDE.md. git log --oneline -3 to orient.

Build the content gap agent. Follow the exact types and logic below — do not improvise the
Tavily response shape or domain matching logic.

─────────────────────────────────────────
STEP 1 — /lib/llm/groq.ts
─────────────────────────────────────────
Create this file. Export one function:

  export async function groqComplete(
    userPrompt: string,
    systemPrompt?: string
  ): Promise<string>

Implementation:
- Use the groq-sdk package. Instantiate: new Groq({ apiKey: process.env.GROQ_API_KEY })
- model: 'llama-3.3-70b-versatile'
- max_tokens: 1024
- On HTTP 429: wait 2000ms then retry. Max 3 attempts total. On third failure, throw.
- Return: response.choices[0]?.message?.content ?? ''

─────────────────────────────────────────
STEP 2 — /types/index.ts additions
─────────────────────────────────────────
Add these types (do not remove existing types):

  interface TavilyResult {
    url: string
    title: string
    content: string
    score: number
  }

  interface TavilySearchResponse {
    results: TavilyResult[]
  }

─────────────────────────────────────────
STEP 3 — /lib/agents/content-gap.ts
─────────────────────────────────────────
Create this file with exactly these four exported functions:

  export async function extractTopic(html: string): Promise<string>
  export async function tavilySearch(query: string): Promise<TavilyResult[]>
  export function extractDomain(url: string): string
  export function checkDomainInResults(results: TavilyResult[], domain: string): boolean
  export async function runContentGapAgent(url: string, topic: string): Promise<KeywordGap[]>

Implementation details:

extractTopic:
  Call groqComplete with:
    system: 'Return only a 2-3 word topic phrase. No punctuation. No explanation.'
    user: 'What is the main topic of this website? HTML: ' + html.slice(0, 3000)
  Return the raw string trimmed. If empty, return 'general content'.

tavilySearch:
  const res = await fetch('https://api.tavily.com/search', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      api_key: process.env.TAVILY_API_KEY,
      query,
      search_depth: 'basic',
      max_results: 10,
      include_answer: false,
    }),
  })
  if (!res.ok) return []   // <-- never throw, always return empty array on failure
  const data: TavilySearchResponse = await res.json()
  return data.results ?? []

extractDomain:
  Use new URL(url).hostname — strip leading 'www.' with .replace(/^www\./, '')
  Wrap in try/catch, return '' on error.

checkDomainInResults:
  const lowerDomain = domain.toLowerCase()
  return results.some(r => {
    const resultDomain = extractDomain(r.url).toLowerCase()
    return resultDomain === lowerDomain || resultDomain.endsWith('.' + lowerDomain)
  })

runContentGapAgent:
  const targetDomain = extractDomain(url)
  const year = new Date().getFullYear()

  const queries = [
    { keyword: `${topic} best ${year}`,    intent: 'commercial'     as const },
    { keyword: `${topic} vs`,              intent: 'transactional'  as const },
    { keyword: `how to ${topic}`,          intent: 'informational'  as const },
    { keyword: `${topic} review`,          intent: 'commercial'     as const },
  ]

  const results = await Promise.all(
    queries.map(q => tavilySearch(q.keyword))
  )

  const gaps: KeywordGap[] = []

  for (let i = 0; i < queries.length; i++) {
    const searchResults = results[i]
    const isPresent = checkDomainInResults(searchResults, targetDomain)
    if (!isPresent) {
      const topCompetitorUrl = searchResults[0]?.url ?? ''
      const competitor = extractDomain(topCompetitorUrl) || 'unknown'
      const gapScore = Math.round((1 - (searchResults.findIndex(
        r => extractDomain(r.url) === targetDomain
      ) + 1) / 10) * 100)
      gaps.push({
        keyword: queries[i].keyword,
        intent: queries[i].intent,
        competitor,
        gapScore: isNaN(gapScore) ? 80 : gapScore,
      })
    }
  }

  return gaps

─────────────────────────────────────────
STEP 4 — Update /app/api/audit/route.ts
─────────────────────────────────────────
After creating the audit row and fetching the homepage HTML:

a. Extract topic: const topic = await extractTopic(homepageHtml)
b. Update the audit row: set topic = topic
c. Run SEO + content gap in parallel:
   const [seoResult, gapResult] = await Promise.allSettled([
     runSEOAudit(url),
     runContentGapAgent(url, topic),
   ])

d. Handle SEO result:
   if (seoResult.status === 'fulfilled') {
     // insert audit_pages rows, set seo_status = 'done'
   } else {
     // set seo_status = 'failed', log seoResult.reason
   }

e. Handle gap result:
   if (gapResult.status === 'fulfilled') {
     const gaps = gapResult.value
     if (gaps.length > 0) {
       // insert into keyword_gaps: { audit_id, keyword, intent, gap_score, competitor }
       // one row per gap
     }
     // set content_status = 'done'
   } else {
     // set content_status = 'failed', log gapResult.reason
   }

IMPORTANT: Never let one agent's failure crash the other. Promise.allSettled handles this —
just make sure you handle both statuses explicitly as shown above.

─────────────────────────────────────────
STEP 5 — Dashboard: content gap section
─────────────────────────────────────────
In /app/dashboard/[id]/page.tsx, below the SEO section:

- Only render when poll returns content_status === 'done'
- Show loading skeleton (3 placeholder rows) when content_status === 'pending' | 'running'
- Show error state when content_status === 'failed': "Keyword analysis failed — other results still available"
- Fetch keyword_gaps from Supabase: select * from keyword_gaps where audit_id = id order by gap_score desc
- Render as a table: keyword | intent badge | competitor | gap score bar | "Brief →" link
- Intent badge colours: informational=blue, commercial=amber, transactional=green

─────────────────────────────────────────
VERIFICATION before committing
─────────────────────────────────────────
1. npm run build — must pass clean, zero TypeScript errors
2. Manual test: POST /api/audit with { url: 'https://cybernews.com' }
3. After ~20s, check Supabase: keyword_gaps table should have 1-4 rows
4. Check audit row: content_status should be 'done' (not 'failed')
5. If content_status is 'failed', check server logs — the most common cause is
   TAVILY_API_KEY not set in .env.local
```

---

## SESSION 4 — Comparison Page Generator ⭐

```
Read CLAUDE.md. git log --oneline -3 to orient.

Build the comparison page generator. This is the most important feature — make it polished.

1. /lib/llm/gemini.ts
   - geminiComplete(prompt: string): Promise<string>
   - Package: @google/genai  (NOT @google/generative-ai — that package is deprecated)
   - Import: import { GoogleGenAI } from '@google/genai'
   - Instantiate: const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY! })
   - Model: 'gemini-2.5-flash'  (NOT gemini-1.5-flash — deprecated and pulled off free tier)
   - Call pattern:
       const response = await ai.models.generateContent({
         model: 'gemini-2.5-flash',
         contents: prompt,
       })
       return response.text ?? ''
   - Retry on HTTP 429 or 503: wait 3000ms, retry. Max 3 attempts total. Throw on third failure.

2. /app/api/generate/comparison/route.ts POST
   Body: { product1: string, product2: string }

   Pipeline (exact sequence):
   a. Two Tavily searches in parallel: "{product} features pricing review 2025" × 2
   b. Fetch top 2 URLs from each search (4 fetches in parallel, 8s timeout each)
   c. Gemini call 1: extract structured data from fetched content for each product
      Return JSON: { name, price, keyFeatures: string[], pros: string[], cons: string[], bestFor: string, rating: number }
   d. Gemini call 2: generate full comparison HTML
      Must include: intro, feature table, pros/cons, verdict, 5-question FAQ
      CTA placeholders: <a href="{{AFFILIATE_LINK_PRODUCT1}}" class="cta-button">Try {product1} →</a>
   e. Write to generated_content table
   f. Return { html, contentId }

3. /app/tools/page.tsx — comparison tab:
   - Two product name inputs side by side
   - "Generate comparison" button with loading state ("Researching products...", "Generating page...")
   - Preview: render HTML in a styled container (not iframe — use dangerouslySetInnerHTML with a wrapper div)
   - "Copy HTML" button (navigator.clipboard)
   - Word count badge on output

Run npm run build. Fix all errors.
Manually test: NordVPN vs ExpressVPN. Verify output has all sections.
```

---

## SESSION 5 — Competitor input + Presence Matrix (THE CENTREPIECE)

```
Read CLAUDE.md before writing any code. Run: git log --oneline -3

This session builds the core competitive intelligence feature.
The existing /api/audit and /app/audit routes stay but we add a new parallel system.

─────────────────────────────────────────
WHAT WE ARE BUILDING
─────────────────────────────────────────
A "report" is a competitive analysis: one target site + up to 2 competitors.
A report runs presence checks for all 3 sites against 12 keyword queries.
The result is a presence matrix: keyword × site grid showing who ranks and who doesn't.

─────────────────────────────────────────
STEP 1 — Supabase schema additions
─────────────────────────────────────────
Run this SQL in Supabase SQL editor:

CREATE TABLE IF NOT EXISTS reports (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  target_url text NOT NULL,
  competitor_urls text[] NOT NULL DEFAULT '{}',
  status text NOT NULL DEFAULT 'queued',
  seo_status text NOT NULL DEFAULT 'pending',
  presence_status text NOT NULL DEFAULT 'pending',
  monetisation_status text NOT NULL DEFAULT 'pending',
  cro_status text NOT NULL DEFAULT 'pending',
  topic text,
  opportunity_score int,
  created_at timestamptz NOT NULL DEFAULT now(),
  tracked boolean NOT NULL DEFAULT false
);

CREATE TABLE IF NOT EXISTS presence_results (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  report_id uuid NOT NULL REFERENCES reports(id) ON DELETE CASCADE,
  keyword text NOT NULL,
  intent text NOT NULL,
  target_present boolean NOT NULL DEFAULT false,
  competitor1_present boolean NOT NULL DEFAULT false,
  competitor2_present boolean NOT NULL DEFAULT false,
  target_domain text,
  competitor1_domain text,
  competitor2_domain text,
  top_result_domain text,
  revenue_potential text NOT NULL DEFAULT 'medium',
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS report_seo_pages (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  report_id uuid NOT NULL REFERENCES reports(id) ON DELETE CASCADE,
  url text NOT NULL,
  title text,
  seo_score int NOT NULL DEFAULT 0,
  word_count int NOT NULL DEFAULT 0,
  load_time_ms int NOT NULL DEFAULT 0,
  issues jsonb NOT NULL DEFAULT '[]',
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS report_generated_content (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  report_id uuid NOT NULL REFERENCES reports(id) ON DELETE CASCADE,
  keyword text,
  type text NOT NULL,
  title text NOT NULL,
  content text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

─────────────────────────────────────────
STEP 2 — Add types to types/index.ts
─────────────────────────────────────────
ADD these types (do not remove existing ones):

export interface Report {
  id: string
  target_url: string
  competitor_urls: string[]
  status: 'queued' | 'running' | 'done' | 'failed'
  seo_status: AgentStatus
  presence_status: AgentStatus
  monetisation_status: AgentStatus
  cro_status: AgentStatus
  topic: string | null
  opportunity_score: number | null
  created_at: string
  tracked: boolean
}

export interface PresenceResult {
  id: string
  report_id: string
  keyword: string
  intent: 'informational' | 'commercial' | 'transactional'
  target_present: boolean
  competitor1_present: boolean
  competitor2_present: boolean
  target_domain: string | null
  competitor1_domain: string | null
  competitor2_domain: string | null
  top_result_domain: string | null
  revenue_potential: 'high' | 'medium' | 'low'
}

─────────────────────────────────────────
STEP 3 — lib/agents/presence-matrix.ts (NEW FILE)
─────────────────────────────────────────
Create this file. It reuses tavilySearch, extractDomain, checkDomainInResults
from lib/agents/content-gap.ts — import them, don't duplicate.

import { tavilySearch, extractDomain, checkDomainInResults } from './content-gap'
import type { PresenceResult } from '@/types'

const REVENUE_POTENTIAL: Record<string, 'high' | 'medium' | 'low'> = {
  'vpn': 'high', 'security': 'high', 'antivirus': 'high',
  'hosting': 'high', 'finance': 'high', 'investing': 'high',
  'software': 'medium', 'seo': 'medium', 'marketing': 'medium',
  'how to': 'low', 'what is': 'low',
}

function classifyRevenuePotential(keyword: string, intent: string): 'high' | 'medium' | 'low' {
  if (intent === 'informational') return 'low'
  if (intent === 'transactional') return 'high'
  const lower = keyword.toLowerCase()
  for (const [term, potential] of Object.entries(REVENUE_POTENTIAL)) {
    if (lower.includes(term)) return potential
  }
  return 'medium'
}

export async function buildPresenceMatrix(
  targetUrl: string,
  competitorUrls: string[],
  topic: string,
  reportId: string
): Promise<PresenceResult[]> {
  const targetDomain = extractDomain(targetUrl)
  const competitor1Domain = competitorUrls[0] ? extractDomain(competitorUrls[0]) : null
  const competitor2Domain = competitorUrls[1] ? extractDomain(competitorUrls[1]) : null
  const year = new Date().getFullYear()

  // 12 queries covering commercial, transactional, informational intent
  const queries = [
    { keyword: `best ${topic} ${year}`,         intent: 'commercial'     as const },
    { keyword: `${topic} review ${year}`,        intent: 'commercial'     as const },
    { keyword: `${topic} vs`,                    intent: 'transactional'  as const },
    { keyword: `top ${topic} tools`,             intent: 'commercial'     as const },
    { keyword: `${topic} comparison`,            intent: 'transactional'  as const },
    { keyword: `best ${topic} for beginners`,    intent: 'commercial'     as const },
    { keyword: `${topic} alternatives`,          intent: 'transactional'  as const },
    { keyword: `how to ${topic}`,                intent: 'informational'  as const },
    { keyword: `${topic} guide`,                 intent: 'informational'  as const },
    { keyword: `${topic} tutorial`,              intent: 'informational'  as const },
    { keyword: `${topic} pricing`,               intent: 'commercial'     as const },
    { keyword: `${topic} features`,              intent: 'commercial'     as const },
  ]

  // Run all 12 searches in parallel
  const searchResults = await Promise.all(
    queries.map(q => tavilySearch(q.keyword))
  )

  const results: PresenceResult[] = []

  for (let i = 0; i < queries.length; i++) {
    const srp = searchResults[i]
    const q = queries[i]

    const targetPresent = checkDomainInResults(srp, targetDomain)
    const c1Present = competitor1Domain ? checkDomainInResults(srp, competitor1Domain) : false
    const c2Present = competitor2Domain ? checkDomainInResults(srp, competitor2Domain) : false
    const topResultDomain = srp[0] ? extractDomain(srp[0].url) : null

    results.push({
      id: '',  // will be set by Supabase
      report_id: reportId,
      keyword: q.keyword,
      intent: q.intent,
      target_present: targetPresent,
      competitor1_present: c1Present,
      competitor2_present: c2Present,
      target_domain: targetDomain,
      competitor1_domain: competitor1Domain,
      competitor2_domain: competitor2Domain,
      top_result_domain: topResultDomain,
      revenue_potential: classifyRevenuePotential(q.keyword, q.intent),
    })
  }

  return results
}

─────────────────────────────────────────
STEP 4 — app/api/report/route.ts (NEW FILE)
─────────────────────────────────────────
Create this file. This is the new report pipeline.

import { NextRequest, NextResponse } from 'next/server'
import { createServerClient } from '@/lib/supabase'
import { fetchPage } from '@/lib/crawl/fetcher'
import { runSEOAudit } from '@/lib/agents/seo-auditor'
import { extractTopic } from '@/lib/agents/content-gap'
import { buildPresenceMatrix } from '@/lib/agents/presence-matrix'

export async function POST(req: NextRequest) {
  const body = await req.json()
  const targetUrl: string = body?.targetUrl?.trim()
  const competitorUrls: string[] = (body?.competitorUrls ?? [])
    .map((u: string) => u.trim())
    .filter(Boolean)
    .slice(0, 2)

  if (!targetUrl) {
    return NextResponse.json({ error: 'targetUrl is required' }, { status: 400 })
  }

  const db = createServerClient()
  const { data: report, error } = await db
    .from('reports')
    .insert({ target_url: targetUrl, competitor_urls: competitorUrls, status: 'queued' })
    .select('id')
    .single()

  if (error || !report) {
    return NextResponse.json({ error: 'Failed to create report' }, { status: 500 })
  }

  void runReportBackground(report.id, targetUrl, competitorUrls)
  return NextResponse.json({ reportId: report.id })
}

async function runReportBackground(
  reportId: string,
  targetUrl: string,
  competitorUrls: string[]
) {
  const db = createServerClient()
  try {
    await db.from('reports').update({
      status: 'running',
      seo_status: 'running',
      presence_status: 'running',
    }).eq('id', reportId)

    const { html: homepageHtml } = await fetchPage(targetUrl)
    const topic = await extractTopic(homepageHtml)
    await db.from('reports').update({ topic }).eq('id', reportId)

    // Run SEO audit + presence matrix in parallel
    const [seoResult, presenceResult] = await Promise.allSettled([
      runSEOAudit(targetUrl),
      buildPresenceMatrix(targetUrl, competitorUrls, topic, reportId),
    ])

    // Handle SEO
    if (seoResult.status === 'fulfilled') {
      const pages = seoResult.value
      if (pages.length > 0) {
        await db.from('report_seo_pages').insert(
          pages.map(p => ({
            report_id: reportId,
            url: p.url,
            title: p.title,
            seo_score: p.score,
            word_count: p.wordCount,
            load_time_ms: p.loadTimeMs,
            issues: p.issues,
          }))
        )
      }
      await db.from('reports').update({ seo_status: 'done' }).eq('id', reportId)
    } else {
      console.error('[SEO failed]', seoResult.reason)
      await db.from('reports').update({ seo_status: 'failed' }).eq('id', reportId)
    }

    // Handle presence matrix
    if (presenceResult.status === 'fulfilled') {
      const matrix = presenceResult.value
      if (matrix.length > 0) {
        await db.from('presence_results').insert(
          matrix.map(r => ({
            report_id: r.report_id,
            keyword: r.keyword,
            intent: r.intent,
            target_present: r.target_present,
            competitor1_present: r.competitor1_present,
            competitor2_present: r.competitor2_present,
            target_domain: r.target_domain,
            competitor1_domain: r.competitor1_domain,
            competitor2_domain: r.competitor2_domain,
            top_result_domain: r.top_result_domain,
            revenue_potential: r.revenue_potential,
          }))
        )
      }

      // Compute opportunity score: % of commercial queries where competitor wins but target doesn't
      const commercialGaps = matrix.filter(
        r => r.intent !== 'informational' && !r.target_present && (r.competitor1_present || r.competitor2_present)
      )
      const commercialTotal = matrix.filter(r => r.intent !== 'informational').length
      const opportunityScore = commercialTotal > 0
        ? Math.round((commercialGaps.length / commercialTotal) * 100)
        : 0

      await db.from('reports').update({
        presence_status: 'done',
        opportunity_score: opportunityScore,
      }).eq('id', reportId)
    } else {
      console.error('[Presence matrix failed]', presenceResult.reason)
      await db.from('reports').update({ presence_status: 'failed' }).eq('id', reportId)
    }

    await db.from('reports').update({ status: 'done' }).eq('id', reportId)
  } catch (err) {
    console.error('[Report pipeline failed]', err)
    await db.from('reports').update({
      status: 'failed',
      seo_status: 'failed',
      presence_status: 'failed',
    }).eq('id', reportId)
  }
}

─────────────────────────────────────────
STEP 5 — app/api/reports/[id]/status/route.ts (NEW FILE)
─────────────────────────────────────────
Create this file. MUST have force-dynamic to prevent caching.

import { NextRequest, NextResponse } from 'next/server'
import { createServerClient } from '@/lib/supabase'

export const dynamic = 'force-dynamic'
export const revalidate = 0

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params
  const db = createServerClient()

  const { data, error } = await db
    .from('reports')
    .select('*')
    .eq('id', id)
    .single()

  if (error || !data) {
    return NextResponse.json({ error: 'Report not found' }, { status: 404 })
  }

  return NextResponse.json(data, {
    headers: {
      'Cache-Control': 'no-store, no-cache, must-revalidate',
      'Pragma': 'no-cache',
    },
  })
}

─────────────────────────────────────────
STEP 6 — app/api/reports/[id]/matrix/route.ts (NEW FILE)
─────────────────────────────────────────
Returns presence matrix rows for a report, sorted by revenue_potential then intent.

import { NextRequest, NextResponse } from 'next/server'
import { createServerClient } from '@/lib/supabase'

export const dynamic = 'force-dynamic'

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params
  const db = createServerClient()

  const { data, error } = await db
    .from('presence_results')
    .select('*')
    .eq('report_id', id)
    .order('revenue_potential', { ascending: true })  // high first (h < m alphabetically, so ascending=false for 'high')

  return NextResponse.json(data ?? [], {
    headers: { 'Cache-Control': 'no-store' },
  })
}

─────────────────────────────────────────
STEP 7 — app/page.tsx — redesign the homepage
─────────────────────────────────────────
Replace the current homepage (which redirects to /audit) with the new report input form.
This IS the main page. No separate /audit page needed for the new flow.

The page should have:
- Header: "GrowthLab" in large mono font, subtitle: "Find the keywords your competitors win. Ship the content to close the gap."
- Form fields:
  - "Your site" — text input, placeholder: "https://yoursite.com"
  - "Competitors (up to 2)" — two text inputs, placeholder: "https://competitor1.com", "https://competitor2.com"
  - Submit button: "Run Competitive Analysis" — dark blue bg
- On submit: POST /api/report with { targetUrl, competitorUrls }, then router.push('/report/' + reportId)
- Below the form: "Recent Reports" section — fetch last 5 from /api/reports/recent, show as list with target URL + date

─────────────────────────────────────────
STEP 8 — app/api/reports/recent/route.ts (NEW FILE)
─────────────────────────────────────────
import { NextRequest, NextResponse } from 'next/server'
import { createServerClient } from '@/lib/supabase'

export const dynamic = 'force-dynamic'

export async function GET(_req: NextRequest) {
  const db = createServerClient()
  const { data } = await db
    .from('reports')
    .select('id, target_url, competitor_urls, status, opportunity_score, created_at')
    .order('created_at', { ascending: false })
    .limit(5)
  return NextResponse.json(data ?? [], {
    headers: { 'Cache-Control': 'no-store' },
  })
}

─────────────────────────────────────────
STEP 9 — app/report/[id]/page.tsx (NEW FILE)
─────────────────────────────────────────
This is the main report dashboard. It shows the presence matrix.

Behaviour:
- Poll /api/reports/[id]/status every 2s
- Stop polling when status === 'done' OR status === 'failed'
- Show agent trace bar while running (see below)
- Once done: show presence matrix + SEO summary

Agent trace bar (show during running):
  <div className="agent-trace">
    <TraceItem status={report.seo_status} label="SEO crawl" />
    <TraceItem status={report.presence_status} label="Presence check (12 queries)" />
    <TraceItem status={report.monetisation_status} label="Monetisation mapping" />
    <TraceItem status={report.cro_status} label="CRO analysis" />
  </div>

TraceItem renders: [✓] label (green when done), [◌] label (amber pulse when running), [○] label (grey when pending), [✕] label (red when failed)

Opportunity score card (show when opportunity_score is not null):
  Large number, label "opportunity score", subtitle: "% of commercial queries where competitors rank and you don't"

Presence matrix table (fetch from /api/reports/[id]/matrix when presence_status === 'done'):
Columns: Keyword | Intent | {targetDomain} | {competitor1Domain} | {competitor2Domain} | Revenue | Action

For each row:
- Keyword: text
- Intent badge: commercial=amber, transactional=green, informational=blue
- Target/Competitor columns: ✓ (green) if present, ✕ (red) if not
- Revenue: $$$ (high), $$ (medium), $ (low)
- Action: only show "Generate →" button if target_present=false AND (competitor1_present OR competitor2_present)
  The button links to /tools?keyword={keyword}&reportId={id}

Sort order: gaps first (target_present=false), then by revenue_potential (high first).

Show a "Quick Wins" section above the matrix:
  Filter rows where target_present=false AND (c1_present OR c2_present) AND intent !== 'informational'
  Take top 3 by revenue_potential. Show as cards: keyword, intent badge, revenue badge, "Generate content →" button.

─────────────────────────────────────────
VERIFICATION
─────────────────────────────────────────
1. npm run build — zero TypeScript errors
2. Open http://localhost:3000
3. Enter: yoursite=backlinko.com, competitor1=ahrefs.com, competitor2=semrush.com
4. Should redirect to /report/[id]
5. Agent trace should show items completing
6. Presence matrix should render with ✓/✕ per site per keyword
7. Quick wins should show top 3 commercial gaps
8. Check Supabase: presence_results table should have 12 rows for the report
```

---

## SESSION 6 — Monetisation + CRO + Opportunity Score polish

````
Read CLAUDE.md. git log --oneline -3 to orient.

─────────────────────────────────────────
STEP 1 — lib/agents/monetisation.ts (NEW FILE)
─────────────────────────────────────────
import { groqComplete } from '@/lib/llm/groq'

export interface MonetisationResult {
  category: string
  commissionRate: string
  programmes: string[]
  matchingPages: string[]
  ctaMissingPages: string[]
  priority: 'high' | 'medium' | 'low'
}

export async function runMonetisationAgent(
  topic: string,
  pageUrls: string[]
): Promise<MonetisationResult[]> {
  const prompt = `Site topic: "${topic}". Pages: ${pageUrls.slice(0, 5).join(', ')}.

Which affiliate categories are relevant from this list:
VPN/security, web hosting, finance/investing, health/supplements, software/SaaS, travel, e-commerce

For each relevant category return JSON (array, no markdown):
[{
  "category": string,
  "commissionRate": string (e.g. "25-45% recurring"),
  "programmes": string[] (2-3 real programme names),
  "matchingPages": string[] (which of the provided pages fit),
  "ctaMissingPages": string[] (pages that mention products but likely have no CTA),
  "priority": "high" | "medium" | "low"
}]

Return only the JSON array. No explanation. No markdown.`

  try {
    const raw = await groqComplete(prompt, 'You are an affiliate marketing expert. Return only valid JSON arrays.')
    const cleaned = raw.replace(/```json|```/g, '').trim()
    return JSON.parse(cleaned) as MonetisationResult[]
  } catch {
    return []
  }
}

─────────────────────────────────────────
STEP 2 — lib/agents/cro.ts (NEW FILE)
─────────────────────────────────────────
import { groqComplete } from '@/lib/llm/groq'

export interface CROResult {
  factor: string
  passed: boolean
  recommendation: string
}

export async function runCROAgent(html: string): Promise<CROResult[]> {
  const truncated = html.slice(0, 4000)
  const prompt = `Analyse this webpage HTML for conversion rate optimisation.

For exactly these 5 factors, return JSON (array, no markdown):
1. valueProp — Is there a clear value proposition above the fold?
2. ctaPresence — Are there clear call-to-action buttons?
3. socialProof — Are there testimonials, user counts, or press mentions?
4. trustSignals — Are there privacy policy, about page, or contact info links?
5. contentFreshness — Are there dates on articles indicating fresh content?

Return format (array of exactly 5 objects, no markdown):
[{ "factor": string, "passed": boolean, "recommendation": string }]

HTML: ${truncated}`

  try {
    const raw = await groqComplete(prompt, 'You are a CRO expert. Return only valid JSON arrays.')
    const cleaned = raw.replace(/```json|```/g, '').trim()
    return JSON.parse(cleaned) as CROResult[]
  } catch {
    return [
      { factor: 'valueProp', passed: false, recommendation: 'Could not analyse page' },
      { factor: 'ctaPresence', passed: false, recommendation: 'Could not analyse page' },
      { factor: 'socialProof', passed: false, recommendation: 'Could not analyse page' },
      { factor: 'trustSignals', passed: false, recommendation: 'Could not analyse page' },
      { factor: 'contentFreshness', passed: false, recommendation: 'Could not analyse page' },
    ]
  }
}

─────────────────────────────────────────
STEP 3 — Add monetisation + CRO tables to Supabase
─────────────────────────────────────────
Run in Supabase SQL editor:

CREATE TABLE IF NOT EXISTS report_monetisation (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  report_id uuid NOT NULL REFERENCES reports(id) ON DELETE CASCADE,
  category text NOT NULL,
  commission_rate text,
  programmes jsonb NOT NULL DEFAULT '[]',
  matching_pages jsonb NOT NULL DEFAULT '[]',
  cta_missing_pages jsonb NOT NULL DEFAULT '[]',
  priority text NOT NULL DEFAULT 'medium',
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS report_cro (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  report_id uuid NOT NULL REFERENCES reports(id) ON DELETE CASCADE,
  factor text NOT NULL,
  passed boolean NOT NULL DEFAULT false,
  recommendation text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

─────────────────────────────────────────
STEP 4 — Update app/api/report/route.ts
─────────────────────────────────────────
Import the new agents at the top:
  import { runMonetisationAgent } from '@/lib/agents/monetisation'
  import { runCROAgent } from '@/lib/agents/cro'

In runReportBackground, after the existing Promise.allSettled for SEO + presence,
add a second parallel batch:

  // Update statuses
  await db.from('reports').update({
    monetisation_status: 'running',
    cro_status: 'running',
  }).eq('id', reportId)

  // Get page URLs for monetisation agent
  const { data: seoPages } = await db
    .from('report_seo_pages')
    .select('url')
    .eq('report_id', reportId)
  const pageUrls = (seoPages ?? []).map(p => p.url)
  const topic = (await db.from('reports').select('topic').eq('id', reportId).single()).data?.topic ?? 'general'

  const [monetisationResult, croResult] = await Promise.allSettled([
    runMonetisationAgent(topic, pageUrls),
    (async () => {
      const { html } = await fetchPage(targetUrl)
      return runCROAgent(html)
    })(),
  ])

  if (monetisationResult.status === 'fulfilled' && monetisationResult.value.length > 0) {
    await db.from('report_monetisation').insert(
      monetisationResult.value.map(m => ({
        report_id: reportId,
        category: m.category,
        commission_rate: m.commissionRate,
        programmes: m.programmes,
        matching_pages: m.matchingPages,
        cta_missing_pages: m.ctaMissingPages,
        priority: m.priority,
      }))
    )
    await db.from('reports').update({ monetisation_status: 'done' }).eq('id', reportId)
  } else {
    await db.from('reports').update({ monetisation_status: 'failed' }).eq('id', reportId)
  }

  if (croResult.status === 'fulfilled') {
    await db.from('report_cro').insert(
      croResult.value.map(c => ({
        report_id: reportId,
        factor: c.factor,
        passed: c.passed,
        recommendation: c.recommendation,
      }))
    )
    await db.from('reports').update({ cro_status: 'done' }).eq('id', reportId)
  } else {
    await db.from('reports').update({ cro_status: 'failed' }).eq('id', reportId)
  }

─────────────────────────────────────────
STEP 5 — Add API routes for monetisation + CRO data
─────────────────────────────────────────
Create app/api/reports/[id]/monetisation/route.ts:
  Select all from report_monetisation where report_id = id
  Return JSON with Cache-Control: no-store, dynamic = force-dynamic

Create app/api/reports/[id]/cro/route.ts:
  Select all from report_cro where report_id = id
  Return JSON with Cache-Control: no-store, dynamic = force-dynamic

─────────────────────────────────────────
STEP 6 — Update app/report/[id]/page.tsx
─────────────────────────────────────────
Add two new collapsible sections below the presence matrix:

MONETISATION section (renders when monetisation_status === 'done'):
- Fetch from /api/reports/[id]/monetisation
- Show category cards: name, commission rate badge, programme names, priority badge
- Highlight "Quick win" rows where cta_missing_pages.length > 0

CRO section (renders when cro_status === 'done'):
- Fetch from /api/reports/[id]/cro
- 5 factor rows: factor name, ✓/✕ icon, recommendation text
- Failed factors in red, passed in green

Both sections show loading skeleton while status is 'pending' | 'running'.

─────────────────────────────────────────
VERIFICATION
─────────────────────────────────────────
1. npm run build — zero errors
2. Run report on backlinko.com vs ahrefs.com vs semrush.com
3. All 4 agent trace items should reach ✓
4. Monetisation section shows at least 1 category
5. CRO section shows 5 factors
6. Check Supabase: report_monetisation and report_cro tables have rows
````

---

## SESSION 7 — Content generation wired to the matrix

````
Read CLAUDE.md. git log --oneline -3 to orient.

This session wires content generation directly to the presence matrix.
Click a gap row → generate comparison page or content brief inline.
Also builds the standalone headline tester.

─────────────────────────────────────────
STEP 1 — lib/agents/brief-generator.ts (NEW FILE)
─────────────────────────────────────────
import { geminiComplete } from '@/lib/llm/gemini'

export interface ContentBrief {
  primaryKeyword: string
  secondaryKeywords: string[]
  relatedQuestions: string[]
  titleTag: string
  metaDescription: string
  articleStructure: { h2: string; h3s: string[] }[]
  wordCountRecommendation: number
  competitors: { name: string; url: string; strengths: string }[]
  claimsToVerify: string[]
  internalLinkingSuggestions: string[]
  affiliateCTAs: string[]
  commissioningNote: string
}

export async function generateContentBrief(keyword: string): Promise<ContentBrief> {
  const prompt = `Generate a complete content brief for the keyword: "${keyword}"

Return ONLY a JSON object (no markdown, no explanation) with this exact structure:
{
  "primaryKeyword": string,
  "secondaryKeywords": string[],
  "relatedQuestions": string[],
  "titleTag": string,
  "metaDescription": string,
  "articleStructure": [{ "h2": string, "h3s": string[] }],
  "wordCountRecommendation": number,
  "competitors": [{ "name": string, "url": string, "strengths": string }],
  "claimsToVerify": string[],
  "internalLinkingSuggestions": string[],
  "affiliateCTAs": string[],
  "commissioningNote": string
}

Make it actionable for an affiliate content site. Focus on commercial intent.
Return only the JSON object.`

  const raw = await geminiComplete(prompt)
  const cleaned = raw.replace(/```json|```/g, '').trim()
  return JSON.parse(cleaned) as ContentBrief
}

─────────────────────────────────────────
STEP 2 — lib/agents/headline-tester.ts (NEW FILE)
─────────────────────────────────────────
import { groqComplete } from '@/lib/llm/groq'
import type { HeadlineVariant } from '@/types'

export async function testHeadline(
  headline: string,
  goal: string
): Promise<HeadlineVariant[]> {
  const prompt = `Original headline: "${headline}"
Goal: ${goal}

Generate 5 headline variants optimised for this goal.
Return ONLY a JSON array (no markdown):
[{
  "variant": string,
  "angle": string,
  "reasoning": string,
  "estimatedCTRScore": number (0-100)
}]`

  try {
    const raw = await groqComplete(prompt, 'You are a headline optimisation expert. Return only valid JSON arrays.')
    const cleaned = raw.replace(/```json|```/g, '').trim()
    return JSON.parse(cleaned) as HeadlineVariant[]
  } catch {
    return []
  }
}

export async function combineHeadlines(variants: HeadlineVariant[]): Promise<string> {
  const prompt = `These are 5 headline variants:
${variants.map((v, i) => `${i + 1}. ${v.variant} (angle: ${v.angle})`).join('\n')}

Combine the strongest elements into one single best headline.
Return only the headline text, nothing else.`

  return groqComplete(prompt, 'You are a headline expert. Return only the headline text.')
}

─────────────────────────────────────────
STEP 3 — app/api/reports/[id]/generate/route.ts (NEW FILE)
─────────────────────────────────────────
This handles inline content generation from the matrix.

import { NextRequest, NextResponse } from 'next/server'
import { createServerClient } from '@/lib/supabase'
import { generateContentBrief } from '@/lib/agents/brief-generator'

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params
  const body = await req.json()
  const keyword: string = body?.keyword
  const type: 'brief' | 'comparison' = body?.type ?? 'brief'

  if (!keyword) {
    return NextResponse.json({ error: 'keyword required' }, { status: 400 })
  }

  try {
    if (type === 'brief') {
      const brief = await generateContentBrief(keyword)
      const db = createServerClient()
      await db.from('report_generated_content').insert({
        report_id: id,
        keyword,
        type: 'brief',
        title: brief.titleTag,
        content: JSON.stringify(brief),
      })
      return NextResponse.json({ type: 'brief', data: brief })
    }

    // For comparison type, redirect to existing comparison generator
    return NextResponse.json({ type: 'comparison', redirect: `/api/generate/comparison` })
  } catch (err) {
    console.error('[Generate failed]', err)
    return NextResponse.json({ error: 'Generation failed' }, { status: 500 })
  }
}

─────────────────────────────────────────
STEP 4 — Update app/report/[id]/page.tsx — inline generation
─────────────────────────────────────────
For each matrix row with target_present=false AND (c1_present OR c2_present):
The "Generate →" button opens an inline panel below the row (not a new page).

The panel has two tabs: "Content Brief" | "Comparison Page"

Content Brief tab:
- Click "Generate Brief" → POST /api/reports/[id]/generate { keyword, type: 'brief' }
- Show loading state: "Generating brief..."
- Render the brief as structured sections:
  Title tag, Meta description, Article structure (H2/H3 tree), Word count, Competitors, CTAs
- "Copy as Markdown" button

Comparison Page tab:
- Two inputs: product1 (pre-filled from keyword), product2 (empty)
- "Generate" → POST /api/generate/comparison { product1, product2 }
- Render HTML preview (dangerouslySetInnerHTML)
- "Copy HTML" button

─────────────────────────────────────────
STEP 5 — app/tools/page.tsx — headline tester tab
─────────────────────────────────────────
The tools page already has comparison and brief tabs stubbed.
Add the headline tester:

Headline input + goal selector (radio buttons):
- Maximize CTR
- Increase authority
- Curiosity gap
- Target keyword
- Emotional resonance

POST /api/generate/headline { headline, goal }
Render 5 variant cards sorted by estimatedCTRScore desc.
"Combine best elements" button → POST /api/generate/headline/combine { variants }

Create app/api/generate/headline/route.ts:
  import { testHeadline } from '@/lib/agents/headline-tester'
  POST handler: call testHeadline(headline, goal), write to generated_content table, return variants

Create app/api/generate/headline/combine/route.ts:
  import { combineHeadlines } from '@/lib/agents/headline-tester'
  POST handler: call combineHeadlines(variants), return { combined }

─────────────────────────────────────────
VERIFICATION
─────────────────────────────────────────
1. npm run build — zero errors
2. Run report, click "Generate →" on a gap row
3. Content brief panel opens inline, generates in ~8s
4. Brief has all sections: title, meta, structure, word count, competitors, CTAs
5. Go to /tools, test headline tester with "Best VPN for Streaming 2025" + "Maximize CTR"
6. 5 variants render, sorted by score
7. "Combine" button returns single best headline
````

---

## SESSION 8 — History + Scheduled re-audit (Paradise Media differentiator)

```
Read CLAUDE.md. git log --oneline -3 to orient.

─────────────────────────────────────────
STEP 1 — app/history/page.tsx
─────────────────────────────────────────
Full history page. Fetch from /api/reports/recent but with no limit.

Create app/api/reports/history/route.ts:
  Select all from reports, order by created_at desc, limit 50
  Return with Cache-Control: no-store

History page shows a table:
- Target URL
- Competitors (comma separated domains)
- Opportunity score badge (high=red, medium=amber, low=green — inverted: high opportunity = urgent)
- Status badge
- Date (relative: "2 hours ago", "3 days ago")
- "View report" link → /report/[id]
- "Track" toggle button → calls PATCH /api/reports/[id]/track

─────────────────────────────────────────
STEP 2 — Tracking toggle
─────────────────────────────────────────
Create app/api/reports/[id]/track/route.ts:
  PATCH handler: toggle reports.tracked boolean for the report
  Return { tracked: boolean }

In history page, "Track" button calls this and updates UI optimistically.
Tracked reports show a small "● Tracked" badge.

─────────────────────────────────────────
STEP 3 — Vercel Cron for scheduled re-audit
─────────────────────────────────────────
Create vercel.json in project root:
{
  "crons": [{
    "path": "/api/cron/reaudit",
    "schedule": "0 8 * * *"
  }]
}

Create app/api/cron/reaudit/route.ts:
  This runs every day at 8am UTC.

  import { NextRequest, NextResponse } from 'next/server'
  import { createServerClient } from '@/lib/supabase'
  import { buildPresenceMatrix } from '@/lib/agents/presence-matrix'
  import { extractTopic } from '@/lib/agents/content-gap'
  import { fetchPage } from '@/lib/crawl/fetcher'

  export const dynamic = 'force-dynamic'

  export async function GET(req: NextRequest) {
    // Verify this is called by Vercel Cron (basic security)
    const authHeader = req.headers.get('authorization')
    if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const db = createServerClient()

    // Get all tracked reports
    const { data: trackedReports } = await db
      .from('reports')
      .select('id, target_url, competitor_urls, topic')
      .eq('tracked', true)
      .eq('status', 'done')

    if (!trackedReports || trackedReports.length === 0) {
      return NextResponse.json({ message: 'No tracked reports' })
    }

    // Re-run presence matrix for each tracked report
    const results = await Promise.allSettled(
      trackedReports.map(async (report) => {
        const { html } = await fetchPage(report.target_url)
        const topic = report.topic ?? await extractTopic(html)
        const matrix = await buildPresenceMatrix(
          report.target_url,
          report.competitor_urls,
          topic,
          report.id
        )

        // Delete old presence results and insert new ones
        await db.from('presence_results').delete().eq('report_id', report.id)
        if (matrix.length > 0) {
          await db.from('presence_results').insert(
            matrix.map(r => ({
              report_id: r.report_id,
              keyword: r.keyword,
              intent: r.intent,
              target_present: r.target_present,
              competitor1_present: r.competitor1_present,
              competitor2_present: r.competitor2_present,
              target_domain: r.target_domain,
              competitor1_domain: r.competitor1_domain,
              competitor2_domain: r.competitor2_domain,
              top_result_domain: r.top_result_domain,
              revenue_potential: r.revenue_potential,
            }))
          )
        }

        // Recompute opportunity score
        const commercialGaps = matrix.filter(
          r => r.intent !== 'informational' && !r.target_present && (r.competitor1_present || r.competitor2_present)
        )
        const commercialTotal = matrix.filter(r => r.intent !== 'informational').length
        const opportunityScore = commercialTotal > 0
          ? Math.round((commercialGaps.length / commercialTotal) * 100)
          : 0

        await db.from('reports').update({
          opportunity_score: opportunityScore,
        }).eq('id', report.id)

        return { reportId: report.id, opportunityScore }
      })
    )

    return NextResponse.json({
      processed: trackedReports.length,
      results: results.map(r => r.status)
    })
  }

Add CRON_SECRET to .env.local:
  CRON_SECRET=any_random_string_you_choose

Add to Vercel env vars before deploy.

─────────────────────────────────────────
VERIFICATION
─────────────────────────────────────────
1. npm run build — zero errors
2. History page shows past reports
3. Click "Track" on a report — badge appears
4. Verify vercel.json exists in root
5. In interview: "tracked reports re-audit every 24 hours via Vercel Cron — Paradise Media's JD literally asks for scheduled jobs and monitoring"
```

---

## SESSION 9 — Polish + Deploy

```
Read CLAUDE.md. git log --oneline -3 to orient.

─────────────────────────────────────────
STEP 1 — Demo button
─────────────────────────────────────────
On the homepage (app/page.tsx), add a "Try a demo" button that pre-fills:
  target: https://backlinko.com
  competitor1: https://ahrefs.com
  competitor2: https://semrush.com
Then submits the form automatically.

─────────────────────────────────────────
STEP 2 — Error states
─────────────────────────────────────────
In app/report/[id]/page.tsx:
- If status === 'failed': show "Analysis failed. The site may be blocking automated requests."
- If presence_status === 'failed': show "Keyword presence check failed — SEO results still available"
- Never show a blank white screen

─────────────────────────────────────────
STEP 3 — SEO + meta tags
─────────────────────────────────────────
In app/layout.tsx, add:
  title: 'GrowthLab — Competitive Growth Intelligence'
  description: 'Find keywords your competitors win. Generate content to close the gap.'
  OG image meta tags

─────────────────────────────────────────
STEP 4 — Deploy to Vercel
─────────────────────────────────────────
1. Push all changes to main: git add -A && git commit -m "session 9: polish" && git push
2. Go to vercel.com → Import project → select growthlab repo
3. Set ALL env vars in Vercel dashboard:
   NEXT_PUBLIC_SUPABASE_URL
   NEXT_PUBLIC_SUPABASE_ANON_KEY
   SUPABASE_SERVICE_ROLE_KEY
   TAVILY_API_KEY
   GEMINI_API_KEY
   GROQ_API_KEY
   CRON_SECRET
4. Deploy
5. Test live URL with the demo button

─────────────────────────────────────────
STEP 5 — README update
─────────────────────────────────────────
Add to README.md:
- Live URL badge
- Screenshot of the presence matrix (take one after deploy)
- "How I build with AI agents" section:
  "Every session starts with CLAUDE.md — a context file that teaches Claude Code the
  architecture, constraints, and routing decisions before any code is written. This
  is specification-first, AI-augmented development: I define what to build and why,
  Claude Code executes, I review and own the output."
- Tech stack table
- Demo GIF instructions (record with ScreenToGif, free)

─────────────────────────────────────────
VERIFICATION — run the full demo script
─────────────────────────────────────────
1. Open live URL
2. Click "Try a demo" — backlinko vs ahrefs vs semrush
3. Watch agent trace complete (~30-45s)
4. Show presence matrix — highlight red ✕ rows under backlinko column
5. Click "Generate →" on a commercial gap
6. Show content brief rendering
7. Switch tab — show comparison page generator
8. Go to /tools — show headline tester
9. Go to /history — show tracked report badge
10. Say: "Tracked reports re-audit every 24 hours via Vercel Cron"

If all 10 steps work on the live URL, you're done.
```

---

## Quick reference

### Env vars needed

```
NEXT_PUBLIC_SUPABASE_URL=
NEXT_PUBLIC_SUPABASE_ANON_KEY=
SUPABASE_SERVICE_ROLE_KEY=
TAVILY_API_KEY=
GEMINI_API_KEY=
GROQ_API_KEY=
CRON_SECRET=growthlab_cron_secret_2025
```

### Tavily REST call

```typescript
const res = await fetch("https://api.tavily.com/search", {
  method: "POST",
  headers: { "Content-Type": "application/json" },
  body: JSON.stringify({
    api_key: process.env.TAVILY_API_KEY,
    query,
    search_depth: "basic",
    max_results: 10,
    include_answer: false,
  }),
});
const data = await res.json();
// data.results: [{ url, title, content, score }]
```

### Gemini call (@google/genai)

```typescript
import { GoogleGenAI } from "@google/genai";
const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY! });
const response = await ai.models.generateContent({
  model: "gemini-2.5-flash",
  contents: prompt,
});
return response.text ?? "";
```

### force-dynamic on every API route that reads from Supabase

```typescript
export const dynamic = "force-dynamic";
export const revalidate = 0;
```
