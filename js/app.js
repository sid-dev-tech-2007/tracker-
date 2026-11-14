/**
 * Main Application Controller (js/app.js)
 *
 * Coordinates navigation, global period selection, modals, validation feedback,
 * and delegates data persistence to storage.js and view rendering to feature modules.
 */

import {
  addTransaction,
  deleteTransaction,
  getBudget,
  getTransactions,
  resetToDemoData,
  saveBudget,
  updateTransaction,
} from './storage.js';
import {
  exportTransactionsToCsv,
  formatMonthLabel,
  getAvailableMonths,
  getCurrentMonthKey,
  getTodayDateString,
  populateCategorySelect,
  renderTransactionsView,
  validateTransactionInput,
} from './transactions.js';
import { renderDashboardView } from './dashboard.js';
import { renderAnalyticsView } from './analytics.js';
import { renderBudgetView, validateBudgetInput } from './budget.js';

const VIEW_TITLES = {
  dashboard: 'Dashboard',
  transactions: 'Transactions',
  analytics: 'Analytics',
  budget: 'Budget',
};

const appState = {
  activeView: 'dashboard',
  activeMonth: getCurrentMonthKey(),
  analyticsRange: '6months',
  txFilters: {
    search: '',
    type: 'all',
    category: 'all',
    sortBy: 'date-desc',
  },
  pendingDeleteId: null,
};

/**
 * Displays a non-blocking toast notification.
 */
function showToast(message, isError = false) {
  const container = document.getElementById('toast-container');
  if (!container) return;

  const toast = document.createElement('div');
  toast.className = `toast ${isError ? 'is-error' : ''}`;
  toast.textContent = message;
  container.appendChild(toast);

  window.setTimeout(() => {
    toast.remove();
  }, 3000);
}

/**
 * Syncs the sidebar active period month dropdown with stored transactions.
 */
function syncMonthSelector(transactions) {
  const selectEl = document.getElementById('global-month-select');
  if (!selectEl) return;

  const months = getAvailableMonths(transactions);
  if (!months.includes(appState.activeMonth)) {
    appState.activeMonth = months[0];
  }

  selectEl.innerHTML = months
    .map((key) => `<option value="${key}">${formatMonthLabel(key)}</option>`)
    .join('');

  selectEl.value = appState.activeMonth;
}

/**
 * Re-renders all views cleanly from current storage state.
 */
function refreshApplication() {
  const transactions = getTransactions();
  const budgetConfig = getBudget();

  syncMonthSelector(transactions);

  if (appState.activeView === 'dashboard') {
    renderDashboardView(transactions, budgetConfig, appState.activeMonth, {
      onOpenAdd: () => openTransactionModal(),
    });
  } else if (appState.activeView === 'transactions') {
    renderTransactionsView(transactions, appState.txFilters, {
      onEdit: (id) => {
        const target = transactions.find((tx) => tx.id === id);
        if (target) openTransactionModal(target);
      },
      onDelete: (id) => {
        const target = transactions.find((tx) => tx.id === id);
        if (target) openDeleteModal(target);
      },
    });
  } else if (appState.activeView === 'analytics') {
    renderAnalyticsView(transactions, appState.analyticsRange, appState.activeMonth);
  } else if (appState.activeView === 'budget') {
    renderBudgetView(transactions, budgetConfig, appState.activeMonth);
  }

  if (window.lucide?.createIcons) {
    window.lucide.createIcons();
  }
}

/**
 * Switches active application view.
 */
function setActiveView(viewName) {
  if (!VIEW_TITLES[viewName]) return;
  appState.activeView = viewName;

  document.querySelectorAll('.view-section').forEach((section) => {
    section.classList.toggle('is-active', section.id === `view-${viewName}`);
  });

  document.querySelectorAll('.nav-item[data-view]').forEach((btn) => {
    const isMatch = btn.dataset.view === viewName;
    btn.classList.toggle('is-active', isMatch);
    if (isMatch) btn.setAttribute('aria-current', 'page');
    else btn.removeAttribute('aria-current');
  });

  const titleEl = document.getElementById('topbar-view-title');
  if (titleEl) titleEl.textContent = VIEW_TITLES[viewName];

  closeMobileSidebar();
  refreshApplication();
}

