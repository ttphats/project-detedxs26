import type {NextConfig} from 'next'

// API URL already includes /api suffix
const BACKEND_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:4000'

const nextConfig: NextConfig = {
  /* config options here */
  reactCompiler: true,
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
