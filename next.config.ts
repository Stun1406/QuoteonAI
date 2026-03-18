import type { NextConfig } from 'next'

const nextConfig: NextConfig = {
  experimental: {
    serverActions: { allowedOrigins: ['localhost:3000', 'quoteon-ai.vercel.app'] }
  }
}

export default nextConfig
