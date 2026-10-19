const Dashboard = (() => {
  const START_HOUR = 7;
  const END_HOUR = 21;
  const HOUR_HEIGHT = 64;

  let selectedDate = new Date();
  selectedDate.setHours(0, 0, 0, 0);

  const mobileQuery = window.matchMedia('(max-width: 899px)');
  const isMobile = () => mobileQuery.matches;

  const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
  const WEEKDAYS = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];
  const EVENT_COLOR = {
    session: 'var(--color-primary)',
    exam: 'var(--color-tertiary)',
    deadline: 'var(--color-tertiary)',
    task: 'var(--color-secondary)',
  };

  const statsEl = document.getElementById('dash-stats');
  const chartEl = document.getElementById('dash-chart');
  const chartScroll = document.getElementById('dash-chart-scroll');
  const rangeSelect = document.getElementById('dash-range');
  const weekLabel = document.getElementById('dash-week-label');
  const head = document.getElementById('dash-timetable-head');
  const body = document.getElementById('dash-timetable-body');
  const viewDayBtn = document.getElementById('dash-view-day');
  const viewWeekBtn = document.getElementById('dash-view-week');
  const prevBtn = document.getElementById('dash-prev-week');
  const nextBtn = document.getElementById('dash-next-week');

  // Last fetched data, so changing the range re-renders without another round trip.
  let transactions = [];
  let goal = null;
  let transactionsLoaded = false;
  let range = Number(rangeSelect.value);

  prevBtn.addEventListener('click', () => {
    selectedDate = App.addDays(selectedDate, isMobile() ? -1 : -7);
    load();
  });
  nextBtn.addEventListener('click', () => {
    selectedDate = App.addDays(selectedDate, isMobile() ? 1 : 7);
    load();
  });
  mobileQuery.addEventListener('change', load);
  rangeSelect.addEventListener('change', () => {
    range = Number(rangeSelect.value);
    renderOverview();
  });

  function minutesOf(hhmm) {
    const [h, m] = hhmm.split(':').map(Number);
    return h * 60 + m;
  }

  function h(tag, cls, text) {
    return Charts.html(tag, cls, text);
  }

  function dateLabel(d) {
    return `${MONTHS[d.getMonth()]} ${d.getDate()}`;
  }

  // --- Data ---

  async function fetchTransactions() {
    const { data, error } = await sb.from('transactions').select('type, amount, category, date');
    if (error) throw error;
    return data;
  }

  async function fetchBudgets() {
    const { data, error } = await sb.from('budgets').select('category, monthly_limit').order('category');
    if (error) throw error;
    return data;
  }

  async function fetchSubscriptions() {
    const { data, error } = await sb.from('subscriptions').select('name, amount, billing_day').order('id');
    if (error) throw error;
    return data;
  }

  async function fetchGoal() {
    const { data, error } = await sb.from('savings_goal').select('label, target_amount, current_amount').eq('id', 1).maybeSingle();
    if (error) throw error;
    return data;
  }

  const UPCOMING_DAYS = 14;
  const UPCOMING_MAX = 5;

  async function fetchUpcoming() {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const end = App.addDays(today, UPCOMING_DAYS);
    const { data, error } = await sb
      .from('events')
      .select('id, title, type, date, start_time')
      .gte('date', App.toISO(today))
      .lte('date', App.toISO(end));
    if (error) throw error;
    const recurring = await fetchRecurringOccurrences(today, end);
    const now = new Date();
    const todayISO = App.toISO(now);
    const nowMinutes = now.getHours() * 60 + now.getMinutes();
    return data.concat(recurring)
      .filter((e) => e.date > todayISO || !e.start_time || minutesOf(e.start_time) >= nowMinutes)
      .sort((a, b) => a.date.localeCompare(b.date) || (a.start_time || '').localeCompare(b.start_time || ''))
      .slice(0, UPCOMING_MAX);
  }

  // --- Spending overview: chart + stat cards ---

  function dailyRows(count, endOffset) {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const rows = Array.from({ length: count }, (_, i) => {
      const d = App.addDays(today, -(count - 1 - i) - endOffset);
      return { iso: App.toISO(d), label: dateLabel(d), weekday: (d.getDay() + 6) % 7, income: 0, expense: 0 };
    });
    const byDate = Object.fromEntries(rows.map((r) => [r.iso, r]));
    for (const t of transactions) {
      const row = byDate[t.date];
      if (!row) continue;
      if (t.type === 'income') row.income += Number(t.amount);
      else row.expense += Number(t.amount);
    }
    return rows;
  }

  const total = (rows, key) => rows.reduce((t, r) => t + r[key], 0);

  const ARROW = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" width="16" height="16" aria-hidden="true"><path d="M7 17L17 7M9 7h8v8"/></svg>';
  const TREND_ARROW = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round" width="14" height="14" aria-hidden="true"><path d="M7 17L17 7M9 7h8v8"/></svg>';

  // dir: 'up' | 'down' (arrow); tone: 'good' | 'bad' | '' (colour). Spending going up is bad, income going up is good.
  function trend(dir, tone, label) {
    const t = h('div', `trend${tone ? ` trend-${tone}` : ''}${dir === 'down' ? ' trend-down' : ''}`);
    if (dir) t.insertAdjacentHTML('beforeend', TREND_ARROW);
    t.appendChild(h('span', null, label));
    return t;
  }

  // Compares two period totals; `higherIsGood` decides the colour, not the arrow.
  function periodTrend(now, prev, higherIsGood, suffix) {
    if (!prev) return trend(null, '', `No prior data ${suffix}`.trim());
    const p = ((now - prev) / prev) * 100;
    const up = p >= 0;
    const tone = Math.abs(p) < 0.05 ? '' : (up === higherIsGood ? 'good' : 'bad');
    return trend(up ? 'up' : 'down', tone, `${up ? '+' : '\u2212'}${Math.abs(p).toFixed(1)}% ${suffix}`);
  }

  function statCard(label, valueText, cls) {
    const card = h('article', `card stat${cls ? ` ${cls}` : ''}`);
    const link = h('button', 'card-link');
    link.type = 'button';
    link.dataset.nav = 'finances';
    link.setAttribute('aria-label', `Open Finances (${label})`);
    link.innerHTML = ARROW;
    card.appendChild(link);
    card.appendChild(h('div', 'stat-label', label));
    if (valueText != null) card.appendChild(h('div', `stat-value${cls && cls.includes('stat-big') ? ' stat-big' : ''}`, valueText));
    return card;
  }

  function renderStats(rows, prevRows) {
    const inc = total(rows, 'income');
    const exp = total(rows, 'expense');
    const prevInc = total(prevRows, 'income');
    const prevExp = total(prevRows, 'expense');
    const prevLabel = `vs prior ${range} days`;
    const net = inc - exp;

    let allIncome = 0;
    let allExpense = 0;
    for (const t of transactions) {
      if (t.type === 'income') allIncome += Number(t.amount);
      else allExpense += Number(t.amount);
    }
    const balance = allIncome - allExpense;

    statsEl.replaceChildren();

    const bal = statCard('Balance', App.currency(balance), 'stat-big');
    bal.appendChild(trend(net >= 0 ? 'up' : 'down', net >= 0 ? 'good' : 'bad',
      `${net >= 0 ? '+' : '\u2212'}${App.currency(Math.abs(net))} net, ${range}d`));
    statsEl.appendChild(bal);

    // Average spend per day, with the average for each weekday in the selected range.
    const sums = Array(7).fill(0);
    const counts = Array(7).fill(0);
    rows.forEach((r) => { sums[r.weekday] += r.expense; counts[r.weekday] += 1; });
    const weekdayAvg = sums.map((v, i) => (counts[i] ? v / counts[i] : 0));
    const avgCard = statCard('Avg daily spend', App.currency(exp / range), 'stat-mini');
    const avgTrend = periodTrend(exp, prevExp, false, prevLabel);
    avgTrend.classList.add('trend-flush');
    avgCard.appendChild(avgTrend);
    Charts.miniBars(avgCard, weekdayAvg, WEEKDAYS, App.currency);
    statsEl.appendChild(avgCard);

    const incCard = statCard(`Income, ${range}d`, App.currency(inc));
    incCard.appendChild(periodTrend(inc, prevInc, true, prevLabel));
    statsEl.appendChild(incCard);

    const expCard = statCard(`Expenses, ${range}d`, App.currency(exp));
    expCard.appendChild(periodTrend(exp, prevExp, false, prevLabel));
    statsEl.appendChild(expCard);

    if (goal && Number(goal.target_amount) > 0) {
      const pct = Math.min(100, Math.round((Number(goal.current_amount) / Number(goal.target_amount)) * 100));
      const goalCard = statCard('Savings goal', null);
      const value = h('div', 'stat-value', App.currency(goal.current_amount));
      value.appendChild(h('small', null, `of ${App.currency(goal.target_amount)}`));
      goalCard.appendChild(value);
      const track = h('div', 'track');
      track.setAttribute('role', 'progressbar');
      track.setAttribute('aria-label', `${goal.label} progress`);
      track.setAttribute('aria-valuemin', '0');
      track.setAttribute('aria-valuemax', '100');
      track.setAttribute('aria-valuenow', String(pct));
      const fill = h('div', 'track-fill');
      fill.style.width = `${pct}%`;
      track.appendChild(fill);
      goalCard.appendChild(track);
      goalCard.appendChild(h('div', 'trend', `${pct}% of ${goal.label}`));
      statsEl.appendChild(goalCard);
    }
  }

  function renderChart(rows) {
    Charts.stackedBars(chartEl, rows, {
      id: 'dash-chart-svg',
      heading: `Income and expenses by day, last ${range} days`,
      every: range <= 7 ? 1 : range <= 14 ? 2 : 3,
      money: App.currency,
    });
    // On narrow screens the chart scrolls sideways; start at the most recent days.
    chartScroll.scrollLeft = chartScroll.scrollWidth;
  }

  function renderOverview() {
    if (!transactionsLoaded) return;
    renderChart(dailyRows(range, 0));
    renderStats(dailyRows(range, 0), dailyRows(range, range));
  }

  function renderOverviewError() {
    const note = '<p class="empty-note">Could not load transactions.</p>';
    chartEl.innerHTML = note;
    statsEl.innerHTML = note;
  }

  // --- Side column: budgets, subscriptions, upcoming events ---

  function renderBudgets(budgets) {
    const card = document.getElementById('dash-budgets-card');
    const month = App.toISO(new Date()).slice(0, 7);
    const spentBy = {};
    for (const t of transactions) {
      if (t.type !== 'expense' || !t.date.startsWith(month)) continue;
      const key = String(t.category || '').trim().toLowerCase();
      spentBy[key] = (spentBy[key] || 0) + Number(t.amount);
    }
    const rows = budgets.filter((b) => Number(b.monthly_limit) > 0);
    card.hidden = !rows.length;
    const list = document.getElementById('dash-budgets');
    list.replaceChildren(...rows.map((b) => {
      const spent = spentBy[String(b.category).trim().toLowerCase()] || 0;
      const p = spent / Number(b.monthly_limit);
      const li = h('li', 'row');
      li.appendChild(Charts.ring(56, 6, p, `${Math.round(p * 100)}%`));
      const main = h('div', 'row-main');
      main.appendChild(h('div', 'row-title', b.category));
      main.appendChild(h('div', 'row-sub', `${App.currency(spent)} / ${App.currency(b.monthly_limit)}`));
      li.appendChild(main);
      return li;
    }));
  }

  // Next date this billing day falls on (today counts); short months clamp to their last day.
  function nextBilling(day) {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const at = (y, m) => new Date(y, m, Math.min(day, new Date(y, m + 1, 0).getDate()));
    let d = at(today.getFullYear(), today.getMonth());
    if (d < today) d = at(today.getFullYear(), today.getMonth() + 1);
    return d;
  }

  function renderSubs(subs) {
    const card = document.getElementById('dash-subs-card');
    card.hidden = !subs.length;
    const list = document.getElementById('dash-subs');
    const monthly = subs.reduce((t, s) => t + Number(s.amount), 0);
    const items = subs.map((s) => ({ name: s.name, amount: Number(s.amount), next: nextBilling(s.billing_day) }));
    const featured = items.slice().sort((a, b) => b.amount - a.amount).slice(0, 2);
    const rest = items.filter((s) => !featured.includes(s)).sort((a, b) => a.next - b.next);

    function row(s, isFeature) {
      const li = h('li', `row${isFeature ? ' row-feature' : ''}`);
      if (isFeature && monthly > 0) {
        const share = s.amount / monthly;
        li.appendChild(Charts.ring(44, 5, share, `${Math.round(share * 100)}%`));
      }
      const main = h('div', 'row-main');
      main.appendChild(h('div', 'row-title', s.name));
      main.appendChild(h('div', 'row-sub', `Next ${dateLabel(s.next)}`));
      li.appendChild(main);
      li.appendChild(h('div', 'row-amount', App.currency(s.amount)));
      return li;
    }
    list.replaceChildren(...featured.map((s) => row(s, true)), ...rest.map((s) => row(s, false)));
  }

  function whenLabel(ev) {
    const [y, m, d] = ev.date.split('-').map(Number);
    const date = new Date(y, m - 1, d);
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const diff = Math.round((date - today) / 86400000);
    const day = diff === 0 ? 'Today' : diff === 1 ? 'Tomorrow'
      : diff < 7 ? date.toLocaleDateString('en-US', { weekday: 'short' }) : dateLabel(date);
    return ev.start_time ? `${day} ${ev.start_time.slice(0, 5)}` : day;
  }

  function renderUpcoming(events) {
    const list = document.getElementById('dash-events');
    if (!events.length) {
      list.replaceChildren(h('li', 'rows-empty', `Nothing scheduled in the next ${UPCOMING_DAYS} days.`));
      return;
    }
    list.replaceChildren(...events.map((ev) => {
      const li = h('li', 'row row-event');
      const dot = h('span', 'event-dot');
      dot.setAttribute('aria-hidden', 'true');
      dot.style.setProperty('--dot', EVENT_COLOR[ev.type] || EVENT_COLOR.session);
      li.appendChild(dot);
      const main = h('div', 'row-main');
      main.appendChild(h('div', 'row-title', ev.title));
      main.appendChild(h('div', 'row-sub', whenLabel(ev)));
      li.appendChild(main);
      return li;
    }));
  }

  function renderGreeting() {
    const hour = new Date().getHours();
    const part = hour < 12 ? 'morning' : hour < 18 ? 'afternoon' : 'evening';
    document.getElementById('dash-greeting').textContent = `Good ${part}`;
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

  // --- Mobile: single-day agenda list ---

  function renderDayAgenda(date, events) {
    const iso = App.toISO(date);
    const todayISO = App.toISO(new Date());

    viewDayBtn.classList.add('active');
    viewWeekBtn.classList.remove('active');
    prevBtn.setAttribute('aria-label', 'Previous day');
    nextBtn.setAttribute('aria-label', 'Next day');
    weekLabel.textContent = date.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' });
    weekLabel.classList.toggle('today', iso === todayISO);

    head.innerHTML = '';
    body.classList.add('agenda-mode');

    const dayEvents = events
      .filter((e) => e.date === iso)
      .sort((a, b) => minutesOf(a.start_time) - minutesOf(b.start_time));

    if (!dayEvents.length) {
      body.innerHTML = `
        <div class="agenda-empty">
          <svg viewBox="0 0 24 24" fill="none" stroke-width="1.6" stroke="currentColor" width="28" height="28"><rect x="3" y="5" width="18" height="16" rx="2"/><path stroke-linecap="round" d="M8 3v4M16 3v4M3 10h18"/><path stroke-linecap="round" stroke-linejoin="round" d="M9 15l2 2 4-4"/></svg>
          <p>No classes today</p>
        </div>
      `;
      return;
    }

    body.innerHTML = dayEvents.map((ev) => {
      const cls = App.TYPE_CLASS[ev.type] || 'session';
      const timeLabel = ev.end_time ? `${ev.start_time} - ${ev.end_time}` : ev.start_time;
      return `
        <div class="agenda-item ev-${cls} ${ev.recurring ? 'recurring' : ''}" data-id="${ev.id}" aria-label="${App.escapeHtml(ev.title)}, ${timeLabel}${ev.recurring ? ', recurring' : ''}">
          <p class="agenda-time">${timeLabel}</p>
          <p class="agenda-title">${App.escapeHtml(ev.title)}</p>
          ${ev.location ? `<p class="agenda-loc">${App.escapeHtml(ev.location)}</p>` : ''}
        </div>
      `;
    }).join('');

    body.querySelectorAll('.agenda-item').forEach((el) => {
      const ev = dayEvents.find((x) => String(x.id) === el.dataset.id);
      if (!ev) return;
      el.addEventListener('click', async () => {
        if (ev.recurring) {
          const cancelled = await App.cancelClassOccurrence(ev.schedule_id, ev.date, ev.title);
          if (cancelled) load();
        } else {
          openEventModal(ev.date, ev);
        }
      });
      App.bindActivate(el);
    });
  }

  // --- Desktop: 7-column week grid ---

  function renderTimetable(weekStart, events) {
    viewDayBtn.classList.remove('active');
    viewWeekBtn.classList.add('active');
    prevBtn.setAttribute('aria-label', 'Previous week');
    nextBtn.setAttribute('aria-label', 'Next week');
    weekLabel.classList.remove('today');
    body.classList.remove('agenda-mode');

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
    const weekStart = App.startOfWeek(selectedDate);
    const weekEnd = App.addDays(weekStart, 6);
    pageEl.setAttribute('aria-busy', 'true');
    renderGreeting();
    // Each block loads independently so one failing table does not blank the rest.
    const [txns, budgets, subs, goalRes, upcoming, week, recurring] = await Promise.allSettled([
      fetchTransactions(),
      fetchBudgets(),
      fetchSubscriptions(),
      fetchGoal(),
      fetchUpcoming(),
      fetchWeekEvents(weekStart, weekEnd),
      fetchRecurringOccurrences(weekStart, weekEnd),
    ]);
    try {
      if (txns.status === 'fulfilled') {
        transactions = txns.value;
        transactionsLoaded = true;
      }
      if (goalRes.status === 'fulfilled') goal = goalRes.value;
      if (transactionsLoaded) renderOverview();
      else renderOverviewError();
      if (txns.status === 'fulfilled' && budgets.status === 'fulfilled') renderBudgets(budgets.value);
      if (subs.status === 'fulfilled') renderSubs(subs.value);
      if (upcoming.status === 'fulfilled') renderUpcoming(upcoming.value);
      if (week.status === 'fulfilled' && recurring.status === 'fulfilled') {
        const allEvents = week.value.concat(recurring.value);
        if (isMobile()) renderDayAgenda(selectedDate, allEvents);
        else renderTimetable(weekStart, allEvents);
      }
      Charts.flushArcs();
      const failed = [txns, budgets, subs, goalRes, upcoming, week, recurring].find((r) => r.status === 'rejected');
      if (failed) alert(failed.reason && failed.reason.message ? failed.reason.message : String(failed.reason));
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

  return {
    load,
    fabTargetDate: () => (isMobile() ? App.toISO(selectedDate) : App.toISO(new Date())),
  };
})();
