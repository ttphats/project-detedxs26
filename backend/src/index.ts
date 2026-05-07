import Fastify from 'fastify'
import cors from '@fastify/cors'
import helmet from '@fastify/helmet'
import multipart from '@fastify/multipart'
import fastifyStatic from '@fastify/static'
import path from 'path'
import {fileURLToPath} from 'url'
import {config} from './config/env.js'

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)
import {registerRoutes} from './routes/index.js'
import {errorHandler} from './middleware/error-handler.js'
import {authPlugin} from './middleware/auth.js'
import {testConnection, closePool} from './db/mysql.js'
import {connectPrisma, disconnectPrisma} from './db/prisma.js'

async function main() {
  // Create Fastify instance
  const fastify = Fastify({
    logger: {
      level: config.isDev ? 'debug' : 'info',
      transport: config.isDev
        ? {
            target: 'pino-pretty',
            options: {
              colorize: true,
            },
          }
        : undefined,
    },
  })

  // Register plugins
  await fastify.register(cors, {
    origin: config.corsOrigins,
    credentials: true,
  })

  await fastify.register(helmet, {
    contentSecurityPolicy: false,
  })

  // Register multipart for file uploads
  await fastify.register(multipart, {
    limits: {
      fileSize: 10 * 1024 * 1024, // 10MB
      files: 50, // Max 50 files at once
    },
  })

  // Serve static files (uploaded images)
  await fastify.register(fastifyStatic, {
    root: path.join(process.cwd(), 'public'),
    prefix: '/',
    decorateReply: false,
  })

  // Register auth plugin
  await fastify.register(authPlugin)

  // Register error handler
  fastify.setErrorHandler(errorHandler)

  // Register routes
  await registerRoutes(fastify)

  // Test database connections
  console.log('🔌 Testing database connections...')

  try {
    await testConnection()
  } catch (error) {
    console.error('❌ MySQL connection failed:', error)
    // Don't exit - Redis might still work
  }

  // Try Prisma (optional - MySQL pool is already working)
  try {
    await connectPrisma()
  } catch (error) {
    console.warn('⚠️ Prisma connection failed (non-critical):', (error as Error).message)
    // Don't exit - we can use MySQL pool directly
  }

  // Graceful shutdown
  const shutdown = async () => {
    console.log('\n🛑 Shutting down gracefully...')

    await fastify.close()
    await closePool()
    await disconnectPrisma()

    console.log('👋 Goodbye!')
    process.exit(0)
  }

  process.on('SIGINT', shutdown)
  process.on('SIGTERM', shutdown)

  // Start server
  try {
    await fastify.listen({
      port: config.server.port,
      host: config.server.host,
    })

    console.log(`
╔══════════════════════════════════════════════════════════════╗
║                                                              ║
║   🚀 TEDx Backend Server is running!                         ║
║                                                              ║
║   📍 URL: http://${config.server.host}:${config.server.port}                            ║
║   🌍 Environment: ${config.isDev ? 'development' : 'production'}                              ║
║                                                              ║
║   📚 API Endpoints:                                          ║
║      GET  /health              - Health check                ║
║      POST /api/auth/login      - Login                       ║
║      POST /api/auth/register   - Register                    ║
║      GET  /api/auth/me         - Get current user            ║
║      GET  /api/events          - List events                 ║
║      POST /api/seats/lock      - Lock seats                  ║
║      POST /api/orders/create-pending - Create order          ║
║                                                              ║
╚══════════════════════════════════════════════════════════════╝
    `)
  } catch (error) {
    fastify.log.error(error)
    process.exit(1)
  }
}

main().catch((error) => {
  console.error('💥 Fatal error:', error)
  process.exit(1)
})
