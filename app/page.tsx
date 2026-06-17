'use client'
import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { ArrowRight, Search, FileText, BarChart2, Zap, Clock, TrendingUp } from 'lucide-react'
import Link from 'next/link'

export default function HomePage() {
  const router = useRouter()
  const [targetUrl, setTargetUrl] = useState('')
  const [topic, setTopic] = useState('')
  const [competitor1, setCompetitor1] = useState('')
  const [competitor2, setCompetitor2] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!targetUrl || !topic) return
    setLoading(true)
    setError('')
    try {
      const res = await fetch('/api/report', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          targetUrl,
          topic,
          competitorUrls: [competitor1, competitor2].filter(Boolean),
        }),
      })
      const data = await res.json()
      if (data.reportId) router.push(`/report/${data.reportId}`)
      else setError('Failed to create report')
    } catch {
      setError('Something went wrong')
    } finally {
      setLoading(false)
    }
  }

  function handleDemo() {
    setTargetUrl('https://backlinko.com')
    setTopic('SEO tools')
    setCompetitor1('https://ahrefs.com')
    setCompetitor2('https://semrush.com')
  }

  const tools = [
    {
      category: 'PRESENCE ANALYSIS',
      icon: Search,
      title: 'Digital Brand Visibility',
      description: 'Map the competitive landscape across 12 commercial queries. Know exactly where to attack, backed by real SERP signals.',
      href: '/',
    },
    {
      category: 'CONTENT GENERATION',
      icon: FileText,
      title: 'One-Click Content Pages',
      description: 'SEO-optimized comparison pages with affiliate CTAs, researched and written by AI in under 60 seconds.',
      href: '/tools',
    },
    {
      category: 'EDITORIAL PLANNING',
      icon: BarChart2,
      title: 'Data-Driven Briefs',
      description: 'Full editorial briefs for any keyword gap — structure, word count, CTAs, secondary keywords, and commissioning notes.',
      href: '/tools',
    },
    {
      category: 'COPY OPTIMIZATION',
      icon: Zap,
      title: 'AI Headline Tester',
      description: '5 AI-scored variants per goal. Combine the strongest elements into one title that drives traffic before you publish.',
      href: '/tools',
    },
    {
      category: 'MONITORING',
      icon: Clock,
      title: 'Landscape Monitoring',
      description: 'Presence checks re-run every 24 hours. Track any report and wake up to fresh, accurate competitive data.',
      href: '/history',
    },
    {
      category: 'TECHNICAL SEO',
      icon: TrendingUp,
      title: 'Technical Site Audit',
      description: 'Score every crawled page 0-100. Instantly surface title tag, meta description, alt text, and speed issues.',
      href: '/',
    },
  ]

  return (
    <div className="min-h-screen pb-16 overflow-hidden relative">
      {/* Semrush-style fluid background gradient */}
      <div className="absolute inset-0 overflow-hidden pointer-events-none z-0">
        <div className="absolute top-[-10%] left-[10%] w-[500px] h-[500px] md:w-[800px] md:h-[800px] rounded-full bg-[var(--accent)]/10 blur-[100px] mix-blend-multiply dark:mix-blend-screen animate-pulse" style={{ animationDuration: '8s' }} />
        <div className="absolute top-[5%] right-[10%] w-[400px] h-[400px] md:w-[600px] md:h-[600px] rounded-full bg-[#38bdf8]/10 blur-[100px] mix-blend-multiply dark:mix-blend-screen animate-pulse" style={{ animationDuration: '10s', animationDelay: '1s' }} />
        <div className="absolute bottom-[40%] left-[30%] w-[400px] h-[400px] md:w-[700px] md:h-[700px] rounded-full bg-[#ec4899]/5 blur-[120px] mix-blend-multiply dark:mix-blend-screen animate-pulse" style={{ animationDuration: '12s', animationDelay: '2s' }} />
      </div>

      <div className="relative z-10 max-w-[1000px] mx-auto px-6 pt-10 md:pt-16 text-center">
        {/* Headline */}
        <h1 className="text-[44px] md:text-[64px] lg:text-[76px] font-bold text-[var(--text-primary)] leading-[1.05] tracking-tight mb-4 max-w-4xl mx-auto">
          Find the keywords<br />
          <span className="text-transparent bg-clip-text bg-gradient-to-r from-[var(--text-primary)] to-[var(--text-muted)] dark:from-[var(--text-primary)] dark:to-[#737373]">
            your competitors win.
          </span>
        </h1>

        {/* Subtext */}
        <p className="text-lg md:text-xl text-[var(--text-secondary)] max-w-2xl mx-auto mb-8 leading-relaxed">
          Enter your site and up to two competitors. GrowthLab maps the gaps, scores them by commercial priority, and generates the content to close them.
        </p>

        {/* Form card - Exact Layout Kept */}
        <div className="max-w-2xl mx-auto relative group mb-8">
          <div className="absolute -inset-1 bg-gradient-to-r from-[var(--accent)] to-[#38bdf8] rounded-2xl blur opacity-25 group-hover:opacity-40 transition duration-1000 group-hover:duration-200" />
          <div className="relative bg-[var(--surface)] border border-[var(--border)] rounded-xl p-6 md:p-8 text-left shadow-glass hover:shadow-float transition-all">
            <form onSubmit={handleSubmit} className="space-y-5">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-[10px] font-bold uppercase tracking-[0.12em] text-[var(--text-muted)] mb-1.5">Your site</label>
                  <input
                    type="url"
                    value={targetUrl}
                    onChange={e => setTargetUrl(e.target.value)}
                    placeholder="https://yoursite.com"
                    required
                    className="w-full bg-[var(--bg-secondary)] border border-[var(--border)] rounded-lg px-4 py-3 text-sm text-[var(--text-primary)] placeholder:text-[var(--text-muted)] focus:outline-none focus:border-[var(--accent)] focus:ring-1 focus:ring-[var(--accent)] transition-all shadow-sm"
                  />
                </div>
                <div>
                  <label className="block text-[10px] font-bold uppercase tracking-[0.12em] text-[var(--text-muted)] mb-1.5">Topic / niche</label>
                  <input
                    type="text"
                    value={topic}
                    onChange={e => setTopic(e.target.value)}
                    placeholder="e.g. SEO tools, VPN software"
                    required
                    className="w-full bg-[var(--bg-secondary)] border border-[var(--border)] rounded-lg px-4 py-3 text-sm text-[var(--text-primary)] placeholder:text-[var(--text-muted)] focus:outline-none focus:border-[var(--accent)] focus:ring-1 focus:ring-[var(--accent)] transition-all shadow-sm"
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-[10px] font-bold uppercase tracking-[0.12em] text-[var(--text-muted)] mb-1.5">Competitor 1 <span className="font-normal normal-case opacity-70">(optional)</span></label>
                  <input
                    type="url"
                    value={competitor1}
                    onChange={e => setCompetitor1(e.target.value)}
                    placeholder="https://competitor1.com"
                    className="w-full bg-[var(--bg-secondary)] border border-[var(--border)] rounded-lg px-4 py-3 text-sm text-[var(--text-primary)] placeholder:text-[var(--text-muted)] focus:outline-none focus:border-[var(--accent)] focus:ring-1 focus:ring-[var(--accent)] transition-all shadow-sm"
                  />
                </div>
                <div>
                  <label className="block text-[10px] font-bold uppercase tracking-[0.12em] text-[var(--text-muted)] mb-1.5">Competitor 2 <span className="font-normal normal-case opacity-70">(optional)</span></label>
                  <input
                    type="url"
                    value={competitor2}
                    onChange={e => setCompetitor2(e.target.value)}
                    placeholder="https://competitor2.com"
                    className="w-full bg-[var(--bg-secondary)] border border-[var(--border)] rounded-lg px-4 py-3 text-sm text-[var(--text-primary)] placeholder:text-[var(--text-muted)] focus:outline-none focus:border-[var(--accent)] focus:ring-1 focus:ring-[var(--accent)] transition-all shadow-sm"
                  />
                </div>
              </div>

              {error && <p className="text-xs text-[var(--error)]">{error}</p>}

              <div className="flex items-center gap-3 pt-2">
                <button
                  type="submit"
                  disabled={loading || !targetUrl || !topic}
                  className="flex-[3] bg-[#1e3a5f] hover:bg-[#162d4a] disabled:opacity-40 disabled:cursor-not-allowed text-white font-semibold rounded-lg px-5 py-3 text-sm transition-colors flex items-center justify-center gap-2 shadow-sm"
                >
                  {loading ? 'Running analysis…' : (
                    <>Run Analysis <ArrowRight className="h-4 w-4" /></>
                  )}
                </button>
                <button
                  type="button"
                  onClick={handleDemo}
                  className="flex-[1] px-4 py-3 text-sm font-medium text-[var(--text-secondary)] hover:text-[var(--text-primary)] border border-[var(--border)] bg-white dark:bg-transparent rounded-lg hover:bg-[var(--surface-2)] transition-colors whitespace-nowrap shadow-sm text-center"
                >
                  Try demo
                </button>
              </div>
            </form>
          </div>
        </div>
      </div>

      {/* Tools Section */}
      <div className="relative z-10 max-w-[1200px] mx-auto px-6 pt-12">
        <div className="mb-12">
          <p className="text-xs font-bold uppercase tracking-[0.15em] text-[var(--text-muted)] mb-3">What GrowthLab does</p>
          <h2 className="text-[32px] md:text-[40px] font-bold text-[var(--text-primary)] tracking-tight leading-tight max-w-2xl">
            GET SEEN. GET CITED. BE THE ANSWER.
          </h2>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {tools.map((tool, i) => (
            <Link
              key={i}
              href={tool.href}
              className="group flex flex-col bg-[var(--surface-2)] border border-[var(--border)] rounded-xl p-6 hover:border-[var(--accent-40)] hover:shadow-float transition-all duration-300"
            >
              <div className="flex items-start justify-between mb-4">
                <div className="flex items-center gap-3">
                  <div className="h-10 w-10 rounded-full bg-[var(--surface)] border border-[var(--border)] flex items-center justify-center flex-shrink-0">
                    <tool.icon className="h-5 w-5 text-[var(--accent)]" />
                  </div>
                  <p className="text-[10px] font-bold uppercase tracking-[0.1em] text-[var(--text-secondary)]">
                    {tool.category}
                  </p>
                </div>
                <div className="h-8 w-8 rounded-full border border-[var(--border-2)] flex items-center justify-center text-[var(--text-primary)] group-hover:bg-[var(--text-primary)] group-hover:text-[var(--bg)] transition-colors flex-shrink-0">
                  <ArrowRight className="h-3 w-3 -rotate-45 group-hover:rotate-0 transition-transform duration-300" />
                </div>
              </div>
              <h3 className="text-xl font-semibold text-[var(--text-primary)] leading-tight mb-2 mt-2">
                {tool.title}
              </h3>
              <p className="text-sm text-[var(--text-secondary)] leading-relaxed">
                {tool.description}
              </p>
            </Link>
          ))}
        </div>
      </div>
    </div>
  )
}
