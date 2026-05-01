let groupId;
let group;
let expenses = [];
let currentTab = 'expenses';
let editingExpense = null;
let splitDebounce;

document.addEventListener('DOMContentLoaded', () => {
  requireAuth();
  groupId = new URLSearchParams(location.search).get('id');
  if (!groupId) {
    window.location.href = '/dashboard.html';
    return;
  }
  document.body.innerHTML = appShell('dashboard', `
    <div class="page-header fade-in">
      <h1 class="page-title" id="groupName" title="Click to rename">Loading...</h1>
      <div class="page-actions">
        <button class="btn btn-ghost btn-sm" id="inviteBtn">🔗 Invite</button>
        <button class="btn btn-primary btn-sm" id="addExpenseBtn">+ Add Expense</button>
      </div>
    </div>
    <section id="balanceBanner" class="card balance-banner fade-in delay-1"><div class="skeleton" style="height:18px;width:70%"></div></section>
    <div class="tabs fade-in delay-1">
      <button class="tab active" data-tab="expenses">Expenses</button>
      <button class="tab" data-tab="balances">Balances</button>
      <button class="tab" data-tab="settle">Settle Up</button>
    </div>
    <section id="tabContent" class="tab-panel fade-in delay-2"></section>
    ${expenseModal()}
  `);
  initSidebar('dashboard');
  initModals();
  bindShellEvents();
  loadGroup();
});

function expenseModal() {
  return `
    <div class="modal-overlay" id="expenseModal">
      <form class="modal modal-wide" id="expenseForm">
        <div class="modal-header">
          <h2 class="modal-title" id="expenseModalTitle">Add Expense</h2>
          <button class="modal-close" type="button" data-close-modal="expenseModal">×</button>
        </div>
        <div class="form-grid">
          <label class="input-group"><span class="input-label">Description</span><input class="input" id="description" required></label>
          <label class="input-group"><span class="input-label">Amount</span><input class="input" id="amount" type="number" min="0.01" step="0.01" required></label>
          <label class="input-group"><span class="input-label">Paid by</span><select class="input" id="paidBy"></select></label>
          <label class="input-group"><span class="input-label">Date</span><input class="input" id="date" type="date"></label>
          <div>
            <span class="input-label">Split type</span>
            <div class="split-options">
              <label class="radio-tile"><input type="radio" name="splitType" value="equal" checked>Equally</label>
              <label class="radio-tile"><input type="radio" name="splitType" value="percent">By %</label>
              <label class="radio-tile"><input type="radio" name="splitType" value="amount">By amount</label>
              <label class="radio-tile"><input type="radio" name="splitType" value="shares">By shares</label>
            </div>
          </div>
          <div class="split-grid" id="splitInputs"></div>
          <div class="split-preview" id="splitPreview"></div>
        </div>
        <div class="modal-footer">
          <button class="btn btn-ghost" type="button" data-close-modal="expenseModal">Cancel</button>
          <button class="btn btn-primary" id="saveExpenseBtn" type="submit">Add Expense →</button>
        </div>
      </form>
    </div>`;
}

function bindShellEvents() {
  document.getElementById('addExpenseBtn').addEventListener('click', () => openExpenseModal());
  document.getElementById('inviteBtn').addEventListener('click', copyInvite);
  document.querySelectorAll('.tab').forEach((tab) => {
    tab.addEventListener('click', () => {
      currentTab = tab.dataset.tab;
      document.querySelectorAll('.tab').forEach((t) => t.classList.toggle('active', t === tab));
      renderTab();
    });
  });
  document.getElementById('expenseForm').addEventListener('submit', saveExpense);
  document.getElementById('expenseForm').addEventListener('input', scheduleSplitPreview);
  document.getElementById('expenseForm').addEventListener('change', scheduleSplitPreview);
}

