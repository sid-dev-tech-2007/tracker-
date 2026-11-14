/**
 * Dashboard Module (Feature 1)
 *
 * Renders:
 * - Total Balance, Total Income, Total Expenses, Monthly Spending KPI cards
 * - 6-month Monthly Spending Overview chart
 * - Expense Category Breakdown doughnut chart + legend
 * - Recent Transactions list
 * - Monthly Budget Snapshot & threshold alerts
 */

import {
  calculateFinancialSummary,
  escapeHtml,
  filterAndSortTransactions,
  formatCurrency,
  formatDate,
  formatMonthLabel,
  getMonthKey,
} from './transactions.js';
import { calculateBudgetStatus } from './budget.js';

const CHART_PALETTE = [
  '#2563EB',
  '#0F172A',
  '#0D9488',
  '#D97706',
  '#6366F1',
  '#64748B',
  '#DC2626',
  '#475569',
];

let monthlyChartInstance = null;
let categoryChartInstance = null;

/**
 * Aggregates monthly expense totals for the 6 months ending at activeMonthKey.
 * Pure calculation independent of storage.
 */
export function buildSixMonthExpenseSeries(transactions, activeMonthKey) {
  const [year, month] = activeMonthKey.split('-').map(Number);
  const buckets = [];

  for (let offset = 5; offset >= 0; offset -= 1) {
    const dt = new Date(year, month - 1 - offset, 1);
    const key = `${dt.getFullYear()}-${String(dt.getMonth() + 1).padStart(2, '0')}`;
    buckets.push({
      key,
      label: dt.toLocaleDateString('en-US', { month: 'short', year: '2-digit' }),
      total: 0,
    });
  }

  const indexMap = new Map(buckets.map((b, idx) => [b.key, idx]));

  for (const tx of transactions) {
    if (tx.type !== 'expense') continue;
    const key = getMonthKey(tx.date);
    if (indexMap.has(key)) {
      buckets[indexMap.get(key)].total += Number(tx.amount) || 0;
    }
  }

  return buckets.map((b) => ({
    ...b,
    total: Number(b.total.toFixed(2)),
  }));
}

/**
 * Aggregates expense categories for a given month key.
 */
export function buildMonthlyCategoryBreakdown(transactions, activeMonthKey) {
  const totals = new Map();
  let grandTotal = 0;

  for (const tx of transactions) {
    if (tx.type !== 'expense') continue;
    if (getMonthKey(tx.date) !== activeMonthKey) continue;
    const amt = Number(tx.amount) || 0;
    totals.set(tx.category, (totals.get(tx.category) || 0) + amt);
    grandTotal += amt;
  }

  const items = Array.from(totals.entries())
    .map(([category, total]) => ({
      category,
      total: Number(total.toFixed(2)),
      percentage: grandTotal > 0 ? Number(((total / grandTotal) * 100).toFixed(1)) : 0,
    }))
    .sort((a, b) => b.total - a.total);

  return { items, grandTotal: Number(grandTotal.toFixed(2)) };
}

function renderMonthlyOverviewChart(series) {
  const canvas = document.getElementById('dashboard-monthly-chart');
  const emptyEl = document.getElementById('dashboard-monthly-empty');
  if (!canvas || !emptyEl) return;

  const hasData = series.some((item) => item.total > 0);
  emptyEl.classList.toggle('hidden', hasData);
  canvas.classList.toggle('hidden', !hasData);

  if (monthlyChartInstance) {
    monthlyChartInstance.destroy();
    monthlyChartInstance = null;
  }

  if (!hasData || typeof window.Chart === 'undefined') return;

  monthlyChartInstance = new window.Chart(canvas.getContext('2d'), {
    type: 'bar',
    data: {
      labels: series.map((s) => s.label),
      datasets: [
        {
          label: 'Monthly Spending',
          data: series.map((s) => s.total),
          backgroundColor: series.map((_, i) => (i === series.length - 1 ? '#2563EB' : '#CBD5E1')),
          hoverBackgroundColor: '#1D4ED8',
          borderRadius: 6,
          maxBarThickness: 38,
        },
      ],
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      plugins: {
        legend: { display: false },
        tooltip: {
          callbacks: {
            label: (ctx) => ` ${formatCurrency(ctx.parsed.y)}`,
          },
        },
      },
      scales: {
        x: {
          grid: { display: false },
          ticks: { color: '#64748B', font: { size: 12 } },
        },
        y: {
          beginAtZero: true,
          border: { display: false },
          grid: { color: '#F1F5F9' },
          ticks: {
            color: '#64748B',
            font: { size: 11 },
            callback: (val) => `$${Number(val).toLocaleString()}`,
          },
        },
      },
    },
  });
}

