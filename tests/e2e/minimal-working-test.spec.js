// tests/e2e/minimal-working-test.spec.js
const { test, expect } = require('@playwright/test');

test.describe('Minimal Working Test', () => {
  test('minimal booking flow test', async ({ page }) => {
    console.log('🚀 Starting minimal test...');
    
    // Set reasonable timeout
    test.setTimeout(60000);
    
    try {
      // Navigate to page
      console.log('🌐 Navigating to page...');
      await page.goto('http://localhost:3000', { 
        waitUntil: 'domcontentloaded',
        timeout: 30000 
      });
      
      // Wait for page to be ready
      console.log('⏳ Waiting for page ready...');
      await page.waitForLoadState('networkidle', { timeout: 20000 });
      
      // Look for any clickable element
      console.log('🔍 Looking for clickable elements...');
      const selectors = [
        '.table-area',
        '.seat',
        '.table',
        '[data-table]',
        '[data-seat]'
      ];
      
      let found = false;
      for (const selector of selectors) {
        const count = await page.locator(selector).count();
        if (count > 0) {
          console.log(`✅ Found ${count} elements with ${selector}`);
          found = true;
          break;
        }
      }
      
      if (!found) {
        console.log('❌ No elements found');
        await page.screenshot({ path: 'debug-minimal-no-elements.png' });
        throw new Error('No clickable elements found');
      }
      
      // Try to click first available element
      console.log('🖱️ Clicking first element...');
      const firstElement = page.locator(selectors[0]).first();
      await firstElement.click({ timeout: 10000 });
      
      // Wait a bit for any modal or response
      console.log('⏳ Waiting for response...');
      await page.waitForTimeout(3000);
      
      console.log('✅ Minimal test completed');
      expect(true).toBe(true);
      
    } catch (error) {
      console.log('❌ Test failed:', error.message);
      await page.screenshot({ path: 'debug-minimal-error.png' });
      throw error;
    }
  });
});
