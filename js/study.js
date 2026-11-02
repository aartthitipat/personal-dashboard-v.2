const Study = (() => {
  const MEMBERS = [
    { key: 'researcher', name: 'hee', role: 'Web Researcher', tagline: 'Finds real answers with live web search and cites its sources.' },
    { key: 'debater', name: 'kuy', role: 'Debater', tagline: "Tell it a topic and which side to argue — it argues back." },
    { key: 'teacher', name: 'tad', role: 'Teacher', tagline: 'Explains anything simply — no jargon, straight to the point.' },
  ];

  let activeKey = 'researcher';
  let messagesByMember = {};
  let sending = {};

  const tabsEl = document.getElementById('study-tabs');
  const panelsEl = document.getElementById('study-panels');

  tabsEl.innerHTML = MEMBERS.map((m) => `
    <button type="button" class="study-tab" id="study-tab-${m.key}" role="tab" aria-controls="study-panel-${m.key}" data-key="${m.key}">
      <span class="name">${App.escapeHtml(m.name)}</span>
      <span class="role">${App.escapeHtml(m.role)}</span>
    </button>
  `).join('');

  panelsEl.innerHTML = MEMBERS.map((m) => `
    <div class="chat-panel" id="study-panel-${m.key}" role="tabpanel" aria-labelledby="study-tab-${m.key}" data-key="${m.key}">
      <div class="chat-panel-head">
        <p>${App.escapeHtml(m.name)} &middot; ${App.escapeHtml(m.role)}</p>
        <p>${App.escapeHtml(m.tagline)}</p>
      </div>
      <div class="chat-messages" data-key="${m.key}" role="log" aria-live="polite" aria-label="Conversation with ${App.escapeHtml(m.name)}"></div>
      <form class="chat-form" data-key="${m.key}">
        <label class="sr-only" for="study-input-${m.key}">Message ${App.escapeHtml(m.name)}</label>
        <input class="field" id="study-input-${m.key}" autocomplete="off" placeholder="Message ${App.escapeHtml(m.name)}..." data-key="${m.key}">
        <button type="submit" class="btn btn-primary" aria-label="Send message to ${App.escapeHtml(m.name)}">Send</button>
      </form>
    </div>
  `).join('');

  tabsEl.querySelectorAll('.study-tab').forEach((btn) => {
    btn.addEventListener('click', () => {
      activeKey = btn.dataset.key;
      renderTabs();
    });
  });

  tabsEl.addEventListener('keydown', (e) => {
    const keys = MEMBERS.map((m) => m.key);
    let i = keys.indexOf(activeKey);
    if (e.key === 'ArrowRight') i = (i + 1) % keys.length;
    else if (e.key === 'ArrowLeft') i = (i - 1 + keys.length) % keys.length;
    else if (e.key === 'Home') i = 0;
    else if (e.key === 'End') i = keys.length - 1;
    else return;
    e.preventDefault();
    activeKey = keys[i];
    renderTabs();
    tabsEl.querySelector(`.study-tab[data-key="${activeKey}"]`).focus();
  });

  panelsEl.querySelectorAll('.chat-form').forEach((form) => {
    form.addEventListener('submit', (e) => {
      e.preventDefault();
      sendChat(form.dataset.key);
    });
  });

  function renderTabs() {
    tabsEl.querySelectorAll('.study-tab').forEach((btn) => {
      btn.classList.toggle('active', btn.dataset.key === activeKey);
      btn.setAttribute('aria-selected', String(btn.dataset.key === activeKey));
      btn.tabIndex = btn.dataset.key === activeKey ? 0 : -1;
    });
    panelsEl.querySelectorAll('.chat-panel').forEach((panel) => {
      panel.classList.toggle('active', panel.dataset.key === activeKey);
    });
  }

  function renderMessages(key) {
    const container = panelsEl.querySelector(`.chat-messages[data-key="${key}"]`);
    const msgs = messagesByMember[key] || [];
    container.innerHTML = msgs.map((msg) => {
      const sourcesHtml = (msg.sources || []).map((src) => `
        <div class="chat-source"><a href="${App.escapeHtml(App.safeUrl(src.url))}" target="_blank" rel="noreferrer">${App.escapeHtml(src.title)}</a></div>
      `).join('');
      return `
        <div class="chat-row from-${msg.role === 'user' ? 'user' : 'assistant'}">
          <div class="chat-bubble">${App.escapeHtml(msg.content)}</div>
          ${sourcesHtml}
        </div>
      `;
    }).join('') + (sending[key] ? `<p class="chat-thinking">${App.escapeHtml(MEMBERS.find((m) => m.key === key).name)} is thinking…</p>` : '');
    container.scrollTop = container.scrollHeight;
  }

  function parseSources(raw) {
    if (!raw) return null;
    try {
      return JSON.parse(raw);
    } catch {
      return null;
    }
  }

  async function sendChat(key) {
    const input = panelsEl.querySelector(`input[data-key="${key}"]`);
    const text = input.value.trim();
    if (!text || sending[key]) return;
    input.value = '';

    const { error: userErr } = await sb.from('messages').insert({ member: key, role: 'user', content: text, sources: null });
    if (userErr) return ui.alert(userErr.message, { title: 'Something went wrong' });

    sending[key] = true;
    await reload(key);

    const history = (messagesByMember[key] || []).slice(0, -1).map((m) => ({ role: m.role, content: m.content }));

    const { data, error: callErr } = await sb.functions.invoke('study-chat', {
      body: { member: key, message: text, history },
    });

    sending[key] = false;

    if (callErr) {
      await reload(key);
      return ui.alert(callErr.message, { title: 'Something went wrong' });
    }

    const { error: replyErr } = await sb.from('messages').insert({
      member: key,
      role: 'assistant',
      content: data.content,
      sources: data.sources ? JSON.stringify(data.sources) : null,
    });
    if (replyErr) return ui.alert(replyErr.message, { title: 'Something went wrong' });
    await reload(key);
  }

  async function reload(key) {
    const { data, error } = await sb
      .from('messages')
      .select('id, role, content, sources')
      .eq('member', key)
      .order('id');
    if (error) return ui.alert(error.message, { title: 'Something went wrong' });
    messagesByMember[key] = data.map((m) => ({ ...m, sources: parseSources(m.sources) }));
    renderMessages(key);
  }

  const pageEl = document.getElementById('page-study');

  async function load() {
    renderTabs();
    pageEl.setAttribute('aria-busy', 'true');
    try {
      await Promise.all(MEMBERS.map((m) => reload(m.key)));
    } catch (err) {
      ui.alert(err.message, { title: 'Something went wrong' });
    } finally {
      pageEl.removeAttribute('aria-busy');
    }
  }

  return { load };
})();
