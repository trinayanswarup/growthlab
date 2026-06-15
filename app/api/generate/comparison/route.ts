import { NextRequest, NextResponse } from 'next/server'
import { tavilySearch } from '@/lib/agents/content-gap'
import { fetchPage } from '@/lib/crawl/fetcher'
import { geminiComplete } from '@/lib/llm/gemini'
import { createServerClient } from '@/lib/supabase'

interface ProductData {
  name: string
  price: string
  keyFeatures: string[]
  pros: string[]
  cons: string[]
  bestFor: string
  rating: number
}

async function fetchTopUrls(results: Awaited<ReturnType<typeof tavilySearch>>, count = 2): Promise<string[]> {
  return results.slice(0, count).map((r) => r.url)
}

async function fetchPagesSafely(urls: string[]): Promise<string[]> {
  const settled = await Promise.allSettled(urls.map((u) => fetchPage(u)))
  return settled.map((r) => r.status === 'fulfilled' ? r.value.html.slice(0, 15000) : '')
}

function parseJsonFromGemini<T>(text: string): T | null {
  // Strip markdown code fences if present
  const cleaned = text.replace(/```json\s*/gi, '').replace(/```\s*/g, '').trim()
  try {
    return JSON.parse(cleaned) as T
  } catch {
    // Try to extract first {...} block
    const match = cleaned.match(/\{[\s\S]*\}/)
    if (match) {
      try { return JSON.parse(match[0]) as T } catch { /* fall through */ }
    }
    return null
  }
}

export async function POST(req: NextRequest) {
  const body = await req.json()
  const product1: string = body?.product1?.trim()
  const product2: string = body?.product2?.trim()

  if (!product1 || !product2) {
    return NextResponse.json({ error: 'product1 and product2 are required' }, { status: 400 })
  }

  try {
    // ── Step a: Parallel Tavily searches ──
    const [results1, results2] = await Promise.all([
      tavilySearch(`${product1} features pricing review 2025`),
      tavilySearch(`${product2} features pricing review 2025`),
    ])

    // ── Step b: Fetch top 2 URLs from each (4 parallel fetches) ──
    const urls1 = await fetchTopUrls(results1)
    const urls2 = await fetchTopUrls(results2)

    const [htmls1, htmls2] = await Promise.all([
      fetchPagesSafely(urls1),
      fetchPagesSafely(urls2),
    ])

    const content1 = htmls1.join('\n\n---\n\n')
    const content2 = htmls2.join('\n\n---\n\n')

    // ── Step c: Extract structured product data ──
    const extractPrompt = (product: string, content: string) => `
You are extracting structured product data. Return ONLY valid JSON, no explanation, no markdown.

Product: ${product}
Source content:
${content.slice(0, 12000)}

Return this exact JSON shape:
{
  "name": "exact product name",
  "price": "price string e.g. '$X/month' or 'From $X'",
  "keyFeatures": ["feature 1", "feature 2", "feature 3", "feature 4", "feature 5"],
  "pros": ["pro 1", "pro 2", "pro 3"],
  "cons": ["con 1", "con 2", "con 3"],
  "bestFor": "one sentence describing ideal user",
  "rating": 8.5
}`

    const [raw1, raw2] = await Promise.all([
      geminiComplete(extractPrompt(product1, content1)),
      geminiComplete(extractPrompt(product2, content2)),
    ])

    const data1 = parseJsonFromGemini<ProductData>(raw1)
    const data2 = parseJsonFromGemini<ProductData>(raw2)

    const p1 = data1 ?? {
      name: product1, price: 'See website', keyFeatures: [], pros: [], cons: [], bestFor: '', rating: 0,
    }
    const p2 = data2 ?? {
      name: product2, price: 'See website', keyFeatures: [], pros: [], cons: [], bestFor: '', rating: 0,
    }

    // ── Step d: Generate full comparison HTML ──
    const htmlPrompt = `
You are a professional affiliate content writer. Generate a complete, publish-ready HTML comparison page.
Do NOT include <!DOCTYPE>, <html>, <head>, or <body> tags — just the content HTML.
Use semantic HTML: <article>, <section>, <table>, <h1>-<h3>.

Product 1 data: ${JSON.stringify(p1)}
Product 2 data: ${JSON.stringify(p2)}

REQUIRED SECTIONS (in order):
1. <h1> tag: "${p1.name} vs ${p2.name}: Which Is Better in 2025?"
2. Intro paragraph (2-3 sentences, sets up the comparison)
3. Feature comparison table: <table> with columns for Feature | ${p1.name} | ${p2.name}
   Include at least 6 rows: Pricing, Key Features (one per row), Best For, Rating
4. Pros/cons for each product in side-by-side <div class="pros-cons-grid"> sections
5. Verdict section: <h2>Our Verdict</h2> with specific use-case recommendations
6. CTA buttons (exact format required):
   <a href="{{AFFILIATE_LINK_PRODUCT1}}" class="cta-button">Try ${p1.name} →</a>
   <a href="{{AFFILIATE_LINK_PRODUCT2}}" class="cta-button">Try ${p2.name} →</a>
7. FAQ section: <h2>Frequently Asked Questions</h2> with exactly 5 <details>/<summary> Q&A pairs

The page must be professional, detailed, and genuinely useful. Minimum 600 words.`

    const html = await geminiComplete(htmlPrompt)

    // ── Step e: Persist to generated_content ──
    const db = createServerClient()
    const { data: saved } = await db
      .from('generated_content')
      .insert({
        type: 'comparison',
        title: `${p1.name} vs ${p2.name}`,
        content: html,
        audit_id: null,
      })
      .select('id')
      .single()

    // ── Step f: Return ──
    return NextResponse.json({ html, contentId: saved?.id ?? null })
  } catch (err) {
    console.error('[Comparison generator failed]', err)
    return NextResponse.json(
      { error: err instanceof Error ? err.message : 'Generation failed' },
      { status: 500 }
    )
  }
}
