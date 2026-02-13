import { test, expect } from '@playwright/test';

const delay = (ms: number) => new Promise(r => setTimeout(r, ms));

/**
 * Error handling and fallback UI tests.
 * Delays: 300-700ms per test (~3s total file weight).
 * Lightweight file — should be grouped with others under LPT.
 */
test.describe('Error Handling', () => {
  test('should show error banner on failure', async ({ page }) => {
    await delay(400);
    await page.setContent(`
      <button id="trigger" onclick="
        document.getElementById('error').style.display = 'block';
        document.getElementById('error').textContent = 'Something went wrong';
      ">Trigger Error</button>
      <div id="error" style="display:none; color:red; padding:10px; background:#ffebee;"></div>
    `);

    await page.click('#trigger');
    await expect(page.locator('#error')).toBeVisible();
    await expect(page.locator('#error')).toHaveText('Something went wrong');
  });

  test('should dismiss error banner', async ({ page }) => {
    await delay(500);
    await page.setContent(`
      <div id="error" style="padding:10px; background:#ffebee;">
        Error occurred
        <button id="dismiss" onclick="this.parentElement.style.display='none'">✕</button>
      </div>
    `);

    await expect(page.locator('#error')).toBeVisible();
    await page.click('#dismiss');
    await expect(page.locator('#error')).toBeHidden();
  });

  test('should show fallback content', async ({ page }) => {
    await delay(700);
    await page.setContent(`
      <div id="content">
        <div id="main" style="display:none;">Main content</div>
        <div id="fallback">Loading failed. <button onclick="
          document.getElementById('fallback').style.display='none';
          document.getElementById('main').style.display='block';
        ">Retry</button></div>
      </div>
    `);

    await expect(page.locator('#fallback')).toBeVisible();
    await expect(page.locator('#main')).toBeHidden();
    await page.click('#fallback button');
    await expect(page.locator('#main')).toBeVisible();
    await expect(page.locator('#fallback')).toBeHidden();
  });

  test('should show inline validation errors', async ({ page }) => {
    await delay(300);
    await page.setContent(`
      <form onsubmit="event.preventDefault();
        var errors = [];
        if (!document.getElementById('email').value.includes('@')) errors.push('Invalid email');
        if (document.getElementById('age').value < 18) errors.push('Must be 18+');
        document.getElementById('errors').innerHTML = errors.map(e => '<li>'+e+'</li>').join('');
      ">
        <input id="email" value="invalid" />
        <input id="age" type="number" value="15" />
        <button type="submit">Submit</button>
        <ul id="errors"></ul>
      </form>
    `);

    await page.click('button[type="submit"]');
    const errors = page.locator('#errors li');
    await expect(errors).toHaveCount(2);
    await expect(errors.nth(0)).toHaveText('Invalid email');
    await expect(errors.nth(1)).toHaveText('Must be 18+');
  });

  test('should show empty state', async ({ page }) => {
    await delay(600);
    await page.setContent(`
      <div id="list-container">
        <ul id="items"></ul>
        <div id="empty-state">No items found</div>
      </div>
      <script>
        const items = document.getElementById('items');
        const empty = document.getElementById('empty-state');
        empty.style.display = items.children.length === 0 ? 'block' : 'none';
      </script>
    `);

    await expect(page.locator('#empty-state')).toBeVisible();
    await expect(page.locator('#items li')).toHaveCount(0);
  });

  test('should show network error simulation', async ({ page }) => {
    await delay(500);
    await page.setContent(`
      <button id="fetch" onclick="
        document.getElementById('status').textContent = 'Loading...';
        setTimeout(() => {
          document.getElementById('status').textContent = 'Network Error: Connection refused';
          document.getElementById('status').classList.add('error');
        }, 200);
      ">Fetch Data</button>
      <div id="status"></div>
    `);

    await page.click('#fetch');
    await expect(page.locator('#status')).toHaveText('Network Error: Connection refused', { timeout: 2000 });
  });
});
