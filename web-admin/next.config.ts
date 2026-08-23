import type {NextConfig} from 'next'

/**
 * Do NOT rewrite /api/* to an external HTTPS backend here.
 * Next's built-in rewrite proxy fails on self-signed / MITM cert chains
 * ("Internal Server Error" plain text). All /api traffic is proxied by
 * `src/app/api/[...path]/route.ts` which can relax TLS in development.
 */
const nextConfig: NextConfig = {
  reactCompiler: true,
  turbopack: {
    root: __dirname,
  },
}

export default nextConfig
