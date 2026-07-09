import type {NextConfig} from 'next'

const BACKEND_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:4000/api'

const nextConfig: NextConfig = {
  /* config options here */
  reactCompiler: true,
  turbopack: {
    root: __dirname,
  },
  async rewrites() {
    return [
      // Proxy all /api/* requests to backend
      {
        source: '/api/:path*',
        destination: `${BACKEND_URL}/:path*`,
      },
    ]
  },
}

export default nextConfig
