// Renderer process script for Pwallet

// Data storage (in-memory for MVP)
let accounts = [];
let entries = [];
let investments = [];

// DOM elements
const sections = document.querySelectorAll('.section');
const sidebarLinks = document.querySelectorAll('.sidebar a');

const totalBalanceEl = document.getElementById('total-balance');
const accountsListEl = document.getElementById('accounts-list');
const entriesListEl = document.getElementById('entries-list');
const investmentsListEl = document.getElementById('investments-list');

const entryAccountSelect = document.getElementById('entry-account');
const filterCategorySelect = document.getElementById('filter-category');
const filterMonthInput = document.getElementById('filter-month');

// Chart.js charts
let expensesPieChart;
let balanceLineChart;

// Navigation
sidebarLinks.forEach(link => {
  link.addEventListener('click', (e) => {
    e.preventDefault();
    const targetSection = link.getAttribute('data-section');
    if (!targetSection) return;

    // Update active link
    sidebarLinks.forEach(l => l.classList.remove('active'));
    link.classList.add('active');

    // Show target section, hide others
    sections.forEach(section => {
      if (section.id === targetSection) {
        section.classList.remove('hidden');
        section.classList.add('active');
        section.focus();
      } else {
        section.classList.add('hidden');
        section.classList.remove('active');
      }
    });
  });
});

// Utility: format currency in Brazilian Real
function formatCurrencyBRL(value) {
  return value.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
}

// Update total balance
function updateTotalBalance() {
  let total = 0;
  accounts.forEach(acc => total += acc.balance);
  totalBalanceEl.textContent = formatCurrencyBRL(total);
}

// Render accounts list
function renderAccounts() {
  accountsListEl.innerHTML = '';
  entryAccountSelect.innerHTML = '<option value="">Selecione</option>';
  accounts.forEach((acc, index) => {
    const li = document.createElement('li');
    li.textContent = `${acc.name} - ${formatCurrencyBRL(acc.balance)}`;
    accountsListEl.appendChild(li);

    // Add to entry account select
    const option = document.createElement('option');
    option.value = index;
    option.textContent = acc.name;
    entryAccountSelect.appendChild(option);
  });
}

// Render entries list with filters
function renderEntries() {
  const filterCategory = filterCategorySelect.value;
  const filterMonth = filterMonthInput.value;

  entriesListEl.innerHTML = '';

  const filteredEntries = entries.filter(entry => {
    let categoryMatch = filterCategory ? entry.category === filterCategory : true;
    let monthMatch = true;
    if (filterMonth) {
      const entryMonth = entry.date.slice(0, 7); // YYYY-MM
      monthMatch = entryMonth === filterMonth;
    }
    return categoryMatch && monthMatch;
  });

  filteredEntries.forEach(entry => {
    const li = document.createElement('li');
    li.textContent = `${formatCurrencyBRL(entry.amount)} - ${entry.category} - ${entry.date} - ${entry.description} - ${accounts[entry.account]?.name || ''}`;
    entriesListEl.appendChild(li);
  });
}

// Render investments list
function renderInvestments() {
  investmentsListEl.innerHTML = '';
  investments.forEach(investment => {
    const li = document.createElement('li');
    li.textContent = `${investment.asset} - ${formatCurrencyBRL(investment.value)} - ${investment.date} - ${investment.type} - ${investment.yield}%`;
    investmentsListEl.appendChild(li);
  });
}