async function loadGroup() {
  try {
    const data = await api.get(`/api/groups/${groupId}`);
    group = data.group;
    document.title = `${group.name} · SilverLining-Splits`;
    setupGroupName();
    populateMemberSelects();
    await Promise.all([loadExpenses(), loadSummary()]);
  } catch (err) {
    showToast(err.message, 'error');
    window.location.href = '/dashboard.html';
  }
}

function setupGroupName() {
  const el = document.getElementById('groupName');
  let original = group.name;
  el.textContent = group.name;
  el.contentEditable = 'true';
  el.addEventListener('focus', () => { original = el.textContent; });
  el.addEventListener('keydown', (event) => {
    if (event.key === 'Enter') {
      event.preventDefault();
      el.blur();
    }
    if (event.key === 'Escape') {
      event.preventDefault();
      el.textContent = original;
      el.blur();
    }
  });
  el.addEventListener('blur', async () => {
    const name = el.textContent.trim();
    if (!name || name === group.name) {
      el.textContent = group.name;
      return;
    }
    try {
      const data = await api.patch(`/api/groups/${groupId}`, { name });
      group = data.group;
      el.textContent = group.name;
      showToast('Group renamed', 'success');
    } catch (err) {
      el.textContent = group.name;
      showToast(err.message, 'error');
    }
  });
}

function populateMemberSelects() {
  const paidBy = document.getElementById('paidBy');
  paidBy.innerHTML = group.members.map((m) => `<option value="${m._id}">${m.name}</option>`).join('');
}

async function loadSummary() {
  const banner = document.getElementById('balanceBanner');
  try {
    const data = await api.get(`/api/groups/${groupId}/summary`);
    const balance = data.currentUserBalance || 0;
    const expenseCount = expenses.filter((expense) => !expense.isSettlement).length;
    banner.className = `card balance-banner ${balance < -0.005 ? 'owes' : Math.abs(balance) <= 0.005 ? 'settled' : ''}`;
    if (balance > 0.005) {
      banner.innerHTML = `<div class="balance-kicker">Your net balance</div><div class="balance-main">You are owed <span id="balanceAmount"></span> across ${expenseCount} expenses</div>`;
      animateAmount(document.getElementById('balanceAmount'), balance);
    } else if (balance < -0.005) {
      banner.innerHTML = `<div class="balance-kicker">Your net balance</div><div class="balance-main">You owe <span id="balanceAmount"></span> in total</div>`;
      animateAmount(document.getElementById('balanceAmount'), Math.abs(balance));
    } else {
      banner.innerHTML = '<div class="balance-kicker">Your net balance</div><div class="balance-main">You\'re all settled up ✓</div>';
    }
  } catch (err) {
    banner.innerHTML = `<p class="muted">${err.message}</p>`;
  }
}

async function loadExpenses() {
  const tab = document.getElementById('tabContent');
  tab.innerHTML = '<div class="card"><div class="skeleton" style="height:18px;width:50%;margin-bottom:16px"></div><div class="skeleton" style="height:48px;width:100%"></div></div>';
  try {
    const data = await api.get(`/api/expenses/group/${groupId}`);
    expenses = data.expenses;
    renderTab();
  } catch (err) {
    tab.innerHTML = `<div class="empty-state card"><div class="empty-state-title">Could not load expenses</div><p class="empty-state-sub">${err.message}</p></div>`;
  }
}

function renderTab() {
  if (currentTab === 'expenses') renderExpenses();
  if (currentTab === 'balances') renderBalances();
  if (currentTab === 'settle') renderSettle();
}

function renderExpenses() {
  const tab = document.getElementById('tabContent');
  if (!expenses.length) {
    tab.innerHTML = '<div class="empty-state card"><div class="empty-state-icon">₹</div><div class="empty-state-title">No expenses yet</div><p class="empty-state-sub">Add the first shared cost and the math will start behaving.</p></div>';
    return;
  }
  const user = getStoredUser();
  let lastMonth = '';
  tab.innerHTML = '<div class="expense-list" id="expenseList"></div>';
  const list = document.getElementById('expenseList');
  expenses.forEach((expense) => {
    const month = monthLabel(expense.date);
    if (month !== lastMonth) {
      lastMonth = month;
      list.insertAdjacentHTML('beforeend', `<div class="month-heading">${month}</div>`);
    }
    list.append(expenseRow(expense, user));
  });
}

