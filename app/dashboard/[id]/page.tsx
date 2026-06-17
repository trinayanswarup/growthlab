'use client'

import { Fragment, useEffect, useState } from 'react'
import Link from 'next/link'
import { ArrowLeft } from 'lucide-react'
import type { AuditJob, AgentStatus } from '@/types'
import type { ContentBrief } from '@/lib/agents/brief-generator'

// ─── Types ───────────────────────────────────────────────────────────────────

interface PageRow {
  id: string
  url: string
  title: string | null
  seo_score: number
  word_count: number
  load_time_ms: number
  issues: string[]
}

interface GapRow {
  id: string
  keyword: string
  intent: 'informational' | 'commercial' | 'transactional'
  competitor: string
  gap_score: number
}

interface MonetisationRow {
  id: string
  category: string
  commission_rate: string
  programmes: string[]
  cta_missing_pages?: string[]
  priority: 'high' | 'medium' | 'low'
}

interface CRORow {
  id: string
  factor: string
  result?: 'pass' | 'warning' | 'fail'
  passed?: boolean
  recommendation: string
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

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

function normaliseCro(row: CRORow): 'pass' | 'warning' | 'fail' {
  if (row.result === 'pass' || row.result === 'warning' || row.result === 'fail') return row.result
  return row.passed ? 'pass' : 'fail'
}

// ─── Sub-components ──────────────────────────────────────────────────────────

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

// ─── Inline brief panel ──────────────────────────────────────────────────────

function BriefPanel({ keyword, colSpan }: { keyword: string; colSpan: number }) {
  const [loading, setLoading] = useState(false)
  const [brief, setBrief] = useState<ContentBrief | null>(null)
  const [error, setError] = useState<string | null>(null)

  async function generateBrief() {
    setLoading(true)
    setError(null)
    try {
      const res = await fetch('/api/generate/brief', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ keyword }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || 'Generation failed')
      setBrief(data)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Generation failed')
    } finally {
      setLoading(false)
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
      `**Commissioning note:** ${brief.commissioningNote}`,
    ].join('\n')
  }

