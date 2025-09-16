// tests/e2e/table-selection.spec.js
const { test, expect } = require('@playwright/test');

test.describe('Table Selection Functionality', () => {
  test.beforeEach(async ({ page }) => {
    // Navigate to the booking page
    await page.goto('http://localhost:3000');
    await page.waitForLoadState('networkidle');
  });

  test('should display table areas without seat numbers', async ({ page }) => {
    // Wait for the seating plan to load
    await page.waitForSelector('#interactiveSeatingPlan', { state: 'visible' });
    
    // Wait for table areas to be generated (they're created by JavaScript)
    await page.waitForSelector('.table-area', { state: 'visible' });
    
    // Check that table areas are present
    const tableAreas = page.locator('.table-area');
    const count = await tableAreas.count();
    expect(count).toBeGreaterThan(0); // Should have some table areas
    
    // Check that table areas don't show seat numbers (they might show booking status)
    const firstTableArea = tableAreas.first();
    const text = await firstTableArea.textContent();
    // Should not contain seat numbers (1, 2, 3, etc.)
    expect(text).not.toMatch(/^\d+$/);
  });

  test('should allow table selection by clicking on table areas', async ({ page }) => {
    // Wait for the seating plan to load
    await page.waitForSelector('#interactiveSeatingPlan', { state: 'visible' });
    
    // Wait for table areas to be generated
    await page.waitForSelector('.table-area', { state: 'visible' });
    
    // Click on the first available table area (not booked)
    const availableTableArea = page.locator('.table-area:not(.booked)').first();
    await availableTableArea.click();
    
    // Check that the table area gets selected styling
    await expect(availableTableArea).toHaveClass(/selected/);
  });

  test('should show booking modal when table is clicked', async ({ page }) => {
    // Wait for the seating plan to load
    await page.waitForSelector('#interactiveSeatingPlan', { state: 'visible' });
    
    // Wait for table areas to be generated
    await page.waitForSelector('.table-area', { state: 'visible' });
    
    // Click on the first available table area
    const availableTableArea = page.locator('.table-area:not(.booked)').first();
    await availableTableArea.click();
    
    // Check that booking modal appears
    await page.waitForSelector('#bookingModal', { state: 'visible' });
    
    // Check that seat info is displayed
    await expect(page.locator('#seatInfo')).toBeVisible();
  });

  test('should display updated caption text', async ({ page }) => {
    // Check that the caption mentions blue circles
    const caption = page.locator('.seating-plan-caption');
    await expect(caption).toContainText('синие круги');
    await expect(caption).toContainText('Нажмите на стол для бронирования');
  });

  test('should be responsive on mobile viewport', async ({ page }) => {
    // Set mobile viewport
    await page.setViewportSize({ width: 375, height: 667 });
    
    // Wait for the seating plan to load
    await page.waitForSelector('#interactiveSeatingPlan', { state: 'visible' });
    
    // Wait for table areas to be generated
    await page.waitForSelector('.table-area', { state: 'visible' });
    
    // Check that table areas are still visible and clickable
    const tableAreas = page.locator('.table-area');
    const count = await tableAreas.count();
    expect(count).toBeGreaterThan(0);
    
    // Click on an available table area
    const availableTableArea = page.locator('.table-area:not(.booked)').first();
    await availableTableArea.click();
    
    // Check that it gets selected
    await expect(availableTableArea).toHaveClass(/selected/);
  });

  test('should maintain table functionality with hidden seat numbers', async ({ page }) => {
    // Wait for the seating plan to load
    await page.waitForSelector('#interactiveSeatingPlan', { state: 'visible' });
    
    // Wait for table areas to be generated
    await page.waitForSelector('.table-area', { state: 'visible' });
    
    // Click on multiple available table areas to test functionality
    const availableTableAreas = page.locator('.table-area:not(.booked)');
    const count = await availableTableAreas.count();
    
    if (count >= 2) {
      // Click first available table
      await availableTableAreas.nth(0).click();
      await expect(availableTableAreas.nth(0)).toHaveClass(/selected/);
      
      // Click second available table (should deselect first)
      await availableTableAreas.nth(1).click();
      await expect(availableTableAreas.nth(0)).not.toHaveClass(/selected/);
      await expect(availableTableAreas.nth(1)).toHaveClass(/selected/);
      
      // Verify booking modal appears
      await page.waitForSelector('#bookingModal', { state: 'visible' });
    } else {
      // If not enough available tables, just test clicking one
      await availableTableAreas.first().click();
      await expect(availableTableAreas.first()).toHaveClass(/selected/);
    }
  });
});
