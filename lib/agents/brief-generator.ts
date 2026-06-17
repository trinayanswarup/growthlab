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
  "commissioningNote": "Write as a clean professional paragraph. No 'Note:' prefix. No meta-commentary about the article. Just the commissioning instruction."
}

Make it actionable for an affiliate content site. Focus on commercial intent.
Return only the JSON object.`

  const raw = await geminiComplete(prompt)
  const cleaned = raw.replace(/```json|```/g, '').trim()
  return JSON.parse(cleaned) as ContentBrief
}