function expenseRow(expense, user) {
  const row = document.createElement('article');
  row.className = 'expense-row';
  const payer = expense.paidBy || {};
  const mine = expense.splits.find((split) => (split.user._id || split.user) === user.id);
  const canEdit = (expense.createdBy?._id || expense.createdBy) === user.id;
  row.append(createAvatar(payer.name || payer.email, 'sm'));
  row.insertAdjacentHTML('beforeend', `
    <div>
      <div class="expense-title">${expense.isSettlement ? '💸 Settlement' : expense.description}</div>
      <div class="expense-sub">Paid by ${payer.name || 'Someone'} · ${formatDate(expense.date)}</div>
      <div class="expense-share">${expense.isSettlement ? `${payer.name} paid ${expense.settledTo?.name || 'someone'}` : `Your share: ${formatAmount(mine?.share || 0)} · Split ${expense.splitType}`}</div>
    </div>
    <div>
      <div class="expense-amount">${formatAmount(expense.amount)}</div>
      ${canEdit ? '<div class="row-actions"><button class="btn-icon edit">✎</button><button class="btn-icon delete">×</button></div>' : ''}
    </div>`);
  row.querySelector('.edit')?.addEventListener('click', () => openExpenseModal(expense));
  row.querySelector('.delete')?.addEventListener('click', () => confirmDelete(row, expense));
  return row;
}

function confirmDelete(row, expense) {
  const actions = row.querySelector('.row-actions');
  actions.outerHTML = '<div class="inline-confirm">Delete? <button class="btn btn-danger btn-sm yes">Yes</button><button class="btn btn-ghost btn-sm no">Cancel</button></div>';
  row.querySelector('.no').addEventListener('click', renderExpenses);
  row.querySelector('.yes').addEventListener('click', async () => {
    try {
      await api.delete(`/api/expenses/${expense._id}`);
      showToast('Expense deleted', 'success');
      await loadExpenses();
      await loadSummary();
    } catch (err) {
      showToast(err.message, 'error');
    }
  });
}

async function renderBalances() {
  const tab = document.getElementById('tabContent');
  tab.innerHTML = '<div class="card"><div class="skeleton" style="height:52px;width:100%"></div></div>';
  try {
    const { debts, users } = await api.get(`/api/groups/${groupId}/balances`);
    if (!debts.length) {
      tab.innerHTML = '<div class="empty-state card"><div class="empty-state-icon">✓</div><div class="empty-state-title">Everyone is square</div></div>';
      return;
    }
    tab.innerHTML = `<div class="card">${debts.map((debt, index) => {
      const from = users[debt.from];
      const to = users[debt.to];
      return `<div class="settlement-row">
        <div class="people-flow"><span>${from.name}</span><span class="arrow">→</span><span>${to.name}</span></div>
        <strong>${formatAmount(debt.amount)}</strong>
        <button class="btn btn-ghost btn-sm settle-from-balance" data-from="${debt.from}" data-to="${debt.to}" data-amount="${debt.amount}" data-index="${index}">Settle</button>
      </div>`;
    }).join('')}</div>`;
    document.querySelectorAll('.settle-from-balance').forEach((button) => {
      button.addEventListener('click', () => {
        currentTab = 'settle';
        document.querySelectorAll('.tab').forEach((t) => t.classList.toggle('active', t.dataset.tab === 'settle'));
        renderSettle({ payer: button.dataset.from, payee: button.dataset.to, amount: button.dataset.amount });
      });
    });
  } catch (err) {
    tab.innerHTML = `<div class="empty-state card"><div class="empty-state-title">${err.message}</div></div>`;
  }
}

