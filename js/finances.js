const Finances = (() => {
  const CATEGORIES = ['Food & Drink', 'Groceries', 'Housing', 'Education', 'Transport', 'Subscriptions', 'Salary', 'Refund', 'Other'];

  const SCAN_ICON = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" width="16" height="16" aria-hidden="true"><path d="M4 8V6a2 2 0 012-2h2M16 4h2a2 2 0 012 2v2M20 16v2a2 2 0 01-2 2h-2M8 20H6a2 2 0 01-2-2v-2M7 12h10"/></svg>';
  const RECEIPT_ICON = '<path d="M6 3h12v18l-3-2-3 2-3-2-3 2V3z"/><path d="M9 8h6M9 12h6"/>';

  let managingSubs = false;
  let editingGoal = false;
  let editingSubId = null;
  let transactions = [];
  let subscriptions = [];
  let savingsGoal = null;

  const txnForm = document.getElementById('fin-txn-form');
  const txnWrap = document.getElementById('fin-txn-wrap');
  const txnCategorySelect = document.getElementById('fin-txn-category');
  const toggleAddBtn = document.getElementById('fin-toggle-add');
  const goalView = document.getElementById('fin-goal-view');
  const goalForm = document.getElementById('fin-goal-form');
  const subForm = document.getElementById('fin-sub-form');
  const subWrap = document.getElementById('fin-sub-wrap');
  const manageSubsBtn = document.getElementById('fin-manage-subs');
  const subCancelBtn = document.getElementById('fin-sub-cancel');
  const subSubmitBtn = document.getElementById('fin-sub-submit-btn');

  txnCategorySelect.innerHTML = CATEGORIES.map((c) => `<option value="${c}">${c}</option>`).join('');
  document.getElementById('fin-txn-date').value = App.toISO(new Date());

  function setTxnFormOpen(open) {
    App.setDisclosure(txnWrap, toggleAddBtn, open, open);
  }

  toggleAddBtn.addEventListener('click', () => {
    setTxnFormOpen(!txnWrap.classList.contains('open'));
  });

  txnForm.addEventListener('submit', async (e) => {
    e.preventDefault();
    const vendorField = document.getElementById('fin-txn-vendor');
    const vendor = vendorField.value.trim();
    const amount = document.getElementById('fin-txn-amount').value;
    if (!vendor) {
      vendorField.value = '';
      vendorField.reportValidity();
      vendorField.focus();
      return;
    }
    if (!amount) return;
    const { error } = await sb.from('transactions').insert({
      type: document.getElementById('fin-txn-type').value,
      amount: Number(amount),
      vendor,
      category: document.getElementById('fin-txn-category').value,
      date: document.getElementById('fin-txn-date').value,
      status: 'completed',
    });
    if (error) return ui.alert(error.message);
    txnForm.reset();
    document.getElementById('fin-txn-date').value = App.toISO(new Date());
    setTxnFormOpen(false);
    toggleAddBtn.focus();
    await load();
  });

  const scanBtn = document.getElementById('fin-scan-slip');
  const slipInput = document.getElementById('fin-slip-input');
  const slipModalOverlay = document.getElementById('slip-modal-overlay');
  const slipForm = document.getElementById('slip-form');
  const slipSaveBtn = document.getElementById('slip-save-btn');

  let pendingConfidence = null;

  document.getElementById('slip-category').innerHTML = CATEGORIES.map((c) => `<option value="${c}">${c}</option>`).join('');

  const scanLoading = document.getElementById('scan-loading');

  function setScanBusy(busy) {
    scanLoading.hidden = !busy;
    scanBtn.disabled = busy;
    scanBtn.innerHTML = `${SCAN_ICON}${busy ? 'Scanning…' : 'Scan Slip'}`;
  }
  setScanBusy(false);

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

  function openSlipModal(slip, dataUrl, uploadedAt) {
    slipForm.reset();
    document.getElementById('slip-time').textContent = `Uploaded ${uploadedAt.toLocaleString('en-US', { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit', hour12: false })}`;
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
    const uploadedAt = new Date();
    setScanBusy(true);
    try {
      const { dataUrl, base64 } = await downscaleImage(file);
      const { data, error } = await sb.functions.invoke('slip-scan', {
        body: { image: base64, mimeType: 'image/jpeg' },
      });
      if (error) throw error;
      if (!data.ok) return await ui.alert(SCAN_FAIL_MESSAGES[data.reason] || data.message, { title: 'Scan Slip' });
      openSlipModal(data.slip, dataUrl, uploadedAt);
    } catch (err) {
      await ui.alert(`Could not read that image. Try a JPEG/PNG photo of the slip. (${err.message})`, { title: 'Scan Slip' });
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
    const slipVendorField = document.getElementById('slip-vendor');
    const slipVendor = slipVendorField.value.trim();
    if (!slipVendor) {
      slipVendorField.value = '';
      slipVendorField.reportValidity();
      slipVendorField.focus();
      return;
    }
    slipSaveBtn.disabled = true;
    try {
      const { error } = await sb.from('transactions').insert({
        type: 'expense',
        amount: Number(document.getElementById('slip-amount').value),
        vendor: slipVendor,
        category: document.getElementById('slip-category').value,
        date: document.getElementById('slip-date').value,
        status: 'completed',
        confidence: pendingConfidence,
      });
      if (error) return await ui.alert(error.message);
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
    if (!savingsGoal) return;
    editingGoal = true;
    document.getElementById('fin-goal-label').value = savingsGoal.label;
    document.getElementById('fin-goal-target-input').value = savingsGoal.target_amount;
    document.getElementById('fin-goal-current-input').value = savingsGoal.current_amount;
    renderGoal();
    document.getElementById('fin-goal-label').focus();
  });

  document.getElementById('fin-goal-cancel').addEventListener('click', () => {
    editingGoal = false;
    renderGoal();
    document.getElementById('fin-goal-edit-btn').focus();
  });

  goalForm.addEventListener('submit', async (e) => {
    e.preventDefault();
    const label = document.getElementById('fin-goal-label').value.trim() || savingsGoal.label;
    const target_amount = Number(document.getElementById('fin-goal-target-input').value);
    const current_amount = Number(document.getElementById('fin-goal-current-input').value) || 0;
    const { error } = await sb.from('savings_goal').update({ label, target_amount, current_amount }).eq('id', 1);
    if (error) return ui.alert(error.message);
    editingGoal = false;
    await load();
  });

  function openSubForm(s) {
    editingSubId = s ? s.id : null;
    subCancelBtn.hidden = !s;
    subSubmitBtn.textContent = s ? 'Save Subscription' : 'Add Subscription';
    document.getElementById('fin-sub-name').value = s ? s.name : '';
    document.getElementById('fin-sub-plan').value = s ? (s.plan || '') : '';
    document.getElementById('fin-sub-amount').value = s ? s.amount : '';
    document.getElementById('fin-sub-billing-day').value = s ? s.billing_day : '';
    subForm.querySelectorAll('.field[aria-invalid]').forEach((f) => {
      f.removeAttribute('aria-invalid');
      f.removeAttribute('aria-describedby');
    });
    subForm.querySelectorAll('.field-help').forEach((n) => n.remove());
  }

  manageSubsBtn.addEventListener('click', () => {
    managingSubs = !managingSubs;
    openSubForm(null);
    App.setDisclosure(subWrap, manageSubsBtn, managingSubs, managingSubs);
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
    if (error) return ui.alert(error.message);
    openSubForm(null);
    await load();
  });

  async function deleteSub(id) {
    const { error } = await sb.from('subscriptions').delete().eq('id', id);
    if (error) return ui.alert(error.message);
    await load();
  }

  async function deleteTxn(id) {
    if (!(await ui.confirm('Delete this transaction?', { title: 'Delete transaction', confirmLabel: 'Delete', cancelLabel: 'Cancel', danger: true }))) return;
    const { error } = await sb.from('transactions').delete().eq('id', id);
    if (error) return ui.alert(error.message);
    await load();
  }

  async function confirmPending(id) {
    const { error } = await sb.from('transactions').update({ status: 'completed' }).eq('id', id);
    if (error) return ui.alert(error.message);
    await load();
  }

  function renderGoal() {
    goalView.hidden = editingGoal;
    goalForm.hidden = !editingGoal;
    if (editingGoal || !savingsGoal) return;
    const pct = Math.min(100, Math.round((savingsGoal.current_amount / savingsGoal.target_amount) * 100 || 0));
    const sameName = savingsGoal.label.trim().toLowerCase() === 'savings goal';
    document.getElementById('fin-goal-name').textContent = sameName ? 'Savings goal' : `Savings goal · ${savingsGoal.label}`;
    document.getElementById('fin-goal-edit-btn').setAttribute('aria-label', `Edit savings goal ${savingsGoal.label}`);
    document.getElementById('fin-goal-current').textContent = App.currency(savingsGoal.current_amount);
    document.getElementById('fin-goal-target').textContent = App.currency(savingsGoal.target_amount);
    document.getElementById('fin-goal-bar').style.setProperty('--p', pct / 100);
    document.getElementById('fin-goal-track').setAttribute('aria-valuenow', String(pct));
    document.getElementById('fin-goal-pct').textContent = `${pct}%`;
  }

  function renderPending() {
    const pending = transactions.filter((t) => t.status === 'pending_review');
    const total = pending.reduce((a, t) => a + Number(t.amount), 0);
    document.getElementById('fin-pending-flag').hidden = !pending.length;
    document.getElementById('fin-pending-count').textContent = `${pending.length} ${pending.length === 1 ? 'item' : 'items'}`;
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
          <button type="button" class="btn-confirm" data-id="${t.id}" aria-label="Confirm ${App.escapeHtml(t.vendor)}">Confirm</button>
          <button type="button" class="btn-decline" data-id="${t.id}" aria-label="Delete ${App.escapeHtml(t.vendor)}">Delete</button>
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
    const now = new Date();
    const months = Array.from({ length: 6 }, (_, i) => {
      const d = new Date(now.getFullYear(), now.getMonth() - (5 - i), 1);
      return {
        key: `${d.getFullYear()}-${App.pad(d.getMonth() + 1)}`,
        label: d.toLocaleDateString('en-US', { month: 'short' }),
        income: 0,
        expense: 0,
      };
    });
    const byKey = Object.fromEntries(months.map((m) => [m.key, m]));
    for (const t of transactions) {
      const bucket = byKey[t.date.slice(0, 7)];
      if (!bucket) continue;
      if (t.type === 'income') bucket.income += Number(t.amount);
      else bucket.expense += Number(t.amount);
    }
    Charts.stackedBars(document.getElementById('fin-chart'), months, {
      id: 'fin-chart-svg',
      heading: 'Monthly income and expenses, last 6 months',
      every: 1,
      money: App.currency,
    });
  }

  function renderSubs() {
    const list = document.getElementById('fin-sub-list');
    if (!subscriptions.length) {
      list.innerHTML = '<p class="pending-empty">No subscriptions yet. Use Manage Subscriptions to add one.</p>';
      return;
    }
    list.innerHTML = subscriptions.map((s) => `
      <div class="sub-row">
        <div class="sub-left">
          <span class="sub-avatar" aria-hidden="true">${App.escapeHtml(s.name.charAt(0).toUpperCase())}</span>
          <div>
            <p class="sub-name">${App.escapeHtml(s.name)}</p>
            <p class="sub-plan">${App.escapeHtml(s.plan || '')}${s.plan ? ' &middot; ' : ''}Bills on day ${s.billing_day}</p>
          </div>
        </div>
        <div class="sub-right">
          <span class="sub-amount">${App.currency(s.amount)}</span>
          ${managingSubs ? `<button type="button" class="btn-link" data-action="edit" data-id="${s.id}" aria-label="Edit ${App.escapeHtml(s.name)}">Edit</button><button type="button" class="btn-link-danger" data-action="delete" data-id="${s.id}" aria-label="Remove ${App.escapeHtml(s.name)}">Remove</button>` : ''}
        </div>
      </div>
    `).join('');
    list.querySelectorAll('[data-action="edit"]').forEach((btn) => {
      btn.addEventListener('click', () => {
        const s = subscriptions.find((x) => String(x.id) === btn.dataset.id);
        if (s) {
          openSubForm(s);
          document.getElementById('fin-sub-name').focus();
        }
      });
    });
    list.querySelectorAll('[data-action="delete"]').forEach((btn) => {
      btn.addEventListener('click', () => deleteSub(btn.dataset.id));
    });
  }

  function renderTxnTable() {
    const rows = document.getElementById('fin-txn-rows');
    const foot = document.getElementById('fin-txn-foot');
    const empty = document.getElementById('fin-txn-empty');
    const scroll = document.querySelector('.txn-scroll');
    scroll.hidden = !transactions.length;
    empty.hidden = !!transactions.length;
    if (!transactions.length) {
      empty.innerHTML = App.emptyState(RECEIPT_ICON, 'No transactions yet', 'Record your first income or expense to start the ledger.', 'New transaction');
      empty.querySelector('[data-empty-action]').addEventListener('click', () => setTxnFormOpen(true));
      rows.innerHTML = '';
      foot.innerHTML = '';
      return;
    }
    rows.innerHTML = transactions.map((t) => {
      const income = t.type === 'income';
      const done = t.status === 'completed';
      return `
      <tr role="row">
        <td role="cell" class="cell-vendor">${App.escapeHtml(t.vendor)}</td>
        <td role="cell" class="cell-cat"><span class="pill">${App.escapeHtml(t.category)}</span></td>
        <td role="cell" class="cell-date muted">${new Date(`${t.date}T00:00:00`).toLocaleDateString('en-US', { month: 'short', day: '2-digit', year: 'numeric' })}</td>
        <td role="cell" class="cell-status"><span class="pill pill-dot ${done ? 'pill-success' : 'pill-error'}">${done ? 'Completed' : 'Pending review'}</span></td>
        <td role="cell" class="amount ${income ? 'income' : ''}">${App.signedCurrency(income ? Number(t.amount) : -Number(t.amount))}</td>
        <td role="cell" class="delete-cell"><button type="button" class="btn-link-danger" data-id="${t.id}" aria-label="Delete transaction ${App.escapeHtml(t.vendor)}">Delete</button></td>
      </tr>
    `;
    }).join('');
    rows.querySelectorAll('.btn-link-danger').forEach((btn) => {
      btn.addEventListener('click', () => deleteTxn(btn.dataset.id));
    });
    const net = transactions.reduce((a, t) => a + (t.type === 'income' ? Number(t.amount) : -Number(t.amount)), 0);
    foot.innerHTML = `
      <tr role="row">
        <td role="cell" colspan="4" class="muted">Net total · ${transactions.length} ${transactions.length === 1 ? 'transaction' : 'transactions'}</td>
        <td role="cell" class="amount ${net >= 0 ? 'income' : ''}">${App.signedCurrency(net)}</td>
        <td role="cell" class="foot-pad"></td>
      </tr>
    `;
  }

  function renderBalance() {
    const income = transactions.filter((t) => t.type === 'income').reduce((a, t) => a + Number(t.amount), 0);
    const expense = transactions.filter((t) => t.type === 'expense').reduce((a, t) => a + Number(t.amount), 0);
    document.getElementById('fin-total-balance').textContent = App.currency(income - expense);
  }

  let chargeInFlight = null;

  async function chargeDueSubscriptions() {
    if (chargeInFlight) return chargeInFlight;
    chargeInFlight = (async () => {
      const { data, error } = await sb.rpc('charge_due_subscriptions', { p_today: App.toISO(new Date()) });
      if (error) {
        ui.toast(`Could not charge due subscriptions: ${error.message}`, { kind: 'error' });
        return [];
      }
      return data || [];
    })();
    try {
      return await chargeInFlight;
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
      await ui.alert(err.message);
    } finally {
      pageEl.removeAttribute('aria-busy');
    }
  }

  return { load };
})();
