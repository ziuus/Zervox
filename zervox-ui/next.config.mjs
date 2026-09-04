

const nextConfig = {
  output: 'standalone',
  // Proxy API calls to Zervox backend in development
  async rewrites() {
    return [
      {
        source: '/zervox-api/:path*',
        destination: `${process.env.ZERVOX_PRIMARY_URL ?? 'http://localhost:8080'}/:path*`,
      },
      {
        source: '/zervox-backup/:path*',
        destination: `${process.env.ZERVOX_BACKUP_URL ?? 'http://localhost:8081'}/:path*`,
      },
    ]
  },
  async headers() {
    return [
      {
        source: '/(.*)',
        headers: [
          { key: 'X-Frame-Options', value: 'DENY' },
          { key: 'X-Content-Type-Options', value: 'nosniff' },
          { key: 'Referrer-Policy', value: 'strict-origin-when-cross-origin' },
          {
            key: 'Content-Security-Policy',
            value: "default-src 'self'; script-src 'self' 'unsafe-eval' 'unsafe-inline'; style-src 'self' 'unsafe-inline' https://fonts.googleapis.com; img-src 'self' data:; font-src 'self' data: https://fonts.gstatic.com; connect-src 'self' http://localhost:* http://127.0.0.1:* ws://localhost:* ws://127.0.0.1:*; font-src 'self' data: https://fonts.gstatic.com;",
          },
        ],
      },
    ]
  },
}

export default nextConfig
