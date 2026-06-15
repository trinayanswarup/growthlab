import { NextRequest, NextResponse } from 'next/server'
import { createServerClient } from '@/lib/supabase'
import { runSEOAudit } from '@/lib/agents/seo-auditor'

export async function POST(req: NextRequest) {
  const body = await req.json()
  const url: string = body?.url?.trim()

  if (!url) {
    return NextResponse.json({ error: 'url is required' }, { status: 400 })
  }

  const db = createServerClient()

  // Create audit row in queued state
  const { data: audit, error } = await db
    .from('audits')
    .insert({ url, status: 'queued' })
    .select('id')
    .single()

  if (error || !audit) {
    return NextResponse.json({ error: 'Failed to create audit' }, { status: 500 })
  }

  const auditId = audit.id

  // Fire SEO audit async — do not await
  void runSEOBackground(auditId, url)

  return NextResponse.json({ auditId })
}

async function runSEOBackground(auditId: string, url: string) {
  const db = createServerClient()

  try {
    await db
      .from('audits')
      .update({ status: 'running', seo_status: 'running' })
      .eq('id', auditId)

    const pages = await runSEOAudit(url)

    // Persist each page audit
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

    // Compute overall SEO score (average across pages)
    const avgScore = Math.round(pages.reduce((sum, p) => sum + p.score, 0) / pages.length)

    await db
      .from('audits')
      .update({
        seo_status: 'done',
        status: 'done',
        overall_score: avgScore,
      })
      .eq('id', auditId)
  } catch (err) {
    console.error('[SEO audit failed]', err)
    await db
      .from('audits')
      .update({ seo_status: 'failed', status: 'failed' })
      .eq('id', auditId)
  }
}
