import { test, expect } from '@playwright/test';

const delay = (ms: number) => new Promise(r => setTimeout(r, ms));

/**
 * Storage and state persistence tests — localStorage, sessionStorage, CRUD.
 * Delays: 700-1500ms per test (~7s total file weight).
 */
test.describe('Storage and State', () => {
  const storageHtml = `
    <style>
      .container { max-width: 600px; margin: 20px auto; font-family: sans-serif; }
      .form-row { display: flex; gap: 10px; margin-bottom: 10px; }
      .form-row input { flex: 1; padding: 8px; border: 1px solid #ddd; border-radius: 4px; }
      button { padding: 8px 16px; border: none; border-radius: 4px; cursor: pointer; }
      .btn-save { background: #4caf50; color: white; }
      .btn-clear { background: #f44336; color: white; }
      .btn-load { background: #2196f3; color: white; }
      .stored-items { margin-top: 15px; }
      .stored-item { display: flex; justify-content: space-between; padding: 8px; background: #f9f9f9; margin-bottom: 4px; border-radius: 4px; }
      .stored-item .delete { cursor: pointer; color: red; }
      .status { margin-top: 10px; padding: 8px; border-radius: 4px; display: none; }
      .status.success { display: block; background: #e8f5e9; color: #2e7d32; }
      .status.empty { display: block; background: #fff3e0; color: #e65100; }
    </style>
    <div class="container">
      <h3>Key-Value Store</h3>
      <div class="form-row">
        <input id="key" placeholder="Key" />
        <input id="value" placeholder="Value" />
        <button class="btn-save" onclick="saveItem()">Save</button>
      </div>
      <div class="form-row">
        <button class="btn-load" onclick="loadItems()">Load All</button>
        <button class="btn-clear" onclick="clearAll()">Clear All</button>
      </div>
      <div id="status" class="status"></div>
      <div class="stored-items" id="items"></div>
      <div style="margin-top:20px;">
        <h4>Session Counter</h4>
        <p>Page views this session: <span id="counter">0</span></p>
        <button onclick="incrementCounter()">Increment</button>
      </div>
    </div>
    <script>
      function saveItem() {
        var key = document.getElementById('key').value;
        var val = document.getElementById('value').value;
        var status = document.getElementById('status');
        if (!key || !val) {
          status.className = 'status empty';
          status.textContent = 'Both key and value required';
          return;
        }
        localStorage.setItem('app_' + key, val);
        status.className = 'status success';
        status.textContent = 'Saved: ' + key;
        document.getElementById('key').value = '';
        document.getElementById('value').value = '';
        loadItems();
      }

      function loadItems() {
        var container = document.getElementById('items');
        container.innerHTML = '';
        var count = 0;
        for (var i = 0; i < localStorage.length; i++) {
          var k = localStorage.key(i);
          if (k && k.startsWith('app_')) {
            count++;
            var div = document.createElement('div');
            div.className = 'stored-item';
            div.innerHTML = '<span><strong>' + k.slice(4) + '</strong>: ' + localStorage.getItem(k) + '</span><span class="delete" data-key="' + k + '" onclick="deleteItem(this.dataset.key)">✕</span>';
            container.appendChild(div);
          }
        }
        if (count === 0) {
          container.innerHTML = '<p style="color:#999">No items stored</p>';
        }
      }

      function deleteItem(key) {
        localStorage.removeItem(key);
        loadItems();
      }

      function clearAll() {
        var keys = [];
        for (var i = 0; i < localStorage.length; i++) {
          var k = localStorage.key(i);
          if (k && k.startsWith('app_')) keys.push(k);
        }
        keys.forEach(function(k) { localStorage.removeItem(k); });
        document.getElementById('status').className = 'status success';
        document.getElementById('status').textContent = 'All items cleared';
        loadItems();
      }

      function incrementCounter() {
        var c = parseInt(sessionStorage.getItem('counter') || '0') + 1;
        sessionStorage.setItem('counter', String(c));
        document.getElementById('counter').textContent = String(c);
      }

      // Initialize
      var c = sessionStorage.getItem('counter') || '0';
      document.getElementById('counter').textContent = c;
      loadItems();
    </script>
  `;

  test('should save item to localStorage', async ({ page }) => {
    await delay(1000);
    await page.setContent(storageHtml);
    await page.fill('#key', 'color');
    await page.fill('#value', 'blue');
    await page.click('.btn-save');
    await expect(page.locator('#status')).toHaveText('Saved: color');
    await expect(page.locator('.stored-item')).toHaveCount(1);
  });

  test('should load stored items', async ({ page }) => {
    await delay(1200);
    await page.setContent(storageHtml);
    await page.evaluate(() => {
      localStorage.setItem('app_fruit', 'apple');
      localStorage.setItem('app_veggie', 'carrot');
    });
    await page.click('.btn-load');
    await expect(page.locator('.stored-item')).toHaveCount(2);
  });

  test('should delete individual item', async ({ page }) => {
    await delay(1500);
    await page.setContent(storageHtml);
    await page.evaluate(() => {
      localStorage.setItem('app_item1', 'val1');
      localStorage.setItem('app_item2', 'val2');
    });
    await page.click('.btn-load');
    await expect(page.locator('.stored-item')).toHaveCount(2);
    await page.locator('.stored-item .delete').first().click();
    await expect(page.locator('.stored-item')).toHaveCount(1);
  });

  test('should clear all items', async ({ page }) => {
    await delay(1000);
    await page.setContent(storageHtml);
    await page.evaluate(() => {
      localStorage.setItem('app_x', '1');
      localStorage.setItem('app_y', '2');
    });
    await page.click('.btn-load');
    await page.click('.btn-clear');
    await expect(page.locator('#status')).toHaveText('All items cleared');
    await expect(page.locator('.stored-item')).toHaveCount(0);
  });

  test('should validate required fields', async ({ page }) => {
    await delay(700);
    await page.setContent(storageHtml);
    await page.click('.btn-save');
    await expect(page.locator('#status')).toHaveText('Both key and value required');
    await expect(page.locator('#status')).toHaveClass(/empty/);
  });

  test('should track session counter', async ({ page }) => {
    await delay(1200);
    await page.setContent(storageHtml);
    await expect(page.locator('#counter')).toHaveText('0');
    await page.click('button:has-text("Increment")');
    await expect(page.locator('#counter')).toHaveText('1');
    await page.click('button:has-text("Increment")');
    await expect(page.locator('#counter')).toHaveText('2');
  });
});
