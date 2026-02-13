import { test, expect } from '@playwright/test';

/**
 * Interactive todo app tests using an inline mini-app.
 * Exercises complex DOM manipulation, event handling, and state assertions.
 */

const TODO_APP_HTML = `
<!DOCTYPE html>
<html>
<body>
  <h1>Todo App</h1>
  <input id="newTodo" type="text" placeholder="Add a todo..." />
  <button id="addBtn" onclick="addTodo()">Add</button>
  <div id="filter">
    <button onclick="filterTodos('all')" class="filter active" data-filter="all">All</button>
    <button onclick="filterTodos('active')" class="filter" data-filter="active">Active</button>
    <button onclick="filterTodos('completed')" class="filter" data-filter="completed">Completed</button>
  </div>
  <ul id="todoList"></ul>
  <div id="count">0 items left</div>
  <script>
    let currentFilter = 'all';

    function addTodo() {
      const input = document.getElementById('newTodo');
      const text = input.value.trim();
      if (!text) return;

      const li = document.createElement('li');
      li.className = 'todo-item';
      li.innerHTML =
        '<input type="checkbox" class="toggle" onchange="toggleTodo(this)" />' +
        '<span class="text">' + text + '</span>' +
        '<button class="delete" onclick="deleteTodo(this)">X</button>';
      document.getElementById('todoList').appendChild(li);
      input.value = '';
      updateCount();
      applyFilter();
    }

    function toggleTodo(checkbox) {
      const li = checkbox.closest('li');
      li.classList.toggle('completed', checkbox.checked);
      updateCount();
      applyFilter();
    }

    function deleteTodo(btn) {
      btn.closest('li').remove();
      updateCount();
      applyFilter();
    }

    function filterTodos(filter) {
      currentFilter = filter;
      document.querySelectorAll('.filter').forEach(b => b.classList.remove('active'));
      document.querySelector('[data-filter="' + filter + '"]').classList.add('active');
      applyFilter();
    }

    function applyFilter() {
      document.querySelectorAll('.todo-item').forEach(li => {
        const isCompleted = li.classList.contains('completed');
        if (currentFilter === 'all') li.style.display = '';
        else if (currentFilter === 'active') li.style.display = isCompleted ? 'none' : '';
        else li.style.display = isCompleted ? '' : 'none';
      });
    }

    function updateCount() {
      const active = document.querySelectorAll('.todo-item:not(.completed)').length;
      document.getElementById('count').textContent = active + ' item' + (active !== 1 ? 's' : '') + ' left';
    }
  </script>
</body>
</html>`;

test.describe('Todo App', () => {
  test.beforeEach(async ({ page }) => {
    await page.setContent(TODO_APP_HTML);
  });

  test('should add a todo item', async ({ page }) => {
    await page.fill('#newTodo', 'Write tests');
    await page.click('#addBtn');

    const items = page.locator('.todo-item');
    await expect(items).toHaveCount(1);
    await expect(items.first().locator('.text')).toHaveText('Write tests');
    await expect(page.locator('#count')).toHaveText('1 item left');
  });

  test('should add multiple todo items', async ({ page }) => {
    const todos = ['Write tests', 'Fix bugs', 'Deploy'];
    for (const todo of todos) {
      await page.fill('#newTodo', todo);
      await page.click('#addBtn');
    }

    await expect(page.locator('.todo-item')).toHaveCount(3);
    await expect(page.locator('#count')).toHaveText('3 items left');
  });

  test('should not add empty todo', async ({ page }) => {
    await page.fill('#newTodo', '   ');
    await page.click('#addBtn');

    await expect(page.locator('.todo-item')).toHaveCount(0);
  });

  test('should mark todo as complete', async ({ page }) => {
    await page.fill('#newTodo', 'Review PR');
    await page.click('#addBtn');

    await page.check('.todo-item .toggle');

    await expect(page.locator('.todo-item')).toHaveClass(['todo-item completed']);
    await expect(page.locator('#count')).toHaveText('0 items left');
  });

  test('should delete a todo item', async ({ page }) => {
    await page.fill('#newTodo', 'Temporary task');
    await page.click('#addBtn');
    await expect(page.locator('.todo-item')).toHaveCount(1);

    await page.click('.delete');
    await expect(page.locator('.todo-item')).toHaveCount(0);
    await expect(page.locator('#count')).toHaveText('0 items left');
  });

  test('should filter active todos', async ({ page }) => {
    await page.fill('#newTodo', 'Active task');
    await page.click('#addBtn');
    await page.fill('#newTodo', 'Done task');
    await page.click('#addBtn');

    // Complete the second item
    await page.locator('.todo-item').nth(1).locator('.toggle').check();

    // Filter to active only
    await page.click('[data-filter="active"]');

    const visibleItems = page.locator('.todo-item:visible');
    await expect(visibleItems).toHaveCount(1);
    await expect(visibleItems.first().locator('.text')).toHaveText('Active task');
  });

  test('should filter completed todos', async ({ page }) => {
    await page.fill('#newTodo', 'Pending');
    await page.click('#addBtn');
    await page.fill('#newTodo', 'Finished');
    await page.click('#addBtn');

    await page.locator('.todo-item').nth(1).locator('.toggle').check();

    await page.click('[data-filter="completed"]');

    const visibleItems = page.locator('.todo-item:visible');
    await expect(visibleItems).toHaveCount(1);
    await expect(visibleItems.first().locator('.text')).toHaveText('Finished');
  });
});
