# Feature: Speaker Registration System

## 📋 Metadata

| Property | Value |
|----------|-------|
| **Feature ID** | FR-001 |
| **Feature Name** | Speaker Registration & Partner Management |
| **Developer** | Nguyễn Hoàng Khôi (NguyenHoangKhoi2k6@gmail.com) |
| **Implementation Date** | 2026-06-15 18:48 |
| **Commit Hash** | `9a8fa9cbff1777149700aa799881296fbe74acad` |
| **Branch** | `feature/register-speaker` |
| **Status** | ✅ Implemented, ⏳ Testing Pending |
| **Test Plan** | `tests/speaker-registration-test-plan.md` |

---

## 🎯 Feature Overview

Public-facing speaker registration system allowing potential speakers to apply for TEDxFPTUniversityHCMC events with dynamic form configuration and admin approval workflow.

**Key Capabilities:**
- Public speaker application form
- Dynamic form field configuration
- Admin review and approval workflow
- Partner/sponsor management with marquee display
- Configurable submission rules

---

## 👥 User Personas

### 1. Potential Speaker (Public User)
**Goal:** Apply to speak at TEDx event  
**Needs:**
- Easy-to-use registration form
- Clear application requirements
- Submission confirmation
- Application status tracking (future)

### 2. Event Admin (Staff)
**Goal:** Review and manage speaker applications  
**Needs:**
- View all submissions
- Filter by status (Pending/Reviewed/Accepted/Rejected)
- Review candidate details
- Approve/reject with notes
- Configure registration form fields

### 3. Marketing Admin (Staff)
**Goal:** Manage event partners/sponsors  
**Needs:**
- Add/edit partner logos
- Configure partner tiers (Diamond/Gold/Silver)
- Control partner visibility on website
- Manage marquee slideshow

---

## 📐 Architecture

### Frontend Components

```
web-client/
├── src/app/speakers/register/page.tsx       # Public registration form (303 lines)
└── src/components/layout/
    └── Footer.tsx                             # Partner marquee display

web-admin/
├── src/app/admin/speaker-submissions/       # Admin review dashboard (323 lines)
├── src/app/admin/speaker-config/            # Form field configuration (543 lines)
└── src/app/admin/partners/                  # Partner management (656 lines)
```

### Backend Services

```
backend/
├── src/controllers/admin/
│   ├── speaker-register.controller.ts       # Speaker reg endpoints (180 lines)
│   └── partners.controller.ts               # Partner CRUD (144 lines)
├── src/services/admin/
│   ├── speaker-register.service.ts          # Business logic (253 lines)
│   └── partners.service.ts                  # Partner service (181 lines)
└── src/routes/
    ├── public.routes.ts                     # Public speaker reg routes
    └── admin.routes.ts                      # Admin routes (20 new)
```

### Database Schema

```prisma
// New tables added to schema.prisma

model SpeakerRegistrationConfig {
  id          String   @id @default(uuid())
  title       String   @db.VarChar(255)
  description String?  @db.Text
  rules       String   @db.Text // JSON array of rules
  createdAt   DateTime @default(now())
  updatedAt   DateTime @updatedAt
  @@map("speaker_registration_config")
}

model SpeakerFormField {
  id          String   @id @default(uuid())
  name        String   @unique @db.VarChar(100)
  label       String   @db.VarChar(255)
  type        String   @db.VarChar(50) // 'text'|'textarea'|'email'|'phone'|'number'
  isRequired  Boolean  @default(false)
  placeholder String?  @db.VarChar(255)
  options     String?  @db.Text // JSON for select options
  sortOrder   Int      @default(0)
  createdAt   DateTime @default(now())
  updatedAt   DateTime @updatedAt
  @@index([sortOrder])
  @@map("speaker_form_fields")
}

model SpeakerSubmission {
  id        String   @id @default(uuid())
  answers   String   @db.Text // JSON string of field answers
  status    String   @default("PENDING") @db.VarChar(50) // PENDING|REVIEWED|ACCEPTED|REJECTED
  createdAt DateTime @default(now())
  updatedAt DateTime @updatedAt
  @@index([status])
  @@index([createdAt])
  @@map("speaker_submissions")
}

model Partner {
  id             String   @id @default(uuid())
  name           String   @db.VarChar(100)
  tier           String   @db.VarChar(20) // 'diamond'|'gold'|'silver'
  website        String?  @db.VarChar(255)
  logoUrl        String?  @db.VarChar(500)
  bannerUrl      String?  @db.VarChar(500)
  showInMarquee  Boolean  @default(true)
  isActive       Boolean  @default(true)
  sortOrder      Int      @default(0)
  createdAt      DateTime @default(now())
  updatedAt      DateTime @updatedAt
  @@index([tier])
  @@index([isActive])
  @@index([showInMarquee])
  @@map("partners")
}
```

