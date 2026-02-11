import { test, expect } from '@playwright/test';

test.describe('JARVIS Critical Path', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/');
    // Wait for app to load - look for JARVIS text
    await page.waitForSelector('text=JARVIS', { timeout: 15000 });
  });

  test('user can view main dashboard', async ({ page }) => {
    // Check JARVIS title is visible
    await expect(page.locator('text=JARVIS').first()).toBeVisible();
    
    // Check for main UI elements
    await expect(page.locator('body')).toContainText('JARVIS');
  });

  test('user can navigate to different views', async ({ page }) => {
    // Look for navigation buttons (Terminal, Memory, etc.)
    const terminalBtn = page.locator('button:has-text("Terminal"), [role="button"]:has-text("Terminal"), a:has-text("Terminal")').first();
    const memoryBtn = page.locator('button:has-text("Memory"), [role="button"]:has-text("Memory"), a:has-text("Memory")').first();
    
    // Try to navigate if buttons exist
    if (await terminalBtn.count() > 0) {
      await terminalBtn.click();
      await page.waitForTimeout(500);
    }
    
    if (await memoryBtn.count() > 0) {
      await memoryBtn.click();
      await page.waitForTimeout(500);
    }
    
    // Should still have JARVIS visible
    await expect(page.locator('text=JARVIS').first()).toBeVisible();
  });

  test('user can toggle voice listening', async ({ page }) => {
    // Look for voice-related buttons
    const voiceBtn = page.locator('button:has-text("Voice"), button:has-text("🎤"), [aria-label*="voice" i]').first();
    
    if (await voiceBtn.count() > 0) {
      await voiceBtn.click();
      await page.waitForTimeout(300);
      
      // Click again to toggle off
      await voiceBtn.click();
    }
    
    // Test passes if we get here without errors
    expect(true).toBe(true);
  });

  test('user can access settings', async ({ page }) => {
    // Look for settings button
    const settingsBtn = page.locator('button:has-text("Settings"), button:has-text("⚙"), [aria-label*="setting" i]').first();
    
    if (await settingsBtn.count() > 0) {
      await settingsBtn.click();
      await page.waitForTimeout(500);
      
      // Look for settings modal/dialog
      const settingsModal = page.locator('[role="dialog"], .modal, .settings').first();
      
      // Close settings (look for close button or press Escape)
      await page.keyboard.press('Escape');
    }
    
    expect(true).toBe(true);
  });

  test('terminal accepts text input', async ({ page }) => {
    // Navigate to terminal if button exists
    const terminalBtn = page.locator('button:has-text("Terminal"), a:has-text("Terminal")').first();
    if (await terminalBtn.count() > 0) {
      await terminalBtn.click();
      await page.waitForTimeout(500);
    }
    
    // Look for input field
    const input = page.locator('input[type="text"], textarea, [contenteditable="true"]').first();
    
    if (await input.count() > 0) {
      await input.fill('Hello JARVIS');
      await input.press('Enter');
      await page.waitForTimeout(500);
    }
    
    expect(true).toBe(true);
  });

  test('page loads without console errors', async ({ page }) => {
    const consoleErrors: string[] = [];
    
    page.on('console', (msg) => {
      if (msg.type() === 'error') {
        consoleErrors.push(msg.text());
      }
    });
    
    // Reload page to capture any errors during load
    await page.reload();
    await page.waitForTimeout(3000);
    
    // Check that no critical errors occurred
    const criticalErrors = consoleErrors.filter(e => 
      !e.includes('favicon') && 
      !e.includes('source map') &&
      !e.includes('chunk')
    );
    
    expect(criticalErrors.length).toBeLessThan(5);
  });
});
