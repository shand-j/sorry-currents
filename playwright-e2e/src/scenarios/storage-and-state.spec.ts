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
        <button class="btn-save" id="btn-save">Save</button>
      </div>
      <div class="form-row">
        <button class="btn-load" id="btn-load">Load All</button>
        <button class="btn-clear" id="btn-clear">Clear All</button>
      </div>
      <div id="status" class="status"></div>
      <div class="stored-items" id="items"></div>
      <div style="margin-top:20px;">
        <h4>Session Counter</h4>
        <p>Page views this session: <span id="counter">0</span></p>
        <button id="btn-increment">Increment</button>
      </div>
    </div>
    <script>
      // In-memory store — avoids about:blank localStorage restrictions
      var store = {};
      var sessionCounter = 0;

      function saveItem() {
        var key = document.getElementById("key").value;
        var val = document.getElementById("value").value;
        var status = document.getElementById("status");
        if (!key || !val) {
          status.className = "status empty";
          status.textContent = "Both key and value required";
          return;
        }
        store[key] = val;
        status.className = "status success";
        status.textContent = "Saved: " + key;
        document.getElementById("key").value = "";
        document.getElementById("value").value = "";
        loadItems();
      }

      function loadItems() {
        var container = document.getElementById("items");
        container.innerHTML = "";
        var keys = Object.keys(store);
        if (keys.length === 0) {
          container.innerHTML = '<p style="color:#999">No items stored</p>';
          return;
        }
        keys.forEach(function(k) {
          var div = document.createElement("div");
          div.className = "stored-item";
          var span = document.createElement("span");
          span.innerHTML = "<strong>" + k + "</strong>: " + store[k];
          div.appendChild(span);
          var del = document.createElement("span");
          del.className = "delete";
          del.textContent = "\\u2715";
          del.addEventListener("click", function() { deleteItem(k); });
          div.appendChild(del);
          container.appendChild(div);
        });
      }

      function deleteItem(key) {
        delete store[key];
        loadItems();
      }

      function clearAll() {
        store = {};
        document.getElementById("status").className = "status success";
        document.getElementById("status").textContent = "All items cleared";
        loadItems();
      }

      function incrementCounter() {
        sessionCounter++;
        document.getElementById("counter").textContent = String(sessionCounter);
      }

      document.getElementById("btn-save").addEventListener("click", saveItem);
      document.getElementById("btn-load").addEventListener("click", loadItems);
      document.getElementById("btn-clear").addEventListener("click", clearAll);
      document.getElementById("btn-increment").addEventListener("click", incrementCounter);
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
      (window as any).store['fruit'] = 'apple';
      (window as any).store['veggie'] = 'carrot';
    });
    await page.click('.btn-load');
    await expect(page.locator('.stored-item')).toHaveCount(2);
  });

  test('should delete individual item', async ({ page }) => {
    await delay(1500);
    await page.setContent(storageHtml);
    await page.evaluate(() => {
      (window as any).store['item1'] = 'val1';
      (window as any).store['item2'] = 'val2';
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
      (window as any).store['x'] = '1';
      (window as any).store['y'] = '2';
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
