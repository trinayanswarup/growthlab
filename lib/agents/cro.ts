import { groqComplete } from '@/lib/llm/groq'

export interface CROResult {
  factor: string
  result: 'pass' | 'warning' | 'fail'
  recommendation: string
}

export async function runCROAgent(html: string): Promise<CROResult[]> {
  if (!html || html.trim().length < 100) {
    return [
      { factor: 'valueProp', result: 'warning', recommendation: 'Page content unavailable — site may be blocking crawlers.' },
      { factor: 'ctaPresence', result: 'warning', recommendation: 'Page content unavailable — site may be blocking crawlers.' },
      { factor: 'socialProof', result: 'warning', recommendation: 'Page content unavailable — site may be blocking crawlers.' },
      { factor: 'trustSignals', result: 'warning', recommendation: 'Page content unavailable — site may be blocking crawlers.' },
      { factor: 'contentFreshness', result: 'warning', recommendation: 'Page content unavailable — site may be blocking crawlers.' },
    ]
  }

  const truncated = html.slice(0, 4000)
  const prompt = `Analyse this webpage HTML for conversion rate optimisation. Be accurate and balanced.

For exactly these 5 factors, assess what is actually present in the HTML:
1. valueProp — Is there a clear headline or value proposition visible above the fold?
2. ctaPresence — Are there call-to-action buttons, links, or signup prompts?
3. socialProof — Are there testimonials, review counts, star ratings, user numbers, or press logos?
4. trustSignals — Are there privacy policy links, contact info, about page links, or security badges?
5. contentFreshness — Are there visible dates, timestamps, or recent article dates?

Scoring guide:
- "pass" = clearly present and effective
- "warning" = present but weak, vague, or hard to find
- "fail" = completely absent from the HTML

Return a JSON array of exactly 5 objects, no markdown fences:
[{ "factor": string, "result": "pass"|"warning"|"fail", "recommendation": string }]

HTML:
${truncated}`

  try {
    const raw = await groqComplete(
      prompt,
      'You are a CRO expert. Return only a valid JSON array. Be accurate — mark factors "pass" when they are genuinely present, "fail" only when truly absent.'
    )
    const cleaned = raw.replace(/```json|```/g, '').trim()
    const parsed = JSON.parse(cleaned) as Array<{ factor: string; result: string; recommendation: string }>
    const valid = ['pass', 'warning', 'fail']
    return parsed.map((item) => ({
      factor: item.factor,
      result: (valid.includes(item.result) ? item.result : 'fail') as 'pass' | 'warning' | 'fail',
      recommendation: item.recommendation,
    }))
  } catch {
    return [
      { factor: 'valueProp', result: 'warning', recommendation: 'Could not analyse page' },
      { factor: 'ctaPresence', result: 'warning', recommendation: 'Could not analyse page' },
      { factor: 'socialProof', result: 'warning', recommendation: 'Could not analyse page' },
      { factor: 'trustSignals', result: 'warning', recommendation: 'Could not analyse page' },
      { factor: 'contentFreshness', result: 'warning', recommendation: 'Could not analyse page' },
    ]
  }
}
