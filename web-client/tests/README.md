# E2E Testing with Playwright - TEDx Ticketing System

## 📋 Overview

Comprehensive end-to-end test suite for the TEDx ticketing platform using Playwright.

**Test Coverage:**
- ✅ Seat selection and locking
- ✅ Checkout flow and order creation
- ✅ Payment confirmation
- ✅ Ticket download and PDF generation
- ✅ Race conditions and concurrent access
- ✅ Lock expiration and timeouts

---

## 🚀 Quick Start

### 1. Install Dependencies

```bash
cd web-client
npm install
```

### 2. Install Playwright Browsers

```bash
npm run test:install
```

Or install all browsers:

```bash
npx playwright install
```

### 3. Start Development Server

```bash
# In one terminal
npm run dev
```

### 4. Run Tests

```bash
# In another terminal

# Run all tests
npm run test:e2e

# Run with UI mode (recommended for development)
npm run test:e2e:ui

# Run in headed mode (see browser)
npm run test:e2e:headed

# Run specific test file
npx playwright test 01-seat-selection

# Run tests matching pattern
npx playwright test --grep "TC-01"

# Debug mode
npm run test:e2e:debug
```

---

## 📁 Test Structure

```
web-client/
├── tests/
│   ├── e2e/
│   │   ├── 01-seat-selection.spec.ts    # TC-01: Seat selection tests
│   │   ├── 02-checkout-flow.spec.ts     # TC-02: Checkout and payment
│   │   ├── 03-ticket-download.spec.ts   # TC-04: Ticket viewing/download
│   │   └── 04-race-conditions.spec.ts   # TC-06: Concurrent access
│   ├── helpers/
│   │   └── test-utils.ts                # Reusable test utilities
│   ├── test-cases.md                    # Detailed test case documentation
│   └── README.md                        # This file
├── playwright.config.ts                 # Playwright configuration
└── playwright-report/                   # Generated test reports
```

---

## 🧪 Test Suites

### TC-01: Seat Selection (8 tests)
- ✅ Select single seat
- ✅ Select multiple seats (max 4)
- ✅ Deselect seat
- ❌ Cannot select sold seats
- ❌ Cannot select locked seats
- ✅ Price calculation
- ✅ Lock timer countdown

**Run:**
```bash
npx playwright test 01-seat-selection
```

### TC-02: Checkout Flow (8 tests)
- ✅ Create pending order
- ✅ Lock extended to 15 minutes
- ✅ Fill customer information
- ✅ Email/phone validation
- ✅ Confirm payment
- ✅ Copy bank account info

**Run:**
```bash
npx playwright test 02-checkout-flow
```

### TC-04: Ticket Download (9 tests)
- ✅ Download PDF
- ❌ Access without token
- ❌ Invalid token
- ✅ Display order info
- ✅ Multiple downloads
- ✅ QR code visibility
- ✅ Responsive layout

**Run:**
```bash
npx playwright test 03-ticket-download
```

### TC-06: Race Conditions (4 tests)
- ❌ Two users cannot select same seat
- ❌ Concurrent checkout with overlap
- ✅ Lock expiration allows next user
- ✅ Multiple tabs same session

**Run:**
```bash
npx playwright test 04-race-conditions
```

---

## 🔧 Configuration

Edit `playwright.config.ts` to customize:

- **Base URL**: Change `baseURL` for different environments
- **Browsers**: Enable/disable specific browsers
- **Screenshots**: Configure when to capture
- **Videos**: Configure video recording
- **Timeouts**: Adjust action/navigation timeouts

---

## 📊 View Test Reports

After running tests:

```bash
npm run test:e2e:report
```

Opens HTML report with:
- Test results and status
- Screenshots on failure
- Videos on failure
- Detailed traces

---

## 🎯 Best Practices

### 1. Use Test Utilities
```typescript
import { goToSeatSelection, selectSeats, checkoutSeats } from '../helpers/test-utils'

test('My test', async ({ page }) => {
  await goToSeatSelection(page)
  await selectSeats(page, 2)
  // ...
})
```

### 2. Use data-testid Attributes
```tsx
// In component
<button data-testid="checkout-button">Checkout</button>

// In test
const btn = page.locator('[data-testid="checkout-button"]')
```

### 3. Wait for API Responses
```typescript
await page.waitForResponse(
  res => res.url().includes('/api/seats/lock'),
  { timeout: 5000 }
)
```

### 4. Clean Up After Tests
```typescript
test.afterEach(async ({ page }) => {
  await cleanupSession(page)
})
```

---

## 🐛 Debugging Tests

### Debug UI Mode
```bash
npm run test:e2e:ui
```

### Debug Specific Test
```bash
npx playwright test 01-seat-selection --debug
```

### Headed Mode
```bash
npm run test:e2e:headed
```

### Show Trace Viewer
```bash
npx playwright show-trace playwright-report/trace.zip
```

---

## 🔄 CI/CD Integration

### GitHub Actions Example

```yaml
name: E2E Tests

on: [push, pull_request]

jobs:
  test:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with:
          node-version: 20
      
      - name: Install dependencies
        run: npm ci
        working-directory: web-client
      
      - name: Install Playwright
        run: npx playwright install --with-deps chromium
        working-directory: web-client
      
      - name: Run E2E tests
        run: npm run test:e2e
        working-directory: web-client
      
      - uses: actions/upload-artifact@v4
        if: always()
        with:
          name: playwright-report
          path: web-client/playwright-report/
          retention-days: 30
```

---

## 📝 Writing New Tests

1. Create new spec file in `tests/e2e/`
2. Import test utilities
3. Use descriptive test names
4. Add data-testid to components
5. Use assertions from test-utils
6. Document in test-cases.md

**Example:**
```typescript
import { test, expect } from '@playwright/test'
import { goToSeatSelection } from '../helpers/test-utils'

test.describe('My Feature', () => {
  test('TC-XX-YY: My test case', async ({ page }) => {
    // Arrange
    await goToSeatSelection(page)
    
    // Act
    await page.click('[data-testid="my-button"]')
    
    // Assert
    await expect(page.locator('[data-testid="result"]')).toBeVisible()
  })
})
```

---

## 🆘 Troubleshooting

### Tests timeout
- Increase timeout in `playwright.config.ts`
- Check if dev server is running
- Verify API backend is accessible

### Flaky tests
- Add explicit waits: `waitForSelector`, `waitForResponse`
- Use `waitForTimeout` sparingly
- Check for race conditions

### Element not found
- Verify selector is correct
- Add `data-testid` attributes
- Wait for element to be visible first

---

## 📚 Resources

- [Playwright Documentation](https://playwright.dev)
- [Test Cases Documentation](./test-cases.md)
- [Test Plan](../../../tests/playwright-test-plan.md)
- [Best Practices Guide](https://playwright.dev/docs/best-practices)
