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
      className="px-3 py-1.5 rounded-lg text-xs bg-[var(--surface-2)] border border-[var(--border)] text-[var(--text-secondary)] hover:text-[var(--text-primary)] hover:border-[var(--border-2)] transition-colors"
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
      <p className="text-[var(--text-secondary)] text-sm mb-6">
        Enter two products to generate a publish-ready comparison page with affiliate CTA placeholders.
      </p>

      <div className="bg-[var(--surface)] border border-[var(--border)] rounded-xl p-6 mb-6">
      <form onSubmit={handleSubmit} className="mb-0">
        <div className="flex gap-3 mb-3">
          <input
            type="text"
            value={product1}
            onChange={(e) => setProduct1(e.target.value)}
            placeholder="e.g. NordVPN"
            disabled={loading}
            className="flex-1 px-4 py-2.5 rounded-lg bg-[var(--surface)] border border-[var(--border)] text-[var(--text-primary)] placeholder-[var(--text-muted)] text-sm focus:outline-none focus:border-[var(--accent)] transition-colors disabled:opacity-50"
          />
          <div className="flex items-center text-[var(--text-muted)] text-sm font-mono px-1">vs</div>
          <input
            type="text"
            value={product2}
            onChange={(e) => setProduct2(e.target.value)}
            placeholder="e.g. ExpressVPN"
            disabled={loading}
            className="flex-1 px-4 py-2.5 rounded-lg bg-[var(--surface)] border border-[var(--border)] text-[var(--text-primary)] placeholder-[var(--text-muted)] text-sm focus:outline-none focus:border-[var(--accent)] transition-colors disabled:opacity-50"
          />
        </div>

        <button
          type="submit"
          disabled={loading || !product1.trim() || !product2.trim()}
          className="px-5 py-2.5 rounded-lg bg-[var(--accent)] text-white font-semibold text-sm transition-colors hover:bg-[var(--accent-hover)] disabled:opacity-40 disabled:cursor-not-allowed"
        >
          {loading ? stages.label ?? 'Working…' : 'Generate comparison'}
        </button>
      </form>
      </div>

      {error && <p className="text-red-400 text-sm mb-4">{error}</p>}

      {loading && (
        <div className="rounded-xl border border-[var(--border)] bg-[var(--surface)] p-6 text-center animate-pulse">
          <p className="text-[var(--text-secondary)] text-sm">{stages.label}</p>
          <p className="text-xs text-[var(--text-muted)] mt-1">This takes ~20–30 seconds</p>
        </div>
      )}

      {result && !loading && (
        <div>
          <div className="rounded-lg border border-[var(--border)] bg-[var(--surface)] overflow-hidden shadow-glass">
            <div className="bg-[var(--surface-2)] px-4 py-3 border-b border-[var(--border)] flex items-center justify-between">
              <div className="flex gap-2">
                <div className="w-3 h-3 rounded-full bg-red-400" />
                <div className="w-3 h-3 rounded-full bg-yellow-400" />
                <div className="w-3 h-3 rounded-full bg-green-400" />
              </div>
              <div className="flex items-center gap-3">
                <span className="text-xs text-[var(--text-muted)]">{wordCount.toLocaleString()} words</span>
                <CopyButton text={result.html} />
              </div>
            </div>
            <div
              className="p-8 max-h-[600px] overflow-y-auto bg-white text-[#111111] text-[15px] leading-relaxed [&_h1]:text-[28px] [&_h1]:font-bold [&_h1]:mb-6 [&_h1]:leading-tight [&_h2]:text-[22px] [&_h2]:font-bold [&_h2]:mt-8 [&_h2]:mb-4 [&_h3]:text-[18px] [&_h3]:font-semibold [&_h3]:mt-6 [&_h3]:mb-3 [&_p]:mb-5 [&_ul]:list-disc [&_ul]:pl-5 [&_ul]:mb-5 [&_li]:mb-2 [&_table]:w-full [&_table]:border-collapse [&_table]:mb-8 [&_th]:border-b [&_th]:border-gray-300 [&_th]:py-3 [&_th]:text-left [&_th]:font-semibold [&_td]:border-b [&_td]:border-gray-200 [&_td]:py-3 [&_strong]:font-semibold"
              // biome-ignore lint/security/noDangerouslySetInnerHtml: trusted Gemini output rendered for preview
              dangerouslySetInnerHTML={{ __html: result.html }}
            />
          </div>
          <p className="text-xs text-[var(--text-muted)] mt-3 italic">
            AI-generated first draft. Verify prices, claims, and product details before publishing.
          </p>
        </div>
      )}
    </div>
  )
}

