import { test, expect } from '@playwright/test'

/**
 * Test Suite: Speaker Registration Feature
 * Tests admin functionality for speaker submissions, config, and partners
 */

const ADMIN_URL = 'http://localhost:3002'
const API_URL = 'http://localhost:4000'
const ADMIN_USERNAME = 'admin'
const ADMIN_PASSWORD = 'admin123456'

test.describe('Speaker Registration - Admin Tests', () => {
  
  test.describe('TC-01: Admin Login', () => {
    
    test('TC-01-01: Login with valid credentials', async ({ page }) => {
      // Navigate to login page
      await page.goto(`${ADMIN_URL}/admin/login`)
      
      // Verify page loaded
      await expect(page).toHaveTitle(/TEDx/)
      await expect(page.locator('text=TEDx Admin')).toBeVisible()
      
      // Fill login form
      await page.fill('input[type="text"]', ADMIN_USERNAME)
      await page.fill('input[type="password"]', ADMIN_PASSWORD)
      
      // Click login button
      await page.click('button:has-text("Sign in")')
      
      // Wait for redirect
      await page.waitForURL(`${ADMIN_URL}/admin/dashboard`, { timeout: 10000 })
      
      // Verify dashboard loaded
      await expect(page.locator('text=Dashboard')).toBeVisible()
      
      // Verify token saved in localStorage
      const token = await page.evaluate(() => localStorage.getItem('token'))
      expect(token).toBeTruthy()
      expect(token).toMatch(/^[A-Za-z0-9-_]+\.[A-Za-z0-9-_]+\.[A-Za-z0-9-_]+$/) // JWT format
    })
    
    test('TC-01-02: Login with invalid credentials', async ({ page }) => {
      await page.goto(`${ADMIN_URL}/admin/login`)
      
      // Fill with wrong password
      await page.fill('input[type="text"]', ADMIN_USERNAME)
      await page.fill('input[type="password"]', 'wrongpassword')
      
      // Click login
      await page.click('button:has-text("Sign in")')
      
      // Wait for error message
      await expect(page.locator('text=/sai.*tên đăng nhập/i')).toBeVisible({ timeout: 5000 })
      
      // Verify still on login page
      await expect(page).toHaveURL(`${ADMIN_URL}/admin/login`)
      
      // Verify no token saved
      const token = await page.evaluate(() => localStorage.getItem('token'))
      expect(token).toBeNull()
    })
    
    test('TC-01-03: Access protected page without login', async ({ page }) => {
      // Clear any existing auth
      await page.goto(`${ADMIN_URL}/admin/login`)
      await page.evaluate(() => localStorage.clear())
      
      // Try to access protected page
      await page.goto(`${ADMIN_URL}/admin/speaker-submissions`)
      
      // Should redirect to login
      await page.waitForURL(`${ADMIN_URL}/admin/login`, { timeout: 5000 })
      await expect(page.locator('text=TEDx Admin')).toBeVisible()
    })
  })
  
  test.describe('TC-02: Speaker Submissions', () => {
    
    test.beforeEach(async ({ page }) => {
      // Login before each test
      await page.goto(`${ADMIN_URL}/admin/login`)
      await page.fill('input[type="text"]', ADMIN_USERNAME)
      await page.fill('input[type="password"]', ADMIN_PASSWORD)
      await page.click('button:has-text("Sign in")')
      await page.waitForURL(`${ADMIN_URL}/admin/dashboard`)
    })
    
    test('TC-02-01: Load submissions list', async ({ page }) => {
      // Navigate to submissions page
      await page.click('text=Speaker Submissions')
      await page.waitForURL(`${ADMIN_URL}/admin/speaker-submissions`)
      
      // Verify page loaded
      await expect(page.locator('h1:has-text("Speaker")')).toBeVisible()
      
      // Wait for table to load
      await page.waitForSelector('table', { timeout: 10000 })
      
      // Verify table has columns
      await expect(page.locator('th')).toContainText(['Status', 'Date'])
    })
    
    test('TC-02-02: View submission details', async ({ page }) => {
      await page.goto(`${ADMIN_URL}/admin/speaker-submissions`)
      await page.waitForSelector('table')
      
      // Click first "View" button if submissions exist
      const viewButton = page.locator('button:has-text("View")').first()
      const hasSubmissions = await viewButton.count() > 0
      
      if (hasSubmissions) {
        await viewButton.click()
        
        // Drawer should open
        await expect(page.locator('.ant-drawer')).toBeVisible()
        
        // Should show submission details
        await expect(page.locator('.ant-descriptions')).toBeVisible()
      } else {
        console.log('No submissions to test with')
      }
    })
    
    test('TC-02-03: Accept submission', async ({ page }) => {
      await page.goto(`${ADMIN_URL}/admin/speaker-submissions`)
      await page.waitForSelector('table')
      
      // Find pending submission
      const viewButton = page.locator('button:has-text("View")').first()
      const hasSubmissions = await viewButton.count() > 0
      
      if (hasSubmissions) {
        await viewButton.click()
        await page.waitForSelector('.ant-drawer')
        
        // Click accept button
        const acceptButton = page.locator('button:has-text("Accept")')
        if (await acceptButton.isVisible()) {
          await acceptButton.click()
          
          // Confirm if needed
          const confirmButton = page.locator('button:has-text("OK")')
          if (await confirmButton.isVisible()) {
            await confirmButton.click()
          }
          
          // Wait for success message
          await expect(page.locator('.ant-message-success')).toBeVisible({ timeout: 5000 })
        }
      }
    })
  })
  
  test.describe('TC-03: Speaker Config', () => {
    
    test.beforeEach(async ({ page }) => {
      // Login
      await page.goto(`${ADMIN_URL}/admin/login`)
      await page.fill('input[type="text"]', ADMIN_USERNAME)
      await page.fill('input[type="password"]', ADMIN_PASSWORD)
      await page.click('button:has-text("Sign in")')
      await page.waitForURL(`${ADMIN_URL}/admin/dashboard`)
    })
    
    test('TC-03-01: Load speaker config page', async ({ page }) => {
      // Navigate to config page
      await page.click('text=Speaker Config')
      await page.waitForURL(`${ADMIN_URL}/admin/speaker-config`)
      
      // Verify form loaded
      await expect(page.locator('h1:has-text("Speaker")')).toBeVisible()
      await expect(page.locator('input, textarea')).toHaveCount(3, { timeout: 10000 })
    })
  })
  
  test.describe('TC-04: Partners', () => {
    
    test.beforeEach(async ({ page }) => {
      // Login
      await page.goto(`${ADMIN_URL}/admin/login`)
      await page.fill('input[type="text"]', ADMIN_USERNAME)
      await page.fill('input[type="password"]', ADMIN_PASSWORD)
      await page.click('button:has-text("Sign in")')
      await page.waitForURL(`${ADMIN_URL}/admin/dashboard`)
    })
    
    test('TC-04-01: Load partners page', async ({ page }) => {
      // Navigate to partners
      await page.click('text=Partners')
      await page.waitForURL(`${ADMIN_URL}/admin/partners`)
      
      // Verify table loaded
      await expect(page.locator('table')).toBeVisible({ timeout: 10000 })
      await expect(page.locator('button:has-text("Add")')).toBeVisible()
    })
  })
})
