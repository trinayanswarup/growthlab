'use client'

import { useState, FormEvent, useRef } from 'react'
import type { HeadlineVariant } from '@/types'

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

function CopyButton({ text, label = 'Copy HTML' }: { text: string; label?: string }) {
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
      className="px-3 py-1.5 rounded-lg text-xs bg-[#1a1a1a] border border-[#222222] text-[#8b8b8b] hover:text-[#ededed] hover:border-[#3a3a3a] transition-colors"
    >
      {copied ? 'Copied!' : label}
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
      <p className="text-[#8b8b8b] text-sm mb-6">
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
            className="flex-1 px-4 py-2.5 rounded-lg bg-[#111111] border border-[#222222] text-[#ededed] placeholder-[#4b4b4b] text-sm focus:outline-none focus:border-[#ff6363] transition-colors disabled:opacity-50"
          />
          <div className="flex items-center text-[#4b4b4b] text-sm font-mono px-1">vs</div>
          <input
            type="text"
            value={product2}
            onChange={(e) => setProduct2(e.target.value)}
            placeholder="e.g. ExpressVPN"
            disabled={loading}
            className="flex-1 px-4 py-2.5 rounded-lg bg-[#111111] border border-[#222222] text-[#ededed] placeholder-[#4b4b4b] text-sm focus:outline-none focus:border-[#ff6363] transition-colors disabled:opacity-50"
          />
        </div>

        <button
          type="submit"
          disabled={loading || !product1.trim() || !product2.trim()}
          className="px-5 py-2.5 rounded-lg bg-[#ff6363] text-[#0a0a0a] font-semibold text-sm transition-colors hover:bg-[#ff4444] disabled:opacity-40 disabled:cursor-not-allowed"
        >
          {loading ? stages.label ?? 'Working…' : 'Generate comparison'}
        </button>
      </form>

      {error && <p className="text-red-400 text-sm mb-4">{error}</p>}

      {loading && (
        <div className="rounded-2xl border border-[#222222] bg-[#111111] p-6 text-center animate-pulse">
          <p className="text-[#8b8b8b] text-sm">{stages.label}</p>
          <p className="text-xs text-[#4b4b4b] mt-1">This takes ~20–30 seconds</p>
        </div>
      )}

      {result && !loading && (
        <div>
          <div className="flex items-center justify-between mb-3">
            <div className="flex items-center gap-3">
              <span className="text-xs text-[#8b8b8b]">Preview</span>
              <span className="text-xs font-mono text-[#8b8b8b] bg-[#1a1a1a] px-2 py-0.5 rounded">
                {wordCount.toLocaleString()} words
              </span>
            </div>
            <CopyButton text={result.html} />
          </div>

          <div
            className="rounded-2xl border border-[#222222] bg-white text-[#111111] p-8 max-h-[70vh] overflow-y-auto"
            // biome-ignore lint/security/noDangerouslySetInnerHtml: trusted Gemini output rendered for preview
            dangerouslySetInnerHTML={{ __html: result.html }}
          />
        </div>
      )}
    </div>
  )
}

const HEADLINE_GOALS = [
  { id: 'Maximize CTR',        label: 'Maximize CTR' },
  { id: 'Increase authority',  label: 'Increase authority' },
  { id: 'Curiosity gap',       label: 'Curiosity gap' },
  { id: 'Target keyword',      label: 'Target keyword' },
  { id: 'Emotional resonance', label: 'Emotional resonance' },
] as const

