'use client'

import { Fragment, useEffect, useState } from 'react'
import Link from 'next/link'
import { ArrowLeft } from 'lucide-react'
import type { Report, PresenceResult, AgentStatus } from '@/types'
import type { ContentBrief } from '@/lib/agents/brief-generator'

interface MonetisationRow {
  id: string
  category: string
  commission_rate: string
  programmes: string[]
  matching_pages: string[]
  cta_missing_pages: string[]
  priority: 'high' | 'medium' | 'low'
}

interface CRORow {
  id: string
  factor: string
  passed: boolean
  recommendation: string
}

interface SeoPage {
  id: string
  url: string
  title: string | null
  seo_score: number
  word_count: number
  load_time_ms: number
  issues: string[]
}

// ─── Helpers ───────────────────────────────────────────────────────────────

const REVENUE_ORDER: Record<string, number> = { high: 0, medium: 1, low: 2 }

function sortMatrix(rows: PresenceResult[]): PresenceResult[] {
  return [...rows].sort((a, b) => {
    const aGap = !a.target_present ? 0 : 1
    const bGap = !b.target_present ? 0 : 1
    if (aGap !== bGap) return aGap - bGap
    return (REVENUE_ORDER[a.revenue_potential] ?? 1) - (REVENUE_ORDER[b.revenue_potential] ?? 1)
  })
}

const INTENT_DOT: Record<string, string> = {
  commercial: 'bg-[var(--commercial)]',
  transactional: 'bg-[var(--present)]',
  informational: 'bg-[#38bdf8]',
}
const INTENT_TEXT: Record<string, string> = {
  commercial: 'text-[var(--commercial)]',
  transactional: 'text-[var(--present)]',
  informational: 'text-[#38bdf8]',
}

// ─── Sub-components ────────────────────────────────────────────────────────

function IntentBadge({ intent }: { intent: string }) {
  return (
    <span className="inline-flex items-center gap-1.5">
      <span className={`w-1.5 h-1.5 rounded-full flex-shrink-0 ${INTENT_DOT[intent] ?? 'bg-[var(--text-muted)]'}`} />
      <span className={`text-xs capitalize font-medium ${INTENT_TEXT[intent] ?? 'text-[var(--text-muted)]'}`}>{intent}</span>
    </span>
  )
}

function CopyButton({ text, label = 'Copy' }: { text: string; label?: string }) {
  const [copied, setCopied] = useState(false)
  async function handleCopy() {
    try {
      await navigator.clipboard.writeText(text)
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    } catch { }
  }
  return (
    <button
      type="button"
      onClick={handleCopy}
      className="px-3 py-1.5 rounded-lg text-xs bg-[var(--surface-2)] border border-[var(--border)] text-[var(--text-secondary)] hover:text-[var(--text-primary)] hover:border-[var(--border-2)] transition-colors"
    >
      {copied ? 'Copied!' : label}
    </button>
  )
}

function TraceItem({ status, label }: { status: AgentStatus; label: string }) {
  const config = {
    done: { icon: '✓', cls: 'text-green-400' },
    running: { icon: '◌', cls: 'text-amber-400 animate-pulse' },
    failed: { icon: '✕', cls: 'text-red-400' },
    pending: { icon: '○', cls: 'text-[var(--text-muted)]' },
  }[status]

  return (
    <div className={`flex items-center gap-2 text-sm font-mono ${config.cls}`}>
      <span className="w-4 text-center">{config.icon}</span>
      <span>{label}</span>
    </div>
  )
}

function PriorityLabel({ level }: { level: string }) {
  if (level === 'high') return <span className="text-[var(--missing)] font-semibold text-xs">High</span>
  if (level === 'medium') return <span className="text-[var(--commercial)] font-semibold text-xs">Med</span>
  return <span className="text-[var(--text-muted)] text-xs">Low</span>
}

function PresenceCell({ present }: { present: boolean }) {
  return present
    ? <span className="inline-flex items-center gap-1 text-[var(--present)] font-semibold text-sm">✓</span>
    : <span className="text-[var(--missing)] text-sm font-medium">✕</span>
}