function openMobileSidebar() {
  const sidebar = document.getElementById('app-sidebar');
  const backdrop = document.getElementById('sidebar-backdrop');
  const menuBtn = document.getElementById('btn-mobile-menu');
  sidebar?.classList.add('is-open');
  backdrop?.classList.add('is-open');
  menuBtn?.setAttribute('aria-expanded', 'true');
}

function closeMobileSidebar() {
  const sidebar = document.getElementById('app-sidebar');
  const backdrop = document.getElementById('sidebar-backdrop');
  const menuBtn = document.getElementById('btn-mobile-menu');
  sidebar?.classList.remove('is-open');
  backdrop?.classList.remove('is-open');
  menuBtn?.setAttribute('aria-expanded', 'false');
}

/**
 * Transaction Add/Edit Modal Controls
 */
function clearTransactionFormErrors() {
  ['title', 'amount', 'category', 'date', 'description'].forEach((field) => {
    const input = document.getElementById(`tx-${field}-input`);
    const err = document.getElementById(`tx-${field}-error`);
    input?.classList.remove('is-invalid');
    if (err) err.textContent = '';
  });
}

function setModalTransactionType(type, selectedCategory = '') {
  const normalizedType = type === 'income' ? 'income' : 'expense';
  const typeInput = document.getElementById('tx-type-input');
  const expenseBtn = document.getElementById('tx-type-expense');
  const incomeBtn = document.getElementById('tx-type-income');
  const categorySelect = document.getElementById('tx-category-input');

  if (typeInput) typeInput.value = normalizedType;
  expenseBtn?.classList.toggle('is-active', normalizedType === 'expense');
  incomeBtn?.classList.toggle('is-active', normalizedType === 'income');

  populateCategorySelect(categorySelect, normalizedType, selectedCategory);
}

function openTransactionModal(existingTx = null) {
  const modal = document.getElementById('transaction-modal');
  const modalTitle = document.getElementById('tx-modal-title');
  const submitBtn = document.getElementById('btn-submit-tx-form');
  const idInput = document.getElementById('tx-id-input');
  const titleInput = document.getElementById('tx-title-input');
  const amountInput = document.getElementById('tx-amount-input');
  const dateInput = document.getElementById('tx-date-input');
  const descInput = document.getElementById('tx-description-input');

  clearTransactionFormErrors();

  if (existingTx) {
    if (modalTitle) modalTitle.textContent = 'Edit Transaction';
    if (submitBtn) submitBtn.textContent = 'Update Transaction';
    if (idInput) idInput.value = existingTx.id;
    if (titleInput) titleInput.value = existingTx.title;
    if (amountInput) amountInput.value = existingTx.amount.toFixed(2);
    if (dateInput) dateInput.value = existingTx.date;
    if (descInput) descInput.value = existingTx.description || '';
    setModalTransactionType(existingTx.type, existingTx.category);
  } else {
    if (modalTitle) modalTitle.textContent = 'Add Transaction';
    if (submitBtn) submitBtn.textContent = 'Save Transaction';
    if (idInput) idInput.value = '';
    if (titleInput) titleInput.value = '';
    if (amountInput) amountInput.value = '';
    if (dateInput) dateInput.value = getTodayDateString();
    if (descInput) descInput.value = '';
    setModalTransactionType('expense');
  }

  modal?.classList.remove('hidden');
  titleInput?.focus();
}

function closeTransactionModal() {
  const modal = document.getElementById('transaction-modal');
  modal?.classList.add('hidden');
}

