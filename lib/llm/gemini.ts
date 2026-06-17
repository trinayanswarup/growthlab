import { GoogleGenAI } from '@google/genai'
import { groqComplete } from '@/lib/llm/groq'

const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY! })

export async function geminiComplete(prompt: string): Promise<string> {
  // Try Gemini first
  for (let attempt = 1; attempt <= 3; attempt++) {
    try {
      const response = await ai.models.generateContent({
        model: 'gemini-2.0-flash',
        contents: prompt,
      })
      return response.text ?? ''
    } catch (err: unknown) {
      const status = (err as { status?: number })?.status
      const isQuota = status === 429 || status === 503 ||
        JSON.stringify(err).includes('RESOURCE_EXHAUSTED') ||
        JSON.stringify(err).includes('quota')

      if (isQuota) {
        console.warn('[Gemini quota hit] falling back to Groq')
        // Fall back to Groq immediately on quota error
        return groqComplete(prompt)
      }

      if (attempt < 3) {
        await new Promise(r => setTimeout(r, 3000 * attempt))
      } else {
        throw err
      }
    }
  }
  return groqComplete(prompt)
}
