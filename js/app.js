const sb = supabase.createClient(SUPABASE_URL, SUPABASE_PUBLISHABLE_KEY);

const authScreen = document.getElementById('auth-screen');
const appScreen = document.getElementById('app-screen');
const authForm = document.getElementById('auth-form');
const authMessage = document.getElementById('auth-message');
const signUpBtn = document.getElementById('auth-signup');
const signOutBtn = document.getElementById('sign-out-btn');

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

// --- Auth ---

sb.auth.onAuthStateChange((_event, session) => {
  showScreen(session);
  if (session) loadAll().catch((err) => alert(err.message));
});

function showScreen(session) {
  authScreen.classList.toggle('hidden', !!session);
  appScreen.classList.toggle('hidden', !session);
}

authForm.addEventListener('submit', async (e) => {
  e.preventDefault();
  const email = document.getElementById('auth-email').value;
  const password = document.getElementById('auth-password').value;
  authMessage.textContent = '';
  const { error } = await sb.auth.signInWithPassword({ email, password });
  if (error) authMessage.textContent = error.message;
});

signUpBtn.addEventListener('click', async () => {
  const email = document.getElementById('auth-email').value;
  const password = document.getElementById('auth-password').value;
  authMessage.textContent = '';
  const { error } = await sb.auth.signUp({ email, password });
  authMessage.textContent = error
    ? error.message
    : 'Account created — check your email to confirm, then sign in.';
});

signOutBtn.addEventListener('click', () => sb.auth.signOut());

// --- Data loading ---

async function loadAll() {
  const [expenses, budgets] = await Promise.all([fetchExpenses(), fetchBudgets()]);
  renderExpenses(expenses);
  renderBudgets(budgets, expenses);
  renderCategoryList(budgets);
}

async function fetchExpenses() {
  const { data, error } = await sb
    .from('transactions')
    .select('id, date, category, amount, vendor')
    .eq('type', 'expense')
    .like('date', `${currentMonth()}-%`)
    .order('date', { ascending: false });
  if (error) throw error;
  return data;
}

async function fetchBudgets() {
  const { data, error } = await sb
    .from('budgets')
    .select('id, category, monthly_limit')
    .order('category');
  if (error) throw error;
  return data;
}

// --- Rendering ---

function renderExpenses(expenses) {
  expenseRows.innerHTML = '';
  let total = 0;
  for (const e of expenses) {
    total += Number(e.amount);
    const tr = document.createElement('tr');
    tr.innerHTML = `
      <td>${e.date}</td>
      <td>${escapeHtml(e.category)}</td>
      <td>${escapeHtml(e.vendor || '')}</td>
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

// --- Mutations ---

expenseForm.addEventListener('submit', async (e) => {
  e.preventDefault();
  const { error } = await sb.from('transactions').insert({
    type: 'expense',
    date: document.getElementById('expense-date').value,
    category: document.getElementById('expense-category').value,
    amount: Number(document.getElementById('expense-amount').value),
    vendor: document.getElementById('expense-note').value || null,
    status: 'completed',
  });
  if (error) return alert(error.message);
  expenseForm.reset();
  document.getElementById('expense-date').value = new Date().toISOString().slice(0, 10);
  await loadAll();
});

budgetForm.addEventListener('submit', async (e) => {
  e.preventDefault();
  const { error } = await sb.from('budgets').upsert(
    {
      category: document.getElementById('budget-category').value,
      monthly_limit: Number(document.getElementById('budget-limit').value),
    },
    { onConflict: 'user_id,category' }
  );
  if (error) return alert(error.message);
  budgetForm.reset();
  await loadAll();
});

expenseRows.addEventListener('click', async (e) => {
  if (!e.target.matches('.delete-btn')) return;
  const id = e.target.dataset.id;
  if (!confirm('Delete this expense?')) return;
  const { error } = await sb.from('transactions').delete().eq('id', id);
  if (error) return alert(error.message);
  await loadAll();
});

monthPicker.addEventListener('change', loadAll);

// --- Init ---

monthPicker.value = new Date().toISOString().slice(0, 7);
document.getElementById('expense-date').value = new Date().toISOString().slice(0, 10);
sb.auth.getSession().then(({ data: { session } }) => showScreen(session));
