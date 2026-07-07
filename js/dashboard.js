const Dashboard = (() => {
  const START_HOUR = 7;
  const END_HOUR = 21;
  const HOUR_HEIGHT = 64;

  let weekOffset = 0;

  const statGrid = document.getElementById('dash-stat-grid');
  const weekLabel = document.getElementById('dash-week-label');
  const head = document.getElementById('dash-timetable-head');
  const body = document.getElementById('dash-timetable-body');

  document.getElementById('dash-prev-week').addEventListener('click', () => {
    weekOffset -= 1;
    load();
  });
  document.getElementById('dash-next-week').addEventListener('click', () => {
    weekOffset += 1;
    load();
  });

  function minutesOf(hhmm) {
    const [h, m] = hhmm.split(':').map(Number);
    return h * 60 + m;
  }

  async function fetchStats() {
    const { data, error } = await sb.from('transactions').select('type, amount');
    if (error) throw error;
    let income = 0;
    let expense = 0;
    for (const t of data) {
      if (t.type === 'income') income += Number(t.amount);
      else expense += Number(t.amount);
    }
    return { income, expense };
  }

  function renderStats({ income, expense }) {
    statGrid.innerHTML = `
      <div class="card">
        <p class="stat-label">Total Income</p>
        <p class="stat-value">${App.currency(income)}</p>
        <div class="stat-foot up">Across all recorded transactions</div>
      </div>
      <div class="card">
        <p class="stat-label">Total Expenses</p>
        <p class="stat-value">${App.currency(expense)}</p>
        <div class="stat-foot down">Across all recorded transactions</div>
      </div>
    `;
  }

  async function fetchWeekEvents(weekStart, weekEnd) {
    const { data, error } = await sb
      .from('events')
      .select('id, title, type, date, start_time, end_time, location')
      .gte('date', App.toISO(weekStart))
      .lte('date', App.toISO(weekEnd))
      .not('start_time', 'is', null);
    if (error) throw error;
    return data;
  }

  async function fetchRecurringOccurrences(weekStart, weekEnd) {
    const [{ data: schedules, error: schedError }, { data: exceptions, error: excError }] = await Promise.all([
      sb.from('class_schedule').select('id, title, day_of_week, start_time, end_time, location, valid_from, valid_until'),
      sb.from('class_schedule_exceptions').select('schedule_id, date'),
    ]);
    if (schedError) throw schedError;
    if (excError) throw excError;
    return App.expandClassSchedule(schedules, exceptions, App.toISO(weekStart), App.toISO(weekEnd));
  }

  function renderTimetable(weekStart, events) {
    const today = new Date();
    const todayISO = App.toISO(today);
    const nowMinutes = today.getHours() * 60 + today.getMinutes();

    weekLabel.textContent = weekStart.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
      + ' - '
      + App.addDays(weekStart, 6).toLocaleDateString('en-US', { month: 'short', day: 'numeric' });

    const days = Array.from({ length: 7 }, (_, i) => App.addDays(weekStart, i));

    head.innerHTML = '<div></div>' + days.map((d) => {
      const iso = App.toISO(d);
      const isToday = iso === todayISO;
      return `
        <div class="timetable-head-cell">
          <p class="weekday">${d.toLocaleDateString('en-US', { weekday: 'short' })}</p>
          <p class="daynum ${isToday ? 'today' : ''}">${d.getDate()}</p>
        </div>
      `;
    }).join('');

    const hours = Array.from({ length: END_HOUR - START_HOUR }, (_, i) => `${App.pad(START_HOUR + i)}:00`);
    const hoursCol = `<div class="timetable-hours">${hours.map((h) => `<div class="timetable-hour-label"><span>${h}</span></div>`).join('')}</div>`;

    const dayCols = days.map((d) => {
      const iso = App.toISO(d);
      const isToday = iso === todayISO;
      const dayEvents = events.filter((e) => e.date === iso);
      const blocks = dayEvents.map((ev) => {
        const startMin = minutesOf(ev.start_time) - START_HOUR * 60;
        const endMin = (ev.end_time ? minutesOf(ev.end_time) : minutesOf(ev.start_time) + 60) - START_HOUR * 60;
        const top = (startMin / 60) * HOUR_HEIGHT;
        const height = Math.max(((endMin - startMin) / 60) * HOUR_HEIGHT, 32);
        const cls = App.TYPE_CLASS[ev.type] || 'session';
        const timeLabel = ev.end_time ? `${ev.start_time} to ${ev.end_time}` : ev.start_time;
        return `
          <div class="event-block ev-${cls} ${ev.recurring ? 'recurring' : ''}" data-id="${ev.id}" style="top:${top}px;height:${height}px;" aria-label="${App.escapeHtml(ev.title)}, ${timeLabel}${ev.recurring ? ', recurring' : ''}">
            <p class="time">${ev.end_time ? `${ev.start_time} - ${ev.end_time}` : ev.start_time}</p>
            <p class="title">${App.escapeHtml(ev.title)}</p>
            ${ev.location ? `<p class="loc">${App.escapeHtml(ev.location)}</p>` : ''}
          </div>
        `;
      }).join('');

      const slotDivs = hours.map(() => '<div class="timetable-hour-slot"></div>').join('');
      const showNow = isToday && nowMinutes >= START_HOUR * 60 && nowMinutes <= END_HOUR * 60;
      const nowLine = showNow
        ? `<div class="now-line" style="top:${((nowMinutes - START_HOUR * 60) / 60) * HOUR_HEIGHT}px;"></div>`
        : '';

      return `<div class="timetable-col" data-date="${iso}" aria-label="Create event on ${iso}">${slotDivs}${nowLine}${blocks}</div>`;
    }).join('');

    body.innerHTML = hoursCol + dayCols;

    body.querySelectorAll('.timetable-col').forEach((col) => {
      col.addEventListener('click', () => openEventModal(col.dataset.date));
      App.bindActivate(col);
    });

    body.querySelectorAll('.event-block').forEach((block) => {
      block.addEventListener('click', async (e) => {
        e.stopPropagation();
        const ev = events.find((x) => String(x.id) === block.dataset.id);
        if (!ev) return;
        if (ev.recurring) {
          const cancelled = await App.cancelClassOccurrence(ev.schedule_id, ev.date, ev.title);
          if (cancelled) load();
        } else {
          openEventModal(ev.date, ev);
        }
      });
      App.bindActivate(block);
    });
  }

  const pageEl = document.getElementById('page-dashboard');

  async function load() {
    const weekStart = App.startOfWeek(App.addDays(new Date(), weekOffset * 7));
    const weekEnd = App.addDays(weekStart, 6);
    pageEl.setAttribute('aria-busy', 'true');
    try {
      const [stats, events, recurring] = await Promise.all([
        fetchStats(),
        fetchWeekEvents(weekStart, weekEnd),
        fetchRecurringOccurrences(weekStart, weekEnd),
      ]);
      renderStats(stats);
      renderTimetable(weekStart, events.concat(recurring));
    } catch (err) {
      alert(err.message);
    } finally {
      pageEl.removeAttribute('aria-busy');
    }
  }

  // --- Manage Class Schedule modal ---

  const scheduleModalOverlay = document.getElementById('schedule-modal-overlay');
  const scheduleForm = document.getElementById('schedule-form');
  const scheduleDeleteBtn = document.getElementById('schedule-delete');
  const DAY_NAMES = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
  let editingScheduleId = null;

  async function fetchSchedules() {
    const { data, error } = await sb
      .from('class_schedule')
      .select('id, title, day_of_week, start_time, end_time, location, valid_from, valid_until')
      .order('day_of_week');
    if (error) throw error;
    return data;
  }

  const WEEK_GRID_DAYS = [1, 2, 3, 4, 5, 6, 0]; // Mon..Sun, matching #schedule-day's option order

  function renderScheduleList(schedules) {
    const list = document.getElementById('schedule-list');
    list.innerHTML = WEEK_GRID_DAYS.map((dow) => {
      const dayClasses = schedules
        .filter((s) => s.day_of_week === dow)
        .sort((a, b) => a.start_time.localeCompare(b.start_time));
      const cards = dayClasses.length
        ? dayClasses.map((s) => `
            <div class="schedule-class-card" data-id="${s.id}">
              <button class="schedule-card-delete" type="button" data-action="delete" data-id="${s.id}" aria-label="Delete ${App.escapeHtml(s.title)}">&#10005;</button>
              <p class="schedule-card-title">${App.escapeHtml(s.title)}</p>
              <p class="schedule-card-time">${s.start_time}${s.end_time ? ` - ${s.end_time}` : ''}</p>
              ${s.location ? `<p class="schedule-card-location">${App.escapeHtml(s.location)}</p>` : ''}
            </div>
          `).join('')
        : '<p class="schedule-day-empty">&mdash;</p>';
      return `
        <div class="schedule-day-col">
          <p class="schedule-day-head">${DAY_NAMES[dow]}</p>
          ${cards}
        </div>
      `;
    }).join('');

    list.querySelectorAll('.schedule-class-card').forEach((card) => {
      card.addEventListener('click', () => {
        const s = schedules.find((x) => String(x.id) === card.dataset.id);
        if (s) openScheduleForm(s);
      });
    });
    list.querySelectorAll('[data-action="delete"]').forEach((btn) => {
      btn.addEventListener('click', async (e) => {
        e.stopPropagation();
        if (!confirm('Delete this entire weekly class series?')) return;
        const { error } = await sb.from('class_schedule').delete().eq('id', btn.dataset.id);
        if (error) return alert(error.message);
        await loadScheduleModal();
        load();
      });
    });
  }

  function openScheduleForm(s) {
    editingScheduleId = s ? s.id : null;
    scheduleDeleteBtn.style.display = s ? '' : 'none';
    document.getElementById('schedule-title').value = s ? s.title : '';
    document.getElementById('schedule-day').value = s ? s.day_of_week : '1';
    document.getElementById('schedule-start').value = s ? s.start_time : '09:00';
    document.getElementById('schedule-end').value = s ? (s.end_time || '') : '10:00';
    document.getElementById('schedule-location').value = s ? (s.location || '') : '';
    document.getElementById('schedule-valid-from').value = s ? s.valid_from : App.toISO(new Date());
    document.getElementById('schedule-valid-until').value = s ? (s.valid_until || '') : '';
  }

  async function loadScheduleModal() {
    try {
      renderScheduleList(await fetchSchedules());
    } catch (err) {
      alert(err.message);
    }
  }

  document.getElementById('dash-manage-schedule').addEventListener('click', () => {
    openScheduleForm(null);
    scheduleModalOverlay.classList.add('open');
    loadScheduleModal();
  });
  document.getElementById('schedule-modal-close').addEventListener('click', () => {
    scheduleModalOverlay.classList.remove('open');
  });
  scheduleModalOverlay.addEventListener('click', (e) => {
    if (e.target === scheduleModalOverlay) scheduleModalOverlay.classList.remove('open');
  });

  scheduleForm.addEventListener('submit', async (e) => {
    e.preventDefault();
    const payload = {
      title: document.getElementById('schedule-title').value,
      day_of_week: Number(document.getElementById('schedule-day').value),
      start_time: document.getElementById('schedule-start').value,
      end_time: document.getElementById('schedule-end').value || null,
      location: document.getElementById('schedule-location').value || null,
      valid_from: document.getElementById('schedule-valid-from').value,
      valid_until: document.getElementById('schedule-valid-until').value || null,
    };
    const { error } = editingScheduleId
      ? await sb.from('class_schedule').update(payload).eq('id', editingScheduleId)
      : await sb.from('class_schedule').insert(payload);
    if (error) return alert(error.message);
    openScheduleForm(null);
    await loadScheduleModal();
    load();
  });

  scheduleDeleteBtn.addEventListener('click', async () => {
    if (!editingScheduleId || !confirm('Delete this entire weekly class series?')) return;
    const { error } = await sb.from('class_schedule').delete().eq('id', editingScheduleId);
    if (error) return alert(error.message);
    openScheduleForm(null);
    await loadScheduleModal();
    load();
  });

  return { load };
})();