function QuickWins({ matrix, c1Domain, c2Domain, onOpen }: { matrix: PresenceResult[]; reportId: string; c1Domain: string | null; c2Domain: string | null; onOpen: (kw: string) => void }) {
  const wins = matrix
    .filter((r) => !r.target_present && (r.competitor1_present || r.competitor2_present) && r.intent !== 'informational')
    .sort((a, b) => (REVENUE_ORDER[a.revenue_potential] ?? 1) - (REVENUE_ORDER[b.revenue_potential] ?? 1))
    .slice(0, 3)

  if (wins.length === 0) return null

  return (
    <div className="mb-8">
      <h2 className="text-xs font-semibold uppercase tracking-widest text-[var(--text-secondary)] mb-3">
        Quick Wins
      </h2>
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
        {wins.map((r) => (
          <div key={r.id || r.keyword} className="rounded-lg border border-[var(--border)] bg-[var(--surface)] p-4 hover:border-[var(--accent-30)] transition-colors flex flex-col">
            <p className="text-sm text-[var(--navy)] font-mono font-medium mb-3 leading-snug">{r.keyword}</p>
            <div className="flex items-center gap-3 mb-2">
              <IntentBadge intent={r.intent} />
              <PriorityLabel level={r.revenue_potential} />
            </div>
            <p className="text-xs text-[var(--text-muted)] mb-4">
              {r.competitor1_present && c1Domain ? c1Domain : r.competitor2_present && c2Domain ? c2Domain : 'Competitor'} appears · you don&apos;t
            </p>
            <button
              type="button"
              onClick={() => onOpen(r.keyword)}
              className="mt-auto text-xs px-3 py-1.5 bg-[var(--accent)] text-white font-medium rounded-lg hover:bg-[var(--accent-hover)] transition-colors self-start"
            >
              Generate content →
            </button>
          </div>
        ))}
      </div>
    </div>
  )
}

function SkeletonRow() {
  return (
    <tr className="animate-pulse border-t border-[var(--border)]">
      {[...Array(7)].map((_, i) => (
        <td key={i} className="py-3 px-3">
          <div className="h-3 bg-[var(--surface-2)] rounded w-full" />
        </td>
      ))}
    </tr>
  )
}

// ─── Inline generation panel ───────────────────────────────────────────────

type PanelTab = 'brief' | 'comparison'

