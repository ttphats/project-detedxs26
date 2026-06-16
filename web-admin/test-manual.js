const { chromium } = require('playwright');

(async () => {
  console.log('🚀 Starting browser automation...');
  
  const browser = await chromium.launch({ 
    headless: false,
    slowMo: 500 // Slow down so you can see
  });
  
  const page = await browser.newPage();
  
  try {
    // Test 1: Login
    console.log('\n✅ TC-01-01: Testing login...');
    await page.goto('http://localhost:3002/admin/login');
    await page.fill('input[type="text"]', 'admin');
    await page.fill('input[type="password"]', 'admin123456');
    await page.click('button:has-text("Sign in"), button:has-text("Đăng nhập")');
    await page.waitForURL('**/admin/dashboard', { timeout: 10000 });
    console.log('✅ Login successful!');
    
    await page.waitForTimeout(2000);
    
    // Test 2: Speaker Submissions
    console.log('\n✅ TC-02-01: Testing Speaker Submissions...');
    await page.click('text=Speaker Submissions');
    await page.waitForURL('**/admin/speaker-submissions');
    await page.waitForSelector('table', { timeout: 10000 });
    console.log('✅ Speaker Submissions page loaded!');
    
    await page.waitForTimeout(2000);
    
    // Test 3: Speaker Config
    console.log('\n✅ TC-03-01: Testing Speaker Config...');
    await page.click('text=Speaker Config');
    await page.waitForURL('**/admin/speaker-config');
    await page.waitForSelector('form, input, textarea', { timeout: 10000 });
    console.log('✅ Speaker Config page loaded!');
    
    await page.waitForTimeout(2000);
    
    // Test 4: Partners
    console.log('\n✅ TC-04-01: Testing Partners...');
    await page.click('text=Partners');
    await page.waitForURL('**/admin/partners');
    await page.waitForSelector('table', { timeout: 10000 });
    console.log('✅ Partners page loaded!');
    
    await page.waitForTimeout(3000);
    
    console.log('\n🎉 All tests completed successfully!');
    
  } catch (error) {
    console.error('\n❌ Test failed:', error.message);
    await page.screenshot({ path: 'test-error.png' });
  }
  
  // Keep browser open for 10 seconds
  console.log('\n⏳ Keeping browser open for 10 seconds...');
  await page.waitForTimeout(10000);
  
  await browser.close();
  console.log('\n✅ Browser closed.');
})();
