import { NextRequest, NextResponse } from 'next/server'
import { createServerClient } from '@/lib/supabase'
import { fetchPage } from '@/lib/crawl/fetcher'
import { runSEOAudit } from '@/lib/agents/seo-auditor'
import { extractTopic, runContentGapAgent } from '@/lib/agents/content-gap'

export async function POST(req: NextRequest) {
  const body = await req.json()
  const url: string = body?.url?.trim()

  if (!url) {
    return NextResponse.json({ error: 'url is required' }, { status: 400 })
  }

  const db = createServerClient()

  const { data: audit, error } = await db
    .from('audits')
    .insert({ url, status: 'queued' })
    .select('id')
    .single()

  if (error || !audit) {
    return NextResponse.json({ error: 'Failed to create audit' }, { status: 500 })
  }

  const auditId = audit.id

  // Fire full pipeline async — return immediately
  void runAuditBackground(auditId, url)

  return NextResponse.json({ auditId })
}

async function runAuditBackground(auditId: string, url: string) {
  const db = createServerClient()

  try {
    await db
      .from('audits')
      .update({ status: 'running', seo_status: 'running', content_status: 'running' })
      .eq('id', auditId)

    // Fetch homepage once for topic extraction
    const { html: homepageHtml } = await fetchPage(url)

    // Extract topic synchronously before firing parallel agents
    const topic = await extractTopic(homepageHtml)
    await db.from('audits').update({ topic }).eq('id', auditId)

    // Run SEO + content gap in parallel
    const [seoResult, gapResult] = await Promise.allSettled([
      runSEOAudit(url),
      runContentGapAgent(url, topic),
    ])

    // ── SEO ──
    let avgScore: number | null = null
    if (seoResult.status === 'fulfilled') {
      const pages = seoResult.value
      const rows = pages.map((p) => ({
        audit_id: auditId,
        url: p.url,
        title: p.title,
        seo_score: p.score,
        word_count: p.wordCount,
        load_time_ms: p.loadTimeMs,
        issues: p.issues,
      }))
      await db.from('audit_pages').insert(rows)
      avgScore = Math.round(pages.reduce((sum, p) => sum + p.score, 0) / pages.length)
      await db
        .from('audits')
        .update({ seo_status: 'done', overall_score: avgScore })
        .eq('id', auditId)
    } else {
      console.error('[SEO agent failed]', seoResult.reason)
      await db.from('audits').update({ seo_status: 'failed' }).eq('id', auditId)
    }

    // ── Content Gap ──
    if (gapResult.status === 'fulfilled') {
      const gaps = gapResult.value
      if (gaps.length > 0) {
        const rows = gaps.map((g) => ({
          audit_id: auditId,
          keyword: g.keyword,
          intent: g.intent,
          gap_score: g.gapScore,
          competitor: g.competitor,
        }))
        await db.from('keyword_gaps').insert(rows)
      }
      await db.from('audits').update({ content_status: 'done' }).eq('id', auditId)
    } else {
      console.error('[Content gap agent failed]', gapResult.reason)
      await db.from('audits').update({ content_status: 'failed' }).eq('id', auditId)
    }

    // Always the final line — guarantees the frontend stops polling
    await db.from('audits').update({ status: 'done' }).eq('id', auditId)
  } catch (err) {
    console.error('[Audit pipeline failed]', err)
    await db.from('audits').update({
      status: 'failed',
      seo_status: 'failed',
      content_status: 'failed',
    }).eq('id', auditId)
  }
}
