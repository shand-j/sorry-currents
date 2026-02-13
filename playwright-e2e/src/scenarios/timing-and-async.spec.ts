import { test, expect } from '@playwright/test';

/**
 * Tests with varying execution durations and async behavior.
 * Important for shard balancing — tests with different durations
 * exercise the LPT algorithm's ability to distribute evenly.
 */
test.describe('Timing and Async', () => {
  test('should handle delayed content appearance', async ({ page }) => {
    await page.setContent(`
      <button onclick="setTimeout(() => {
        document.getElementById('msg').textContent = 'Loaded!';
        document.getElementById('msg').style.display = 'block';
      }, 500)">Load</button>
      <div id="msg" style="display:none"></div>
    `);

    await page.click('button');
    await expect(page.locator('#msg')).toHaveText('Loaded!', { timeout: 2000 });
  });

  test('should wait for animation to complete', async ({ page }) => {
    await page.setContent(`
      <style>
        .progress { width: 0; height: 20px; background: green; transition: width 1s linear; }
        .progress.done { width: 100%; }
      </style>
      <div class="progress" id="bar"></div>
      <button onclick="document.getElementById('bar').classList.add('done');
        setTimeout(() => document.getElementById('status').textContent = 'Complete', 1000)">
        Start
      </button>
      <div id="status"></div>
    `);

    await page.click('button');
    await expect(page.locator('#status')).toHaveText('Complete', { timeout: 3000 });
  });

  test('should handle rapid sequential updates', async ({ page }) => {
    await page.setContent(`
      <div id="counter">0</div>
      <button onclick="
        let c = 0;
        const el = document.getElementById('counter');
        const interval = setInterval(() => {
          c++;
          el.textContent = String(c);
          if (c >= 10) clearInterval(interval);
        }, 50);">
        Count
      </button>
    `);

    await page.click('button');
    await expect(page.locator('#counter')).toHaveText('10', { timeout: 2000 });
  });

  test('should handle multiple concurrent timers', async ({ page }) => {
    await page.setContent(`
      <div id="a">waiting</div>
      <div id="b">waiting</div>
      <div id="c">waiting</div>
      <button onclick="
        setTimeout(() => document.getElementById('a').textContent = 'done', 200);
        setTimeout(() => document.getElementById('b').textContent = 'done', 400);
        setTimeout(() => document.getElementById('c').textContent = 'done', 600);
      ">Go</button>
    `);

    await page.click('button');
    await expect(page.locator('#a')).toHaveText('done', { timeout: 2000 });
    await expect(page.locator('#b')).toHaveText('done', { timeout: 2000 });
    await expect(page.locator('#c')).toHaveText('done', { timeout: 2000 });
  });

  test('should measure approximate timing', async ({ page }) => {
    await page.setContent(`
      <button id="start" onclick="
        const t = Date.now();
        setTimeout(() => {
          document.getElementById('elapsed').textContent = String(Date.now() - t);
        }, 300);">
        Start
      </button>
      <div id="elapsed"></div>
    `);

    await page.click('#start');
    await expect(page.locator('#elapsed')).not.toHaveText('', { timeout: 2000 });

    const elapsed = Number(await page.locator('#elapsed').textContent());
    expect(elapsed).toBeGreaterThanOrEqual(250);
    expect(elapsed).toBeLessThan(1000);
  });
});
