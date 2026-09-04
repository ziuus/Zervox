import type { Metadata, Viewport } from 'next'
import './globals.css'

export const metadata: Metadata = {
  title: 'Zervox — SRE Control Plane',
  description: 'Autonomous air-gapped cyber resilience engine. Real-time incident remediation dashboard.',
  robots: 'noindex, nofollow',
}

export const viewport: Viewport = {
  themeColor: '#020409',
  colorScheme: 'dark',
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className="dark">
      <head>
        <link rel="icon" href="data:image/svg+xml,<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 100 100'><text y='.9em' font-size='90'>⚡</text></svg>" />
      </head>
      <body>{children}</body>
    </html>
  )
}
