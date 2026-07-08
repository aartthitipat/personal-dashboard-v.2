const Websites = (() => {
  let websites = [];

  const form = document.getElementById('web-form');
  const toggleAddBtn = document.getElementById('web-toggle-add');
  const grid = document.getElementById('web-grid');
  const pageEl = document.getElementById('page-websites');

  toggleAddBtn.addEventListener('click', () => {
    form.style.display = form.style.display === 'none' ? 'grid' : 'none';
  });

  form.addEventListener('submit', async (e) => {
    e.preventDefault();
    const name = document.getElementById('web-name').value.trim();
    const url = document.getElementById('web-url').value.trim();
    const image_url = document.getElementById('web-image').value.trim() || null;
    if (!name || !url) return;
    const { error } = await sb.from('websites').insert({ name, url, image_url });
    if (error) return alert(error.message);
    form.reset();
    form.style.display = 'none';
    await load();
  });

  async function deleteWebsite(id) {
    if (!confirm('Remove this website?')) return;
    const { error } = await sb.from('websites').delete().eq('id', id);
    if (error) return alert(error.message);
    await load();
  }

  function render() {
    if (!websites.length) {
      grid.innerHTML = '<p class="web-empty">No websites added yet. Add the ones you\'ve built.</p>';
      return;
    }
    grid.innerHTML = websites.map((w) => `
      <div class="web-card">
        <div class="web-card-image" data-id="${w.id}"></div>
        <div class="web-card-body">
          <p class="web-card-name">${App.escapeHtml(w.name)}</p>
          <div class="web-card-actions">
            <a class="web-card-link" href="${App.safeUrl(w.url)}" target="_blank" rel="noopener noreferrer">Visit</a>
            <button class="web-card-delete" data-id="${w.id}" aria-label="Remove ${App.escapeHtml(w.name)}">&#10005;</button>
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
      alert(err.message);
    } finally {
      pageEl.removeAttribute('aria-busy');
    }
  }

  return { load };
})();
