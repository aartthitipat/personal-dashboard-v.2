const sb = supabase.createClient(SUPABASE_URL, SUPABASE_PUBLISHABLE_KEY);

// --- Shared helpers ---

const App = {
  currency(n) {
    return (Number(n) || 0).toLocaleString('th-TH', { style: 'currency', currency: 'THB' });
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

  // Makes a non-button element (calendar cell, event block/pill) keyboard-operable
  // by reusing its existing click handler: Enter/Space triggers a real click,
  // so any e.stopPropagation() inside that handler still behaves the same way
  // it does for a mouse click.
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

  // Expands weekly class_schedule templates into concrete virtual occurrences
  // for every date in [rangeStartISO, rangeEndISO] (inclusive), skipping dates
  // covered by an exception. Used by both Dashboard's weekly timetable and the
  // Calendar month view so recurring classes render the same way everywhere.
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

  // Shared by Dashboard's weekly timetable and Calendar's month view: clicking
  // a recurring (virtual) occurrence can't open the normal edit-event modal
  // since there's no events row behind it — the only thing to do with it is
  // skip that single date via class_schedule_exceptions.
  async cancelClassOccurrence(scheduleId, dateISO, title) {
    if (!confirm(`Cancel "${title}" on ${dateISO}? The rest of the weekly series will keep repeating.`)) return false;
    const { error } = await sb.from('class_schedule_exceptions').insert({ schedule_id: scheduleId, date: dateISO });
    if (error) {
      alert(error.message);
      return false;
    }
    return true;
  },

  // TODO(user): implement the actual "loop for weekdays" rule.
  // Return true if `schedule` should produce an occurrence on this date.
  //   schedule       - a row from class_schedule: { id, day_of_week (0=Sun..6=Sat),
  //                     start_time, end_time, title, location, valid_from, valid_until }
  //                     valid_until may be null, meaning "no end date, repeats forever".
  //   dayOfWeek      - cursor.getDay() for the date being checked (0-6)
  //   iso            - the date being checked, as 'YYYY-MM-DD'
  //   exceptionKeys  - a Set of `${schedule_id}:${date}` strings to skip (cancelled occurrences)
  //
  // Things to get right: day-of-week match, valid_from/valid_until bounds (text
  // dates compare correctly with plain string <= / >= since they're YYYY-MM-DD),
  // and excluding anything in exceptionKeys.
  classScheduleAppliesOn(schedule, dayOfWeek, iso, exceptionKeys) {
    if (schedule.day_of_week !== dayOfWeek) return false;
    if (iso < schedule.valid_from) return false;
    if (schedule.valid_until && iso > schedule.valid_until) return false;
    if (exceptionKeys.has(`${schedule.id}:${iso}`)) return false;
    return true;
  },
};

// --- Theme ---
// The saved choice is applied by an inline script in <head> before first paint;
// this wires the toggles (sidebar + mobile top bar) and keeps their icons in sync.

const THEME_ICONS = {
  toDark: '<svg viewBox="0 0 24 24" fill="currentColor" width="18" height="18" aria-hidden="true"><path d="M20.354 15.354A9 9 0 018.646 3.646 9.003 9.003 0 0012 21a9.003 9.003 0 008.354-5.646z"/></svg>',
  toLight: '<svg viewBox="0 0 24 24" fill="none" stroke-width="1.8" stroke="currentColor" width="18" height="18" aria-hidden="true"><circle cx="12" cy="12" r="4"/><path stroke-linecap="round" d="M12 2v2M12 20v2M4.93 4.93l1.41 1.41M17.66 17.66l1.41 1.41M2 12h2M20 12h2M4.93 19.07l1.41-1.41M17.66 6.34l1.41-1.41"/></svg>',
};

const themeToggles = document.querySelectorAll('.theme-toggle');

function paintThemeToggles(dark) {
  themeToggles.forEach((btn) => {
    btn.innerHTML = (dark ? THEME_ICONS.toLight : THEME_ICONS.toDark)
      + `<span class="theme-label">${dark ? 'Light mode' : 'Dark mode'}</span>`;
    btn.setAttribute('aria-label', dark ? 'Switch to light mode' : 'Switch to dark mode');
  });
}

function applyTheme(dark) {
  document.documentElement.setAttribute('data-theme', dark ? 'dark' : 'light');
  paintThemeToggles(dark);
  try { localStorage.setItem('dashboard-theme', dark ? 'dark' : 'light'); } catch { /* storage unavailable */ }
}

themeToggles.forEach((btn) => {
  btn.addEventListener('click', () => {
    applyTheme(document.documentElement.getAttribute('data-theme') !== 'dark');
  });
});

paintThemeToggles(document.documentElement.getAttribute('data-theme') === 'dark');

// --- Navigation ---

const pages = document.querySelectorAll('.page');
const navButtons = document.querySelectorAll('.nav-item[data-nav]');
let currentPage = 'dashboard';

function goPage(name) {
  currentPage = name;
  pages.forEach((p) => p.classList.toggle('active', p.id === `page-${name}`));
  navButtons.forEach((b) => {
    const on = b.dataset.nav === name;
    b.classList.toggle('active', on);
    if (on) b.setAttribute('aria-current', 'page');
    else b.removeAttribute('aria-current');
  });
  document.getElementById('app-main').scrollTop = 0;
  window.scrollTo(0, 0);
  if (name === 'dashboard') Dashboard.load();
  if (name === 'finances') Finances.load();
  if (name === 'calendar') Calendar.load();
  if (name === 'study') Study.load();
  if (name === 'websites') Websites.load();
  if (name === 'checklist') Checklist.load();
}

// Delegated so buttons rendered later (e.g. dashboard card links) can navigate too.
document.addEventListener('click', (e) => {
  const target = e.target.closest('[data-nav]');
  if (target) goPage(target.dataset.nav);
});

// --- Shared "create event" modal (used by Dashboard FAB + Calendar) ---

const eventModalOverlay = document.getElementById('event-modal-overlay');
const eventForm = document.getElementById('event-form');
const eventModalTitle = document.getElementById('event-modal-title');
const eventDeleteBtn = document.getElementById('event-delete');

let editingEventId = null;

function openEventModal(iso, event) {
  eventForm.reset();
  editingEventId = event ? event.id : null;
  eventModalTitle.textContent = event ? 'Edit Event' : 'Create Event';
  eventDeleteBtn.style.display = event ? '' : 'none';
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
  if (error) return alert(error.message);
  closeEventModal();
  refreshCurrentPage();
});

eventDeleteBtn.addEventListener('click', async () => {
  if (!editingEventId) return;
  if (!confirm('Delete this event?')) return;
  const { error } = await sb.from('events').delete().eq('id', editingEventId);
  if (error) return alert(error.message);
  closeEventModal();
  refreshCurrentPage();
});

document.getElementById('dash-fab').addEventListener('click', () => openEventModal(Dashboard.fabTargetDate()));
document.getElementById('cal-create-event').addEventListener('click', () => openEventModal(App.toISO(new Date())));

// --- Class-start notifications (Study Session events, 5 minutes before start) ---

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

// --- Init ---
// Deferred until DOMContentLoaded so dashboard.js/finances.js/calendar.js/study.js
// (loaded after this file) have already defined Dashboard/Finances/Calendar/Study.
document.addEventListener('DOMContentLoaded', () => goPage('dashboard'));
