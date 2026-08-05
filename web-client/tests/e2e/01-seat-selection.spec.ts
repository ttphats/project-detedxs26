import { test, expect } from '@playwright/test'

/**
 * Test Suite: TC-01 - Seat Selection Tests
 * Critical user flow for selecting and deselecting seats
 */

const EVENT_ID = 'evt-tedx-2026'
const API_BASE = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:4000/api'

test.describe('TC-01: Seat Selection', () => {
  test.beforeEach(async ({ page }) => {
    // Navigate to seat selection page
    await page.goto(`/events/${EVENT_ID}/seats`)
    
    // Wait for seat map to load
    await page.waitForSelector('[data-testid="seat-map"]', { timeout: 10000 })
  })

  test('TC-01-01: Select single available seat', async ({ page }) => {
    // Find first available seat (green)
    const availableSeat = page.locator('button[data-status="available"]').first()
    
    // Get seat ID before clicking
    const seatId = await availableSeat.getAttribute('data-seat-id')
    expect(seatId).toBeTruthy()
    
    // Click to select
    await availableSeat.click()
    
    // Verify seat changed to selected
    await expect(availableSeat).toHaveAttribute('data-status', 'selected')
    
    // Verify selected seats counter
    const counter = page.locator('[data-testid="selected-count"]')
    await expect(counter).toContainText('1')
    
    // Verify total price updated
    const totalPrice = page.locator('[data-testid="total-price"]')
    await expect(totalPrice).not.toBeEmpty()
    
    // Verify checkout button enabled
    const checkoutBtn = page.locator('[data-testid="checkout-button"]')
    await expect(checkoutBtn).toBeEnabled()
    
    // Verify lock timer started
    const timer = page.locator('[data-testid="lock-timer"]')
    await expect(timer).toBeVisible()
    await expect(timer).toContainText(/\d{1,2}:\d{2}/)
  })

  test('TC-01-02: Select multiple seats (max 4)', async ({ page }) => {
    const availableSeats = page.locator('button[data-status="available"]')
    
    // Select 4 seats
    for (let i = 0; i < 4; i++) {
      await availableSeats.nth(i).click()
      await page.waitForTimeout(500) // Wait for API response
    }
    
    // Verify 4 seats selected
    const counter = page.locator('[data-testid="selected-count"]')
    await expect(counter).toContainText('4')
    
    // Try to select 5th seat - should be blocked
    await availableSeats.nth(4).click()
    
    // Verify error message
    const errorToast = page.locator('.toast-error, [role="alert"]')
    await expect(errorToast).toContainText(/tối đa 4 ghế/i)
    
    // Counter should still be 4
    await expect(counter).toContainText('4')
  })

  test('TC-01-03: Deselect seat', async ({ page }) => {
    // Select a seat first
    const seat = page.locator('button[data-status="available"]').first()
    await seat.click()
    
    // Verify selected
    await expect(seat).toHaveAttribute('data-status', 'selected')
    
    // Click again to deselect
    await seat.click()
    await page.waitForTimeout(300)
    
    // Verify deselected (back to available)
    await expect(seat).toHaveAttribute('data-status', 'available')
    
    // Counter should be 0
    const counter = page.locator('[data-testid="selected-count"]')
    await expect(counter).toContainText('0')
    
    // Checkout button disabled
    const checkoutBtn = page.locator('[data-testid="checkout-button"]')
    await expect(checkoutBtn).toBeDisabled()
  })

  test('TC-01-04: Cannot select sold seat', async ({ page }) => {
    // Find sold seat
    const soldSeat = page.locator('button[data-status="sold"]').first()
    
    if (await soldSeat.count() === 0) {
      test.skip(true, 'No sold seats available for testing')
      return
    }
    
    // Try to click
    await soldSeat.click()
    
    // Verify still sold
    await expect(soldSeat).toHaveAttribute('data-status', 'sold')
    
    // Verify disabled state
    await expect(soldSeat).toBeDisabled()
    
    // Counter should be 0
    const counter = page.locator('[data-testid="selected-count"]')
    await expect(counter).toContainText('0')
  })

  test('TC-01-05: Cannot select locked seat (by another user)', async ({ page, context }) => {
    // Create second user context
    const page2 = await context.newPage()
    
    // User 1: Select a seat
    const seat = page.locator('button[data-status="available"]').first()
    const seatId = await seat.getAttribute('data-seat-id')
    await seat.click()
    await page.waitForTimeout(1000)
    
    // User 2: Try to select same seat
    await page2.goto(`/events/${EVENT_ID}/seats`)
    await page2.waitForSelector('[data-testid="seat-map"]')
    
    const sameSeat = page2.locator(`button[data-seat-id="${seatId}"]`)
    
    // Should be locked for user 2
    await expect(sameSeat).toHaveAttribute('data-status', 'locked')
    
    // Try to click
    await sameSeat.click()
    
    // Should show error
    const errorToast = page2.locator('[role="alert"]')
    await expect(errorToast).toContainText(/đang được giữ/i)
    
    await page2.close()
  })

  test('TC-01-06: Price calculation for multiple seats', async ({ page }) => {
    // Select 2 different seat types
    const vipSeat = page.locator('button[data-seat-type="VIP"]').first()
    const standardSeat = page.locator('button[data-seat-type="STANDARD"]').first()
    
    // Get prices
    const vipPrice = await vipSeat.getAttribute('data-price')
    const stdPrice = await standardSeat.getAttribute('data-price')
    
    // Select both
    await vipSeat.click()
    await page.waitForTimeout(300)
    await standardSeat.click()
    await page.waitForTimeout(300)
    
    // Calculate expected total
    const expectedTotal = parseInt(vipPrice || '0') + parseInt(stdPrice || '0')
    
    // Verify total price
    const totalPrice = page.locator('[data-testid="total-price"]')
    const displayedTotal = await totalPrice.textContent()
    
    // Remove formatting and compare
    const numericTotal = displayedTotal?.replace(/[^\d]/g, '') || '0'
    expect(parseInt(numericTotal)).toBe(expectedTotal)
  })

  test('TC-01-07: Lock timer countdown', async ({ page }) => {
    // Select a seat
    await page.locator('button[data-status="available"]').first().click()
    
    // Get initial timer value
    const timer = page.locator('[data-testid="lock-timer"]')
    const initialTime = await timer.textContent()
    
    // Should start at 10:00 or close to it
    expect(initialTime).toMatch(/^(10|9):\d{2}$/)
    
    // Wait 3 seconds
    await page.waitForTimeout(3000)
    
    // Timer should have decreased
    const laterTime = await timer.textContent()
    expect(laterTime).not.toBe(initialTime)
    
    // Parse and verify countdown
    const parseTime = (t: string) => {
      const [min, sec] = t.split(':').map(Number)
      return min * 60 + sec
    }
    
    const initialSeconds = parseTime(initialTime!)
    const laterSeconds = parseTime(laterTime!)
    
    expect(laterSeconds).toBeLessThan(initialSeconds)
  })
})
