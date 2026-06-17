'use client'
import { ThemeProvider } from 'next-themes'
import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { Sun, Moon } from 'lucide-react'
import { useTheme } from 'next-themes'

function ThemeToggle() {
  const { theme, setTheme } = useTheme()
  return (
    <button
      type="button"
      onClick={() => setTheme(theme === 'dark' ? 'light' : 'dark')}
      className="h-9 w-9 flex items-center justify-center rounded-full hover:bg-[var(--surface-2)] transition-colors text-[var(--text-secondary)] hover:text-[var(--text-primary)]"
      aria-label="Toggle theme"
    >
      <Sun className="h-4 w-4 hidden dark:block" />
      <Moon className="h-4 w-4 block dark:hidden" />
    </button>
  )
}

function TopNav() {
  const pathname = usePathname()
  const links = [
    { href: '/', label: 'Solutions' },
    { href: '/audit', label: 'Quick Audit' },
    { href: '/tools', label: 'Tools' },
    { href: '/history', label: 'History' },
  ]
  return (
    <header className="fixed top-0 left-0 right-0 z-50 h-16 border-b border-[var(--border)] bg-[var(--bg)]/80 backdrop-blur-xl">
      <div className="max-w-[1200px] mx-auto px-6 h-full flex items-center justify-between gap-8">
        <Link href="/" className="flex items-center gap-2.5 flex-shrink-0 group">
          <div className="h-8 w-8 rounded-lg bg-[#8b5cf6] flex items-center justify-center shadow-sm group-hover:scale-105 transition-transform">
            <span className="text-white text-sm font-bold">G</span>
          </div>
          <span className="font-semibold text-[var(--text-primary)] text-base tracking-tight">GrowthLab</span>
        </Link>

        <nav className="hidden md:flex items-center gap-8">
          {links.map(link => {
            const active = pathname === link.href || (pathname.startsWith(link.href) && link.href !== '/')
            return (
              <Link
                key={link.href}
                href={link.href}
                className={`text-sm font-medium transition-colors hover:text-[var(--text-primary)] relative py-5 ${
                  active ? 'text-[var(--text-primary)]' : 'text-[var(--text-secondary)]'
                }`}
              >
                {link.label}
                {active && (
                  <span className="absolute bottom-0 left-0 right-0 h-[2px] bg-[var(--text-primary)] rounded-t-full" />
                )}
              </Link>
            )
          })}
        </nav>

        <div className="flex items-center gap-4">
          <ThemeToggle />
          <Link href="/" className="hidden md:flex h-9 items-center justify-center rounded-full bg-[var(--text-primary)] text-[var(--bg)] px-5 text-sm font-medium hover:opacity-90 transition-opacity">
            New Report
          </Link>
        </div>
      </div>
    </header>
  )
}

export function Providers({ children }: { children: React.ReactNode }) {
  return (
    <ThemeProvider attribute="class" defaultTheme="dark" enableSystem={false}>
      <TopNav />
      <main className="pt-16 min-h-screen bg-[var(--bg)]">
        {children}
      </main>
    </ThemeProvider>
  )
}
