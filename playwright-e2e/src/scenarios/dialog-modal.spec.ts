import { test, expect } from '@playwright/test';

const delay = (ms: number) => new Promise(r => setTimeout(r, ms));

/**
 * Dialog and modal interaction tests — open, close, stack, confirm.
 * Delays: 500-1200ms per test (~5s total file weight).
 */
test.describe('Dialog Modal', () => {
  const modalHtml = `
    <style>
      .overlay { display:none; position:fixed; top:0; left:0; width:100%; height:100%;
        background:rgba(0,0,0,0.5); z-index:100; }
      .modal { position:fixed; top:50%; left:50%; transform:translate(-50%,-50%);
        background:white; padding:20px; border-radius:8px; z-index:101; min-width:300px; }
      .modal.hidden { display:none; }
    </style>
    <button id="open-modal">Open Modal</button>
    <button id="open-confirm">Confirm Action</button>
    <div id="overlay" class="overlay"></div>
    <div id="modal1" class="modal hidden">
      <h3>Modal Title</h3>
      <p id="modal-body">Modal content here</p>
      <button id="close-modal">Close</button>
      <button id="open-nested">Open Nested</button>
    </div>
    <div id="modal2" class="modal hidden">
      <h3>Nested Modal</h3>
      <p>This is nested</p>
      <button id="close-nested">Close Nested</button>
    </div>
    <div id="confirm-modal" class="modal hidden">
      <h3>Are you sure?</h3>
      <button id="confirm-yes">Yes</button>
      <button id="confirm-no">No</button>
    </div>
    <div id="result"></div>
    <script>
      document.getElementById('open-modal').onclick = () => {
        document.getElementById('modal1').classList.remove('hidden');
        document.getElementById('overlay').style.display = 'block';
      };
      document.getElementById('close-modal').onclick = () => {
        document.getElementById('modal1').classList.add('hidden');
        document.getElementById('overlay').style.display = 'none';
      };
      document.getElementById('open-nested').onclick = () => {
        document.getElementById('modal2').classList.remove('hidden');
      };
      document.getElementById('close-nested').onclick = () => {
        document.getElementById('modal2').classList.add('hidden');
      };
      document.getElementById('open-confirm').onclick = () => {
        document.getElementById('confirm-modal').classList.remove('hidden');
        document.getElementById('overlay').style.display = 'block';
      };
      document.getElementById('confirm-yes').onclick = () => {
        document.getElementById('confirm-modal').classList.add('hidden');
        document.getElementById('overlay').style.display = 'none';
        document.getElementById('result').textContent = 'Confirmed';
      };
      document.getElementById('confirm-no').onclick = () => {
        document.getElementById('confirm-modal').classList.add('hidden');
        document.getElementById('overlay').style.display = 'none';
        document.getElementById('result').textContent = 'Cancelled';
      };
    </script>
  `;

  test('should open and close modal', async ({ page }) => {
    await delay(800);
    await page.setContent(modalHtml);
    await expect(page.locator('#modal1')).toHaveClass(/hidden/);
    await page.click('#open-modal');
    await expect(page.locator('#modal1')).not.toHaveClass(/hidden/);
    await page.click('#close-modal');
    await expect(page.locator('#modal1')).toHaveClass(/hidden/);
  });

  test('should display modal content', async ({ page }) => {
    await delay(600);
    await page.setContent(modalHtml);
    await page.click('#open-modal');
    await expect(page.locator('#modal1 h3')).toHaveText('Modal Title');
    await expect(page.locator('#modal-body')).toHaveText('Modal content here');
  });

  test('should stack nested modals', async ({ page }) => {
    await delay(1200);
    await page.setContent(modalHtml);
    await page.click('#open-modal');
    await page.click('#open-nested');
    await expect(page.locator('#modal1')).not.toHaveClass(/hidden/);
    await expect(page.locator('#modal2')).not.toHaveClass(/hidden/);
    await page.click('#close-nested');
    await expect(page.locator('#modal2')).toHaveClass(/hidden/);
    await expect(page.locator('#modal1')).not.toHaveClass(/hidden/);
  });

  test('should confirm and show result', async ({ page }) => {
    await delay(500);
    await page.setContent(modalHtml);
    await page.click('#open-confirm');
    await page.click('#confirm-yes');
    await expect(page.locator('#result')).toHaveText('Confirmed');
  });

  test('should cancel and show result', async ({ page }) => {
    await delay(700);
    await page.setContent(modalHtml);
    await page.click('#open-confirm');
    await page.click('#confirm-no');
    await expect(page.locator('#result')).toHaveText('Cancelled');
  });

  test('should show overlay when modal opens', async ({ page }) => {
    await delay(1000);
    await page.setContent(modalHtml);
    await expect(page.locator('#overlay')).toBeHidden();
    await page.click('#open-modal');
    await expect(page.locator('#overlay')).toBeVisible();
  });
});
