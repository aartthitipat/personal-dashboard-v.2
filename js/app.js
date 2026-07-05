const monthPicker = document.getElementById('month-picker');
const expenseForm = document.getElementById('expense-form');
const budgetForm = document.getElementById('budget-form');
const expenseRows = document.getElementById('expense-rows');
const budgetBars = document.getElementById('budget-bars');
const categoryList = document.getElementById('category-list');

const fmt = (n) => '$' + Number(n).toFixed(2);

function currentMonth() {
  return monthPicker.value || new Date().toISOString().slice(0, 7);
}

async function api(path, options = {}) {
  const res = await fetch(path, options);
  if (!res.ok) {
    const body = await res.json().catch(() => ({}));
    throw new Error(body.error || `Request failed: ${res.status}`);
  }
  return res.json();
}

async function loadAll() {
  const [expenses, budgets] = await Promise.all([
    api(`api/expenses.php?month=${currentMonth()}`),
    api('api/budgets.php'),
  ]);
  renderExpenses(expenses);
  renderBudgets(budgets, expenses);
  renderCategoryList(budgets);
}

function renderExpenses(expenses) {
  expenseRows.innerHTML = '';
  let total = 0;
  for (const e of expenses) {
    total += Number(e.amount);
    const tr = document.createElement('tr');
    tr.innerHTML = `
      <td>${e.expense_date}</td>
      <td>${escapeHtml(e.category)}</td>
      <td>${escapeHtml(e.note || '')}</td>
      <td>${fmt(e.amount)}</td>
      <td><button class="delete-btn" data-id="${e.id}">delete</button></td>
    `;
    expenseRows.appendChild(tr);
  }
  document.getElementById('total-spent').textContent = fmt(total);
  return total;
}

function renderBudgets(budgets, expenses) {
  const spentByCategory = {};
  for (const e of expenses) {
    spentByCategory[e.category] = (spentByCategory[e.category] || 0) + Number(e.amount);
  }

  budgetBars.innerHTML = '';
  let totalBudget = 0;
  let totalSpent = 0;

  for (const b of budgets) {
    const spent = spentByCategory[b.category] || 0;
    totalBudget += Number(b.monthly_limit);
    totalSpent += spent;
    const pct = b.monthly_limit > 0 ? Math.min(100, (spent / b.monthly_limit) * 100) : 0;
    const over = spent > b.monthly_limit;

    const row = document.createElement('div');
    row.className = 'budget-row';
    row.innerHTML = `
      <div class="budget-row-label">
        <span>${escapeHtml(b.category)}</span>
        <span>${fmt(spent)} / ${fmt(b.monthly_limit)}</span>
      </div>
      <div class="budget-bar-track">
        <div class="budget-bar-fill ${over ? 'over' : ''}" style="width:${pct}%"></div>
      </div>
    `;
    budgetBars.appendChild(row);
  }

  document.getElementById('total-budget').textContent = fmt(totalBudget);
  const remaining = totalBudget - totalSpent;
  const remainingEl = document.getElementById('total-remaining');
  remainingEl.textContent = fmt(remaining);
  remainingEl.classList.toggle('over', remaining < 0);
}

function renderCategoryList(budgets) {
  categoryList.innerHTML = budgets
    .map((b) => `<option value="${escapeHtml(b.category)}">`)
    .join('');
}

function escapeHtml(str) {
  const div = document.createElement('div');
  div.textContent = str;
  return div.innerHTML;
}

expenseForm.addEventListener('submit', async (e) => {
  e.preventDefault();
  const payload = {
    expense_date: document.getElementById('expense-date').value,
    category: document.getElementById('expense-category').value,
    amount: document.getElementById('expense-amount').value,
    note: document.getElementById('expense-note').value,
  };
  try {
    await api('api/expenses.php', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });
    expenseForm.reset();
    await loadAll();
  } catch (err) {
    alert(err.message);
  }
});

budgetForm.addEventListener('submit', async (e) => {
  e.preventDefault();
  const payload = {
    category: document.getElementById('budget-category').value,
    monthly_limit: document.getElementById('budget-limit').value,
  };
  try {
    await api('api/budgets.php', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });
    budgetForm.reset();
    await loadAll();
  } catch (err) {
    alert(err.message);
  }
});

expenseRows.addEventListener('click', async (e) => {
  if (!e.target.matches('.delete-btn')) return;
  const id = e.target.dataset.id;
  if (!confirm('Delete this expense?')) return;
  await api(`api/expenses.php?id=${id}`, { method: 'DELETE' });
  await loadAll();
});

monthPicker.addEventListener('change', loadAll);

monthPicker.value = new Date().toISOString().slice(0, 7);
document.getElementById('expense-date').value = new Date().toISOString().slice(0, 10);
loadAll().catch((err) => alert(err.message));