  return (
    <tr>
      <td colSpan={colSpan} className="p-0 border-t border-[var(--border)]">
        <div className="bg-[var(--bg)] border-b border-[var(--border)] px-4 py-4">
          {!brief && !loading && (
            <button
              type="button"
              onClick={generateBrief}
              className="px-4 py-2 rounded-lg bg-[var(--accent)] text-white font-semibold text-xs hover:bg-[var(--accent-hover)] transition-colors"
            >
              Generate Brief
            </button>
          )}
          {loading && <p className="text-[var(--text-secondary)] text-sm animate-pulse">Generating brief…</p>}
          {error && <p className="text-red-400 text-xs mt-2">{error}</p>}
          {brief && (
            <div className="bg-[var(--surface)] border border-[var(--border)] rounded-lg overflow-hidden">
              {/* Header bar */}
              <div className="bg-[var(--surface-2)] px-4 py-3 border-b border-[var(--border)] flex items-center justify-between">
                <span className="text-xs text-[var(--text-muted)]">
                  Brief ready · <span className="text-[var(--accent)] font-mono">{brief.wordCountRecommendation.toLocaleString()}</span> words recommended
                </span>
                <CopyButton text={briefMarkdown()} label="Copy as Markdown" />
              </div>

              {/* Title + meta */}
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

              {/* Article structure */}
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

              {/* Footer: secondary keywords + commissioning note */}
              {(brief.secondaryKeywords.length > 0 || brief.commissioningNote) && (
                <div className="p-4 border-t border-[var(--border)] bg-[var(--bg-secondary)]">
                  {brief.secondaryKeywords.length > 0 && (
                    <div className="mb-3">
                      <p className="text-[10px] font-bold uppercase tracking-wider text-[var(--text-muted)] mb-2">Secondary keywords</p>
                      <div className="flex flex-wrap gap-2">
                        {brief.secondaryKeywords.map((kw, i) => (
                          <span key={i} className="text-xs px-2 py-1 rounded-md bg-[var(--surface-2)] border border-[var(--border)] text-[var(--text-secondary)]">{kw}</span>
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
                AI-generated first draft. Verify before publishing.
              </p>
            </div>
          )}
        </div>
      </td>
    </tr>
  )
}

// ─── Keyword Gaps section ────────────────────────────────────────────────────

function KeywordGapsSection({ auditId, status }: { auditId: string; status: AgentStatus }) {
  const [gaps, setGaps] = useState<GapRow[] | null>(null)
  const [openRow, setOpenRow] = useState<string | null>(null)

  useEffect(() => {
    if (status !== 'done') return
    fetch(`/api/audits/${auditId}/gaps`)
      .then((r) => r.json())
      .then((data) => { if (Array.isArray(data)) setGaps(data) })
      .catch(console.error)
  }, [auditId, status])

  if (status === 'pending' || status === 'running') {
    return (
      <div className="bg-[var(--surface)] border border-[var(--border)] rounded-lg overflow-hidden">
        {[...Array(3)].map((_, i) => (
          <div key={i} className={`p-4 flex gap-4 ${i > 0 ? 'border-t border-[var(--border)]' : ''}`}>
            <div className="flex-1 flex flex-col gap-2">
              <div className="animate-pulse h-3 bg-[var(--surface-2)] rounded w-1/2" />
              <div className="animate-pulse h-2 bg-[var(--surface-2)] rounded w-1/4" />
            </div>
          </div>
        ))}
      </div>
    )
  }

  if (status === 'failed') {
    return <p className="text-[var(--text-secondary)] text-sm">Keyword analysis failed — other results still available.</p>
  }

  if (!gaps) return <p className="text-[var(--text-muted)] text-sm">Loading gaps…</p>

  if (gaps.length === 0) {
    return <p className="text-[var(--present)] text-sm">No keyword gaps detected — site already ranks for all tested queries.</p>
  }

  return (
    <div className="overflow-x-auto bg-[var(--surface)] border border-[var(--border)] rounded-xl overflow-hidden">
      <table className="w-full text-sm border-collapse">
        <thead className="bg-[var(--surface-2)]">
          <tr>
            <th className="px-4 py-3 text-left text-xs font-semibold text-[var(--navy)] uppercase tracking-wider border-b border-[var(--border)]">Keyword</th>
            <th className="px-4 py-3 text-left text-xs font-semibold text-[var(--navy)] uppercase tracking-wider border-b border-[var(--border)]">Intent</th>
            <th className="px-4 py-3 text-left text-xs font-semibold text-[var(--navy)] uppercase tracking-wider border-b border-[var(--border)]">Top Competitor</th>
            <th className="px-4 py-3 text-left text-xs font-semibold text-[var(--navy)] uppercase tracking-wider border-b border-[var(--border)]">Gap Score</th>
            <th className="px-4 py-3 border-b border-[var(--border)]"><span className="sr-only">Action</span></th>
          </tr>
        </thead>
        <tbody>
          {gaps.map((gap) => {
            const isOpen = openRow === gap.keyword
            return (
              <Fragment key={gap.id || gap.keyword}>
                <tr className="border-b border-[var(--border)] hover:bg-[var(--surface-2)] transition-colors">
                  <td className="px-4 py-4 font-mono text-xs text-[var(--text-primary)] max-w-[220px]">
                    <span title={gap.keyword} className="block truncate">{gap.keyword}</span>
                  </td>
                  <td className="px-4 py-4">
                    <IntentBadge intent={gap.intent} />
                  </td>
                  <td className="px-4 py-4 text-xs text-[var(--text-secondary)] truncate max-w-[160px]">{gap.competitor}</td>
                  <td className="px-4 py-4">
                    <div className="flex items-center gap-2">
                      <div className="w-20 bg-[var(--border)] rounded-full h-1.5">
                        <div className="bg-[var(--accent)] h-1.5 rounded-full" style={{ width: `${gap.gap_score}%` }} />
                      </div>
                      <span className="text-xs font-mono text-[var(--text-muted)]">{gap.gap_score}</span>
                    </div>
                  </td>
                  <td className="px-4 py-4">
                    <button
                      type="button"
                      onClick={() => setOpenRow(isOpen ? null : gap.keyword)}
                      className="px-3 py-1.5 bg-[var(--accent)] text-white text-xs font-medium rounded-lg hover:bg-[var(--accent-hover)] transition-colors whitespace-nowrap"
                    >
                      {isOpen ? 'Close ↑' : 'Generate →'}
                    </button>
                  </td>
                </tr>
                {isOpen && <BriefPanel keyword={gap.keyword} colSpan={5} />}
              </Fragment>
            )
          })}
        </tbody>
      </table>
    </div>
  )
}

// ─── SEO section ─────────────────────────────────────────────────────────────

function SEOSection({ auditId, status }: { auditId: string; status: AgentStatus }) {
  const [pages, setPages] = useState<PageRow[] | null>(null)

  useEffect(() => {
    if (status !== 'done') return
    fetch(`/api/audits/${auditId}/pages`)
      .then((r) => r.json())
      .then((data) => { if (Array.isArray(data)) setPages(data) })
      .catch(console.error)
  }, [auditId, status])

  if (status === 'pending' || status === 'running') {
    return (
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
    )
  }

  if (status === 'failed') {
    return <p className="text-[var(--text-secondary)] text-sm">SEO audit failed — site may be blocking automated requests.</p>
  }

  if (!pages) return <p className="text-[var(--text-muted)] text-sm">Loading results…</p>

  if (pages.length === 0) {
    return <p className="text-[var(--text-secondary)] text-sm">No pages crawled.</p>
  }

  return (
    <div className="bg-[var(--surface)] border border-[var(--border)] rounded-lg overflow-hidden">
      {pages.map((page, i) => {
        const score = page.seo_score ?? 0
        const scoreCls = score >= 80
          ? 'bg-green-500/15 text-green-400 border-green-500/30'
          : score >= 50
            ? 'bg-amber-500/15 text-amber-400 border-amber-500/30'
            : 'bg-red-500/15 text-red-400 border-red-500/30'
        return (
          <div key={page.id} className={`p-5 flex gap-5 hover:bg-[var(--surface-2)] transition-colors ${i > 0 ? 'border-t border-[var(--border)]' : ''}`}>
            <div className={`flex-shrink-0 w-12 h-12 rounded-full border flex items-center justify-center font-mono font-bold text-sm ${scoreCls}`}>
              {score}
            </div>
            <div className="min-w-0 flex-1">
              <p className="text-xs font-mono text-[var(--text-primary)] truncate mb-0.5" title={page.url}>
                {page.url.replace(/^https?:\/\//, '')}
              </p>
              {page.title && (
                <p className="text-xs text-[var(--text-secondary)] truncate mb-2" title={page.title}>{page.title}</p>
              )}
              <div className="flex items-center gap-3 text-xs text-[var(--text-muted)] mb-2">
                <span>{(page.word_count ?? 0).toLocaleString()} words</span>
                <span>{page.load_time_ms ?? 0}ms</span>
              </div>
              {Array.isArray(page.issues) && page.issues.length > 0 ? (
                <div className="flex flex-col gap-0.5">
                  {page.issues.map((issue, j) => (
                    <p key={j} className="text-xs text-red-400 leading-snug">· {issue}</p>
                  ))}
                </div>
              ) : (
                <p className="text-xs text-[var(--present)]">No issues found</p>
              )}
            </div>
          </div>
        )
      })}
    </div>
  )
}

// ─── Monetisation section ────────────────────────────────────────────────────

function MonetisationSection({ auditId }: { auditId: string }) {
  const [rows, setRows] = useState<MonetisationRow[] | null>(null)

  useEffect(() => {
    fetch(`/api/audits/${auditId}/monetisation`)
      .then((r) => r.json())
      .then((data) => { if (Array.isArray(data)) setRows(data) })
      .catch(console.error)
  }, [auditId])

  if (!rows) return <p className="text-[var(--text-muted)] text-sm">Loading…</p>
  if (rows.length === 0) return <p className="text-[var(--text-secondary)] text-sm">No affiliate opportunities identified.</p>

  return (
    <div className="bg-[var(--surface)] border border-[var(--border)] rounded-lg overflow-hidden">
      {rows.map((m, i) => {
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
                {m.cta_missing_pages && m.cta_missing_pages.length > 0 && (
                  <span className="text-[10px] font-bold uppercase px-1.5 py-0.5 rounded bg-amber-500/20 text-amber-400 border border-amber-500/30">
                    Quick win
                  </span>
                )}
              </div>
              <p className="text-xs text-[var(--accent)] font-mono mb-2">{m.commission_rate}</p>
              {Array.isArray(m.programmes) && m.programmes.length > 0 && (
                <div className="flex flex-wrap gap-1.5">
                  {m.programmes.map((p, j) => (
                    <span key={j} className="text-xs px-2 py-0.5 rounded-md bg-[var(--surface-2)] border border-[var(--border)] text-[var(--text-secondary)]">{p}</span>
                  ))}
                </div>
              )}
            </div>
          </div>
        )
      })}
    </div>
  )
}

// ─── CRO section ─────────────────────────────────────────────────────────────

function CROSection({ auditId }: { auditId: string }) {
  const [rows, setRows] = useState<CRORow[] | null>(null)

  useEffect(() => {
    fetch(`/api/audits/${auditId}/cro`)
      .then((r) => r.json())
      .then((data) => { if (Array.isArray(data)) setRows(data) })
      .catch(console.error)
  }, [auditId])

  if (!rows) return <p className="text-[var(--text-muted)] text-sm">Loading…</p>
  if (rows.length === 0) return <p className="text-[var(--text-secondary)] text-sm">No CRO findings available.</p>

  const sorted = [...rows].sort((a, b) => {
    const order = { fail: 0, warning: 1, pass: 2 }
    return order[normaliseCro(a)] - order[normaliseCro(b)]
  })

  return (
    <div className="bg-[var(--surface)] border border-[var(--border)] rounded-lg overflow-hidden">
      {sorted.map((c, i) => {
        const state = normaliseCro(c)
        const cls = state === 'pass'
          ? 'bg-green-500/15 text-green-400 border-green-500/30'
          : state === 'warning'
            ? 'bg-amber-500/15 text-amber-400 border-amber-500/30'
            : 'bg-red-500/15 text-red-400 border-red-500/30'
        const icon = state === 'pass' ? '✓' : state === 'warning' ? '⚠' : '✕'
        return (
          <div key={c.id} className={`flex items-start gap-3 px-4 py-4 hover:bg-[var(--surface-2)] transition-colors ${i > 0 ? 'border-t border-[var(--border)]' : ''}`}>
            <div className={`flex-shrink-0 w-8 h-8 rounded-full border flex items-center justify-center text-xs font-bold ${cls}`}>
              {icon}
            </div>
            <div className="pt-0.5">
              <p className="text-xs font-mono text-[var(--text-muted)] mb-0.5">{c.factor}</p>
              <p className={`text-sm ${state === 'pass' ? 'text-[var(--text-primary)]' : 'text-[var(--text-secondary)]'}`}>{c.recommendation}</p>
            </div>
          </div>
        )
      })}
    </div>
  )
}

// ─── Main page ───────────────────────────────────────────────────────────────

interface Props {
  params: { id: string }
}

export default function DashboardPage({ params }: Props) {
  const [audit, setAudit] = useState<AuditJob | null>(null)
  const [notFound, setNotFound] = useState(false)

  useEffect(() => {
    let stopped = false

    async function poll() {
      while (!stopped) {
        try {
          const res = await fetch(`/api/audits/${params.id}/status`)
          if (res.status === 404) { setNotFound(true); return }
          const data: AuditJob = await res.json()
          setAudit(data)
          if (data.status === 'done' || data.status === 'failed') return
        } catch {
          // Network hiccup — keep polling
        }
        await new Promise((r) => setTimeout(r, 2000))
      }
    }

    poll()
    return () => { stopped = true }
  }, [params.id])

  if (notFound) {
    return <div className="p-8"><p className="text-red-400">Audit not found.</p></div>
  }

  if (!audit) {
    return <div className="p-8"><p className="text-[var(--text-secondary)] text-sm animate-pulse">Loading audit…</p></div>
  }

  const domain = audit.url.replace(/^https?:\/\/(www\.)?/, '').replace(/\/$/, '')
  const isRunning = audit.status === 'running' || audit.status === 'queued'

  return (
    <div className="p-8 max-w-6xl mx-auto">
      {/* Header */}
      <div className="mb-6">
        <Link href="/audit" className="inline-flex items-center gap-1 text-xs text-[var(--text-secondary)] hover:text-[var(--text-primary)] mb-3 transition-colors">
          <ArrowLeft className="h-3 w-3" />
          Quick Audit
        </Link>
        <h1 className="text-2xl font-bold text-[var(--navy)] mb-2 truncate" title={audit.url}>{domain}</h1>
        {audit.topic && (
          <span className="px-2 py-0.5 rounded-full bg-[var(--accent-10)] text-[var(--accent)] text-xs font-medium border border-[var(--accent-30)]">
            {audit.topic}
          </span>
        )}
      </div>

      {/* Agent trace */}
      <div className="rounded-xl border border-[var(--border)] bg-[var(--surface)] p-4 mb-6">
        <div className="flex flex-wrap gap-x-8 gap-y-2">
          <TraceItem status={audit.seo_status} label="SEO crawl" />
          <TraceItem status={audit.content_status} label="Keyword gaps" />
          <TraceItem status={audit.monetisation_status} label="Monetisation mapping" />
          <TraceItem status={audit.cro_status} label="CRO analysis" />
        </div>
        {isRunning && (
          <p className="text-xs text-[var(--text-muted)] mt-3">Agents running — results stream in as each completes</p>
        )}
      </div>

      {/* Overall score */}
      {audit.overall_score != null && (
        <div className="mb-8 w-full flex items-center gap-6 px-6 py-5 rounded-xl border border-[var(--border)] bg-[var(--surface)]">
          <span className="text-6xl font-black font-mono text-[var(--accent)] leading-none flex-shrink-0">
            {audit.overall_score}
          </span>
          <div className="flex-1 min-w-0">
            <p className="text-sm font-semibold text-[var(--navy)] mb-1">Overall SEO Score</p>
            <p className="text-xs text-[var(--text-secondary)] mb-3 max-w-sm">
              Average score across all crawled pages, out of 100
            </p>
            <div className="w-full bg-[var(--border)] rounded-full h-1.5 mt-3">
              <div className="bg-[var(--accent)] h-1.5 rounded-full transition-all" style={{ width: `${audit.overall_score}%` }} />
            </div>
          </div>
        </div>
      )}

      {/* SEO Audit */}
      <section className="mb-10">
        <h2 className="text-xs font-semibold uppercase tracking-widest text-[var(--text-secondary)] mb-4">
          SEO Audit
        </h2>
        <SEOSection auditId={params.id} status={audit.seo_status} />
      </section>

      {/* Keyword Gaps */}
      <section className="mb-10">
        <h2 className="text-xs font-semibold uppercase tracking-widest text-[var(--text-secondary)] mb-4">
          Keyword Gaps
        </h2>
        <KeywordGapsSection auditId={params.id} status={audit.content_status} />
      </section>

      {/* Monetisation */}
      {audit.monetisation_status === 'done' && (
        <section className="mb-10">
          <h2 className="text-xs font-semibold uppercase tracking-widest text-[var(--text-secondary)] mb-4">
            Monetisation Opportunities
          </h2>
          <MonetisationSection auditId={params.id} />
        </section>
      )}

      {/* CRO */}
      {audit.cro_status === 'done' && (
        <section className="mb-10">
          <h2 className="text-xs font-semibold uppercase tracking-widest text-[var(--text-secondary)] mb-4">
            CRO Analysis
          </h2>
          <CROSection auditId={params.id} />
        </section>
      )}
    </div>
  )
}