function renderCategoryBreakdownChart(breakdown) {
  const canvas = document.getElementById('dashboard-category-chart');
  const emptyEl = document.getElementById('dashboard-category-empty');
  const legendEl = document.getElementById('dashboard-category-legend');
  if (!canvas || !emptyEl || !legendEl) return;

  const { items } = breakdown;
  const hasData = items.length > 0;

  emptyEl.classList.toggle('hidden', hasData);
  canvas.classList.toggle('hidden', !hasData);

  if (categoryChartInstance) {
    categoryChartInstance.destroy();
    categoryChartInstance = null;
  }

  if (!hasData) {
    legendEl.innerHTML = '';
    return;
  }

  legendEl.innerHTML = items
    .slice(0, 6)
    .map((item, idx) => {
      const color = CHART_PALETTE[idx % CHART_PALETTE.length];
      return `
        <li class="legend-row">
          <div class="legend-label-group">
            <span class="legend-swatch" style="background-color: ${color}"></span>
            <span class="legend-name">${escapeHtml(item.category)}</span>
          </div>
          <span class="legend-val tabular-nums">${formatCurrency(item.total)} (${item.percentage}%)</span>
        </li>
      `;
    })
    .join('');

  if (typeof window.Chart === 'undefined') return;

  categoryChartInstance = new window.Chart(canvas.getContext('2d'), {
    type: 'doughnut',
    data: {
      labels: items.map((i) => i.category),
      datasets: [
        {
          data: items.map((i) => i.total),
          backgroundColor: items.map((_, idx) => CHART_PALETTE[idx % CHART_PALETTE.length]),
          borderWidth: 2,
          borderColor: '#FFFFFF',
          hoverOffset: 4,
        },
      ],
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      cutout: '66%',
      plugins: {
        legend: { display: false },
        tooltip: {
          callbacks: {
            label: (ctx) => {
              const item = items[ctx.dataIndex];
              return ` ${item.category}: ${formatCurrency(item.total)} (${item.percentage}%)`;
            },
          },
        },
      },
    },
  });
}

function renderRecentTransactions(transactions, onOpenAdd) {
  const container = document.getElementById('dashboard-recent-list');
  if (!container) return;

  const recent = filterAndSortTransactions(transactions, { sortBy: 'date-desc' }).slice(0, 6);

  if (recent.length === 0) {
    container.innerHTML = `
      <div class="empty-state">
        <p class="empty-desc">No transactions yet. Log an income or expense to populate your feed.</p>
        <button type="button" class="btn-primary btn-sm" id="btn-recent-empty-add">Add Transaction</button>
      </div>
    `;
    const btn = document.getElementById('btn-recent-empty-add');
    if (btn && onOpenAdd) btn.onclick = onOpenAdd;
    return;
  }

  container.innerHTML = recent
    .map((tx) => {
      const isIncome = tx.type === 'income';
      const signed = `${isIncome ? '+' : '-'}${formatCurrency(tx.amount)}`;
      const amountClass = isIncome ? 'amount-income' : 'amount-expense';
      return `
        <div class="recent-row">
          <div class="recent-info">
            <span class="recent-title">${escapeHtml(tx.title)}</span>
            <div class="recent-meta">
              <span>${escapeHtml(tx.category)}</span>
              <span aria-hidden="true">·</span>
              <span class="tabular-nums">${escapeHtml(formatDate(tx.date))}</span>
            </div>
          </div>
          <span class="recent-amount tabular-nums ${amountClass}">${signed}</span>
        </div>
      `;
    })
    .join('');
}