function GeneratePanel({ keyword, reportId, colSpan }: { keyword: string; reportId: string; colSpan: number }) {
  const [tab, setTab] = useState<PanelTab>('brief')

  const [briefLoading, setBriefLoading] = useState(false)
  const [brief, setBrief] = useState<ContentBrief | null>(null)
  const [briefError, setBriefError] = useState<string | null>(null)

  const [product1, setProduct1] = useState(keyword)
  const [product2, setProduct2] = useState('')
  const [compLoading, setCompLoading] = useState(false)
  const [compHtml, setCompHtml] = useState<string | null>(null)
  const [compError, setCompError] = useState<string | null>(null)

  async function generateBrief() {
    setBriefLoading(true)
    setBriefError(null)
    try {
      const res = await fetch(`/api/reports/${reportId}/generate`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ keyword, type: 'brief' }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || 'Generation failed')
      setBrief(data.data)
    } catch (err) {
      setBriefError(err instanceof Error ? err.message : 'Generation failed')
    } finally {
      setBriefLoading(false)
    }
  }

  async function generateComparison() {
    if (!product1.trim() || !product2.trim()) return
    setCompLoading(true)
    setCompError(null)
    try {
      const res = await fetch('/api/generate/comparison', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ product1: product1.trim(), product2: product2.trim() }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || 'Generation failed')
      setCompHtml(data.html)
    } catch (err) {
      setCompError(err instanceof Error ? err.message : 'Generation failed')
    } finally {
      setCompLoading(false)
    }
  }

  function briefMarkdown(): string {
    if (!brief) return ''
    return [
      `# ${brief.titleTag}`,
      ``,
      `**Meta:** ${brief.metaDescription}`,
      ``,
      `**Recommended word count:** ${brief.wordCountRecommendation}`,
      ``,
      `## Article Structure`,
      ...brief.articleStructure.flatMap((s) => [`### ${s.h2}`, ...s.h3s.map((h) => `- ${h}`)]),
      ``,
      `## Secondary Keywords`,
      ...brief.secondaryKeywords.map((k) => `- ${k}`),
      ``,
      `## Related Questions`,
      ...brief.relatedQuestions.map((q) => `- ${q}`),
      ``,
      `## Affiliate CTAs`,
      ...brief.affiliateCTAs.map((c) => `- ${c}`),
      ``,
      `**Commissioning note:** ${brief.commissioningNote}`,
    ].join('\n')
  }

  return (
    <tr>
      <td colSpan={colSpan} className="p-0 border-t border-[var(--border)]">
        <div className="bg-[var(--bg)] border-b border-[var(--border)] px-4 py-4">

          {/* Panel tab bar */}
          <div className="flex gap-1 mb-4 border-b border-[var(--border)]">
            {(['brief', 'comparison'] as PanelTab[]).map((t) => (
              <button
                key={t}
                type="button"
                onClick={() => setTab(t)}
                className={`px-3 py-1.5 text-xs transition-colors border-b-2 -mb-px ${tab === t ? 'text-[var(--accent)] border-[var(--accent)]' : 'text-[var(--text-secondary)] border-transparent hover:text-[var(--text-primary)]'}`}
              >
                {t === 'brief' ? 'Content Brief' : 'Comparison Page'}
              </button>
            ))}
          </div>

          {/* Content Brief */}
          {tab === 'brief' && (
            <div>
              {!brief && !briefLoading && (
                <button
                  type="button"
                  onClick={generateBrief}
                  className="px-4 py-2 rounded-lg bg-[var(--accent)] text-white font-semibold text-xs hover:bg-[var(--accent-hover)] transition-colors"
                >
                  Generate Brief
                </button>
              )}
              {briefLoading && (
                <p className="text-[var(--text-secondary)] text-sm animate-pulse">Generating brief…</p>
              )}
              {briefError && <p className="text-red-400 text-xs mt-2">{briefError}</p>}
              {brief && (
                <div className="bg-[var(--surface)] border border-[var(--border)] rounded-lg overflow-hidden">
                  {/* Header bar */}
                  <div className="bg-[var(--surface-2)] px-4 py-3 border-b border-[var(--border)] flex items-center justify-between">
                    <span className="text-xs text-[var(--text-muted)]">
                      Brief ready · <span className="text-[var(--accent)] font-mono">{brief.wordCountRecommendation.toLocaleString()}</span> words recommended
                    </span>
                    <CopyButton text={briefMarkdown()} label="Copy as Markdown" />
                  </div>

                  {/* Title + meta 2-col grid */}
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 p-4 border-b border-[var(--border)]">
                    <div className="rounded-lg border border-[var(--border)] bg-[var(--bg)] p-3">
                      <p className="text-[10px] font-bold uppercase tracking-wider text-[var(--text-muted)] mb-1">Title tag</p>
                      <p className="text-xs text-[var(--text-primary)] font-mono leading-snug">{brief.titleTag}</p>
                    </div>
                    <div className="rounded-lg border border-[var(--border)] bg-[var(--bg)] p-3">
                      <p className="text-[10px] font-bold uppercase tracking-wider text-[var(--text-muted)] mb-1">Meta description</p>
                      <p className="text-xs text-[var(--text-secondary)] leading-snug">{brief.metaDescription}</p>
                    </div>
                  </div>

                  {/* Article structure — headline-tester-style divide-y list */}
                  <div className="divide-y divide-[var(--border)]">
                    {brief.articleStructure.map((s, i) => (
                      <div key={i} className="p-4 flex gap-4 hover:bg-[var(--surface-2)] transition-colors">
                        <div className="flex-shrink-0 w-10 h-10 rounded-full bg-[var(--accent-10)] text-[var(--accent)] border border-[var(--accent-30)] flex items-center justify-center font-mono font-bold text-sm">
                          {i + 1}
                        </div>
                        <div className="pt-0.5 min-w-0">
                          <p className="text-sm font-semibold text-[var(--text-primary)] leading-snug mb-1">{s.h2}</p>
                          {s.h3s.map((h, j) => (
                            <p key={j} className="text-xs text-[var(--text-secondary)]">↳ {h}</p>
                          ))}
                        </div>
                      </div>
                    ))}
                  </div>

                  {/* Footer: CTAs + commissioning note */}
                  {(brief.affiliateCTAs.length > 0 || brief.commissioningNote) && (
                    <div className="p-4 border-t border-[var(--border)] bg-[var(--bg-secondary)]">
                      {brief.affiliateCTAs.length > 0 && (
                        <div className="mb-3">
                          <p className="text-[10px] font-bold uppercase tracking-wider text-[var(--text-muted)] mb-2">Affiliate CTAs</p>
                          <div className="flex flex-wrap gap-2">
                            {brief.affiliateCTAs.map((cta, i) => (
                              <span key={i} className="text-xs px-2 py-1 rounded-md bg-[var(--surface-2)] border border-[var(--border)] text-[var(--text-secondary)]">{cta}</span>
                            ))}
                          </div>
                        </div>
                      )}
                      {brief.commissioningNote && (
                        <div>
                          <p className="text-[10px] font-bold uppercase tracking-wider text-[var(--text-muted)] mb-1">Commissioning note</p>
                          <p className="text-xs text-[var(--text-secondary)] leading-relaxed">{brief.commissioningNote}</p>
                        </div>
                      )}
                    </div>
                  )}
                  <p className="text-xs text-[var(--text-muted)] px-4 py-3 italic border-t border-[var(--border)]">
                    AI-generated first draft. Verify prices, claims, and product details before publishing.
                  </p>
                </div>
              )}
            </div>
          )}

          {/* Comparison Page */}
          {tab === 'comparison' && (
            <div>
              {!compHtml && (
                <div className="flex flex-col gap-3">
                  <div className="flex gap-3 items-center">
                    <input
                      type="text"
                      value={product1}
                      onChange={(e) => setProduct1(e.target.value)}
                      placeholder="Product 1"
                      disabled={compLoading}
                      className="flex-1 px-3 py-2 rounded-lg bg-[var(--surface)] border border-[var(--border)] text-[var(--text-primary)] placeholder-[var(--text-muted)] text-sm focus:outline-none focus:border-[var(--accent)] transition-colors disabled:opacity-50"
                    />
                    <span className="text-[var(--text-muted)] text-sm font-mono flex-shrink-0">vs</span>
                    <input
                      type="text"
                      value={product2}
                      onChange={(e) => setProduct2(e.target.value)}
                      placeholder="Product 2"
                      disabled={compLoading}
                      className="flex-1 px-3 py-2 rounded-lg bg-[var(--surface)] border border-[var(--border)] text-[var(--text-primary)] placeholder-[var(--text-muted)] text-sm focus:outline-none focus:border-[var(--accent)] transition-colors disabled:opacity-50"
                    />
                  </div>
                  <button
                    type="button"
                    onClick={generateComparison}
                    disabled={compLoading || !product1.trim() || !product2.trim()}
                    className="self-start px-4 py-2 rounded-lg bg-[var(--accent)] text-white font-semibold text-xs hover:bg-[var(--accent-hover)] transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
                  >
                    {compLoading ? 'Generating…' : 'Generate'}
                  </button>
                </div>
              )}
              {compError && <p className="text-red-400 text-xs mt-2">{compError}</p>}
              {compHtml && (
                <div className="rounded-lg border border-[var(--border)] bg-[var(--surface)] overflow-hidden shadow-glass">
                  <div className="bg-[var(--surface-2)] px-4 py-3 border-b border-[var(--border)] flex items-center justify-between">
                    <div className="flex gap-2">
                      <div className="w-3 h-3 rounded-full bg-[var(--error)] opacity-60" />
                      <div className="w-3 h-3 rounded-full bg-[var(--warning)] opacity-60" />
                      <div className="w-3 h-3 rounded-full bg-[var(--success)] opacity-60" />
                    </div>
                    <CopyButton text={compHtml} label="Copy HTML" />
                  </div>
                  <div
                    className="p-8 max-h-[60vh] overflow-y-auto bg-white text-[#111111] text-[15px] leading-relaxed [&_h1]:text-[28px] [&_h1]:font-bold [&_h1]:mb-6 [&_h1]:leading-tight [&_h2]:text-[22px] [&_h2]:font-bold [&_h2]:mt-8 [&_h2]:mb-4 [&_h3]:text-[18px] [&_h3]:font-semibold [&_h3]:mt-6 [&_h3]:mb-3 [&_p]:mb-5 [&_ul]:list-disc [&_ul]:pl-5 [&_ul]:mb-5 [&_li]:mb-2 [&_table]:w-full [&_table]:border-collapse [&_table]:mb-8 [&_th]:border-b [&_th]:border-gray-300 [&_th]:py-3 [&_th]:text-left [&_th]:font-semibold [&_td]:border-b [&_td]:border-gray-200 [&_td]:py-3 [&_strong]:font-semibold"
                    // biome-ignore lint/security/noDangerouslySetInnerHtml: trusted Gemini output rendered for preview
                    dangerouslySetInnerHTML={{ __html: compHtml }}
                  />
                </div>
              )}
              {compHtml && (
                <p className="text-xs text-[var(--text-muted)] mt-3 italic">
                  AI-generated first draft. Verify prices, claims, and product details before publishing.
                </p>
              )}
            </div>
          )}

        </div>
      </td>
    </tr>
  )
}

