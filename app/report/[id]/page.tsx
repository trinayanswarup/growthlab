'use client'

import { Fragment, useEffect, useState } from 'react'
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

const INTENT_STYLE: Record<string, string> = {
  commercial:    'bg-amber-500/15 text-amber-400 border-amber-500/30',
  transactional: 'bg-green-500/15 text-green-400 border-green-500/30',
  informational: 'bg-blue-500/15 text-blue-400 border-blue-500/30',
}

const REVENUE_LABEL: Record<string, string> = { high: '$$$', medium: '$$', low: '$' }
const REVENUE_STYLE: Record<string, string> = {
  high:   'text-green-400',
  medium: 'text-yellow-400',
  low:    'text-[#8b8b8b]',
}

// ─── Sub-components ────────────────────────────────────────────────────────

function TraceItem({ status, label }: { status: AgentStatus; label: string }) {
  const config = {
    done:    { icon: '✓', cls: 'text-green-400' },
    running: { icon: '◌', cls: 'text-amber-400 animate-pulse' },
    failed:  { icon: '✕', cls: 'text-red-400' },
    pending: { icon: '○', cls: 'text-[#4b4b4b]' },
  }[status]

  return (
    <div className={`flex items-center gap-2 text-sm font-mono ${config.cls}`}>
      <span className="w-4 text-center">{config.icon}</span>
      <span>{label}</span>
    </div>
  )
}

function PresenceCell({ present }: { present: boolean }) {
  return present
    ? <span className="text-green-400 font-bold">✓</span>
    : <span className="text-red-400">✕</span>
}

