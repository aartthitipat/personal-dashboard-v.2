(function () {
  'use strict';

  var SVG_NS = 'http://www.w3.org/2000/svg';
  var THEME_KEY = 'dashboard-theme';
  var MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
  var WEEKDAYS = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];

  // ---- Data (all totals and deltas are derived from `daily`) ----

  var user = { name: 'Art' };

  var daily = [
    { date: '2026-10-06', income: 1200, expense: 640 },
    { date: '2026-10-07', income: 0, expense: 420 },
    { date: '2026-10-08', income: 2500, expense: 780 },
    { date: '2026-10-09', income: 800, expense: 350 },
    { date: '2026-10-10', income: 0, expense: 1410 },
    { date: '2026-10-11', income: 1500, expense: 560 },
    { date: '2026-10-12', income: 3200, expense: 1700 },
    { date: '2026-10-13', income: 600, expense: 380 },
    { date: '2026-10-14', income: 0, expense: 450 },
    { date: '2026-10-15', income: 2200, expense: 690 },
    { date: '2026-10-16', income: 900, expense: 520 },
    { date: '2026-10-17', income: 1700, expense: 840 },
    { date: '2026-10-18', income: 0, expense: 330 },
    { date: '2026-10-19', income: 3800, expense: 800 }
  ];

  var weekdaySpend = [620, 540, 690, 710, 980, 1150, 760]; // Mon..Sun

  var stats = {
    balance: 48250,
    prevIncome14: 16200,
    prevExpense14: 11030,
    goal: { label: 'Emergency fund', current: 32000, target: 50000 }
  };

  var budgets = [
    { category: 'Food', spent: 3120, limit: 4000 },
    { category: 'Transport', spent: 1450, limit: 1500 },
    { category: 'Shopping', spent: 2300, limit: 2000 }
  ];

  var TODAY = { y: 2026, m: 9, d: 19 }; // data reference date, keeps charge dates deterministic
  var subscriptions = [
    { name: 'Spotify', amount: 149, day: 12 },
    { name: 'Netflix', amount: 419, day: 15 },
    { name: 'YouTube Premium', amount: 179, day: 21 },
    { name: 'iCloud+', amount: 35, day: 24 },
    { name: 'Notion Plus', amount: 160, day: 28 }
  ];

  var events = [
    { title: 'Calculus lecture', when: 'Mon 09:00', cat: 'session' },
    { title: 'Physics exam', when: 'Thu 13:00', cat: 'exam' },
    { title: 'Submit lab report', when: 'Fri 23:59', cat: 'task' }
  ];
  var CAT_COLOR = {
    session: 'var(--color-primary)',
    exam: 'var(--color-tertiary)',
    task: 'var(--color-secondary)'
  };

  // ---- Helpers ----

  var animate = !(window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches);
  var pendingArcs = [];

  function fmt(n) {
    return Number(n).toLocaleString('th-TH', {
      style: 'currency',
      currency: 'THB',
      minimumFractionDigits: 0,
      maximumFractionDigits: 0
    });
  }

  function el(tag, attrs, children) {
    var node = document.createElementNS(SVG_NS, tag);
    if (attrs) {
      Object.keys(attrs).forEach(function (k) { node.setAttribute(k, attrs[k]); });
    }
    (children || []).forEach(function (c) { node.appendChild(c); });
    return node;
  }

  function h(tag, cls, text) {
    var node = document.createElement(tag);
    if (cls) node.className = cls;
    if (text != null) node.textContent = text;
    return node;
  }

  function svgHtml(markup) {
    var wrap = document.createElement('span');
    wrap.innerHTML = markup;
    return wrap.firstChild;
  }

  function sum(rows, key) {
    return rows.reduce(function (t, r) { return t + r[key]; }, 0);
  }

  function dateLabel(iso) {
    var p = iso.split('-');
    return MONTHS[Number(p[1]) - 1] + ' ' + Number(p[2]);
  }

  function niceCeil(v) {
    if (v <= 0) return 1;
    var k = Math.pow(10, Math.floor(Math.log(v) / Math.LN10));
    var m = v / k;
    var n = m <= 1 ? 1 : m <= 2 ? 2 : m <= 5 ? 5 : 10;
    return n * k;
  }

  function compact(v) {
    var a = Math.abs(v);
    var s = a >= 1000 ? (a / 1000) + 'k' : String(a);
    return (v < 0 ? '−' : '') + s;
  }

  // ---- Rings ----

  function ring(size, stroke, p, label) {
    var r = (size - stroke) / 2;
    var c = 2 * Math.PI * r;
    var cx = size / 2;
    var over = p > 1;
    var target = c * (1 - Math.min(p, 1));
    var arc = el('circle', {
      'class': 'dp-ring-arc' + (over ? ' dp-over' : ''),
      cx: cx, cy: cx, r: r,
      'stroke-width': stroke,
      'stroke-dasharray': c,
      transform: 'rotate(-90 ' + cx + ' ' + cx + ')'
    });
    arc.style.strokeDashoffset = animate ? c : target;
    if (animate) pendingArcs.push({ arc: arc, target: target });
    var svg = el('svg', { viewBox: '0 0 ' + size + ' ' + size, width: size, height: size, 'aria-hidden': 'true' }, [
      el('circle', { 'class': 'dp-ring-track', cx: cx, cy: cx, r: r, 'stroke-width': stroke }),
      arc
    ]);
    var wrap = h('span', 'dp-ring' + (size <= 44 ? ' dp-ring-sm' : ''));
    wrap.appendChild(svg);
    wrap.appendChild(h('span', 'dp-ring-pct', label));
    return wrap;
  }

  function flushArcs() {
    if (!pendingArcs.length) return;
    var list = pendingArcs;
    pendingArcs = [];
    requestAnimationFrame(function () {
      requestAnimationFrame(function () {
        list.forEach(function (a) { a.arc.style.strokeDashoffset = a.target; });
      });
    });
  }

  // ---- Spending overview chart ----

  function renderChart(range) {
    var rows = daily.slice(-range);
    var W = 640, H = 240;
    var padL = 40, padR = 8, padT = 12, padB = 28;
    var plotH = H - padT - padB;
    var plotW = W - padL - padR;
    var maxV = niceCeil(Math.max.apply(null, rows.map(function (r) { return r.income; })));
    var minV = -niceCeil(Math.max.apply(null, rows.map(function (r) { return r.expense; })));
    function y(v) { return padT + (maxV - v) / (maxV - minV) * plotH; }
    var zeroY = y(0);
    var slot = plotW / rows.length;
    var bw = slot * 0.42;

    var totalIn = sum(rows, 'income');
    var totalOut = sum(rows, 'expense');
    var peakIn = rows.reduce(function (a, b) { return b.income > a.income ? b : a; });
    var peakOut = rows.reduce(function (a, b) { return b.expense > a.expense ? b : a; });
    var descText = 'Daily income and expenses for the last ' + range + ' days. Total income ' + fmt(totalIn) +
      ', total expenses ' + fmt(totalOut) + '. Highest income ' + fmt(peakIn.income) + ' on ' + dateLabel(peakIn.date) +
      '; highest expense ' + fmt(peakOut.expense) + ' on ' + dateLabel(peakOut.date) + '.';

    var title = el('title', { id: 'dp-chart-svg-title' });
    title.textContent = 'Income and expenses by day';
    var desc = el('desc', { id: 'dp-chart-svg-desc' });
    desc.textContent = descText;

    var svg = el('svg', {
      viewBox: '0 0 ' + W + ' ' + H,
      role: 'img',
      'aria-labelledby': 'dp-chart-svg-title dp-chart-svg-desc'
    }, [title, desc]);

    [maxV, maxV / 2, minV / 2, minV].forEach(function (v) {
      svg.appendChild(el('line', { 'class': 'dp-grid', x1: padL, x2: W - padR, y1: y(v), y2: y(v) }));
    });
    svg.appendChild(el('line', { 'class': 'dp-zero', x1: padL, x2: W - padR, y1: zeroY, y2: zeroY }));

    [maxV, maxV / 2, 0, minV / 2, minV].forEach(function (v) {
      var t = el('text', { 'class': 'dp-tick', x: padL - 6, y: y(v), 'text-anchor': 'end', 'dominant-baseline': 'middle' });
      t.textContent = compact(v);
      svg.appendChild(t);
    });

    rows.forEach(function (r, i) {
      var cx = padL + slot * i + slot / 2;
      var g = el('g');
      var t = el('title');
      t.textContent = dateLabel(r.date) + ': income ' + fmt(r.income) + ', expense ' + fmt(r.expense);
      g.appendChild(t);
      g.appendChild(el('rect', { 'class': 'dp-hit', x: cx - slot / 2, y: padT, width: slot, height: plotH }));
      if (r.income > 0) {
        g.appendChild(el('rect', {
          'class': 'dp-bar-in', x: cx - bw / 2, y: y(r.income), width: bw, height: zeroY - y(r.income), rx: 3
        }));
      }
      if (r.expense > 0) {
        g.appendChild(el('rect', {
          'class': 'dp-bar-out', x: cx - bw / 2, y: zeroY, width: bw, height: y(-r.expense) - zeroY, rx: 3
        }));
      }
      if (i % 2 === 0) {
        var lab = el('text', { 'class': 'dp-tick', x: cx, y: H - 8, 'text-anchor': 'middle' });
        lab.textContent = dateLabel(r.date);
        g.appendChild(lab);
      }
      svg.appendChild(g);
    });

    var mount = document.getElementById('dp-chart');
    mount.replaceChildren(svg);

    // Visually hidden table with the same data
    var table = h('table', 'dp-sr-only');
    var cap = h('caption', null, 'Income and expenses by day, last ' + range + ' days');
    table.appendChild(cap);
    var thead = h('thead');
    var hr = h('tr');
    ['Date', 'Income', 'Expense'].forEach(function (c) {
      var th = h('th', null, c);
      th.scope = 'col';
      hr.appendChild(th);
    });
    thead.appendChild(hr);
    table.appendChild(thead);
    var tbody = h('tbody');
    rows.forEach(function (r) {
      var tr = h('tr');
      tr.appendChild(h('th', null, dateLabel(r.date)));
      tr.lastChild.scope = 'row';
      tr.appendChild(h('td', null, fmt(r.income)));
      tr.appendChild(h('td', null, fmt(r.expense)));
      tbody.appendChild(tr);
    });
    table.appendChild(tbody);
    document.getElementById('dp-chart-table').replaceChildren(table);

    // On narrow screens the chart scrolls sideways; start at the most recent days.
    var sc = document.getElementById('dp-chart-scroll');
    sc.scrollLeft = sc.scrollWidth;
  }

  // ---- Stat cards ----

  var ARROW = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" width="16" height="16" aria-hidden="true"><path d="M7 17L17 7M9 7h8v8"/></svg>';
  var TREND_ARROW = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round" width="14" height="14" aria-hidden="true"><path d="M7 17L17 7M9 7h8v8"/></svg>';

  function trend(dir, text) {
    var t = h('div', 'dp-trend dp-trend-' + dir);
    // north-east arrow; the down variant is rotated by CSS to point south-east
    t.appendChild(svgHtml(TREND_ARROW));
    t.appendChild(h('span', null, text));
    return t;
  }

  function pctChange(now, prev) {
    var p = (now - prev) / prev * 100;
    return { dir: p >= 0 ? 'up' : 'down', text: (p >= 0 ? '+' : '−') + Math.abs(p).toFixed(1) + '%' };
  }

  function statCard(label, valueNode, cls) {
    var card = h('article', 'dp-card dp-stat' + (cls ? ' ' + cls : ''));
    var a = h('a', 'dp-card-link');
    a.href = 'index.html';
    a.setAttribute('aria-label', 'Open in Finances');
    a.appendChild(svgHtml(ARROW));
    card.appendChild(a);
    card.appendChild(h('div', 'dp-stat-label', label));
    if (valueNode) card.appendChild(valueNode);
    return card;
  }

  function valueEl(text, big) {
    return h('div', 'dp-stat-value' + (big ? ' dp-big' : ''), text);
  }

  function renderMini(host) {
    var W = 200, H = 120, top = 26, bottom = 18;
    var base = H - bottom;
    var plotH = base - top;
    var max = Math.max.apply(null, weekdaySpend);
    var hi = weekdaySpend.indexOf(max);
    var slot = W / 7, bw = 14;
    var summary = 'Average spend by weekday: ' + WEEKDAYS.map(function (d, i) {
      return d + ' ' + fmt(weekdaySpend[i]);
    }).join(', ') + '. Highest on ' + WEEKDAYS[hi] + '.';
    var svg = el('svg', { viewBox: '0 0 ' + W + ' ' + H, role: 'img', 'aria-label': summary });
    weekdaySpend.forEach(function (v, i) {
      var cx = slot * i + slot / 2;
      var bh = v / max * plotH;
      var g = el('g');
      var t = el('title');
      t.textContent = WEEKDAYS[i] + ': ' + fmt(v);
      g.appendChild(t);
      g.appendChild(el('rect', {
        'class': 'dp-mini-bar' + (i === hi ? ' dp-top-bar' : ''),
        x: cx - bw / 2, y: base - bh, width: bw, height: bh, rx: 3
      }));
      var lab = el('text', { 'class': 'dp-tick', x: cx, y: H - 4, 'text-anchor': 'middle' });
      lab.textContent = WEEKDAYS[i];
      g.appendChild(lab);
      svg.appendChild(g);
      if (i === hi) {
        var label = fmt(v);
        var pw = label.length * 7 + 12;
        var px = Math.min(Math.max(cx - pw / 2, 0), W - pw);
        var py = Math.max(base - bh - 24, 0);
        svg.appendChild(el('rect', { 'class': 'dp-mini-pill', x: px, y: py, width: pw, height: 18, rx: 9 }));
        var pt = el('text', {
          'class': 'dp-mini-pill-text', x: px + pw / 2, y: py + 9, 'text-anchor': 'middle', 'dominant-baseline': 'central'
        });
        pt.textContent = label;
        svg.appendChild(pt);
      }
    });
    var wrap = h('div', 'dp-mini');
    wrap.appendChild(svg);
    host.appendChild(wrap);
  }

  function renderStats(range) {
    var rows = daily.slice(-range);
    var inc = sum(rows, 'income');
    var exp = sum(rows, 'expense');
    var prevInc, prevExp, prevLabel;
    if (range === 14) {
      prevInc = stats.prevIncome14;
      prevExp = stats.prevExpense14;
      prevLabel = 'vs prior 14 days';
    } else {
      var first = daily.slice(0, daily.length - range);
      prevInc = sum(first, 'income');
      prevExp = sum(first, 'expense');
      prevLabel = 'vs prior ' + range + ' days';
    }
    var net = inc - exp;
    var avg = exp / range;
    var prevAvg = prevExp / range;
    var grid = document.getElementById('dp-stats');
    grid.replaceChildren();

    // Balance
    var bal = statCard('Balance', valueEl(fmt(stats.balance), true));
    bal.appendChild(trend(net >= 0 ? 'up' : 'down',
      (net >= 0 ? '+' : '−') + fmt(Math.abs(net)) + ' net, ' + range + 'd'));
    grid.appendChild(bal);

    // Avg daily spend with weekday mini chart
    var avgCard = statCard('Avg daily spend', valueEl(fmt(Math.round(avg))), 'dp-stat-mini');
    var ac = pctChange(avg, prevAvg);
    avgCard.appendChild(trend(ac.dir, ac.text + ' ' + prevLabel));
    avgCard.lastChild.style.marginTop = '0';
    renderMini(avgCard);
    grid.appendChild(avgCard);

    // Income
    var incCard = statCard('Income, ' + range + 'd', valueEl(fmt(inc)));
    var ic = pctChange(inc, prevInc);
    incCard.appendChild(trend(ic.dir, ic.text + ' ' + prevLabel));
    grid.appendChild(incCard);

    // Expenses
    var expCard = statCard('Expenses, ' + range + 'd', valueEl(fmt(exp)));
    var ec = pctChange(exp, prevExp);
    expCard.appendChild(trend(ec.dir, ec.text + ' ' + prevLabel));
    grid.appendChild(expCard);

    // Savings goal
    var g = stats.goal;
    var pct = Math.round(g.current / g.target * 100);
    var goalVal = valueEl(fmt(g.current));
    goalVal.appendChild(document.createTextNode(' '));
    goalVal.appendChild(h('small', null, '/ ' + fmt(g.target)));
    var goalCard = statCard('Savings goal, ' + g.label, goalVal);
    var track = h('div', 'dp-track');
    track.setAttribute('role', 'progressbar');
    track.setAttribute('aria-label', g.label + ' progress');
    track.setAttribute('aria-valuemin', '0');
    track.setAttribute('aria-valuemax', '100');
    track.setAttribute('aria-valuenow', String(pct));
    var fill = h('div', 'dp-track-fill');
    fill.style.width = pct + '%';
    track.appendChild(fill);
    goalCard.appendChild(track);
    var gt = h('div', 'dp-trend', pct + '% of goal');
    goalCard.appendChild(gt);
    grid.appendChild(goalCard);
  }

  // ---- Side column ----

  function renderBudgets() {
    var ul = document.getElementById('dp-budgets');
    budgets.forEach(function (b) {
      var p = b.spent / b.limit;
      var li = h('li', 'dp-row');
      li.appendChild(ring(56, 6, p, Math.round(p * 100) + '%'));
      var main = h('div', 'dp-row-main');
      main.appendChild(h('div', 'dp-row-title', b.category));
      main.appendChild(h('div', 'dp-row-sub', fmt(b.spent) + ' / ' + fmt(b.limit)));
      li.appendChild(main);
      ul.appendChild(li);
    });
  }

  function nextCharge(day) {
    var d = new Date(TODAY.y, TODAY.m, day);
    if (d < new Date(TODAY.y, TODAY.m, TODAY.d)) d = new Date(TODAY.y, TODAY.m + 1, day);
    return { time: d.getTime(), label: MONTHS[d.getMonth()] + ' ' + d.getDate() };
  }

  function renderSubs() {
    var ul = document.getElementById('dp-subs');
    var total = sum(subscriptions, 'amount');
    var list = subscriptions.map(function (s) {
      var n = nextCharge(s.day);
      return { name: s.name, amount: s.amount, time: n.time, label: n.label };
    });
    var featured = list.slice().sort(function (a, b) { return b.amount - a.amount; }).slice(0, 2);
    var rest = list.filter(function (s) { return featured.indexOf(s) === -1; })
      .sort(function (a, b) { return a.time - b.time; });

    function row(s, isFeature) {
      var li = h('li', 'dp-row' + (isFeature ? ' dp-row-feature' : ''));
      if (isFeature) {
        var share = s.amount / total;
        li.appendChild(ring(44, 5, share, Math.round(share * 100) + '%'));
      }
      var main = h('div', 'dp-row-main');
      main.appendChild(h('div', 'dp-row-title', s.name));
      main.appendChild(h('div', 'dp-row-sub', 'Next ' + s.label));
      li.appendChild(main);
      li.appendChild(h('div', 'dp-row-amount', fmt(s.amount)));
      return li;
    }
    featured.forEach(function (s) { ul.appendChild(row(s, true)); });
    rest.forEach(function (s) { ul.appendChild(row(s, false)); });
  }

  // ---- Sidebar, top row ----

  function renderEvents() {
    var ul = document.getElementById('dp-events-list');
    events.forEach(function (e) {
      var li = h('li', 'dp-event');
      var dot = h('span', 'dp-ring-dot');
      dot.setAttribute('aria-hidden', 'true');
      dot.style.setProperty('--dp-cat', CAT_COLOR[e.cat]);
      li.appendChild(dot);
      var box = h('div');
      box.appendChild(h('div', 'dp-event-title', e.title));
      box.appendChild(h('div', 'dp-event-time', e.when));
      li.appendChild(box);
      ul.appendChild(li);
    });
  }

  function renderGreeting() {
    var hr = new Date().getHours();
    var part = hr < 12 ? 'morning' : hr < 18 ? 'afternoon' : 'evening';
    document.getElementById('dp-greeting').textContent = 'Good ' + part + ', ' + user.name;
    var initial = user.name.charAt(0).toUpperCase();
    document.getElementById('dp-top-initial').textContent = initial;
    document.getElementById('dp-user-initial').textContent = initial;
    document.getElementById('dp-user-name').textContent = user.name;
  }

  // ---- Theme ----

  var MOON = '<svg viewBox="0 0 24 24" fill="currentColor" width="18" height="18" aria-hidden="true"><path d="M20.354 15.354A9 9 0 018.646 3.646 9.003 9.003 0 0012 21a9.003 9.003 0 008.354-5.646z"/></svg>';
  var SUN = '<svg viewBox="0 0 24 24" fill="none" stroke-width="1.8" stroke="currentColor" width="18" height="18" aria-hidden="true"><circle cx="12" cy="12" r="4"/><path stroke-linecap="round" d="M12 2v2M12 20v2M4.93 4.93l1.41 1.41M17.66 17.66l1.41 1.41M2 12h2M20 12h2M4.93 19.07l1.41-1.41M17.66 6.34l1.41-1.41"/></svg>';

  function setupTheme() {
    var btn = document.getElementById('dp-theme');
    function paint() {
      var dark = document.documentElement.getAttribute('data-theme') === 'dark';
      btn.innerHTML = dark ? SUN : MOON;
      btn.setAttribute('aria-pressed', dark ? 'true' : 'false');
    }
    btn.addEventListener('click', function () {
      var dark = document.documentElement.getAttribute('data-theme') === 'dark';
      var next = dark ? 'light' : 'dark';
      document.documentElement.setAttribute('data-theme', next);
      try { localStorage.setItem(THEME_KEY, next); } catch (e) {}
      paint();
    });
    paint();
  }

  // ---- Init ----

  function render(range) {
    renderChart(range);
    renderStats(range);
    flushArcs();
  }

  function init() {
    if (animate) document.getElementById('dp-frame').classList.add('dp-animate');
    renderGreeting();
    renderEvents();
    renderBudgets();
    renderSubs();
    setupTheme();
    render(14);
    flushArcs();
    document.getElementById('dp-range').addEventListener('change', function (e) {
      render(Number(e.target.value));
    });
  }

  init();
})();
