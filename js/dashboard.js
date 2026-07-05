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
        return `
          <div class="event-block ev-${cls}" style="top:${top}px;height:${height}px;">
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

      return `<div class="timetable-col" data-date="${iso}">${slotDivs}${nowLine}${blocks}</div>`;
    }).join('');

    body.innerHTML = hoursCol + dayCols;

    body.querySelectorAll('.timetable-col').forEach((col) => {
      col.addEventListener('click', () => openEventModal(col.dataset.date));
    });
  }

  async function load() {
    const weekStart = App.startOfWeek(App.addDays(new Date(), weekOffset * 7));
    const weekEnd = App.addDays(weekStart, 6);
    try {
      const [stats, events] = await Promise.all([fetchStats(), fetchWeekEvents(weekStart, weekEnd)]);
      renderStats(stats);
      renderTimetable(weekStart, events);
    } catch (err) {
      alert(err.message);
    }
  }

  return { load };
})();
