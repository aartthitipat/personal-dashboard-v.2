// Shared SVG chart builders: diverging stacked bars, weekday mini bars, progress rings.
// Colours and motion live in css/style.css (.chart-*, .ring-*); nothing here sets a colour.

const Charts = (() => {
  const SVG_NS = 'http://www.w3.org/2000/svg';
  const motion = !(window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches);
  let pendingArcs = [];

  function el(tag, attrs, children) {
    const node = document.createElementNS(SVG_NS, tag);
    if (attrs) Object.keys(attrs).forEach((k) => node.setAttribute(k, attrs[k]));
    (children || []).forEach((c) => node.appendChild(c));
    return node;
  }

  function html(tag, cls, text) {
    const node = document.createElement(tag);
    if (cls) node.className = cls;
    if (text != null) node.textContent = text;
    return node;
  }

  function text(tag, attrs, str) {
    const node = el(tag, attrs);
    node.textContent = str;
    return node;
  }

  function niceCeil(v) {
    if (v <= 0) return 0;
    const k = Math.pow(10, Math.floor(Math.log10(v)));
    const m = v / k;
    return (m <= 1 ? 1 : m <= 2 ? 2 : m <= 5 ? 5 : 10) * k;
  }

  function compact(v) {
    const a = Math.abs(v);
    const s = a >= 1000 ? `${Math.round(a / 10) / 100}k` : String(Math.round(a * 100) / 100);
    return (v < 0 ? '−' : '') + s;
  }

  const sum = (rows, key) => rows.reduce((t, r) => t + r[key], 0);

  // ---- Rings ----

  // p is a ratio (1 = full). Over 100% turns the arc to the error colour.
  function ring(size, stroke, p, label) {
    const r = (size - stroke) / 2;
    const c = 2 * Math.PI * r;
    const cx = size / 2;
    const target = c * (1 - Math.min(Math.max(p, 0), 1));
    const arc = el('circle', {
      class: `ring-arc${p > 1 ? ' over' : ''}`,
      cx, cy: cx, r,
      'stroke-width': stroke,
      'stroke-dasharray': c,
      transform: `rotate(-90 ${cx} ${cx})`,
    });
    arc.style.strokeDashoffset = motion ? c : target;
    if (motion) pendingArcs.push({ arc, target });
    const svg = el('svg', { viewBox: `0 0 ${size} ${size}`, width: size, height: size, 'aria-hidden': 'true' }, [
      el('circle', { class: 'ring-track', cx, cy: cx, r, 'stroke-width': stroke }),
      arc,
    ]);
    const wrap = html('span', `ring${size <= 44 ? ' ring-sm' : ''}`);
    wrap.appendChild(svg);
    wrap.appendChild(html('span', 'ring-pct', label));
    return wrap;
  }

  // Rings start empty and are filled on the next frames so the CSS transition runs.
  function flushArcs() {
    if (!pendingArcs.length) return;
    const list = pendingArcs;
    pendingArcs = [];
    requestAnimationFrame(() => requestAnimationFrame(() => {
      list.forEach((a) => { a.arc.style.strokeDashoffset = a.target; });
    }));
  }

  // ---- Diverging stacked bars: income above the zero line, expense below ----

  // rows: [{ label, income, expense, title }]; opts: { id, heading, every }
  // Mount gets the SVG plus a visually hidden table carrying the same data.
  function stackedBars(mount, rows, opts) {
    const { id, heading, every = 2, money = (n) => String(n) } = opts;
    const W = 640, H = 240;
    const padL = 40, padR = 8, padT = 12, padB = 28;
    const plotH = H - padT - padB;
    const plotW = W - padL - padR;
    let maxV = niceCeil(Math.max(0, ...rows.map((r) => r.income)));
    let minV = -niceCeil(Math.max(0, ...rows.map((r) => r.expense)));
    if (maxV === 0 && minV === 0) { maxV = 100; minV = -100; }
    if (maxV === 0) maxV = -minV / 2;
    if (minV === 0) minV = -maxV / 2;
    const y = (v) => padT + ((maxV - v) / (maxV - minV)) * plotH;
    const zeroY = y(0);
    const slot = plotW / Math.max(rows.length, 1);
    const bw = Math.min(slot * 0.42, 28);

    const totalIn = sum(rows, 'income');
    const totalOut = sum(rows, 'expense');
    const desc = `${heading}. Total income ${money(totalIn)}, total expenses ${money(totalOut)}.`;
    const svg = el('svg', {
      viewBox: `0 0 ${W} ${H}`,
      role: 'img',
      'aria-labelledby': `${id}-title ${id}-desc`,
    }, [text('title', { id: `${id}-title` }, heading), text('desc', { id: `${id}-desc` }, desc)]);
    svg.style.minWidth = `${rows.length * 26 + 48}px`;

    [maxV, maxV / 2, minV / 2, minV].forEach((v) => {
      svg.appendChild(el('line', { class: 'chart-grid', x1: padL, x2: W - padR, y1: y(v), y2: y(v) }));
    });
    svg.appendChild(el('line', { class: 'chart-zero', x1: padL, x2: W - padR, y1: zeroY, y2: zeroY }));
    [maxV, maxV / 2, 0, minV / 2, minV].forEach((v) => {
      svg.appendChild(text('text', { class: 'chart-tick', x: padL - 6, y: y(v), 'text-anchor': 'end', 'dominant-baseline': 'middle' }, compact(v)));
    });

    rows.forEach((r, i) => {
      const cx = padL + slot * i + slot / 2;
      const g = el('g');
      g.appendChild(text('title', {}, `${r.label}: income ${money(r.income)}, expense ${money(r.expense)}`));
      g.appendChild(el('rect', { class: 'chart-hit', x: cx - slot / 2, y: padT, width: slot, height: plotH }));
      if (r.income > 0) {
        g.appendChild(el('rect', { class: 'bar-in', x: cx - bw / 2, y: y(r.income), width: bw, height: zeroY - y(r.income), rx: 3 }));
      }
      if (r.expense > 0) {
        g.appendChild(el('rect', { class: 'bar-out', x: cx - bw / 2, y: zeroY, width: bw, height: y(-r.expense) - zeroY, rx: 3 }));
      }
      if (i % every === 0) {
        g.appendChild(text('text', { class: 'chart-tick', x: cx, y: H - 8, 'text-anchor': 'middle' }, r.label));
      }
      svg.appendChild(g);
    });

    const table = html('table', 'sr-only');
    table.appendChild(html('caption', null, heading));
    const hr = html('tr');
    ['Period', 'Income', 'Expense'].forEach((c) => {
      const th = html('th', null, c);
      th.scope = 'col';
      hr.appendChild(th);
    });
    const thead = html('thead');
    thead.appendChild(hr);
    table.appendChild(thead);
    const tbody = html('tbody');
    rows.forEach((r) => {
      const tr = html('tr');
      const th = html('th', null, r.label);
      th.scope = 'row';
      tr.appendChild(th);
      tr.appendChild(html('td', null, money(r.income)));
      tr.appendChild(html('td', null, money(r.expense)));
      tbody.appendChild(tr);
    });
    table.appendChild(tbody);
    mount.replaceChildren(svg, table);
  }

  // ---- Weekday mini bars: the tallest bar is highlighted and labelled ----

  // values / labels have the same length (seven for a week).
  function miniBars(host, values, labels, money) {
    const W = 200, H = 120, top = 26, bottom = 18;
    const base = H - bottom;
    const plotH = base - top;
    const max = Math.max(...values);
    const hi = max > 0 ? values.indexOf(max) : -1;
    const slot = W / values.length, bw = 14;
    const summary = `Average spend by weekday: ${labels.map((d, i) => `${d} ${money(values[i])}`).join(', ')}.${hi >= 0 ? ` Highest on ${labels[hi]}.` : ''}`;
    const svg = el('svg', { viewBox: `0 0 ${W} ${H}`, role: 'img', 'aria-label': summary });
    values.forEach((v, i) => {
      const cx = slot * i + slot / 2;
      const bh = max > 0 ? (v / max) * plotH : 0;
      const g = el('g');
      g.appendChild(text('title', {}, `${labels[i]}: ${money(v)}`));
      g.appendChild(el('rect', {
        class: `mini-bar${i === hi ? ' top' : ''}`,
        x: cx - bw / 2, y: base - bh, width: bw, height: bh, rx: 3,
      }));
      g.appendChild(text('text', { class: 'chart-tick', x: cx, y: H - 4, 'text-anchor': 'middle' }, labels[i]));
      svg.appendChild(g);
      if (i === hi) {
        const label = money(v);
        const pw = label.length * 7 + 12;
        const px = Math.min(Math.max(cx - pw / 2, 0), W - pw);
        const py = Math.max(base - bh - 24, 0);
        svg.appendChild(el('rect', { class: 'mini-pill', x: px, y: py, width: pw, height: 18, rx: 9 }));
        svg.appendChild(text('text', { class: 'mini-pill-text', x: px + pw / 2, y: py + 9, 'text-anchor': 'middle', 'dominant-baseline': 'central' }, label));
      }
    });
    const wrap = html('div', 'mini-chart');
    wrap.appendChild(svg);
    host.appendChild(wrap);
  }

  return { stackedBars, miniBars, ring, flushArcs, html };
})();
