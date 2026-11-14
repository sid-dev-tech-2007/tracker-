/**
 * Expense Analytics Module (Feature 4)
 *
 * Pure analytical calculations + dynamic Chart.js visualizations:
 * - Category-wise expense breakdown
 * - Monthly income versus expenses
 * - Spending distribution
 * - Highest spending category
 * - Total savings & savings rate
 */

import {
  escapeHtml,
  formatCurrency,
  getMonthKey,
} from './transactions.js';

const ANALYTICS_PALETTE = [
  '#2563EB',
  '#0F172A',
  '#0D9488',
  '#D97706',
  '#6366F1',
  '#475569',
  '#DC2626',
  '#94A3B8',
];

let incomeExpenseChart = null;
let distributionChart = null;
let categoryBarChart = null;

/**
 * Filters transactions to the selected analytics timeframe.
 */
export function filterTransactionsByRange(transactions, range, activeMonthKey) {
  if (range === 'all') return transactions;

  if (range === 'month') {
    return transactions.filter((tx) => getMonthKey(tx.date) === activeMonthKey);
  }

  // Default: '6months' ending at activeMonthKey
  const [year, month] = activeMonthKey.split('-').map(Number);
  const allowedMonths = new Set();
  for (let offset = 5; offset >= 0; offset -= 1) {
    const dt = new Date(year, month - 1 - offset, 1);
    const key = `${dt.getFullYear()}-${String(dt.getMonth() + 1).padStart(2, '0')}`;
    allowedMonths.add(key);
  }
  return transactions.filter((tx) => allowedMonths.has(getMonthKey(tx.date)));
}

/**
 * Computes summary analytics metrics from scoped transactions.
 */
export function computeAnalyticsMetrics(scopedTransactions) {
  let totalIncome = 0;
  let totalExpenses = 0;
  let incomeCount = 0;
  let expenseCount = 0;

  const categoryMap = new Map();

  for (const tx of scopedTransactions) {
    const amount = Number(tx.amount) || 0;
    if (tx.type === 'income') {
      totalIncome += amount;
      incomeCount += 1;
    } else {
      totalExpenses += amount;
      expenseCount += 1;
      const prev = categoryMap.get(tx.category) || { total: 0, count: 0 };
      categoryMap.set(tx.category, {
        total: prev.total + amount,
        count: prev.count + 1,
      });
    }
  }

  const categoryBreakdown = Array.from(categoryMap.entries())
    .map(([category, data]) => ({
      category,
      total: Number(data.total.toFixed(2)),
      count: data.count,
      percentage: totalExpenses > 0 ? Number(((data.total / totalExpenses) * 100).toFixed(1)) : 0,
    }))
    .sort((a, b) => b.total - a.total);

  const totalSavings = Number((totalIncome - totalExpenses).toFixed(2));
  const savingsRate =
    totalIncome > 0 ? Number(((totalSavings / totalIncome) * 100).toFixed(1)) : 0;

  return {
    totalIncome: Number(totalIncome.toFixed(2)),
    totalExpenses: Number(totalExpenses.toFixed(2)),
    incomeCount,
    expenseCount,
    totalSavings,
    savingsRate,
    highestCategory: categoryBreakdown[0] || null,
    categoryBreakdown,
  };
}

/**
 * Computes 6-month side-by-side income vs expense series ending at activeMonthKey.
 */
export function computeMonthlyComparisonSeries(transactions, activeMonthKey) {
  const [year, month] = activeMonthKey.split('-').map(Number);
  const buckets = [];

  for (let offset = 5; offset >= 0; offset -= 1) {
    const dt = new Date(year, month - 1 - offset, 1);
    const key = `${dt.getFullYear()}-${String(dt.getMonth() + 1).padStart(2, '0')}`;
    buckets.push({
      key,
      label: dt.toLocaleDateString('en-US', { month: 'short', year: '2-digit' }),
      income: 0,
      expenses: 0,
    });
  }

  const indexMap = new Map(buckets.map((b, idx) => [b.key, idx]));

  for (const tx of transactions) {
    const key = getMonthKey(tx.date);
    if (!indexMap.has(key)) continue;
    const bucket = buckets[indexMap.get(key)];
    if (tx.type === 'income') {
      bucket.income += Number(tx.amount) || 0;
    } else {
      bucket.expenses += Number(tx.amount) || 0;
    }
  }

  return buckets.map((b) => ({
    ...b,
    income: Number(b.income.toFixed(2)),
    expenses: Number(b.expenses.toFixed(2)),
  }));
}

