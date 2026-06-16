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
  if (score === null) return <span className="text-[#4b4b4b] text-xs">—</span>
  const cls = score >= 60
    ? 'bg-red-500/15 text-red-400 border-red-500/30'
    : score >= 30
    ? 'bg-amber-500/15 text-amber-400 border-amber-500/30'
    : 'bg-green-500/15 text-green-400 border-green-500/30'
  return (
    <span className={`inline-flex items-center px-2 py-0.5 rounded-full border text-xs font-mono font-bold ${cls}`}>
      {score}%
    </span>
  )
}

function StatusBadge({ status }: { status: string }) {
  const map: Record<string, string> = {
    done:    'bg-green-500/15 text-green-400 border-green-500/30',
    running: 'bg-amber-500/15 text-amber-400 border-amber-500/30',
    queued:  'bg-blue-500/15 text-blue-400 border-blue-500/30',
    failed:  'bg-red-500/15 text-red-400 border-red-500/30',
  }
  return (
    <span className={`inline-flex items-center px-2 py-0.5 rounded-full border text-xs capitalize ${map[status] ?? 'bg-[#1a1a1a] text-[#8b8b8b] border-[#222222]'}`}>
      {status}
    </span>
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
      className={`text-xs px-3 py-1 rounded-full border transition-colors ${
        tracked
          ? 'border-[#ff6363] text-[#ff6363] bg-[#ff6363]/10'
          : 'border-[#222222] text-[#8b8b8b] hover:border-[#3a3a3a]'
      }`}
    >
      {loading ? '...' : tracked ? '● Tracked' : '○ Track'}
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
    <div className="px-6 py-10 max-w-6xl mx-auto">
      <h1 className="text-2xl font-semibold mb-1">Report History</h1>
      <p className="text-[#8b8b8b] text-sm mb-8">All competitive reports. Track a report to schedule weekly re-audits.</p>

      {rows === null && (
        <div className="flex flex-col gap-2">
          {[...Array(4)].map((_, i) => (
            <div key={i} className="animate-pulse h-12 rounded-xl bg-[#111111] border border-[#222222]" />
          ))}
        </div>
      )}

      {rows && rows.length === 0 && (
        <div className="text-center py-16 rounded-2xl border border-[#222222] bg-[#111111]">
          <p className="text-[#8b8b8b] text-sm mb-4">No reports yet.</p>
          <Link href="/" className="text-sm text-[#ff6363] hover:underline">
            Run your first competitive report →
          </Link>
        </div>
      )}

      {rows && rows.length > 0 && (
        <div className="overflow-x-auto rounded-2xl border border-[#222222]">
          <table className="w-full text-sm border-collapse">
            <thead>
              <tr className="text-left text-xs uppercase tracking-wider text-[#4b4b4b] bg-[#111111]">
                <th className="py-3 pl-4 pr-4 font-medium">Target</th>
                <th className="py-3 pr-4 font-medium">Competitors</th>
                <th className="py-3 pr-4 font-medium">Gap score</th>
                <th className="py-3 pr-4 font-medium">Status</th>
                <th className="py-3 pr-4 font-medium">Date</th>
                <th className="py-3 pr-4 font-medium"><span className="sr-only">Actions</span></th>
              </tr>
            </thead>
            <tbody>
              {rows.map((r) => (
                <tr key={r.id} className="border-t border-[#222222] hover:bg-white/[0.02] transition-colors">
                  <td className="py-3 pl-4 pr-4 max-w-[200px]">
                    <p className="text-[#ededed] text-xs font-mono truncate" title={r.target_url}>
                      {extractDomain(r.target_url)}
                    </p>
                    {r.topic && (
                      <p className="text-[#4b4b4b] text-xs mt-0.5 truncate">{r.topic}</p>
                    )}
                  </td>
                  <td className="py-3 pr-4 max-w-[200px]">
                    <p className="text-[#8b8b8b] text-xs truncate">
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
                  <td className="py-3 pr-4 text-xs text-[#4b4b4b] whitespace-nowrap">
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
                        className="text-xs text-[#ff6363] hover:underline whitespace-nowrap"
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