function QuickWins({ matrix, onOpen }: { matrix: PresenceResult[]; reportId: string; onOpen: (kw: string) => void }) {
  const wins = matrix
    .filter((r) => !r.target_present && (r.competitor1_present || r.competitor2_present) && r.intent !== 'informational')
    .sort((a, b) => (REVENUE_ORDER[a.revenue_potential] ?? 1) - (REVENUE_ORDER[b.revenue_potential] ?? 1))
    .slice(0, 3)

  if (wins.length === 0) return null

  return (
    <div className="mb-8">
      <h2 className="text-xs font-semibold uppercase tracking-widest text-[#8b8b8b] mb-3">
        Quick Wins
      </h2>
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
        {wins.map((r) => (
          <div key={r.id || r.keyword} className="rounded-xl border border-[#222222] bg-[#111111] p-4 hover:border-[#ff6363]/30 transition-colors">
            <p className="text-sm text-[#ededed] font-mono mb-3 leading-snug">{r.keyword}</p>
            <div className="flex items-center gap-2 mb-4">
              <span className={`text-xs px-2 py-0.5 rounded-full border capitalize ${INTENT_STYLE[r.intent]}`}>
                {r.intent}
              </span>
              <span className={`text-xs font-mono font-bold ${REVENUE_STYLE[r.revenue_potential]}`}>
                {REVENUE_LABEL[r.revenue_potential]}
              </span>
            </div>
            <button
              type="button"
              onClick={() => onOpen(r.keyword)}
              className="text-xs text-[#ff6363] hover:underline"
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
    <tr className="animate-pulse border-t border-[#222222]">
      {[...Array(7)].map((_, i) => (
        <td key={i} className="py-3 px-3">
          <div className="h-3 bg-[#1a1a1a] rounded w-full" />
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

  function copyMarkdown() {
    if (!brief) return
    const lines = [
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
    ]
    navigator.clipboard.writeText(lines.join('\n')).catch(() => {})
  }

  return (
    <tr>
      <td colSpan={colSpan} className="p-0 border-t border-[#222222]">
        <div className="bg-[#0a0a0a] border-b border-[#222222] px-4 py-4">

          {/* Panel tab bar */}
          <div className="flex gap-1 mb-4 border-b border-[#222222]">
            {(['brief', 'comparison'] as PanelTab[]).map((t) => (
              <button
                key={t}
                type="button"
                onClick={() => setTab(t)}
                className={`px-3 py-1.5 text-xs transition-colors border-b-2 -mb-px ${
                  tab === t ? 'text-[#ff6363] border-[#ff6363]' : 'text-[#8b8b8b] border-transparent hover:text-[#ededed]'
                }`}
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
                  className="px-4 py-2 rounded-lg bg-[#ff6363] text-[#0a0a0a] font-semibold text-xs hover:bg-[#ff4444] transition-colors"
                >
                  Generate Brief
                </button>
              )}
              {briefLoading && (
                <p className="text-[#8b8b8b] text-sm animate-pulse">Generating brief…</p>
              )}
              {briefError && <p className="text-red-400 text-xs mt-2">{briefError}</p>}
              {brief && (
                <div>
                  <div className="flex items-center justify-between mb-4">
                    <p className="text-xs text-[#4b4b4b]">Brief ready</p>
                    <button
                      type="button"
                      onClick={copyMarkdown}
                      className="px-3 py-1.5 rounded-lg text-xs bg-[#1a1a1a] border border-[#222222] text-[#8b8b8b] hover:text-[#ededed] transition-colors"
                    >
                      Copy as Markdown
                    </button>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 mb-4">
                    <div className="rounded-xl border border-[#222222] bg-[#111111] p-3">
                      <p className="text-xs text-[#8b8b8b] mb-1">Title tag</p>
                      <p className="text-xs text-[#ededed] font-mono leading-snug">{brief.titleTag}</p>
                    </div>
                    <div className="rounded-xl border border-[#222222] bg-[#111111] p-3">
                      <p className="text-xs text-[#8b8b8b] mb-1">Meta description</p>
                      <p className="text-xs text-[#b0b0b0] leading-snug">{brief.metaDescription}</p>
                    </div>
                  </div>

                  <p className="text-xs text-[#8b8b8b] mb-4">
                    Recommended word count: <span className="text-[#ff6363] font-mono">{brief.wordCountRecommendation.toLocaleString()}</span>
                  </p>

                  <div className="mb-4">
                    <p className="text-xs text-[#8b8b8b] mb-2 uppercase tracking-wider">Article Structure</p>
                    <div className="flex flex-col gap-2">
                      {brief.articleStructure.map((s, i) => (
                        <div key={i}>
                          <p className="text-xs font-semibold text-[#ededed]">{s.h2}</p>
                          {s.h3s.map((h, j) => (
                            <p key={j} className="text-xs text-[#8b8b8b] pl-3">↳ {h}</p>
                          ))}
                        </div>
                      ))}
                    </div>
                  </div>

                  {brief.affiliateCTAs.length > 0 && (
                    <div className="mb-4">
                      <p className="text-xs text-[#8b8b8b] mb-2 uppercase tracking-wider">Affiliate CTAs</p>
                      <div className="flex flex-wrap gap-2">
                        {brief.affiliateCTAs.map((cta, i) => (
                          <span key={i} className="text-xs px-2 py-1 rounded-lg bg-[#1a1a1a] border border-[#222222] text-[#b0b0b0]">{cta}</span>
                        ))}
                      </div>
                    </div>
                  )}

                  {brief.commissioningNote && (
                    <p className="text-xs text-[#4b4b4b] border-t border-[#222222] pt-3 mt-2">
                      Note: <span className="text-[#8b8b8b]">{brief.commissioningNote}</span>
                    </p>
                  )}
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
                      className="flex-1 px-3 py-2 rounded-lg bg-[#111111] border border-[#222222] text-[#ededed] placeholder-[#4b4b4b] text-sm focus:outline-none focus:border-[#ff6363] transition-colors disabled:opacity-50"
                    />
                    <span className="text-[#4b4b4b] text-sm font-mono flex-shrink-0">vs</span>
                    <input
                      type="text"
                      value={product2}
                      onChange={(e) => setProduct2(e.target.value)}
                      placeholder="Product 2"
                      disabled={compLoading}
                      className="flex-1 px-3 py-2 rounded-lg bg-[#111111] border border-[#222222] text-[#ededed] placeholder-[#4b4b4b] text-sm focus:outline-none focus:border-[#ff6363] transition-colors disabled:opacity-50"
                    />
                  </div>
                  <button
                    type="button"
                    onClick={generateComparison}
                    disabled={compLoading || !product1.trim() || !product2.trim()}
                    className="self-start px-4 py-2 rounded-lg bg-[#ff6363] text-[#0a0a0a] font-semibold text-xs hover:bg-[#ff4444] transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
                  >
                    {compLoading ? 'Generating…' : 'Generate'}
                  </button>
                </div>
              )}
              {compError && <p className="text-red-400 text-xs mt-2">{compError}</p>}
              {compHtml && (
                <div>
                  <div className="flex items-center justify-between mb-3">
                    <p className="text-xs text-[#4b4b4b]">Preview</p>
                    <button
                      type="button"
                      onClick={() => navigator.clipboard.writeText(compHtml).catch(() => {})}
                      className="px-3 py-1.5 rounded-lg text-xs bg-[#1a1a1a] border border-[#222222] text-[#8b8b8b] hover:text-[#ededed] transition-colors"
                    >
                      Copy HTML
                    </button>
                  </div>
                  <div
                    className="rounded-xl border border-[#222222] bg-white text-[#111111] p-6 max-h-[60vh] overflow-y-auto"
                    // biome-ignore lint/security/noDangerouslySetInnerHtml: trusted Gemini output rendered for preview
                    dangerouslySetInnerHTML={{ __html: compHtml }}
                  />
                </div>
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
    return <div className="p-8"><p className="text-[#8b8b8b] text-sm animate-pulse">Loading report…</p></div>
  }

  if (report.status === 'failed') {
    return (
      <div className="p-8 max-w-xl mx-auto">
        <div className="rounded-2xl border border-red-500/20 bg-red-500/5 p-6">
          <h1 className="text-xl font-semibold mb-2 text-red-400">Analysis failed</h1>
          <p className="text-[#8b8b8b] text-sm mb-4">
            The site may be blocking automated requests, or a required API was unavailable.
          </p>
          <p className="text-xs text-[#4b4b4b]">Target: {report.target_url}</p>
        </div>
      </div>
    )
  }

  const targetDomain = report.target_url.replace(/^https?:\/\//, '').replace(/\/$/, '')
  const c1Domain = report.competitor_urls[0]?.replace(/^https?:\/\//, '').replace(/\/$/, '') ?? null
  const c2Domain = report.competitor_urls[1]?.replace(/^https?:\/\//, '').replace(/\/$/, '') ?? null
  const isRunning = report.status === 'running' || report.status === 'queued'
  const colSpan = 5 + (c1Domain ? 1 : 0) + (c2Domain ? 1 : 0)

  return (
    <div className="px-6 py-10 max-w-5xl mx-auto">
      {/* Header */}
      <div className="mb-6">
        <h1 className="text-xl font-semibold truncate mb-1">{report.target_url}</h1>
        {report.topic && (
          <p className="text-sm text-[#8b8b8b]">Topic: <span className="text-[#ff6363]">{report.topic}</span></p>
        )}
      </div>

      {/* Agent trace */}
      <div className="rounded-2xl border border-[#222222] bg-[#111111] p-4 mb-6 flex flex-col gap-2">
        <TraceItem status={report.seo_status} label="SEO crawl" />
        <TraceItem status={report.presence_status} label="Presence check (12 queries)" />
        <TraceItem status={report.monetisation_status} label="Monetisation mapping" />
        <TraceItem status={report.cro_status} label="CRO analysis" />
      </div>

      {/* Opportunity score */}
      {report.opportunity_score != null && (
        <div className="mb-8 inline-flex items-center gap-4 px-5 py-4 rounded-2xl border border-[#222222] bg-[#111111]">
          <span className="text-5xl font-mono font-bold text-[#ff6363]">
            {report.opportunity_score}%
          </span>
          <div>
            <p className="text-sm font-medium text-[#ededed]">opportunity score</p>
            <p className="text-xs text-[#8b8b8b] mt-0.5 max-w-xs">
              % of commercial queries where competitors appear in results and you don&apos;t
            </p>
          </div>
        </div>
      )}

      {/* Quick wins */}
      {matrix && <QuickWins matrix={matrix} reportId={report.id} onOpen={setOpenRow} />}

      {/* Presence matrix */}
      <section>
        <h2 className="text-xs font-semibold uppercase tracking-widest text-[#8b8b8b] mb-4">
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
          <div className="rounded-xl border border-amber-500/20 bg-amber-500/5 px-4 py-3">
            <p className="text-amber-400 text-sm">Keyword presence check failed — SEO results still available above.</p>
          </div>
        )}

        {matrix && matrix.length > 0 && (
          <div className="overflow-x-auto rounded-2xl border border-[#222222]">
            <table className="w-full text-sm border-collapse">
              <thead>
                <tr className="text-left text-xs uppercase tracking-wider text-[#4b4b4b] bg-[#111111]">
                  <th className="py-3 pl-4 pr-3 font-medium">Keyword</th>
                  <th className="py-3 pr-3 font-medium">Intent</th>
                  <th className="py-3 pr-3 font-medium truncate max-w-[120px]">{targetDomain}</th>
                  {c1Domain && <th className="py-3 pr-3 font-medium truncate max-w-[120px]">{c1Domain}</th>}
                  {c2Domain && <th className="py-3 pr-3 font-medium truncate max-w-[120px]">{c2Domain}</th>}
                  <th className="py-3 pr-3 font-medium">Revenue</th>
                  <th className="py-3 pr-4 font-medium"><span className="sr-only">Action</span></th>
                </tr>
              </thead>
              <tbody>
                {matrix.map((row) => {
                  const isGap = !row.target_present && (row.competitor1_present || row.competitor2_present)
                  const isOpen = openRow === row.keyword
                  return (
                    <Fragment key={row.id || row.keyword}>
                      <tr
                        className={`border-t border-[#222222] ${isGap ? 'bg-[#ff6363]/5' : ''}`}
                      >
                        <td className="py-3 pl-4 pr-3 font-mono text-xs text-[#ededed] max-w-[200px]">
                          <span title={row.keyword} className="block truncate">{row.keyword}</span>
                        </td>
                        <td className="py-3 pr-3">
                          <span className={`inline-flex items-center px-2 py-0.5 rounded-full border text-xs capitalize ${INTENT_STYLE[row.intent]}`}>
                            {row.intent}
                          </span>
                        </td>
                        <td className="py-3 pr-3 text-center">
                          <PresenceCell present={row.target_present} />
                        </td>
                        {c1Domain && (
                          <td className="py-3 pr-3 text-center">
                            <PresenceCell present={row.competitor1_present} />
                          </td>
                        )}
                        {c2Domain && (
                          <td className="py-3 pr-3 text-center">
                            <PresenceCell present={row.competitor2_present} />
                          </td>
                        )}
                        <td className={`py-3 pr-3 text-xs font-mono font-bold ${REVENUE_STYLE[row.revenue_potential]}`}>
                          {REVENUE_LABEL[row.revenue_potential]}
                        </td>
                        <td className="py-3 pr-4">
                          {isGap && (
                            <button
                              type="button"
                              onClick={() => setOpenRow(isOpen ? null : row.keyword)}
                              className="text-xs text-[#ff6363] hover:underline whitespace-nowrap"
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
          <p className="text-[#8b8b8b] text-sm">No presence data found.</p>
        )}
      </section>

      {/* SEO Audit */}
      <section className="mt-10">
        <h2 className="text-xs font-semibold uppercase tracking-widest text-[#8b8b8b] mb-4">
          SEO Audit
        </h2>

        {(report.seo_status === 'pending' || report.seo_status === 'running') && (
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            {[...Array(2)].map((_, i) => (
              <div key={i} className="animate-pulse rounded-2xl border border-[#222222] bg-[#111111] p-4 h-28" />
            ))}
          </div>
        )}

        {report.seo_status === 'failed' && (
          <p className="text-[#8b8b8b] text-sm">SEO audit failed — site may be blocking automated requests.</p>
        )}

        {seoPages && seoPages.length > 0 && (
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            {seoPages.map((page) => {
              const scoreCls = page.seo_score >= 80
                ? 'bg-green-500/15 text-green-400 border-green-500/30'
                : page.seo_score >= 50
                ? 'bg-amber-500/15 text-amber-400 border-amber-500/30'
                : 'bg-red-500/15 text-red-400 border-red-500/30'
              return (
                <div key={page.id} className="rounded-2xl border border-[#222222] bg-[#111111] p-4">
                  <div className="flex items-start justify-between gap-2 mb-1">
                    <p className="text-xs font-mono text-[#ededed] truncate flex-1" title={page.url}>
                      {page.url.replace(/^https?:\/\//, '')}
                    </p>
                    <span className={`flex-shrink-0 text-xs font-mono font-bold px-2 py-0.5 rounded-full border ${scoreCls}`}>
                      {page.seo_score}
                    </span>
                  </div>
                  {page.title && (
                    <p className="text-xs text-[#8b8b8b] truncate mb-2" title={page.title}>{page.title}</p>
                  )}
                  <div className="flex items-center gap-3 text-xs text-[#4b4b4b] mb-2">
                    <span>{page.word_count.toLocaleString()} words</span>
                    <span>{page.load_time_ms}ms</span>
                  </div>
                  {Array.isArray(page.issues) && page.issues.length > 0 && (
                    <ul className="flex flex-col gap-0.5">
                      {page.issues.map((issue, i) => (
                        <li key={i} className="text-xs text-red-400 leading-snug">· {issue}</li>
                      ))}
                    </ul>
                  )}
                </div>
              )
            })}
          </div>
        )}
      </section>

      {/* Monetisation */}
      <section className="mt-10">
        <h2 className="text-xs font-semibold uppercase tracking-widest text-[#8b8b8b] mb-4">
          Monetisation Opportunities
        </h2>

        {(report.monetisation_status === 'pending' || report.monetisation_status === 'running') && (
          <div className="flex flex-col gap-3">
            {[...Array(2)].map((_, i) => (
              <div key={i} className="animate-pulse rounded-2xl border border-[#222222] bg-[#111111] p-4 h-20" />
            ))}
          </div>
        )}

        {report.monetisation_status === 'failed' && (
          <p className="text-[#8b8b8b] text-sm">Monetisation analysis unavailable.</p>
        )}

        {monetisation && monetisation.length > 0 && (
          <div className="flex flex-col gap-3">
            {monetisation.map((m) => (
              <div
                key={m.id}
                className={`rounded-2xl border p-4 ${m.cta_missing_pages.length > 0 ? 'border-amber-500/30 bg-amber-500/5' : 'border-[#222222] bg-[#111111]'}`}
              >
                <div className="flex items-center gap-2 mb-2">
                  <span className="text-sm font-semibold text-[#ededed]">{m.category}</span>
                  {m.cta_missing_pages.length > 0 && (
                    <span className="text-xs px-2 py-0.5 rounded-full bg-amber-500/20 text-amber-400 border border-amber-500/30">
                      Quick win
                    </span>
                  )}
                  <span className={`ml-auto text-xs font-mono font-bold ${m.priority === 'high' ? 'text-green-400' : m.priority === 'medium' ? 'text-yellow-400' : 'text-[#8b8b8b]'}`}>
                    {m.priority}
                  </span>
                </div>
                <p className="text-xs text-[#ff6363] font-mono mb-2">{m.commission_rate}</p>
                <p className="text-xs text-[#8b8b8b]">{m.programmes.join(' · ')}</p>
              </div>
            ))}
          </div>
        )}

        {monetisation && monetisation.length === 0 && report.monetisation_status === 'done' && (
          <p className="text-[#8b8b8b] text-sm">No affiliate opportunities identified.</p>
        )}
      </section>

      {/* CRO */}
      <section className="mt-10 mb-10">
        <h2 className="text-xs font-semibold uppercase tracking-widest text-[#8b8b8b] mb-4">
          CRO Analysis
        </h2>

        {(report.cro_status === 'pending' || report.cro_status === 'running') && (
          <div className="flex flex-col gap-2">
            {[...Array(5)].map((_, i) => (
              <div key={i} className="animate-pulse h-10 rounded-xl bg-[#111111] border border-[#222222]" />
            ))}
          </div>
        )}

        {report.cro_status === 'failed' && (
          <p className="text-[#8b8b8b] text-sm">CRO analysis unavailable.</p>
        )}

        {cro && cro.length > 0 && (
          <div className="flex flex-col divide-y divide-[#222222] rounded-2xl border border-[#222222] overflow-hidden">
            {cro.map((c) => (
              <div key={c.id} className="flex items-start gap-3 px-4 py-3 bg-[#111111]">
                <span className={`text-base mt-0.5 ${c.passed ? 'text-green-400' : 'text-red-400'}`}>
                  {c.passed ? '✓' : '✕'}
                </span>
                <div>
                  <p className="text-xs font-mono text-[#b0b0b0] mb-0.5">{c.factor}</p>
                  <p className={`text-sm ${c.passed ? 'text-[#ededed]' : 'text-red-300'}`}>{c.recommendation}</p>
                </div>
              </div>
            ))}
          </div>
        )}
      </section>
    </div>
  )
}