---

## 🔄 Use Cases

### UC-01: Submit Speaker Application (Public)

**Actor:** Potential Speaker (Unauthenticated)  
**Preconditions:** Registration form is active  
**Trigger:** User navigates to `/speakers/register`

**Main Flow:**
1. System loads registration configuration
   - API: `GET /api/speakers/register/config`
   - Returns: title, description, rules array
2. System loads dynamic form fields
   - API: `GET /api/speakers/register/fields`
   - Returns: fields sorted by sortOrder
3. User fills required fields (name, email, topic, bio, etc.)
4. User submits form
   - API: `POST /api/speakers/register`
   - Payload: `{ "name": "...", "email": "...", "topic": "...", ... }`
5. System validates input
   - Required fields check
   - Email format validation
   - Phone format validation
6. System creates submission record
   - Status: `PENDING`
   - Answers stored as JSON string
7. System sends confirmation
   - Success message displayed
   - Email notification sent to admin (future)
8. User sees success confirmation

**Alternative Flows:**
- **4a. Validation Error:**
  - System shows inline error messages
  - User corrects errors
  - Resume at step 4

- **4b. API Error:**
  - System shows error toast
  - User can retry submission
  - Data preserved in form

**Postconditions:**
- Submission saved with status `PENDING`
- Admin can see submission in dashboard

---

### UC-02: Review Speaker Submission (Admin)

**Actor:** Admin  
**Preconditions:** Admin is authenticated  
**Trigger:** Admin navigates to `/admin/speaker-submissions`

**Main Flow:**
1. System loads all submissions
   - API: `GET /api/admin/speakers/submissions`
   - Returns: submissions with status, created_at
2. Admin views submission list
   - Table shows: ID, Status, Submitted date
   - Filter by status available
3. Admin clicks "View" on submission
   - Drawer opens with full details
4. Admin reviews candidate information
   - All form field answers displayed
   - Submission timestamp shown
5. Admin makes decision:
   - **Option A:** Click "Accept"
     - API: `PUT /api/admin/speakers/submissions/:id`
     - Payload: `{ "status": "ACCEPTED" }`
   - **Option B:** Click "Reject"
     - API: `PUT /api/admin/speakers/submissions/:id`
     - Payload: `{ "status": "REJECTED" }`
6. System updates submission status
7. System creates audit log
8. System sends email to candidate (future)
9. Dashboard refreshes, submission moved to appropriate status

**Alternative Flows:**
- **5a. Mark as Reviewed (no decision yet):**
  - Status: `PENDING` → `REVIEWED`
  - Can be accepted/rejected later

**Postconditions:**
- Submission status updated
- Audit log created
- Candidate notified via email (future)

---

### UC-03: Configure Registration Form (Admin)

**Actor:** Admin  
**Preconditions:** Admin authenticated  
**Trigger:** Admin navigates to `/admin/speaker-config`

**Main Flow:**
1. System loads current configuration
   - API: `GET /api/admin/speakers/register/config`
   - API: `GET /api/admin/speakers/register/fields`
2. Admin modifies form settings:
   - **2a. Update title/description/rules:**
     - Edit text fields
     - Add/remove rules
   - **2b. Add new form field:**
     - Click "Add Field"
     - Enter: name, label, type, required, placeholder
     - Set sort order
   - **2c. Reorder fields:**
     - Drag-drop to change sequence
     - Sort order auto-updated
   - **2d. Delete field:**
     - Click delete icon
     - Confirm deletion
3. Admin clicks "Save"
4. System validates input
5. System saves configuration
   - API: `PUT /api/admin/speakers/register/config`
   - API: `POST/PUT/DELETE /api/admin/speakers/register/fields/:id`
6. System shows success message
7. Public form immediately reflects changes

**Postconditions:**
- Configuration saved to database
- Public form uses new config on next load
- Field changes don't affect existing submissions

---

