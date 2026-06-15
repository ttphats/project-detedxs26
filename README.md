# TEDx Ticketing Platform

[![Deploy Status](https://github.com/ttphats/project-detedxs26/actions/workflows/deploy.yml/badge.svg)](https://github.com/ttphats/project-detedxs26/actions/workflows/deploy.yml)

## Description

Online ticketing system for TEDxFPTUniversityHCMC 2026 event. Manages seat reservations, bank transfer payments, and automated ticket delivery via email.

**Built for:** Event organizers who need a reliable ticketing solution without third-party platforms.

**Key benefit:** Prevents double-booking through Redis-based seat locking, even when hundreds of people book simultaneously.

## Installation

### Prerequisites

- Node.js 18 or higher
- MySQL 8.0 or higher
- Redis (optional for local development)

### Setup Steps

```bash
# Clone the repository
git clone https://github.com/ttphats/project-detedxs26.git
cd project-detedxs26

# Install dependencies for customer site
cd web-client
npm install

# Install dependencies for admin dashboard
cd ../web-admin
npm install
```

### Database Setup

```bash
cd web-admin

# Copy environment file
cp .env.example .env

# Edit .env with your database credentials
# DATABASE_URL="mysql://user:password@localhost:3306/tedx_ticketing"

# Run database migrations
npx prisma migrate dev

# Seed initial data (creates admin user)
npm run db:seed
```

## Usage

### Start Development Servers

```bash
# Terminal 1: Customer site
cd web-client
npm run dev
# Opens at http://localhost:3000

# Terminal 2: Admin dashboard
cd web-admin
npm run dev
# Opens at http://localhost:3002
```

### Admin Login

Navigate to http://localhost:3002/admin/login

Use the credentials created during database seeding (check terminal output from `npm run db:seed`).

### Running Tests

```bash
cd web-client

# Install test browsers (first time only)
npm run test:install

# Run tests with UI
npm run test:e2e:ui

# Run all tests
npm run test:e2e
```

## Features

### Customer Features

- Browse upcoming TEDx events
- Select seats from interactive seat map
- Real-time seat availability updates
- 10-minute seat reservation with countdown timer
- Bank transfer payment instructions
- Email ticket delivery with QR code
- PDF ticket download

### Admin Features

- Event management (create, edit, delete)
- Custom seat layout designer
- Payment confirmation workflow (manual bank transfer verification)
- Order management dashboard
- Real-time booking statistics
- Automated email notifications
- Audit logging

### Technical Features

- **Zero overselling** - Redis-based atomic seat locking
- **Handles concurrent bookings** - Race condition prevention
- **Automated testing** - 42 E2E tests with Playwright
- **Serverless deployment** - Runs on Vercel
- **Email automation** - Resend integration

## Tech Stack

**Frontend**

- Next.js 16 (React framework)
- TypeScript
- Tailwind CSS

**Backend**

- Next.js API Routes
- Prisma ORM
- MySQL database
- Redis (Upstash)

**Email & Notifications**

- Resend (email delivery)
- QR code generation

**Testing & Deployment**

- Playwright (E2E testing)
- Vercel (hosting)
- GitHub Actions (CI/CD)

## Project Structure

```
project-detedxs26/
├── web-client/              # Customer-facing website
│   ├── src/app/             # Next.js app directory
│   ├── tests/               # Playwright E2E tests
│   └── playwright.config.ts
│
├── web-admin/               # Admin dashboard
│   ├── src/app/admin/       # Admin pages
│   ├── src/app/api/         # API routes
│   ├── prisma/              # Database schema
│   └── src/lib/             # Utilities
│
└── docs/                    # Documentation
```

## Documentation

- [Testing Guide](./TESTING_SETUP.md) - How to run automated tests
- [Deployment Guide](./docs/DEPLOYMENT_GUIDE.md) - Deploy to production
- [Payment Flow](./PAYMENT_FLOW.md) - Bank transfer workflow
- [Business Flow](./BUSINESS_FLOW.md) - Complete user journey

## Contributing

This is a private project for TEDxFPTUniversityHCMC 2026. Not accepting external contributions at this time.

## License

All rights reserved. Private project for TEDxFPTUniversityHCMC 2026.

## Credits

**Development Team:** TEDxFPTUniversityHCMC Tech Team

**Event:** TEDxFPTUniversityHCMC 2026 - Theme: "Finding Flow"

## Acknowledgments

Special thanks to all contributors who helped build this platform:

- Project lead and architecture
- Frontend development team
- Backend API development
- Testing and QA team
- TEDxFPTUniversityHCMC organizing committee

For a full list of contributors, see the [Contributors page](https://github.com/ttphats/project-detedxs26/graphs/contributors).

## Acknowledgments

Thanks to the following for their contributions and feedback:

- [@ttphats](https://github.com/ttphats) - Project lead and core development
- TEDxFPTUniversityHCMC organizing committee for requirements and testing
- Community contributors for bug reports and suggestions
