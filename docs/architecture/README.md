# TEDx Ticketing Platform - Architecture Documentation

> **Complete technical documentation for developers, organized by role and expertise level**

---

## 📚 Documentation Structure

### 🎯 For Everyone (Start Here)

| Document                               | Description                                         | Time to Read |
| -------------------------------------- | --------------------------------------------------- | ------------ |
| [**00-overview.md**](./00-overview.md) | High-level system overview, tech stack, quick start | 10 min       |

### 🏗️ For All Developers

| Document                                                     | Description                                     | Audience |
| ------------------------------------------------------------ | ----------------------------------------------- | -------- |
| [**01-system-architecture.md**](./01-system-architecture.md) | Services topology, deployment, data flows       | All devs |
| [**03-database-schema.md**](./03-database-schema.md)         | Database ERD, tables, relationships             | All devs |
| [**04-business-flows.md**](./04-business-flows.md)           | User journeys, payment, seat locking            | All devs |
| [**07-security-model.md**](./07-security-model.md)           | Authentication, authorization, security         | All devs |
| [**10-user-stories.md**](./10-user-stories.md)               | Personas, workflows, edge cases, business rules | All devs |

### 🔧 For Backend Developers

| Document                                                       | Description                                 |
| -------------------------------------------------------------- | ------------------------------------------- |
| [**02-backend-architecture.md**](./02-backend-architecture.md) | Fastify structure, patterns, best practices |
| [**05-api-reference.md**](./05-api-reference.md)               | API endpoints, request/response specs       |

### 🎨 For Frontend Developers

| Document                                                         | Description                                |
| ---------------------------------------------------------------- | ------------------------------------------ |
| [**06-frontend-architecture.md**](./06-frontend-architecture.md) | Next.js apps, components, state management |

### 🚀 For New Developers / Onboarding

| Document                                                 | Description                            |
| -------------------------------------------------------- | -------------------------------------- |
| [**08-development-guide.md**](./08-development-guide.md) | Local setup, common workflows, testing |

### ⚙️ For DevOps / Deployment

| Document                                               | Description                                 |
| ------------------------------------------------------ | ------------------------------------------- |
| [**09-deployment-guide.md**](./09-deployment-guide.md) | Production deployment, env vars, monitoring |

---

## 🎓 Learning Paths

### Path 1: Junior Developer Onboarding

```
1. Read 00-overview.md           (Understand what we're building)
2. Read 08-development-guide.md  (Setup local environment)
3. Read 04-business-flows.md     (Understand user journeys)
4. Read 02 or 06 based on role   (Backend or Frontend architecture)
5. Start coding!
```

### Path 2: Senior Developer / Architect

```
1. Skim 00-overview.md           (Refresh memory)
2. Deep-dive 01-system-architecture.md  (Understand deployment & scaling)
3. Read 02-backend-architecture.md      (Architecture decisions)
4. Read 03-database-schema.md           (Data model)
5. Read 07-security-model.md            (Security considerations)
```

### Path 3: Frontend Developer

```
1. Read 00-overview.md
2. Read 06-frontend-architecture.md
3. Read 05-api-reference.md
4. Read 08-development-guide.md
```

### Path 4: Backend Developer

```
1. Read 00-overview.md
2. Read 02-backend-architecture.md
3. Read 03-database-schema.md
4. Read 04-business-flows.md
5. Read 05-api-reference.md
```

---

## 🔍 Quick Reference

### Find Information By Topic

**Authentication & Security**

- JWT flow: [07-security-model.md](./07-security-model.md#jwt-authentication)
- RBAC: [07-security-model.md](./07-security-model.md#role-based-access-control)
- Middleware: [02-backend-architecture.md](./02-backend-architecture.md#authentication-flow)

**Seat Locking**

- Redis locking: [04-business-flows.md](./04-business-flows.md#seat-locking-flow)
- Implementation: [02-backend-architecture.md](./02-backend-architecture.md#redis-operations)

**Payment Integration**

- Payment flow: [04-business-flows.md](./04-business-flows.md#payment-flow)
- Webhook handling: [05-api-reference.md](./05-api-reference.md#payment-webhook)

**Database**

- Schema: [03-database-schema.md](./03-database-schema.md)
- Migrations: [03-database-schema.md](./03-database-schema.md#migration-strategy)
- Transactions: [02-backend-architecture.md](./02-backend-architecture.md#database-access-patterns)

**Deployment**

- Backend: [09-deployment-guide.md](./09-deployment-guide.md#backend-deployment)
- Frontend: [09-deployment-guide.md](./09-deployment-guide.md#frontend-deployment)
- Environment: [09-deployment-guide.md](./09-deployment-guide.md#environment-variables)

---

## 📝 Documentation Standards

All architecture documents follow these conventions:

1. **Layered Depth:**
   - 📖 Overview (for junior devs)
   - 🔧 Implementation details (for mid-level)
   - 🏗️ Architecture decisions (for senior)

2. **Mermaid Diagrams:**
   - Every flow has a visual diagram
   - Consistent color scheme
   - Clear labels

3. **Code Examples:**
   - Real code from the project
   - Comments explaining why
   - Best practices highlighted

4. **Navigation:**
   - Previous/Next links
   - Audience markers
   - Last updated dates

---

## 🔄 Keeping Documentation Updated

**When to update:**

- ✅ Adding new services/features
- ✅ Changing architecture patterns
- ✅ Security model changes
- ✅ New deployment procedures

**How to update:**

1. Edit the relevant `.md` file
2. Update "Last Updated" date
3. Add entry to CHANGELOG if major change
4. Commit with descriptive message

---

## 🤝 Contributing to Docs

**Before making architecture changes:**

1. Read relevant documentation
2. Understand current patterns
3. Propose changes in team discussion

**After making architecture changes:**

1. Update affected documentation files
2. Add diagrams if needed
3. Update this README if structure changes

---

## 📧 Contact

**Questions about architecture?**

- Backend: Contact backend team lead
- Frontend: Contact frontend team lead
- Infrastructure: Contact DevOps

---

**Start Reading:** [00-overview.md →](./00-overview.md)
