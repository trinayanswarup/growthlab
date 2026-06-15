export class FetchError extends Error {
  constructor(public url: string, public cause: string) {
    super(`Failed to fetch ${url}: ${cause}`)
    this.name = 'FetchError'
  }
}

export interface FetchResult {
  html: string
  loadTimeMs: number
  finalUrl: string
}

export async function fetchPage(url: string): Promise<FetchResult> {
  const controller = new AbortController()
  const timeout = setTimeout(() => controller.abort(), 8000)
  const start = Date.now()

  try {
    const response = await fetch(url, {
      signal: controller.signal,
      redirect: 'follow',
      headers: {
        'User-Agent': 'Mozilla/5.0 (compatible; GrowthLabBot/1.0)',
      },
    })

    if (!response.ok) {
      throw new FetchError(url, `HTTP ${response.status}`)
    }

    const html = await response.text()
    const loadTimeMs = Date.now() - start

    return { html, loadTimeMs, finalUrl: response.url }
  } catch (err) {
    if (err instanceof FetchError) throw err
    if (err instanceof Error && err.name === 'AbortError') {
      throw new FetchError(url, 'timeout after 8s')
    }
    throw new FetchError(url, err instanceof Error ? err.message : String(err))
  } finally {
    clearTimeout(timeout)
  }
}