function handleTransactionFormSubmit(event) {
  event.preventDefault();
  clearTransactionFormErrors();

  const id = document.getElementById('tx-id-input')?.value.trim() || '';
  const payload = {
    type: document.getElementById('tx-type-input')?.value || 'expense',
    title: document.getElementById('tx-title-input')?.value || '',
    amount: document.getElementById('tx-amount-input')?.value || '',
    category: document.getElementById('tx-category-input')?.value || '',
    date: document.getElementById('tx-date-input')?.value || '',
    description: document.getElementById('tx-description-input')?.value || '',
  };

  const validation = validateTransactionInput(payload);
  if (!validation.valid) {
    Object.entries(validation.errors).forEach(([field, msg]) => {
      const input = document.getElementById(`tx-${field}-input`);
      const err = document.getElementById(`tx-${field}-error`);
      input?.classList.add('is-invalid');
      if (err) err.textContent = msg;
    });
    return;
  }

  if (id) {
    updateTransaction(id, payload);
    showToast('Transaction updated.');
  } else {
    addTransaction(payload);
    showToast(payload.type === 'income' ? 'Income added.' : 'Expense added.');
  }

  closeTransactionModal();
  refreshApplication();
}

/**
 * Delete Confirmation Modal Controls
 */
function openDeleteModal(tx) {
  appState.pendingDeleteId = tx.id;
  const modal = document.getElementById('delete-modal');
  const message = document.getElementById('delete-confirm-message');
  if (message) {
    message.textContent = `Delete "${tx.title}"? This action permanently removes the record from your ledger.`;
  }
  modal?.classList.remove('hidden');
}

function closeDeleteModal() {
  appState.pendingDeleteId = null;
  document.getElementById('delete-modal')?.classList.add('hidden');
}

function confirmDeleteTransaction() {
  if (!appState.pendingDeleteId) return;
  const removed = deleteTransaction(appState.pendingDeleteId);
  closeDeleteModal();
  if (removed) {
    showToast('Transaction deleted.');
    refreshApplication();
  }
}

/**
 * Budget Form Submit Handler
 */
function handleBudgetFormSubmit(event) {
  event.preventDefault();
  const input = document.getElementById('budget-limit-input');
  const errorEl = document.getElementById('budget-limit-error');
  input?.classList.remove('is-invalid');
  if (errorEl) errorEl.textContent = '';

  const result = validateBudgetInput(input?.value);
  if (!result.valid) {
    input?.classList.add('is-invalid');
    if (errorEl) errorEl.textContent = result.error;
    return;
  }

  saveBudget({ monthlyLimit: result.value });
  showToast('Monthly budget updated.');
  refreshApplication();
}

/**
 * Attaches all application-wide event listeners.
 */
