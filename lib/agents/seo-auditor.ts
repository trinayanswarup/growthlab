import * as cheerio from 'cheerio'
import { fetchPage } from '@/lib/crawl/fetcher'
import type { PageAudit } from '@/types'

// Scoring weights from PRD.md (total = 100)
const WEIGHTS = {
  title: 15,    // present + ≤60 chars
  meta: 10,     // present + ≤155 chars
  h1: 20,       // exactly one
  wordCount: 15, // >300 words
  altTags: 15,  // all images have alt
  loadTime: 15, // <3000ms
  canonical: 10,
}

export function extractInternalLinks(html: string, baseUrl: string): string[] {
  const $ = cheerio.load(html)
  const origin = new URL(baseUrl).origin
  const seen = new Set<string>()
  const links: string[] = []

  $('a[href]').each((_, el) => {
    const href = $(el).attr('href')
    if (!href) return
    try {
      const absolute = new URL(href, baseUrl).href
      // Internal only, no hash-only or query-only links
      if (
        absolute.startsWith(origin) &&
        absolute !== baseUrl &&
        !seen.has(absolute) &&
        !absolute.includes('#')
      ) {
        seen.add(absolute)
        links.push(absolute)
      }
    } catch {
      // Invalid URL — skip
    }
  })

  return links.slice(0, 4)
}

function countWords(text: string): number {
  return text.trim().split(/\s+/).filter(Boolean).length
}

export async function auditPage(url: string): Promise<PageAudit> {
  const { html, loadTimeMs, finalUrl } = await fetchPage(url)
  const $ = cheerio.load(html)

  const title = $('title').first().text().trim() || null
  const metaDesc = $('meta[name="description"]').attr('content')?.trim() || null
  const h1s = $('h1')
  const h2s = $('h2')
  const bodyText = $('body').text()
  const wordCount = countWords(bodyText)
  const images = $('img')
  const imagesWithoutAlt = images.filter((_, el) => !$(el).attr('alt')).length
  const internalOrigin = new URL(finalUrl).origin
  let internalLinks = 0
  let externalLinks = 0

  $('a[href]').each((_, el) => {
    const href = $(el).attr('href') || ''
    try {
      const abs = new URL(href, finalUrl).href
      if (abs.startsWith(internalOrigin)) internalLinks++
      else externalLinks++
    } catch {
      // Skip
    }
  })

  const hasCanonical = $('link[rel="canonical"]').length > 0

  // Scoring
  let score = 0
  const issues: string[] = []

  // Title (15pts)
  if (!title) {
    issues.push('Missing title tag')
  } else if (title.length > 60) {
    score += 8
    issues.push(`Title too long (${title.length} chars, max 60)`)
  } else {
    score += WEIGHTS.title
  }

  // Meta description (10pts)
  if (!metaDesc) {
    issues.push('Missing meta description')
  } else if (metaDesc.length > 155) {
    score += 5
    issues.push(`Meta description too long (${metaDesc.length} chars, max 155)`)
  } else {
    score += WEIGHTS.meta
  }

  // H1 (20pts)
  if (h1s.length === 0) {
    issues.push('No H1 tag found')
  } else if (h1s.length > 1) {
    score += 10
    issues.push(`Multiple H1 tags (${h1s.length} found, should be 1)`)
  } else {
    score += WEIGHTS.h1
  }

  // Word count (15pts)
  if (wordCount < 300) {
    issues.push(`Low word count (${wordCount} words, target >300)`)
  } else {
    score += WEIGHTS.wordCount
  }

  // Alt tags (15pts)
  if (imagesWithoutAlt > 0) {
    issues.push(`${imagesWithoutAlt} image(s) missing alt text`)
  } else {
    score += WEIGHTS.altTags
  }

  // Load time (15pts)
  if (loadTimeMs >= 3000) {
    issues.push(`Slow page load (${loadTimeMs}ms, target <3000ms)`)
  } else {
    score += WEIGHTS.loadTime
  }

  // Canonical (10pts)
  if (!hasCanonical) {
    issues.push('No canonical tag')
  } else {
    score += WEIGHTS.canonical
  }

  return {
    url: finalUrl,
    title,
    titleLength: title?.length ?? 0,
    metaDescription: metaDesc,
    metaDescriptionLength: metaDesc?.length ?? 0,
    h1Count: h1s.length,
    h2Count: h2s.length,
    wordCount,
    imagesWithoutAlt,
    internalLinks,
    externalLinks,
    hasCanonical,
    loadTimeMs,
    score,
    issues,
  }
}

