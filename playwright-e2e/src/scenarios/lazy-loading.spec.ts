import { test, expect } from '@playwright/test';

const delay = (ms: number) => new Promise(r => setTimeout(r, ms));

/**
 * Lazy loading and scroll-triggered content tests.
 * Delays: 2000-4000ms per test (~15s total file weight).
 * Heaviest alongside timing-and-async — should get its own shard.
 */
test.describe('Lazy Loading', () => {
  test('should load content on scroll trigger', async ({ page }) => {
    await delay(3000);
    await page.setContent(`
      <div style="height:200px; overflow:auto;" id="scroller">
        <div style="height:400px;">Spacer</div>
        <div id="trigger" style="height:50px;">
          <span id="lazy" style="display:none;">Lazy content loaded!</span>
        </div>
      </div>
      <script>
        const observer = new IntersectionObserver((entries) => {
          entries.forEach(entry => {
            if (entry.isIntersecting) {
              document.getElementById('lazy').style.display = 'block';
            }
          });
        });
        observer.observe(document.getElementById('trigger'));
      </script>
    `);

    await expect(page.locator('#lazy')).toBeHidden();
    await page.locator('#trigger').scrollIntoViewIfNeeded();
    await expect(page.locator('#lazy')).toBeVisible({ timeout: 3000 });
  });

  test('should incrementally load list items', async ({ page }) => {
    await delay(4000);
    await page.setContent(`
      <ul id="items"></ul>
      <button id="load-more" onclick="
        var ul = document.getElementById('items');
        var count = ul.children.length;
        for (var i = 0; i < 5; i++) {
          var li = document.createElement('li');
          li.textContent = 'Item ' + (count + i + 1);
          ul.appendChild(li);
        }
        if (ul.children.length >= 15) this.disabled = true;
      ">Load More</button>
    `);

    await expect(page.locator('#items li')).toHaveCount(0);
    await page.click('#load-more');
    await expect(page.locator('#items li')).toHaveCount(5);
    await page.click('#load-more');
    await expect(page.locator('#items li')).toHaveCount(10);
    await page.click('#load-more');
    await expect(page.locator('#items li')).toHaveCount(15);
    await expect(page.locator('#load-more')).toBeDisabled();
  });

  test('should show loading skeleton then content', async ({ page }) => {
    await delay(2000);
    await page.setContent(`
      <div id="skeleton" style="background:#eee; height:100px; border-radius:4px;">Loading...</div>
      <div id="content" style="display:none;">
        <h2>Actual Content</h2>
        <p>This replaced the skeleton.</p>
      </div>
      <script>
        setTimeout(() => {
          document.getElementById('skeleton').style.display = 'none';
          document.getElementById('content').style.display = 'block';
        }, 500);
      </script>
    `);

    await expect(page.locator('#skeleton')).toBeVisible();
    await expect(page.locator('#content')).toBeHidden();
    await expect(page.locator('#content')).toBeVisible({ timeout: 2000 });
    await expect(page.locator('#skeleton')).toBeHidden();
  });

  test('should load images lazily', async ({ page }) => {
    await delay(3500);
    await page.setContent(`
      <div id="image-grid">
        <div class="placeholder" data-loaded="false">Image 1 placeholder</div>
        <div class="placeholder" data-loaded="false">Image 2 placeholder</div>
        <div class="placeholder" data-loaded="false">Image 3 placeholder</div>
      </div>
      <button id="load-images" onclick="
        document.querySelectorAll('.placeholder').forEach((el, i) => {
          setTimeout(() => {
            el.textContent = 'Image ' + (i+1) + ' loaded ✓';
            el.dataset.loaded = 'true';
          }, (i+1) * 200);
        });
      ">Load Images</button>
    `);

    const placeholders = page.locator('.placeholder[data-loaded="false"]');
    await expect(placeholders).toHaveCount(3);
    await page.click('#load-images');
    await expect(page.locator('.placeholder[data-loaded="true"]')).toHaveCount(3, { timeout: 3000 });
  });

  test('should show progress during batch load', async ({ page }) => {
    await delay(2500);
    await page.setContent(`
      <div id="progress">0%</div>
      <div id="bar" style="width:0%; height:20px; background:#4caf50; transition:width 0.3s;"></div>
      <button id="start" onclick="
        var p = 0;
        var interval = setInterval(() => {
          p += 20;
          document.getElementById('progress').textContent = p + '%';
          document.getElementById('bar').style.width = p + '%';
          if (p >= 100) {
            clearInterval(interval);
            document.getElementById('progress').textContent = 'Complete!';
          }
        }, 200);
      ">Start Loading</button>
    `);

    await page.click('#start');
    await expect(page.locator('#progress')).toHaveText('Complete!', { timeout: 5000 });
    await expect(page.locator('#bar')).toHaveCSS('width', /[1-9]/);
  });
});
