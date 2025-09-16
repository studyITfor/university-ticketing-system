// tests/e2e/simple-table-test.spec.js
const { test, expect } = require('@playwright/test');

test.describe('Simple Table Test', () => {
  test('should load the page and show updated caption', async ({ page }) => {
    // Navigate to the booking page
    await page.goto('http://localhost:3000');
    await page.waitForLoadState('networkidle');
    
    // Check that the page loads
    await expect(page.locator('h1')).toContainText('GOLDENMIDDLE');
    
    // Check that the updated caption text is displayed
    const caption = page.locator('.seating-plan-caption');
    await expect(caption).toContainText('синие круги');
    await expect(caption).toContainText('Нажмите на стол для бронирования');
  });

  test('should have responsive image styling', async ({ page }) => {
    await page.goto('http://localhost:3000');
    await page.waitForLoadState('networkidle');
    
    // Check that the seating plan image is present
    const image = page.locator('#seatingPlanImage');
    await expect(image).toBeVisible();
    
    // Check that the image has responsive styling
    const imageStyles = await image.evaluate((el) => {
      const styles = window.getComputedStyle(el);
      return {
        maxWidth: styles.maxWidth,
        height: styles.height
      };
    });
    
    expect(imageStyles.maxWidth).toBe('100%');
    // Height should be auto or a specific pixel value (both are responsive)
    expect(imageStyles.height).toMatch(/^(auto|\d+px)$/);
  });

  test('should work on mobile viewport', async ({ page }) => {
    // Set mobile viewport
    await page.setViewportSize({ width: 375, height: 667 });
    
    await page.goto('http://localhost:3000');
    await page.waitForLoadState('networkidle');
    
    // Check that the page loads on mobile
    await expect(page.locator('h1')).toContainText('GOLDENMIDDLE');
    
    // Check that the image is still responsive
    const image = page.locator('#seatingPlanImage');
    await expect(image).toBeVisible();
  });
});
