/**
 * Centralized Data Persistence Layer (LocalStorage Repository)
 *
 * Designed as an isolated repository module so that LocalStorage calls
 * can later be replaced with REST API fetch() calls to Node.js/Express + SQL
 * without modifying UI or calculation modules.
 */

const STORAGE_KEYS = {
  TRANSACTIONS: 'ledgerflow_transactions_v1',
  BUDGET: 'ledgerflow_budget_v1',
  INITIALIZED: 'ledgerflow_initialized_v1',
};

export const CATEGORIES = {
  expense: [
    'Food',
    'Housing',
    'Transportation',
    'Utilities',
    'Healthcare',
    'Entertainment',
    'Shopping',
    'Education',
    'Other',
  ],
  income: [
    'Salary',
    'Freelance',
    'Investments',
    'Bonus',
    'Refund',
    'Other Income',
  ],
};

/**
 * Generates a unique identifier for client-side records.
 * @returns {string}
 */
export function generateId() {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
    return crypto.randomUUID();
  }
  return `tx_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 8)}`;
}

/**
 * Builds a YYYY-MM-DD date string relative to today by month offset and day of month.
 * Ensures initial sample records always match the user's current calendar context.
 */
function buildRelativeDate(monthsAgo, dayOfMonth) {
  const now = new Date();
  const target = new Date(now.getFullYear(), now.getMonth() - monthsAgo, 1);
  const maxDay = new Date(target.getFullYear(), target.getMonth() + 1, 0).getDate();
  const safeDay = Math.min(dayOfMonth, maxDay, monthsAgo === 0 ? now.getDate() : maxDay);
  const year = target.getFullYear();
  const month = String(target.getMonth() + 1).padStart(2, '0');
  const day = String(safeDay).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

/**
 * Returns realistic initial dataset for first-time initialization.
 */
function createInitialDemoTransactions() {
  return [
    {
      id: generateId(),
      title: 'Monthly Salary',
      amount: 5400,
      category: 'Salary',
      type: 'income',
      date: buildRelativeDate(0, 1),
      description: 'Primary payroll direct deposit',
    },
    {
      id: generateId(),
      title: 'Apartment Rent',
      amount: 1450,
      category: 'Housing',
      type: 'expense',
      date: buildRelativeDate(0, 2),
      description: 'Monthly lease payment',
    },
    {
      id: generateId(),
      title: 'Grocery Shopping',
      amount: 245.8,
      category: 'Food',
      type: 'expense',
      date: buildRelativeDate(0, 5),
      description: 'Weekly groceries and household staples',
    },
    {
      id: generateId(),
      title: 'Electric & Fiber Internet',
      amount: 164.5,
      category: 'Utilities',
      type: 'expense',
      date: buildRelativeDate(0, 7),
      description: 'Monthly electricity and gigabit internet bill',
    },
    {
      id: generateId(),
      title: 'UI Consulting Retainer',
      amount: 950,
      category: 'Freelance',
      type: 'income',
      date: buildRelativeDate(0, 9),
      description: 'Design system audit milestone',
    },
    {
      id: generateId(),
      title: 'Transit Pass & Fuel',
      amount: 118.4,
      category: 'Transportation',
      type: 'expense',
      date: buildRelativeDate(0, 11),
      description: 'Metro pass reload and fuel',
    },
    {
      id: generateId(),
      title: 'Dental Checkup',
      amount: 185,
      category: 'Healthcare',
      type: 'expense',
      date: buildRelativeDate(0, 12),
      description: 'Routine cleaning and co-pay',
    },
    {
      id: generateId(),
      title: 'Specialty Coffee & Lunch',
      amount: 62.25,
      category: 'Food',
      type: 'expense',
      date: buildRelativeDate(0, 13),
      description: 'Team lunch and coffee beans',
    },
    // Prior Month (1 month ago)
    {
      id: generateId(),
      title: 'Monthly Salary',
      amount: 5400,
      category: 'Salary',
      type: 'income',
      date: buildRelativeDate(1, 1),
      description: 'Primary payroll direct deposit',
    },
    {
      id: generateId(),
      title: 'Apartment Rent',
      amount: 1450,
      category: 'Housing',
      type: 'expense',
      date: buildRelativeDate(1, 2),
      description: 'Monthly lease payment',
    },
    {
      id: generateId(),
      title: 'Groceries & Market',
      amount: 492.4,
      category: 'Food',
      type: 'expense',
      date: buildRelativeDate(1, 14),
      description: 'Monthly produce and pantry restock',
    },
    {
      id: generateId(),
      title: 'Desk Ergonomics Upgrade',
      amount: 340,
      category: 'Shopping',
      type: 'expense',
      date: buildRelativeDate(1, 19),
      description: 'Monitor arm and mechanical keyboard',
    },
    {
      id: generateId(),
      title: 'Utilities Bundle',
      amount: 158.9,
      category: 'Utilities',
      type: 'expense',
      date: buildRelativeDate(1, 22),
      description: 'Water, power, and internet',
    },
    // 2 Months Ago
    {
      id: generateId(),
      title: 'Monthly Salary',
      amount: 5400,
      category: 'Salary',
      type: 'income',
      date: buildRelativeDate(2, 1),
      description: 'Primary payroll direct deposit',
    },
    {
      id: generateId(),
      title: 'Quarterly Dividend',
      amount: 310,
      category: 'Investments',
      type: 'income',
      date: buildRelativeDate(2, 15),
      description: 'Index fund quarterly payout',
    },
    {
      id: generateId(),
      title: 'Apartment Rent',
      amount: 1450,
      category: 'Housing',
      type: 'expense',
      date: buildRelativeDate(2, 2),
      description: 'Monthly lease payment',
    },
    {
      id: generateId(),
      title: 'Groceries & Dining',
      amount: 468.15,
      category: 'Food',
      type: 'expense',
      date: buildRelativeDate(2, 12),
      description: 'Groceries and weekend dinner',
    },
    {
      id: generateId(),
      title: 'Online Course Subscription',
      amount: 129,
      category: 'Education',
      type: 'expense',
      date: buildRelativeDate(2, 20),
      description: 'Annual technical workshop pass',
    },
    // 3 Months Ago
    {
      id: generateId(),
      title: 'Monthly Salary',
      amount: 5200,
      category: 'Salary',
      type: 'income',
      date: buildRelativeDate(3, 1),
      description: 'Primary payroll direct deposit',
    },
    {
      id: generateId(),
      title: 'Apartment Rent',
      amount: 1450,
      category: 'Housing',
      type: 'expense',
      date: buildRelativeDate(3, 2),
      description: 'Monthly lease payment',
    },
    {
      id: generateId(),
      title: 'Food & Dining',
      amount: 430.6,
      category: 'Food',
      type: 'expense',
      date: buildRelativeDate(3, 16),
      description: 'Household groceries',
    },
    {
      id: generateId(),
      title: 'Concert & Streaming',
      amount: 148,
      category: 'Entertainment',
      type: 'expense',
      date: buildRelativeDate(3, 21),
      description: 'Live show tickets and subscriptions',
    },
    // 4 Months Ago
    {
      id: generateId(),
      title: 'Monthly Salary',
      amount: 5200,
      category: 'Salary',
      type: 'income',
      date: buildRelativeDate(4, 1),
      description: 'Primary payroll direct deposit',
    },
    {
      id: generateId(),
      title: 'Apartment Rent',
      amount: 1450,
      category: 'Housing',
      type: 'expense',
      date: buildRelativeDate(4, 2),
      description: 'Monthly lease payment',
    },
    {
      id: generateId(),
      title: 'Groceries & Essentials',
      amount: 412.5,
      category: 'Food',
      type: 'expense',
      date: buildRelativeDate(4, 11),
      description: 'Supermarket run',
    },
    {
      id: generateId(),
      title: 'Vehicle Maintenance',
      amount: 275,
      category: 'Transportation',
      type: 'expense',
      date: buildRelativeDate(4, 18),
      description: 'Tire rotation and inspection',
    },
    // 5 Months Ago
    {
      id: generateId(),
      title: 'Monthly Salary',
      amount: 5200,
      category: 'Salary',
      type: 'income',
      date: buildRelativeDate(5, 1),
      description: 'Primary payroll direct deposit',
    },
    {
      id: generateId(),
      title: 'Apartment Rent',
      amount: 1450,
      category: 'Housing',
      type: 'expense',
      date: buildRelativeDate(5, 2),
      description: 'Monthly lease payment',
    },
    {
      id: generateId(),
      title: 'Groceries & Household',
      amount: 395,
      category: 'Food',
      type: 'expense',
      date: buildRelativeDate(5, 15),
      description: 'Weekly groceries',
    },
    {
      id: generateId(),
      title: 'Utilities & Phone',
      amount: 152,
      category: 'Utilities',
      type: 'expense',
      date: buildRelativeDate(5, 24),
      description: 'Power and mobile plan',
    },
  ];
}

function normalizeTransaction(raw) {
  return {
    id: String(raw.id || generateId()),
    title: String(raw.title || '').trim(),
    amount: Number(Number(raw.amount || 0).toFixed(2)),
    category: String(raw.category || 'Other'),
    type: raw.type === 'income' ? 'income' : 'expense',
    date: String(raw.date || ''),
    description: String(raw.description || '').trim(),
  };
}

/**
 * Ensures storage is initialized once on first visit.
 */
function ensureInitialized() {
  try {
    const initialized = localStorage.getItem(STORAGE_KEYS.INITIALIZED);
    if (!initialized) {
      const demo = createInitialDemoTransactions();
      localStorage.setItem(STORAGE_KEYS.TRANSACTIONS, JSON.stringify(demo));
      localStorage.setItem(
        STORAGE_KEYS.BUDGET,
        JSON.stringify({
          monthlyLimit: 2700,
          updatedAt: new Date().toISOString(),
        })
      );
      localStorage.setItem(STORAGE_KEYS.INITIALIZED, 'true');
    }
  } catch (error) {
    console.error('Failed to initialize LocalStorage:', error);
  }
}

/**
 * Retrieves all stored transactions.
 * @returns {Array<Object>}
 */
export function getTransactions() {
  ensureInitialized();
  try {
    const raw = localStorage.getItem(STORAGE_KEYS.TRANSACTIONS);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed.map(normalizeTransaction) : [];
  } catch (error) {
    console.error('Error reading transactions from LocalStorage:', error);
    return [];
  }
}

/**
 * Persists the complete transactions array.
 * @param {Array<Object>} transactions
 * @returns {Array<Object>}
 */
export function saveTransactions(transactions) {
  const normalized = (Array.isArray(transactions) ? transactions : []).map(normalizeTransaction);
  try {
    localStorage.setItem(STORAGE_KEYS.TRANSACTIONS, JSON.stringify(normalized));
    localStorage.setItem(STORAGE_KEYS.INITIALIZED, 'true');
  } catch (error) {
    console.error('Error saving transactions to LocalStorage:', error);
  }
  return normalized;
}

/**
 * Creates and persists a new transaction record.
 * @param {Object} txInput
 * @returns {Object}
 */
export function addTransaction(txInput) {
  const transactions = getTransactions();
  const newTx = normalizeTransaction({
    ...txInput,
    id: generateId(),
  });
  transactions.unshift(newTx);
  saveTransactions(transactions);
  return newTx;
}

/**
 * Updates an existing transaction by id.
 * @param {string} id
 * @param {Object} updates
 * @returns {Object|null}
 */
export function updateTransaction(id, updates) {
  const transactions = getTransactions();
  const index = transactions.findIndex((tx) => tx.id === id);
  if (index === -1) return null;

  const updatedTx = normalizeTransaction({
    ...transactions[index],
    ...updates,
    id,
  });

  transactions[index] = updatedTx;
  saveTransactions(transactions);
  return updatedTx;
}

/**
 * Deletes a transaction by id.
 * @param {string} id
 * @returns {boolean}
 */
export function deleteTransaction(id) {
  const transactions = getTransactions();
  const filtered = transactions.filter((tx) => tx.id !== id);
  if (filtered.length === transactions.length) {
    return false;
  }
  saveTransactions(filtered);
  return true;
}

/**
 * Retrieves budget settings from LocalStorage.
 * @returns {{ monthlyLimit: number, updatedAt: string }}
 */
export function getBudget() {
  ensureInitialized();
  try {
    const raw = localStorage.getItem(STORAGE_KEYS.BUDGET);
    if (!raw) {
      return { monthlyLimit: 2700, updatedAt: new Date().toISOString() };
    }
    const parsed = JSON.parse(raw);
    const limit = Number(parsed?.monthlyLimit);
    return {
      monthlyLimit: Number.isFinite(limit) && limit >= 0 ? Number(limit.toFixed(2)) : 0,
      updatedAt: parsed?.updatedAt || new Date().toISOString(),
    };
  } catch (error) {
    console.error('Error reading budget from LocalStorage:', error);
    return { monthlyLimit: 0, updatedAt: new Date().toISOString() };
  }
}

/**
 * Saves monthly budget configuration to LocalStorage.
 * @param {{ monthlyLimit: number }} budgetData
 * @returns {{ monthlyLimit: number, updatedAt: string }}
 */
export function saveBudget(budgetData) {
  const limit = Number(budgetData?.monthlyLimit);
  const payload = {
    monthlyLimit: Number.isFinite(limit) && limit >= 0 ? Number(limit.toFixed(2)) : 0,
    updatedAt: new Date().toISOString(),
  };
  try {
    localStorage.setItem(STORAGE_KEYS.BUDGET, JSON.stringify(payload));
  } catch (error) {
    console.error('Error saving budget to LocalStorage:', error);
  }
  return payload;
}

/**
 * Resets LocalStorage to clean demo dataset.
 */
export function resetToDemoData() {
  const demo = createInitialDemoTransactions();
  saveTransactions(demo);
  saveBudget({ monthlyLimit: 2700 });
  return demo;
}

/**
 * Returns all known categories grouped by type.
 */
export function getCategories() {
  return CATEGORIES;
}
