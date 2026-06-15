import { test, expect } from '@playwright/test'
import { goToSeatSelection, getSessionId, assertSeatStatus } from '../helpers/test-utils'

/**
 * Test Suite: TC-06 - Race Condition Tests
 * Critical tests for concurrent access and seat locking conflicts
 */

const EVENT_ID = 'evt-tedx-2026'

test.describe('TC-06: Race Conditions & Concurrent Access', () => {
  test('TC-06-01: Two users cannot select same seat simultaneously', async ({ browser }) => {
    // Create two separate browser contexts (different users)
    const context1 = await browser.newContext()
    const context2 = await browser.newContext()
    
    const page1 = await context1.newPage()
    const page2 = await context2.newPage()
    
    try {
      // Both users load the seat page
      await Promise.all([
        goToSeatSelection(page1, EVENT_ID),
        goToSeatSelection(page2, EVENT_ID),
      ])
      
      // Get first available seat
      const seat1 = page1.locator('button[data-status="available"]').first()
      const seatId = await seat1.getAttribute('data-seat-id')
      
      const seat2 = page2.locator(`button[data-seat-id="${seatId}"]`)
      
      // User 1 clicks first
      await seat1.click()
      await page1.waitForTimeout(500)
      
      // User 2 tries to click the same seat
      await seat2.click()
      await page2.waitForTimeout(500)
      
      // User 1 should have it selected
      await assertSeatStatus(page1, seatId!, 'selected')
      
      // User 2 should see it as locked
      await assertSeatStatus(page2, seatId!, 'locked')
      
      // Verify counter
      const counter1 = page1.locator('[data-testid="selected-count"]')
      const counter2 = page2.locator('[data-testid="selected-count"]')
      
      await expect(counter1).toContainText('1')
      await expect(counter2).toContainText('0')
      
      // User 2 should see error toast
      const toast2 = page2.locator('[role="alert"]')
      await expect(toast2).toContainText(/đang được giữ|locked|không thể chọn/i)
    } finally {
      await context1.close()
      await context2.close()
    }
  })

  test('TC-06-02: Concurrent checkout of overlapping seats', async ({ browser }) => {
    const context1 = await browser.newContext()
    const context2 = await browser.newContext()
    
    const page1 = await context1.newPage()
    const page2 = await context2.newPage()
    
    try {
      await Promise.all([
        goToSeatSelection(page1, EVENT_ID),
        goToSeatSelection(page2, EVENT_ID),
      ])
      
      // User 1 selects seats 1-3
      const seats1 = page1.locator('button[data-status="available"]')
      for (let i = 0; i < 3; i++) {
        await seats1.nth(i).click()
        await page1.waitForTimeout(300)
      }
      
      // User 2 tries to select seat 2 (already locked by user 1)
      const seat2Id = await seats1.nth(1).getAttribute('data-seat-id')
      const seat2_u2 = page2.locator(`button[data-seat-id="${seat2Id}"]`)
      
      await seat2_u2.click()
      
      // Should fail
      await assertSeatStatus(page2, seat2Id!, 'locked')
      
      // User 2 selects different seat (seat 4)
      await page2.locator('button[data-status="available"]').nth(3).click()
      await page2.waitForTimeout(500)
      
      // User 2 should have 1 seat
      const counter2 = page2.locator('[data-testid="selected-count"]')
      await expect(counter2).toContainText('1')
      
      // Both users try to checkout
      const checkout1 = page1.locator('[data-testid="checkout-button"]')
      const checkout2 = page2.locator('[data-testid="checkout-button"]')
      
      await Promise.all([
        checkout1.click(),
        checkout2.click(),
      ])
      
      // Both should successfully reach checkout with their respective seats
      await page1.waitForURL(/\/checkout/, { timeout: 10000 })
      await page2.waitForURL(/\/checkout/, { timeout: 10000 })
      
      // Different order numbers
      const url1 = page1.url()
      const url2 = page2.url()
      
      const order1 = url1.match(/order=([^&]+)/)?.[1]
      const order2 = url2.match(/order=([^&]+)/)?.[1]
      
      expect(order1).toBeTruthy()
      expect(order2).toBeTruthy()
      expect(order1).not.toBe(order2)
    } finally {
      await context1.close()
      await context2.close()
    }
  })

  test('TC-06-03: Lock expiration allows next user to claim seat', async ({ browser }) => {
    const context1 = await browser.newContext()
    const page1 = await context1.newPage()
    
    await goToSeatSelection(page1, EVENT_ID)
    
    // User 1 selects a seat
    const seat = page1.locator('button[data-status="available"]').first()
    const seatId = await seat.getAttribute('data-seat-id')
    await seat.click()
    await page1.waitForTimeout(500)
    
    // Get session ID for later cleanup
    const session1 = await getSessionId(page1)
    
    // Simulate lock expiration by manually unlocking via API
    // (In real scenario, would wait 10 minutes)
    await page1.evaluate(
      async ({ apiBase, seatId, sessionId, eventId }) => {
        await fetch(`${apiBase}/seats/lock`, {
          method: 'DELETE',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            seatIds: [seatId],
            sessionId,
            eventId,
          }),
        })
      },
      {
        apiBase: process.env.NEXT_PUBLIC_API_URL || 'http://localhost:4000/api',
        seatId,
        sessionId: session1,
        eventId: EVENT_ID,
      }
    )
    
    await context1.close()
    
    // User 2 tries to select the same seat
    const context2 = await browser.newContext()
    const page2 = await context2.newPage()
    
    try {
      await goToSeatSelection(page2, EVENT_ID)
      
      const seat2 = page2.locator(`button[data-seat-id="${seatId}"]`)
      
      // Should be available now
      await assertSeatStatus(page2, seatId!, 'available')
      
      // User 2 can select it
      await seat2.click()
      await page2.waitForTimeout(500)
      
      // Should be selected
      await assertSeatStatus(page2, seatId!, 'selected')
      
      const counter = page2.locator('[data-testid="selected-count"]')
      await expect(counter).toContainText('1')
    } finally {
      await context2.close()
    }
  })

  test('TC-06-04: Multiple tabs same user - shared session', async ({ browser }) => {
    const context = await browser.newContext()
    
    // Same user, two tabs
    const page1 = await context.newPage()
    const page2 = await context.newPage()
    
    try {
      // Both tabs load seat page
      await Promise.all([
        goToSeatSelection(page1, EVENT_ID),
        goToSeatSelection(page2, EVENT_ID),
      ])
      
      // Ensure same session ID
      const session1 = await getSessionId(page1)
      const session2 = await getSessionId(page2)
      expect(session1).toBe(session2)
      
      // Select seat in tab 1
      const seat1 = page1.locator('button[data-status="available"]').first()
      const seatId = await seat1.getAttribute('data-seat-id')
      await seat1.click()
      await page1.waitForTimeout(1000)
      
      // Tab 2 should show it as selected (same user)
      // Note: This requires BroadcastChannel or localStorage sync
      const seat2 = page2.locator(`button[data-seat-id="${seatId}"]`)
      
      // Refresh tab 2 to see updated state
      await page2.reload()
      await page2.waitForSelector('[data-testid="seat-map"]')
      
      // Should see as selected or locked_by_me
      const status = await seat2.getAttribute('data-status')
      expect(['selected', 'locked_by_me']).toContain(status)
      
      // Counter in both tabs should show 1
      const counter1 = page1.locator('[data-testid="selected-count"]')
      const counter2 = page2.locator('[data-testid="selected-count"]')
      
      await expect(counter1).toContainText('1')
      await expect(counter2).toContainText('1')
    } finally {
      await context.close()
    }
  })
})
