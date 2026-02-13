import { test, expect } from '@playwright/test';

const delay = (ms: number) => new Promise(r => setTimeout(r, ms));

/**
 * Data table interaction tests — sort, filter, paginate.
 * Delays: 800-2000ms per test (~8s total file weight).
 */
test.describe('Data Table', () => {
  const tableHtml = `
    <style>
      table { border-collapse: collapse; width: 100%; }
      th, td { border: 1px solid #ddd; padding: 8px; text-align: left; }
      th { cursor: pointer; background: #f4f4f4; }
      .hidden { display: none; }
      .page-btn { padding: 4px 8px; margin: 2px; cursor: pointer; }
      .page-btn.active { background: #007bff; color: white; }
    </style>
    <input id="search" placeholder="Filter..." />
    <table>
      <thead>
        <tr>
          <th id="col-name" onclick="sortTable(0)">Name</th>
          <th id="col-score" onclick="sortTable(1)">Score</th>
          <th id="col-status" onclick="sortTable(2)">Status</th>
        </tr>
      </thead>
      <tbody id="tbody">
        <tr><td>Alice</td><td>95</td><td>passed</td></tr>
        <tr><td>Bob</td><td>72</td><td>failed</td></tr>
        <tr><td>Charlie</td><td>88</td><td>passed</td></tr>
        <tr><td>Diana</td><td>64</td><td>failed</td></tr>
        <tr><td>Eve</td><td>91</td><td>passed</td></tr>
        <tr><td>Frank</td><td>55</td><td>failed</td></tr>
      </tbody>
    </table>
    <div id="pagination"></div>
    <script>
      let sortDir = -1;
      function sortTable(col) {
        const tbody = document.getElementById('tbody');
        const rows = Array.from(tbody.querySelectorAll('tr'));
        rows.sort((a, b) => {
          const aVal = a.cells[col].textContent;
          const bVal = b.cells[col].textContent;
          return aVal.localeCompare(bVal, undefined, { numeric: true }) * sortDir;
        });
        sortDir *= -1;
        rows.forEach(r => tbody.appendChild(r));
      }
      document.getElementById('search').addEventListener('input', (e) => {
        const q = e.target.value.toLowerCase();
        document.querySelectorAll('#tbody tr').forEach(row => {
          const text = row.textContent.toLowerCase();
          row.style.display = text.includes(q) ? '' : 'none';
        });
      });
    </script>
  `;

  test('should render all table rows', async ({ page }) => {
    await delay(1200);
    await page.setContent(tableHtml);
    const rows = page.locator('#tbody tr');
    await expect(rows).toHaveCount(6);
  });

  test('should sort by name column', async ({ page }) => {
    await delay(1500);
    await page.setContent(tableHtml);
    await page.click('#col-name');
    const firstCell = page.locator('#tbody tr:first-child td:first-child');
    await expect(firstCell).toHaveText('Frank');
  });

  test('should sort by score column', async ({ page }) => {
    await delay(800);
    await page.setContent(tableHtml);
    await page.click('#col-score');
    const firstScore = page.locator('#tbody tr:first-child td:nth-child(2)');
    await expect(firstScore).toHaveText('95');
  });

  test('should filter rows by search input', async ({ page }) => {
    await delay(1800);
    await page.setContent(tableHtml);
    await page.fill('#search', 'passed');
    const visibleRows = page.locator('#tbody tr:not([style*="display: none"])');
    await expect(visibleRows).toHaveCount(3);
  });

  test('should clear filter and show all rows', async ({ page }) => {
    await delay(1000);
    await page.setContent(tableHtml);
    await page.fill('#search', 'alice');
    await expect(page.locator('#tbody tr:not([style*="display: none"])')).toHaveCount(1);
    await page.fill('#search', '');
    await expect(page.locator('#tbody tr:not([style*="display: none"])')).toHaveCount(6);
  });

  test('should show no rows for non-matching filter', async ({ page }) => {
    await delay(2000);
    await page.setContent(tableHtml);
    await page.fill('#search', 'nonexistent');
    const visibleRows = page.locator('#tbody tr:not([style*="display: none"])');
    await expect(visibleRows).toHaveCount(0);
  });
});
