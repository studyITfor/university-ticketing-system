// tests/e2e/simple-diagnostic-test.spec.js
const { test, expect } = require('@playwright/test');

test.describe('Simple Diagnostic Test', () => {
  test('basic page load test', async ({ page }) => {
    console.log('🚀 Starting simple diagnostic test...');
    
    try {
      console.log('🌐 Navigating to http://localhost:3000...');
      await page.goto('http://localhost:3000', { 
        waitUntil: 'domcontentloaded',
        timeout: 10000 
      });
      
      console.log('✅ Page loaded successfully');
      
      // Check if page title exists
      const title = await page.title();
      console.log('📄 Page title:', title);
      
      // Check for any console errors
      page.on('console', msg => {
        if (msg.type() === 'error') {
          console.log('❌ Console error:', msg.text());
        }
      });
      
      // Check for page errors
      page.on('pageerror', error => {
        console.log('❌ Page error:', error.message);
      });
      
      // Wait a bit to capture any errors
      await page.waitForTimeout(2000);
      
      console.log('✅ Simple test completed');
      expect(true).toBe(true);
      
    } catch (error) {
      console.log('❌ Test failed:', error.message);
      await page.screenshot({ path: 'debug-simple-test-error.png' });
      throw error;
    }
  });
});
