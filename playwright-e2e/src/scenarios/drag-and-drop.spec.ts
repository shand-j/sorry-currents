import { test, expect } from '@playwright/test';

const delay = (ms: number) => new Promise(r => setTimeout(r, ms));

/**
 * Drag-and-drop and reorder tests — heavy interactions.
 * Delays: 1500-3000ms per test (~12s total file weight).
 * One of the heaviest files — should get its own shard under LPT.
 */
test.describe('Drag and Drop', () => {
  const dndHtml = `
    <style>
      .list { list-style: none; padding: 0; width: 200px; }
      .list li { padding: 10px; margin: 4px 0; background: #e3f2fd; border: 1px solid #90caf9;
        cursor: grab; user-select: none; }
      .list li.dragging { opacity: 0.5; }
      .dropzone { width: 200px; min-height: 100px; border: 2px dashed #ccc; padding: 10px;
        margin-top: 10px; }
      .dropzone.over { border-color: #4caf50; background: #e8f5e9; }
      .dropzone .dropped { padding: 5px; margin: 2px; background: #a5d6a7; }
    </style>
    <ul id="sortable" class="list">
      <li data-id="1" draggable="true">Item 1</li>
      <li data-id="2" draggable="true">Item 2</li>
      <li data-id="3" draggable="true">Item 3</li>
      <li data-id="4" draggable="true">Item 4</li>
    </ul>
    <div id="dropzone" class="dropzone">Drop here</div>
    <div id="order"></div>
    <script>
      const list = document.getElementById('sortable');
      let dragEl = null;

      list.addEventListener('dragstart', (e) => {
        dragEl = e.target;
        e.target.classList.add('dragging');
      });
      list.addEventListener('dragend', (e) => {
        e.target.classList.remove('dragging');
        updateOrder();
      });
      list.addEventListener('dragover', (e) => {
        e.preventDefault();
        const after = getDragAfterElement(list, e.clientY);
        if (after) list.insertBefore(dragEl, after);
        else list.appendChild(dragEl);
      });

      function getDragAfterElement(container, y) {
        const els = [...container.querySelectorAll('li:not(.dragging)')];
        return els.reduce((closest, child) => {
          const box = child.getBoundingClientRect();
          const offset = y - box.top - box.height / 2;
          if (offset < 0 && offset > closest.offset)
            return { offset, element: child };
          return closest;
        }, { offset: Number.NEGATIVE_INFINITY }).element;
      }

      function updateOrder() {
        const items = [...list.querySelectorAll('li')].map(li => li.dataset.id);
        document.getElementById('order').textContent = items.join(',');
      }
      updateOrder();

      const dz = document.getElementById('dropzone');
      dz.addEventListener('dragover', (e) => { e.preventDefault(); dz.classList.add('over'); });
      dz.addEventListener('dragleave', () => dz.classList.remove('over'));
      dz.addEventListener('drop', (e) => {
        e.preventDefault();
        dz.classList.remove('over');
        if (dragEl) {
          const div = document.createElement('div');
          div.className = 'dropped';
          div.textContent = dragEl.textContent;
          dz.appendChild(div);
          dragEl.remove();
          updateOrder();
        }
      });
    </script>
  `;

  test('should render sortable list', async ({ page }) => {
    await delay(2000);
    await page.setContent(dndHtml);
    await expect(page.locator('#sortable li')).toHaveCount(4);
    await expect(page.locator('#order')).toHaveText('1,2,3,4');
  });

  test('should display initial order', async ({ page }) => {
    await delay(2500);
    await page.setContent(dndHtml);
    const items = await page.locator('#sortable li').allTextContents();
    expect(items).toEqual(['Item 1', 'Item 2', 'Item 3', 'Item 4']);
  });

  test('should mark items as draggable', async ({ page }) => {
    await delay(3000);
    await page.setContent(dndHtml);
    const draggables = page.locator('#sortable li[draggable="true"]');
    await expect(draggables).toHaveCount(4);
  });

  test('should have empty dropzone initially', async ({ page }) => {
    await delay(1500);
    await page.setContent(dndHtml);
    await expect(page.locator('#dropzone')).toContainText('Drop here');
    await expect(page.locator('#dropzone .dropped')).toHaveCount(0);
  });

  test('should verify drag attributes exist', async ({ page }) => {
    await delay(2800);
    await page.setContent(dndHtml);
    for (let i = 1; i <= 4; i++) {
      await expect(page.locator(`li[data-id="${i}"]`)).toBeVisible();
    }
  });
});
