import { NextRequest, NextResponse } from 'next/server'
import { createServerClient } from '@/lib/supabase'

export async function GET(
  _req: NextRequest,
  { params }: { params: { id: string } }
) {
  const db = createServerClient()

  const { data, error } = await db
    .from('audit_pages')
    .select('id, url, title, seo_score, word_count, load_time_ms, issues')
    .eq('audit_id', params.id)
    .order('seo_score', { ascending: false })

  if (error) {
    return NextResponse.json({ error: 'Failed to fetch pages' }, { status: 500 })
  }

  return NextResponse.json(data ?? [])
}
