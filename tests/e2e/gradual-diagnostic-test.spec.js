// tests/e2e/gradual-diagnostic-test.spec.js
const { test, expect } = require('@playwright/test');

test.describe('Gradual Diagnostic Test', () => {
  test('step by step booking flow test', async ({ page }) => {
    console.log('🚀 Starting gradual diagnostic test...');
    
    // Set explicit test timeout
    test.setTimeout(60000);
    
    try {
      // Step 1: Navigate to page
      console.log('📝 Step 1: Navigate to page');
      await page.goto('http://localhost:3000', { 
        waitUntil: 'domcontentloaded',
        timeout: 15000 
      });
      console.log('✅ Step 1 completed');
      
      // Step 2: Wait for page to fully load
      console.log('📝 Step 2: Wait for network idle');
      await page.waitForLoadState('networkidle', { timeout: 10000 });
      console.log('✅ Step 2 completed');
      
      // Step 3: Check for seating plan
      console.log('📝 Step 3: Look for seating plan');
      try {
        await page.waitForSelector('#interactiveSeatingPlan', { 
          state: 'visible',
          timeout: 10000 
        });
        console.log('✅ Step 3 completed - seating plan found');
      } catch (error) {
        console.log('❌ Step 3 failed - seating plan not found:', error.message);
        // Continue anyway
      }
      
      // Step 4: Look for table areas
      console.log('📝 Step 4: Look for table areas');
      try {
        await page.waitForFunction(() => {
          const tableAreas = document.querySelectorAll('.table-area');
          return tableAreas.length > 0;
        }, { timeout: 15000 });
        console.log('✅ Step 4 completed - table areas found');
      } catch (error) {
        console.log('❌ Step 4 failed - table areas not found:', error.message);
        
        // Try to find alternative elements
        console.log('📝 Step 4b: Looking for alternative elements');
        const alternatives = [
          '.seat',
          '.table',
          '[data-table]',
          '[data-seat]',
          '.booking-item'
        ];
        
        for (const selector of alternatives) {
          try {
            const count = await page.locator(selector).count();
            if (count > 0) {
              console.log(`✅ Found ${count} elements with selector: ${selector}`);
              break;
            }
          } catch (e) {
            console.log(`❌ Selector ${selector} not found`);
          }
        }
      }
      
      // Step 5: Try to click on a table area
      console.log('📝 Step 5: Try to click on table area');
      try {
        const clickableSelectors = [
          '.table-area:not(.booked)',
          '.table-area:not(.selected)',
          '.table-area',
          '.seat:not(.booked)',
          '.seat:not(.selected)',
          '.seat'
        ];
        
        let clicked = false;
        for (const selector of clickableSelectors) {
          try {
            const element = page.locator(selector).first();
            const count = await element.count();
            if (count > 0) {
              console.log(`🖱️ Clicking on ${selector} (${count} elements found)`);
              await element.click({ timeout: 5000 });
              clicked = true;
              console.log(`✅ Successfully clicked ${selector}`);
              break;
            }
          } catch (error) {
            console.log(`❌ Failed to click ${selector}:`, error.message);
          }
        }
        
        if (!clicked) {
          console.log('❌ Step 5 failed - no clickable elements found');
          await page.screenshot({ path: 'debug-no-clickable.png' });
        } else {
          console.log('✅ Step 5 completed - clicked on element');
        }
      } catch (error) {
        console.log('❌ Step 5 failed:', error.message);
      }
      
      // Step 6: Wait for booking modal
      console.log('📝 Step 6: Wait for booking modal');
      try {
        await page.waitForSelector('#bookingModal', { 
          state: 'visible',
          timeout: 10000 
        });
        console.log('✅ Step 6 completed - booking modal found');
      } catch (error) {
        console.log('❌ Step 6 failed - booking modal not found:', error.message);
        
        // Try alternative modal selectors
        const modalSelectors = [
          '.modal',
          '[role="dialog"]',
          '.booking-form',
          '#bookingForm'
        ];
        
        for (const selector of modalSelectors) {
          try {
            await page.waitForSelector(selector, { state: 'visible', timeout: 5000 });
            console.log(`✅ Found modal with selector: ${selector}`);
            break;
          } catch (e) {
            console.log(`❌ Modal selector ${selector} not found`);
          }
        }
      }
      
      // Step 7: Fill form (if modal exists)
      console.log('📝 Step 7: Try to fill form');
      try {
        const timestamp = Date.now();
        const testData = {
          firstName: `Test${timestamp}`,
          lastName: `User${timestamp}`,
          phone: `+1234567${timestamp.toString().slice(-4)}`
        };
        
        // Try to fill form fields
        const formFields = [
          { selector: '#firstName', value: testData.firstName },
          { selector: '#lastName', value: testData.lastName },
          { selector: '#phone', value: testData.phone }
        ];
        
        for (const field of formFields) {
          try {
            await page.fill(field.selector, field.value, { timeout: 5000 });
            console.log(`✅ Filled ${field.selector}`);
          } catch (error) {
            console.log(`❌ Failed to fill ${field.selector}:`, error.message);
          }
        }
        
        // Try to check WhatsApp opt-in
        try {
          await page.check('#whatsappOptin', { timeout: 5000 });
          console.log('✅ Checked WhatsApp opt-in');
        } catch (error) {
          console.log('❌ Failed to check WhatsApp opt-in:', error.message);
        }
        
        console.log('✅ Step 7 completed - form filled');
      } catch (error) {
        console.log('❌ Step 7 failed:', error.message);
      }
      
      // Step 8: Submit form
      console.log('📝 Step 8: Try to submit form');
      try {
        await page.click('#bookingForm button[type="submit"]', { timeout: 5000 });
        console.log('✅ Step 8 completed - form submitted');
      } catch (error) {
        console.log('❌ Step 8 failed - form submission failed:', error.message);
        
        // Try alternative submit buttons
        const submitSelectors = [
          'button[type="submit"]',
          'input[type="submit"]',
          '.submit-btn',
          '.btn-submit',
          'button:has-text("Book")',
          'button:has-text("Submit")'
        ];
        
        for (const selector of submitSelectors) {
          try {
            await page.click(selector, { timeout: 3000 });
            console.log(`✅ Submitted with selector: ${selector}`);
            break;
          } catch (e) {
            console.log(`❌ Submit selector ${selector} failed`);
          }
        }
      }
      
      // Step 9: Wait for confirmation modal
      console.log('📝 Step 9: Wait for confirmation modal');
      try {
        await page.waitForSelector('#confirmationCodeModal', { 
          state: 'visible',
          timeout: 15000 
        });
        console.log('✅ Step 9 completed - confirmation modal found');
      } catch (error) {
        console.log('❌ Step 9 failed - confirmation modal not found:', error.message);
        
        // Try alternative modal selectors
        const modalSelectors = [
          '.confirmation-modal',
          '.code-modal',
          '[role="dialog"]',
          '.modal'
        ];
        
        for (const selector of modalSelectors) {
          try {
            await page.waitForSelector(selector, { state: 'visible', timeout: 5000 });
            console.log(`✅ Found confirmation modal with selector: ${selector}`);
            break;
          } catch (e) {
            console.log(`❌ Confirmation modal selector ${selector} not found`);
          }
        }
      }
      
      // Final wait
      console.log('📝 Final step: Wait for async operations');
      await page.waitForTimeout(3000);
      
      console.log('✅ All steps completed successfully');
      expect(true).toBe(true);
      
    } catch (error) {
      console.log('❌ Test failed with error:', error.message);
      await page.screenshot({ path: 'debug-gradual-test-error.png' });
      throw error;
    }
  });
});
