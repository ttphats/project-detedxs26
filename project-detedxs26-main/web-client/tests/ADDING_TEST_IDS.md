# Adding data-testid Attributes - Step by Step Guide

## 🎯 Why data-testid?

- **Stable selectors** - Won't break when styling changes
- **Explicit testing** - Clear which elements are testable
- **Best practice** - Recommended by Playwright, Testing Library, Cypress

---

## 📝 Quick Examples

### Before (Bad)
```tsx
<button className="bg-red-500 px-4 py-2">
  Checkout
</button>
```

Test code:
```typescript
await page.click('.bg-red-500') // Breaks when styling changes!
```

### After (Good)
```tsx
<button 
  data-testid="checkout-button"
  className="bg-red-500 px-4 py-2"
>
  Checkout
</button>
```

Test code:
```typescript
await page.click('[data-testid="checkout-button"]') // Stable!
```

---

## 🔧 File-by-File Guide

### 1. Seat Selection Page
**File:** `web-client/src/app/events/[id]/seats/page.tsx`

**Find this:**
```tsx
<div className="seat-map-container">
  {/* Seat grid */}
</div>
```

**Add this:**
```tsx
<div data-testid="seat-map" className="seat-map-container">
  {/* Seat grid */}
</div>
```

**More to add:**
```tsx
{/* Selected count */}
<div data-testid="selected-count">
  {selectedSeats.length} ghế đã chọn
</div>

{/* Total price */}
<div data-testid="total-price">
  {formatPrice(totalPrice)}
</div>

{/* Lock timer */}
<div data-testid="lock-timer">
  {formatCountdown(countdown)}
</div>

{/* Checkout button */}
<button 
  data-testid="checkout-button"
  disabled={selectedSeats.length === 0}
  onClick={handleCheckout}
>
  Thanh toán
</button>
```

---

### 2. Seat Component
**File:** `web-client/src/components/ui/Seat.tsx`

**Find this:**
```tsx
<button
  onClick={handleClick}
  className={seatStyles}
>
  {/* Seat content */}
</button>
```

**Change to:**
```tsx
<button
  data-testid={`seat-${id}`}
  data-seat-id={id}
  data-status={status}
  data-price={price}
  data-seat-type={seatType}
  onClick={handleClick}
  className={seatStyles}
>
  {/* Seat content */}
</button>
```

**Why multiple data attributes?**
- `data-testid` - For targeting specific seat
- `data-seat-id` - For finding seat by ID
- `data-status` - For assertions about state
- `data-price` - For price validation
- `data-seat-type` - For filtering by type

---

### 3. Checkout Page
**File:** `web-client/src/app/checkout/page.tsx`

```tsx
{/* Page wrapper */}
<div data-testid="checkout-page">
  
  {/* Order number display */}
  <div data-testid="order-number">
    {orderNumber}
  </div>
  
  {/* Selected seats list */}
  <div data-testid="selected-seats">
    {selectedSeats.map(seat => (
      <div key={seat.id}>{seat.seatNumber}</div>
    ))}
  </div>
  
  {/* Customer info form */}
  <form>
    <input 
      name="name"
      type="text"
      placeholder="Họ và tên"
    />
    <input 
      name="email"
      type="email"
      placeholder="Email"
    />
    <input 
      name="phone"
      type="tel"
      placeholder="Số điện thoại"
    />
  </form>
  
  {/* Bank account number with copy */}
  <button 
    data-testid="copy-account-number"
    onClick={() => copyToClipboard(accountNumber)}
  >
    Copy STK
  </button>
  
  {/* Lock timer */}
  <div data-testid="lock-timer">
    {formatTimer(timeRemaining)}
  </div>
  
  {/* Confirm payment button */}
  <button 
    data-testid="confirm-payment-button"
    onClick={handleConfirmPayment}
  >
    Tôi đã chuyển khoản
  </button>
</div>
```

---

### 4. Ticket Page
**File:** `web-client/src/app/ticket/[orderNumber]/page.tsx`

