const Calendar = (() => {
  let monthOffset = 0;

  const monthLabelEl = document.getElementById('cal-month-label');
  const weekdayRow = document.getElementById('cal-weekday-row');
  const cellsEl = document.getElementById('cal-month-cells');
  const WEEKDAY_LABELS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

  weekdayRow.innerHTML = WEEKDAY_LABELS.map((w) => `<div>${w}</div>`).join('');

  // --- Grouped "Study" popover: a day's recurring class occurrences render as
  // one pill instead of one per class; clicking it reveals the group name and
  // every class scheduled that day.

  const popoverEl = document.getElementById('cal-class-popover');
  const popoverTitleEl = document.getElementById('cal-class-popover-title');
  const popoverListEl = document.getElementById('cal-class-popover-list');
  let openGroupDate = null;

  function closePopover() {
    openGroupDate = null;
    popoverEl.hidden = true;
    cellsEl.querySelectorAll('.class-group-pill[aria-expanded="true"]').forEach((p) => p.setAttribute('aria-expanded', 'false'));
  }

  function openPopover(pillEl, iso, dayClasses) {
    const [y, m, d] = iso.split('-').map(Number);
    const dateLabel = new Date(y, m - 1, d).toLocaleDateString('en-US', { weekday: 'long', month: 'short', day: 'numeric' });
    popoverTitleEl.textContent = `Study — ${dateLabel}`;
    popoverListEl.innerHTML = dayClasses.map((c) => `
      <button type="button" class="class-group-item" data-schedule-id="${c.schedule_id}" data-date="${c.date}" data-title="${App.escapeHtml(c.title)}">
        <span class="class-group-item-title">${App.escapeHtml(c.title)}</span>
        <span class="class-group-item-time">${App.escapeHtml(c.start_time)}${c.end_time ? ` - ${App.escapeHtml(c.end_time)}` : ''}</span>
        ${c.location ? `<span class="class-group-item-location">${App.escapeHtml(c.location)}</span>` : ''}
      </button>
    `).join('');
    popoverListEl.querySelectorAll('.class-group-item').forEach((item) => {
      item.addEventListener('click', async () => {
        const cancelled = await App.cancelClassOccurrence(item.dataset.scheduleId, item.dataset.date, item.dataset.title);
        if (cancelled) { closePopover(); load(); }
      });
    });

    popoverEl.hidden = false;
    const rect = pillEl.getBoundingClientRect();
    const popRect = popoverEl.getBoundingClientRect();
    let top = rect.bottom + 6;
    let left = rect.left;
    left = Math.min(left, window.innerWidth - popRect.width - 8);
    left = Math.max(8, left);
    if (top + popRect.height > window.innerHeight) top = rect.top - popRect.height - 6;
    popoverEl.style.top = `${top}px`;
    popoverEl.style.left = `${left}px`;

    cellsEl.querySelectorAll('.class-group-pill[aria-expanded="true"]').forEach((p) => p.setAttribute('aria-expanded', 'false'));
    pillEl.setAttribute('aria-expanded', 'true');
    openGroupDate = iso;
  }

  document.getElementById('cal-class-popover-close').addEventListener('click', closePopover);
  document.addEventListener('click', (e) => {
    if (!openGroupDate) return;
    if (popoverEl.contains(e.target)) return;
    if (e.target.closest && e.target.closest('.class-group-pill')) return;
    closePopover();
  });
  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape' && openGroupDate) closePopover();
  });

  document.getElementById('cal-prev-month').addEventListener('click', () => {
    monthOffset -= 1;
    load();
  });
  document.getElementById('cal-next-month').addEventListener('click', () => {
    monthOffset += 1;
    load();
  });

  async function fetchEvents(gridStart, gridEnd) {
    const { data, error } = await sb
      .from('events')
      .select('id, title, type, date, start_time, end_time, location')
      .gte('date', App.toISO(gridStart))
      .lte('date', App.toISO(gridEnd));
    if (error) throw error;
    return data;
  }

  async function fetchRecurringOccurrences(gridStart, gridEnd) {
    const [{ data: schedules, error: schedError }, { data: exceptions, error: excError }] = await Promise.all([
      sb.from('class_schedule').select('id, title, day_of_week, start_time, end_time, location, valid_from, valid_until'),
      sb.from('class_schedule_exceptions').select('schedule_id, date'),
    ]);
    if (schedError) throw schedError;
    if (excError) throw excError;
    return App.expandClassSchedule(schedules, exceptions, App.toISO(gridStart), App.toISO(gridEnd));
  }

  function render(monthDate, events) {
    const today = new Date();
    const todayISO = App.toISO(today);
    monthLabelEl.textContent = monthDate.toLocaleDateString('en-US', { month: 'long', year: 'numeric' });

    const gridStart = App.startOfMonthGrid(monthDate);
    const cells = Array.from({ length: 42 }, (_, i) => App.addDays(gridStart, i));

    cellsEl.innerHTML = cells.map((d) => {
      const iso = App.toISO(d);
      const inMonth = d.getMonth() === monthDate.getMonth();
      const isToday = iso === todayISO;
      const dayEvents = events.filter((e) => e.date === iso);
      const classEvents = dayEvents.filter((e) => e.recurring);
      const otherEvents = dayEvents.filter((e) => !e.recurring);

      const groupPill = classEvents.length
        ? `<span class="event-pill session class-group-pill" data-date="${iso}" aria-haspopup="true" aria-expanded="false" aria-label="Study, ${classEvents.length} class${classEvents.length > 1 ? 'es' : ''} on ${iso}">Study${classEvents.length > 1 ? ` (${classEvents.length})` : ''}</span>`
        : '';
      const otherPills = otherEvents.map((ev) => {
        const cls = App.TYPE_CLASS[ev.type] || 'session';
        return `<span class="event-pill ${cls}" data-id="${ev.id}" title="${App.escapeHtml(ev.title)}" aria-label="${App.escapeHtml(ev.title)}">${App.escapeHtml(ev.title)}</span>`;
      }).join('');
      return `
        <div class="month-cell ${isToday ? 'today' : ''} ${inMonth ? '' : 'out-of-month'}" data-date="${iso}" aria-label="Create event on ${iso}">
          <span class="num ${isToday ? 'today' : ''}">${d.getDate()}</span>
          <div class="month-cell-events">${groupPill}${otherPills}</div>
        </div>
      `;
    }).join('');

    cellsEl.querySelectorAll('.month-cell').forEach((cell) => {
      cell.addEventListener('click', () => openEventModal(cell.dataset.date));
      App.bindActivate(cell);
    });

    cellsEl.querySelectorAll('.class-group-pill').forEach((pill) => {
      pill.addEventListener('click', (e) => {
        e.stopPropagation();
        const iso = pill.dataset.date;
        if (openGroupDate === iso) { closePopover(); return; }
        const dayClasses = events.filter((ev) => ev.recurring && ev.date === iso).sort((a, b) => a.start_time.localeCompare(b.start_time));
        openPopover(pill, iso, dayClasses);
      });
      pill.addEventListener('keydown', (e) => {
        if (e.key === 'Enter' || e.key === ' ' || e.key === 'Spacebar') e.stopPropagation();
      });
      App.bindActivate(pill);
    });

    cellsEl.querySelectorAll('.event-pill:not(.class-group-pill)').forEach((pill) => {
      pill.addEventListener('click', (e) => {
        e.stopPropagation();
        const ev = events.find((x) => String(x.id) === pill.dataset.id);
        if (ev) openEventModal(ev.date, ev);
      });
      pill.addEventListener('keydown', (e) => {
        if (e.key === 'Enter' || e.key === ' ' || e.key === 'Spacebar') e.stopPropagation();
      });
      App.bindActivate(pill);
    });
  }

  const pageEl = document.getElementById('page-calendar');

  async function load() {
    closePopover();
    const monthDate = new Date(new Date().getFullYear(), new Date().getMonth() + monthOffset, 1);
    const gridStart = App.startOfMonthGrid(monthDate);
    const gridEnd = App.addDays(gridStart, 41);
    pageEl.setAttribute('aria-busy', 'true');
    try {
      const [events, recurring] = await Promise.all([
        fetchEvents(gridStart, gridEnd),
        fetchRecurringOccurrences(gridStart, gridEnd),
      ]);
      render(monthDate, events.concat(recurring));
    } catch (err) {
      alert(err.message);
    } finally {
      pageEl.removeAttribute('aria-busy');
    }
  }

  return { load };
})();
