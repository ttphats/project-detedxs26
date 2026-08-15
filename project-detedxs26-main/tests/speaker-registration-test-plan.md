# Speaker Registration Test Plan

## 📋 Metadata

| Property | Value |
|----------|-------|
| **Feature** | Speaker Registration & Partner Management |
| **Developer** | Nguyễn Hoàng Khôi |
| **Date** | 2026-06-15 |
| **Tester** | Augment Agent |

---

## 🎯 Test Environment

- **Backend:** http://localhost:4000
- **Admin:** http://localhost:3002
- **Credentials:** admin / admin123456

---

## 📊 Test Summary

| Category | Total | Pass | Fail | Skip |
|----------|-------|------|------|------|
| Admin Login | 3 | 0 | 0 | 3 |
| Speaker Submissions | 5 | 0 | 0 | 5 |
| Speaker Config | 4 | 0 | 0 | 4 |
| Partner Management | 4 | 0 | 0 | 4 |
| Public Form | 6 | 0 | 0 | 6 |
| API Tests | 8 | 0 | 0 | 8 |
| **TOTAL** | **30** | **0** | **0** | **30** |

---

## 🧪 Test Cases

### TC-01: Admin Login

**TC-01-01: Login Success**
- Navigate to http://localhost:3002/admin
- Enter: admin / admin123456
- Click "Đăng nhập"
- **Expected:** Redirect to dashboard, token saved

**TC-01-02: Login Failure**
- Enter: admin / wrongpass
- **Expected:** Error message, stay on login

**TC-01-03: Unauthorized Access**
- Clear localStorage
- Go to /admin/speaker-submissions
- **Expected:** Redirect to login

---

### TC-02: Speaker Submissions

**TC-02-01: Load Submissions**
- Login → Speaker Submissions
- **Expected:** Table loads, API called

**TC-02-02: View Details**
- Click "View" on submission
- **Expected:** Drawer opens with data

**TC-02-03: Accept Submission**
- Click "Accept"
- **Expected:** Status → ACCEPTED

**TC-02-04: Reject Submission**
- Click "Reject"
- **Expected:** Status → REJECTED

**TC-02-05: Filter Submissions**
- Select status filter
- **Expected:** Table filtered

---

### TC-03: Speaker Config

**TC-03-01: Load Config**
- Navigate to /admin/speaker-config
- **Expected:** Form loads

**TC-03-02: Update Config**
- Edit title, description
- Click "Save"
- **Expected:** Success message

**TC-03-03: Add Field**
- Click "Add Field"
- Fill: name, label, type
- **Expected:** Field added

**TC-03-04: Delete Field**
- Click delete icon
- **Expected:** Field removed

---

### TC-04: Partner Management

**TC-04-01: Load Partners**
- Navigate to /admin/partners
- **Expected:** Table loads

**TC-04-02: Add Partner**
- Click "Add Partner"
- Fill form, upload logo
- **Expected:** Partner created

**TC-04-03: Edit Partner**
- Click "Edit"
- Change tier
- **Expected:** Partner updated

**TC-04-04: Delete Partner**
- Click "Delete"
- **Expected:** Partner removed

---

### TC-05: Public Registration

**TC-05-01: Load Form**
- Go to /speakers/register
- **Expected:** Form loads with fields

**TC-05-02: Submit Valid**
- Fill all required fields
- Submit
- **Expected:** Success message

**TC-05-03: Validation Errors**
- Leave required field empty
- **Expected:** Inline errors

**TC-05-04: Email Validation**
- Enter invalid email
- **Expected:** Format error

**TC-05-05: Phone Validation**
- Enter invalid phone
- **Expected:** Format error

**TC-05-06: API Error Handling**
- Mock 500 error
- **Expected:** Error toast, retry

---

### TC-06: API Endpoints

**TC-06-01:** `POST /api/auth/login`
**TC-06-02:** `GET /api/speakers/register/config`
**TC-06-03:** `GET /api/speakers/register/fields`
**TC-06-04:** `POST /api/speakers/register`
**TC-06-05:** `GET /api/admin/speakers/submissions`
**TC-06-06:** `PUT /api/admin/speakers/submissions/:id`
**TC-06-07:** `POST /api/admin/speakers/register/fields`
**TC-06-08:** `GET /api/partners`

---

## 📝 Test Execution Log

Will be updated as tests run...

