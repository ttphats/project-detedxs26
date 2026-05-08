-- Check users and their roles
SELECT 
    u.id,
    u.username,
    u.full_name,
    u.email,
    u.role_id,
    r.name as role_name,
    r.description as role_description,
    u.is_active
FROM users u
LEFT JOIN roles r ON u.role_id = r.id
ORDER BY u.created_at DESC;

-- Check all available roles
SELECT 
    id,
    name,
    description
FROM roles
ORDER BY name;

-- Check if there are any orphaned users (no role)
SELECT 
    u.id,
    u.username,
    u.full_name,
    u.role_id
FROM users u
WHERE u.role_id NOT IN (SELECT id FROM roles)
   OR u.role_id IS NULL;
