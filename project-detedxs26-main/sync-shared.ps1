# Sync shared files to both web-client and web-admin
# Run this script after modifying files in the shared/ folder

Write-Host "Syncing shared files..." -ForegroundColor Cyan

# Sync seat-styles.ts
Copy-Item -Path ".\shared\seat-styles.ts" -Destination ".\web-admin\src\lib\seat-styles.ts" -Force
Copy-Item -Path ".\shared\seat-styles.ts" -Destination ".\web-client\src\lib\seat-styles.ts" -Force

Write-Host "✓ Synced seat-styles.ts to web-admin and web-client" -ForegroundColor Green

Write-Host ""
Write-Host "Done! Both projects are now using the latest shared styles." -ForegroundColor Green

