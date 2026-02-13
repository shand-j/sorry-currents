import { test, expect } from '@playwright/test';

const delay = (ms: number) => new Promise(r => setTimeout(r, ms));

/**
 * Accessibility tests — ARIA roles, keyboard navigation, focus management, labels.
 * Delays: 400-900ms per test (~4s total file weight).
 */
test.describe('Accessibility', () => {
  const a11yHtml = `
    <style>
      * { box-sizing: border-box; }
      body { font-family: sans-serif; padding: 20px; }
      .skip-link { position: absolute; top: -40px; left: 0; background: #000; color: white; padding: 8px; z-index: 100; }
      .skip-link:focus { top: 0; }
      nav[role="navigation"] { background: #333; padding: 10px; }
      nav a { color: white; margin: 0 10px; text-decoration: none; }
      nav a:focus { outline: 2px solid #ff9800; outline-offset: 2px; }
      main[role="main"] { padding: 20px; }
      .form-group { margin-bottom: 15px; }
      label { display: block; margin-bottom: 4px; font-weight: bold; }
      input, select { padding: 8px; border: 1px solid #ccc; border-radius: 4px; width: 100%; }
      input:focus, select:focus { outline: 2px solid #2196f3; border-color: #2196f3; }
      .error-msg { color: #f44336; font-size: 14px; margin-top: 4px; }
      [aria-live="polite"] { position: absolute; left: -9999px; }
      .accordion { border: 1px solid #ddd; border-radius: 4px; margin-bottom: 10px; }
      .accordion-header { padding: 12px; cursor: pointer; background: #f5f5f5; display: flex; justify-content: space-between; }
      .accordion-header:focus { outline: 2px solid #2196f3; }
      .accordion-panel { padding: 12px; display: none; }
      .accordion-panel.open { display: block; }
    </style>
    <a href="#main" class="skip-link">Skip to main content</a>
    <nav role="navigation" aria-label="Main navigation">
      <a href="#" id="nav-home">Home</a>
      <a href="#" id="nav-about">About</a>
      <a href="#" id="nav-contact">Contact</a>
    </nav>
    <main id="main" role="main">
      <h1 id="page-title">Accessible Form</h1>
      <form aria-labelledby="page-title">
        <div class="form-group">
          <label for="fullname">Full Name</label>
          <input id="fullname" type="text" aria-required="true" aria-describedby="name-hint" />
          <span id="name-hint" class="error-msg" style="display:none;">Name is required</span>
        </div>
        <div class="form-group">
          <label for="email-input">Email</label>
          <input id="email-input" type="email" aria-required="true" aria-describedby="email-hint" />
          <span id="email-hint" class="error-msg" style="display:none;">Valid email required</span>
        </div>
        <div class="form-group">
          <label for="role-select">Role</label>
          <select id="role-select" aria-required="true">
            <option value="">Select a role</option>
            <option value="dev">Developer</option>
            <option value="design">Designer</option>
            <option value="pm">Product Manager</option>
          </select>
        </div>
        <button type="button" onclick="validateForm()">Submit</button>
      </form>
      <div aria-live="polite" id="live-region"></div>

      <div class="accordion" role="region" aria-labelledby="acc-title">
        <h3 id="acc-title" style="display:none;">FAQ</h3>
        <div class="accordion-header" role="button" tabindex="0" aria-expanded="false" aria-controls="acc-panel"
             onclick="toggleAccordion(this)" onkeydown="if(event.key==='Enter'||event.key===' '){event.preventDefault();toggleAccordion(this);}">
          <span>What is accessibility?</span>
          <span aria-hidden="true">▼</span>
        </div>
        <div id="acc-panel" class="accordion-panel" role="region">
          Accessibility ensures everyone can use your application regardless of ability.
        </div>
      </div>
    </main>
    <script>
      function validateForm() {
        var valid = true;
        var name = document.getElementById('fullname');
        var email = document.getElementById('email-input');
        if (!name.value) {
          document.getElementById('name-hint').style.display = 'block';
          name.setAttribute('aria-invalid', 'true');
          valid = false;
        } else {
          document.getElementById('name-hint').style.display = 'none';
          name.removeAttribute('aria-invalid');
        }
        if (!email.value || !email.value.includes('@')) {
          document.getElementById('email-hint').style.display = 'block';
          email.setAttribute('aria-invalid', 'true');
          valid = false;
        } else {
          document.getElementById('email-hint').style.display = 'none';
          email.removeAttribute('aria-invalid');
        }
        var live = document.getElementById('live-region');
        live.textContent = valid ? 'Form submitted successfully' : 'Please fix the errors above';
      }
      function toggleAccordion(header) {
        var expanded = header.getAttribute('aria-expanded') === 'true';
        header.setAttribute('aria-expanded', String(!expanded));
        document.getElementById('acc-panel').classList.toggle('open');
      }
    </script>
  `;

  test('should have correct ARIA roles', async ({ page }) => {
    await delay(500);
    await page.setContent(a11yHtml);
    await expect(page.locator('nav[role="navigation"]')).toBeVisible();
    await expect(page.locator('main[role="main"]')).toBeVisible();
    await expect(page.locator('nav')).toHaveAttribute('aria-label', 'Main navigation');
  });

  test('should have form labels associated with inputs', async ({ page }) => {
    await delay(600);
    await page.setContent(a11yHtml);
    const nameInput = page.locator('#fullname');
    await expect(nameInput).toHaveAttribute('aria-required', 'true');
    await expect(nameInput).toHaveAttribute('aria-describedby', 'name-hint');
    const label = page.locator('label[for="fullname"]');
    await expect(label).toHaveText('Full Name');
  });

  test('should show validation with aria-invalid', async ({ page }) => {
    await delay(900);
    await page.setContent(a11yHtml);
    await page.click('button:has-text("Submit")');
    await expect(page.locator('#fullname')).toHaveAttribute('aria-invalid', 'true');
    await expect(page.locator('#name-hint')).toBeVisible();
    await expect(page.locator('#email-hint')).toBeVisible();
  });

  test('should toggle accordion with keyboard', async ({ page }) => {
    await delay(700);
    await page.setContent(a11yHtml);
    const header = page.locator('.accordion-header');
    await expect(header).toHaveAttribute('aria-expanded', 'false');
    await header.focus();
    await page.keyboard.press('Enter');
    await expect(header).toHaveAttribute('aria-expanded', 'true');
    await expect(page.locator('#acc-panel')).toHaveClass(/open/);
  });

  test('should manage focus on nav links', async ({ page }) => {
    await delay(400);
    await page.setContent(a11yHtml);
    await page.locator('#nav-home').focus();
    await page.keyboard.press('Tab');
    const focused = await page.evaluate(() => document.activeElement?.id);
    expect(focused).toBe('nav-about');
  });

  test('should have skip link for keyboard users', async ({ page }) => {
    await delay(500);
    await page.setContent(a11yHtml);
    const skipLink = page.locator('.skip-link');
    await expect(skipLink).toHaveAttribute('href', '#main');
    await expect(skipLink).toHaveText('Skip to main content');
  });
});
