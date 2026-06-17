'use client'

export const dynamic = 'force-dynamic'

import { useCallback, useEffect, useState } from 'react'
import Link from 'next/link'

interface HistoryRow {
  id: string
  target_url: string
  competitor_urls: string[]
  status: string
  opportunity_score: number | null
  topic: string | null
  tracked: boolean
  created_at: string
}

function relativeTime(iso: string): string {
  const diffMs = Date.now() - new Date(iso).getTime()
  const mins = Math.floor(diffMs / 60000)
  if (mins < 60) return `${Math.max(1, mins)} minute${mins !== 1 ? 's' : ''} ago`
  const hrs = Math.floor(mins / 60)
  if (hrs < 24) return `${hrs} hour${hrs !== 1 ? 's' : ''} ago`
  const days = Math.floor(hrs / 24)
  return `${days} day${days !== 1 ? 's' : ''} ago`
}

function extractDomain(url: string): string {
  try { return new URL(url).hostname.replace(/^www\./, '') } catch { return url }
}

function OpportunityBadge({ score }: { score: number | null }) {
  if (score === null) return <span className="text-[var(--text-muted)] text-sm">—</span>
  const isHigh = score >= 60
  const isMed = score >= 30
  const cls = isHigh
    ? 'bg-[var(--missing-light)] text-[var(--missing)] border border-red-200 dark:border-red-900'
    : isMed
    ? 'bg-[var(--commercial-light)] text-[var(--commercial)] border border-amber-200 dark:border-amber-900'
    : 'bg-[var(--present-light)] text-[var(--present)] border border-green-200 dark:border-green-900'
  return (
    <span className={`inline-flex items-center px-2 py-0.5 rounded-md text-xs font-semibold ${cls}`}>
      {score}%
    </span>
  )
}

function StatusBadge({ status }: { status: string }) {
  const map: Record<string, { color: string, dot: string }> = {
    done: { color: 'text-[var(--text-primary)]', dot: 'bg-[var(--success)]' },
    running: { color: 'text-[var(--text-primary)]', dot: 'bg-[var(--warning)]' },
    queued: { color: 'text-[var(--text-secondary)]', dot: 'bg-[#38bdf8]' },
    failed: { color: 'text-[var(--error)]', dot: 'bg-[var(--error)]' },
  }
  const config = map[status] || { color: 'text-[var(--text-secondary)]', dot: 'bg-[var(--border-2)]' }
  return (
    <div className={`flex items-center gap-2 text-sm font-medium capitalize ${config.color}`}>
      <div className={`h-1.5 w-1.5 rounded-full ${config.dot}`} />
      {status}
    </div>
  )
}

function TrackButton({
  reportId,
  initialTracked,
  onToggle,
}: {
  reportId: string
  initialTracked: boolean
  onToggle: () => void
}) {
  const [tracked, setTracked] = useState(initialTracked)
  const [loading, setLoading] = useState(false)

  async function setTrackedTo(value: boolean, e: React.MouseEvent) {
    e.preventDefault()
    e.stopPropagation()
    if (loading) return
    setLoading(true)
    setTracked(value)
    try {
      await fetch(`/api/reports/${reportId}/track`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ tracked: value }),
      })
      onToggle()
    } catch {
      setTracked(!value)
    } finally {
      setLoading(false)
    }
  }

  return (
    <button
      type="button"
      onClick={(e) => setTrackedTo(!tracked, e)}
      disabled={loading}
      className={`text-sm font-medium transition-colors flex items-center gap-1.5 ${tracked
          ? 'text-[var(--accent)]'
          : 'text-[var(--text-secondary)] hover:text-[var(--text-primary)]'
        }`}
    >
      {loading ? (
        <span className="animate-pulse">...</span>
      ) : tracked ? (
        <span className="flex flex-col items-start gap-0">
          <span className="flex items-center gap-1">
            <svg className="w-3.5 h-3.5 fill-current" viewBox="0 0 24 24"><path d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z"/></svg>
            Tracked
          </span>
          <span className="text-[0.65rem] text-[var(--text-muted)] font-normal">re-audits daily</span>
        </span>
      ) : (
        <>
          <svg className="w-4 h-4 text-[var(--text-muted)] group-hover:text-[var(--text-primary)] transition-colors" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M11.48 3.499a.562.562 0 011.04 0l2.125 5.111a.563.563 0 00.475.345l5.518.442c.499.04.701.663.321.988l-4.204 3.602a.563.563 0 00-.182.557l1.285 5.385a.562.562 0 01-.84.61l-4.725-2.885a.563.563 0 00-.586 0L6.982 20.54a.562.562 0 01-.84-.61l1.285-5.386a.562.562 0 00-.182-.557l-4.204-3.602a.563.563 0 01.321-.988l5.518-.442a.563.563 0 00.475-.345L11.48 3.5z" /></svg>
          Track
        </>
      )}
    </button>
  )
}

