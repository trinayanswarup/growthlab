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
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/125.0.0.0 Safari/537.36',
        'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
        'Accept-Language': 'en-US,en;q=0.9',
        'Cache-Control': 'no-cache',
        'Pragma': 'no-cache',
      },
    })

    // If 403, don't throw — return empty HTML so the audit degrades gracefully
    if (!response.ok) {
      if (response.status === 403 || response.status === 429) {
        return { html: '', loadTimeMs: Date.now() - start, finalUrl: url }
      }
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
