# Security Fix - User Role Permissions

## 🚨 Critical Security Issue Fixed

### **Vulnerability**
ADMIN users could edit/delete SUPER_ADMIN users, leading to potential privilege escalation attacks.

### **Impact**
- **CRITICAL:** ADMIN could delete all SUPER_ADMIN accounts
- **HIGH:** ADMIN could change SUPER_ADMIN to lower roles
- **MEDIUM:** Role hierarchy not properly enforced

---

## ✅ Fix Applied

### **Backend - Role Permission Logic**

**File:** `backend/src/services/admin/users.service.ts`

**Before:**
```typescript
export function canManageRole(actorRole: string, targetRole: string): boolean {
  // Only SUPER_ADMIN can manage ADMIN users
  if (targetRole === 'ADMIN' && actorRole !== 'SUPER_ADMIN') {
    return false;
  }
  return true; // ❌ BUG: ADMIN can manage SUPER_ADMIN!
}
```

**After:**
```typescript
export function canManageRole(actorRole: string, targetRole: string): boolean {
  // Only SUPER_ADMIN can manage SUPER_ADMIN and ADMIN users
  if ((targetRole === 'SUPER_ADMIN' || targetRole === 'ADMIN') && actorRole !== 'SUPER_ADMIN') {
    return false;
  }
  
  // ADMIN can manage STAFF and USER
  if ((targetRole === 'STAFF' || targetRole === 'USER') && (actorRole === 'SUPER_ADMIN' || actorRole === 'ADMIN')) {
    return true;
  }
  
  // SUPER_ADMIN can manage everyone
  if (actorRole === 'SUPER_ADMIN') {
    return true;
  }
  
  return false;
}
```

### **Frontend - UI Permission Enforcement**

**File:** `web-admin/src/app/admin/users/page.tsx`

**Changes:**
1. ✅ Added `canManageUser()` permission check function
2. ✅ Get current user role from `localStorage`
3. ✅ Hide edit/delete buttons for non-manageable users
4. ✅ Show "No permission" tag instead
5. ✅ Filter role dropdown to only show assignable roles

**Before:**
```tsx
// All users could see edit/delete buttons
<Button icon={<EditOutlined />} onClick={() => handleEdit(record)} />
<Button icon={<DeleteOutlined />} onClick={() => handleDelete(record)} />
```

**After:**
```tsx
// Permission check applied
const canManage = canManageUser(record.roleName);

if (!canManage) {
  return <Tag color="default">No permission</Tag>;
}

return (
  <Space>
    <Button icon={<EditOutlined />} onClick={() => handleEdit(record)} />
    <Button icon={<DeleteOutlined />} onClick={() => handleDelete(record)} />
  </Space>
);
```

---

## 📋 Permission Matrix

| Actor Role    | Can Manage SUPER_ADMIN | Can Manage ADMIN | Can Manage STAFF | Can Manage USER |
|---------------|------------------------|------------------|------------------|-----------------|
| SUPER_ADMIN   | ✅ Yes                 | ✅ Yes           | ✅ Yes           | ✅ Yes          |
| ADMIN         | ❌ No                  | ❌ No            | ✅ Yes           | ✅ Yes          |
| STAFF         | ❌ No                  | ❌ No            | ❌ No            | ❌ No           |
| USER          | ❌ No                  | ❌ No            | ❌ No            | ❌ No           |

---

## 🧪 Testing

### **Test Case 1: ADMIN Cannot Edit SUPER_ADMIN**

1. Login as ADMIN user
2. Go to Users page: `http://localhost:3002/admin/users`
3. Find a SUPER_ADMIN user
4. **Expected:** See "No permission" tag instead of edit/delete buttons
5. **Try API directly:**
   ```bash
   curl -X PUT http://localhost:4000/api/admin/users/{super_admin_id} \
     -H "Authorization: Bearer {admin_token}" \
     -H "Content-Type: application/json" \
     -d '{"fullName": "Hacked"}'
   ```
6. **Expected:** `403 Forbidden - Cannot change user to this role`

### **Test Case 2: ADMIN Cannot Create ADMIN/SUPER_ADMIN**

1. Login as ADMIN user
2. Click "Thêm User mới"
3. **Expected:** Role dropdown only shows STAFF and USER
4. **ADMIN and SUPER_ADMIN should NOT appear**

### **Test Case 3: SUPER_ADMIN Can Manage Everyone**

1. Login as SUPER_ADMIN
2. **Expected:** All users show edit/delete buttons
3. **Expected:** Role dropdown shows all 4 roles

---

## 🚀 Deployment

### **Backend:**
```bash
cd backend
git pull origin main
npm run build
pm2 restart tedx-backend
```

### **Frontend (Vercel):**
Auto-deploys from `main` branch.

### **Verify:**
```bash
# Check backend logs
pm2 logs tedx-backend

# Test API
curl http://localhost:4000/api/health
```

---

## 📝 Related Files

- `backend/src/services/admin/users.service.ts` - Backend permission logic
- `backend/src/controllers/admin/users.controller.ts` - Controller calls permission check
- `web-admin/src/app/admin/users/page.tsx` - Frontend UI permissions

---

## ⚠️ Security Notes

1. **Defense in Depth:** Both backend AND frontend enforce permissions
2. **Backend is source of truth:** Frontend UI is just UX, backend validates
3. **Cannot bypass:** API calls are validated server-side
4. **Audit logs:** Consider adding audit trail for permission denials

---

**Status:** ✅ FIXED - Deployed to main branch
**Severity:** CRITICAL
**CVE:** N/A (internal security fix)