function renderDashboardBudgetSnapshot(budgetStatus, activeMonthKey) {
  const subtitleEl = document.getElementById('dashboard-budget-subtitle');
  const container = document.getElementById('dashboard-budget-snapshot');
  const alertEl = document.getElementById('dashboard-budget-alert');

  if (subtitleEl) {
    subtitleEl.textContent = `${formatMonthLabel(activeMonthKey)} budget status`;
  }

  if (alertEl) {
    if (budgetStatus.status === 'exceeded') {
      alertEl.className = 'alert-banner is-danger';
      alertEl.innerHTML = `
        <div class="alert-banner-content">
          <i data-lucide="alert-octagon" class="alert-banner-icon" aria-hidden="true"></i>
          <span><strong>Budget Exceeded:</strong> Monthly spending is ${formatCurrency(budgetStatus.overageAmount)} over your ${formatCurrency(budgetStatus.monthlyBudget)} limit (${budgetStatus.utilizationPct.toFixed(1)}%).</span>
        </div>
      `;
    } else if (budgetStatus.status === 'warning') {
      alertEl.className = 'alert-banner is-warning';
      alertEl.innerHTML = `
        <div class="alert-banner-content">
          <i data-lucide="alert-triangle" class="alert-banner-icon" aria-hidden="true"></i>
          <span><strong>Budget Warning:</strong> You have used ${budgetStatus.utilizationPct.toFixed(1)}% of your ${formatCurrency(budgetStatus.monthlyBudget)} monthly budget.</span>
        </div>
      `;
    } else {
      alertEl.className = 'alert-banner hidden';
      alertEl.innerHTML = '';
    }
  }

  if (!container) return;

  if (budgetStatus.status === 'unset') {
    container.innerHTML = `
      <p class="empty-desc">No monthly spending limit configured yet. Set a monthly budget to monitor utilization warnings.</p>
    `;
    return;
  }

  const fillWidth = Math.min(budgetStatus.utilizationPct, 100);
  const fillClass =
    budgetStatus.status === 'exceeded'
      ? 'is-danger'
      : budgetStatus.status === 'warning'
        ? 'is-warning'
        : '';

  const remainingLabel = budgetStatus.remainingBudget >= 0 ? 'Remaining' : 'Exceeded by';
  const remainingValue = formatCurrency(Math.abs(budgetStatus.remainingBudget));

  container.innerHTML = `
    <div class="snapshot-row">
      <span class="snapshot-big tabular-nums">${budgetStatus.utilizationPct.toFixed(1)}%</span>
      <span class="snapshot-sub tabular-nums">${formatCurrency(budgetStatus.monthlySpent)} of ${formatCurrency(budgetStatus.monthlyBudget)}</span>
    </div>
    <div class="progress-track" role="progressbar" aria-valuemin="0" aria-valuemax="100" aria-valuenow="${Math.round(fillWidth)}">
      <div class="progress-fill ${fillClass}" style="width: ${fillWidth}%"></div>
    </div>
    <div class="snapshot-stats">
      <div>
        <span class="snapshot-stat-label">${remainingLabel}</span>
        <span class="snapshot-stat-val tabular-nums">${remainingValue}</span>
      </div>
      <div>
        <span class="snapshot-stat-label">Status</span>
        <span class="snapshot-stat-val">${budgetStatus.statusLabel}</span>
      </div>
    </div>
  `;
}

/**
 * Main render entry point for the Dashboard view.
 */
export function renderDashboardView(transactions, budgetConfig, activeMonthKey, handlers) {
  const summary = calculateFinancialSummary(transactions, activeMonthKey);
  const budgetStatus = calculateBudgetStatus(transactions, budgetConfig, activeMonthKey);

  const balanceEl = document.getElementById('kpi-total-balance');
  const incomeEl = document.getElementById('kpi-total-income');
  const expensesEl = document.getElementById('kpi-total-expenses');
  const monthlyEl = document.getElementById('kpi-monthly-spending');

  const balanceMeta = document.getElementById('kpi-balance-meta');
  const incomeMeta = document.getElementById('kpi-income-meta');
  const expenseMeta = document.getElementById('kpi-expense-meta');
  const monthlyMeta = document.getElementById('kpi-monthly-meta');
  const catSubtitle = document.getElementById('dashboard-category-subtitle');

  if (balanceEl) {
    balanceEl.textContent = formatCurrency(summary.totalBalance);
    balanceEl.classList.toggle('kpi-value-expense', summary.totalBalance < 0);
  }
  if (incomeEl) incomeEl.textContent = formatCurrency(summary.totalIncome);
  if (expensesEl) expensesEl.textContent = formatCurrency(summary.totalExpenses);
  if (monthlyEl) monthlyEl.textContent = formatCurrency(summary.monthlyExpenses);

  if (balanceMeta) {
    balanceMeta.textContent = `${summary.incomeCount + summary.expenseCount} total entries`;
  }
  if (incomeMeta) {
    incomeMeta.textContent = `${summary.incomeCount} income ${summary.incomeCount === 1 ? 'entry' : 'entries'}`;
  }
  if (expenseMeta) {
    expenseMeta.textContent = `${summary.expenseCount} expense ${summary.expenseCount === 1 ? 'entry' : 'entries'}`;
  }
  if (monthlyMeta) {
    monthlyMeta.textContent = `${formatMonthLabel(activeMonthKey, 'short')} · ${summary.monthlyExpenseCount} expenses`;
  }
  if (catSubtitle) {
    catSubtitle.textContent = `${formatMonthLabel(activeMonthKey)} distribution`;
  }

  const series = buildSixMonthExpenseSeries(transactions, activeMonthKey);
  const breakdown = buildMonthlyCategoryBreakdown(transactions, activeMonthKey);

  renderMonthlyOverviewChart(series);
  renderCategoryBreakdownChart(breakdown);
  renderRecentTransactions(transactions, handlers?.onOpenAdd);
  renderDashboardBudgetSnapshot(budgetStatus, activeMonthKey);

  if (window.lucide?.createIcons) {
    window.lucide.createIcons();
  }
}
