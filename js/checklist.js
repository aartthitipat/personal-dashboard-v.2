const Checklist = (() => {
  const CIRCUMFERENCE = 2 * Math.PI * 34; // matches SVG circle r=34

  const pageEl = document.getElementById('page-checklist');
  const addWrap = document.getElementById('cl-add-wrap');
  const addForm = document.getElementById('cl-add-form');
  const listEl = document.getElementById('cl-list');
  const filtersEl = document.getElementById('cl-filters');
  const ringFill = document.getElementById('cl-ring-fill');
  const ringPct = document.getElementById('cl-ring-pct');
  const ringDetail = document.getElementById('cl-ring-detail');

  let tasks = [];
  let currentFilter = 'all';
  let formOpen = false;

  // --- Toggle add-form (slide animation via CSS grid-template-rows) ---

  const toggleBtn = document.getElementById('cl-toggle-add');
  toggleBtn.addEventListener('click', () => {
    formOpen = !formOpen;
    addWrap.classList.toggle('open', formOpen);
    toggleBtn.querySelector('svg').style.transform = formOpen ? 'rotate(45deg)' : '';
    toggleBtn.querySelector('svg').style.transition = 'transform 0.3s cubic-bezier(0.4, 0, 0.2, 1)';
    if (formOpen) {
      setTimeout(() => document.getElementById('cl-task-title').focus(), 300);
    }
  });

  // --- Filter buttons ---

  filtersEl.addEventListener('click', (e) => {
    const btn = e.target.closest('.cl-filter');
    if (!btn) return;
    currentFilter = btn.dataset.filter;
    filtersEl.querySelectorAll('.cl-filter').forEach((b) => b.classList.toggle('active', b === btn));
    render();
  });

  // --- Clear completed (with animation) ---

  document.getElementById('cl-clear-done').addEventListener('click', async () => {
    const done = tasks.filter((t) => t.done);
    if (!done.length) return;
    if (!confirm(`Delete ${done.length} completed task(s)?`)) return;

    // Animate out visually first
    const items = listEl.querySelectorAll('.cl-item.cl-done');
    items.forEach((el, i) => {
      el.style.animationDelay = `${i * 0.05}s`;
      el.classList.add('cl-removing');
    });

    // Wait for animation then delete
    await new Promise((r) => setTimeout(r, 350 + items.length * 50));
    const ids = done.map((t) => t.id);
    const { error } = await sb.from('checklist').delete().in('id', ids);
    if (error) return alert(error.message);
    load();
  });

  // --- Add task ---

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
    if (error) return alert(error.message);
    addForm.reset();
    load();
  });

  // --- Toggle done (with optimistic UI) ---

  async function toggleDone(id, done) {
    // Optimistic: update local immediately for snappy feel
    const task = tasks.find((t) => t.id === id);
    if (task) task.done = done;
    render();

    const { error } = await sb.from('checklist').update({ done }).eq('id', id);
    if (error) {
      alert(error.message);
      // Revert on error
      if (task) task.done = !done;
      render();
    }
  }

  // --- Delete task (with animation) ---

  async function deleteTask(id) {
    const el = listEl.querySelector(`.cl-item[data-id="${id}"]`);
    if (el) {
      el.classList.add('cl-removing');
      await new Promise((r) => setTimeout(r, 300));
    }
    const { error } = await sb.from('checklist').delete().eq('id', id);
    if (error) return alert(error.message);
    load();
  }

  // --- Helpers ---

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

  // --- Update progress ring ---

  function updateRing(total, done) {
    const pct = total ? Math.round((done / total) * 100) : 0;
    const offset = CIRCUMFERENCE - (pct / 100) * CIRCUMFERENCE;
    ringFill.style.strokeDashoffset = offset;
    ringPct.textContent = `${pct}%`;
    ringDetail.textContent = `${done} of ${total} task${total !== 1 ? 's' : ''} done`;

    // Update filter counts
    const active = total - done;
    document.getElementById('cl-count-all').textContent = total;
    document.getElementById('cl-count-active').textContent = active;
    document.getElementById('cl-count-done').textContent = done;
  }

  // --- Render ---

  function render() {
    const filtered = tasks.filter((t) => {
      if (currentFilter === 'active') return !t.done;
      if (currentFilter === 'done') return t.done;
      return true;
    });

    // Update ring + counts
    const total = tasks.length;
    const done = tasks.filter((t) => t.done).length;
    updateRing(total, done);

    // Empty state
    if (!filtered.length) {
      const icon = currentFilter === 'active'
        ? '<svg viewBox="0 0 24 24" fill="none" stroke-width="1.5" stroke="currentColor" width="40" height="40"><path stroke-linecap="round" stroke-linejoin="round" d="M9 12.75L11.25 15 15 9.75M21 12a9 9 0 11-18 0 9 9 0 0118 0z"/></svg>'
        : '<svg viewBox="0 0 24 24" fill="none" stroke-width="1.5" stroke="currentColor" width="40" height="40"><rect x="3" y="3" width="18" height="18" rx="2"/><path stroke-linecap="round" stroke-linejoin="round" d="M9 7l2 2 4-4M9 14l2 2 4-4"/></svg>';
      const msg = currentFilter === 'done' ? 'No completed tasks yet.'
        : currentFilter === 'active' ? 'All tasks done! Great job! 🎉'
        : 'No tasks yet — tap "New Task" to get started.';
      listEl.innerHTML = `<div class="cl-empty">${icon}<p>${msg}</p></div>`;
      return;
    }

    // Task items with stagger delay
    listEl.innerHTML = filtered.map((t, i) => {
      const dueText = formatDue(t.due_date);
      const overdue = !t.done && isDueOverdue(t.due_date);
      const delay = `animation-delay: ${i * 0.04}s`;
      const dueIcon = '<svg viewBox="0 0 24 24" fill="none" stroke-width="1.8" stroke="currentColor" width="12" height="12"><rect x="3" y="5" width="18" height="16" rx="2"/><path stroke-linecap="round" d="M8 3v4M16 3v4M3 10h18"/></svg>';
      return `
        <div class="cl-item ${t.done ? 'cl-done' : ''}" data-id="${t.id}" style="${delay}">
          <button class="cl-checkbox ${t.done ? 'checked' : ''}" data-action="toggle" aria-label="${t.done ? 'Mark incomplete' : 'Mark complete'}">
            ${t.done ? '<svg viewBox="0 0 24 24" fill="none" stroke-width="2.8" stroke="currentColor" width="14" height="14"><path stroke-linecap="round" stroke-linejoin="round" d="M5 13l4 4L19 7"/></svg>' : ''}
          </button>
          <div class="cl-item-body">
            <p class="cl-item-title">${App.escapeHtml(t.title)}</p>
            <div class="cl-item-meta">
              <span class="cl-priority-pill ${priorityClass(t.priority)}">${priorityLabel(t.priority)}</span>
              ${dueText ? `<span class="cl-due ${overdue ? 'cl-overdue' : ''}">${dueIcon} ${dueText}</span>` : ''}
            </div>
          </div>
          <button class="cl-delete" data-action="delete" aria-label="Delete task">&#10005;</button>
        </div>
      `;
    }).join('');

    // Bind events
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
  }

  // --- Load ---

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
      render();
    } catch (err) {
      alert(err.message);
    } finally {
      pageEl.removeAttribute('aria-busy');
    }
  }

  return { load };
})();