// ─── Main page ─────────────────────────────────────────────────────────────

interface Props {
  params: { id: string }
}

export default function ReportPage({ params }: Props) {
  const reportId = params.id
  const [report, setReport] = useState<Report | null>(null)
  const [matrix, setMatrix] = useState<PresenceResult[] | null>(null)
  const [seoPages, setSeoPages] = useState<SeoPage[] | null>(null)
  const [monetisation, setMonetisation] = useState<MonetisationRow[] | null>(null)
  const [cro, setCro] = useState<CRORow[] | null>(null)
  const [notFound, setNotFound] = useState(false)
  const [openRow, setOpenRow] = useState<string | null>(null)

  // Poll report status
  useEffect(() => {
    if (!reportId) return
    let stopped = false

    async function poll() {
      while (!stopped) {
        try {
          const res = await fetch(`/api/reports/${reportId}/status`)
          if (res.status === 404) { setNotFound(true); return }
          const data: Report = await res.json()
          setReport(data)
          if (data.status === 'done' || data.status === 'failed') return
        } catch { /* keep polling */ }
        await new Promise((r) => setTimeout(r, 2000))
      }
    }

    poll()
    return () => { stopped = true }
  }, [reportId])

  // Fetch matrix once presence is done
  useEffect(() => {
    if (!reportId || report?.presence_status !== 'done') return
    fetch(`/api/reports/${reportId}/matrix`)
      .then((r) => r.json())
      .then((data) => { if (Array.isArray(data)) setMatrix(sortMatrix(data)) })
      .catch(console.error)
  }, [reportId, report?.presence_status])

  // Fetch SEO pages once done
  useEffect(() => {
    if (!reportId || report?.seo_status !== 'done') return
    fetch(`/api/reports/${reportId}/seo`)
      .then((r) => r.json())
      .then((data) => { if (Array.isArray(data)) setSeoPages(data) })
      .catch(console.error)
  }, [reportId, report?.seo_status])

  // Fetch monetisation once done
  useEffect(() => {
    if (!reportId || report?.monetisation_status !== 'done') return
    fetch(`/api/reports/${reportId}/monetisation`)
      .then((r) => r.json())
      .then((data) => { if (Array.isArray(data)) setMonetisation(data) })
      .catch(console.error)
  }, [reportId, report?.monetisation_status])

  // Fetch CRO once done
  useEffect(() => {
    if (!reportId || report?.cro_status !== 'done') return
    fetch(`/api/reports/${reportId}/cro`)
      .then((r) => r.json())
      .then((data) => { if (Array.isArray(data)) setCro(data) })
      .catch(console.error)
  }, [reportId, report?.cro_status])

  if (notFound) {
    return <div className="p-8"><p className="text-red-400">Report not found.</p></div>
  }

  if (!report) {
    return <div className="p-8"><p className="text-[var(--text-secondary)] text-sm animate-pulse">Loading report…</p></div>
  }

  if (report.status === 'failed') {
    return (
      <div className="p-8 max-w-xl mx-auto">
        <div className="rounded-xl border border-red-500/20 bg-red-500/5 p-6">
          <h1 className="text-xl font-semibold mb-2 text-red-400">Analysis failed</h1>
          <p className="text-[var(--text-secondary)] text-sm mb-4">
            The site may be blocking automated requests, or a required API was unavailable.
          </p>
          <p className="text-xs text-[var(--text-muted)]">Target: {report.target_url}</p>
        </div>
      </div>
    )
  }

  const targetDomain = report.target_url.replace(/^https?:\/\/(www\.)?/, '').replace(/\/$/, '')
  const c1Domain = report.competitor_urls[0]?.replace(/^https?:\/\//, '').replace(/\/$/, '') ?? null
  const c2Domain = report.competitor_urls[1]?.replace(/^https?:\/\//, '').replace(/\/$/, '') ?? null
  const isRunning = report.status === 'running' || report.status === 'queued'
  const colSpan = 5 + (c1Domain ? 1 : 0) + (c2Domain ? 1 : 0)
  const sortedCro = cro ? [...cro].sort((a, b) => (a.passed ? 1 : 0) - (b.passed ? 1 : 0)) : null

  return (
    <div className="p-8 max-w-6xl mx-auto">
      {/* Header */}
      <div className="mb-6">
        <Link href="/history" className="inline-flex items-center gap-1 text-xs text-[var(--text-secondary)] hover:text-[var(--text-primary)] mb-3 transition-colors">
          <ArrowLeft className="h-3 w-3" />
          History
        </Link>
        <h1 className="text-2xl font-bold text-[var(--navy)] mb-2">{targetDomain}</h1>
        <div className="flex items-center gap-2 flex-wrap">
          {report.topic && (
            <span className="px-2 py-0.5 rounded-full bg-[var(--accent-10)] text-[var(--accent)] text-xs font-medium border border-[var(--accent-30)]">
              {report.topic}
            </span>
          )}
          {c1Domain && <span className="text-xs text-[var(--text-muted)]">vs {c1Domain}</span>}
          {c2Domain && <span className="text-xs text-[var(--text-muted)]">· {c2Domain}</span>}
        </div>
      </div>

      {/* Agent trace */}
      <div className="rounded-xl border border-[var(--border)] bg-[var(--surface)] p-4 mb-6">
        <div className="flex flex-wrap gap-x-8 gap-y-2">
          <TraceItem status={report.seo_status} label="SEO crawl" />
          <TraceItem status={report.presence_status} label="Presence check (12 queries)" />
          <TraceItem status={report.monetisation_status} label="Monetisation mapping" />
          <TraceItem status={report.cro_status} label="CRO analysis" />
        </div>
        {isRunning && (
          <p className="text-xs text-[var(--text-muted)] mt-3">Agents running — results stream in as each completes</p>
        )}
      </div>

      {/* Opportunity score */}
      {report.opportunity_score != null && (
        <div className="mb-8 w-full flex items-center gap-6 px-6 py-5 rounded-xl border border-[var(--border)] bg-[var(--surface)]">
          <span className="text-6xl font-black font-mono text-[var(--accent)] leading-none flex-shrink-0">
            {report.opportunity_score}%
          </span>
          <div className="flex-1 min-w-0">
            <p className="text-sm font-semibold text-[var(--navy)] mb-1">Competitive Gap Score</p>
            <p className="text-xs text-[var(--text-secondary)] mb-3 max-w-sm">
              % of commercial queries where competitors appear in results and you don&apos;t
            </p>
            <div className="w-full bg-[var(--border)] rounded-full h-1.5 mt-3">
              <div className="bg-[var(--accent)] h-1.5 rounded-full transition-all" style={{ width: `${report.opportunity_score}%` }} />
            </div>
          </div>
        </div>
      )}

      {/* Quick wins */}
      {matrix && <QuickWins matrix={matrix} reportId={report.id} c1Domain={c1Domain} c2Domain={c2Domain} onOpen={setOpenRow} />}

      {/* Presence matrix */}
      <section>
        <h2 className="text-xs font-semibold uppercase tracking-widest text-[var(--text-secondary)] mb-4">
          Presence Matrix
        </h2>

        {(report.presence_status === 'pending' || report.presence_status === 'running') && (
          <div className="overflow-x-auto">
            <table className="w-full text-sm border-collapse">
              <tbody>{[...Array(6)].map((_, i) => <SkeletonRow key={i} />)}</tbody>
            </table>
          </div>
        )}

        {report.presence_status === 'failed' && (
          <div className="rounded-lg border border-amber-500/20 bg-amber-500/5 px-4 py-3">
            <p className="text-amber-400 text-sm">Keyword presence check failed — SEO results still available above.</p>
          </div>
        )}

        {matrix && matrix.length > 0 && (
          <div className="overflow-x-auto bg-[var(--surface)] border border-[var(--border)] rounded-xl overflow-hidden">
            <table className="w-full text-sm border-collapse">
              <thead className="sticky top-0 bg-[var(--surface-2)] z-10">
                <tr>
                  <th className="px-4 py-3 text-left text-xs font-semibold text-[var(--navy)] uppercase tracking-wider border-b border-[var(--border)]">Keyword</th>
                  <th className="px-4 py-3 text-left text-xs font-semibold text-[var(--navy)] uppercase tracking-wider border-b border-[var(--border)]">Intent</th>
                  <th className="px-4 py-3 text-left text-xs font-semibold text-[var(--navy)] uppercase tracking-wider border-b border-[var(--border)] truncate max-w-[120px]">{targetDomain}</th>
                  {c1Domain && <th className="px-4 py-3 text-left text-xs font-semibold text-[var(--navy)] uppercase tracking-wider border-b border-[var(--border)] truncate max-w-[120px]">{c1Domain}</th>}
                  {c2Domain && <th className="px-4 py-3 text-left text-xs font-semibold text-[var(--navy)] uppercase tracking-wider border-b border-[var(--border)] truncate max-w-[120px]">{c2Domain}</th>}
                  <th className="px-4 py-3 text-left text-xs font-semibold text-[var(--navy)] uppercase tracking-wider border-b border-[var(--border)]">Commercial Priority</th>
                  <th className="px-4 py-3 border-b border-[var(--border)]"><span className="sr-only">Action</span></th>
                </tr>
              </thead>
              <tbody>
                {matrix.map((row) => {
                  const isGap = !row.target_present && (row.competitor1_present || row.competitor2_present)
                  const isCovered = row.target_present
                  const isNoSignal = !row.target_present && !row.competitor1_present && !row.competitor2_present
                  const isOpen = openRow === row.keyword
                  return (
                    <Fragment key={row.id || row.keyword}>
                      <tr className={`border-b border-[var(--border)] hover:bg-[var(--surface-2)] transition-colors ${isGap ? 'bg-[var(--missing-light)]' : ''}`}>
                        <td className={`py-4 pr-3 font-mono text-xs text-[var(--text-primary)] max-w-[200px] ${isGap ? 'pl-3.5 border-l-2 border-l-[var(--missing)]' : isCovered ? 'pl-3.5 border-l-2 border-l-[var(--present)]' : 'pl-4'}`}>
                          <span title={row.keyword} className="block truncate">{row.keyword}</span>
                        </td>
                        <td className="px-4 py-4">
                          <IntentBadge intent={row.intent} />
                        </td>
                        <td className="px-4 py-4 text-center">
                          <PresenceCell present={row.target_present} />
                        </td>
                        {c1Domain && (
                          <td className="px-4 py-4 text-center">
                            <PresenceCell present={row.competitor1_present} />
                          </td>
                        )}
                        {c2Domain && (
                          <td className="px-4 py-4 text-center">
                            <PresenceCell present={row.competitor2_present} />
                          </td>
                        )}
                        <td className="px-4 py-4">
                          {isGap ? (
                            <PriorityLabel level={row.revenue_potential} />
                          ) : isCovered ? (
                            <span className="text-[var(--present)] font-semibold text-xs">Covered</span>
                          ) : isNoSignal ? (
                            <span className="text-[var(--text-muted)] text-xs">No signal</span>
                          ) : null}
                        </td>
                        <td className="px-4 py-4">
                          {isGap && (
                            <button
                              type="button"
                              onClick={() => setOpenRow(isOpen ? null : row.keyword)}
                              className="px-3 py-1.5 bg-[var(--accent)] text-white text-xs font-medium rounded-lg hover:bg-[var(--accent-hover)] transition-colors whitespace-nowrap"
                            >
                              {isOpen ? 'Close ↑' : 'Generate →'}
                            </button>
                          )}
                        </td>
                      </tr>
                      {isGap && isOpen && (
                        <GeneratePanel
                          keyword={row.keyword}
                          reportId={report.id}
                          colSpan={colSpan}
                        />
                      )}
                    </Fragment>
                  )
                })}
              </tbody>
            </table>
          </div>
        )}

        {matrix && matrix.length === 0 && !isRunning && (
          <p className="text-[var(--text-secondary)] text-sm">No presence data found.</p>
        )}
      </section>

      {/* SEO Audit */}
      <section className="mt-10">
        <h2 className="text-xs font-semibold uppercase tracking-widest text-[var(--text-secondary)] mb-4">
          SEO Audit
        </h2>

        {(report.seo_status === 'pending' || report.seo_status === 'running') && (
          <div className="bg-[var(--surface)] border border-[var(--border)] rounded-lg overflow-hidden">
            {[...Array(2)].map((_, i) => (
              <div key={i} className={`p-5 flex gap-5 ${i > 0 ? 'border-t border-[var(--border)]' : ''}`}>
                <div className="animate-pulse w-12 h-12 rounded-full bg-[var(--surface-2)] flex-shrink-0" />
                <div className="flex-1 flex flex-col gap-2 justify-center">
                  <div className="animate-pulse h-3 bg-[var(--surface-2)] rounded w-2/3" />
                  <div className="animate-pulse h-2 bg-[var(--surface-2)] rounded w-1/3" />
                </div>
              </div>
            ))}
          </div>
        )}

        {report.seo_status === 'failed' && (
          <p className="text-[var(--text-secondary)] text-sm">SEO audit failed — site may be blocking automated requests.</p>
        )}

        {seoPages && seoPages.length > 0 && (
          <div className="bg-[var(--surface)] border border-[var(--border)] rounded-lg overflow-hidden">
            {seoPages.map((page, i) => {
              const scoreCls = page.seo_score >= 80
                ? 'bg-green-500/15 text-green-400 border-green-500/30'
                : page.seo_score >= 50
                  ? 'bg-amber-500/15 text-amber-400 border-amber-500/30'
                  : 'bg-red-500/15 text-red-400 border-red-500/30'
              return (
                <div key={page.id} className={`p-5 flex gap-5 hover:bg-[var(--surface-2)] transition-colors ${i > 0 ? 'border-t border-[var(--border)]' : ''}`}>
                  <div className={`flex-shrink-0 w-12 h-12 rounded-full border flex items-center justify-center font-mono font-bold text-sm ${scoreCls}`}>
                    {page.seo_score}
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="text-xs font-mono text-[var(--text-primary)] truncate mb-0.5" title={page.url}>
                      {page.url.replace(/^https?:\/\//, '')}
                    </p>
                    {page.title && (
                      <p className="text-xs text-[var(--text-secondary)] truncate mb-2" title={page.title}>{page.title}</p>
                    )}
                    <div className="flex items-center gap-3 text-xs text-[var(--text-muted)] mb-2">
                      <span>{page.word_count.toLocaleString()} words</span>
                      <span>{page.load_time_ms}ms</span>
                    </div>
                    {Array.isArray(page.issues) && page.issues.length > 0 && (
                      <div className="flex flex-col gap-0.5">
                        {page.issues.map((issue, j) => (
                          <p key={j} className="text-xs text-red-400 leading-snug">· {issue}</p>
                        ))}
                      </div>
                    )}
                  </div>
                </div>
              )
            })}
          </div>
        )}
      </section>

      {/* Monetisation */}
      <section className="mt-10">
        <h2 className="text-xs font-semibold uppercase tracking-widest text-[var(--text-secondary)] mb-4">
          Monetisation Opportunities
        </h2>

        {(report.monetisation_status === 'pending' || report.monetisation_status === 'running') && (
          <div className="bg-[var(--surface)] border border-[var(--border)] rounded-lg overflow-hidden">
            {[...Array(2)].map((_, i) => (
              <div key={i} className={`p-5 flex gap-5 ${i > 0 ? 'border-t border-[var(--border)]' : ''}`}>
                <div className="animate-pulse w-10 h-10 rounded-full bg-[var(--surface-2)] flex-shrink-0" />
                <div className="flex-1 flex flex-col gap-2 justify-center">
                  <div className="animate-pulse h-3 bg-[var(--surface-2)] rounded w-1/2" />
                  <div className="animate-pulse h-2 bg-[var(--surface-2)] rounded w-1/4" />
                </div>
              </div>
            ))}
          </div>
        )}

        {report.monetisation_status === 'failed' && (
          <p className="text-[var(--text-secondary)] text-sm">Monetisation analysis unavailable.</p>
        )}

        {monetisation && monetisation.length > 0 && (
          <div className="bg-[var(--surface)] border border-[var(--border)] rounded-lg overflow-hidden">
            {monetisation.map((m, i) => {
              const priorityCls = m.priority === 'high'
                ? 'bg-green-500/15 text-green-400 border-green-500/30'
                : m.priority === 'medium'
                  ? 'bg-amber-500/15 text-amber-400 border-amber-500/30'
                  : 'bg-[var(--surface-2)] text-[var(--text-muted)] border-[var(--border)]'
              const priorityLabel = m.priority === 'high' ? '$$$' : m.priority === 'medium' ? '$$' : '$'
              return (
                <div key={m.id} className={`p-5 flex gap-5 hover:bg-[var(--surface-2)] transition-colors ${i > 0 ? 'border-t border-[var(--border)]' : ''}`}>
                  <div className={`flex-shrink-0 w-10 h-10 rounded-full border flex items-center justify-center font-mono font-bold text-xs ${priorityCls}`}>
                    {priorityLabel}
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2 mb-1 flex-wrap">
                      <span className="text-sm font-semibold text-[var(--text-primary)]">{m.category}</span>
                      {m.cta_missing_pages.length > 0 && (
                        <span className="text-[10px] font-bold uppercase px-1.5 py-0.5 rounded bg-amber-500/20 text-amber-400 border border-amber-500/30">
                          Quick win
                        </span>
                      )}
                    </div>
                    <p className="text-xs text-[var(--accent)] font-mono mb-2">{m.commission_rate}</p>
                    <div className="flex flex-wrap gap-1.5">
                      {m.programmes.map((p, j) => (
                        <span key={j} className="text-xs px-2 py-0.5 rounded-md bg-[var(--surface-2)] border border-[var(--border)] text-[var(--text-secondary)]">{p}</span>
                      ))}
                    </div>
                  </div>
                </div>
              )
            })}
          </div>
        )}

        {monetisation && monetisation.length === 0 && report.monetisation_status === 'done' && (
          <p className="text-[var(--text-secondary)] text-sm">No affiliate opportunities identified.</p>
        )}
      </section>

      {/* CRO */}
      <section className="mt-10 mb-10">
        <h2 className="text-xs font-semibold uppercase tracking-widest text-[var(--text-secondary)] mb-4">
          CRO Analysis
        </h2>

        {(report.cro_status === 'pending' || report.cro_status === 'running') && (
          <div className="bg-[var(--surface)] border border-[var(--border)] rounded-lg overflow-hidden">
            {[...Array(5)].map((_, i) => (
              <div key={i} className={`p-4 flex gap-3 ${i > 0 ? 'border-t border-[var(--border)]' : ''}`}>
                <div className="animate-pulse w-8 h-8 rounded-full bg-[var(--surface-2)] flex-shrink-0" />
                <div className="flex-1 flex flex-col gap-2 justify-center">
                  <div className="animate-pulse h-2 bg-[var(--surface-2)] rounded w-1/4" />
                  <div className="animate-pulse h-3 bg-[var(--surface-2)] rounded w-3/4" />
                </div>
              </div>
            ))}
          </div>
        )}

        {report.cro_status === 'failed' && (
          <p className="text-[var(--text-secondary)] text-sm">CRO analysis unavailable.</p>
        )}

        {sortedCro && sortedCro.length > 0 && (
          <div className="bg-[var(--surface)] border border-[var(--border)] rounded-lg overflow-hidden">
            {sortedCro.map((c, i) => (
              <div key={c.id} className={`flex items-start gap-3 px-4 py-4 hover:bg-[var(--surface-2)] transition-colors ${i > 0 ? 'border-t border-[var(--border)]' : ''}`}>
                <div className={`flex-shrink-0 w-8 h-8 rounded-full border flex items-center justify-center text-xs font-bold ${c.passed ? 'bg-green-500/15 text-green-400 border-green-500/30' : 'bg-red-500/15 text-red-400 border-red-500/30'}`}>
                  {c.passed ? '✓' : '✕'}
                </div>
                <div className="pt-0.5">
                  <p className="text-xs font-mono text-[var(--text-muted)] mb-0.5">{c.factor}</p>
                  <p className={`text-sm ${c.passed ? 'text-[var(--text-primary)]' : 'text-[var(--text-secondary)]'}`}>{c.recommendation}</p>
                </div>
              </div>
            ))}
          </div>
        )}
      </section>
    </div>
  )
}
