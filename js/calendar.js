const Calendar = (() => {
  let monthOffset = 0;

  const monthLabelEl = document.getElementById('cal-month-label');
  const weekdayRow = document.getElementById('cal-weekday-row');
  const cellsEl = document.getElementById('cal-month-cells');
  const WEEKDAY_LABELS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

  weekdayRow.innerHTML = WEEKDAY_LABELS.map((w) => `<div>${w}</div>`).join('');

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
      const pills = dayEvents.map((ev) => {
        const cls = App.TYPE_CLASS[ev.type] || 'session';
        return `<span class="event-pill ${cls} ${ev.recurring ? 'recurring' : ''}" data-id="${ev.id}" title="${App.escapeHtml(ev.title)}">${App.escapeHtml(ev.title)}</span>`;
      }).join('');
      return `
        <div class="month-cell ${isToday ? 'today' : ''} ${inMonth ? '' : 'out-of-month'}" data-date="${iso}">
          <span class="num ${isToday ? 'today' : ''}">${d.getDate()}</span>
          <div class="month-cell-events">${pills}</div>
        </div>
      `;
    }).join('');

    cellsEl.querySelectorAll('.month-cell').forEach((cell) => {
      cell.addEventListener('click', () => openEventModal(cell.dataset.date));
    });

    cellsEl.querySelectorAll('.event-pill').forEach((pill) => {
      pill.addEventListener('click', async (e) => {
        e.stopPropagation();
        const ev = events.find((x) => String(x.id) === pill.dataset.id);
        if (!ev) return;
        if (ev.recurring) {
          const cancelled = await App.cancelClassOccurrence(ev.schedule_id, ev.date, ev.title);
          if (cancelled) load();
        } else {
          openEventModal(ev.date, ev);
        }
      });
    });
  }

  async function load() {
    const monthDate = new Date(new Date().getFullYear(), new Date().getMonth() + monthOffset, 1);
    const gridStart = App.startOfMonthGrid(monthDate);
    const gridEnd = App.addDays(gridStart, 41);
    try {
      const [events, recurring] = await Promise.all([
        fetchEvents(gridStart, gridEnd),
        fetchRecurringOccurrences(gridStart, gridEnd),
      ]);
      render(monthDate, events.concat(recurring));
    } catch (err) {
      alert(err.message);
    }
  }

  return { load };
})();
