const Finances = (() => {
  const CATEGORIES = ['Food & Drink', 'Groceries', 'Housing', 'Education', 'Transport', 'Subscriptions', 'Salary', 'Refund', 'Other'];

  let managingSubs = false;
  let editingGoal = false;
  let editingSubId = null;
  let transactions = [];
  let subscriptions = [];
  let savingsGoal = null;

  const txnForm = document.getElementById('fin-txn-form');
  const txnCategorySelect = document.getElementById('fin-txn-category');
  const toggleAddBtn = document.getElementById('fin-toggle-add');
  const goalView = document.getElementById('fin-goal-view');
  const goalForm = document.getElementById('fin-goal-form');
  const subForm = document.getElementById('fin-sub-form');
  const manageSubsBtn = document.getElementById('fin-manage-subs');
  const subCancelBtn = document.getElementById('fin-sub-cancel');
  const subSubmitBtn = document.getElementById('fin-sub-submit-btn');

  txnCategorySelect.innerHTML = CATEGORIES.map((c) => `<option value="${c}">${c}</option>`).join('');
  document.getElementById('fin-txn-date').value = App.toISO(new Date());

  toggleAddBtn.addEventListener('click', () => {
    txnForm.style.display = txnForm.style.display === 'none' ? 'grid' : 'none';
  });

  txnForm.addEventListener('submit', async (e) => {
    e.preventDefault();
    const vendor = document.getElementById('fin-txn-vendor').value.trim();
    const amount = document.getElementById('fin-txn-amount').value;
    if (!vendor || !amount) return;
    const { error } = await sb.from('transactions').insert({
      type: document.getElementById('fin-txn-type').value,
      amount: Number(amount),
      vendor,
      category: document.getElementById('fin-txn-category').value,
      date: document.getElementById('fin-txn-date').value,
      status: 'completed',
    });
    if (error) return alert(error.message);
    txnForm.reset();
    document.getElementById('fin-txn-date').value = App.toISO(new Date());
    txnForm.style.display = 'none';
    await load();
  });

  // --- Scan Slip: photo -> slip-scan Edge Function (Gemini vision) -> confirm modal ---

  const scanBtn = document.getElementById('fin-scan-slip');
  const slipInput = document.getElementById('fin-slip-input');
  const slipModalOverlay = document.getElementById('slip-modal-overlay');
  const slipForm = document.getElementById('slip-form');
  const slipSaveBtn = document.getElementById('slip-save-btn');

  // Confidence comes from the model, not the form, so it rides alongside the
  // editable fields until save.
  let pendingConfidence = null;

  document.getElementById('slip-category').innerHTML = CATEGORIES.map((c) => `<option value="${c}">${c}</option>`).join('');

  function setScanBusy(busy) {
    scanBtn.disabled = busy;
    scanBtn.textContent = busy ? 'Scanning…' : '▣ Scan Slip';
  }

  // Re-encodes any browser-decodable image (incl. iOS HEIC) to a small JPEG so
  // phone photos don't ship multi-MB base64 payloads to the Edge Function.
  async function downscaleImage(file) {
    const bitmap = await createImageBitmap(file);
    const scale = Math.min(1, 1280 / Math.max(bitmap.width, bitmap.height));
    const canvas = document.createElement('canvas');
    canvas.width = Math.round(bitmap.width * scale);
    canvas.height = Math.round(bitmap.height * scale);
    canvas.getContext('2d').drawImage(bitmap, 0, 0, canvas.width, canvas.height);
    bitmap.close();
    const dataUrl = canvas.toDataURL('image/jpeg', 0.85);
    return { dataUrl, base64: dataUrl.split(',')[1] };
  }

  function openSlipModal(slip, dataUrl) {
    slipForm.reset();
    document.getElementById('slip-preview').src = dataUrl;
    document.getElementById('slip-amount').value = slip.amount;
    document.getElementById('slip-vendor').value = slip.vendor;
    document.getElementById('slip-date').value = slip.date || App.toISO(new Date());
    document.getElementById('slip-category').value = slip.category;
    const pct = Math.round(slip.confidence * 100);
    const confEl = document.getElementById('slip-confidence');
    confEl.textContent = `Read with ${pct}% confidence — check the details before saving.`;
    confEl.classList.toggle('low', slip.confidence < 0.7);
    pendingConfidence = slip.confidence;
    slipModalOverlay.classList.add('open');
  }

  function closeSlipModal() {
    slipModalOverlay.classList.remove('open');
    pendingConfidence = null;
  }

  const SCAN_FAIL_MESSAGES = {
    not_a_slip: "That doesn't look like a payment slip. Try a clearer photo of the slip.",
    not_configured: 'Slip scanning is not connected yet — the Gemini API key is missing.',
    api_error: 'The slip reader had a problem. Try again in a moment.',
  };

  async function scanSlip(file) {
    setScanBusy(true);
    try {
      const { dataUrl, base64 } = await downscaleImage(file);
      const { data, error } = await sb.functions.invoke('slip-scan', {
        body: { image: base64, mimeType: 'image/jpeg' },
      });
      if (error) throw error;
      if (!data.ok) return alert(SCAN_FAIL_MESSAGES[data.reason] || data.message);
      openSlipModal(data.slip, dataUrl);
    } catch (err) {
      alert(`Could not read that image. Try a JPEG/PNG photo of the slip. (${err.message})`);
    } finally {
      setScanBusy(false);
      slipInput.value = '';
    }
  }

  scanBtn.addEventListener('click', () => slipInput.click());
  slipInput.addEventListener('change', () => {
    if (slipInput.files[0]) scanSlip(slipInput.files[0]);
  });

  document.getElementById('slip-modal-close').addEventListener('click', closeSlipModal);
  slipModalOverlay.addEventListener('click', (e) => {
    if (e.target === slipModalOverlay) closeSlipModal();
  });

  slipForm.addEventListener('submit', async (e) => {
    e.preventDefault();
    slipSaveBtn.disabled = true;
    try {
      const { error } = await sb.from('transactions').insert({
        type: 'expense',
        amount: Number(document.getElementById('slip-amount').value),
        vendor: document.getElementById('slip-vendor').value.trim(),
        category: document.getElementById('slip-category').value,
        date: document.getElementById('slip-date').value,
        status: 'completed',
        confidence: pendingConfidence,
      });
      if (error) return alert(error.message);
      closeSlipModal();
      await load();
    } finally {
      slipSaveBtn.disabled = false;
    }
  });

  document.getElementById('fin-export').addEventListener('click', () => {
    const header = ['Date', 'Vendor', 'Category', 'Type', 'Status', 'Amount'];
    const csv = [header, ...transactions.map((t) => [t.date, t.vendor, t.category, t.type, t.status, t.amount])]
      .map((row) => row.map((c) => `"${String(c).replace(/"/g, '""')}"`).join(',')).join('\n');
    const blob = new Blob([csv], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `transactions-${App.toISO(new Date())}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  });

  document.getElementById('fin-goal-edit-btn').addEventListener('click', () => {
    editingGoal = true;
    document.getElementById('fin-goal-label').value = savingsGoal.label;
    document.getElementById('fin-goal-target-input').value = savingsGoal.target_amount;
    document.getElementById('fin-goal-current-input').value = savingsGoal.current_amount;
    renderGoal();
  });

  document.getElementById('fin-goal-cancel').addEventListener('click', () => {
    editingGoal = false;
    renderGoal();
  });

  goalForm.addEventListener('submit', async (e) => {
    e.preventDefault();
    const label = document.getElementById('fin-goal-label').value.trim() || savingsGoal.label;
    const target_amount = Number(document.getElementById('fin-goal-target-input').value);
    const current_amount = Number(document.getElementById('fin-goal-current-input').value) || 0;
    const { error } = await sb.from('savings_goal').update({ label, target_amount, current_amount }).eq('id', 1);
    if (error) return alert(error.message);
    editingGoal = false;
    await load();
  });

  function openSubForm(s) {
    editingSubId = s ? s.id : null;
    subCancelBtn.style.display = s ? '' : 'none';
    subSubmitBtn.textContent = s ? 'Save Subscription' : 'Add Subscription';
    document.getElementById('fin-sub-name').value = s ? s.name : '';
    document.getElementById('fin-sub-plan').value = s ? (s.plan || '') : '';
    document.getElementById('fin-sub-amount').value = s ? s.amount : '';
    document.getElementById('fin-sub-billing-day').value = s ? s.billing_day : '';
  }

  manageSubsBtn.addEventListener('click', () => {
    managingSubs = !managingSubs;
    openSubForm(null);
    subForm.style.display = managingSubs ? 'grid' : 'none';
    manageSubsBtn.textContent = managingSubs ? 'Done' : 'Manage Subscriptions';
    renderSubs();
  });

  subCancelBtn.addEventListener('click', () => openSubForm(null));

  subForm.addEventListener('submit', async (e) => {
    e.preventDefault();
    const name = document.getElementById('fin-sub-name').value.trim();
    const amount = document.getElementById('fin-sub-amount').value;
    const billingDay = document.getElementById('fin-sub-billing-day').value;
    if (!name || !amount || !billingDay) return;
    const payload = {
      name,
      plan: document.getElementById('fin-sub-plan').value.trim() || null,
      amount: Number(amount),
      billing_day: Number(billingDay),
    };
    const { error } = editingSubId
      ? await sb.from('subscriptions').update(payload).eq('id', editingSubId)
      : await sb.from('subscriptions').insert(payload);
    if (error) return alert(error.message);
    openSubForm(null);
    await load();
  });

  async function deleteSub(id) {
    const { error } = await sb.from('subscriptions').delete().eq('id', id);
    if (error) return alert(error.message);
    await load();
  }

  async function deleteTxn(id) {
    if (!confirm('Delete this transaction?')) return;
    const { error } = await sb.from('transactions').delete().eq('id', id);
    if (error) return alert(error.message);
    await load();
  }

  async function confirmPending(id) {
    const { error } = await sb.from('transactions').update({ status: 'completed' }).eq('id', id);
    if (error) return alert(error.message);
    await load();
  }

  function renderGoal() {
    goalView.style.display = editingGoal ? 'none' : 'block';
    goalForm.style.display = editingGoal ? 'flex' : 'none';
    if (editingGoal || !savingsGoal) return;
    const pct = Math.min(100, Math.round((savingsGoal.current_amount / savingsGoal.target_amount) * 100 || 0));
    document.getElementById('fin-goal-edit-btn').textContent = savingsGoal.label;
    document.getElementById('fin-goal-current').textContent = App.currency(savingsGoal.current_amount);
    document.getElementById('fin-goal-target').textContent = App.currency(savingsGoal.target_amount);
    document.getElementById('fin-goal-bar').style.width = `${pct}%`;
    document.getElementById('fin-goal-pct').textContent = `${pct}%`;
  }

  function renderPending() {
    const pending = transactions.filter((t) => t.status === 'pending_review');
    const total = pending.reduce((a, t) => a + Number(t.amount), 0);
    document.getElementById('fin-pending-flag').style.display = pending.length ? 'inline-block' : 'none';
    document.getElementById('fin-pending-count').textContent = `${pending.length} Items`;
    document.getElementById('fin-pending-amount').textContent = App.currency(total);

    const list = document.getElementById('fin-pending-list');
    if (!pending.length) {
      list.innerHTML = '<p class="pending-empty">Transactions land here if you mark them for review.</p>';
      return;
    }
    list.innerHTML = pending.map((t) => `
      <div class="pending-row">
        <div>
          <p class="pending-row-name">${App.escapeHtml(t.vendor)}</p>
          <p class="pending-row-meta">${App.escapeHtml(t.type)} &middot; ${App.currency(t.amount)}</p>
        </div>
        <div class="pending-row-actions">
          <button class="btn-confirm" data-id="${t.id}">Confirm</button>
          <button class="btn-decline" data-id="${t.id}">Delete</button>
        </div>
      </div>
    `).join('');
    list.querySelectorAll('.btn-confirm').forEach((btn) => {
      btn.addEventListener('click', () => confirmPending(btn.dataset.id));
    });
    list.querySelectorAll('.btn-decline').forEach((btn) => {
      btn.addEventListener('click', () => deleteTxn(btn.dataset.id));
    });
  }

  function renderChart() {
    const svg = document.getElementById('fin-chart');
    const now = new Date();
    const months = Array.from({ length: 6 }, (_, i) => {
      const d = new Date(now.getFullYear(), now.getMonth() - (5 - i), 1);
      return { key: `${d.getFullYear()}-${App.pad(d.getMonth() + 1)}`, label: d.toLocaleDateString('en-US', { month: 'short' }), income: 0, expense: 0 };
    });
    const byKey = Object.fromEntries(months.map((m) => [m.key, m]));
    for (const t of transactions) {
      const key = t.date.slice(0, 7);
      const bucket = byKey[key];
      if (!bucket) continue;
      if (t.type === 'income') bucket.income += Number(t.amount);
      else bucket.expense += Number(t.amount);
    }

    const chartW = 560;
    const plotBottom = 230;
    const plotTop = 20;
    const maxVal = Math.max(...months.flatMap((m) => [m.income, m.expense]), 1);
    const groupW = chartW / months.length;
    const barW = groupW * 0.32;

    const gridLines = [0, 1, 2, 3, 4].map((i) => {
      const y = plotTop + (i * (plotBottom - plotTop)) / 4;
      return `<line x1="0" x2="${chartW}" y1="${y}" y2="${y}" stroke="var(--color-outline-variant)" stroke-dasharray="3 3"></line>`;
    }).join('');

    const bars = months.map((m, i) => {
      const groupX = i * groupW + groupW * 0.15;
      const incomeH = (m.income / maxVal) * (plotBottom - plotTop);
      const expenseH = (m.expense / maxVal) * (plotBottom - plotTop);
      const incomeX = groupX;
      const expenseX = groupX + barW + 6;
      const labelX = groupX + barW + 3;
      return `
        <rect x="${incomeX}" y="${plotBottom - incomeH}" width="${barW}" height="${incomeH}" rx="3" fill="var(--color-success)"></rect>
        <rect x="${expenseX}" y="${plotBottom - expenseH}" width="${barW}" height="${expenseH}" rx="3" fill="var(--color-error)"></rect>
        <text x="${labelX}" y="248" font-size="12" fill="var(--color-on-surface-variant)" text-anchor="middle">${m.label}</text>
      `;
    }).join('');

    svg.innerHTML = gridLines + bars;
  }

  function renderSubs() {
    const list = document.getElementById('fin-sub-list');
    list.innerHTML = subscriptions.map((s) => `
      <div class="sub-row">
        <div class="sub-left">
          <span class="sub-avatar">${App.escapeHtml(s.name.charAt(0).toUpperCase())}</span>
          <div>
            <p class="sub-name">${App.escapeHtml(s.name)}</p>
            <p class="sub-plan">${App.escapeHtml(s.plan || '')}${s.plan ? ' &middot; ' : ''}Bills on day ${s.billing_day}</p>
          </div>
        </div>
        <div class="sub-right">
          <span class="sub-amount">${App.currency(s.amount)}</span>
          ${managingSubs ? `<button class="btn-link-danger" data-action="edit" data-id="${s.id}" style="color:var(--color-primary);">Edit</button><button class="btn-link-danger" data-action="delete" data-id="${s.id}">Remove</button>` : ''}
        </div>
      </div>
    `).join('');
    list.querySelectorAll('[data-action="edit"]').forEach((btn) => {
      btn.addEventListener('click', () => {
        const s = subscriptions.find((x) => String(x.id) === btn.dataset.id);
        if (s) openSubForm(s);
      });
    });
    list.querySelectorAll('[data-action="delete"]').forEach((btn) => {
      btn.addEventListener('click', () => deleteSub(btn.dataset.id));
    });
  }

  function renderTxnTable() {
    const rows = document.getElementById('fin-txn-rows');
    rows.innerHTML = transactions.map((t) => `
      <tr>
        <td>${App.escapeHtml(t.vendor)}</td>
        <td><span class="pill">${App.escapeHtml(t.category)}</span></td>
        <td class="muted">${new Date(`${t.date}T00:00:00`).toLocaleDateString('en-US', { month: 'short', day: '2-digit', year: 'numeric' })}</td>
        <td class="muted">${t.status === 'completed' ? 'Completed' : 'Pending'}</td>
        <td class="amount ${t.type === 'income' ? 'income' : ''}">${t.type === 'income' ? '+' : '-'}${App.currency(t.amount)}</td>
        <td class="delete-cell"><button class="btn-link-danger" data-id="${t.id}">Delete</button></td>
      </tr>
    `).join('');
    rows.querySelectorAll('.btn-link-danger').forEach((btn) => {
      btn.addEventListener('click', () => deleteTxn(btn.dataset.id));
    });
  }

  function renderBalance() {
    const income = transactions.filter((t) => t.type === 'income').reduce((a, t) => a + Number(t.amount), 0);
    const expense = transactions.filter((t) => t.type === 'expense').reduce((a, t) => a + Number(t.amount), 0);
    document.getElementById('fin-total-balance').textContent = App.currency(income - expense);
  }

  function daysInMonth(year, monthIndex) {
    return new Date(year, monthIndex + 1, 0).getDate();
  }

  function nextDueDate(billingDay, lastChargedOn, today) {
    // Start searching from the month after the last charge, or the current month if never charged.
    // A 1-indexed month number from the date string doubles as "next month" when passed as Date's 0-indexed month.
    const [year, month] = lastChargedOn
      ? lastChargedOn.split('-').map(Number)
      : [today.getFullYear(), today.getMonth()];
    const dim = daysInMonth(year, month);
    return billingDay <= dim
      ? new Date(year, month, billingDay)
      : new Date(year, month + 1, 1);
  }

  // Guards against overlapping runs (e.g. a double nav-click firing Finances.load()
  // twice) racing on the same stale last_charged_on and both inserting a charge.
  let chargeInFlight = null;

  async function chargeDueSubscriptions() {
    if (chargeInFlight) return chargeInFlight;
    chargeInFlight = (async () => {
      const { data: subs, error } = await sb.from('subscriptions').select('id, name, amount, billing_day, last_charged_on');
      if (error || !subs) return;
      const today = new Date();
      const todayISO = App.toISO(today);
      for (const s of subs) {
        if (nextDueDate(s.billing_day, s.last_charged_on, today) > today) continue;
        // Posted as pending_review, not completed: same pattern as other machine-inserted
        // transactions, so a mis-set billing day or a retroactive first charge needs the
        // user's confirmation before it counts as real spend.
        const { error: insErr } = await sb.from('transactions').insert({
          type: 'expense', amount: s.amount, vendor: s.name, category: 'Subscriptions', date: todayISO, status: 'pending_review',
        });
        if (insErr) continue;
        await sb.from('subscriptions').update({ last_charged_on: todayISO }).eq('id', s.id);
      }
    })();
    try {
      await chargeInFlight;
    } finally {
      chargeInFlight = null;
    }
  }

  const pageEl = document.getElementById('page-finances');

  async function load() {
    pageEl.setAttribute('aria-busy', 'true');
    try {
      await chargeDueSubscriptions();
      const [txnRes, subRes, goalRes] = await Promise.all([
        sb.from('transactions').select('id, type, amount, vendor, category, date, status').order('date', { ascending: false }),
        sb.from('subscriptions').select('id, name, plan, amount, billing_day, last_charged_on').order('id'),
        sb.from('savings_goal').select('id, label, target_amount, current_amount, target_date').eq('id', 1).single(),
      ]);
      if (txnRes.error) throw txnRes.error;
      if (subRes.error) throw subRes.error;
      if (goalRes.error) throw goalRes.error;

      transactions = txnRes.data;
      subscriptions = subRes.data;
      savingsGoal = goalRes.data;

      renderBalance();
      renderGoal();
      renderPending();
      renderChart();
      renderSubs();
      renderTxnTable();
    } catch (err) {
      alert(err.message);
    } finally {
      pageEl.removeAttribute('aria-busy');
    }
  }

  return { load };
})();