export default function HistoryPage() {
  const [rows, setRows] = useState<HistoryRow[] | null>(null)

  const fetchReports = useCallback(() => {
    fetch(`/api/reports/history?t=${Date.now()}`)
      .then((r) => r.json())
      .then((data) => { if (Array.isArray(data)) setRows(data) })
      .catch(() => setRows([]))
  }, [])

  useEffect(() => {
    fetchReports()
    window.addEventListener('focus', fetchReports)
    return () => window.removeEventListener('focus', fetchReports)
  }, [fetchReports])

  return (
    <div className="p-8 max-w-6xl mx-auto">
      <h1 className="text-2xl font-semibold mb-1">Report History</h1>
      <p className="text-[var(--text-secondary)] text-sm mb-8">All competitive reports. Track a report to schedule weekly re-audits.</p>

      {rows === null && (
        <div className="flex flex-col gap-2">
          {[...Array(4)].map((_, i) => (
            <div key={i} className="animate-pulse h-12 rounded-lg bg-[var(--surface)] border border-[var(--border)]" />
          ))}
        </div>
      )}

      {rows && rows.length === 0 && (
        <div className="text-center py-16 rounded-xl border border-[var(--border)] bg-[var(--surface)]">
          <p className="text-[var(--text-secondary)] text-sm mb-4">No reports yet.</p>
          <Link href="/" className="text-sm text-[var(--accent)] hover:underline">
            Run your first competitive report →
          </Link>
        </div>
      )}

      {rows && rows.length > 0 && (
        <div className="overflow-x-auto rounded-xl border border-[var(--border)]">
          <table className="w-full text-sm border-collapse">
            <thead>
              <tr className="text-left text-xs uppercase tracking-wider text-[var(--text-muted)] bg-[var(--surface)]">
                <th className="py-3 pl-4 pr-4 font-medium">Target</th>
                <th className="py-3 pr-4 font-medium">Competitors</th>
                <th className="py-3 pr-4 font-medium">Opportunity Score</th>
                <th className="py-3 pr-4 font-medium">Status</th>
                <th className="py-3 pr-4 font-medium">Date</th>
                <th className="py-3 pr-4 font-medium"><span className="sr-only">Actions</span></th>
              </tr>
            </thead>
            <tbody>
              {rows.map((r) => (
                <tr key={r.id} className="border-t border-[var(--border)] hover:bg-white/[0.02] transition-colors">
                  <td className="py-3 pl-4 pr-4 max-w-[200px]">
                    <p className="text-[var(--text-primary)] text-xs font-mono truncate" title={r.target_url}>
                      {extractDomain(r.target_url)}
                    </p>
                    {r.topic && (
                      <p className="text-[var(--text-muted)] text-xs mt-0.5 truncate">{r.topic}</p>
                    )}
                  </td>
                  <td className="py-3 pr-4 max-w-[200px]">
                    <p className="text-[var(--text-secondary)] text-xs truncate">
                      {r.competitor_urls.length > 0
                        ? r.competitor_urls.map(extractDomain).join(', ')
                        : '—'}
                    </p>
                  </td>
                  <td className="py-3 pr-4">
                    <OpportunityBadge score={r.opportunity_score} />
                  </td>
                  <td className="py-3 pr-4">
                    <StatusBadge status={r.status} />
                  </td>
                  <td className="py-3 pr-4 text-xs text-[var(--text-muted)] whitespace-nowrap">
                    {relativeTime(r.created_at)}
                  </td>
                  <td className="py-3 pr-4">
                    <div className="flex items-center gap-3">
                      <TrackButton
                        reportId={r.id}
                        initialTracked={r.tracked}
                        onToggle={fetchReports}
                      />
                      <Link
                        href={`/report/${r.id}`}
                        className="text-xs text-[var(--accent)] hover:underline whitespace-nowrap"
                      >
                        View →
                      </Link>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}