function renderSettle(prefill = {}) {
  const options = group.members.map((m) => `<option value="${m._id}">${m.name}</option>`).join('');
  document.getElementById('tabContent').innerHTML = `
    <form class="card form-grid" id="settleForm">
      <label class="input-group"><span class="input-label">Who is paying?</span><select class="input" id="settlePayer">${options}</select></label>
      <label class="input-group"><span class="input-label">Who are they paying?</span><select class="input" id="settlePayee">${options}</select></label>
      <label class="input-group"><span class="input-label">Amount</span><input class="input" id="settleAmount" type="number" min="0.01" step="0.01"></label>
      <label class="input-group"><span class="input-label">Note</span><input class="input" id="settleNote" placeholder="Optional"></label>
      <button class="btn btn-primary" type="submit">Record Settlement</button>
    </form>`;
  if (prefill.payer) document.getElementById('settlePayer').value = prefill.payer;
  if (prefill.payee) document.getElementById('settlePayee').value = prefill.payee;
  if (prefill.amount) document.getElementById('settleAmount').value = prefill.amount;
  document.getElementById('settleForm').addEventListener('submit', recordSettlement);
}

async function recordSettlement(event) {
  event.preventDefault();
  try {
    await api.post('/api/expenses/settle', {
      groupId,
      payer: document.getElementById('settlePayer').value,
      payee: document.getElementById('settlePayee').value,
      amount: Number(document.getElementById('settleAmount').value),
      note: document.getElementById('settleNote').value
    });
    showToast('Settlement recorded', 'success');
    await loadExpenses();
    await loadSummary();
  } catch (err) {
    showToast(err.message, 'error');
  }
}

function openExpenseModal(expense = null) {
  editingExpense = expense;
  const form = document.getElementById('expenseForm');
  form.reset();
  document.getElementById('expenseModalTitle').textContent = expense ? 'Edit Expense' : 'Add Expense';
  document.getElementById('saveExpenseBtn').textContent = expense ? 'Save changes' : 'Add Expense →';
  document.getElementById('date').valueAsDate = new Date();
  if (expense) {
    document.getElementById('description').value = expense.description;
    document.getElementById('amount').value = expense.amount;
    document.getElementById('paidBy').value = expense.paidBy._id || expense.paidBy;
    document.getElementById('date').value = new Date(expense.date).toISOString().slice(0, 10);
    form.querySelector(`[name="splitType"][value="${expense.splitType}"]`).checked = true;
  }
  renderSplitInputs(expense);
  openModal('expenseModal');
}

function selectedSplitType() {
  return document.querySelector('[name="splitType"]:checked')?.value || 'equal';
}

function renderSplitInputs(expense = null) {
  const type = selectedSplitType();
  const wrap = document.getElementById('splitInputs');
  wrap.innerHTML = '';
  if (type === 'equal') {
    updateSplitPreview();
    return;
  }
  const raw = new Map((expense?.splits || []).map((split) => [(split.user._id || split.user), split.raw || split.share || 0]));
  group.members.forEach((member) => {
    const label = type === 'percent' ? '%' : type === 'shares' ? 'shares' : '₹';
    wrap.insertAdjacentHTML('beforeend', `<div class="split-line"><span class="split-line-name">${member.name}</span><input class="input split-raw" data-user="${member._id}" type="number" min="0" step="${type === 'shares' ? '1' : '0.01'}" value="${raw.get(member._id) || ''}"><span class="muted">${label}</span></div>`);
  });
  updateSplitPreview();
}

function scheduleSplitPreview() {
  clearTimeout(splitDebounce);
  splitDebounce = setTimeout(() => {
    renderSplitInputsIfTypeChanged();
    updateSplitPreview();
  }, 100);
}

function renderSplitInputsIfTypeChanged() {
  const needsInputs = selectedSplitType() !== 'equal';
  const hasInputs = Boolean(document.querySelector('.split-raw'));
  if (needsInputs !== hasInputs) renderSplitInputs(editingExpense);
}