function HeadlineTab() {
  const [headline, setHeadline] = useState('')
  const [goal, setGoal] = useState<string>('Maximize CTR')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [variants, setVariants] = useState<HeadlineVariant[] | null>(null)
  const [combining, setCombining] = useState(false)
  const [combined, setCombined] = useState<string | null>(null)

  async function handleSubmit(e: FormEvent) {
    e.preventDefault()
    if (!headline.trim()) return
    setError(null)
    setVariants(null)
    setCombined(null)
    setLoading(true)

    try {
      const res = await fetch('/api/generate/headline', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ headline: headline.trim(), goal }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || 'Generation failed')
      const sorted = [...(data.variants as HeadlineVariant[])].sort(
        (a, b) => (b.estimatedCTRScore ?? 0) - (a.estimatedCTRScore ?? 0)
      )
      setVariants(sorted)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Something went wrong')
    } finally {
      setLoading(false)
    }
  }

  async function handleCombine() {
    if (!variants) return
    setCombining(true)
    setCombined(null)
    try {
      const res = await fetch('/api/generate/headline/combine', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ variants }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || 'Combine failed')
      setCombined(data.combined)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Something went wrong')
    } finally {
      setCombining(false)
    }
  }

  return (
    <div>
      <p className="text-[#8b8b8b] text-sm mb-6">
        Test a headline against 5 variants optimised for your goal.
      </p>

      <form onSubmit={handleSubmit} className="mb-6 flex flex-col gap-4">
        <div>
          <label className="block text-xs font-medium text-[#8b8b8b] mb-1.5 uppercase tracking-wider">
            Headline
          </label>
          <input
            type="text"
            value={headline}
            onChange={(e) => setHeadline(e.target.value)}
            placeholder="e.g. Best VPN for Streaming 2025"
            disabled={loading}
            className="w-full px-4 py-2.5 rounded-lg bg-[#111111] border border-[#222222] text-[#ededed] placeholder-[#4b4b4b] text-sm focus:outline-none focus:border-[#ff6363] transition-colors disabled:opacity-50"
          />
        </div>

        <div>
          <p className="text-xs font-medium text-[#8b8b8b] mb-2 uppercase tracking-wider">Goal</p>
          <div className="flex flex-wrap gap-2">
            {HEADLINE_GOALS.map((g) => (
              <label key={g.id} className="flex items-center gap-2 cursor-pointer">
                <input
                  type="radio"
                  name="goal"
                  value={g.id}
                  checked={goal === g.id}
                  onChange={() => setGoal(g.id)}
                  disabled={loading}
                  className="accent-[#ff6363]"
                />
                <span className="text-sm text-[#b0b0b0]">{g.label}</span>
              </label>
            ))}
          </div>
        </div>

        <button
          type="submit"
          disabled={loading || !headline.trim()}
          className="self-start px-5 py-2.5 rounded-lg bg-[#ff6363] text-[#0a0a0a] font-semibold text-sm transition-colors hover:bg-[#ff4444] disabled:opacity-40 disabled:cursor-not-allowed"
        >
          {loading ? 'Testing…' : 'Test headline'}
        </button>
      </form>

      {error && <p className="text-red-400 text-sm mb-4">{error}</p>}

      {loading && (
        <div className="rounded-2xl border border-[#222222] bg-[#111111] p-6 text-center animate-pulse">
          <p className="text-[#8b8b8b] text-sm">Generating variants…</p>
        </div>
      )}

      {variants && variants.length > 0 && (
        <div>
          <div className="flex flex-col gap-3 mb-6">
            {variants.map((v, i) => (
              <div key={i} className="rounded-2xl border border-[#222222] bg-[#111111] p-4">
                <div className="flex items-start justify-between gap-3 mb-2">
                  <p className="text-sm font-medium text-[#ededed] leading-snug">{v.variant}</p>
                  <span className="flex-shrink-0 text-xs font-mono font-bold text-[#ff6363] bg-[#ff6363]/10 px-2 py-0.5 rounded">
                    {v.estimatedCTRScore}
                  </span>
                </div>
                <p className="text-xs text-amber-400 mb-1">{v.angle}</p>
                <p className="text-xs text-[#8b8b8b]">{v.reasoning}</p>
              </div>
            ))}
          </div>

          {!combined && (
            <button
              type="button"
              onClick={handleCombine}
              disabled={combining}
              className="px-4 py-2.5 rounded-lg border border-[#ff6363]/40 text-[#ff6363] text-sm font-medium hover:bg-[#ff6363]/10 transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
            >
              {combining ? 'Combining…' : 'Combine best elements'}
            </button>
          )}

          {combined && (
            <div className="rounded-2xl border border-[#ff6363]/30 bg-[#ff6363]/5 p-4">
              <div className="flex items-center justify-between mb-2">
                <p className="text-xs text-[#8b8b8b] uppercase tracking-wider">Best headline</p>
                <CopyButton text={combined} label="Copy" />
              </div>
              <p className="text-base font-semibold text-[#ff6363]">{combined}</p>
            </div>
          )}
        </div>
      )}

      {variants && variants.length === 0 && !loading && (
        <p className="text-[#8b8b8b] text-sm">No variants returned — try a different headline.</p>
      )}
    </div>
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
    <div className="px-6 py-10 max-w-4xl mx-auto">
      <h1 className="text-2xl font-semibold mb-1">Tools</h1>
      <p className="text-[#8b8b8b] text-sm mb-6">AI-powered content generation tools.</p>

      {/* Tab bar */}
      <div className="flex gap-1 mb-8 border-b border-[#222222]">
        {tabs.map((t) => (
          <button
            key={t.id}
            type="button"
            onClick={() => setTab(t.id)}
            className={`px-4 py-2 text-sm transition-colors border-b-2 -mb-px ${
              tab === t.id
                ? 'text-[#ff6363] border-[#ff6363]'
                : 'text-[#8b8b8b] border-transparent hover:text-[#ededed]'
            }`}
          >
            {t.label}
          </button>
        ))}
      </div>

      {tab === 'comparison' && <ComparisonTab />}
      {tab === 'brief' && (
        <p className="text-[#8b8b8b] text-sm">
          Content briefs are generated inline from the presence matrix — click &ldquo;Generate →&rdquo; on any gap row in a report.
        </p>
      )}
      {tab === 'headline' && <HeadlineTab />}
    </div>
  )
}
