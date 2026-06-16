'use client'

import { useState, FormEvent, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { ArrowRight, Search, FileText, BarChart2, Zap, Clock } from 'lucide-react'

interface RecentReport {
  id: string
  target_url: string
  competitor_urls: string[]
  status: string
  opportunity_score: number | null
  created_at: string
}

function normaliseUrl(raw: string): string {
  const trimmed = raw.trim()
  if (!trimmed) return ''
  return /^https?:\/\//i.test(trimmed) ? trimmed : `https://${trimmed}`
}

function ScoreBadge({ score }: { score: number }) {
  const cls = score >= 60
    ? 'text-red-400'
    : score >= 30
    ? 'text-amber-400'
    : 'text-green-400'
  return <span className={`text-xs font-mono font-bold ${cls}`}>{score}% gap</span>
}

export default function HomePage() {
  const router = useRouter()
  const [targetUrl, setTargetUrl] = useState('')
  const [topic, setTopic] = useState('')
  const [competitor1, setCompetitor1] = useState('')
  const [competitor2, setCompetitor2] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [recentReports, setRecentReports] = useState<RecentReport[]>([])

  useEffect(() => {
    fetch('/api/reports/recent')
      .then((r) => r.json())
      .then((data) => { if (Array.isArray(data)) setRecentReports(data) })
      .catch(() => {})
  }, [])

  function loadDemo() {
    setTargetUrl('https://backlinko.com')
    setTopic('SEO tools')
    setCompetitor1('https://ahrefs.com')
    setCompetitor2('https://semrush.com')
  }

  async function handleSubmit(e: FormEvent) {
    e.preventDefault()
    setError(null)

    const target = normaliseUrl(targetUrl)
    if (!target) { setError('Please enter your site URL'); return }
    if (!topic.trim()) { setError('Please enter a topic / niche'); return }

    const competitors = [competitor1, competitor2]
      .map(normaliseUrl)
      .filter(Boolean)

    setLoading(true)
    try {
      const res = await fetch('/api/report', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ targetUrl: target, topic: topic.trim(), competitorUrls: competitors }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || 'Failed to start report')
      router.push(`/report/${data.reportId}`)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Something went wrong')
      setLoading(false)
    }
  }

  return (
    <div className="relative min-h-screen overflow-hidden bg-black">

      {/* Gradient blobs top right */}
      <div className="flex flex-col items-end absolute -right-60 -top-10 z-0 pointer-events-none">
        <div className="h-[10rem] rounded-full w-[60rem] bg-gradient-to-b blur-[6rem] from-purple-600 to-sky-600 opacity-40" />
        <div className="h-[10rem] rounded-full w-[90rem] bg-gradient-to-b blur-[6rem] from-pink-900 to-yellow-400 opacity-40" />
        <div className="h-[10rem] rounded-full w-[60rem] bg-gradient-to-b blur-[6rem] from-yellow-600 to-sky-500 opacity-40" />
      </div>

      {/* Content */}
      <div className="relative z-10">

        {/* Hero section */}
        <div className="container mx-auto px-4 pt-20 text-center">

          {/* Pill badge */}
          <div className="mx-auto mb-6 flex max-w-fit items-center gap-2 rounded-full bg-white/10 px-4 py-2 backdrop-blur-sm border border-white/10">
            <span className="text-sm font-medium text-white">Competitive Growth Intelligence</span>
            <ArrowRight className="h-4 w-4 text-white" />
          </div>

          {/* Headline */}
          <h1 className="mx-auto max-w-4xl text-5xl font-bold leading-tight text-white md:text-6xl lg:text-7xl">
            Find the gaps.<br />
            <span className="text-[#FF6363]">Close them today.</span>
          </h1>

          <p className="mx-auto mt-6 max-w-2xl text-lg text-gray-400">
            Enter your site and two competitors. GrowthLab finds every commercial
            keyword they win and you don&apos;t — then generates the content to close the gap.
          </p>

          {/* Demo button */}
          <button
            type="button"
            onClick={loadDemo}
            disabled={loading}
            className="mt-8 h-12 rounded-full border border-white/20 px-8 text-sm font-medium text-white hover:bg-white/10 transition-colors backdrop-blur-sm disabled:opacity-40"
          >
            Try a demo — backlinko vs ahrefs vs semrush →
          </button>
        </div>

        {/* Report form card */}
        <div className="container mx-auto px-4 mt-12 max-w-2xl">
          <div className="rounded-2xl bg-white/5 border border-white/10 backdrop-blur-sm p-8">
            <form onSubmit={handleSubmit} className="flex flex-col gap-5">

              <div>
                <label className="block text-xs font-medium text-gray-400 uppercase tracking-wider mb-2">
                  Your site
                </label>
                <input
                  type="text"
                  value={targetUrl}
                  onChange={(e) => setTargetUrl(e.target.value)}
                  placeholder="https://yoursite.com"
                  disabled={loading}
                  className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-white placeholder:text-gray-600 focus:outline-none focus:border-[#FF6363]/50 focus:bg-white/10 transition-all text-sm disabled:opacity-50"
                />
              </div>

              <div>
                <label className="block text-xs font-medium text-gray-400 uppercase tracking-wider mb-2">
                  Site topic / niche
                </label>
                <input
                  type="text"
                  value={topic}
                  onChange={(e) => setTopic(e.target.value)}
                  placeholder="e.g. SEO tools, VPN software, keyword research"
                  required
                  disabled={loading}
                  className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-white placeholder:text-gray-600 focus:outline-none focus:border-[#FF6363]/50 focus:bg-white/10 transition-all text-sm disabled:opacity-50"
                />
                <p className="text-xs text-gray-600 mt-1">Be specific — this determines what keywords we search for</p>
              </div>

              <div>
                <label className="block text-xs font-medium text-gray-400 uppercase tracking-wider mb-2">
                  Competitors <span className="text-gray-600 normal-case font-normal">(up to 2, optional)</span>
                </label>
                <div className="flex flex-col gap-2">
                  <input
                    type="text"
                    value={competitor1}
                    onChange={(e) => setCompetitor1(e.target.value)}
                    placeholder="https://competitor1.com"
                    disabled={loading}
                    className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-white placeholder:text-gray-600 focus:outline-none focus:border-[#FF6363]/50 focus:bg-white/10 transition-all text-sm disabled:opacity-50"
                  />
                  <input
                    type="text"
                    value={competitor2}
                    onChange={(e) => setCompetitor2(e.target.value)}
                    placeholder="https://competitor2.com"
                    disabled={loading}
                    className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-white placeholder:text-gray-600 focus:outline-none focus:border-[#FF6363]/50 focus:bg-white/10 transition-all text-sm disabled:opacity-50"
                  />
                </div>
              </div>

              {error && <p className="text-red-400 text-sm">{error}</p>}

              <button
                type="submit"
                disabled={loading || !targetUrl.trim() || !topic.trim()}
                className="w-full h-12 rounded-full bg-[#FF6363] hover:bg-[#ff4444] text-white font-medium transition-colors text-sm disabled:opacity-40 disabled:cursor-not-allowed"
              >
                {loading ? 'Starting analysis…' : 'Run Competitive Analysis'}
              </button>
            </form>
          </div>
        </div>

        {/* Feature cards grid */}
        <div className="container mx-auto px-4 mt-16 max-w-5xl pb-20">
          <p className="text-xs text-gray-600 uppercase tracking-widest text-center mb-8">
            What GrowthLab does
          </p>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">

            {/* Presence Matrix */}
            <Link href="/" className="group rounded-2xl bg-white/5 border border-white/10 backdrop-blur-sm p-6 hover:bg-white/10 hover:border-white/20 transition-all">
              <div className="flex items-center justify-between mb-4">
                <div className="h-10 w-10 rounded-xl bg-[#FF6363]/20 flex items-center justify-center">
                  <Search className="h-5 w-5 text-[#FF6363]" />
                </div>
                <ArrowRight className="h-4 w-4 text-gray-600 group-hover:text-white group-hover:translate-x-1 transition-all" />
              </div>
              <h3 className="text-white font-semibold mb-2">Presence Matrix</h3>
              <p className="text-gray-500 text-sm leading-relaxed">
                12 keyword queries. See exactly where competitors appear in results and you don&apos;t.
              </p>
            </Link>

            {/* Comparison Pages */}
            <Link href="/tools" className="group rounded-2xl bg-white/5 border border-white/10 backdrop-blur-sm p-6 hover:bg-white/10 hover:border-white/20 transition-all">
              <div className="flex items-center justify-between mb-4">
                <div className="h-10 w-10 rounded-xl bg-purple-500/20 flex items-center justify-center">
                  <FileText className="h-5 w-5 text-purple-400" />
                </div>
                <ArrowRight className="h-4 w-4 text-gray-600 group-hover:text-white group-hover:translate-x-1 transition-all" />
              </div>
              <h3 className="text-white font-semibold mb-2">Comparison Pages</h3>
              <p className="text-gray-500 text-sm leading-relaxed">
                Generate publish-ready HTML comparison pages with affiliate CTA placeholders.
              </p>
            </Link>

            {/* Content Briefs */}
            <Link href="/tools" className="group rounded-2xl bg-white/5 border border-white/10 backdrop-blur-sm p-6 hover:bg-white/10 hover:border-white/20 transition-all">
              <div className="flex items-center justify-between mb-4">
                <div className="h-10 w-10 rounded-xl bg-blue-500/20 flex items-center justify-center">
                  <BarChart2 className="h-5 w-5 text-blue-400" />
                </div>
                <ArrowRight className="h-4 w-4 text-gray-600 group-hover:text-white group-hover:translate-x-1 transition-all" />
              </div>
              <h3 className="text-white font-semibold mb-2">Content Briefs</h3>
              <p className="text-gray-500 text-sm leading-relaxed">
                Full content brief for any keyword: structure, word count, CTAs, competitors.
              </p>
            </Link>

            {/* Headline Tester */}
            <Link href="/tools" className="group rounded-2xl bg-white/5 border border-white/10 backdrop-blur-sm p-6 hover:bg-white/10 hover:border-white/20 transition-all">
              <div className="flex items-center justify-between mb-4">
                <div className="h-10 w-10 rounded-xl bg-green-500/20 flex items-center justify-center">
                  <Zap className="h-5 w-5 text-green-400" />
                </div>
                <ArrowRight className="h-4 w-4 text-gray-600 group-hover:text-white group-hover:translate-x-1 transition-all" />
              </div>
              <h3 className="text-white font-semibold mb-2">Headline Tester</h3>
              <p className="text-gray-500 text-sm leading-relaxed">
                5 AI-scored headline variants per goal. Combine the best into one.
              </p>
            </Link>

            {/* Daily Re-audits */}
            <Link href="/history" className="group rounded-2xl bg-white/5 border border-white/10 backdrop-blur-sm p-6 hover:bg-white/10 hover:border-white/20 transition-all">
              <div className="flex items-center justify-between mb-4">
                <div className="h-10 w-10 rounded-xl bg-amber-500/20 flex items-center justify-center">
                  <Clock className="h-5 w-5 text-amber-400" />
                </div>
                <ArrowRight className="h-4 w-4 text-gray-600 group-hover:text-white group-hover:translate-x-1 transition-all" />
              </div>
              <h3 className="text-white font-semibold mb-2">Daily Re-audits</h3>
              <p className="text-gray-500 text-sm leading-relaxed">
                Track competitors. Presence checks re-run automatically every 24 hours via cron.
              </p>
            </Link>

            {/* Recent Reports */}
            <div className="rounded-2xl bg-white/5 border border-white/10 backdrop-blur-sm p-6">
              <p className="text-xs text-gray-600 uppercase tracking-widest mb-4">Recent Reports</p>
              {recentReports.length === 0 && (
                <p className="text-gray-600 text-sm">No reports yet.</p>
              )}
              <ul className="flex flex-col gap-2">
                {recentReports.map((r) => (
                  <li key={r.id}>
                    <Link
                      href={`/report/${r.id}`}
                      className="flex items-center justify-between group"
                    >
                      <span className="text-sm text-gray-400 group-hover:text-white truncate transition-colors">
                        {r.target_url.replace(/^https?:\/\//, '')}
                      </span>
                      <div className="flex items-center gap-2 flex-shrink-0 ml-3">
                        {r.opportunity_score != null && (
                          <ScoreBadge score={r.opportunity_score} />
                        )}
                        <span className="text-xs text-gray-600">
                          {new Date(r.created_at).toLocaleDateString()}
                        </span>
                      </div>
                    </Link>
                  </li>
                ))}
              </ul>
            </div>

          </div>
        </div>
      </div>
    </div>
  )
}