function bindEvents() {
  // Sidebar navigation
  document.querySelectorAll('.nav-item[data-view]').forEach((btn) => {
    btn.addEventListener('click', () => setActiveView(btn.dataset.view));
  });

  // Mobile sidebar controls
  document.getElementById('btn-mobile-menu')?.addEventListener('click', openMobileSidebar);
  document.getElementById('sidebar-backdrop')?.addEventListener('click', closeMobileSidebar);

  // Global active month selector
  document.getElementById('global-month-select')?.addEventListener('change', (e) => {
    appState.activeMonth = e.target.value;
    refreshApplication();
  });

  // Quick navigation links on dashboard
  document.getElementById('btn-view-all-transactions')?.addEventListener('click', () => {
    setActiveView('transactions');
  });
  document.getElementById('btn-manage-budget')?.addEventListener('click', () => {
    setActiveView('budget');
  });

  // Add transaction triggers
  document.getElementById('btn-open-add-modal')?.addEventListener('click', () => openTransactionModal());
  document.getElementById('btn-transactions-add')?.addEventListener('click', () => openTransactionModal());
  document.getElementById('btn-empty-add-tx')?.addEventListener('click', () => openTransactionModal());

  // Transaction modal type switcher & close/submit
  document.querySelectorAll('[data-tx-type]').forEach((btn) => {
    btn.addEventListener('click', () => setModalTransactionType(btn.dataset.txType));
  });
  document.getElementById('btn-close-tx-modal')?.addEventListener('click', closeTransactionModal);
  document.getElementById('btn-cancel-tx-modal')?.addEventListener('click', closeTransactionModal);
  document.getElementById('transaction-form')?.addEventListener('submit', handleTransactionFormSubmit);

  // Close modals on backdrop click or Escape key
  document.getElementById('transaction-modal')?.addEventListener('click', (e) => {
    if (e.target.id === 'transaction-modal') closeTransactionModal();
  });
  document.getElementById('delete-modal')?.addEventListener('click', (e) => {
    if (e.target.id === 'delete-modal') closeDeleteModal();
  });
  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') {
      closeTransactionModal();
      closeDeleteModal();
      closeMobileSidebar();
    }
  });

  // Delete confirmation modal
  document.getElementById('btn-close-delete-modal')?.addEventListener('click', closeDeleteModal);
  document.getElementById('btn-cancel-delete')?.addEventListener('click', closeDeleteModal);
  document.getElementById('btn-confirm-delete')?.addEventListener('click', confirmDeleteTransaction);

  // Transaction History filters & sort
  document.getElementById('tx-search-input')?.addEventListener('input', (e) => {
    appState.txFilters.search = e.target.value;
    refreshApplication();
  });

  document.querySelectorAll('[data-type-filter]').forEach((btn) => {
    btn.addEventListener('click', () => {
      appState.txFilters.type = btn.dataset.typeFilter;
      document.querySelectorAll('[data-type-filter]').forEach((el) => {
        el.classList.toggle('is-active', el === btn);
      });
      refreshApplication();
    });
  });

  document.getElementById('tx-category-filter')?.addEventListener('change', (e) => {
    appState.txFilters.category = e.target.value;
    refreshApplication();
  });

  document.getElementById('tx-sort-select')?.addEventListener('change', (e) => {
    appState.txFilters.sortBy = e.target.value;
    refreshApplication();
  });

  document.getElementById('btn-clear-filters')?.addEventListener('click', () => {
    appState.txFilters = { search: '', type: 'all', category: 'all', sortBy: 'date-desc' };
    const searchInput = document.getElementById('tx-search-input');
    const sortSelect = document.getElementById('tx-sort-select');
    if (searchInput) searchInput.value = '';
    if (sortSelect) sortSelect.value = 'date-desc';
    document.querySelectorAll('[data-type-filter]').forEach((el) => {
      el.classList.toggle('is-active', el.dataset.typeFilter === 'all');
    });
    refreshApplication();
  });

  // Analytics timeframe switcher
  document.querySelectorAll('[data-analytics-range]').forEach((btn) => {
    btn.addEventListener('click', () => {
      appState.analyticsRange = btn.dataset.analyticsRange;
      document.querySelectorAll('[data-analytics-range]').forEach((el) => {
        el.classList.toggle('is-active', el === btn);
      });
      refreshApplication();
    });
  });

  // Budget form & quick presets
  document.getElementById('budget-form')?.addEventListener('submit', handleBudgetFormSubmit);
  document.querySelectorAll('[data-budget-preset]').forEach((btn) => {
    btn.addEventListener('click', () => {
      const limitInput = document.getElementById('budget-limit-input');
      const errorEl = document.getElementById('budget-limit-error');
      if (limitInput) {
        limitInput.value = Number(btn.dataset.budgetPreset).toFixed(2);
        limitInput.classList.remove('is-invalid');
      }
      if (errorEl) errorEl.textContent = '';
    });
  });

  // Export CSV & Reset Demo Data
  document.getElementById('btn-export-csv')?.addEventListener('click', () => {
    const transactions = getTransactions();
    if (transactions.length === 0) {
      showToast('No transactions available to export.', true);
      return;
    }
    exportTransactionsToCsv(transactions);
    showToast('Transactions exported to CSV.');
  });

  document.getElementById('btn-seed-demo')?.addEventListener('click', () => {
    resetToDemoData();
    appState.activeMonth = getCurrentMonthKey();
    showToast('Demo data restored.');
    refreshApplication();
  });
}

/**
 * Bootstrap application once DOM and deferred CDN scripts are ready.
 */
function init() {
  bindEvents();
  refreshApplication();
}

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', init);
} else {
  init();
}
