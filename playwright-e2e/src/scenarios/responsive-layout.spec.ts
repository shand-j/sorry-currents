import { test, expect } from '@playwright/test';

const delay = (ms: number) => new Promise(r => setTimeout(r, ms));

/**
 * Responsive layout tests — viewport resizing, breakpoints, mobile menu.
 * Delays: 800-1800ms per test (~9s total file weight).
 */
test.describe('Responsive Layout', () => {
  const responsiveHtml = `
    <style>
      * { box-sizing: border-box; margin: 0; padding: 0; }
      .header { background: #333; color: white; padding: 15px; display: flex; justify-content: space-between; align-items: center; }
      .desktop-nav { display: flex; gap: 15px; }
      .desktop-nav a { color: white; text-decoration: none; }
      .hamburger { display: none; cursor: pointer; font-size: 24px; background: none; border: none; color: white; }
      .mobile-menu { display: none; background: #444; }
      .mobile-menu a { display: block; color: white; padding: 12px 15px; text-decoration: none; border-bottom: 1px solid #555; }
      .grid { display: grid; grid-template-columns: repeat(3, 1fr); gap: 10px; padding: 20px; }
      .card { background: #f5f5f5; padding: 20px; border-radius: 8px; }
      .sidebar { display: block; background: #eee; padding: 20px; min-width: 200px; }
      .main-layout { display: flex; }
      .main-content { flex: 1; padding: 20px; }

      @media (max-width: 768px) {
        .desktop-nav { display: none; }
        .hamburger { display: block; }
        .grid { grid-template-columns: repeat(2, 1fr); }
        .sidebar { display: none; }
        .main-layout { flex-direction: column; }
      }
      @media (max-width: 480px) {
        .grid { grid-template-columns: 1fr; }
      }
    </style>
    <div class="header">
      <span>Logo</span>
      <div class="desktop-nav">
        <a href="#">Home</a><a href="#">About</a><a href="#">Contact</a>
      </div>
      <button class="hamburger" onclick="
        var menu = document.getElementById('mobile-menu');
        menu.style.display = menu.style.display === 'block' ? 'none' : 'block';
      " aria-label="Menu">☰</button>
    </div>
    <div id="mobile-menu" class="mobile-menu">
      <a href="#">Home</a><a href="#">About</a><a href="#">Contact</a>
    </div>
    <div class="main-layout">
      <div class="sidebar">Sidebar Content</div>
      <div class="main-content">
        <div class="grid">
          <div class="card">Card 1</div>
          <div class="card">Card 2</div>
          <div class="card">Card 3</div>
          <div class="card">Card 4</div>
          <div class="card">Card 5</div>
          <div class="card">Card 6</div>
        </div>
      </div>
    </div>
  `;

  test('should show desktop nav on wide viewport', async ({ page }) => {
    await delay(1000);
    await page.setViewportSize({ width: 1024, height: 768 });
    await page.setContent(responsiveHtml);
    await expect(page.locator('.desktop-nav')).toBeVisible();
    await expect(page.locator('.hamburger')).toBeHidden();
  });

  test('should show hamburger on mobile viewport', async ({ page }) => {
    await delay(1200);
    await page.setViewportSize({ width: 375, height: 667 });
    await page.setContent(responsiveHtml);
    await expect(page.locator('.hamburger')).toBeVisible();
    await expect(page.locator('.desktop-nav')).toBeHidden();
  });

  test('should toggle mobile menu', async ({ page }) => {
    await delay(1500);
    await page.setViewportSize({ width: 375, height: 667 });
    await page.setContent(responsiveHtml);
    await expect(page.locator('#mobile-menu')).toBeHidden();
    await page.click('.hamburger');
    await expect(page.locator('#mobile-menu')).toBeVisible();
    await page.click('.hamburger');
    await expect(page.locator('#mobile-menu')).toBeHidden();
  });

  test('should use 3-column grid on desktop', async ({ page }) => {
    await delay(800);
    await page.setViewportSize({ width: 1024, height: 768 });
    await page.setContent(responsiveHtml);
    const grid = page.locator('.grid');
    const style = await grid.evaluate(el => getComputedStyle(el).gridTemplateColumns);
    const columns = style.split(' ').length;
    expect(columns).toBe(3);
  });

  test('should use single-column grid on narrow viewport', async ({ page }) => {
    await delay(1800);
    await page.setViewportSize({ width: 375, height: 667 });
    await page.setContent(responsiveHtml);
    const grid = page.locator('.grid');
    const style = await grid.evaluate(el => getComputedStyle(el).gridTemplateColumns);
    const columns = style.split(' ').length;
    expect(columns).toBe(1);
  });

  test('should hide sidebar on mobile', async ({ page }) => {
    await delay(1000);
    await page.setViewportSize({ width: 375, height: 667 });
    await page.setContent(responsiveHtml);
    await expect(page.locator('.sidebar')).toBeHidden();
  });

  test('should show sidebar on desktop', async ({ page }) => {
    await delay(1200);
    await page.setViewportSize({ width: 1024, height: 768 });
    await page.setContent(responsiveHtml);
    await expect(page.locator('.sidebar')).toBeVisible();
  });
});
