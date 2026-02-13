import { test, expect } from '@playwright/test';

const delay = (ms: number) => new Promise(r => setTimeout(r, ms));

/**
 * Internationalization tests — locale switching, RTL, number formatting.
 * Delays: 600-1500ms per test (~7s total file weight).
 */
test.describe('Internationalization', () => {
  test('should switch language', async ({ page }) => {
    await delay(1000);
    await page.setContent(`
      <select id="lang" onchange="
        var t = { en: { title: 'Welcome', desc: 'Hello World' },
                  es: { title: 'Bienvenido', desc: 'Hola Mundo' },
                  ja: { title: 'ようこそ', desc: 'こんにちは世界' } };
        var l = this.value;
        document.getElementById('title').textContent = t[l].title;
        document.getElementById('desc').textContent = t[l].desc;
      ">
        <option value="en">English</option>
        <option value="es">Español</option>
        <option value="ja">日本語</option>
      </select>
      <h1 id="title">Welcome</h1>
      <p id="desc">Hello World</p>
    `);

    await page.selectOption('#lang', 'es');
    await expect(page.locator('#title')).toHaveText('Bienvenido');
    await expect(page.locator('#desc')).toHaveText('Hola Mundo');
  });

  test('should switch to Japanese', async ({ page }) => {
    await delay(1200);
    await page.setContent(`
      <select id="lang" onchange="
        var t = { en: { title: 'Welcome' }, ja: { title: 'ようこそ' } };
        document.getElementById('title').textContent = t[this.value].title;
      ">
        <option value="en">English</option>
        <option value="ja">日本語</option>
      </select>
      <h1 id="title">Welcome</h1>
    `);

    await page.selectOption('#lang', 'ja');
    await expect(page.locator('#title')).toHaveText('ようこそ');
  });

  test('should handle RTL direction', async ({ page }) => {
    await delay(800);
    await page.setContent(`
      <button onclick="
        var dir = document.body.dir === 'rtl' ? 'ltr' : 'rtl';
        document.body.dir = dir;
        document.getElementById('dir-label').textContent = dir.toUpperCase();
      ">Toggle Direction</button>
      <span id="dir-label">LTR</span>
      <p id="content">Some text content</p>
    `);

    await expect(page.locator('#dir-label')).toHaveText('LTR');
    await page.click('button');
    await expect(page.locator('#dir-label')).toHaveText('RTL');
    const dir = await page.evaluate(() => document.body.dir);
    expect(dir).toBe('rtl');
  });

  test('should format numbers by locale', async ({ page }) => {
    await delay(600);
    await page.setContent(`
      <select id="locale" onchange="
        var num = 1234567.89;
        document.getElementById('formatted').textContent =
          new Intl.NumberFormat(this.value).format(num);
      ">
        <option value="en-US">US</option>
        <option value="de-DE">German</option>
        <option value="ja-JP">Japanese</option>
      </select>
      <div id="formatted">1,234,567.89</div>
    `);

    await page.selectOption('#locale', 'de-DE');
    const text = await page.locator('#formatted').textContent();
    expect(text).toContain('1.234.567');
  });

  test('should format currency', async ({ page }) => {
    await delay(1500);
    await page.setContent(`
      <select id="currency" onchange="
        var amount = 9999.99;
        var fmt = { USD: 'en-US', EUR: 'de-DE', JPY: 'ja-JP' };
        document.getElementById('price').textContent =
          new Intl.NumberFormat(fmt[this.value], { style: 'currency', currency: this.value }).format(amount);
      ">
        <option value="USD">USD</option>
        <option value="EUR">EUR</option>
        <option value="JPY">JPY</option>
      </select>
      <div id="price">$9,999.99</div>
    `);

    await page.selectOption('#currency', 'EUR');
    const text = await page.locator('#price').textContent();
    expect(text).toContain('€');
  });

  test('should format dates by locale', async ({ page }) => {
    await delay(900);
    await page.setContent(`
      <div id="date"></div>
      <script>
        var d = new Date(2026, 0, 15);
        document.getElementById('date').textContent =
          new Intl.DateTimeFormat('de-DE', { dateStyle: 'long' }).format(d);
      </script>
    `);

    const text = await page.locator('#date').textContent();
    expect(text).toContain('Januar');
    expect(text).toContain('2026');
  });

  test('should handle special characters in content', async ({ page }) => {
    await delay(700);
    await page.setContent(`
      <div id="special">Ñoño café über straße naïve résumé</div>
      <div id="emoji">🎭 Testing 🚀 Playwright 🎯</div>
      <div id="cjk">漢字テスト한국어</div>
    `);

    await expect(page.locator('#special')).toContainText('café');
    await expect(page.locator('#special')).toContainText('über');
    await expect(page.locator('#emoji')).toContainText('🎭');
    await expect(page.locator('#cjk')).toContainText('漢字');
  });
});