function renderIncomeVsExpenseChart(series) {
  const canvas = document.getElementById('analytics-income-expense-chart');
  if (!canvas) return;

  if (incomeExpenseChart) {
    incomeExpenseChart.destroy();
    incomeExpenseChart = null;
  }

  if (typeof window.Chart === 'undefined') return;

  incomeExpenseChart = new window.Chart(canvas.getContext('2d'), {
    type: 'bar',
    data: {
      labels: series.map((s) => s.label),
      datasets: [
        {
          label: 'Income',
          data: series.map((s) => s.income),
          backgroundColor: '#16A34A',
          borderRadius: 5,
          maxBarThickness: 28,
        },
        {
          label: 'Expenses',
          data: series.map((s) => s.expenses),
          backgroundColor: '#0F172A',
          borderRadius: 5,
          maxBarThickness: 28,
        },
      ],
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      plugins: {
        legend: {
          position: 'top',
          align: 'end',
          labels: {
            boxWidth: 10,
            boxHeight: 10,
            usePointStyle: true,
            pointStyle: 'rectRounded',
            color: '#475569',
            font: { size: 12 },
          },
        },
        tooltip: {
          callbacks: {
            label: (ctx) => ` ${ctx.dataset.label}: ${formatCurrency(ctx.parsed.y)}`,
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

function renderSpendingDistributionChart(breakdown) {
  const canvas = document.getElementById('analytics-distribution-chart');
  const emptyEl = document.getElementById('analytics-distribution-empty');
  if (!canvas || !emptyEl) return;

  const hasData = breakdown.length > 0;
  emptyEl.classList.toggle('hidden', hasData);
  canvas.classList.toggle('hidden', !hasData);

  if (distributionChart) {
    distributionChart.destroy();
    distributionChart = null;
  }

  if (!hasData || typeof window.Chart === 'undefined') return;

  distributionChart = new window.Chart(canvas.getContext('2d'), {
    type: 'doughnut',
    data: {
      labels: breakdown.map((b) => b.category),
      datasets: [
        {
          data: breakdown.map((b) => b.total),
          backgroundColor: breakdown.map((_, i) => ANALYTICS_PALETTE[i % ANALYTICS_PALETTE.length]),
          borderWidth: 2,
          borderColor: '#FFFFFF',
        },
      ],
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      cutout: '60%',
      plugins: {
        legend: {
          position: 'bottom',
          labels: {
            boxWidth: 10,
            boxHeight: 10,
            padding: 12,
            color: '#475569',
            font: { size: 11.5 },
          },
        },
        tooltip: {
          callbacks: {
            label: (ctx) => {
              const row = breakdown[ctx.dataIndex];
              return ` ${row.category}: ${formatCurrency(row.total)} (${row.percentage}%)`;
            },
          },
        },
      },
    },
  });
}

function renderCategoryBreakdownBarChart(breakdown) {
  const canvas = document.getElementById('analytics-category-bar-chart');
  const emptyEl = document.getElementById('analytics-category-bar-empty');
  if (!canvas || !emptyEl) return;

  const hasData = breakdown.length > 0;
  emptyEl.classList.toggle('hidden', hasData);
  canvas.classList.toggle('hidden', !hasData);

  if (categoryBarChart) {
    categoryBarChart.destroy();
    categoryBarChart = null;
  }

  if (!hasData || typeof window.Chart === 'undefined') return;

  categoryBarChart = new window.Chart(canvas.getContext('2d'), {
    type: 'bar',
    data: {
      labels: breakdown.map((b) => b.category),
      datasets: [
        {
          label: 'Category Spend',
          data: breakdown.map((b) => b.total),
          backgroundColor: '#2563EB',
          borderRadius: 5,
          maxBarThickness: 24,
        },
      ],
    },
    options: {
      indexAxis: 'y',
      responsive: true,
      maintainAspectRatio: false,
      plugins: {
        legend: { display: false },
        tooltip: {
          callbacks: {
            label: (ctx) => {
              const row = breakdown[ctx.dataIndex];
              return ` ${formatCurrency(row.total)} (${row.percentage}%)`;
            },
          },
        },
      },
      scales: {
        x: {
          beginAtZero: true,
          border: { display: false },
          grid: { color: '#F1F5F9' },
          ticks: {
            color: '#64748B',
            font: { size: 11 },
            callback: (val) => `$${Number(val).toLocaleString()}`,
          },
        },
        y: {
          grid: { display: false },
          ticks: { color: '#0F172A', font: { size: 12 } },
        },
      },
    },
  });
}

function renderCategoryTable(breakdown) {
  const tbody = document.getElementById('analytics-category-table-body');
  if (!tbody) return;

  if (breakdown.length === 0) {
    tbody.innerHTML = `
      <tr>
        <td colspan="4" style="text-align:center; color: var(--ink-muted); padding: 24px;">
          No expense categories recorded in this timeframe.
        </td>
      </tr>
    `;
    return;
  }

  tbody.innerHTML = breakdown
    .map(
      (row) => `
      <tr>
        <td>${escapeHtml(row.category)}</td>
        <td class="text-right tabular-nums">${row.count}</td>
        <td class="text-right tabular-nums">${row.percentage}%</td>
        <td class="text-right tabular-nums"><strong>${formatCurrency(row.total)}</strong></td>
      </tr>
    `
    )
    .join('');
}

/**
 * Main render entry point for Expense Analytics view.
 */
export function renderAnalyticsView(transactions, range, activeMonthKey) {
  const scoped = filterTransactionsByRange(transactions, range, activeMonthKey);
  const metrics = computeAnalyticsMetrics(scoped);
  const comparisonSeries = computeMonthlyComparisonSeries(transactions, activeMonthKey);

  const topCatName = document.getElementById('analytics-top-cat-name');
  const topCatAmount = document.getElementById('analytics-top-cat-amount');
  const topCatShare = document.getElementById('analytics-top-cat-share');
  const totalSavingsEl = document.getElementById('analytics-total-savings');
  const savingsRateEl = document.getElementById('analytics-savings-rate');
  const periodIncomeEl = document.getElementById('analytics-period-income');
  const periodExpensesEl = document.getElementById('analytics-period-expenses');
  const incomeCountEl = document.getElementById('analytics-income-count');
  const expenseCountEl = document.getElementById('analytics-expense-count');

  if (metrics.highestCategory) {
    if (topCatName) topCatName.textContent = metrics.highestCategory.category;
    if (topCatAmount) topCatAmount.textContent = formatCurrency(metrics.highestCategory.total);
    if (topCatShare) topCatShare.textContent = `${metrics.highestCategory.percentage}% of expenses`;
  } else {
    if (topCatName) topCatName.textContent = 'No expenses';
    if (topCatAmount) topCatAmount.textContent = formatCurrency(0);
    if (topCatShare) topCatShare.textContent = '0% of expenses';
  }

  if (totalSavingsEl) {
    totalSavingsEl.textContent = formatCurrency(metrics.totalSavings);
    totalSavingsEl.classList.toggle('kpi-value-income', metrics.totalSavings > 0);
    totalSavingsEl.classList.toggle('kpi-value-expense', metrics.totalSavings < 0);
  }
  if (savingsRateEl) {
    savingsRateEl.textContent = `${metrics.savingsRate}% savings rate`;
  }
  if (periodIncomeEl) periodIncomeEl.textContent = formatCurrency(metrics.totalIncome);
  if (periodExpensesEl) periodExpensesEl.textContent = formatCurrency(metrics.totalExpenses);
  if (incomeCountEl) {
    incomeCountEl.textContent = `${metrics.incomeCount} ${metrics.incomeCount === 1 ? 'entry' : 'entries'}`;
  }
  if (expenseCountEl) {
    expenseCountEl.textContent = `${metrics.expenseCount} ${metrics.expenseCount === 1 ? 'entry' : 'entries'}`;
  }

  renderIncomeVsExpenseChart(comparisonSeries);
  renderSpendingDistributionChart(metrics.categoryBreakdown);
  renderCategoryBreakdownBarChart(metrics.categoryBreakdown);
  renderCategoryTable(metrics.categoryBreakdown);
}
