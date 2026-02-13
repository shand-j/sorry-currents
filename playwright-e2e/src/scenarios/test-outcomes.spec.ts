import { test, expect } from '@playwright/test';

const delay = (ms: number) => new Promise(r => setTimeout(r, ms));

/**
 * Tests that deliberately produce mixed outcomes: pass, skip, fixme, slow.
 * These exercise the sorry-currents reporter's handling of all test states.
 * Delays: 0-3000ms per test (~8s total file weight).
 */
test.describe('Test Outcomes', () => {
  test('should always pass', async ({ page }) => {
    await delay(600);
    await page.setContent('<div id="stable">This test always passes</div>');
    await expect(page.locator('#stable')).toHaveText('This test always passes');
  });

  test('should pass with multiple assertions', async ({ page }) => {
    await delay(1200);
    await page.setContent(`
      <div class="stats">
        <span id="total">10</span>
        <span id="passed">8</span>
        <span id="failed">2</span>
      </div>
    `);

    await expect(page.locator('#total')).toHaveText('10');
    await expect(page.locator('#passed')).toHaveText('8');
    await expect(page.locator('#failed')).toHaveText('2');

    const total = Number(await page.locator('#total').textContent());
    const passed = Number(await page.locator('#passed').textContent());
    const failed = Number(await page.locator('#failed').textContent());
    expect(passed + failed).toBe(total);
  });

  test.skip('should be skipped - feature not implemented yet', async ({ page }) => {
    // This test is intentionally skipped to verify the reporter
    // correctly records skipped test outcomes
    await page.setContent('<div>This should never execute</div>');
    expect(true).toBe(false);
  });

  test.skip('should be skipped - pending review', async ({ page }) => {
    await page.setContent('<div>Also skipped</div>');
    expect(1).toBe(2);
  });

  test.fixme('should fix flaky selector logic', async ({ page }) => {
    // Marked as fixme — known issue to be addressed later.
    // Reporter should record this as a fixme/skipped test.
    await page.setContent('<div>Fixme test</div>');
  });

  test('should run with a deliberate delay', async ({ page }) => {
    await page.setContent('<div id="slow">Starting...</div>');

    await page.evaluate(() => new Promise(resolve => setTimeout(resolve, 1500)));

    await page.setContent('<div id="slow">Done after delay</div>');
    await expect(page.locator('#slow')).toHaveText('Done after delay');
    await delay(3000);
  });

  test('should handle page with no content gracefully', async ({ page }) => {
    await delay(900);
    await page.setContent('');
    const body = page.locator('body');
    await expect(body).toBeVisible();
  });

  test('should work with special characters in content', async ({ page }) => {
    await delay(2000);
    await page.setContent(`
      <div id="special">Héllo Wörld! こんにちは 🎉 <>&"' test</div>
    `);

    const text = await page.locator('#special').textContent();
    expect(text).toContain('Héllo');
    expect(text).toContain('こんにちは');
    expect(text).toContain('<>&');
  });
});
