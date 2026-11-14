/**
 * Budget Management Module (Feature 5)
 *
 * Pure budget status calculations (independent of LocalStorage) + Budget view rendering:
 * - Set monthly budget with validation
 * - Track monthly expenses
 * - Remaining budget & utilization percentage
 * - Warning at >= 80% spending
 * - Alert when > 100% budget exceeded
 */

import {
  escapeHtml,
  formatCurrency,
  formatMonthLabel,
  getMonthKey,
} from './transactions.js';

/**
 * Computes budget utilization and threshold status for a given month.
 * Pure calculation independent of storage.
 *
 * @param {Array<Object>} transactions
 * @param {{ monthlyLimit: number }} budgetConfig
 * @param {string} activeMonthKey
 */
export function calculateBudgetStatus(transactions, budgetConfig, activeMonthKey) {
  const monthlyBudget = Number(budgetConfig?.monthlyLimit) || 0;
  let monthlySpent = 0;
  const categoryTotals = new Map();

  for (const tx of transactions) {
    if (tx.type !== 'expense') continue;
    if (getMonthKey(tx.date) !== activeMonthKey) continue;
    const amt = Number(tx.amount) || 0;
    monthlySpent += amt;
    categoryTotals.set(tx.category, (categoryTotals.get(tx.category) || 0) + amt);
  }

  monthlySpent = Number(monthlySpent.toFixed(2));
  const remainingBudget = Number((monthlyBudget - monthlySpent).toFixed(2));

  if (monthlyBudget <= 0) {
    return {
      monthlyBudget: 0,
      monthlySpent,
      remainingBudget: 0,
      utilizationPct: 0,
      overageAmount: 0,
      status: 'unset',
      statusLabel: 'Not Configured',
      categoryBreakdown: [],
    };
  }

  const utilizationPct = Number(((monthlySpent / monthlyBudget) * 100).toFixed(1));
  const overageAmount = monthlySpent > monthlyBudget ? Number((monthlySpent - monthlyBudget).toFixed(2)) : 0;

  let status = 'normal';
  let statusLabel = 'On Track';

  if (utilizationPct > 100) {
    status = 'exceeded';
    statusLabel = 'Budget Exceeded';
  } else if (utilizationPct >= 80) {
    status = 'warning';
    statusLabel = 'Approaching Limit';
  }

  const categoryBreakdown = Array.from(categoryTotals.entries())
    .map(([category, total]) => ({
      category,
      total: Number(total.toFixed(2)),
      pctOfBudget: Number(((total / monthlyBudget) * 100).toFixed(1)),
    }))
    .sort((a, b) => b.total - a.total);

  return {
    monthlyBudget,
    monthlySpent,
    remainingBudget,
    utilizationPct,
    overageAmount,
    status,
    statusLabel,
    categoryBreakdown,
  };
}

/**
 * Validates budget form input.
 * @param {string|number} rawLimit
 */
export function validateBudgetInput(rawLimit) {
  const value = Number(rawLimit);
  if (!Number.isFinite(value) || value <= 0) {
    return { valid: false, error: 'Enter a valid monthly budget greater than 0.' };
  }
  if (value > 100000000) {
    return { valid: false, error: 'Budget limit exceeds maximum allowed amount.' };
  }
  return { valid: true, error: '', value: Number(value.toFixed(2)) };
}

/**
 * Renders the Budget Management view.
 */
