import Fastify from 'fastify';
import cors from '@fastify/cors';
import helmet from '@fastify/helmet';
import multipart from '@fastify/multipart';
import { config } from './config/env.js';
import { registerRoutes } from './routes/index.js';
import { errorHandler } from './middleware/error-handler.js';
import { authPlugin } from './middleware/auth.js';
import { testConnection, closePool } from './db/mysql.js';
import { connectPrisma, disconnectPrisma } from './db/prisma.js';

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
  });

  // Register plugins
  await fastify.register(cors, {
    origin: config.corsOrigins,
    credentials: true,
  });

  await fastify.register(helmet, {
    contentSecurityPolicy: false,
  });

  // Register multipart for file uploads
  await fastify.register(multipart, {
    limits: {
      fileSize: 5 * 1024 * 1024, // 5MB
    },
  });

  // Register auth plugin
  await fastify.register(authPlugin);

  // Register error handler
  fastify.setErrorHandler(errorHandler);

  // Register routes
  await registerRoutes(fastify);

  // Test database connections
  console.log('🔌 Testing database connections...');
  
  try {
    await testConnection();
    await connectPrisma();
  } catch (error) {
    console.error('❌ Failed to connect to database:', error);
    process.exit(1);
  }

  // Graceful shutdown
  const shutdown = async () => {
    console.log('\n🛑 Shutting down gracefully...');
    
    await fastify.close();
    await closePool();
    await disconnectPrisma();
    
    console.log('👋 Goodbye!');
    process.exit(0);
  };

  process.on('SIGINT', shutdown);
  process.on('SIGTERM', shutdown);

  // Start server
  try {
    await fastify.listen({
      port: config.server.port,
      host: config.server.host,
    });

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
    `);
  } catch (error) {
    fastify.log.error(error);
    process.exit(1);
  }
}

main().catch((error) => {
  console.error('💥 Fatal error:', error);
  process.exit(1);
});

