import { NextRequest, NextResponse } from 'next/server'
import { createServerClient } from '@/lib/supabase'

export async function GET(
  _req: NextRequest,
  { params }: { params: { id: string } }
) {
  const db = createServerClient()

  const { data, error } = await db
    .from('audits')
    .select('id, url, status, seo_status, content_status, monetisation_status, cro_status, topic, overall_score, created_at')
    .eq('id', params.id)
    .single()

  if (error || !data) {
    return NextResponse.json({ error: 'Audit not found' }, { status: 404 })
  }

  return NextResponse.json(data)
}
