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
    <button class="study-tab" data-key="${m.key}">
      <span class="name">${App.escapeHtml(m.name)}</span>
      <span class="role">${App.escapeHtml(m.role)}</span>
    </button>
  `).join('');

  panelsEl.innerHTML = MEMBERS.map((m) => `
    <div class="chat-panel" data-key="${m.key}">
      <div class="chat-panel-head">
        <p>${App.escapeHtml(m.name)} &middot; ${App.escapeHtml(m.role)}</p>
        <p>${App.escapeHtml(m.tagline)}</p>
      </div>
      <div class="chat-messages" data-key="${m.key}" role="log" aria-live="polite" aria-label="Conversation with ${App.escapeHtml(m.name)}"></div>
      <form class="chat-form" data-key="${m.key}">
        <input class="field" placeholder="Message ${App.escapeHtml(m.name)}..." aria-label="Message ${App.escapeHtml(m.name)}" data-key="${m.key}">
        <button type="submit" class="btn btn-primary">Send</button>
      </form>
    </div>
  `).join('');

  tabsEl.querySelectorAll('.study-tab').forEach((btn) => {
    btn.addEventListener('click', () => {
      activeKey = btn.dataset.key;
      renderTabs();
    });
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
    if (userErr) return alert(userErr.message);

    sending[key] = true;
    await reload(key);

    // messagesByMember[key] already includes the user message just inserted above
    // (reload() re-fetched it); drop it here since it's sent separately as `message`.
    const history = (messagesByMember[key] || []).slice(0, -1).map((m) => ({ role: m.role, content: m.content }));

    const { data, error: callErr } = await sb.functions.invoke('study-chat', {
      body: { member: key, message: text, history },
    });

    sending[key] = false;

    if (callErr) {
      await reload(key);
      return alert(callErr.message);
    }

    const { error: replyErr } = await sb.from('messages').insert({
      member: key,
      role: 'assistant',
      content: data.content,
      sources: data.sources ? JSON.stringify(data.sources) : null,
    });
    if (replyErr) return alert(replyErr.message);
    await reload(key);
  }

  async function reload(key) {
    const { data, error } = await sb
      .from('messages')
      .select('id, role, content, sources')
      .eq('member', key)
      .order('id');
    if (error) return alert(error.message);
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
      alert(err.message);
    } finally {
      pageEl.removeAttribute('aria-busy');
    }
  }

  return { load };
})();
