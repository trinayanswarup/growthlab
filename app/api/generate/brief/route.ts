import { NextRequest, NextResponse } from 'next/server'
import { generateContentBrief } from '@/lib/agents/brief-generator'
import { createServerClient } from '@/lib/supabase'

export async function POST(req: NextRequest) {
  const body = await req.json()
  const keyword: string = body?.keyword?.trim()

  if (!keyword) {
    return NextResponse.json({ error: 'keyword is required' }, { status: 400 })
  }

  try {
    const brief = await generateContentBrief(keyword)

    const db = createServerClient()
    await db
      .from('generated_content')
      .insert({
        type: 'brief',
        title: brief.titleTag || keyword,
        content: JSON.stringify(brief),
        audit_id: null,
      })

    return NextResponse.json(brief)
  } catch (err) {
    console.error('[Brief generator failed]', err)
    return NextResponse.json(
      { error: err instanceof Error ? err.message : 'Generation failed' },
      { status: 500 }
    )
  }
}
