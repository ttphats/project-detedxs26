import { test, expect } from '@playwright/test'

/**
 * Test Suite: TC-04 - Ticket Download Tests
 * Testing ticket viewing and PDF download functionality
 */

test.describe('TC-04: Ticket Download', () => {
  // Mock order data - in real tests, create actual order first
  const mockOrderNumber = 'TKH-2026-001'
  const mockToken = 'test-access-token-123'

  test('TC-04-01: Download PDF from ticket page', async ({ page }) => {
    // Navigate to ticket page with token
    await page.goto(`/ticket/${mockOrderNumber}?token=${mockToken}`)
    
    // Wait for page to load
    await page.waitForSelector('[data-testid="ticket-page"]', { timeout: 10000 })
    
    // Setup download listener
    const downloadPromise = page.waitForEvent('download')
    
    // Click download button
    const downloadBtn = page.locator('[data-testid="download-pdf-button"]')
    await expect(downloadBtn).toBeVisible()
    await downloadBtn.click()
    
    // Wait for download to start
    const download = await downloadPromise
    
    // Verify filename
    const filename = download.suggestedFilename()
    expect(filename).toContain('ticket')
    expect(filename).toContain(mockOrderNumber)
    expect(filename).toEndWith('.pdf')
    
    // Verify download successful
    const path = await download.path()
    expect(path).toBeTruthy()
    
    // Check success toast
    const toast = page.locator('[role="alert"]')
    await expect(toast).toContainText(/thành công|success/i)
  })

  test('TC-04-02: View ticket without token - denied', async ({ page }) => {
    // Try to access without token
    await page.goto(`/ticket/${mockOrderNumber}`)
    
    // Should show error or redirect
    const errorMsg = page.locator('[data-testid="error-message"]')
    const isError = await errorMsg.isVisible({ timeout: 5000 }).catch(() => false)
    
    if (isError) {
      await expect(errorMsg).toContainText(/token|không có quyền|unauthorized/i)
    } else {
      // Might redirect to home or error page
      expect(page.url()).not.toContain(`/ticket/${mockOrderNumber}`)
    }
  })

  test('TC-04-03: Download with invalid token', async ({ page }) => {
    // Use wrong token
    await page.goto(`/ticket/${mockOrderNumber}?token=invalid-token`)
    
    // Try to download
    const downloadBtn = page.locator('[data-testid="download-pdf-button"]')
    
    if (await downloadBtn.isVisible({ timeout: 5000 }).catch(() => false)) {
      await downloadBtn.click()
      
      // Should show error toast
      const errorToast = page.locator('[role="alert"]')
      await expect(errorToast).toContainText(/lỗi|error|invalid|không hợp lệ/i)
    } else {
      // Page might not load at all with invalid token
      const errorMsg = page.locator('[data-testid="error-message"]')
      await expect(errorMsg).toBeVisible()
    }
  })

  test('TC-04-04: Ticket displays correct order info', async ({ page }) => {
    await page.goto(`/ticket/${mockOrderNumber}?token=${mockToken}`)
    await page.waitForSelector('[data-testid="ticket-page"]')
    
    // Check order number displayed
    const orderDisplay = page.locator('[data-testid="order-number-display"]')
    await expect(orderDisplay).toContainText(mockOrderNumber)
    
    // Check event info
    const eventInfo = page.locator('[data-testid="event-info"]')
    await expect(eventInfo).toBeVisible()
    
    // Check seat info
    const seatInfo = page.locator('[data-testid="seat-info"]')
    await expect(seatInfo).toBeVisible()
    
    // Check QR codes
    const qrCodes = page.locator('[data-testid="qr-code"]')
    await expect(qrCodes.first()).toBeVisible()
  })

  test('TC-04-05: Multiple downloads allowed', async ({ page }) => {
    await page.goto(`/ticket/${mockOrderNumber}?token=${mockToken}`)
    await page.waitForSelector('[data-testid="ticket-page"]')
    
    const downloadBtn = page.locator('[data-testid="download-pdf-button"]')
    
    // First download
    const download1 = page.waitForEvent('download')
    await downloadBtn.click()
    await download1
    
    // Wait a bit
    await page.waitForTimeout(1000)
    
    // Second download
    const download2 = page.waitForEvent('download')
    await downloadBtn.click()
    await download2
    
    // Both should succeed
    expect(await (await download1).path()).toBeTruthy()
    expect(await (await download2).path()).toBeTruthy()
  })

  test('TC-04-06: Order status display', async ({ page }) => {
    await page.goto(`/ticket/${mockOrderNumber}?token=${mockToken}`)
    await page.waitForSelector('[data-testid="ticket-page"]')
    
    // Check status badge
    const statusBadge = page.locator('[data-testid="order-status"]')
    await expect(statusBadge).toBeVisible()
    
    // Should show one of: PENDING, PAID, CONFIRMED
    const statusText = await statusBadge.textContent()
    const validStatuses = ['PENDING', 'PAID', 'CONFIRMED', 'Chờ xác nhận', 'Đã thanh toán']
    const hasValidStatus = validStatuses.some(s => statusText?.includes(s))
    expect(hasValidStatus).toBeTruthy()
  })

  test('TC-04-07: QR code visible and correct size', async ({ page }) => {
    await page.goto(`/ticket/${mockOrderNumber}?token=${mockToken}`)
    await page.waitForSelector('[data-testid="ticket-page"]')
    
    // Find QR code element
    const qrCode = page.locator('[data-testid="qr-code"]').first()
    await expect(qrCode).toBeVisible()
    
    // Check dimensions (should be reasonable size)
    const box = await qrCode.boundingBox()
    expect(box).toBeTruthy()
    expect(box!.width).toBeGreaterThan(100)
    expect(box!.height).toBeGreaterThan(100)
  })

  test('TC-04-08: Share ticket link', async ({ page, context }) => {
    // Grant clipboard permissions
    await context.grantPermissions(['clipboard-read', 'clipboard-write'])
    
    await page.goto(`/ticket/${mockOrderNumber}?token=${mockToken}`)
    await page.waitForSelector('[data-testid="ticket-page"]')
    
    // Find share button
    const shareBtn = page.locator('[data-testid="share-button"]')
    
    if (await shareBtn.isVisible({ timeout: 3000 }).catch(() => false)) {
      await shareBtn.click()
      
      // Check clipboard or success message
      const toast = page.locator('[role="alert"]')
      await expect(toast).toContainText(/copy|sao chép|chia sẻ/i)
    } else {
      // Share button might not exist yet
      test.skip()
    }
  })

  test('TC-04-09: Responsive layout on mobile', async ({ page }) => {
    // Set mobile viewport
    await page.setViewportSize({ width: 375, height: 667 })
    
    await page.goto(`/ticket/${mockOrderNumber}?token=${mockToken}`)
    await page.waitForSelector('[data-testid="ticket-page"]')
    
    // Check elements are visible on mobile
    await expect(page.locator('[data-testid="order-number-display"]')).toBeVisible()
    await expect(page.locator('[data-testid="download-pdf-button"]')).toBeVisible()
    await expect(page.locator('[data-testid="qr-code"]').first()).toBeVisible()
    
    // QR code should be appropriately sized for mobile
    const qrCode = page.locator('[data-testid="qr-code"]').first()
    const box = await qrCode.boundingBox()
    expect(box!.width).toBeLessThanOrEqual(350) // Fits in mobile width
  })
})
