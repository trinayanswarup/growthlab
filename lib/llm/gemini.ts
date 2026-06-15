import { GoogleGenAI } from '@google/genai'

const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY! })

export async function geminiComplete(prompt: string): Promise<string> {
  const MAX_ATTEMPTS = 3

  for (let attempt = 0; attempt < MAX_ATTEMPTS; attempt++) {
    try {
      const response = await ai.models.generateContent({
        model: 'gemini-2.5-flash',
        contents: prompt,
      })
      return response.text ?? ''
    } catch (err) {
      const status = (err as { status?: number }).status
      const isRetryable = status === 429 || status === 503
      if (isRetryable && attempt < MAX_ATTEMPTS - 1) {
        await new Promise((r) => setTimeout(r, 3000))
        continue
      }
      throw err
    }
  }

  // Unreachable but TypeScript needs a return
  throw new Error('geminiComplete: max attempts exceeded')
}