```tsx
<div data-testid="ticket-page">
  
  {/* Order number */}
  <div data-testid="order-number-display">
    {orderNumber}
  </div>
  
  {/* Order status badge */}
  <div data-testid="order-status">
    {status === 'PENDING' ? 'Chờ xác nhận' : 'Đã thanh toán'}
  </div>
  
  {/* Event info */}
  <div data-testid="event-info">
    <h2>{eventName}</h2>
    <p>{eventDate}</p>
  </div>
  
  {/* Seat info */}
  <div data-testid="seat-info">
    {seats.map(seat => (
      <div key={seat.id}>{seat.seatNumber}</div>
    ))}
  </div>
  
  {/* QR codes */}
  {tickets.map(ticket => (
    <div key={ticket.id} data-testid="qr-code">
      <QRCode value={ticket.qrData} />
    </div>
  ))}
  
  {/* Download button */}
  <button 
    data-testid="download-pdf-button"
    onClick={handleDownloadPDF}
    disabled={downloading}
  >
    {downloading ? 'Đang tải...' : 'Tải vé PDF'}
  </button>
  
  {/* Share button (optional) */}
  <button 
    data-testid="share-button"
    onClick={handleShare}
  >
    Chia sẻ
  </button>
</div>
```

---

## 🎨 Naming Conventions

### Use kebab-case
```tsx
data-testid="checkout-button"  // ✅ Good
data-testid="checkoutButton"   // ❌ Bad
data-testid="CheckoutButton"   // ❌ Bad
```

### Be descriptive
```tsx
data-testid="confirm-payment-button"  // ✅ Good
data-testid="button"                  // ❌ Bad
data-testid="btn"                     // ❌ Bad
```

### Use suffixes for type
```tsx
data-testid="search-input"    // Input field
data-testid="submit-button"   // Button
data-testid="error-message"   // Text
data-testid="user-dropdown"   // Select
```

### Use dynamic IDs for lists
```tsx
{items.map(item => (
  <div key={item.id} data-testid={`item-${item.id}`}>
    {item.name}
  </div>
))}
```

---

## ✅ Verification Checklist

After adding data-testid attributes:

### 1. Check in Browser DevTools
```
1. Open page in browser
2. Right-click element → Inspect
3. Verify data-testid exists in HTML
```

### 2. Test with Playwright
```bash
npm run test:e2e:ui
```

### 3. Common Issues

**Not showing in tests?**
- Check spelling of data-testid
- Verify element is actually rendered
- Try `await page.pause()` to inspect

**Still failing?**
- Element might be in an iframe
- Might need to wait for it: `await page.waitForSelector('[data-testid="..."]')`
- Check if it's hidden by CSS

---

## 🚀 Quick Add Script

Run this to add all test IDs at once:

```bash
# Add to seat selection page
sed -i 's/<div className="seat-map/<div data-testid="seat-map" className="seat-map/' \
  src/app/events/[id]/seats/page.tsx

# Add to seat component  
sed -i 's/<button onClick={handleClick}/<button data-testid="seat-{id}" data-seat-id={id} data-status={status} onClick={handleClick}/' \
  src/components/ui/Seat.tsx
```

⚠️ **Note:** Manual addition recommended for accuracy!

---

## 📊 Progress Tracker

Track which files you've updated:

- [ ] `src/app/events/[id]/seats/page.tsx` (5 test IDs)
- [ ] `src/components/ui/Seat.tsx` (5 data attributes)
- [ ] `src/app/checkout/page.tsx` (7 test IDs)
- [ ] `src/app/ticket/[orderNumber]/page.tsx` (8 test IDs)

**Total:** 25 test IDs to add

---

## 🎯 Priority Order

1. **High Priority** (Tests will fail without these)
   - Seat component: `data-seat-id`, `data-status`
   - Checkout button: `data-testid="checkout-button"`
   - Selected count: `data-testid="selected-count"`

2. **Medium Priority** (Most tests need these)
   - Seat map: `data-testid="seat-map"`
   - Order number displays
   - Download button

3. **Low Priority** (Nice to have)
   - Share buttons
   - Copy buttons
   - Extra metadata attributes

---

## 💡 Pro Tips

1. **Add while building** - Add test IDs as you create components
2. **Consistent naming** - Use same pattern across app
3. **Document custom attributes** - Note what each data-* means
4. **Don't overdo it** - Only add where tests need them
5. **Keep in sync** - Update tests if you change test IDs

---

**Next Step:** Choose one file and start adding test IDs! 🚀