export async function runSEOAudit(url: string): Promise<PageAudit[]> {
  // Fetch once to extract links, then audit homepage from cached result
  const { html, loadTimeMs, finalUrl } = await fetchPage(url)
  const internalLinks = extractInternalLinks(html, finalUrl)

  // Audit homepage from already-fetched HTML by loading directly
  const $ = cheerio.load(html)
  const title = $('title').first().text().trim() || null
  const metaDesc = $('meta[name="description"]').attr('content')?.trim() || null
  const h1s = $('h1')
  const h2s = $('h2')
  const wordCount = countWords($('body').text())
  const images = $('img')
  const imagesWithoutAlt = images.filter((_, el) => !$(el).attr('alt')).length
  const internalOrigin = new URL(finalUrl).origin
  let internalLinkCount = 0
  let externalLinkCount = 0
  $('a[href]').each((_, el) => {
    const href = $(el).attr('href') || ''
    try {
      const abs = new URL(href, finalUrl).href
      if (abs.startsWith(internalOrigin)) internalLinkCount++
      else externalLinkCount++
    } catch { /* skip */ }
  })
  const hasCanonical = $('link[rel="canonical"]').length > 0

  let score = 0
  const issues: string[] = []
  if (!title) { issues.push('Missing title tag') }
  else if (title.length > 60) { score += 8; issues.push(`Title too long (${title.length} chars, max 60)`) }
  else { score += WEIGHTS.title }

  if (!metaDesc) { issues.push('Missing meta description') }
  else if (metaDesc.length > 155) { score += 5; issues.push(`Meta description too long (${metaDesc.length} chars, max 155)`) }
  else { score += WEIGHTS.meta }

  if (h1s.length === 0) { issues.push('No H1 tag found') }
  else if (h1s.length > 1) { score += 10; issues.push(`Multiple H1 tags (${h1s.length} found, should be 1)`) }
  else { score += WEIGHTS.h1 }

  if (wordCount < 300) { issues.push(`Low word count (${wordCount} words, target >300)`) }
  else { score += WEIGHTS.wordCount }

  if (imagesWithoutAlt > 0) { issues.push(`${imagesWithoutAlt} image(s) missing alt text`) }
  else { score += WEIGHTS.altTags }

  if (loadTimeMs >= 3000) { issues.push(`Slow page load (${loadTimeMs}ms, target <3000ms)`) }
  else { score += WEIGHTS.loadTime }

  if (!hasCanonical) { issues.push('No canonical tag') }
  else { score += WEIGHTS.canonical }

  const homepage: PageAudit = {
    url: finalUrl,
    title,
    titleLength: title?.length ?? 0,
    metaDescription: metaDesc,
    metaDescriptionLength: metaDesc?.length ?? 0,
    h1Count: h1s.length,
    h2Count: h2s.length,
    wordCount,
    imagesWithoutAlt,
    internalLinks: internalLinkCount,
    externalLinks: externalLinkCount,
    hasCanonical,
    loadTimeMs,
    score,
    issues,
  }

  const pageResults = await Promise.allSettled(
    internalLinks.map((link) => auditPage(link))
  )

  const subPages = pageResults
    .filter((r): r is PromiseFulfilledResult<PageAudit> => r.status === 'fulfilled')
    .map((r) => r.value)

  return [homepage, ...subPages]
}
