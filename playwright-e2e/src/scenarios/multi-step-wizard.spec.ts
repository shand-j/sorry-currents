import { test, expect } from '@playwright/test';

const delay = (ms: number) => new Promise(r => setTimeout(r, ms));

/**
 * Multi-step wizard form tests — page navigation, validation, summary.
 * Delays: 1000-2500ms per test (~10s total file weight).
 */
test.describe('Multi-Step Wizard', () => {
  const wizardHtml = `
    <style>
      .step { display: none; padding: 20px; border: 1px solid #ddd; }
      .step.active { display: block; }
      .step-indicator { display: flex; gap: 10px; margin-bottom: 10px; }
      .step-indicator span { padding: 5px 10px; background: #eee; border-radius: 4px; }
      .step-indicator span.current { background: #2196f3; color: white; }
      .step-indicator span.completed { background: #4caf50; color: white; }
    </style>
    <div class="step-indicator">
      <span id="ind-1" class="current">1. Info</span>
      <span id="ind-2">2. Address</span>
      <span id="ind-3">3. Review</span>
    </div>
    <div id="step1" class="step active">
      <h3>Personal Information</h3>
      <input id="name" placeholder="Name" />
      <input id="email" placeholder="Email" />
      <div id="step1-error" style="color:red;display:none;"></div>
      <button id="next1" onclick="
        var name = document.getElementById('name').value;
        var email = document.getElementById('email').value;
        if (!name || !email) { document.getElementById('step1-error').textContent='All fields required'; document.getElementById('step1-error').style.display='block'; return; }
        document.getElementById('step1').classList.remove('active');
        document.getElementById('step2').classList.add('active');
        document.getElementById('ind-1').className='completed';
        document.getElementById('ind-2').className='current';
      ">Next</button>
    </div>
    <div id="step2" class="step">
      <h3>Address</h3>
      <input id="street" placeholder="Street" />
      <input id="city" placeholder="City" />
      <button id="back2" onclick="
        document.getElementById('step2').classList.remove('active');
        document.getElementById('step1').classList.add('active');
        document.getElementById('ind-2').className='';
        document.getElementById('ind-1').className='current';
      ">Back</button>
      <button id="next2" onclick="
        document.getElementById('step2').classList.remove('active');
        document.getElementById('step3').classList.add('active');
        document.getElementById('ind-2').className='completed';
        document.getElementById('ind-3').className='current';
      ">Next</button>
    </div>
    <div id="step3" class="step">
      <h3>Review</h3>
      <div id="summary"></div>
      <button id="back3" onclick="
        document.getElementById('step3').classList.remove('active');
        document.getElementById('step2').classList.add('active');
        document.getElementById('ind-3').className='';
        document.getElementById('ind-2').className='current';
      ">Back</button>
      <button id="submit" onclick="
        document.getElementById('result').textContent = 'Submitted!';
        document.getElementById('result').style.display = 'block';
      ">Submit</button>
    </div>
    <div id="result" style="display:none; color:green; padding:10px;"></div>
    <script>
      // Populate summary when step 3 becomes active
      const observer = new MutationObserver(() => {
        if (document.getElementById('step3').classList.contains('active')) {
          document.getElementById('summary').innerHTML =
            '<p>Name: ' + document.getElementById('name').value + '</p>' +
            '<p>Email: ' + document.getElementById('email').value + '</p>' +
            '<p>Street: ' + document.getElementById('street').value + '</p>' +
            '<p>City: ' + document.getElementById('city').value + '</p>';
        }
      });
      observer.observe(document.getElementById('step3'), { attributes: true });
    </script>
  `;

  test('should start on step 1', async ({ page }) => {
    await delay(1000);
    await page.setContent(wizardHtml);
    await expect(page.locator('#step1')).toHaveClass(/active/);
    await expect(page.locator('#step2')).not.toHaveClass(/active/);
    await expect(page.locator('#ind-1')).toHaveClass(/current/);
  });

  test('should validate step 1 required fields', async ({ page }) => {
    await delay(1500);
    await page.setContent(wizardHtml);
    await page.click('#next1');
    await expect(page.locator('#step1-error')).toBeVisible();
    await expect(page.locator('#step1-error')).toHaveText('All fields required');
    await expect(page.locator('#step1')).toHaveClass(/active/);
  });

  test('should navigate to step 2', async ({ page }) => {
    await delay(2000);
    await page.setContent(wizardHtml);
    await page.fill('#name', 'John');
    await page.fill('#email', 'john@test.com');
    await page.click('#next1');
    await expect(page.locator('#step2')).toHaveClass(/active/);
    await expect(page.locator('#ind-1')).toHaveClass(/completed/);
  });

  test('should go back from step 2 to step 1', async ({ page }) => {
    await delay(2500);
    await page.setContent(wizardHtml);
    await page.fill('#name', 'Jane');
    await page.fill('#email', 'jane@test.com');
    await page.click('#next1');
    await page.click('#back2');
    await expect(page.locator('#step1')).toHaveClass(/active/);
    await expect(page.locator('#name')).toHaveValue('Jane');
  });

  test('should complete full wizard flow', async ({ page }) => {
    await delay(1500);
    await page.setContent(wizardHtml);
    await page.fill('#name', 'Alice');
    await page.fill('#email', 'alice@test.com');
    await page.click('#next1');
    await page.fill('#street', '123 Main St');
    await page.fill('#city', 'Portland');
    await page.click('#next2');
    await expect(page.locator('#step3')).toHaveClass(/active/);
    await page.click('#submit');
    await expect(page.locator('#result')).toHaveText('Submitted!');
  });

  test('should show summary on review step', async ({ page }) => {
    await delay(1800);
    await page.setContent(wizardHtml);
    await page.fill('#name', 'Bob');
    await page.fill('#email', 'bob@test.com');
    await page.click('#next1');
    await page.fill('#street', '456 Elm Ave');
    await page.fill('#city', 'Seattle');
    await page.click('#next2');
    await expect(page.locator('#summary')).toContainText('Bob');
    await expect(page.locator('#summary')).toContainText('bob@test.com');
    await expect(page.locator('#summary')).toContainText('Seattle');
  });
});
