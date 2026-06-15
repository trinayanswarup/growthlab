'use client'

import { useState, FormEvent, useRef } from 'react'

type Tab = 'comparison' | 'brief' | 'headline'

const LOADING_STAGES = [
  'Researching products…',
  'Fetching product pages…',
  'Analysing features…',
  'Generating page…',
]

function useLoadingStages(active: boolean) {
  const [stageIdx, setStageIdx] = useState(0)
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null)

  function start() {
    setStageIdx(0)
    let idx = 0
    timerRef.current = setInterval(() => {
      idx = Math.min(idx + 1, LOADING_STAGES.length - 1)
      setStageIdx(idx)
    }, 4000)
  }

  function stop() {
    if (timerRef.current) clearInterval(timerRef.current)
    setStageIdx(0)
  }

  const label = active ? LOADING_STAGES[stageIdx] : null
  return { start, stop, label }
}

function countWords(html: string): number {
  const text = html.replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim()
  return text.split(' ').filter(Boolean).length
}

function CopyButton({ text }: { text: string }) {
  const [copied, setCopied] = useState(false)

  async function handleCopy() {
    try {
      await navigator.clipboard.writeText(text)
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    } catch { /* ignore */ }
  }

  return (
    <button
      type="button"
      onClick={handleCopy}
      className="px-3 py-1.5 rounded text-xs bg-[#1f1f1f] border border-[#2a2a2a] text-[#a1a1aa] hover:text-[#ededed] hover:border-[#3a3a3a] transition-colors"
    >
      {copied ? 'Copied!' : 'Copy HTML'}
    </button>
  )
}

function ComparisonTab() {
  const [product1, setProduct1] = useState('')
  const [product2, setProduct2] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [result, setResult] = useState<{ html: string } | null>(null)
  const stages = useLoadingStages(loading)

  async function handleSubmit(e: FormEvent) {
    e.preventDefault()
    if (!product1.trim() || !product2.trim()) return
    setError(null)
    setResult(null)
    setLoading(true)
    stages.start()

    try {
      const res = await fetch('/api/generate/comparison', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ product1: product1.trim(), product2: product2.trim() }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || 'Generation failed')
      setResult({ html: data.html })
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Something went wrong')
    } finally {
      stages.stop()
      setLoading(false)
    }
  }

  const wordCount = result ? countWords(result.html) : 0

  return (
    <div>
      <p className="text-[#6b7280] text-sm mb-6">
        Enter two products to generate a publish-ready comparison page with affiliate CTA placeholders.
      </p>

      <form onSubmit={handleSubmit} className="mb-6">
        <div className="flex gap-3 mb-3">
          <input
            type="text"
            value={product1}
            onChange={(e) => setProduct1(e.target.value)}
            placeholder="e.g. NordVPN"
            disabled={loading}
            className="flex-1 px-4 py-2.5 rounded-lg bg-[#111111] border border-[#2a2a2a] text-[#ededed] placeholder-[#4b5563] text-sm focus:outline-none focus:border-[#22d3ee] transition-colors disabled:opacity-50"
          />
          <div className="flex items-center text-[#4b5563] text-sm font-mono px-1">vs</div>
          <input
            type="text"
            value={product2}
            onChange={(e) => setProduct2(e.target.value)}
            placeholder="e.g. ExpressVPN"
            disabled={loading}
            className="flex-1 px-4 py-2.5 rounded-lg bg-[#111111] border border-[#2a2a2a] text-[#ededed] placeholder-[#4b5563] text-sm focus:outline-none focus:border-[#22d3ee] transition-colors disabled:opacity-50"
          />
        </div>

        <button
          type="submit"
          disabled={loading || !product1.trim() || !product2.trim()}
          className="px-5 py-2.5 rounded-lg bg-[#22d3ee] text-[#0a0a0a] font-semibold text-sm transition-opacity hover:opacity-90 disabled:opacity-40 disabled:cursor-not-allowed"
        >
          {loading ? stages.label ?? 'Working…' : 'Generate comparison'}
        </button>
      </form>

      {error && (
        <p className="text-red-400 text-sm mb-4">{error}</p>
      )}

      {loading && (
        <div className="rounded-lg border border-[#1f1f1f] bg-[#111111] p-6 text-center animate-pulse">
          <p className="text-[#6b7280] text-sm">{stages.label}</p>
          <p className="text-xs text-[#4b5563] mt-1">This takes ~20–30 seconds</p>
        </div>
      )}

      {result && !loading && (
        <div>
          <div className="flex items-center justify-between mb-3">
            <div className="flex items-center gap-3">
              <span className="text-xs text-[#6b7280]">Preview</span>
              <span className="text-xs font-mono text-[#4b5563] bg-[#1f1f1f] px-2 py-0.5 rounded">
                {wordCount.toLocaleString()} words
              </span>
            </div>
            <CopyButton text={result.html} />
          </div>

          <div
            className="rounded-lg border border-[#1f1f1f] bg-white text-[#111111] p-8 max-h-[70vh] overflow-y-auto"
            // biome-ignore lint/security/noDangerouslySetInnerHtml: trusted Gemini output rendered for preview
            dangerouslySetInnerHTML={{ __html: result.html }}
          />
        </div>
      )}
    </div>
  )
}

function PlaceholderTab({ label }: { label: string }) {
  return (
    <p className="text-[#6b7280] text-sm">{label} — coming soon.</p>
  )
}

export default function ToolsPage() {
  const [tab, setTab] = useState<Tab>('comparison')

  const tabs: { id: Tab; label: string }[] = [
    { id: 'comparison', label: 'Comparison Page' },
    { id: 'brief', label: 'Content Brief' },
    { id: 'headline', label: 'Headline Tester' },
  ]

  return (
    <div className="p-8 max-w-4xl">
      <h1 className="text-2xl font-semibold mb-1">Tools</h1>
      <p className="text-[#6b7280] text-sm mb-6">AI-powered content generation tools.</p>

      {/* Tab bar */}
      <div className="flex gap-1 mb-8 border-b border-[#1f1f1f]">
        {tabs.map((t) => (
          <button
            key={t.id}
            type="button"
            onClick={() => setTab(t.id)}
            className={`px-4 py-2 text-sm transition-colors border-b-2 -mb-px ${
              tab === t.id
                ? 'text-[#22d3ee] border-[#22d3ee]'
                : 'text-[#6b7280] border-transparent hover:text-[#a1a1aa]'
            }`}
          >
            {t.label}
          </button>
        ))}
      </div>

      {/* Tab content */}
      {tab === 'comparison' && <ComparisonTab />}
      {tab === 'brief' && <PlaceholderTab label="Content Brief" />}
      {tab === 'headline' && <PlaceholderTab label="Headline Tester" />}
    </div>
  )
}
