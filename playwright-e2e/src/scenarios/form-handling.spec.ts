import { test, expect } from '@playwright/test';

const delay = (ms: number) => new Promise(r => setTimeout(r, ms));

/**
 * Form interaction tests using inline HTML forms.
 * Exercises fill, select, checkbox, and form submission workflows.
 * Delays: 500-2000ms per test (~6s total file weight).
 */
test.describe('Form Handling', () => {
  test('should fill text inputs', async ({ page }) => {
    await delay(800);
    await page.setContent(`
      <form>
        <input id="name" type="text" placeholder="Full name" />
        <input id="email" type="email" placeholder="Email address" />
        <textarea id="message" placeholder="Your message"></textarea>
      </form>
    `);

    await page.fill('#name', 'Jane Doe');
    await page.fill('#email', 'jane@example.com');
    await page.fill('#message', 'Hello from sorry-currents!');

    await expect(page.locator('#name')).toHaveValue('Jane Doe');
    await expect(page.locator('#email')).toHaveValue('jane@example.com');
    await expect(page.locator('#message')).toHaveValue('Hello from sorry-currents!');
  });

  test('should select dropdown option', async ({ page }) => {
    await delay(500);
    await page.setContent(`
      <select id="priority">
        <option value="">-- Select --</option>
        <option value="low">Low</option>
        <option value="medium">Medium</option>
        <option value="high">High</option>
        <option value="critical">Critical</option>
      </select>
    `);

    await page.selectOption('#priority', 'high');
    await expect(page.locator('#priority')).toHaveValue('high');

    await page.selectOption('#priority', { label: 'Critical' });
    await expect(page.locator('#priority')).toHaveValue('critical');
  });

  test('should check and uncheck checkbox', async ({ page }) => {
    await delay(1200);
    await page.setContent(`
      <label>
        <input id="agree" type="checkbox" /> I agree to the terms
      </label>
      <label>
        <input id="newsletter" type="checkbox" checked /> Subscribe to newsletter
      </label>
    `);

    await expect(page.locator('#agree')).not.toBeChecked();
    await expect(page.locator('#newsletter')).toBeChecked();

    await page.check('#agree');
    await expect(page.locator('#agree')).toBeChecked();

    await page.uncheck('#newsletter');
    await expect(page.locator('#newsletter')).not.toBeChecked();
  });

  test('should submit form and verify output', async ({ page }) => {
    await delay(2000);
    await page.setContent(`
      <form id="loginForm" onsubmit="event.preventDefault();
        document.getElementById('result').textContent =
          'Welcome, ' + document.getElementById('user').value">
        <input id="user" type="text" />
        <input id="pass" type="password" />
        <button type="submit">Login</button>
      </form>
      <div id="result"></div>
    `);

    await page.fill('#user', 'testuser');
    await page.fill('#pass', 'secret123');
    await page.click('button[type="submit"]');

    await expect(page.locator('#result')).toHaveText('Welcome, testuser');
  });

  test('should validate required fields', async ({ page }) => {
    await delay(1500);
    await page.setContent(`
      <form id="contactForm" onsubmit="event.preventDefault();
        var name = document.getElementById('fname').value;
        var el = document.getElementById('error');
        if (!name) { el.textContent = 'Name is required'; el.style.display = 'block'; }
        else { el.style.display = 'none'; document.getElementById('success').style.display = 'block'; }">
        <input id="fname" type="text" />
        <button type="submit">Submit</button>
        <div id="error" style="display:none; color:red;"></div>
        <div id="success" style="display:none; color:green;">Submitted!</div>
      </form>
    `);

    // Submit without filling — should show error
    await page.click('button[type="submit"]');
    await expect(page.locator('#error')).toBeVisible();
    await expect(page.locator('#error')).toHaveText('Name is required');

    // Fill and submit — should show success
    await page.fill('#fname', 'Alice');
    await page.click('button[type="submit"]');
    await expect(page.locator('#success')).toBeVisible();
    await expect(page.locator('#error')).toBeHidden();
  });
});
