import { NextRequest, NextResponse } from 'next/server'
import { createServerClient } from '@/lib/supabase'

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params
  const db = createServerClient()

  const { data, error } = await db
    .from('keyword_gaps')
    .select('id, keyword, intent, competitor, gap_score')
    .eq('audit_id', id)
    .order('gap_score', { ascending: false })

  if (error) {
    return NextResponse.json({ error: 'Failed to fetch gaps' }, { status: 500 })
  }

  return NextResponse.json(data ?? [])
}
