import type { Metadata } from 'next'
import { Inter } from 'next/font/google'
import { SessionProvider } from 'next-auth/react'
import ChatWidget from '@/components/ChatWidget'
import './globals.css'

const inter = Inter({
  subsets: ['latin'],
  variable: '--font-inter',
  display: 'swap'
})

export const metadata: Metadata = {
  title: 'QuotionAI | FL Distribution',
  description: 'AI-Powered Quote Automation System',
}

export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <html lang="en" className={inter.variable}>
      <body className="antialiased">
        <SessionProvider>
          {children}
          <ChatWidget />
        </SessionProvider>
      </body>
    </html>
  )
}
