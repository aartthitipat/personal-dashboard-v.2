const sb = supabase.createClient(SUPABASE_URL, SUPABASE_PUBLISHABLE_KEY);

const App = {
  currency(n) {
    return (Number(n) || 0).toLocaleString('th-TH', { style: 'currency', currency: 'THB' });
  },
  signedCurrency(n) {
    const v = Number(n) || 0;
    return `${v < 0 ? '−' : '+'}${App.currency(Math.abs(v))}`;
  },
  pad(n) {
    return String(n).padStart(2, '0');
  },
  toISO(d) {
    return `${d.getFullYear()}-${App.pad(d.getMonth() + 1)}-${App.pad(d.getDate())}`;
  },
  addDays(d, n) {
    const r = new Date(d);
    r.setDate(r.getDate() + n);
    r.setHours(0, 0, 0, 0);
    return r;
  },
  startOfWeek(d) {
    const r = new Date(d);
    r.setHours(0, 0, 0, 0);
    r.setDate(r.getDate() - r.getDay());
    return r;
  },
  startOfMonthGrid(d) {
    return App.startOfWeek(new Date(d.getFullYear(), d.getMonth(), 1));
  },
  escapeHtml(str) {
    const div = document.createElement('div');
    div.textContent = str == null ? '' : str;
    return div.innerHTML.replace(/"/g, '&quot;').replace(/'/g, '&#39;');
  },
  safeUrl(str) {
    try {
      const u = new URL(str, location.href);
      return /^https?:$/.test(u.protocol) ? u.href : '#';
    } catch {
      return '#';
    }
  },

  bindActivate(el, label) {
    el.setAttribute('tabindex', '0');
    el.setAttribute('role', 'button');
    if (label) el.setAttribute('aria-label', label);
    el.addEventListener('keydown', (e) => {
      if (e.key === 'Enter' || e.key === ' ' || e.key === 'Spacebar') {
        e.preventDefault();
        el.click();
      }
    });
  },
  TYPE_CLASS: { session: 'session', exam: 'exam', deadline: 'deadline', task: 'task' },

  emptyState(iconPath, title, hint, actionLabel) {
    return `
      <div class="empty-state">
        <span class="empty-icon" aria-hidden="true"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" width="20" height="20">${iconPath}</svg></span>
        <p class="empty-title">${title}</p>
        <p class="empty-hint">${hint}</p>
        ${actionLabel ? `<button type="button" class="btn btn-secondary" data-empty-action>${actionLabel}</button>` : ''}
      </div>
    `;
  },

  setDisclosure(wrap, button, open, focusFirst) {
    wrap.classList.toggle('open', open);
    if (button) button.setAttribute('aria-expanded', String(open));
    if (open && focusFirst) {
      const first = wrap.querySelector('.field');
      if (first) first.focus({ preventScroll: true });
    }
  },

  expandClassSchedule(schedules, exceptions, rangeStartISO, rangeEndISO) {
    const exceptionKeys = new Set(exceptions.map((e) => `${e.schedule_id}:${e.date}`));
    const occurrences = [];
    const [sy, sm, sd] = rangeStartISO.split('-').map(Number);
    const [ey, em, ed] = rangeEndISO.split('-').map(Number);
    let cursor = new Date(sy, sm - 1, sd);
    const end = new Date(ey, em - 1, ed);
    while (cursor <= end) {
      const iso = App.toISO(cursor);
      const dow = cursor.getDay();
      schedules.forEach((s) => {
        if (!App.classScheduleAppliesOn(s, dow, iso, exceptionKeys)) return;
        occurrences.push({
          id: `sched-${s.id}-${iso}`,
          schedule_id: s.id,
          recurring: true,
          title: s.title,
          type: 'session',
          date: iso,
          start_time: s.start_time,
          end_time: s.end_time,
          location: s.location,
        });
      });
      cursor = App.addDays(cursor, 1);
    }
    return occurrences;
  },

  async cancelClassOccurrence(scheduleId, dateISO, title) {
    const ok = await ui.confirm(`Cancel "${title}" on ${dateISO}? The rest of the weekly series will keep repeating.`, { title: 'Cancel this class?', confirmLabel: 'Cancel class', cancelLabel: 'Keep class', danger: true });
    if (!ok) return false;
    const { error } = await sb.from('class_schedule_exceptions').insert({ schedule_id: scheduleId, date: dateISO });
    if (error) {
      ui.alert(error.message, { title: 'Something went wrong' });
      return false;
    }
    return true;
  },

  classScheduleAppliesOn(schedule, dayOfWeek, iso, exceptionKeys) {
    if (schedule.day_of_week !== dayOfWeek) return false;
    if (iso < schedule.valid_from) return false;
    if (schedule.valid_until && iso > schedule.valid_until) return false;
    if (exceptionKeys.has(`${schedule.id}:${iso}`)) return false;
    return true;
  },
};

const FieldErrors = (() => {
  function messageFor(field) {
    const v = field.validity;
    if (v.valueMissing) return 'This field is required.';
    if (v.typeMismatch && field.type === 'url') return 'Enter a full link starting with https://';
    if (v.rangeUnderflow) return `Enter ${field.min} or more.`;
    if (v.rangeOverflow) return `Enter ${field.max} or less.`;
    return field.validationMessage || 'Check this value.';
  }

  function helperFor(field) {
    const wrap = field.closest('.form-field');
    if (!wrap) return null;
    let help = wrap.querySelector('.field-help');
    if (!help) {
      help = document.createElement('p');
      help.className = 'field-help';
      help.id = `${field.id}-help`;
      wrap.appendChild(help);
    }
    return help;
  }

  function show(field) {
    const help = helperFor(field);
    field.setAttribute('aria-invalid', 'true');
    if (!help) return;
    help.textContent = messageFor(field);
    field.setAttribute('aria-describedby', help.id);
  }

  function clear(field) {
    field.removeAttribute('aria-invalid');
    field.removeAttribute('aria-describedby');
    const wrap = field.closest('.form-field');
    const help = wrap && wrap.querySelector('.field-help');
    if (help) help.remove();
  }

  document.addEventListener('invalid', (e) => {
    const field = e.target;
    if (!field.classList || !field.classList.contains('field')) return;
    e.preventDefault();
    show(field);
    if (field.form && field.form.querySelector(':invalid') === field) field.focus();
  }, true);

  document.addEventListener('submit', (e) => {
    const form = e.target;
    if (!form.matches || !form.matches('form[novalidate]')) return;
    if (!form.checkValidity()) {
      e.preventDefault();
      e.stopPropagation();
    }
  }, true);

  document.addEventListener('input', (e) => {
    const field = e.target;
    if (field.getAttribute && field.getAttribute('aria-invalid') && field.checkValidity()) clear(field);
  }, true);

  document.addEventListener('reset', (e) => {
    e.target.querySelectorAll('.field[aria-invalid]').forEach(clear);
  }, true);
})();

const Modals = (() => {
  const FOCUSABLE = 'a[href], button:not([disabled]), input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])';
  const coarse = window.matchMedia('(pointer: coarse)');
  const returnTo = new WeakMap();

  function openOverlay() {
    return document.querySelector('.modal-overlay.open');
  }

  const shell = document.querySelector('.app-frame');

  function syncInert() {
    if (!shell) return;
    shell.toggleAttribute('inert', !!openOverlay());
  }

  document.querySelectorAll('.modal-overlay').forEach((overlay) => {
    new MutationObserver(() => {
      const open = overlay.classList.contains('open');
      syncInert();
      if (open && !returnTo.has(overlay)) {
        returnTo.set(overlay, document.activeElement);
        const target = coarse.matches ? overlay.querySelector('.modal-close') : overlay.querySelector('.field');
        if (target) target.focus({ preventScroll: true });
      } else if (!open && returnTo.has(overlay)) {
        const prev = returnTo.get(overlay);
        returnTo.delete(overlay);
        if (prev && prev.focus && document.contains(prev)) prev.focus({ preventScroll: true });
      }
    }).observe(overlay, { attributes: true, attributeFilter: ['class'] });
  });

  document.addEventListener('keydown', (e) => {
    const overlay = openOverlay();
    if (!overlay) return;
    if (e.key === 'Escape') {
      const close = overlay.querySelector('.modal-close');
      if (close) close.click();
      return;
    }
    if (e.key !== 'Tab') return;
    const items = Array.from(overlay.querySelectorAll(FOCUSABLE)).filter((n) => n.offsetParent !== null);
    if (!items.length) return;
    const first = items[0];
    const last = items[items.length - 1];
    if (e.shiftKey && document.activeElement === first) {
      e.preventDefault();
      last.focus();
    } else if (!e.shiftKey && document.activeElement === last) {
      e.preventDefault();
      first.focus();
    } else if (!overlay.contains(document.activeElement)) {
      e.preventDefault();
      first.focus();
    }
  });
})();

const THEME_ICONS = {
  toDark: '<svg viewBox="0 0 24 24" fill="currentColor" width="18" height="18" aria-hidden="true"><path d="M20.354 15.354A9 9 0 018.646 3.646 9.003 9.003 0 0012 21a9.003 9.003 0 008.354-5.646z"/></svg>',
  toLight: '<svg viewBox="0 0 24 24" fill="none" stroke-width="1.8" stroke="currentColor" width="18" height="18" aria-hidden="true"><circle cx="12" cy="12" r="4"/><path stroke-linecap="round" d="M12 2v2M12 20v2M4.93 4.93l1.41 1.41M17.66 17.66l1.41 1.41M2 12h2M20 12h2M4.93 19.07l1.41-1.41M17.66 6.34l1.41-1.41"/></svg>',
};

const themeToggles = document.querySelectorAll('.theme-toggle');

function paintThemeToggles(dark) {
  themeToggles.forEach((btn) => {
    if (btn.classList.contains('side-theme')) {
      btn.innerHTML = `<span class="theme-row-label">${dark ? THEME_ICONS.toLight : THEME_ICONS.toDark}<span>Dark mode</span></span><span class="switch" aria-hidden="true"></span>`;
      btn.setAttribute('aria-checked', String(dark));
    } else {
      btn.innerHTML = dark ? THEME_ICONS.toLight : THEME_ICONS.toDark;
      btn.setAttribute('aria-label', dark ? 'Switch to light mode' : 'Switch to dark mode');
    }
  });
}

function applyTheme(dark) {
  document.documentElement.setAttribute('data-theme', dark ? 'dark' : 'light');
  paintThemeToggles(dark);
  try { localStorage.setItem('dashboard-theme', dark ? 'dark' : 'light'); } catch {}
}

themeToggles.forEach((btn) => {
  btn.addEventListener('click', () => {
    applyTheme(document.documentElement.getAttribute('data-theme') !== 'dark');
  });
});

paintThemeToggles(document.documentElement.getAttribute('data-theme') === 'dark');

const pages = document.querySelectorAll('.page');
const navButtons = document.querySelectorAll('.nav-item[data-nav]');
let currentPage = 'dashboard';

const PAGE_TITLES = {
  dashboard: 'Dashboard',
  finances: 'Finances',
  calendar: 'Calendar',
  study: 'Study',
  websites: 'Websites',
  checklist: 'Checklist',
};

function goPage(name, moveFocus) {
  currentPage = name;
  document.title = `${PAGE_TITLES[name] || name} - Personal Dashboard`;
  pages.forEach((p) => p.classList.toggle('active', p.id === `page-${name}`));
  navButtons.forEach((b) => {
    const on = b.dataset.nav === name;
    b.classList.toggle('active', on);
    if (on) b.setAttribute('aria-current', 'page');
    else b.removeAttribute('aria-current');
  });
  document.getElementById('app-main').scrollTop = 0;
  window.scrollTo(0, 0);
  if (moveFocus) {
    const h1 = document.querySelector(`#page-${name} h1`);
    if (h1) {
      h1.setAttribute('tabindex', '-1');
      h1.focus({ preventScroll: true });
    }
  }
  if (name === 'dashboard') Dashboard.load();
  if (name === 'finances') Finances.load();
  if (name === 'calendar') Calendar.load();
  if (name === 'study') Study.load();
  if (name === 'websites') Websites.load();
  if (name === 'checklist') Checklist.load();
}

document.addEventListener('click', (e) => {
  const target = e.target.closest('[data-nav]');
  if (target) goPage(target.dataset.nav, true);
});

const eventModalOverlay = document.getElementById('event-modal-overlay');
const eventForm = document.getElementById('event-form');
const eventModalTitle = document.getElementById('event-modal-title');
const eventDeleteBtn = document.getElementById('event-delete');

let editingEventId = null;

function openEventModal(iso, event) {
  eventForm.reset();
  editingEventId = event ? event.id : null;
  eventModalTitle.textContent = event ? 'Edit Event' : 'Create Event';
  eventDeleteBtn.hidden = !event;
  document.getElementById('event-title').value = event ? event.title : '';
  document.getElementById('event-type').value = event ? event.type : 'session';
  document.getElementById('event-date').value = event ? event.date : iso;
  document.getElementById('event-start').value = event ? (event.start_time || '') : '09:00';
  document.getElementById('event-end').value = event ? (event.end_time || '') : '10:00';
  document.getElementById('event-location').value = event ? (event.location || '') : '';
  eventModalOverlay.classList.add('open');
}

function closeEventModal() {
  eventModalOverlay.classList.remove('open');
  editingEventId = null;
}

function refreshCurrentPage() {
  if (currentPage === 'dashboard') Dashboard.load();
  if (currentPage === 'calendar') Calendar.load();
}

document.getElementById('event-modal-close').addEventListener('click', closeEventModal);
eventModalOverlay.addEventListener('click', (e) => {
  if (e.target === eventModalOverlay) closeEventModal();
});

eventForm.addEventListener('submit', async (e) => {
  e.preventDefault();
  const payload = {
    title: document.getElementById('event-title').value,
    type: document.getElementById('event-type').value,
    date: document.getElementById('event-date').value,
    start_time: document.getElementById('event-start').value || null,
    end_time: document.getElementById('event-end').value || null,
    location: document.getElementById('event-location').value || null,
  };
  const { error } = editingEventId
    ? await sb.from('events').update(payload).eq('id', editingEventId)
    : await sb.from('events').insert(payload);
  if (error) return ui.alert(error.message, { title: 'Something went wrong' });
  closeEventModal();
  refreshCurrentPage();
});

eventDeleteBtn.addEventListener('click', async () => {
  if (!editingEventId) return;
  if (!await ui.confirm('Delete this event?', { title: 'Delete event', confirmLabel: 'Delete', danger: true })) return;
  if (!editingEventId) return;
  const { error } = await sb.from('events').delete().eq('id', editingEventId);
  if (error) return ui.alert(error.message, { title: 'Something went wrong' });
  closeEventModal();
  refreshCurrentPage();
});

document.getElementById('dash-fab').addEventListener('click', () => openEventModal(Dashboard.fabTargetDate()));
document.getElementById('cal-create-event').addEventListener('click', () => openEventModal(App.toISO(new Date())));

const ClassNotifier = (() => {
  const LEAD_MINUTES = 5;
  const POLL_MS = 20000;
  const notifiedIds = new Set();

  function minutesOf(hhmm) {
    const [h, m] = hhmm.split(':').map(Number);
    return h * 60 + m;
  }

  async function fetchTodaysSessions(todayISO) {
    const { data, error } = await sb
      .from('events')
      .select('id, title, location, start_time')
      .eq('date', todayISO)
      .eq('type', 'session')
      .not('start_time', 'is', null);
    if (error) throw error;
    return data;
  }

  async function tick() {
    if (Notification.permission !== 'granted') return;
    const now = new Date();
    const todayISO = App.toISO(now);
    const nowMinutes = now.getHours() * 60 + now.getMinutes();
    let sessions;
    try {
      sessions = await fetchTodaysSessions(todayISO);
    } catch {
      return;
    }
    for (const ev of sessions) {
      const key = `${todayISO}:${ev.id}`;
      if (notifiedIds.has(key)) continue;
      const minutesUntilStart = minutesOf(ev.start_time) - nowMinutes;
      if (minutesUntilStart <= LEAD_MINUTES && minutesUntilStart >= 0) {
        notifiedIds.add(key);
        new Notification(`${ev.title} starts in ${LEAD_MINUTES} min`, {
          body: ev.location ? `Location: ${ev.location}` : undefined,
        });
      }
    }
  }

  function init() {
    if (!('Notification' in window)) return;
    if (Notification.permission === 'default') Notification.requestPermission();
    tick();
    setInterval(tick, POLL_MS);
  }

  return { init };
})();

ClassNotifier.init();

document.addEventListener('DOMContentLoaded', () => goPage('dashboard'));
