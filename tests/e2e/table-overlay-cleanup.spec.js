// tests/e2e/table-overlay-cleanup.spec.js
const { test, expect } = require('@playwright/test');

test.describe('Table Overlay Cleanup', () => {
  test.beforeEach(async ({ page }) => {
    // Navigate to the booking page
    await page.goto('http://localhost:3000');
    await page.waitForLoadState('networkidle');
  });

  test('should not have selected or booked table overlays', async ({ page }) => {
    // Wait for the seating plan to load
    await page.waitForSelector('#interactiveSeatingPlan', { state: 'visible' });
    
    // Wait for table areas to be generated
    await page.waitForFunction(() => {
      const tableAreas = document.querySelectorAll('.table-area');
      return tableAreas.length > 0;
    }, { timeout: 10000 });
    
    // Check that no table areas have selected or booked classes
    const selectedTables = await page.locator('.table-area.selected').count();
    const bookedTables = await page.locator('.table-area.booked').count();
    
    expect(selectedTables).toBe(0);
    expect(bookedTables).toBe(0);
  });

  test('should have clickable table areas without overlays', async ({ page }) => {
    // Wait for the seating plan to load
    await page.waitForSelector('#interactiveSeatingPlan', { state: 'visible' });
    
    // Wait for table areas to be generated
    await page.waitForFunction(() => {
      const tableAreas = document.querySelectorAll('.table-area');
      return tableAreas.length > 0;
    }, { timeout: 10000 });
    
    // Get all table areas
    const tableAreas = page.locator('.table-area');
    const count = await tableAreas.count();
    
    expect(count).toBeGreaterThan(0);
    
    // Check that table areas don't have text content (no overlays)
    for (let i = 0; i < Math.min(count, 5); i++) {
      const textContent = await tableAreas.nth(i).textContent();
      expect(textContent).toBe('');
    }
  });

  test('should allow table clicking without visual overlays', async ({ page }) => {
    // Wait for the seating plan to load
    await page.waitForSelector('#interactiveSeatingPlan', { state: 'visible' });
    
    // Wait for table areas to be generated
    await page.waitForFunction(() => {
      const tableAreas = document.querySelectorAll('.table-area');
      return tableAreas.length > 0;
    }, { timeout: 10000 });
    
    // Click on a table area
    const tableArea = page.locator('.table-area').first();
    await tableArea.click();
    
    // Wait a moment
    await page.waitForTimeout(1000);
    
    // Check that no selected class was added
    const selectedTables = await page.locator('.table-area.selected').count();
    expect(selectedTables).toBe(0);
  });

  test('should have cleanup function available', async ({ page }) => {
    // Check that cleanup function is available globally
    const cleanupFunction = await page.evaluate(() => {
      return typeof window.cleanupTableOverlays === 'function';
    });
    
    expect(cleanupFunction).toBe(true);
  });
});
