/**
 * Transactions Module
 *
 * Contains:
 * - Pure financial calculations & filtering/sorting utilities (independent of storage)
 * - Input validation for Income/Expense forms
 * - Transaction History table rendering & CSV export
 */

import { CATEGORIES } from './storage.js';

const CURRENCY_FORMATTER = new Intl.NumberFormat('en-US', {
  style: 'currency',
  currency: 'USD',
  minimumFractionDigits: 2,
  maximumFractionDigits: 2,
});

/**
 * Formats a numeric value as USD currency.
 * @param {number} amount
 * @returns {string}
 */
export function formatCurrency(amount) {
  const num = Number(amount);
  return CURRENCY_FORMATTER.format(Number.isFinite(num) ? num : 0);
}

/**
 * Escapes HTML special characters to prevent XSS in template strings.
 * @param {string} value
 * @returns {string}
 */
export function escapeHtml(value) {
  return String(value ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

/**
 * Extracts YYYY-MM from a YYYY-MM-DD date string.
 * @param {string} dateStr
 * @returns {string}
 */
export function getMonthKey(dateStr) {
  if (!dateStr || typeof dateStr !== 'string') return '';
  return dateStr.slice(0, 7);
}

/**
 * Returns today's date as YYYY-MM-DD in local time.
 * @returns {string}
 */
export function getTodayDateString() {
  const now = new Date();
  const y = now.getFullYear();
  const m = String(now.getMonth() + 1).padStart(2, '0');
  const d = String(now.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

/**
 * Returns current month as YYYY-MM.
 * @returns {string}
 */
export function getCurrentMonthKey() {
  return getTodayDateString().slice(0, 7);
}

/**
 * Formats YYYY-MM-DD into a clean readable date (e.g. "Nov 13, 2026").
 * @param {string} dateStr
 * @returns {string}
 */
export function formatDate(dateStr) {
  if (!dateStr) return '—';
  const parts = dateStr.split('-').map(Number);
  if (parts.length !== 3 || parts.some(Number.isNaN)) return dateStr;
  const dt = new Date(parts[0], parts[1] - 1, parts[2]);
  return dt.toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  });
}

/**
 * Formats YYYY-MM into "November 2026" or short "Nov 2026".
 * @param {string} monthKey
 * @param {'long'|'short'} format
 * @returns {string}
 */
export function formatMonthLabel(monthKey, format = 'long') {
  if (!monthKey || !monthKey.includes('-')) return monthKey || '';
  const [year, month] = monthKey.split('-').map(Number);
  const dt = new Date(year, month - 1, 1);
  return dt.toLocaleDateString('en-US', {
    month: format,
    year: 'numeric',
  });
}

/**
 * Generates an ordered list of available YYYY-MM keys from transactions + current month.
 * @param {Array<Object>} transactions
 * @returns {Array<string>}
 */
export function getAvailableMonths(transactions) {
  const set = new Set([getCurrentMonthKey()]);
  for (const tx of transactions) {
    const key = getMonthKey(tx.date);
    if (/^\d{4}-\d{2}$/.test(key)) {
      set.add(key);
    }
  }
  return Array.from(set).sort((a, b) => b.localeCompare(a));
}

/**
 * Calculates core financial totals dynamically from transactions.
 * Total Balance = Total Income - Total Expenses.
 *
 * @param {Array<Object>} transactions
 * @param {string} activeMonthKey YYYY-MM
 */
export function calculateFinancialSummary(transactions, activeMonthKey = getCurrentMonthKey()) {
  let totalIncome = 0;
  let totalExpenses = 0;
  let incomeCount = 0;
  let expenseCount = 0;
  let monthlyIncome = 0;
  let monthlyExpenses = 0;
  let monthlyExpenseCount = 0;

  for (const tx of transactions) {
    const amount = Number(tx.amount) || 0;
    const isSameMonth = getMonthKey(tx.date) === activeMonthKey;

    if (tx.type === 'income') {
      totalIncome += amount;
      incomeCount += 1;
      if (isSameMonth) monthlyIncome += amount;
    } else {
      totalExpenses += amount;
      expenseCount += 1;
      if (isSameMonth) {
        monthlyExpenses += amount;
        monthlyExpenseCount += 1;
      }
    }
  }

  return {
    totalIncome: Number(totalIncome.toFixed(2)),
    totalExpenses: Number(totalExpenses.toFixed(2)),
    totalBalance: Number((totalIncome - totalExpenses).toFixed(2)),
    incomeCount,
    expenseCount,
    monthlyIncome: Number(monthlyIncome.toFixed(2)),
    monthlyExpenses: Number(monthlyExpenses.toFixed(2)),
    monthlyExpenseCount,
    monthlySavings: Number((monthlyIncome - monthlyExpenses).toFixed(2)),
  };
}

/**
 * Filters and sorts transactions according to active criteria.
 *
 * @param {Array<Object>} transactions
 * @param {{ search?: string, type?: string, category?: string, sortBy?: string }} criteria
 * @returns {Array<Object>}
 */
export function filterAndSortTransactions(transactions, criteria = {}) {
  const {
    search = '',
    type = 'all',
    category = 'all',
    sortBy = 'date-desc',
  } = criteria;

  const query = search.trim().toLowerCase();

  const filtered = transactions.filter((tx) => {
    if (type !== 'all' && tx.type !== type) return false;
    if (category !== 'all' && tx.category !== category) return false;

    if (query) {
      const haystack = `${tx.title} ${tx.description} ${tx.category} ${tx.amount}`.toLowerCase();
      if (!haystack.includes(query)) return false;
    }

    return true;
  });

  filtered.sort((a, b) => {
    switch (sortBy) {
      case 'date-asc':
        return a.date.localeCompare(b.date) || a.title.localeCompare(b.title);
      case 'amount-desc':
        return b.amount - a.amount || b.date.localeCompare(a.date);
      case 'amount-asc':
        return a.amount - b.amount || b.date.localeCompare(a.date);
      case 'date-desc':
      default:
        return b.date.localeCompare(a.date) || a.title.localeCompare(b.title);
    }
  });

  return filtered;
}

/**
 * Validates transaction form input before saving.
 * @param {Object} input
 * @returns {{ valid: boolean, errors: Record<string, string> }}
 */
export function validateTransactionInput(input) {
  const errors = {};
  const title = String(input.title || '').trim();
  const amount = Number(input.amount);
  const category = String(input.category || '').trim();
  const type = input.type === 'income' ? 'income' : input.type === 'expense' ? 'expense' : '';
  const date = String(input.date || '').trim();

  if (!title) {
    errors.title = 'Enter a transaction title.';
  } else if (title.length < 2) {
    errors.title = 'Title must be at least 2 characters.';
  }

  if (!Number.isFinite(amount) || amount <= 0) {
    errors.amount = 'Enter a valid amount greater than 0.';
  } else if (amount > 100000000) {
    errors.amount = 'Amount exceeds maximum allowed limit.';
  }

  if (!type) {
    errors.type = 'Select income or expense.';
  }

  if (!category) {
    errors.category = 'Select a category.';
  }

  if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) {
    errors.date = 'Select a valid date.';
  } else {
    const parsed = new Date(`${date}T00:00:00`);
    if (Number.isNaN(parsed.getTime())) {
      errors.date = 'Invalid calendar date.';
    }
  }

  return {
    valid: Object.keys(errors).length === 0,
    errors,
  };
}

/**
 * Populates category dropdowns cleanly for the transaction form and filter toolbar.
 */
export function populateCategorySelect(selectEl, type = 'expense', selectedValue = '') {
  if (!selectEl) return;
  const list = CATEGORIES[type] || CATEGORIES.expense;
  selectEl.innerHTML = list
    .map((cat) => `<option value="${escapeHtml(cat)}">${escapeHtml(cat)}</option>`)
    .join('');

  if (selectedValue && list.includes(selectedValue)) {
    selectEl.value = selectedValue;
  }
}

export function populateFilterCategorySelect(selectEl, transactions, currentFilter = 'all') {
  if (!selectEl) return;
  const uniqueCategories = new Set([
    ...CATEGORIES.expense,
    ...CATEGORIES.income,
    ...transactions.map((tx) => tx.category),
  ]);

  const sorted = Array.from(uniqueCategories).sort((a, b) => a.localeCompare(b));
  selectEl.innerHTML =
    `<option value="all">All Categories</option>` +
    sorted.map((cat) => `<option value="${escapeHtml(cat)}">${escapeHtml(cat)}</option>`).join('');

  selectEl.value = sorted.includes(currentFilter) ? currentFilter : 'all';
}

/**
 * Renders the Transaction History view table, filtered summary, and empty states.
 */
export function renderTransactionsView(transactions, filterState, handlers) {
  const tbody = document.getElementById('transactions-table-body');
  const tableEl = document.getElementById('transactions-table');
  const emptyEl = document.getElementById('transactions-empty-state');
  const emptyTitle = document.getElementById('transactions-empty-title');
  const emptyDesc = document.getElementById('transactions-empty-desc');
  const countSubtitle = document.getElementById('transactions-count-subtitle');
  const summaryBar = document.getElementById('tx-filtered-summary');
  const clearFiltersBtn = document.getElementById('btn-clear-filters');
  const categorySelect = document.getElementById('tx-category-filter');

  populateFilterCategorySelect(categorySelect, transactions, filterState.category);

  const filtered = filterAndSortTransactions(transactions, filterState);
  const hasActiveFilters =
    Boolean(filterState.search.trim()) ||
    filterState.type !== 'all' ||
    filterState.category !== 'all';

  if (clearFiltersBtn) {
    clearFiltersBtn.classList.toggle('hidden', !hasActiveFilters);
  }

  if (countSubtitle) {
    countSubtitle.textContent =
      filtered.length === transactions.length
        ? `${transactions.length} ${transactions.length === 1 ? 'transaction' : 'transactions'}`
        : `Showing ${filtered.length} of ${transactions.length} transactions`;
  }

  // Calculate dynamic filtered totals
  let filteredIncome = 0;
  let filteredExpenses = 0;
  for (const tx of filtered) {
    if (tx.type === 'income') filteredIncome += tx.amount;
    else filteredExpenses += tx.amount;
  }
  const netFiltered = filteredIncome - filteredExpenses;

  if (summaryBar) {
    summaryBar.innerHTML = `
      <span>Filtered Income: <strong class="tabular-nums amount-income">${formatCurrency(filteredIncome)}</strong></span>
      <span class="summary-sep" aria-hidden="true">|</span>
      <span>Filtered Expenses: <strong class="tabular-nums">${formatCurrency(filteredExpenses)}</strong></span>
      <span class="summary-sep" aria-hidden="true">|</span>
      <span>Net: <strong class="tabular-nums">${formatCurrency(netFiltered)}</strong></span>
    `;
  }

  if (!tbody || !tableEl || !emptyEl) return;

  if (filtered.length === 0) {
    tableEl.classList.add('hidden');
    emptyEl.classList.remove('hidden');
    if (transactions.length === 0) {
      emptyTitle.textContent = 'No transactions recorded yet';
      emptyDesc.textContent = 'Add your first income or expense entry to begin tracking your finances.';
    } else {
      emptyTitle.textContent = 'No matching transactions';
      emptyDesc.textContent = 'Try adjusting your search keywords, category, or transaction type filter.';
    }
    tbody.innerHTML = '';
    return;
  }

  tableEl.classList.remove('hidden');
  emptyEl.classList.add('hidden');

  tbody.innerHTML = filtered
    .map((tx) => {
      const isIncome = tx.type === 'income';
      const signedAmount = `${isIncome ? '+' : '-'}${formatCurrency(tx.amount)}`;
      const amountClass = isIncome ? 'amount-income' : 'amount-expense';
      const typeLabel = isIncome ? 'Income' : 'Expense';
      const typeClass = isIncome ? 'tx-type-income' : 'tx-type-expense';

      return `
        <tr data-tx-id="${escapeHtml(tx.id)}">
          <td data-label="Date" class="tabular-nums">${escapeHtml(formatDate(tx.date))}</td>
          <td data-label="Title">
            <div class="tx-title-cell">
              <span class="tx-name">${escapeHtml(tx.title)}</span>
              ${tx.description ? `<span class="tx-desc" title="${escapeHtml(tx.description)}">${escapeHtml(tx.description)}</span>` : ''}
            </div>
          </td>
          <td data-label="Category">${escapeHtml(tx.category)}</td>
          <td data-label="Type"><span class="tx-type-label ${typeClass}">${typeLabel}</span></td>
          <td data-label="Amount" class="text-right tabular-nums ${amountClass}"><strong>${signedAmount}</strong></td>
          <td class="text-right">
            <div class="row-actions">
              <button
                type="button"
                class="icon-btn"
                data-action="edit-tx"
                data-id="${escapeHtml(tx.id)}"
                aria-label="Edit ${escapeHtml(tx.title)}"
                title="Edit transaction"
              >
                <i data-lucide="pencil" aria-hidden="true"></i>
              </button>
              <button
                type="button"
                class="icon-btn icon-btn-danger"
                data-action="delete-tx"
                data-id="${escapeHtml(tx.id)}"
                aria-label="Delete ${escapeHtml(tx.title)}"
                title="Delete transaction"
              >
                <i data-lucide="trash-2" aria-hidden="true"></i>
              </button>
            </div>
          </td>
        </tr>
      `;
    })
    .join('');

  // Bind row action handlers via event delegation on tbody
  tbody.onclick = (event) => {
    const btn = event.target.closest('button[data-action]');
    if (!btn) return;
    const { action, id } = btn.dataset;
    if (action === 'edit-tx' && handlers?.onEdit) {
      handlers.onEdit(id);
    } else if (action === 'delete-tx' && handlers?.onDelete) {
      handlers.onDelete(id);
    }
  };

  if (window.lucide?.createIcons) {
    window.lucide.createIcons();
  }
}

/**
 * Exports given transactions as a downloadable CSV file.
 * @param {Array<Object>} transactions
 */
export function exportTransactionsToCsv(transactions) {
  const headers = ['ID', 'Date', 'Type', 'Title', 'Category', 'Amount', 'Description'];
  const csvEscape = (val) => `"${String(val ?? '').replace(/"/g, '""')}"`;

  const rows = transactions.map((tx) =>
    [
      tx.id,
      tx.date,
      tx.type,
      tx.title,
      tx.category,
      tx.amount.toFixed(2),
      tx.description || '',
    ]
      .map(csvEscape)
      .join(',')
  );

  const csvContent = [headers.join(','), ...rows].join('\n');
  const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);

  const link = document.createElement('a');
  link.href = url;
  link.download = `ledgerflow-transactions-${getTodayDateString()}.csv`;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}
