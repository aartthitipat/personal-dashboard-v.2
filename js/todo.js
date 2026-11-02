const Todo = (() => {
  const DUE_ICON = '<svg viewBox="0 0 24 24" fill="none" stroke-width="1.8" stroke="currentColor" width="12" height="12" aria-hidden="true"><rect x="3" y="5" width="18" height="16" rx="2"/><path stroke-linecap="round" d="M8 3v4M16 3v4M3 10h18"/></svg>';
  const TICK_ICON = '<svg viewBox="0 0 24 24" fill="none" stroke-width="2.8" stroke="currentColor" width="14" height="14" aria-hidden="true"><path stroke-linecap="round" stroke-linejoin="round" d="M5 13l4 4L19 7"/></svg>';
  const EDIT_ICON = '<svg viewBox="0 0 24 24" fill="none" stroke-width="1.8" stroke="currentColor" width="14" height="14" aria-hidden="true"><path stroke-linecap="round" stroke-linejoin="round" d="M4 20h4l10.5-10.5a2.1 2.1 0 00-3-3L5 17v3z"/></svg>';
  const LIST_ICON = '<rect x="3" y="3" width="18" height="18" rx="2"/><path d="M9 7l2 2 4-4M9 14l2 2 4-4"/>';
  const CHECK_ICON = '<circle cx="12" cy="12" r="9"/><path d="M8.5 12.5l2.5 2.5 4.5-5"/>';

  const pageEl = document.getElementById('page-todo');
  const addWrap = document.getElementById('td-add-wrap');
  const form = document.getElementById('td-form');
  const listEl = document.getElementById('td-list');
  const filtersEl = document.getElementById('td-filters');
  const toggleBtn = document.getElementById('td-toggle-add');
  const categoryFilter = document.getElementById('td-category-filter');
  const categoryList = document.getElementById('td-category-list');
  const titleInput = document.getElementById('td-title');
  const notesInput = document.getElementById('td-notes');
  const priorityInput = document.getElementById('td-priority');
  const dueInput = document.getElementById('td-due');
  const categoryInput = document.getElementById('td-category');
  const submitBtn = document.getElementById('td-submit');
  const cancelBtn = document.getElementById('td-cancel');
  const formTitle = document.getElementById('td-form-title');

  let todos = [];
  let currentFilter = 'all';
  let currentCategory = '';
  let editingId = null;

  function setFormOpen(open) {
    App.setDisclosure(addWrap, toggleBtn, open, open);
  }

  function resetForm() {
    editingId = null;
    form.reset();
    formTitle.textContent = 'New task';
    submitBtn.textContent = 'Add Task';
    cancelBtn.hidden = true;
  }

  function startEdit(id) {
    const t = todos.find((x) => x.id === id);
    if (!t) return;
    editingId = id;
    titleInput.value = t.title;
    notesInput.value = t.notes || '';
    priorityInput.value = t.priority;
    dueInput.value = t.due_date || '';
    categoryInput.value = t.category || '';
    formTitle.textContent = 'Edit task';
    submitBtn.textContent = 'Save Changes';
    cancelBtn.hidden = false;
    setFormOpen(true);
    titleInput.focus();
  }

  toggleBtn.addEventListener('click', () => {
    const open = !addWrap.classList.contains('open');
    if (!open) resetForm();
    setFormOpen(open);
  });

  cancelBtn.addEventListener('click', () => {
    resetForm();
    setFormOpen(false);
    toggleBtn.focus();
  });

  function setFilter(name) {
    currentFilter = name;
    filtersEl.querySelectorAll('.cl-filter').forEach((b) => {
      const on = b.dataset.filter === name;
      b.classList.toggle('active', on);
      b.setAttribute('aria-pressed', String(on));
    });
    render({ animate: true });
  }

  filtersEl.addEventListener('click', (e) => {
    const btn = e.target.closest('.cl-filter');
    if (btn) setFilter(btn.dataset.filter);
  });

  categoryFilter.addEventListener('change', () => {
    currentCategory = categoryFilter.value;
    render({ animate: true });
  });

  form.addEventListener('submit', async (e) => {
    e.preventDefault();
    const title = titleInput.value.trim();
    if (!title) return;
    const payload = {
      title,
      notes: notesInput.value.trim() || null,
      category: categoryInput.value.trim() || null,
      priority: priorityInput.value,
      due_date: dueInput.value || null,
    };
    const query = editingId == null
      ? sb.from('todos').insert({ ...payload, done: false })
      : sb.from('todos').update(payload).eq('id', editingId);
    const { error } = await query;
    if (error) return ui.alert(error.message, { title: 'Something went wrong' });
    const wasEditing = editingId != null;
    resetForm();
    if (wasEditing) {
      setFormOpen(false);
      toggleBtn.focus();
    } else {
      titleInput.focus();
    }
    load();
  });

  document.getElementById('td-clear-done').addEventListener('click', async () => {
    const done = todos.filter((t) => t.done);
    if (!done.length) return;
    if (!await ui.confirm(`Delete ${done.length} completed task(s)?`, { title: 'Clear completed tasks', confirmLabel: 'Delete', danger: true })) return;
    const { error } = await sb.from('todos').delete().in('id', done.map((t) => t.id));
    if (error) return ui.alert(error.message, { title: 'Something went wrong' });
    load();
  });

  async function toggleDone(id, done) {
    const task = todos.find((t) => t.id === id);
    if (task) task.done = done;
    render({ focusId: id });
    const { error } = await sb.from('todos').update({ done }).eq('id', id);
    if (error) {
      if (task) task.done = !done;
      render({ focusId: id });
      ui.toast(error.message, { kind: 'error' });
    }
  }

  async function deleteTodo(id) {
    const t = todos.find((x) => x.id === id);
    if (!t) return;
    if (!await ui.confirm(`Delete "${t.title}"?`, { title: 'Delete task', confirmLabel: 'Delete', danger: true })) return;
    const el = listEl.querySelector(`.cl-item[data-id="${id}"]`);
    if (el) {
      el.classList.add('cl-removing');
      await new Promise((r) => setTimeout(r, 200));
    }
    const { error } = await sb.from('todos').delete().eq('id', id);
    if (error) {
      if (el) el.classList.remove('cl-removing');
      return ui.alert(error.message, { title: 'Something went wrong' });
    }
    if (editingId === id) {
      resetForm();
      setFormOpen(false);
    }
    load();
  }

  function priorityLabel(p) {
    return { high: 'High', medium: 'Medium', low: 'Low' }[p] || 'Medium';
  }

  function priorityClass(p) {
    return { high: 'cl-priority-high', medium: 'cl-priority-medium', low: 'cl-priority-low' }[p] || 'cl-priority-medium';
  }

  function startOfToday() {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    return today;
  }

  function formatDue(dateStr) {
    if (!dateStr) return '';
    const d = new Date(dateStr + 'T00:00:00');
    const diff = Math.round((d - startOfToday()) / 86400000);
    if (diff < 0) return `Overdue ${Math.abs(diff)}d`;
    if (diff === 0) return 'Due today';
    if (diff === 1) return 'Tomorrow';
    if (diff <= 7) return `${diff} days`;
    return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
  }

  function isOverdue(dateStr) {
    return !!dateStr && new Date(dateStr + 'T00:00:00') < startOfToday();
  }

  function updateCounts() {
    const done = todos.filter((t) => t.done).length;
    document.getElementById('td-count-all').textContent = todos.length;
    document.getElementById('td-count-active').textContent = todos.length - done;
    document.getElementById('td-count-done').textContent = done;
  }

  function updateCategories() {
    const names = [...new Set(todos.map((t) => t.category).filter(Boolean))].sort((a, b) => a.localeCompare(b));
    categoryList.innerHTML = names.map((n) => `<option value="${App.escapeHtml(n)}"></option>`).join('');
    if (currentCategory && !names.includes(currentCategory)) currentCategory = '';
    categoryFilter.innerHTML = '<option value="">All categories</option>'
      + names.map((n) => `<option value="${App.escapeHtml(n)}">${App.escapeHtml(n)}</option>`).join('');
    categoryFilter.value = currentCategory;
    categoryFilter.hidden = !names.length;
  }

  function renderEmpty() {
    const config = {
      all: [LIST_ICON, 'No tasks yet', 'Add your first task to start tracking what needs doing.', 'New task'],
      active: [CHECK_ICON, 'Nothing left to do', 'Every task is done. Add a new one when something comes up.', 'Show all tasks'],
      done: [CHECK_ICON, 'No completed tasks', 'Tasks you tick off will collect here.', 'Show all tasks'],
    }[currentFilter];
    listEl.innerHTML = App.emptyState(...config);
    listEl.querySelector('[data-empty-action]').addEventListener('click', () => {
      if (currentFilter === 'all' && !currentCategory) {
        setFormOpen(true);
      } else {
        currentCategory = '';
        categoryFilter.value = '';
        setFilter('all');
      }
    });
  }

  function render(opts = {}) {
    const { animate = false, focusId = null } = opts;
    updateCounts();
    const filtered = todos.filter((t) => {
      if (currentFilter === 'active' && t.done) return false;
      if (currentFilter === 'done' && !t.done) return false;
      if (currentCategory && t.category !== currentCategory) return false;
      return true;
    });

    if (!filtered.length) {
      renderEmpty();
      return;
    }

    listEl.innerHTML = filtered.map((t, i) => {
      const dueText = formatDue(t.due_date);
      const overdue = !t.done && isOverdue(t.due_date);
      const title = App.escapeHtml(t.title);
      return `
        <div class="cl-item ${t.done ? 'cl-done' : ''} ${animate ? 'cl-enter' : ''}" data-id="${t.id}" style="--i:${Math.min(i, 12)}">
          <button type="button" class="cl-checkbox ${t.done ? 'checked' : ''}" data-action="toggle" role="checkbox" aria-checked="${t.done}" aria-label="${title}">${t.done ? TICK_ICON : ''}</button>
          <div class="cl-item-body">
            <p class="cl-item-title">${title}</p>
            ${t.notes ? `<p class="td-notes">${App.escapeHtml(t.notes)}</p>` : ''}
            <div class="cl-item-meta">
              <span class="cl-priority-pill ${priorityClass(t.priority)}">${priorityLabel(t.priority)}</span>
              ${t.category ? `<span class="td-category">${App.escapeHtml(t.category)}</span>` : ''}
              ${dueText ? `<span class="cl-due ${overdue ? 'cl-overdue' : ''}">${DUE_ICON} ${dueText}</span>` : ''}
            </div>
          </div>
          <div class="td-actions">
            <button type="button" class="cl-delete td-edit" data-action="edit" aria-label="Edit ${title}">${EDIT_ICON}</button>
            <button type="button" class="cl-delete" data-action="delete" aria-label="Delete ${title}">&#10005;</button>
          </div>
        </div>
      `;
    }).join('');

    listEl.querySelectorAll('.cl-item').forEach((item) => {
      const id = Number(item.dataset.id);
      const t = todos.find((x) => x.id === id);
      if (!t) return;
      item.querySelector('[data-action="toggle"]').addEventListener('click', () => toggleDone(id, !t.done));
      item.querySelector('[data-action="edit"]').addEventListener('click', () => startEdit(id));
      item.querySelector('[data-action="delete"]').addEventListener('click', () => deleteTodo(id));
    });

    if (focusId != null) {
      const again = listEl.querySelector(`.cl-item[data-id="${focusId}"] [data-action="toggle"]`);
      if (again) again.focus({ preventScroll: true });
    }
  }

  async function load() {
    pageEl.setAttribute('aria-busy', 'true');
    try {
      const { data, error } = await sb
        .from('todos')
        .select('id, title, notes, category, priority, due_date, done, created_at')
        .order('done')
        .order('due_date', { ascending: true, nullsFirst: false })
        .order('created_at', { ascending: false });
      if (error) throw error;
      todos = data || [];
      updateCategories();
      render({ animate: true });
    } catch (err) {
      ui.alert(err.message, { title: 'Something went wrong' });
    } finally {
      pageEl.removeAttribute('aria-busy');
    }
  }

  return { load };
})();
