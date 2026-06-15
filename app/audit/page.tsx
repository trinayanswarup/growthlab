'use client'

import { useState, FormEvent } from 'react'
import { useRouter } from 'next/navigation'

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
    <div className="p-8 max-w-xl">
      <h1 className="text-2xl font-semibold mb-1">Run Audit</h1>
      <p className="text-[#6b7280] text-sm mb-8">
        Paste any website URL to audit across SEO, content gaps, monetisation, and CRO.
      </p>

      <form onSubmit={handleSubmit} className="flex flex-col gap-3">
        <input
          type="text"
          value={url}
          onChange={(e) => setUrl(e.target.value)}
          placeholder="https://cybernews.com"
          disabled={loading}
          className="w-full px-4 py-3 rounded-lg bg-[#111111] border border-[#2a2a2a] text-[#ededed] placeholder-[#4b5563] text-sm focus:outline-none focus:border-[#22d3ee] transition-colors disabled:opacity-50"
        />

        {error && (
          <p className="text-red-400 text-sm">{error}</p>
        )}

        <button
          type="submit"
          disabled={loading || !url.trim()}
          className="px-5 py-3 rounded-lg bg-[#22d3ee] text-[#0a0a0a] font-semibold text-sm transition-opacity hover:opacity-90 disabled:opacity-40 disabled:cursor-not-allowed"
        >
          {loading ? 'Starting audit…' : 'Run Audit'}
        </button>
      </form>
    </div>
  )
}
