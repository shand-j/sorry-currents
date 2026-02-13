import { test, expect } from '@playwright/test';

/**
 * Basic DOM interaction tests using page.setContent().
 * Fully self-contained — no network requests.
 */
test.describe('DOM Interaction', () => {
  test('should find element by text', async ({ page }) => {
    await page.setContent('<h1>Welcome to Sorry Currents</h1><p>Test orchestration made simple.</p>');

    await expect(page.getByText('Welcome to Sorry Currents')).toBeVisible();
    await expect(page.locator('p')).toHaveText('Test orchestration made simple.');
  });

  test('should click a button and verify state change', async ({ page }) => {
    await page.setContent(`
      <button id="toggle" onclick="document.getElementById('status').textContent = 'Active'">
        Activate
      </button>
      <span id="status">Inactive</span>
    `);

    await expect(page.locator('#status')).toHaveText('Inactive');
    await page.click('#toggle');
    await expect(page.locator('#status')).toHaveText('Active');
  });

  test('should toggle visibility', async ({ page }) => {
    await page.setContent(`
      <button onclick="document.getElementById('panel').style.display =
        document.getElementById('panel').style.display === 'none' ? 'block' : 'none'">
        Toggle
      </button>
      <div id="panel">Hidden content</div>
    `);

    await expect(page.locator('#panel')).toBeVisible();
    await page.click('button');
    await expect(page.locator('#panel')).toBeHidden();
    await page.click('button');
    await expect(page.locator('#panel')).toBeVisible();
  });

  test('should count list items', async ({ page }) => {
    await page.setContent(`
      <ul id="fruits">
        <li>Apple</li>
        <li>Banana</li>
        <li>Cherry</li>
        <li>Date</li>
        <li>Elderberry</li>
      </ul>
    `);

    const items = page.locator('#fruits li');
    await expect(items).toHaveCount(5);
    await expect(items.first()).toHaveText('Apple');
    await expect(items.last()).toHaveText('Elderberry');
  });

  test('should read and verify attributes', async ({ page }) => {
    await page.setContent(`
      <a id="link" href="https://example.com" target="_blank" data-testid="main-link">
        Example Link
      </a>
      <img id="logo" src="logo.png" alt="Company Logo" width="200" />
    `);

    await expect(page.locator('#link')).toHaveAttribute('href', 'https://example.com');
    await expect(page.locator('#link')).toHaveAttribute('target', '_blank');
    await expect(page.locator('#logo')).toHaveAttribute('alt', 'Company Logo');
    await expect(page.locator('#logo')).toHaveAttribute('width', '200');
  });

  test('should handle nested elements', async ({ page }) => {
    await page.setContent(`
      <div class="card">
        <div class="card-header">
          <h2>Test Report</h2>
          <span class="badge">4 passed</span>
        </div>
        <div class="card-body">
          <ul>
            <li class="passed">Test A</li>
            <li class="passed">Test B</li>
            <li class="failed">Test C</li>
            <li class="passed">Test D</li>
          </ul>
        </div>
      </div>
    `);

    await expect(page.locator('.card-header h2')).toHaveText('Test Report');
    await expect(page.locator('.card-body .passed')).toHaveCount(3);
    await expect(page.locator('.card-body .failed')).toHaveCount(1);
  });
});
