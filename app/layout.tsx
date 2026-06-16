import type { Metadata } from 'next'
import { Inter } from 'next/font/google'
import Link from 'next/link'
import './globals.css'

const inter = Inter({ subsets: ['latin'] })

export const metadata: Metadata = {
  title: 'GrowthLab — Competitive Growth Intelligence',
  description: 'Find keywords your competitors win. Generate content to close the gap.',
  openGraph: {
    title: 'GrowthLab — Competitive Growth Intelligence',
    description: 'Find keywords your competitors win. Generate content to close the gap.',
    type: 'website',
  },
  twitter: {
    card: 'summary_large_image',
    title: 'GrowthLab — Competitive Growth Intelligence',
    description: 'Find keywords your competitors win. Generate content to close the gap.',
  },
}

export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <html lang="en">
      <body className={`${inter.className} min-h-screen bg-black text-white antialiased`}>
        <nav className="container mx-auto flex items-center justify-between px-4 py-4 mt-4">
          {/* Logo */}
          <Link href="/" className="flex items-center gap-2">
            <div className="flex h-8 w-8 items-center justify-center rounded-full bg-white text-black">
              <span className="font-bold text-sm">G</span>
            </div>
            <span className="text-xl font-bold text-white">GrowthLab</span>
          </Link>
          {/* Nav links */}
          <div className="flex items-center gap-8">
            <Link href="/" className="text-sm text-gray-300 hover:text-white transition-colors">Home</Link>
            <Link href="/history" className="text-sm text-gray-300 hover:text-white transition-colors">History</Link>
            <Link href="/tools" className="text-sm text-gray-300 hover:text-white transition-colors">Tools</Link>
          </div>
        </nav>

        <main className="relative z-10">
          {children}
        </main>
      </body>
    </html>
  )
}