export function renderBudgetView(transactions, budgetConfig, activeMonthKey) {
  const status = calculateBudgetStatus(transactions, budgetConfig, activeMonthKey);

  const alertEl = document.getElementById('budget-status-alert');
  const limitInput = document.getElementById('budget-limit-input');
  const periodLabel = document.getElementById('budget-period-label');
  const stateText = document.getElementById('budget-state-text');
  const valLimit = document.getElementById('budget-val-limit');
  const valSpent = document.getElementById('budget-val-spent');
  const labelRemaining = document.getElementById('budget-label-remaining');
  const valRemaining = document.getElementById('budget-val-remaining');
  const valPct = document.getElementById('budget-val-pct');
  const progressFill = document.getElementById('budget-progress-fill');
  const progressWrap = document.getElementById('budget-progress-bar-wrap');
  const catBarsEl = document.getElementById('budget-category-bars');

  if (limitInput && document.activeElement !== limitInput) {
    limitInput.value = status.monthlyBudget > 0 ? status.monthlyBudget.toFixed(2) : '';
  }

  if (periodLabel) {
    periodLabel.textContent = `${formatMonthLabel(activeMonthKey)} spending against monthly limit`;
  }

  if (alertEl) {
    if (status.status === 'exceeded') {
      alertEl.className = 'alert-banner is-danger';
      alertEl.innerHTML = `
        <div class="alert-banner-content">
          <i data-lucide="alert-octagon" class="alert-banner-icon" aria-hidden="true"></i>
          <span><strong>Alert: Monthly Budget Exceeded.</strong> You have spent ${formatCurrency(status.monthlySpent)} against a ${formatCurrency(status.monthlyBudget)} target (+${formatCurrency(status.overageAmount)} over).</span>
        </div>
      `;
    } else if (status.status === 'warning') {
      alertEl.className = 'alert-banner is-warning';
      alertEl.innerHTML = `
        <div class="alert-banner-content">
          <i data-lucide="alert-triangle" class="alert-banner-icon" aria-hidden="true"></i>
          <span><strong>Warning: 80% Threshold Reached.</strong> ${formatCurrency(status.remainingBudget)} remaining for ${formatMonthLabel(activeMonthKey)}.</span>
        </div>
      `;
    } else {
      alertEl.className = 'alert-banner hidden';
      alertEl.innerHTML = '';
    }
  }

  if (stateText) {
    stateText.textContent = status.statusLabel;
    stateText.className = 'status-text';
    if (status.status === 'exceeded') stateText.classList.add('is-danger');
    else if (status.status === 'warning') stateText.classList.add('is-warning');
    else if (status.status === 'normal') stateText.classList.add('is-normal');
  }

  if (valLimit) valLimit.textContent = formatCurrency(status.monthlyBudget);
  if (valSpent) valSpent.textContent = formatCurrency(status.monthlySpent);

  if (labelRemaining && valRemaining) {
    if (status.remainingBudget < 0) {
      labelRemaining.textContent = 'Over Budget';
      valRemaining.textContent = formatCurrency(Math.abs(status.remainingBudget));
      valRemaining.classList.add('kpi-value-expense');
    } else {
      labelRemaining.textContent = 'Remaining Budget';
      valRemaining.textContent = formatCurrency(status.remainingBudget);
      valRemaining.classList.remove('kpi-value-expense');
    }
  }

  if (valPct) valPct.textContent = `${status.utilizationPct.toFixed(1)}%`;

  const clampedWidth = Math.min(status.utilizationPct, 100);
  if (progressFill) {
    progressFill.style.width = `${clampedWidth}%`;
    progressFill.className = 'progress-fill';
    if (status.status === 'exceeded') progressFill.classList.add('is-danger');
    else if (status.status === 'warning') progressFill.classList.add('is-warning');
  }
  if (progressWrap) {
    progressWrap.setAttribute('aria-valuenow', String(Math.round(clampedWidth)));
  }

  if (catBarsEl) {
    if (status.monthlyBudget <= 0) {
      catBarsEl.innerHTML = `<p class="empty-desc">Save a monthly budget target to inspect category share.</p>`;
    } else if (status.categoryBreakdown.length === 0) {
      catBarsEl.innerHTML = `<p class="empty-desc">No expenses recorded in ${escapeHtml(formatMonthLabel(activeMonthKey))} yet.</p>`;
    } else {
      catBarsEl.innerHTML = status.categoryBreakdown
        .map((row) => {
          const width = Math.min(row.pctOfBudget, 100);
          return `
            <div class="cat-bar-row">
              <div class="cat-bar-meta">
                <span>${escapeHtml(row.category)}</span>
                <span class="tabular-nums">${formatCurrency(row.total)} (${row.pctOfBudget}% of budget)</span>
              </div>
              <div class="cat-bar-track">
                <div class="cat-bar-fill" style="width: ${width}%"></div>
              </div>
            </div>
          `;
        })
        .join('');
    }
  }

  if (window.lucide?.createIcons) {
    window.lucide.createIcons();
  }
}
