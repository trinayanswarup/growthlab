'use client'

import { useState, FormEvent } from 'react'
import { useRouter } from 'next/navigation'
import { ArrowRight } from 'lucide-react'
import Link from 'next/link'

export default function AuditPage() {
  const router = useRouter()
  const [url, setUrl] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function handleSubmit(e: FormEvent) {
    e.preventDefault()
    setError(null)

    let normalised = url.trim()
    if (normalised && !/^https?:\/\//i.test(normalised)) {
      normalised = 'https://' + normalised
    }
    if (!normalised) {
      setError('Please enter a URL')
      return
    }

    setLoading(true)
    try {
      const res = await fetch('/api/audit', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ url: normalised }),
      })

      if (!res.ok) {
        const data = await res.json()
        throw new Error(data.error || 'Failed to start audit')
      }

      const { auditId } = await res.json()
      router.push(`/dashboard/${auditId}`)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Something went wrong')
      setLoading(false)
    }
  }

  return (
    <div className="p-8 max-w-2xl mx-auto pt-16 md:pt-24">
      <div className="text-center mb-8">
        <h1 className="text-3xl md:text-4xl font-bold text-[var(--navy)] tracking-tight mb-3">Quick Audit</h1>
        <p className="text-[var(--text-secondary)] text-base max-w-lg mx-auto leading-relaxed">
          Paste any URL for a full SEO, keyword gap, monetisation, and CRO audit. No competitors needed.
        </p>
      </div>

      <div className="bg-[var(--surface)] border border-[var(--border)] rounded-xl p-6 md:p-8 shadow-glass">
        <form onSubmit={handleSubmit} className="flex flex-col gap-4">
          <div>
            <label className="block text-[10px] font-bold uppercase tracking-[0.12em] text-[var(--text-muted)] mb-1.5">Website URL</label>
            <input
              type="text"
              value={url}
              onChange={(e) => setUrl(e.target.value)}
              placeholder="https://cybernews.com"
              disabled={loading}
              className="w-full bg-[var(--bg-secondary)] border border-[var(--border)] rounded-lg px-4 py-3 text-sm text-[var(--text-primary)] placeholder:text-[var(--text-muted)] focus:outline-none focus:border-[var(--accent)] focus:ring-1 focus:ring-[var(--accent)] transition-all shadow-sm disabled:opacity-50"
            />
          </div>

          {error && <p className="text-xs text-[var(--error)]">{error}</p>}

          <button
            type="submit"
            disabled={loading || !url.trim()}
            className="bg-[#1e3a5f] hover:bg-[#162d4a] disabled:opacity-40 disabled:cursor-not-allowed text-white font-semibold rounded-lg px-5 py-3 text-sm transition-colors flex items-center justify-center gap-2 shadow-sm"
          >
            {loading ? 'Starting audit…' : (
              <>Run Audit <ArrowRight className="h-4 w-4" /></>
            )}
          </button>
        </form>
      </div>

      <p className="text-xs text-[var(--text-muted)] text-center mt-6">
        For competitive keyword gap analysis with presence matrix, use{' '}
        <Link href="/" className="text-[var(--accent)] hover:underline font-medium">New Report →</Link>
      </p>
    </div>
  )
}
