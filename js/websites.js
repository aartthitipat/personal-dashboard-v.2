const Websites = (() => {
  const GLOBE_ICON = '<circle cx="12" cy="12" r="9"/><path d="M3 12h18M12 3c2.5 2.5 4 5.5 4 9s-1.5 6.5-4 9c-2.5-2.5-4-5.5-4-9s1.5-6.5 4-9z"/>';

  let websites = [];

  const form = document.getElementById('web-form');
  const wrap = document.getElementById('web-wrap');
  const toggleAddBtn = document.getElementById('web-toggle-add');
  const grid = document.getElementById('web-grid');
  const pageEl = document.getElementById('page-websites');

  function setFormOpen(open) {
    App.setDisclosure(wrap, toggleAddBtn, open, open);
  }

  toggleAddBtn.addEventListener('click', () => {
    setFormOpen(!wrap.classList.contains('open'));
  });

  form.addEventListener('submit', async (e) => {
    e.preventDefault();
    const name = document.getElementById('web-name').value.trim();
    const url = document.getElementById('web-url').value.trim();
    const image_url = document.getElementById('web-image').value.trim() || null;
    if (!name || !url) return;
    const { error } = await sb.from('websites').insert({ name, url, image_url });
    if (error) return ui.alert(error.message, { title: 'Something went wrong' });
    form.reset();
    setFormOpen(false);
    toggleAddBtn.focus();
    await load();
  });

  async function deleteWebsite(id) {
    if (!await ui.confirm('Remove this website?', { title: 'Remove website', confirmLabel: 'Remove', danger: true })) return;
    const { error } = await sb.from('websites').delete().eq('id', id);
    if (error) return ui.alert(error.message, { title: 'Something went wrong' });
    await load();
  }

  function render() {
    if (!websites.length) {
      grid.innerHTML = App.emptyState(GLOBE_ICON, 'No websites yet', "Add the sites you've built to keep them one click away.", 'Add website');
      grid.querySelector('[data-empty-action]').addEventListener('click', () => setFormOpen(true));
      return;
    }
    grid.innerHTML = websites.map((w) => `
      <div class="web-card">
        <div class="web-card-image" data-id="${w.id}" aria-hidden="true">${w.image_url ? '' : App.escapeHtml(w.name.charAt(0).toUpperCase())}</div>
        <div class="web-card-body">
          <p class="web-card-name">${App.escapeHtml(w.name)}</p>
          <div class="web-card-actions">
            <a class="web-card-link" href="${App.escapeHtml(App.safeUrl(w.url))}" target="_blank" rel="noopener noreferrer" aria-label="Visit ${App.escapeHtml(w.name)}">Visit</a>
            <button type="button" class="web-card-delete" data-id="${w.id}" aria-label="Remove ${App.escapeHtml(w.name)}">&#10005;</button>
          </div>
        </div>
      </div>
    `).join('');
    websites.forEach((w) => {
      if (!w.image_url) return;
      const imgEl = grid.querySelector(`.web-card-image[data-id="${w.id}"]`);
      if (imgEl) imgEl.style.backgroundImage = `url("${App.safeUrl(w.image_url)}")`;
    });
    grid.querySelectorAll('.web-card-delete').forEach((btn) => {
      btn.addEventListener('click', () => deleteWebsite(btn.dataset.id));
    });
  }

  async function load() {
    pageEl.setAttribute('aria-busy', 'true');
    try {
      const { data, error } = await sb.from('websites').select('id, name, url, image_url').order('created_at', { ascending: false });
      if (error) throw error;
      websites = data;
      render();
    } catch (err) {
      ui.alert(err.message, { title: 'Something went wrong' });
    } finally {
      pageEl.removeAttribute('aria-busy');
    }
  }

  return { load };
})();