// Update charts
function updateCharts() {
  // Expenses by category pie chart
  const expenseCategories = {};
  entries.forEach(entry => {
    if (entry.amount < 0) {
      expenseCategories[entry.category] = (expenseCategories[entry.category] || 0) + Math.abs(entry.amount);
    }
  });

  const pieLabels = Object.keys(expenseCategories);
  const pieData = Object.values(expenseCategories);

  if (expensesPieChart) {
    expensesPieChart.data.labels = pieLabels;
    expensesPieChart.data.datasets[0].data = pieData;
    expensesPieChart.update();
  } else {
    const ctxPie = document.getElementById('expensesPieChart').getContext('2d');
    expensesPieChart = new Chart(ctxPie, {
      type: 'pie',
      data: {
        labels: pieLabels,
        datasets: [{
          data: pieData,
          backgroundColor: [
            '#2563eb',
            '#f97316',
            '#10b981',
            '#ef4444',
            '#8b5cf6',
            '#eab308'
          ],
        }]
      },
      options: {
        responsive: true,
        plugins: {
          legend: {
            position: 'bottom',
            labels: {
              color: '#e0e0e0'
            }
          }
        }
      }
    });
  }

  // Balance evolution line chart
  // For simplicity, sum balances by month from entries and accounts
  const balanceByMonth = {};

  entries.forEach(entry => {
    const month = entry.date.slice(0, 7);
    balanceByMonth[month] = (balanceByMonth[month] || 0) + entry.amount;
  });

  // Add initial account balances to first month if no entries
  if (accounts.length > 0 && Object.keys(balanceByMonth).length === 0) {
    const now = new Date();
    const month = now.toISOString().slice(0, 7);
    let totalBalance = 0;
    accounts.forEach(acc => totalBalance += acc.balance);
    balanceByMonth[month] = totalBalance;
  }

  // Sort months
  const sortedMonths = Object.keys(balanceByMonth).sort();

  // Calculate cumulative balance
  let cumulative = 0;
  const balanceData = sortedMonths.map(month => {
    cumulative += balanceByMonth[month];
    return cumulative;
  });

  if (balanceLineChart) {
    balanceLineChart.data.labels = sortedMonths;
    balanceLineChart.data.datasets[0].data = balanceData;
    balanceLineChart.update();
  } else {
    const ctxLine = document.getElementById('balanceLineChart').getContext('2d');
    balanceLineChart = new Chart(ctxLine, {
      type: 'line',
      data: {
        labels: sortedMonths,
        datasets: [{
          label: 'Saldo',
          data: balanceData,
          borderColor: '#2563eb',
          backgroundColor: 'rgba(37, 99, 235, 0.3)',
          fill: true,
          tension: 0.3,
          pointRadius: 4,
          pointHoverRadius: 6,
        }]
      },
      options: {
        responsive: true,
        scales: {
          x: {
            ticks: { color: '#e0e0e0' }
          },
          y: {
            ticks: { color: '#e0e0e0' }
          }
        },
        plugins: {
          legend: {
            labels: {
              color: '#e0e0e0'
            }
          }
        }
      }
    });
  }
}

// Event listeners for forms
document.getElementById('account-form').addEventListener('submit', (e) => {
  e.preventDefault();
  const name = e.target.accountName.value.trim();
  const balance = parseFloat(e.target.accountBalance.value);
  if (name && !isNaN(balance)) {
    accounts.push({ name, balance });
    e.target.reset();
    renderAccounts();
    updateTotalBalance();
    updateCharts();
  }
});

document.getElementById('entry-form').addEventListener('submit', (e) => {
  e.preventDefault();
  const amount = parseFloat(e.target.entryAmount.value);
  const category = e.target.entryCategory.value;
  const date = e.target.entryDate.value;
  const description = e.target.entryDescription.value.trim();
  const accountIndex = parseInt(e.target.entryAccount.value);

  if (!isNaN(amount) && category && date && !isNaN(accountIndex) && accounts[accountIndex]) {
    entries.push({ amount, category, date, description, account: accountIndex });
    // Update account balance
    accounts[accountIndex].balance += amount;
    e.target.reset();
    renderEntries();
    renderAccounts();
    updateTotalBalance();
    updateCharts();
  }
});

document.getElementById('filter-category').addEventListener('change', () => {
  renderEntries();
});

document.getElementById('filter-month').addEventListener('input', () => {
  renderEntries();
});

document.getElementById('investment-form').addEventListener('submit', (e) => {
  e.preventDefault();
  const asset = e.target.investmentAsset.value.trim();
  const value = parseFloat(e.target.investmentValue.value);
  const date = e.target.investmentDate.value;
  const type = e.target.investmentType.value.trim();
  const yieldPercent = parseFloat(e.target.investmentYield.value);

  if (asset && !isNaN(value) && date && type && !isNaN(yieldPercent)) {
    investments.push({ asset, value, date, type, yield: yieldPercent });
    e.target.reset();
    renderInvestments();
  }
});

// Initial render
renderAccounts();
renderEntries();
renderInvestments();
updateTotalBalance();
updateCharts();
