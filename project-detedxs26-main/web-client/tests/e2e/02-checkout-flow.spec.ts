import { test, expect } from '@playwright/test'

/**
 * Test Suite: TC-02 - Checkout Flow Tests
 * Critical payment and order creation flow
 */

const EVENT_ID = 'evt-tedx-2026'

test.describe('TC-02: Checkout Flow', () => {
  test('TC-02-01: Create pending order', async ({ page }) => {
    // Select seats first
    await page.goto(`/events/${EVENT_ID}/seats`)
    await page.waitForSelector('[data-testid="seat-map"]')
    
    // Select 2 seats
    const seats = page.locator('button[data-status="available"]')
    await seats.nth(0).click()
    await page.waitForTimeout(500)
    await seats.nth(1).click()
    await page.waitForTimeout(500)
    
    // Click checkout button
    const checkoutBtn = page.locator('[data-testid="checkout-button"]')
    await checkoutBtn.click()
    
    // Should redirect to checkout page
    await page.waitForURL(/\/checkout\?/, { timeout: 10000 })
    
    // Verify URL contains order number and token
    const url = page.url()
    expect(url).toContain('order=TKH-')
    expect(url).toContain('token=')
    
    // Verify order info displayed
    const orderNumber = page.locator('[data-testid="order-number"]')
    await expect(orderNumber).toBeVisible()
    await expect(orderNumber).toContainText(/TKH-/)
    
    // Verify selected seats displayed
    const seatList = page.locator('[data-testid="selected-seats"]')
    await expect(seatList).toBeVisible()
  })

  test('TC-02-02: Lock extended to 15 minutes on checkout', async ({ page }) => {
    // Select seat
    await page.goto(`/events/${EVENT_ID}/seats`)
    await page.waitForSelector('[data-testid="seat-map"]')
    
    await page.locator('button[data-status="available"]').first().click()
    await page.waitForTimeout(500)
    
    // Get timer value (should be ~10 minutes)
    const timer1 = page.locator('[data-testid="lock-timer"]')
    const initialTime = await timer1.textContent()
    
    // Click checkout
    await page.locator('[data-testid="checkout-button"]').click()
    await page.waitForURL(/\/checkout/)
    
    // Timer should now show ~15 minutes
    const timer2 = page.locator('[data-testid="lock-timer"]')
    const extendedTime = await timer2.textContent()
    
    // Parse times
    const parseTime = (t: string) => {
      const match = t?.match(/(\d+):(\d+)/)
      if (!match) return 0
      return parseInt(match[1]) * 60 + parseInt(match[2])
    }
    
    const initial = parseTime(initialTime!)
    const extended = parseTime(extendedTime!)
    
    // Extended should be > initial (approximately 15 min vs 10 min)
    expect(extended).toBeGreaterThan(initial)
    expect(extended).toBeGreaterThanOrEqual(14 * 60) // At least 14 minutes
  })

  test('TC-02-03: Checkout with empty selection blocked', async ({ page }) => {
    await page.goto(`/events/${EVENT_ID}/seats`)
    await page.waitForSelector('[data-testid="seat-map"]')
    
    // Don't select any seats
    const checkoutBtn = page.locator('[data-testid="checkout-button"]')
    
    // Button should be disabled
    await expect(checkoutBtn).toBeDisabled()
    
    // Try to click anyway
    await checkoutBtn.click({ force: true })
    
    // Should not navigate
    expect(page.url()).toContain('/seats')
  })

  test('TC-02-04: Fill customer information', async ({ page }) => {
    // Create pending order first
    await page.goto(`/events/${EVENT_ID}/seats`)
    await page.waitForSelector('[data-testid="seat-map"]')
    await page.locator('button[data-status="available"]').first().click()
    await page.waitForTimeout(500)
    await page.locator('[data-testid="checkout-button"]').click()
    await page.waitForURL(/\/checkout/)
    
    // Fill form
    await page.fill('[name="name"]', 'Nguyễn Văn A')
    await page.fill('[name="email"]', 'test@example.com')
    await page.fill('[name="phone"]', '0901234567')
    
    // Verify all fields filled
    await expect(page.locator('[name="name"]')).toHaveValue('Nguyễn Văn A')
    await expect(page.locator('[name="email"]')).toHaveValue('test@example.com')
    await expect(page.locator('[name="phone"]')).toHaveValue('0901234567')
    
    // Submit button should be enabled
    const submitBtn = page.locator('[data-testid="confirm-payment-button"]')
    await expect(submitBtn).toBeEnabled()
  })

  test('TC-02-05: Confirm payment (customer side)', async ({ page }) => {
    // Setup: Create order and fill info
    await page.goto(`/events/${EVENT_ID}/seats`)
    await page.waitForSelector('[data-testid="seat-map"]')
    await page.locator('button[data-status="available"]').first().click()
    await page.waitForTimeout(500)
    await page.locator('[data-testid="checkout-button"]').click()
    await page.waitForURL(/\/checkout/)
    
    // Fill customer info
    await page.fill('[name="name"]', 'Test User')
    await page.fill('[name="email"]', 'testuser@example.com')
    await page.fill('[name="phone"]', '0909123456')
    
    // Click "Tôi đã chuyển khoản"
    const confirmBtn = page.locator('[data-testid="confirm-payment-button"]')
    await confirmBtn.click()
    
    // Should redirect to ticket page
    await page.waitForURL(/\/ticket\/TKH-/, { timeout: 15000 })
    
    // Verify ticket status page
    const statusMessage = page.locator('[data-testid="order-status"]')
    await expect(statusMessage).toBeVisible()
    
    // Should show waiting for admin confirmation
    await expect(page.locator('text=/chờ xác nhận/i')).toBeVisible()
  })

  test('TC-02-06: Email validation', async ({ page }) => {
    // Create order
    await page.goto(`/events/${EVENT_ID}/seats`)
    await page.waitForSelector('[data-testid="seat-map"]')
    await page.locator('button[data-status="available"]').first().click()
    await page.waitForTimeout(500)
    await page.locator('[data-testid="checkout-button"]').click()
    await page.waitForURL(/\/checkout/)
    
    // Try invalid email
    await page.fill('[name="name"]', 'Test User')
    await page.fill('[name="email"]', 'invalid-email')
    await page.fill('[name="phone"]', '0909123456')
    
    // Try to submit
    await page.locator('[data-testid="confirm-payment-button"]').click()
    
    // Should show validation error
    const emailInput = page.locator('[name="email"]')
    const validationMessage = await emailInput.evaluate(
      (el: HTMLInputElement) => el.validationMessage
    )
    expect(validationMessage).toBeTruthy()
    
    // Fix email
    await page.fill('[name="email"]', 'valid@example.com')
    
    // Now should work
    await page.locator('[data-testid="confirm-payment-button"]').click()
    await page.waitForURL(/\/ticket\//, { timeout: 10000 })
  })

  test('TC-02-07: Phone validation', async ({ page }) => {
    // Create order
    await page.goto(`/events/${EVENT_ID}/seats`)
    await page.waitForSelector('[data-testid="seat-map"]')
    await page.locator('button[data-status="available"]').first().click()
    await page.waitForTimeout(500)
    await page.locator('[data-testid="checkout-button"]').click()
    await page.waitForURL(/\/checkout/)
    
    // Try invalid phone
    await page.fill('[name="name"]', 'Test User')
    await page.fill('[name="email"]', 'test@example.com')
    await page.fill('[name="phone"]', '123') // Too short
    
    // Try to submit
    await page.locator('[data-testid="confirm-payment-button"]').click()
    
    // Should show error (either validation or toast)
    const hasError = await page.locator('[role="alert"], .error').isVisible()
    expect(hasError).toBeTruthy()
  })

  test('TC-02-08: Copy bank account info', async ({ page }) => {
    // Create order
    await page.goto(`/events/${EVENT_ID}/seats`)
    await page.waitForSelector('[data-testid="seat-map"]')
    await page.locator('button[data-status="available"]').first().click()
    await page.waitForTimeout(500)
    await page.locator('[data-testid="checkout-button"]').click()
    await page.waitForURL(/\/checkout/)
    
    // Find copy button for account number
    const copyBtn = page.locator('[data-testid="copy-account-number"]')
    await expect(copyBtn).toBeVisible()
    
    // Click to copy
    await copyBtn.click()
    
    // Should show success feedback
    await expect(copyBtn).toContainText(/đã copy|copied/i, { timeout: 3000 })
  })
})
