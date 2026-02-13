import { test, expect } from '@playwright/test';

const delay = (ms: number) => new Promise(r => setTimeout(r, ms));

/**
 * Search and filter tests — typeahead, live filtering, multi-filter, reset.
 * Delays: 1000-2500ms per test (~11s total file weight).
 */
test.describe('Search and Filter', () => {
  const searchHtml = `
    <style>
      .search-box { padding: 10px; display: flex; gap: 10px; flex-wrap: wrap; align-items: center; }
      .search-box input { padding: 8px 12px; border: 1px solid #ddd; border-radius: 4px; width: 250px; }
      .filters { display: flex; gap: 8px; }
      .filters button { padding: 6px 12px; border: 1px solid #ddd; border-radius: 20px; cursor: pointer; background: white; }
      .filters button.active { background: #2196f3; color: white; border-color: #2196f3; }
      .results { padding: 10px; }
      .result-item { padding: 12px; border-bottom: 1px solid #eee; display: flex; justify-content: space-between; }
      .result-item .title { font-weight: bold; }
      .result-item .category { color: #666; font-size: 14px; }
      .no-results { padding: 20px; text-align: center; color: #999; }
      .result-count { padding: 5px 10px; color: #666; font-size: 14px; }
      .suggestions { border: 1px solid #ddd; border-top: none; max-height: 150px; overflow-y: auto; display: none; }
      .suggestions div { padding: 8px 12px; cursor: pointer; }
      .suggestions div:hover { background: #f0f0f0; }
    </style>
    <div class="search-box">
      <div style="position:relative;">
        <input id="search" type="text" placeholder="Search items..." oninput="filterItems()" />
        <div class="suggestions" id="suggestions"></div>
      </div>
      <div class="filters">
        <button class="active" data-filter="all" onclick="toggleFilter(this)">All</button>
        <button data-filter="frontend" onclick="toggleFilter(this)">Frontend</button>
        <button data-filter="backend" onclick="toggleFilter(this)">Backend</button>
        <button data-filter="devops" onclick="toggleFilter(this)">DevOps</button>
      </div>
      <button id="reset" onclick="resetFilters()">Reset</button>
    </div>
    <div class="result-count" id="count"></div>
    <div class="results" id="results"></div>
    <script>
      var items = [
        { title: 'React Components', category: 'frontend' },
        { title: 'Vue Directives', category: 'frontend' },
        { title: 'Angular Services', category: 'frontend' },
        { title: 'Node.js API', category: 'backend' },
        { title: 'Express Middleware', category: 'backend' },
        { title: 'PostgreSQL Queries', category: 'backend' },
        { title: 'Docker Containers', category: 'devops' },
        { title: 'CI/CD Pipelines', category: 'devops' },
        { title: 'Kubernetes Pods', category: 'devops' },
        { title: 'React Hooks', category: 'frontend' },
        { title: 'GraphQL Resolvers', category: 'backend' },
        { title: 'Terraform Modules', category: 'devops' },
      ];
      var activeFilter = 'all';

      function renderItems(filtered) {
        var container = document.getElementById('results');
        document.getElementById('count').textContent = filtered.length + ' results';
        if (filtered.length === 0) {
          container.innerHTML = '<div class="no-results">No results found</div>';
          return;
        }
        container.innerHTML = filtered.map(function(item) {
          return '<div class="result-item"><span class="title">' + item.title + '</span><span class="category">' + item.category + '</span></div>';
        }).join('');
      }

      function filterItems() {
        var query = document.getElementById('search').value.toLowerCase();
        var filtered = items.filter(function(item) {
          var matchesSearch = !query || item.title.toLowerCase().includes(query);
          var matchesFilter = activeFilter === 'all' || item.category === activeFilter;
          return matchesSearch && matchesFilter;
        });
        renderItems(filtered);

        // Suggestions
        var sug = document.getElementById('suggestions');
        if (query.length >= 2) {
          var matches = items.filter(function(i) { return i.title.toLowerCase().includes(query); }).slice(0, 5);
          sug.innerHTML = matches.map(function(m) { return '<div onclick="selectSuggestion(\\''+m.title+'\\')">'+m.title+'</div>'; }).join('');
          sug.style.display = matches.length ? 'block' : 'none';
        } else {
          sug.style.display = 'none';
        }
      }

      function selectSuggestion(title) {
        document.getElementById('search').value = title;
        document.getElementById('suggestions').style.display = 'none';
        filterItems();
      }

      function toggleFilter(btn) {
        document.querySelectorAll('.filters button').forEach(function(b) { b.classList.remove('active'); });
        btn.classList.add('active');
        activeFilter = btn.dataset.filter;
        filterItems();
      }

      function resetFilters() {
        document.getElementById('search').value = '';
        activeFilter = 'all';
        document.querySelectorAll('.filters button').forEach(function(b) { b.classList.remove('active'); });
        document.querySelector('.filters button[data-filter="all"]').classList.add('active');
        filterItems();
      }

      renderItems(items);
    </script>
  `;

  test('should display all items initially', async ({ page }) => {
    await delay(1000);
    await page.setContent(searchHtml);
    await expect(page.locator('.result-item')).toHaveCount(12);
    await expect(page.locator('#count')).toContainText('12 results');
  });

  test('should filter by search text', async ({ page }) => {
    await delay(2000);
    await page.setContent(searchHtml);
    await page.fill('#search', 'react');
    await page.dispatchEvent('#search', 'input');
    await expect(page.locator('.result-item')).toHaveCount(2);
    await expect(page.locator('#count')).toContainText('2 results');
  });

  test('should filter by category', async ({ page }) => {
    await delay(2500);
    await page.setContent(searchHtml);
    await page.click('.filters button[data-filter="devops"]');
    await expect(page.locator('.result-item')).toHaveCount(3);
    const categories = page.locator('.result-item .category');
    for (let i = 0; i < 3; i++) {
      await expect(categories.nth(i)).toHaveText('devops');
    }
  });

  test('should show no results message', async ({ page }) => {
    await delay(1500);
    await page.setContent(searchHtml);
    await page.fill('#search', 'zzzznonexistent');
    await page.dispatchEvent('#search', 'input');
    await expect(page.locator('.no-results')).toBeVisible();
    await expect(page.locator('.no-results')).toHaveText('No results found');
  });

  test('should reset filters', async ({ page }) => {
    await delay(2000);
    await page.setContent(searchHtml);
    await page.click('.filters button[data-filter="frontend"]');
    await expect(page.locator('.result-item')).toHaveCount(4);
    await page.click('#reset');
    await expect(page.locator('.result-item')).toHaveCount(12);
    await expect(page.locator('.filters button[data-filter="all"]')).toHaveClass(/active/);
  });

  test('should combine search and category filter', async ({ page }) => {
    await delay(2200);
    await page.setContent(searchHtml);
    await page.click('.filters button[data-filter="backend"]');
    await page.fill('#search', 'graph');
    await page.dispatchEvent('#search', 'input');
    await expect(page.locator('.result-item')).toHaveCount(1);
    await expect(page.locator('.result-item .title')).toHaveText('GraphQL Resolvers');
  });
});
