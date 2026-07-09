# TEDx Backend API

Backend API cho hệ thống bán vé sự kiện TEDx.

## 🚀 Tech Stack

- **Runtime**: Node.js 20+
- **Framework**: Fastify
- **Database**: MySQL (Prisma ORM)
- **Language**: TypeScript
- **Authentication**: JWT
- **Process Manager**: PM2 (production)

## 📁 Project Structure

```
backend/
├── src/
│   ├── controllers/      # API controllers
│   ├── services/         # Business logic
│   ├── routes/          # Route definitions
│   ├── db/              # Database connections
│   ├── utils/           # Utilities
│   └── index.ts         # Entry point
├── prisma/
│   └── schema.prisma    # Database schema
├── dist/                # Compiled JS (generated)
├── logs/                # Application logs
├── .env                 # Environment variables (dev)
├── .env.production      # Production env vars
├── ecosystem.config.js  # PM2 config
├── Dockerfile           # Docker config
└── docker-compose.yml   # Docker Compose
```

## 🛠️ Development

### Prerequisites

- Node.js 20+
- MySQL database

### Setup

```bash
# Install dependencies
npm install

# Setup environment
cp .env.example .env
# Edit .env with your database credentials

# Generate Prisma Client
npm run prisma:generate

# Run database migrations (if needed)
npm run prisma:migrate

# Start development server
npm run dev
```

### Available Scripts

```bash
npm run dev              # Start dev server with hot reload
npm run build            # Build for production
npm start                # Start production server
npm run prisma:generate  # Generate Prisma Client
npm run prisma:migrate   # Run database migrations
npm run prisma:studio    # Open Prisma Studio
npm run lint             # Run ESLint
npm run typecheck        # Type checking
```

## 🚀 Production Deployment

### 🐳 Docker Deployment (Easiest - Recommended)

**Không cần paste code vào SSH terminal!**

See: [DOCKER_DEPLOY_SIMPLE.md](./DOCKER_DEPLOY_SIMPLE.md) for step-by-step.

Quick deploy:

```powershell
# 1. Edit deploy-docker.ps1 with your server IP
# 2. Run from Windows:
npm run build
.\deploy-docker.ps1
```

**Cheat Sheet**: See [DOCKER_CHEATSHEET.md](./DOCKER_CHEATSHEET.md)

### 📦 PM2 Deployment (Traditional)

See [QUICK_DEPLOY.md](./QUICK_DEPLOY.md) for TL;DR version.

```bash
# Build
npm run build

# Start with PM2
npm run pm2:start

# Or using ecosystem config
pm2 start ecosystem.config.js --env production
```

### 📝 Detailed Guides

- **Docker Deploy**: [DOCKER_DEPLOY_SIMPLE.md](./DOCKER_DEPLOY_SIMPLE.md) ⭐ **Recommended**
- **PM2 Deploy**: [DEPLOY_STEPS.md](./DEPLOY_STEPS.md)
- **Quick Reference**: [DOCKER_CHEATSHEET.md](./DOCKER_CHEATSHEET.md)
- **Full Documentation**: [DEPLOYMENT.md](./DEPLOYMENT.md)

### Deployment Scripts

```powershell
# Windows PowerShell (Docker)
.\deploy-docker.ps1

# Git Bash (Docker)
./deploy-docker.sh

# Traditional deploy
./deploy.sh
```

## 📚 API Documentation

### Base URL

- **Development**: `http://localhost:4000`
- **Production**: `http://api.your-domain.com`

### Main Endpoints

#### Authentication

- `POST /api/auth/register` - Register new user
- `POST /api/auth/login` - Login
- `GET /api/auth/me` - Get current user

#### Events

- `GET /api/events` - List all events
- `GET /api/events/:id` - Get event details

#### Seats

- `GET /api/events/:eventId/seats` - Get seats for event
- `POST /api/seats/lock` - Lock seats for checkout

#### Orders

- `POST /api/orders/create-pending` - Create pending order
- `GET /api/orders/:id` - Get order details

#### Admin

- `GET /api/admin/events` - List events (admin)
- `POST /api/admin/layout-versions` - Create layout version
- `POST /api/admin/layout-versions/:id/publish` - Publish layout

### Health Check

```bash
curl http://localhost:4000/health
```

## 🔒 Environment Variables

Required environment variables:

```env
NODE_ENV=development|production
PORT=4000

# Database
DB_HOST=localhost
DB_PORT=3306
DB_USER=your_user
DB_PASSWORD=your_password
DB_NAME=your_database

# JWT
JWT_SECRET=your-secret-key-min-32-chars
JWT_EXPIRES_IN=7d

# CORS
FRONTEND_URL=http://localhost:3000
ADMIN_URL=http://localhost:3002
```

## 📊 Monitoring

### PM2 Monitoring

```bash
pm2 status              # Check status
pm2 logs tedx-backend   # View logs
pm2 monit               # Resource monitoring
```

### Logs Location

- **PM2**: `./logs/`
- **Nginx**: `/var/log/nginx/`

## 🧪 Testing

```bash
# Run tests (when implemented)
npm test

# Run type checking
npm run typecheck
```

## 📝 Common Tasks

### Database Tasks

```bash
# Generate Prisma Client
npm run prisma:generate

# Create migration
npm run prisma:migrate

# Push schema changes
npm run prisma:push

# Open Prisma Studio
npm run prisma:studio
```

### Deployment Tasks

```bash
# Deploy to production
./deploy.sh

# Restart application
pm2 restart tedx-backend

# View logs
pm2 logs tedx-backend
```

## 🔧 Troubleshooting

See [DEPLOY_STEPS.md](./DEPLOY_STEPS.md#troubleshooting) for common issues and solutions.

## 📄 License

Private - TEDx Event Ticketing System
