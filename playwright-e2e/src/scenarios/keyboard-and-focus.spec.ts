import { test, expect } from '@playwright/test';

const delay = (ms: number) => new Promise(r => setTimeout(r, ms));

/**
 * Tests that exercise keyboard input, focus, and advanced interactions.
 * Delays: 300-1200ms per test (~3s total file weight).
 */
test.describe('Keyboard and Focus', () => {
  test('should type with keyboard events', async ({ page }) => {
    await delay(600);
    await page.setContent(`
      <input id="search" type="text"
        onkeyup="document.getElementById('preview').textContent = this.value.toUpperCase()" />
      <div id="preview"></div>
    `);

    await page.locator('#search').type('hello', { delay: 50 });
    await expect(page.locator('#preview')).toHaveText('HELLO');
  });

  test('should handle Enter key submission', async ({ page }) => {
    await delay(1200);
    await page.setContent(`
      <input id="cmd" type="text"
        onkeydown="if(event.key==='Enter'){
          document.getElementById('output').textContent='Executed: '+this.value;
          this.value='';
        }" />
      <div id="output"></div>
    `);

    await page.fill('#cmd', 'run tests');
    await page.press('#cmd', 'Enter');
    await expect(page.locator('#output')).toHaveText('Executed: run tests');
    await expect(page.locator('#cmd')).toHaveValue('');
  });

  test('should handle tab navigation between fields', async ({ page }) => {
    await delay(300);
    await page.setContent(`
      <input id="field1" type="text" onfocus="this.classList.add('focused')" onblur="this.classList.remove('focused')" />
      <input id="field2" type="text" onfocus="this.classList.add('focused')" onblur="this.classList.remove('focused')" />
      <input id="field3" type="text" onfocus="this.classList.add('focused')" onblur="this.classList.remove('focused')" />
    `);

    await page.focus('#field1');
    await expect(page.locator('#field1')).toHaveClass(/focused/);

    await page.keyboard.press('Tab');
    await expect(page.locator('#field2')).toHaveClass(/focused/);
    await expect(page.locator('#field1')).not.toHaveClass(/focused/);
  });

  test('should handle radio button selection', async ({ page }) => {
    await delay(900);
    await page.setContent(`
      <form id="shardConfig">
        <label><input type="radio" name="strategy" value="lpt" /> LPT</label>
        <label><input type="radio" name="strategy" value="round-robin" /> Round Robin</label>
        <label><input type="radio" name="strategy" value="file-group" /> File Group</label>
        <div id="selected"></div>
      </form>
      <script>
        document.querySelectorAll('input[name="strategy"]').forEach(r => {
          r.addEventListener('change', () => {
            document.getElementById('selected').textContent = r.value;
          });
        });
      </script>
    `);

    await page.check('input[value="lpt"]');
    await expect(page.locator('#selected')).toHaveText('lpt');

    await page.check('input[value="round-robin"]');
    await expect(page.locator('#selected')).toHaveText('round-robin');
    await expect(page.locator('input[value="lpt"]')).not.toBeChecked();
  });
});
