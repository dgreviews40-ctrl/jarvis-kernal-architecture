import { test, expect } from '@playwright/test';

test.describe('Visual Regression', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/');
    await page.waitForTimeout(3000);
  });

  test('dashboard renders correctly', async ({ page }) => {
    // Take screenshot of main dashboard
    await expect(page).toHaveScreenshot('dashboard.png', {
      maxDiffPixels: 1000,
      threshold: 0.2,
    });
  });

  test('terminal view renders correctly', async ({ page }) => {
    // Navigate to terminal
    const terminalBtn = page.locator('button:has-text("Terminal"), a:has-text("Terminal"), [aria-label*="terminal" i]').first();
    if (await terminalBtn.count() > 0) {
      await terminalBtn.click();
      await page.waitForTimeout(1000);
      
      await expect(page).toHaveScreenshot('terminal.png', {
        maxDiffPixels: 1000,
        threshold: 0.2,
      });
    }
  });

  test('memory view renders correctly', async ({ page }) => {
    // Navigate to memory
    const memoryBtn = page.locator('button:has-text("Memory"), a:has-text("Memory"), [aria-label*="memory" i]').first();
    if (await memoryBtn.count() > 0) {
      await memoryBtn.click();
      await page.waitForTimeout(1000);
      
      await expect(page).toHaveScreenshot('memory.png', {
        maxDiffPixels: 1000,
        threshold: 0.2,
      });
    }
  });

  test('settings modal renders correctly', async ({ page }) => {
    // Open settings
    const settingsBtn = page.locator('button:has-text("Settings"), button:has-text("⚙"), [aria-label*="setting" i]').first();
    if (await settingsBtn.count() > 0) {
      await settingsBtn.click();
      await page.waitForTimeout(1000);
      
      await expect(page).toHaveScreenshot('settings.png', {
        maxDiffPixels: 1000,
        threshold: 0.2,
      });
      
      // Close settings
      await page.keyboard.press('Escape');
    }
  });

  test('responsive layout on mobile', async ({ page }) => {
    // Set mobile viewport
    await page.setViewportSize({ width: 375, height: 667 });
    await page.waitForTimeout(1000);
    
    await expect(page).toHaveScreenshot('mobile-dashboard.png', {
      maxDiffPixels: 1000,
      threshold: 0.2,
    });
  });

  test('responsive layout on tablet', async ({ page }) => {
    // Set tablet viewport
    await page.setViewportSize({ width: 768, height: 1024 });
    await page.waitForTimeout(1000);
    
    await expect(page).toHaveScreenshot('tablet-dashboard.png', {
      maxDiffPixels: 1000,
      threshold: 0.2,
    });
  });
});