const HEADLINE_GOALS = [
  { id: 'Maximize CTR', label: 'Maximize CTR' },
  { id: 'Increase authority', label: 'Increase authority' },
  { id: 'Curiosity gap', label: 'Curiosity gap' },
  { id: 'Target keyword', label: 'Target keyword' },
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
      <p className="text-[var(--text-secondary)] text-sm mb-6">
        Test a headline against 5 variants optimised for your goal.
      </p>

      <div className="bg-[var(--surface)] border border-[var(--border)] rounded-xl p-6 mb-6">
      <form onSubmit={handleSubmit} className="mb-0 flex flex-col gap-4">
        <div>
          <label className="block text-xs font-medium text-[var(--text-secondary)] mb-1.5 uppercase tracking-wider">
            Headline
          </label>
          <input
            type="text"
            value={headline}
            onChange={(e) => setHeadline(e.target.value)}
            placeholder="e.g. Best VPN for Streaming 2025"
            disabled={loading}
            className="w-full px-4 py-2.5 rounded-lg bg-[var(--bg-secondary)] border border-[var(--border)] text-[var(--text-primary)] placeholder-[var(--text-muted)] text-sm focus:outline-none focus:border-[var(--accent)] transition-colors disabled:opacity-50"
          />
        </div>

        <div>
          <p className="text-xs font-medium text-[var(--text-secondary)] mb-2 uppercase tracking-wider">Goal</p>
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
                  className="accent-[var(--accent)]"
                />
                <span className="text-sm text-[var(--text-secondary)]">{g.label}</span>
              </label>
            ))}
          </div>
        </div>

        <button
          type="submit"
          disabled={loading || !headline.trim()}
          className="self-start px-5 py-2.5 rounded-lg bg-[var(--accent)] text-white font-semibold text-sm transition-colors hover:bg-[var(--accent-hover)] disabled:opacity-40 disabled:cursor-not-allowed"
        >
          {loading ? 'Testing…' : 'Test headline'}
        </button>
      </form>
      </div>

      {error && <p className="text-red-400 text-sm mb-4">{error}</p>}

      {loading && (
        <div className="rounded-xl border border-[var(--border)] bg-[var(--surface)] p-6 text-center animate-pulse">
          <p className="text-[var(--text-secondary)] text-sm">Generating variants…</p>
        </div>
      )}

      {variants && variants.length > 0 && (
        <div>
          <div className="bg-[var(--surface)] border border-[var(--border)] rounded-lg overflow-hidden mb-8 shadow-sm">
            <div className="divide-y divide-[var(--border)]">
              {variants.map((v, i) => (
                <div key={i} className="p-5 flex gap-5 hover:bg-[var(--surface-2)] transition-colors">
                  <div className="flex-shrink-0 flex flex-col items-center justify-center w-12 h-12 rounded-full bg-[var(--accent-10)] text-[var(--accent)] font-mono font-bold text-lg border border-[var(--accent-30)] shadow-sm" title="AI Score">
                    {v.estimatedCTRScore}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-base font-semibold text-[var(--navy)] leading-snug mb-2">{v.variant}</p>
                    <div className="flex items-center gap-2 mb-2">
                      <span className="text-[10px] uppercase tracking-wider font-bold text-[var(--commercial)] bg-[var(--commercial-light)] px-2 py-0.5 rounded-sm border border-[var(--commercial)]/20">
                        {v.angle}
                      </span>
                      <span className="text-[10px] text-[var(--text-muted)] uppercase tracking-wider">AI Score</span>
                    </div>
                    <p className="text-sm text-[var(--text-secondary)] leading-relaxed">{v.reasoning}</p>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {!combined && (
            <button
              type="button"
              onClick={handleCombine}
              disabled={combining}
              className="px-4 py-2.5 rounded-lg border border-[var(--accent-40)] text-[var(--accent)] text-sm font-medium hover:bg-[var(--accent-10)] transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
            >
              {combining ? 'Combining…' : 'Combine best elements'}
            </button>
          )}

          {combined && (
            <div className="rounded-lg border border-[var(--accent)] bg-[var(--accent-5)] p-6 mt-8">
              <div className="flex items-center justify-between mb-3">
                <span className="text-xs font-bold text-[var(--accent)] uppercase tracking-wider">AI Combined Winner</span>
                <CopyButton text={combined} label="Copy" />
              </div>
              <p className="text-xl md:text-2xl font-bold text-[var(--navy)] leading-snug">{combined}</p>
              <p className="text-xs text-[var(--text-muted)] mt-3 italic">
                AI-generated first draft. Verify prices, claims, and product details before publishing.
              </p>
            </div>
          )}
        </div>
      )}

      {variants && variants.length === 0 && !loading && (
        <p className="text-[var(--text-secondary)] text-sm">No variants returned — try a different headline.</p>
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
    <div className="p-8 max-w-5xl mx-auto">
      <h1 className="text-2xl font-semibold mb-1">Tools</h1>
      <p className="text-[var(--text-secondary)] text-sm mb-6">AI-powered content generation tools.</p>

      <div className="flex border-b border-[var(--border)] mb-6 gap-6">
        {tabs.map((t) => (
          <button
            key={t.id}
            type="button"
            onClick={() => setTab(t.id)}
            className={`pb-3 text-sm transition-colors -mb-px ${
              tab === t.id
                ? 'text-[var(--navy)] font-semibold border-b-2 border-[var(--accent)]'
                : 'text-[var(--text-secondary)] hover:text-[var(--text-primary)]'
            }`}
          >
            {t.label}
          </button>
        ))}
      </div>

      {tab === 'comparison' && <ComparisonTab />}
      {tab === 'brief' && (
        <p className="text-[var(--text-secondary)] text-sm">
          Content briefs are generated inline from the presence matrix — click &ldquo;Generate →&rdquo; on any gap row in a report.
        </p>
      )}
      {tab === 'headline' && <HeadlineTab />}
    </div>
  )
}
