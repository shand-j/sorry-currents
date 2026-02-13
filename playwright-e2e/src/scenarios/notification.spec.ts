import { test, expect } from '@playwright/test';

const delay = (ms: number) => new Promise(r => setTimeout(r, ms));

/**
 * Notification / toast tests — show, auto-dismiss, stack, action buttons.
 * Delays: 500-1500ms per test (~6s total file weight).
 */
test.describe('Notifications', () => {
  const notifHtml = `
    <style>
      .toast-container { position: fixed; top: 10px; right: 10px; display: flex; flex-direction: column; gap: 8px; z-index: 100; }
      .toast { padding: 12px 20px; border-radius: 6px; color: white; display: flex; align-items: center; gap: 10px; animation: slideIn 0.2s ease; }
      .toast.success { background: #4caf50; }
      .toast.error { background: #f44336; }
      .toast.warning { background: #ff9800; }
      .toast .close { cursor: pointer; margin-left: auto; background: none; border: none; color: white; font-size: 16px; }
      .toast .action-btn { background: rgba(255,255,255,0.3); border: none; color: white; padding: 4px 8px; border-radius: 3px; cursor: pointer; }
      @keyframes slideIn { from { transform: translateX(100%); } to { transform: translateX(0); } }
    </style>
    <button id="show-success">Success</button>
    <button id="show-error">Error</button>
    <button id="show-warning">Warning</button>
    <button id="show-action">With Action</button>
    <div class="toast-container" id="toasts"></div>
    <div id="action-result" style="display:none;"></div>
    <script>
      var toastId = 0;
      function makeCloseBtn() {
        var btn = document.createElement("button");
        btn.className = "close";
        btn.setAttribute("aria-label", "Dismiss");
        btn.textContent = "\\u00d7";
        btn.addEventListener("click", function() { this.parentElement.remove(); });
        return btn;
      }
      function showToast(type, message, persistent) {
        var id = "toast-" + (++toastId);
        var container = document.getElementById("toasts");
        var toast = document.createElement("div");
        toast.className = "toast " + type;
        toast.id = id;
        toast.setAttribute("role", "alert");
        var span = document.createElement("span");
        span.textContent = message;
        toast.appendChild(span);
        toast.appendChild(makeCloseBtn());
        container.appendChild(toast);
        if (!persistent) {
          setTimeout(function() { var el = document.getElementById(id); if (el) el.remove(); }, 3000);
        }
      }
      function showActionToast() {
        var id = "toast-" + (++toastId);
        var container = document.getElementById("toasts");
        var toast = document.createElement("div");
        toast.className = "toast warning";
        toast.id = id;
        toast.setAttribute("role", "alert");
        var span = document.createElement("span");
        span.textContent = "Undo available";
        toast.appendChild(span);
        var actionBtn = document.createElement("button");
        actionBtn.className = "action-btn";
        actionBtn.textContent = "Undo";
        actionBtn.addEventListener("click", function() {
          document.getElementById("action-result").textContent = "Undone";
          document.getElementById("action-result").style.display = "block";
          toast.remove();
        });
        toast.appendChild(actionBtn);
        toast.appendChild(makeCloseBtn());
        container.appendChild(toast);
      }
      document.getElementById("show-success").addEventListener("click", function() { showToast("success", "Operation completed"); });
      document.getElementById("show-error").addEventListener("click", function() { showToast("error", "Something went wrong"); });
      document.getElementById("show-warning").addEventListener("click", function() { showToast("warning", "Please review", true); });
      document.getElementById("show-action").addEventListener("click", showActionToast);
    </script>
  `;

  test('should show success notification', async ({ page }) => {
    await delay(800);
    await page.setContent(notifHtml);
    await page.click('#show-success');
    const toast = page.locator('.toast.success');
    await expect(toast).toBeVisible();
    await expect(toast).toContainText('Operation completed');
  });

  test('should show error notification', async ({ page }) => {
    await delay(500);
    await page.setContent(notifHtml);
    await page.click('#show-error');
    const toast = page.locator('.toast.error');
    await expect(toast).toBeVisible();
    await expect(toast).toHaveAttribute('role', 'alert');
  });

  test('should dismiss notification via close button', async ({ page }) => {
    await delay(1000);
    await page.setContent(notifHtml);
    await page.click('#show-warning');
    const toast = page.locator('.toast.warning');
    await expect(toast).toBeVisible();
    await toast.locator('.close').click();
    await expect(toast).toHaveCount(0);
  });

  test('should stack multiple notifications', async ({ page }) => {
    await delay(1200);
    await page.setContent(notifHtml);
    await page.click('#show-success');
    await page.click('#show-error');
    await page.click('#show-warning');
    await expect(page.locator('.toast')).toHaveCount(3);
  });

  test('should handle action button in notification', async ({ page }) => {
    await delay(1500);
    await page.setContent(notifHtml);
    await page.click('#show-action');
    const toast = page.locator('.toast');
    await expect(toast).toBeVisible();
    await toast.locator('.action-btn').click();
    await expect(page.locator('#action-result')).toHaveText('Undone');
    await expect(page.locator('.toast')).toHaveCount(0);
  });

  test('should auto-dismiss non-persistent notifications', async ({ page }) => {
    await delay(700);
    await page.setContent(notifHtml);
    await page.click('#show-success');
    await expect(page.locator('.toast.success')).toBeVisible();
    // Wait for the 3s auto-dismiss
    await page.waitForTimeout(3500);
    await expect(page.locator('.toast.success')).toHaveCount(0);
  });
});
