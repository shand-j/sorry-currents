import { test, expect } from '@playwright/test';

const delay = (ms: number) => new Promise(r => setTimeout(r, ms));

/**
 * Navigation component tests — menus, breadcrumbs, tabs, scroll-to-top.
 * Delays: 400-800ms per test (~4s total file weight).
 */
test.describe('Navigation', () => {
  const navHtml = `
    <style>
      nav { background: #333; padding: 10px; }
      nav a { color: white; margin: 0 10px; text-decoration: none; cursor: pointer; }
      nav a.active { border-bottom: 2px solid #ff9800; }
      .breadcrumbs { padding: 5px; font-size: 14px; color: #666; }
      .breadcrumbs span::after { content: ' > '; }
      .breadcrumbs span:last-child::after { content: ''; }
      .tabs { display: flex; border-bottom: 1px solid #ddd; }
      .tabs button { padding: 10px 20px; border: none; cursor: pointer; background: none; }
      .tabs button.active { border-bottom: 2px solid #2196f3; font-weight: bold; }
      .tab-panel { display: none; padding: 15px; }
      .tab-panel.active { display: block; }
      .page-content { height: 1200px; padding: 20px; }
      #scroll-top { position: fixed; bottom: 20px; right: 20px; display: none; cursor: pointer; padding: 10px; background: #333; color: white; }
    </style>
    <nav>
      <a class="active" data-page="home" onclick="navigate(this)">Home</a>
      <a data-page="about" onclick="navigate(this)">About</a>
      <a data-page="contact" onclick="navigate(this)">Contact</a>
    </nav>
    <div class="breadcrumbs" id="breadcrumbs">
      <span>Home</span>
    </div>
    <div class="tabs">
      <button class="active" data-tab="overview" onclick="switchTab(this)">Overview</button>
      <button data-tab="details" onclick="switchTab(this)">Details</button>
      <button data-tab="settings" onclick="switchTab(this)">Settings</button>
    </div>
    <div id="tab-overview" class="tab-panel active">Overview content</div>
    <div id="tab-details" class="tab-panel">Details content here</div>
    <div id="tab-settings" class="tab-panel">Settings panel</div>
    <div class="page-content">Scrollable content</div>
    <button id="scroll-top" onclick="window.scrollTo({top:0,behavior:'smooth'})">↑</button>
    <script>
      function navigate(el) {
        document.querySelectorAll('nav a').forEach(a => a.classList.remove('active'));
        el.classList.add('active');
        var bc = document.getElementById('breadcrumbs');
        bc.innerHTML = '<span>Home</span><span>' + el.dataset.page.charAt(0).toUpperCase() + el.dataset.page.slice(1) + '</span>';
      }
      function switchTab(el) {
        document.querySelectorAll('.tabs button').forEach(b => b.classList.remove('active'));
        document.querySelectorAll('.tab-panel').forEach(p => p.classList.remove('active'));
        el.classList.add('active');
        document.getElementById('tab-' + el.dataset.tab).classList.add('active');
      }
      window.addEventListener('scroll', function() {
        document.getElementById('scroll-top').style.display = window.scrollY > 300 ? 'block' : 'none';
      });
    </script>
  `;

  test('should highlight active nav link', async ({ page }) => {
    await delay(600);
    await page.setContent(navHtml);
    await expect(page.locator('nav a[data-page="home"]')).toHaveClass(/active/);
    await page.click('nav a[data-page="about"]');
    await expect(page.locator('nav a[data-page="about"]')).toHaveClass(/active/);
    await expect(page.locator('nav a[data-page="home"]')).not.toHaveClass(/active/);
  });

  test('should update breadcrumbs on navigation', async ({ page }) => {
    await delay(700);
    await page.setContent(navHtml);
    await page.click('nav a[data-page="contact"]');
    await expect(page.locator('#breadcrumbs')).toContainText('Contact');
  });

  test('should switch tabs', async ({ page }) => {
    await delay(500);
    await page.setContent(navHtml);
    await expect(page.locator('#tab-overview')).toHaveClass(/active/);
    await page.click('.tabs button[data-tab="details"]');
    await expect(page.locator('#tab-details')).toHaveClass(/active/);
    await expect(page.locator('#tab-overview')).not.toHaveClass(/active/);
  });

  test('should show correct tab content', async ({ page }) => {
    await delay(800);
    await page.setContent(navHtml);
    await page.click('.tabs button[data-tab="settings"]');
    await expect(page.locator('#tab-settings')).toContainText('Settings panel');
    await expect(page.locator('#tab-settings')).toBeVisible();
  });

  test('should highlight active tab button', async ({ page }) => {
    await delay(400);
    await page.setContent(navHtml);
    await page.click('.tabs button[data-tab="details"]');
    await expect(page.locator('.tabs button[data-tab="details"]')).toHaveClass(/active/);
    await expect(page.locator('.tabs button[data-tab="overview"]')).not.toHaveClass(/active/);
  });

  test('should render all nav links', async ({ page }) => {
    await delay(600);
    await page.setContent(navHtml);
    await expect(page.locator('nav a')).toHaveCount(3);
    await expect(page.locator('.tabs button')).toHaveCount(3);
  });
});