function getSplitsForSubmit() {
  const type = selectedSplitType();
  if (type === 'equal') return group.members.map((m) => ({ user: m._id, raw: 1 }));
  return [...document.querySelectorAll('.split-raw')].map((input) => ({ user: input.dataset.user, raw: Number(input.value || 0) }));
}

function calculatePreview() {
  const amount = Number(document.getElementById('amount').value || 0);
  const type = selectedSplitType();
  const paidBy = document.getElementById('paidBy').value;
  const raw = new Map(getSplitsForSubmit().map((s) => [s.user, s.raw]));
  let shares = [];
  if (type === 'equal') {
    const base = Math.floor((amount / group.members.length) * 100) / 100;
    let remainder = Number((amount - base * group.members.length).toFixed(2));
    shares = group.members.map((m) => {
      const share = Number((base + (m._id === paidBy ? remainder : 0)).toFixed(2));
      if (m._id === paidBy) remainder = 0;
      return { member: m, share };
    });
  } else if (type === 'percent') {
    shares = group.members.map((m) => ({ member: m, share: Number((amount * ((raw.get(m._id) || 0) / 100)).toFixed(2)) }));
  } else if (type === 'amount') {
    shares = group.members.map((m) => ({ member: m, share: Number((raw.get(m._id) || 0).toFixed(2)) }));
  } else {
    const totalShares = group.members.reduce((sum, m) => sum + (raw.get(m._id) || 0), 0);
    shares = group.members.map((m) => ({ member: m, share: totalShares ? Number((amount * ((raw.get(m._id) || 0) / totalShares)).toFixed(2)) : 0 }));
  }
  const diff = Number((amount - shares.reduce((sum, s) => sum + s.share, 0)).toFixed(2));
  const payerShare = shares.find((s) => s.member._id === paidBy) || shares[0];
  if (payerShare) payerShare.share = Number((payerShare.share + diff).toFixed(2));
  return shares;
}

function updateSplitPreview() {
  const preview = document.getElementById('splitPreview');
  if (!group) return;
  const shares = calculatePreview();
  const total = shares.reduce((sum, item) => sum + item.share, 0);
  const amount = Number(document.getElementById('amount').value || 0);
  preview.innerHTML = shares.map((item) => `<div class="preview-row"><span>${item.member.name}</span><strong>${formatAmount(item.share)}</strong></div>`).join('') + `<div class="preview-row"><span class="muted">Running total</span><strong class="${Math.abs(total - amount) > 0.01 ? 'badge-danger' : ''}">${formatAmount(total)}</strong></div>`;
}

async function saveExpense(event) {
  event.preventDefault();
  const payload = {
    groupId,
    description: document.getElementById('description').value.trim(),
    amount: Number(document.getElementById('amount').value),
    paidBy: document.getElementById('paidBy').value,
    date: document.getElementById('date').value,
    splitType: selectedSplitType(),
    splits: getSplitsForSubmit()
  };
  try {
    if (editingExpense) await api.put(`/api/expenses/${editingExpense._id}`, payload);
    else await api.post('/api/expenses', payload);
    closeModal('expenseModal');
    showToast(editingExpense ? 'Expense updated' : 'Expense added', 'success');
    editingExpense = null;
    await loadExpenses();
    await loadSummary();
  } catch (err) {
    showToast(err.message, 'error');
  }
}

async function copyInvite() {
  const button = document.getElementById('inviteBtn');
  const original = button.textContent;
  const link = `${window.location.origin}/join.html?token=${group.inviteToken}`;
  try {
    await navigator.clipboard.writeText(link);
    button.textContent = 'Copied! ✓';
    showToast('Invite link copied!', 'success');
    setTimeout(() => { button.textContent = original; }, 1500);
  } catch (err) {
    showToast('Could not copy invite link', 'error');
  }
}
