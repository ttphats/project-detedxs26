import { test, expect } from '@playwright/test'

/**
 * TC-04 — Ticket viewing (PDF download removed).
 */
test.describe('TC-04: Ticket View', () => {
  const mockOrderNumber = 'TKH-2026-001'
  const mockToken = 'test-access-token-123'

  test('TC-04-01: View ticket without token - denied', async ({ page }) => {
    await page.goto(`/ticket/${mockOrderNumber}`)

    const errorMsg = page.locator('[data-testid="error-message"]')
    const isError = await errorMsg.isVisible({ timeout: 5000 }).catch(() => false)

    if (isError) {
      await expect(errorMsg).toContainText(/token|không có quyền|unauthorized/i)
    } else {
      expect(page.url()).not.toContain(`/ticket/${mockOrderNumber}`)
    }
  })

  test('TC-04-02: Invalid token shows error', async ({ page }) => {
    await page.goto(`/ticket/${mockOrderNumber}?token=invalid-token`)
    const errorMsg = page.locator('[data-testid="error-message"]')
    await expect(errorMsg).toBeVisible({ timeout: 10000 })
  })

  test('TC-04-03: Ticket displays order info', async ({ page }) => {
    await page.goto(`/ticket/${mockOrderNumber}?token=${mockToken}`)
    await page.waitForSelector('[data-testid="ticket-page"]')

    await expect(page.locator('[data-testid="order-number-display"]')).toContainText(
      mockOrderNumber,
    )
    await expect(page.locator('[data-testid="event-info"]')).toBeVisible()
    await expect(page.locator('[data-testid="seat-info"]')).toBeVisible()
    await expect(page.locator('[data-testid="qr-code"]').first()).toBeVisible()
  })

  test('TC-04-04: Order status display', async ({ page }) => {
    await page.goto(`/ticket/${mockOrderNumber}?token=${mockToken}`)
    await page.waitForSelector('[data-testid="ticket-page"]')

    const statusBadge = page.locator('[data-testid="order-status"]')
    await expect(statusBadge).toBeVisible()
    const statusText = await statusBadge.textContent()
    const valid = ['PENDING', 'PAID', 'CONFIRMED', 'Chờ xác nhận', 'Đã thanh toán']
    expect(valid.some((s) => statusText?.includes(s))).toBeTruthy()
  })

  test('TC-04-05: QR code visible and sized', async ({ page }) => {
    await page.goto(`/ticket/${mockOrderNumber}?token=${mockToken}`)
    await page.waitForSelector('[data-testid="ticket-page"]')

    const qrCode = page.locator('[data-testid="qr-code"]').first()
    await expect(qrCode).toBeVisible()
    const box = await qrCode.boundingBox()
    expect(box).toBeTruthy()
    expect(box!.width).toBeGreaterThan(100)
    expect(box!.height).toBeGreaterThan(100)
  })

  test('TC-04-06: Copy ticket link', async ({ page, context }) => {
    await context.grantPermissions(['clipboard-read', 'clipboard-write'])
    await page.goto(`/ticket/${mockOrderNumber}?token=${mockToken}`)
    await page.waitForSelector('[data-testid="ticket-page"]')

    const shareBtn = page.getByRole('button', { name: /copy ticket link/i })
    if (await shareBtn.isVisible({ timeout: 3000 }).catch(() => false)) {
      await shareBtn.click()
      await expect(page.locator('[role="alert"]')).toContainText(/copy|sao chép|chia sẻ/i)
    } else {
      test.skip()
    }
  })

  test('TC-04-07: Responsive layout on mobile', async ({ page }) => {
    await page.setViewportSize({ width: 375, height: 667 })
    await page.goto(`/ticket/${mockOrderNumber}?token=${mockToken}`)
    await page.waitForSelector('[data-testid="ticket-page"]')

    await expect(page.locator('[data-testid="order-number-display"]')).toBeVisible()
    await expect(page.locator('[data-testid="qr-code"]').first()).toBeVisible()
    const box = await page.locator('[data-testid="qr-code"]').first().boundingBox()
    expect(box!.width).toBeLessThanOrEqual(350)
  })
})
