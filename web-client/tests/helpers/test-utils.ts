import { Page, expect } from '@playwright/test'

/**
 * Test Utilities for TEDx Playwright Tests
 * Reusable functions for common test operations
 */

export const TEST_CONFIG = {
  EVENT_ID: 'evt-tedx-2026',
  API_BASE: process.env.NEXT_PUBLIC_API_URL || 'http://localhost:4000/api',
  ADMIN_EMAIL: 'admin@tedx.com',
  ADMIN_PASSWORD: 'admin123456',
  TEST_USER: {
    name: 'Test User',
    email: 'playwright-test@example.com',
    phone: '0909123456',
  },
}

/**
 * Select N available seats on the seat selection page
 */
export async function selectSeats(page: Page, count: number = 1) {
  const seats = page.locator('button[data-status="available"]')
  
  for (let i = 0; i < count; i++) {
    await seats.nth(i).click()
    await page.waitForTimeout(500) // Wait for API response
  }
  
  // Verify selection
  const counter = page.locator('[data-testid="selected-count"]')
  await expect(counter).toContainText(count.toString())
  
  return seats
}

/**
 * Navigate to seat selection page and wait for load
 */
export async function goToSeatSelection(page: Page, eventId: string = TEST_CONFIG.EVENT_ID) {
  await page.goto(`/events/${eventId}/seats`)
  await page.waitForSelector('[data-testid="seat-map"]', { timeout: 10000 })
}

/**
 * Complete checkout flow up to payment confirmation page
 */
export async function checkoutSeats(page: Page, seatCount: number = 1) {
  // Select seats
  await goToSeatSelection(page)
  await selectSeats(page, seatCount)
  
  // Click checkout
  const checkoutBtn = page.locator('[data-testid="checkout-button"]')
  await checkoutBtn.click()
  
  // Wait for redirect
  await page.waitForURL(/\/checkout\?/, { timeout: 10000 })
  
  // Extract order info from URL
  const url = page.url()
  const orderMatch = url.match(/order=([^&]+)/)
  const tokenMatch = url.match(/token=([^&]+)/)
  
  return {
    orderNumber: orderMatch?.[1] || '',
    accessToken: tokenMatch?.[1] || '',
  }
}

/**
 * Fill customer information form on checkout page
 */
export async function fillCustomerInfo(
  page: Page,
  info = TEST_CONFIG.TEST_USER
) {
  await page.fill('[name="name"]', info.name)
  await page.fill('[name="email"]', info.email)
  await page.fill('[name="phone"]', info.phone)
}

/**
 * Complete full customer purchase flow
 */
export async function completePurchase(page: Page, seatCount: number = 1) {
  const orderInfo = await checkoutSeats(page, seatCount)
  await fillCustomerInfo(page)
  
  // Confirm payment
  const confirmBtn = page.locator('[data-testid="confirm-payment-button"]')
  await confirmBtn.click()
  
  // Wait for ticket page
  await page.waitForURL(/\/ticket\//, { timeout: 15000 })
  
  return orderInfo
}

/**
 * Admin login helper
 */
export async function adminLogin(page: Page) {
  await page.goto('/admin/login')
  await page.fill('[name="email"]', TEST_CONFIG.ADMIN_EMAIL)
  await page.fill('[name="password"]', TEST_CONFIG.ADMIN_PASSWORD)
  await page.click('[data-testid="login-button"]')
  
  // Wait for redirect to admin dashboard
  await page.waitForURL(/\/admin/, { timeout: 10000 })
}

/**
 * Wait for API response with specific endpoint
 */
export async function waitForApiResponse(
  page: Page,
  endpoint: string,
  method: string = 'POST'
) {
  return page.waitForResponse(
    (response) =>
      response.url().includes(endpoint) && response.request().method() === method,
    { timeout: 10000 }
  )
}

/**
 * Get session ID from localStorage
 */
export async function getSessionId(page: Page): Promise<string> {
  return page.evaluate(() => {
    return localStorage.getItem('sessionId') || ''
  })
}

/**
 * Parse timer string (MM:SS) to seconds
 */
export function parseTimer(timeStr: string): number {
  const match = timeStr.match(/(\d+):(\d+)/)
  if (!match) return 0
  return parseInt(match[1]) * 60 + parseInt(match[2])
}

/**
 * Wait for toast message to appear
 */
export async function waitForToast(page: Page, expectedText?: string) {
  const toast = page.locator('[role="alert"], .toast')
  await expect(toast.first()).toBeVisible({ timeout: 5000 })
  
  if (expectedText) {
    await expect(toast.first()).toContainText(expectedText)
  }
  
  return toast.first()
}

/**
 * Clean up test data - unlock all seats for a session
 */
export async function cleanupSession(page: Page) {
  const sessionId = await getSessionId(page)
  
  if (sessionId) {
    // Call API to unlock all seats for this session
    await page.evaluate(
      async ({ apiBase, sessionId, eventId }) => {
        await fetch(`${apiBase}/seats/unlock`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ sessionId, eventId }),
        })
      },
      {
        apiBase: TEST_CONFIG.API_BASE,
        sessionId,
        eventId: TEST_CONFIG.EVENT_ID,
      }
    )
  }
}

/**
 * Create a test order via API (for testing ticket/admin features)
 */
export async function createTestOrder(page: Page, seatIds: string[]) {
  const sessionId = await getSessionId(page)
  
  const response = await page.request.post(
    `${TEST_CONFIG.API_BASE}/orders/create-pending`,
    {
      data: {
        eventId: TEST_CONFIG.EVENT_ID,
        seatIds,
        sessionId,
      },
    }
  )
  
  const data = await response.json()
  return data.data
}

/**
 * Assert seat has specific status
 */
export async function assertSeatStatus(
  page: Page,
  seatId: string,
  expectedStatus: string
) {
  const seat = page.locator(`button[data-seat-id="${seatId}"]`)
  await expect(seat).toHaveAttribute('data-status', expectedStatus)
}
