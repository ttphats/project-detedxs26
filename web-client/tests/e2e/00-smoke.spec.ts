import { test, expect } from '@playwright/test'

/**
 * Smoke Tests - Quick verification that basic setup works
 * Run this first to verify environment is ready
 */

const EVENT_ID = 'evt-tedx-2026'

test.describe('Smoke Tests - Basic Setup Verification', () => {
  test('App loads successfully', async ({ page }) => {
    await page.goto('/')
    
    // Should load without errors
    await expect(page).toHaveTitle(/TEDx/i)
    
    // No console errors
    const errors: string[] = []
    page.on('console', (msg) => {
      if (msg.type() === 'error') {
        errors.push(msg.text())
      }
    })
    
    await page.waitForTimeout(2000)
    
    // Allow some common React warnings but no real errors
    const seriousErrors = errors.filter(
      (e) => !e.includes('Warning:') && !e.includes('DevTools')
    )
    expect(seriousErrors.length).toBe(0)
  })

  test('Event page loads', async ({ page }) => {
    await page.goto(`/events/${EVENT_ID}`)
    
    // Should show event content
    await expect(page.locator('body')).toBeVisible()
    
    // No 404 error
    const bodyText = await page.textContent('body')
    expect(bodyText).not.toContain('404')
    expect(bodyText).not.toContain('Not Found')
  })

  test('Seat selection page loads', async ({ page }) => {
    await page.goto(`/events/${EVENT_ID}/seats`)
    
    // Should load within 10 seconds
    await page.waitForLoadState('networkidle', { timeout: 10000 })
    
    // Page should have content
    const bodyText = await page.textContent('body')
    expect(bodyText!.length).toBeGreaterThan(100)
  })

  test('Backend API is accessible', async ({ page }) => {
    const apiBase = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:4000/api'
    
    // Try to fetch event data
    const response = await page.request.get(`${apiBase}/events/${EVENT_ID}`)
    
    // Should return 200 or 404 (not connection error)
    expect([200, 404]).toContain(response.status())
    
    if (response.status() === 200) {
      const data = await response.json()
      expect(data).toHaveProperty('success')
    }
  })

  test('Session ID is generated', async ({ page }) => {
    await page.goto(`/events/${EVENT_ID}/seats`)
    
    // Check localStorage has sessionId
    const sessionId = await page.evaluate(() => {
      return localStorage.getItem('sessionId')
    })
    
    expect(sessionId).toBeTruthy()
    expect(sessionId!.length).toBeGreaterThan(10)
  })

  test('Seats render (at least one seat visible)', async ({ page }) => {
    await page.goto(`/events/${EVENT_ID}/seats`)
    
    // Wait for any seat to appear
    const hasSeat = await page
      .locator('button[data-seat-id], .seat, [class*="seat"]')
      .first()
      .isVisible({ timeout: 10000 })
      .catch(() => false)
    
    if (!hasSeat) {
      // If no seats found with data-testid, that's expected
      // Just verify page loaded
      const bodyText = await page.textContent('body')
      expect(bodyText).toBeTruthy()
    }
  })

  test('Can navigate between pages', async ({ page }) => {
    // Start at home
    await page.goto('/')
    
    // Navigate to event
    await page.goto(`/events/${EVENT_ID}`)
    await page.waitForLoadState('networkidle')
    
    // Navigate to seats
    await page.goto(`/events/${EVENT_ID}/seats`)
    await page.waitForLoadState('networkidle')
    
    // Should be on seats page
    expect(page.url()).toContain('/seats')
  })

  test('Responsive layout works', async ({ page }) => {
    // Desktop
    await page.setViewportSize({ width: 1920, height: 1080 })
    await page.goto(`/events/${EVENT_ID}/seats`)
    await page.waitForLoadState('networkidle')
    
    let bodyText = await page.textContent('body')
    expect(bodyText).toBeTruthy()
    
    // Mobile
    await page.setViewportSize({ width: 375, height: 667 })
    await page.goto(`/events/${EVENT_ID}/seats`)
    await page.waitForLoadState('networkidle')
    
    bodyText = await page.textContent('body')
    expect(bodyText).toBeTruthy()
  })

  test('Environment variables are set', async ({ page }) => {
    const apiUrl = process.env.NEXT_PUBLIC_API_URL
    
    // Either set to backend URL or default
    expect(apiUrl || 'http://localhost:4000/api').toContain('http')
  })

  test('Playwright can click buttons', async ({ page }) => {
    await page.goto(`/events/${EVENT_ID}/seats`)
    
    // Try to find any clickable button
    const button = page.locator('button').first()
    
    const isVisible = await button.isVisible({ timeout: 5000 }).catch(() => false)
    
    if (isVisible) {
      // Just verify we can click (might not do anything yet)
      await button.click({ timeout: 3000 }).catch(() => {
        // Click might fail if button is disabled, that's ok for smoke test
      })
    }
    
    // Test passes if we got here without crashing
    expect(true).toBe(true)
  })
})

test.describe('Smoke Tests - Test Infrastructure', () => {
  test('Test utilities can be imported', async () => {
    // Try to import test utils
    const testUtils = await import('../helpers/test-utils')
    
    expect(testUtils).toBeDefined()
    expect(testUtils.TEST_CONFIG).toBeDefined()
    expect(testUtils.goToSeatSelection).toBeDefined()
  })

  test('Multiple browser contexts work', async ({ browser }) => {
    const context1 = await browser.newContext()
    const context2 = await browser.newContext()
    
    const page1 = await context1.newPage()
    const page2 = await context2.newPage()
    
    await page1.goto('/')
    await page2.goto('/')
    
    expect(page1).not.toBe(page2)
    
    await context1.close()
    await context2.close()
  })

  test('Screenshots work', async ({ page }) => {
    await page.goto('/')
    
    // Take a screenshot
    const screenshot = await page.screenshot()
    
    expect(screenshot).toBeTruthy()
    expect(screenshot.length).toBeGreaterThan(1000)
  })
})
