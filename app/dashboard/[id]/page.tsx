'use client'

import { useEffect, useState } from 'react'
import type { AuditJob, AgentStatus } from '@/types'

interface PageRow {
  id: string
  url: string
  title: string | null
  seo_score: number
  word_count: number
  load_time_ms: number
  issues: string[]
}

function scoreBadge(score: number) {
  const colour =
    score >= 80 ? 'bg-green-500/15 text-green-400 border-green-500/30' :
    score >= 50 ? 'bg-yellow-500/15 text-yellow-400 border-yellow-500/30' :
                 'bg-red-500/15 text-red-400 border-red-500/30'
  return (
    <span className={`inline-flex items-center px-2 py-0.5 rounded border text-xs font-mono font-semibold ${colour}`}>
      {score}
    </span>
  )
}

function AgentTag({ status, label }: { status: AgentStatus; label: string }) {
  const colour =
    status === 'done'    ? 'text-green-400' :
    status === 'running' ? 'text-yellow-400 animate-pulse' :
    status === 'failed'  ? 'text-red-400' :
                           'text-[#4b5563]'
  const dot =
    status === 'done'    ? '●' :
    status === 'running' ? '◌' :
    status === 'failed'  ? '✕' : '○'

  return (
    <span className={`text-xs font-mono flex items-center gap-1 ${colour}`}>
      {dot} {label}
    </span>
  )
}

function SkeletonCard() {
  return (
    <div className="rounded-lg border border-[#1f1f1f] bg-[#111111] p-4 animate-pulse">
      <div className="h-3 w-2/3 bg-[#2a2a2a] rounded mb-3" />
      <div className="h-3 w-1/3 bg-[#2a2a2a] rounded mb-4" />
      <div className="h-2 w-full bg-[#1f1f1f] rounded mb-2" />
      <div className="h-2 w-4/5 bg-[#1f1f1f] rounded" />
    </div>
  )
}

function SEOSection({ auditId, status }: { auditId: string; status: AgentStatus }) {
  const [pages, setPages] = useState<PageRow[] | null>(null)

  useEffect(() => {
    if (status !== 'done') return
    fetch(`/api/audits/${auditId}/pages`)
      .then((r) => r.json())
      .then(setPages)
      .catch(console.error)
  }, [auditId, status])

  if (status === 'pending' || status === 'running') {
    return (
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        {[...Array(3)].map((_, i) => <SkeletonCard key={i} />)}
      </div>
    )
  }

  if (status === 'failed') {
    return <p className="text-red-400 text-sm">SEO audit failed. Check the URL and try again.</p>
  }

  if (!pages) {
    return <p className="text-[#4b5563] text-sm">Loading results…</p>
  }

  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
      {pages.map((page) => (
        <div key={page.id} className="rounded-lg border border-[#1f1f1f] bg-[#111111] p-4">
          <div className="flex items-start justify-between gap-2 mb-3">
            <div className="min-w-0">
              <p className="text-xs font-mono text-[#a1a1aa] truncate" title={page.url}>
                {page.url.replace(/^https?:\/\//, '').slice(0, 60)}
              </p>
              {page.title && (
                <p className="text-sm text-[#ededed] mt-0.5 truncate" title={page.title}>
                  {page.title}
                </p>
              )}
            </div>
            {scoreBadge(page.seo_score ?? 0)}
          </div>

          <div className="flex gap-4 text-xs text-[#6b7280] mb-3">
            <span>{page.word_count ?? 0} words</span>
            <span>{page.load_time_ms ?? 0}ms</span>
          </div>

          {page.issues && page.issues.length > 0 && (
            <ul className="space-y-1">
              {page.issues.map((issue, i) => (
                <li key={i} className="text-xs text-[#f87171] flex gap-1.5 items-start">
                  <span className="mt-px flex-shrink-0">·</span>
                  {issue}
                </li>
              ))}
            </ul>
          )}

          {(!page.issues || page.issues.length === 0) && (
            <p className="text-xs text-green-400">No issues found</p>
          )}
        </div>
      ))}
    </div>
  )
}

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
    return (
      <div className="p-8">
        <p className="text-red-400">Audit not found.</p>
      </div>
    )
  }

  if (!audit) {
    return (
      <div className="p-8">
        <p className="text-[#6b7280] text-sm animate-pulse">Loading audit…</p>
      </div>
    )
  }

  return (
    <div className="p-8 max-w-4xl">
      {/* Header */}
      <div className="mb-6">
        <h1 className="text-xl font-semibold mb-1 truncate">{audit.url}</h1>
        <div className="flex flex-wrap gap-4 mt-2">
          <AgentTag status={audit.seo_status} label="SEO" />
          <AgentTag status={audit.content_status} label="Content Gaps" />
          <AgentTag status={audit.monetisation_status} label="Monetisation" />
          <AgentTag status={audit.cro_status} label="CRO" />
        </div>
      </div>

      {/* Overall score */}
      {audit.overall_score != null && (
        <div className="mb-6 inline-flex items-center gap-3 px-4 py-3 rounded-lg border border-[#1f1f1f] bg-[#111111]">
          <span className="text-[#6b7280] text-sm">Overall score</span>
          <span className="text-2xl font-mono font-bold text-[#22d3ee]">{audit.overall_score}</span>
          <span className="text-[#4b5563] text-sm">/100</span>
        </div>
      )}

      {/* SEO Section */}
      <section className="mb-8">
        <h2 className="text-sm font-semibold uppercase tracking-widest text-[#6b7280] mb-4">
          SEO Audit
        </h2>
        <SEOSection auditId={params.id} status={audit.seo_status} />
      </section>
    </div>
  )
}
