const Checklist = (() => {
  const CIRCUMFERENCE = 2 * Math.PI * 34;
  const DUE_ICON = '<svg viewBox="0 0 24 24" fill="none" stroke-width="1.8" stroke="currentColor" width="12" height="12" aria-hidden="true"><rect x="3" y="5" width="18" height="16" rx="2"/><path stroke-linecap="round" d="M8 3v4M16 3v4M3 10h18"/></svg>';
  const TICK_ICON = '<svg viewBox="0 0 24 24" fill="none" stroke-width="2.8" stroke="currentColor" width="14" height="14" aria-hidden="true"><path stroke-linecap="round" stroke-linejoin="round" d="M5 13l4 4L19 7"/></svg>';
  const LIST_ICON = '<rect x="3" y="3" width="18" height="18" rx="2"/><path d="M9 7l2 2 4-4M9 14l2 2 4-4"/>';
  const CHECK_ICON = '<circle cx="12" cy="12" r="9"/><path d="M8.5 12.5l2.5 2.5 4.5-5"/>';

  const pageEl = document.getElementById('page-checklist');
  const addWrap = document.getElementById('cl-add-wrap');
  const addForm = document.getElementById('cl-add-form');
  const listEl = document.getElementById('cl-list');
  const filtersEl = document.getElementById('cl-filters');
  const ringFill = document.getElementById('cl-ring-fill');
  const ringPct = document.getElementById('cl-ring-pct');
  const ringDetail = document.getElementById('cl-ring-detail');
  const toggleBtn = document.getElementById('cl-toggle-add');

  let tasks = [];
  let currentFilter = 'all';

  function setFormOpen(open) {
    App.setDisclosure(addWrap, toggleBtn, open, open);
  }

  toggleBtn.addEventListener('click', () => {
    setFormOpen(!addWrap.classList.contains('open'));
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
    if (!btn) return;
    setFilter(btn.dataset.filter);
  });

  document.getElementById('cl-clear-done').addEventListener('click', async () => {
    const done = tasks.filter((t) => t.done);
    if (!done.length) return;
    if (!await ui.confirm(`Delete ${done.length} completed task(s)?`, { title: 'Clear completed tasks', confirmLabel: 'Delete', danger: true })) return;

    const items = listEl.querySelectorAll('.cl-item.cl-done');
    items.forEach((el, i) => {
      el.style.animationDelay = `${i * 0.05}s`;
      el.classList.add('cl-removing');
    });

    await new Promise((r) => setTimeout(r, 250 + items.length * 50));
    const ids = done.map((t) => t.id);
    const { error } = await sb.from('checklist').delete().in('id', ids);
    if (error) return ui.alert(error.message, { title: 'Something went wrong' });
    load();
  });

  addForm.addEventListener('submit', async (e) => {
    e.preventDefault();
    const title = document.getElementById('cl-task-title').value.trim();
    if (!title) return;
    const payload = {
      title,
      priority: document.getElementById('cl-task-priority').value,
      due_date: document.getElementById('cl-task-due').value || null,
      done: false,
      position: tasks.length,
    };
    const { error } = await sb.from('checklist').insert(payload);
    if (error) return ui.alert(error.message, { title: 'Something went wrong' });
    addForm.reset();
    document.getElementById('cl-task-title').focus();
    load();
  });

  async function toggleDone(id, done) {
    const task = tasks.find((t) => t.id === id);
    if (task) task.done = done;
    render({ focusId: id });

    const { error } = await sb.from('checklist').update({ done }).eq('id', id);
    if (error) {
      if (task) task.done = !done;
      render({ focusId: id });
      ui.toast(error.message, { kind: 'error' });
    }
  }

  async function deleteTask(id) {
    const el = listEl.querySelector(`.cl-item[data-id="${id}"]`);
    if (el) {
      el.classList.add('cl-removing');
      await new Promise((r) => setTimeout(r, 200));
    }
    const { error } = await sb.from('checklist').delete().eq('id', id);
    if (error) {
      if (el) el.classList.remove('cl-removing');
      return ui.alert(error.message, { title: 'Something went wrong' });
    }
    load();
  }

  function priorityLabel(p) {
    return { high: 'High', medium: 'Medium', low: 'Low' }[p] || 'Medium';
  }

  function priorityClass(p) {
    return { high: 'cl-priority-high', medium: 'cl-priority-medium', low: 'cl-priority-low' }[p] || 'cl-priority-medium';
  }

  function formatDue(dateStr) {
    if (!dateStr) return '';
    const d = new Date(dateStr + 'T00:00:00');
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const diff = Math.round((d - today) / 86400000);
    if (diff < 0) return `Overdue ${Math.abs(diff)}d`;
    if (diff === 0) return 'Due today';
    if (diff === 1) return 'Tomorrow';
    if (diff <= 7) return `${diff} days`;
    return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
  }

  function isDueOverdue(dateStr) {
    if (!dateStr) return false;
    const d = new Date(dateStr + 'T00:00:00');
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    return d < today;
  }

  function updateRing(total, done) {
    const pct = total ? Math.round((done / total) * 100) : 0;
    const offset = CIRCUMFERENCE - (pct / 100) * CIRCUMFERENCE;
    ringFill.style.strokeDashoffset = offset;
    ringPct.textContent = `${pct}%`;
    ringDetail.textContent = `${done} of ${total} task${total !== 1 ? 's' : ''} done`;

    const active = total - done;
    document.getElementById('cl-count-all').textContent = total;
    document.getElementById('cl-count-active').textContent = active;
    document.getElementById('cl-count-done').textContent = done;
  }

  function renderEmpty() {
    const config = {
      all: [LIST_ICON, 'No tasks yet', 'Add your first task to start tracking what needs doing.', 'New task'],
      active: [CHECK_ICON, 'Nothing left to do', 'Every task is done. Add a new one when something comes up.', 'Show all tasks'],
      done: [CHECK_ICON, 'No completed tasks', 'Tasks you tick off will collect here.', 'Show all tasks'],
    }[currentFilter];
    listEl.innerHTML = App.emptyState(...config);
    listEl.querySelector('[data-empty-action]').addEventListener('click', () => {
      if (currentFilter === 'all') {
        setFormOpen(true);
      } else {
        setFilter('all');
      }
    });
  }

  function render(opts = {}) {
    const { animate = false, focusId = null } = opts;
    const filtered = tasks.filter((t) => {
      if (currentFilter === 'active') return !t.done;
      if (currentFilter === 'done') return t.done;
      return true;
    });

    const total = tasks.length;
    const done = tasks.filter((t) => t.done).length;
    updateRing(total, done);

    if (!filtered.length) {
      renderEmpty();
      return;
    }

    listEl.innerHTML = filtered.map((t, i) => {
      const dueText = formatDue(t.due_date);
      const overdue = !t.done && isDueOverdue(t.due_date);
      return `
        <div class="cl-item ${t.done ? 'cl-done' : ''} ${animate ? 'cl-enter' : ''}" data-id="${t.id}" style="--i:${Math.min(i, 12)}">
          <button type="button" class="cl-checkbox ${t.done ? 'checked' : ''}" data-action="toggle" role="checkbox" aria-checked="${t.done}" aria-label="${App.escapeHtml(t.title)}">${t.done ? TICK_ICON : ''}</button>
          <div class="cl-item-body">
            <p class="cl-item-title">${App.escapeHtml(t.title)}</p>
            <div class="cl-item-meta">
              <span class="cl-priority-pill ${priorityClass(t.priority)}">${priorityLabel(t.priority)}</span>
              ${dueText ? `<span class="cl-due ${overdue ? 'cl-overdue' : ''}">${DUE_ICON} ${dueText}</span>` : ''}
            </div>
          </div>
          <button type="button" class="cl-delete" data-action="delete" aria-label="Delete ${App.escapeHtml(t.title)}">&#10005;</button>
        </div>
      `;
    }).join('');

    listEl.querySelectorAll('[data-action="toggle"]').forEach((btn) => {
      const item = btn.closest('.cl-item');
      const t = tasks.find((x) => String(x.id) === item.dataset.id);
      if (t) btn.addEventListener('click', () => toggleDone(t.id, !t.done));
    });

    listEl.querySelectorAll('[data-action="delete"]').forEach((btn) => {
      const item = btn.closest('.cl-item');
      const t = tasks.find((x) => String(x.id) === item.dataset.id);
      if (t) btn.addEventListener('click', () => deleteTask(t.id));
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
        .from('checklist')
        .select('id, title, priority, due_date, done, position, created_at')
        .order('done')
        .order('position')
        .order('created_at', { ascending: false });
      if (error) throw error;
      tasks = data || [];
      render({ animate: true });
    } catch (err) {
      ui.alert(err.message, { title: 'Something went wrong' });
    } finally {
      pageEl.removeAttribute('aria-busy');
    }
  }

  return { load };
})();
