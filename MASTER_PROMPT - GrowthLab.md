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

## SESSION 5 — Monetisation + CRO agents

```
Read CLAUDE.md. git log --oneline -3 to orient.

Build monetisation and CRO agents and complete the 4-agent pipeline.

1. /lib/agents/monetisation.ts
   System prompt: "You are an affiliate marketing expert. Return only valid JSON, no markdown."
   User prompt: "Site covers these topics: {topics}. Pages: {pageUrls}.
   For each relevant affiliate category from [VPN/security, web hosting, finance/investing, 
   health/supplements, software/SaaS, travel, e-commerce], return:
   { category, commissionRate, programmes: string[], matchingPages: string[], 
     ctaMissingPages: string[], priority: 'high'|'medium'|'low' }
   Return a JSON array of matched categories only."
   Parse response, write to monetisation_opportunities.

2. /lib/agents/cro.ts
   Fetch homepage HTML. Groq prompt (return JSON only):
   "Analyse this page for CRO. For each factor, return pass (bool) and recommendation (string):
   factors: valueProp, ctaPresence, socialProof, trustSignals, contentFreshness"
   Write to cro_findings table.

3. Update /app/api/audit/route.ts:
   All 4 agents in Promise.allSettled. Compute overall_score:
   - seoScore: avg of audit_pages seo_score
   - contentScore: 100 - (keyword_gaps.length * 8), min 0
   - monetisationScore: high=90, medium=60, low=30, avg of top 3
   - croScore: (passed_count / 5) * 100
   - overall = (seoScore * 0.3 + contentScore * 0.25 + monetisationScore * 0.25 + croScore * 0.2)
   Update audits.overall_score.

4. Dashboard: add monetisation section (category cards with commission rate badges)
   and CRO section (factor rows with pass/fail icons and recommendation text).

Run npm run build. Fix all errors.
Test with a real URL — verify all 4 agents complete.
```

---

## SESSION 6 — Dashboard polish + action backlog

```
Read CLAUDE.md. git log --oneline -3 to orient.

Polish the dashboard into a real product UI.

1. Metric cards (top of dashboard, 4 cards in a row):
   - Overall Opportunity Score: large number with circular progress indicator (CSS only)
   - SEO Issues: count, red if >5
   - Keyword Gaps: count
   - Est. Monthly Revenue: computed as avg_gap_score * 0.3 * niche_RPM
     RPM map: { 'VPN/security': 12, 'finance/investing': 18, 'software/SaaS': 8, default: 5 }
     Format as "$X–$Y" range (multiply by 0.7 and 1.3)

2. Quick wins (below metric cards):
   3 cards showing highest-impact, lowest-effort actions across all agents.
   Effort: fix meta=1, add CTA=1, add alt text=1, write comparison page=3, new article=4
   Impact: SEO score improvement estimate or gap_score / 10
   Sort by (impact / effort) desc, take top 3.

3. Action backlog:
   Flat sorted list below all agent sections.
   Columns: action, category (badge), effort, impact, status (open).
   "Export as markdown" button — copy to clipboard as checklist.

4. Collapsible sections: each agent section has expand/collapse toggle.
   Store state in localStorage keyed by auditId.

5. Loading skeletons: pulsing placeholder while agent is pending/running.
   Match the shape of the actual content (card-shaped, not generic bars).

Run npm run build.
```

---

## SESSION 7 — Content Brief + Headline Tester

```
Read CLAUDE.md. git log --oneline -3 to orient.

Complete the tools screen.

1. /app/api/generate/brief/route.ts POST
   Body: { keyword: string, auditId?: string }
   Gemini prompt — return JSON only:
   {
     primaryKeyword, secondaryKeywords: string[], relatedQuestions: string[],
     titleTag, metaDescription,
     articleStructure: { h2: string, h3s: string[] }[],
     wordCountRecommendation: number,
     competitors: { name: string, url: string, strengths: string }[],
     claimsToVerify: string[],
     internalLinkingSuggestions: string[],
     affiliateCTAs: string[],
     commissioningNote: string
   }
   Write to generated_content (type: 'brief'). Return JSON.

2. /app/api/generate/headline/route.ts POST
   Body: { headline: string, goal: string }
   Groq prompt: return JSON array only:
   [{ variant: string, angle: string, reasoning: string, estimatedCTRScore: number }]
   Second endpoint or query param for "combine": send all 5 variants back, return single best.
   Write to generated_content (type: 'headline'). Return JSON array.

3. /app/tools/page.tsx — three tabs:
   Tab 1: Comparison (already built)
   Tab 2: Brief — keyword input (or dropdown from audit's keyword gaps), renders brief as structured cards
   Tab 3: Headline — input + goal selector (5 options as radio), renders 5 variant cards sorted by CTR score,
           "Combine best elements" button at bottom

Run npm run build. Fix all errors. Test all three tools manually.
```

---

## SESSION 8 — History + final polish + deploy

```
Read CLAUDE.md. git log --oneline -3 to orient.

Final session — ship it.

1. /app/history/page.tsx
   Fetch all audits from Supabase, order by created_at desc.
   Table: URL (truncated), date, overall score badge, "View dashboard" link.
   Empty state: "No audits yet — run your first audit."

2. Error handling pass:
   - Failed agent sections show which agent failed + "We couldn't complete this section" message
   - Network errors on the audit page show inline error, don't redirect
   - Comparison page generator: if Tavily returns no results, show "Couldn't find enough data for {product}"

3. UX polish:
   - "Try a demo" button on /audit page that pre-fills: cybernews.com
   - Favicon: simple "G" in brand green
   - Page titles: "GrowthLab — Audit {url}" etc.
   - OG tags on /audit page

4. Vercel deploy:
   - Set all 5 env vars in Vercel dashboard
   - Push to main, confirm Vercel build passes
   - Run full demo script from CLAUDE.md on the live URL

5. README: add live URL badge, tech stack badges, screenshot of dashboard.

Run npm run build. Ship.
```

---

## Quick reference — env vars needed

```env
NEXT_PUBLIC_SUPABASE_URL=
NEXT_PUBLIC_SUPABASE_ANON_KEY=
SUPABASE_SERVICE_ROLE_KEY=
TAVILY_API_KEY=
GEMINI_API_KEY=
GROQ_API_KEY=
```

## Quick reference — Tavily REST call (no SDK needed)

```typescript
const res = await fetch('https://api.tavily.com/search', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({
    api_key: process.env.TAVILY_API_KEY,
    query,
    search_depth: 'basic',
    max_results: 10,
  }),
})
const data = await res.json()
// data.results: [{ url, title, content, score }]
```
