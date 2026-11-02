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

  let transactions = [];
  let goal = null;
  let transactionsLoaded = false;
  let range = Number(rangeSelect.value);
  let viewModeChoice = null;
  let scheduleCache = null;

  function viewMode() {
    return viewModeChoice || (isMobile() ? 'day' : 'week');
  }

  prevBtn.addEventListener('click', () => {
    selectedDate = App.addDays(selectedDate, viewMode() === 'day' ? -1 : -7);
    load();
  });
  nextBtn.addEventListener('click', () => {
    selectedDate = App.addDays(selectedDate, viewMode() === 'day' ? 1 : 7);
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

  const CALENDAR_ICON = '<rect x="3" y="5" width="18" height="16" rx="2"/><path d="M8 3v4M16 3v4M3 10h18"/>';
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

  const TREND_ARROW = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round" width="14" height="14" aria-hidden="true"><path d="M7 17L17 7M9 7h8v8"/></svg>';

  function trend(dir, tone, label) {
    const t = h('div', `trend${tone ? ` trend-${tone}` : ''}${dir === 'down' ? ' trend-down' : ''}`);
    if (dir) t.insertAdjacentHTML('beforeend', TREND_ARROW);
    t.appendChild(h('span', null, label));
    return t;
  }

  function periodTrend(now, prev, higherIsGood, suffix) {
    if (!prev) return trend(null, '', `No prior data ${suffix}`.trim());
    const p = ((now - prev) / prev) * 100;
    const up = p >= 0;
    const tone = Math.abs(p) < 0.05 ? '' : (up === higherIsGood ? 'good' : 'bad');
    return trend(up ? 'up' : 'down', tone, `${up ? '+' : '\u2212'}${Math.abs(p).toFixed(1)}% ${suffix}`);
  }

  function ledgerRow(name, value, ...extras) {
    const row = h('div', 'ledger-row');
    const line = h('div', 'ledger-line');
    line.appendChild(h('span', 'ledger-name', name));
    if (value != null) line.appendChild(h('span', 'ledger-val', value));
    row.appendChild(line);
    extras.forEach((node) => row.appendChild(node));
    return row;
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

    const top = h('div', 'ledger-top');
    const labelRow = h('div', 'ledger-label-row');
    labelRow.appendChild(h('p', 'ledger-label', 'Total balance'));
    const link = h('button', 'link-btn', 'Open Finances');
    link.type = 'button';
    link.dataset.nav = 'finances';
    labelRow.appendChild(link);
    top.appendChild(labelRow);
    top.appendChild(h('p', 'ledger-balance', App.currency(balance)));
    top.appendChild(trend(net >= 0 ? 'up' : 'down', net >= 0 ? 'good' : 'bad', `${App.signedCurrency(net)} net, ${range}d`));
    statsEl.appendChild(top);

    statsEl.appendChild(ledgerRow(`Income, ${range}d`, App.currency(inc), periodTrend(inc, prevInc, true, prevLabel)));
    statsEl.appendChild(ledgerRow(`Expenses, ${range}d`, App.currency(exp), periodTrend(exp, prevExp, false, prevLabel)));

    const sums = Array(7).fill(0);
    const counts = Array(7).fill(0);
    rows.forEach((r) => { sums[r.weekday] += r.expense; counts[r.weekday] += 1; });
    const weekdayAvg = sums.map((v, i) => (counts[i] ? v / counts[i] : 0));
    const avgRow = ledgerRow('Avg daily spend', App.currency(exp / range));
    Charts.miniBars(avgRow, weekdayAvg, WEEKDAYS, App.currency);
    statsEl.appendChild(avgRow);

    if (goal && Number(goal.target_amount) > 0) {
      const pct = Math.min(100, Math.round((Number(goal.current_amount) / Number(goal.target_amount)) * 100));
      const track = h('div', 'track');
      track.setAttribute('role', 'progressbar');
      track.setAttribute('aria-label', `${goal.label} progress`);
      track.setAttribute('aria-valuemin', '0');
      track.setAttribute('aria-valuemax', '100');
      track.setAttribute('aria-valuenow', String(pct));
      const fill = h('div', 'track-fill');
      fill.style.width = `${pct}%`;
      track.appendChild(fill);
      const meta = h('div', 'ledger-goal-meta');
      meta.appendChild(h('span', null, `${pct}% saved`));
      meta.appendChild(h('span', null, `Target ${App.currency(goal.target_amount)}`));
      statsEl.appendChild(ledgerRow('Savings goal', App.currency(goal.current_amount), track, meta));
    }
  }

  function renderChart(rows) {
    Charts.stackedBars(chartEl, rows, {
      id: 'dash-chart-svg',
      heading: `Income and expenses by day, last ${range} days`,
      every: range <= 7 ? 1 : range <= 14 ? 2 : 3,
      money: App.currency,
      onRender: () => { chartScroll.scrollLeft = chartScroll.scrollWidth; },
    });
  }

  function renderOverview() {
    if (!transactionsLoaded) return;
    renderChart(dailyRows(range, 0));
    renderStats(dailyRows(range, 0), dailyRows(range, range));
  }

  function renderOverviewError() {
    const note = '<p class="empty-note">Could not load transactions.</p>';
    Charts.unwatch(chartEl);
    chartEl.innerHTML = note;
    statsEl.innerHTML = `<div class="ledger-top">${note}</div>`;
  }


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
      const li = h('li', 'rows-empty');
      li.innerHTML = App.emptyState(CALENDAR_ICON, 'Nothing scheduled', `No events in the next ${UPCOMING_DAYS} days.`, 'Create event');
      li.querySelector('[data-empty-action]').addEventListener('click', () => openEventModal(App.toISO(new Date())));
      list.replaceChildren(li);
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
    document.getElementById('dash-date').textContent = new Date().toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric', year: 'numeric' });
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


  function agendaItemHtml(ev) {
    const cls = App.TYPE_CLASS[ev.type] || 'session';
    const timeLabel = ev.end_time ? `${ev.start_time} - ${ev.end_time}` : ev.start_time;
    return `
      <div class="agenda-item ev-${cls} ${ev.recurring ? 'recurring' : ''}" data-id="${ev.id}" aria-label="${App.escapeHtml(ev.title)}, ${timeLabel}${ev.recurring ? ', recurring' : ''}">
        <p class="agenda-time">${timeLabel}</p>
        <p class="agenda-title">${App.escapeHtml(ev.title)}</p>
        ${ev.location ? `<p class="agenda-loc">${App.escapeHtml(ev.location)}</p>` : ''}
      </div>
    `;
  }

  function renderAgenda(days, events, grouped) {
    const todayISO = App.toISO(new Date());
    head.innerHTML = '';
    body.classList.add('agenda-mode');

    const groups = days
      .map((d) => {
        const iso = App.toISO(d);
        const items = events
          .filter((e) => e.date === iso)
          .sort((a, b) => minutesOf(a.start_time) - minutesOf(b.start_time));
        return { d, iso, items };
      })
      .filter((g) => g.items.length);

    if (!groups.length) {
      const createISO = grouped ? App.toISO(selectedDate) : App.toISO(days[0]);
      body.innerHTML = App.emptyState(CALENDAR_ICON, 'Nothing scheduled', grouped ? 'No classes or events this week.' : 'No classes or events on this day.', 'Create event');
      body.querySelector('[data-empty-action]').addEventListener('click', () => openEventModal(createISO));
      return;
    }

    body.innerHTML = groups.map((g) => {
      const heading = grouped
        ? `<h3 class="agenda-day-head${g.iso === todayISO ? ' today' : ''}">${g.d.toLocaleDateString('en-US', { weekday: 'long', month: 'short', day: 'numeric' })}${g.iso === todayISO ? ' (today)' : ''}</h3>`
        : '';
      return heading + g.items.map(agendaItemHtml).join('');
    }).join('');

    body.querySelectorAll('.agenda-item').forEach((el) => {
      const ev = events.find((x) => String(x.id) === el.dataset.id);
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

  function syncViewControls(m) {
    const day = m === 'day';
    viewDayBtn.classList.toggle('active', day);
    viewWeekBtn.classList.toggle('active', !day);
    viewDayBtn.setAttribute('aria-pressed', String(day));
    viewWeekBtn.setAttribute('aria-pressed', String(!day));
    prevBtn.setAttribute('aria-label', day ? 'Previous day' : 'Previous week');
    nextBtn.setAttribute('aria-label', day ? 'Next day' : 'Next week');
  }

  function renderSchedule(weekStart, events) {
    const m = viewMode();
    syncViewControls(m);
    const weekRange = weekStart.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
      + ' - '
      + App.addDays(weekStart, 6).toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
    if (m === 'day') {
      weekLabel.textContent = selectedDate.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' });
      weekLabel.classList.toggle('today', App.toISO(selectedDate) === App.toISO(new Date()));
      renderAgenda([selectedDate], events, false);
    } else if (isMobile()) {
      weekLabel.textContent = weekRange;
      weekLabel.classList.remove('today');
      renderAgenda(Array.from({ length: 7 }, (_, i) => App.addDays(weekStart, i)), events, true);
    } else {
      renderTimetable(weekStart, events);
    }
  }

  function setViewMode(m) {
    if (viewModeChoice === m) return;
    viewModeChoice = m;
    if (scheduleCache) renderSchedule(scheduleCache.weekStart, scheduleCache.events);
    else load();
  }

  viewDayBtn.addEventListener('click', () => setViewMode('day'));
  viewWeekBtn.addEventListener('click', () => setViewMode('week'));

  function renderTimetable(weekStart, events) {
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
        <div class="timetable-head-cell ${isToday ? 'today' : ''}">
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
        const size = height < 48 ? 'short' : height < 76 ? 'tight' : '';
        return `
          <div class="event-block ev-${cls} ${size} ${ev.recurring ? 'recurring' : ''}" data-id="${ev.id}" style="top:${top}px;height:${height}px;" aria-label="${App.escapeHtml(ev.title)}, ${timeLabel}${ev.recurring ? ', recurring' : ''}">
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

      return `<div class="timetable-col ${isToday ? 'today' : ''}" data-date="${iso}" aria-label="Create event on ${iso}">${slotDivs}${nowLine}${blocks}</div>`;
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
        scheduleCache = { weekStart, events: allEvents };
        renderSchedule(weekStart, allEvents);
      }
      Charts.flushArcs();
      const failed = [txns, budgets, subs, goalRes, upcoming, week, recurring].find((r) => r.status === 'rejected');
      if (failed) ui.alert(failed.reason && failed.reason.message ? failed.reason.message : String(failed.reason), { title: 'Something went wrong' });
    } finally {
      pageEl.removeAttribute('aria-busy');
    }
  }


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

  const WEEK_GRID_DAYS = [1, 2, 3, 4, 5, 6, 0];

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
        if (!await ui.confirm('Delete this entire weekly class series?', { title: 'Delete class series', confirmLabel: 'Delete', danger: true })) return;
        const { error } = await sb.from('class_schedule').delete().eq('id', btn.dataset.id);
        if (error) return ui.alert(error.message, { title: 'Something went wrong' });
        await loadScheduleModal();
        load();
      });
    });
  }

  function openScheduleForm(s) {
    editingScheduleId = s ? s.id : null;
    scheduleDeleteBtn.hidden = !s;
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
      ui.alert(err.message, { title: 'Something went wrong' });
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
    if (error) return ui.alert(error.message, { title: 'Something went wrong' });
    openScheduleForm(null);
    await loadScheduleModal();
    load();
  });

  scheduleDeleteBtn.addEventListener('click', async () => {
    if (!editingScheduleId) return;
    if (!await ui.confirm('Delete this entire weekly class series?', { title: 'Delete class series', confirmLabel: 'Delete', danger: true })) return;
    if (!editingScheduleId) return;
    const { error } = await sb.from('class_schedule').delete().eq('id', editingScheduleId);
    if (error) return ui.alert(error.message, { title: 'Something went wrong' });
    openScheduleForm(null);
    await loadScheduleModal();
    load();
  });

  return {
    load,
    fabTargetDate: () => (viewMode() === 'day' ? App.toISO(selectedDate) : App.toISO(new Date())),
  };
})();
