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
  TYPE_LABEL: { session: 'Study Session', exam: 'Exam', deadline: 'Deadline', task: 'Task' },
  TYPE_CLASS: { session: 'session', exam: 'exam', deadline: 'deadline', task: 'task' },
};

// --- Theme ---

const THEME_ICONS = {
  light: '<svg viewBox="0 0 24 24" fill="currentColor" width="19" height="19"><path d="M20.354 15.354A9 9 0 018.646 3.646 9.003 9.003 0 0012 21a9.003 9.003 0 008.354-5.646z"/></svg>',
  dark: '<svg viewBox="0 0 24 24" fill="none" stroke-width="1.8" stroke="currentColor" width="19" height="19"><circle cx="12" cy="12" r="4"/><path stroke-linecap="round" d="M12 2v2M12 20v2M4.93 4.93l1.41 1.41M17.66 17.66l1.41 1.41M2 12h2M20 12h2M4.93 19.07l1.41-1.41M17.66 6.34l1.41-1.41"/></svg>',
};

const themeToggle = document.getElementById('theme-toggle');

function applyTheme(dark) {
  document.documentElement.setAttribute('data-theme', dark ? 'dark' : 'light');
  themeToggle.innerHTML = dark ? THEME_ICONS.light : THEME_ICONS.dark;
  localStorage.setItem('dashboard-theme', dark ? 'dark' : 'light');
}

themeToggle.addEventListener('click', () => {
  const isDark = document.documentElement.getAttribute('data-theme') === 'dark';
  applyTheme(!isDark);
});

applyTheme(localStorage.getItem('dashboard-theme') === 'dark');

// --- Navigation ---

const pages = document.querySelectorAll('.page');
const navButtons = document.querySelectorAll('.nav-item');
let currentPage = 'dashboard';

function goPage(name) {
  currentPage = name;
  pages.forEach((p) => p.classList.toggle('active', p.id === `page-${name}`));
  navButtons.forEach((b) => b.classList.toggle('active', b.dataset.nav === name));
  if (name === 'dashboard') Dashboard.load();
  if (name === 'finances') Finances.load();
  if (name === 'calendar') Calendar.load();
  if (name === 'study') Study.load();
}

document.querySelectorAll('[data-nav]').forEach((el) => {
  el.addEventListener('click', () => goPage(el.dataset.nav));
});

document.getElementById('dash-go-calendar').addEventListener('click', () => goPage('calendar'));

// --- Shared "create event" modal (used by Dashboard FAB + Calendar) ---

const eventModalOverlay = document.getElementById('event-modal-overlay');
const eventForm = document.getElementById('event-form');

function openEventModal(iso) {
  eventForm.reset();
  document.getElementById('event-date').value = iso;
  document.getElementById('event-start').value = '09:00';
  document.getElementById('event-end').value = '10:00';
  eventModalOverlay.classList.add('open');
}

function closeEventModal() {
  eventModalOverlay.classList.remove('open');
}

document.getElementById('event-modal-close').addEventListener('click', closeEventModal);
eventModalOverlay.addEventListener('click', (e) => {
  if (e.target === eventModalOverlay) closeEventModal();
});

eventForm.addEventListener('submit', async (e) => {
  e.preventDefault();
  const { error } = await sb.from('events').insert({
    title: document.getElementById('event-title').value,
    type: document.getElementById('event-type').value,
    date: document.getElementById('event-date').value,
    start_time: document.getElementById('event-start').value || null,
    end_time: document.getElementById('event-end').value || null,
    location: document.getElementById('event-location').value || null,
  });
  if (error) return alert(error.message);
  closeEventModal();
  if (currentPage === 'dashboard') Dashboard.load();
  if (currentPage === 'calendar') Calendar.load();
});

document.getElementById('dash-fab').addEventListener('click', () => openEventModal(App.toISO(new Date())));
document.getElementById('cal-create-event').addEventListener('click', () => openEventModal(App.toISO(new Date())));

// --- Init ---
// Deferred until DOMContentLoaded so dashboard.js/finances.js/calendar.js/study.js
// (loaded after this file) have already defined Dashboard/Finances/Calendar/Study.
document.addEventListener('DOMContentLoaded', () => goPage('dashboard'));
