# Playwright Testing - Quick Reference Card 🚀

## ⚡ Quick Commands

```bash
# Install browsers (one-time)
npm run test:install

# Run all tests
npm run test:e2e

# UI mode (best for development)
npm run test:e2e:ui

# Run specific test file
npx playwright test 01-seat-selection

# Run tests matching name
npx playwright test --grep "TC-01-01"

# Debug mode
npm run test:e2e:debug

# Headed mode (see browser)
npm run test:e2e:headed

# View last report
npm run test:e2e:report

# Update snapshots
npx playwright test --update-snapshots
```

---

## 📝 Common Test Patterns

### Basic Test Structure
```typescript
import { test, expect } from '@playwright/test'

test('My test', async ({ page }) => {
  // Navigate
  await page.goto('/my-page')
  
  // Interact
  await page.click('[data-testid="my-button"]')
  
  // Assert
  await expect(page.locator('[data-testid="result"]')).toBeVisible()
})
```

### Using Test Utilities
```typescript
import { goToSeatSelection, selectSeats } from '../helpers/test-utils'

test('Quick test', async ({ page }) => {
  await goToSeatSelection(page)
  await selectSeats(page, 2)
  // Continue...
})
```

### Wait for API
```typescript
await page.waitForResponse(
  res => res.url().includes('/api/seats/lock'),
  { timeout: 5000 }
)
```

### Multiple Contexts (Different Users)
```typescript
test('Two users', async ({ browser }) => {
  const user1 = await browser.newContext()
  const user2 = await browser.newContext()
  
  const page1 = await user1.newPage()
  const page2 = await user2.newPage()
  
  // ... test ...
  
  await user1.close()
  await user2.close()
})
```

---

## 🎯 Selectors Priority

1. **data-testid** (Best)
   ```typescript
   page.locator('[data-testid="checkout-button"]')
   ```

2. **Role + Name**
   ```typescript
   page.getByRole('button', { name: 'Checkout' })
   ```

3. **Text Content**
   ```typescript
   page.getByText('Thanh toán')
   ```

4. **CSS Selectors** (Last resort)
   ```typescript
   page.locator('.btn-checkout')
   ```

---

## ✅ Assertions

```typescript
// Visibility
await expect(element).toBeVisible()
await expect(element).toBeHidden()

// Text content
await expect(element).toContainText('Hello')
await expect(element).toHaveText('Exact text')

// Attributes
await expect(element).toHaveAttribute('data-status', 'selected')
await expect(element).toHaveClass(/active/)

// State
await expect(button).toBeEnabled()
await expect(button).toBeDisabled()
await expect(checkbox).toBeChecked()

// Count
await expect(elements).toHaveCount(3)

// Value
await expect(input).toHaveValue('test@example.com')

// URL
await expect(page).toHaveURL(/\/checkout/)
await expect(page).toHaveTitle(/TEDx/)
```

---

## 🔧 Debugging

### Pause Execution
```typescript
await page.pause() // Opens inspector
```

### Console Logs
```typescript
page.on('console', msg => console.log(msg.text()))
```

### Take Screenshot
```typescript
await page.screenshot({ path: 'debug.png' })
```

### Slow Motion
```typescript
const browser = await chromium.launch({ slowMo: 1000 })
```

---

## 📊 Test Filters

```bash
# Run specific file
npx playwright test checkout-flow

# Run tests matching pattern
npx playwright test --grep "TC-01"

# Skip tests
npx playwright test --grep-invert "slow"

# Run in specific browser
npx playwright test --project=chromium

# Run in headed mode
npx playwright test --headed

# Run with specific workers
npx playwright test --workers=1
```

---

## 🎨 Data Test IDs to Add

Add these to your components for tests to work:

### Seat Selection Page
```tsx
data-testid="seat-map"
data-testid="selected-count"
data-testid="total-price"
data-testid="lock-timer"
data-testid="checkout-button"
```

### Seat Component
```tsx
data-testid="seat-{id}"
data-seat-id="{id}"
data-status="{status}"
data-price="{price}"
data-seat-type="{type}"
```

### Checkout Page
```tsx
data-testid="checkout-page"
data-testid="order-number"
data-testid="selected-seats"
data-testid="copy-account-number"
data-testid="confirm-payment-button"
```

### Ticket Page
```tsx
data-testid="ticket-page"
data-testid="order-number-display"
data-testid="order-status"
data-testid="download-pdf-button"
data-testid="qr-code"
```

---

## 🚨 Common Issues & Fixes

### "Element not found"
```typescript
// Add explicit wait
await page.waitForSelector('[data-testid="my-element"]')

// Or use auto-waiting assertions
await expect(page.locator('[data-testid="my-element"]')).toBeVisible()
```

### "Timeout waiting for"
```typescript
// Increase timeout
await page.click('[data-testid="btn"]', { timeout: 10000 })

// Or in config
use: {
  actionTimeout: 15000
}
```

### "Element is not attached"
```typescript
// Re-query element instead of storing reference
const getButton = () => page.locator('[data-testid="btn"]')
await getButton().click()
```

### Tests are flaky
```typescript
// Add stability waits
await page.waitForLoadState('networkidle')

// Wait for API
await page.waitForResponse(res => res.url().includes('/api/'))

// Use built-in retries (in config)
retries: 2
```

---

## 📚 Useful Links

- **Test Cases:** `tests/test-cases.md`
- **Setup Guide:** `TESTING_SETUP.md`
- **Full Guide:** `tests/README.md`
- **Playwright Docs:** https://playwright.dev
- **Best Practices:** https://playwright.dev/docs/best-practices

---

## 🎯 Test Execution Workflow

1. **Start dev server:** `npm run dev`
2. **Open UI mode:** `npm run test:e2e:ui`
3. **Select test to run**
4. **Watch execution**
5. **Fix failures**
6. **Re-run**
7. **Commit when green** ✅
