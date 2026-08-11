import React, { useState, useEffect, useMemo } from 'react';
import { Plus, BarChart3 } from 'lucide-react';
import { apiRequest } from '../api.js';
import LoadingSpinner from './LoadingSpinner.jsx';
import Toast from './Toast.jsx';
import Button from './Button.jsx';
import EmptyState from './EmptyState.jsx';

const formatCurrency = (v) => v ? `৳${Number(v).toLocaleString('en-IN')}` : '৳0';
const formatDate = (d) => { if (!d) return '—'; const dt = new Date(d); return isNaN(dt) ? '—' : dt.toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' }); };
const toLocalDateStr = (d) => { const y = d.getFullYear(); const m = String(d.getMonth() + 1).padStart(2, '0'); const day = String(d.getDate()).padStart(2, '0'); return `${y}-${m}-${day}`; };
const toDateKey = (d) => d ? toLocalDateStr(new Date(d)) : '';

export default function AccountingDashboard({ token, onNavigate }) {
  const [incomeToday, setIncomeToday] = useState(0);
  const [incomeMonth, setIncomeMonth] = useState(0);
  const [expenseMonth, setExpenseMonth] = useState(0);
  const [cashBalance, setCashBalance] = useState(0);
  const [incomeByCategory, setIncomeByCategory] = useState({});
  const [expenseByCategory, setExpenseByCategory] = useState([]);
  const [recentExpenses, setRecentExpenses] = useState([]);
  const [loading, setLoading] = useState(true);
  const [toast, setToast] = useState(null);

  useEffect(() => {
    const fetchData = async () => {
      try {
        setLoading(true);
        const today = toLocalDateStr(new Date());
        const now = new Date();
        const monthStart = toLocalDateStr(new Date(now.getFullYear(), now.getMonth(), 1));
        const monthEnd = toLocalDateStr(new Date(now.getFullYear(), now.getMonth() + 1, 0));

        // Fetch today's income (includes dailyBalance with opening, income, expense, closing)
        const todayRes = await apiRequest(`/reports/income?range=today&startDate=${today}&endDate=${today}`, { token }).catch(() => ({}));
        const todayIncome = todayRes?.totalIncome || 0;
        setIncomeToday(todayIncome);

        // Use dailyBalance from server (includes expense subtraction)
        const dailyBal = todayRes?.dailyBalance;
        if (dailyBal) {
          setCashBalance(dailyBal.closingBalance || 0);
        } else {
          setCashBalance(todayIncome);
        }

        // Fetch month's income breakdown
        const monthIncomeRes = await apiRequest(`/reports/income?range=custom&startDate=${monthStart}&endDate=${monthEnd}`, { token }).catch(() => ({}));
        const monthIncome = monthIncomeRes?.totalIncome || 0;
        setIncomeMonth(monthIncome);

        const cats = {};
        if (monthIncomeRes?.entryIncome) cats['Daily Entry'] = monthIncomeRes.entryIncome;
        if (monthIncomeRes?.trainingIncome) cats['Training'] = monthIncomeRes.trainingIncome;
        if (monthIncomeRes?.membershipIncome) cats['Membership'] = monthIncomeRes.membershipIncome;
        if (monthIncomeRes?.beveragesIncome) cats['Beverage'] = monthIncomeRes.beveragesIncome;
        if (monthIncomeRes?.hourlySessionIncome) cats['Hourly Session'] = monthIncomeRes.hourlySessionIncome;
        setIncomeByCategory(cats);

        // Fetch month's expenses
        const monthExpRes = await apiRequest(`/daily-expenses/summary?startDate=${monthStart}&endDate=${monthEnd}`, { token }).catch(() => ({}));
        const monthExpenses = monthExpRes?.totalAmount || 0;
        setExpenseMonth(monthExpenses);
        setExpenseByCategory(monthExpRes?.categories || []);

        // Fetch recent expenses (last 5)
        const recentRes = await apiRequest(`/daily-expenses?startDate=${monthStart}&endDate=${monthEnd}`, { token }).catch(() => ({}));
        setRecentExpenses((recentRes?.expenses || []).slice(-5).reverse());

      } catch (error) {
        console.error('Error loading dashboard:', error);
      } finally {
        setLoading(false);
      }
    };
    if (token) fetchData();
  }, [token]);

  const netProfit = incomeMonth - expenseMonth;

  // Group recent expenses by date
  const groupedRecent = useMemo(() => {
    const g = {};
    recentExpenses.forEach(e => { const k = toDateKey(e.date); if (!g[k]) g[k] = { date: e.date, items: [], total: 0 }; g[k].items.push(e); g[k].total += e.totalAmount || 0; });
    return Object.values(g).sort((a, b) => new Date(b.date) - new Date(a.date));
  }, [recentExpenses]);

  const summaryCards = [
    { label: "Today's Income", value: formatCurrency(incomeToday), color: 'text-primary' },
    { label: "This Month's Expenses", value: formatCurrency(expenseMonth), color: 'text-danger' },
    { label: 'Net Profit', value: formatCurrency(netProfit), color: netProfit >= 0 ? 'text-success' : 'text-danger' },
    { label: 'Cash in Hand', value: formatCurrency(cashBalance), color: 'text-ink' },
  ];

  if (loading) return <LoadingSpinner />;

  return (
    <div className="space-y-4">
      {toast && <Toast message={toast.message} type={toast.type} onClose={() => setToast(null)} />}

      {/* Summary Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        {summaryCards.map((card) => (
          <div key={card.label} className="stat-card">
            <span className="stat-label">{card.label}</span>
            <span className={`stat-value ${card.color}`}>{card.value}</span>
          </div>
        ))}
      </div>

      {/* Quick Actions */}
      <div className="flex gap-2">
        <Button size="sm" icon={Plus} onClick={() => onNavigate?.('expenses')}>Record expense</Button>
        <Button size="sm" variant="secondary" icon={BarChart3} onClick={() => onNavigate?.('reports')}>View reports</Button>
      </div>

      {/* Income & Expense Breakdowns */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {/* Income Breakdown */}
        <div className="card overflow-hidden">
          <div className="px-4 py-3 border-b border-line flex items-center justify-between">
            <h3 className="text-sm font-semibold text-ink">Income breakdown</h3>
            <span className="text-xs font-bold text-success">{formatCurrency(incomeMonth)}</span>
          </div>
          <div className="divide-y divide-line">
            {Object.entries(incomeByCategory).filter(([, v]) => v > 0).length === 0 ? (
              <div className="p-6 text-center text-ink-soft text-xs">No income this month</div>
            ) : (
              Object.entries(incomeByCategory).filter(([, v]) => v > 0).map(([cat, amt]) => (
                <div key={cat} className="px-4 py-2 flex items-center justify-between">
                  <span className="text-sm text-ink">{cat}</span>
                  <span className="text-sm font-medium text-ink tabular">{formatCurrency(amt)}</span>
                </div>
              ))
            )}
          </div>
        </div>

        {/* Expense Breakdown */}
        <div className="card overflow-hidden">
          <div className="px-4 py-3 border-b border-line flex items-center justify-between">
            <h3 className="text-sm font-semibold text-ink">Expense breakdown</h3>
            <span className="text-xs font-bold text-danger">{formatCurrency(expenseMonth)}</span>
          </div>
          <div className="divide-y divide-line">
            {expenseByCategory.length === 0 ? (
              <div className="p-6 text-center text-ink-soft text-xs">No expenses this month</div>
            ) : (
              expenseByCategory.map((c) => (
                <div key={c.name} className="px-4 py-2 flex items-center justify-between">
                  <span className="text-sm text-ink">{c.name}</span>
                  <span className="text-sm font-medium text-ink tabular">{formatCurrency(c.total)}</span>
                </div>
              ))
            )}
          </div>
        </div>
      </div>

      {/* Recent Expenses */}
      <div className="card overflow-hidden">
        <div className="px-4 py-3 border-b border-line">
          <h3 className="text-sm font-semibold text-ink">Recent expenses</h3>
        </div>
        {groupedRecent.length === 0 ? (
          <EmptyState
            title="No expenses yet"
            message="Expenses you record will show up here."
            actionLabel="Record your first expense"
            onAction={() => onNavigate?.('expenses')}
          />
        ) : (
          <div>
            {groupedRecent.map((group) => (
              <div key={toDateKey(group.date)}>
                <div className="px-4 py-1.5 bg-canvas border-b border-line flex items-center justify-between">
                  <span className="text-xs font-semibold text-ink-soft">{formatDate(group.date)}</span>
                  <span className="text-xs font-bold text-ink">{formatCurrency(group.total)}</span>
                </div>
                <div className="divide-y divide-line">
                  {group.items.map((exp) => (
                    <div key={exp._id} className="flex items-center gap-3 px-4 py-2 hover:bg-canvas">
                      <div className="w-7 h-7 rounded-full bg-primary/10 flex items-center justify-center flex-shrink-0">
                        <span className="text-[10px] font-bold text-primary">{(exp.categories?.[0]?.name || '?')[0]}</span>
                      </div>
                      <div className="flex-1 min-w-0">
                        <span className="text-sm font-medium text-ink truncate">
                          {exp.categories?.[0]?.subcategory || exp.categories?.[0]?.name || '—'}
                        </span>
                      </div>
                      <span className="text-xs text-ink-soft mr-2">{exp.paymentMethod || 'Cash'}</span>
                      <span className="text-sm font-bold text-danger">{formatCurrency(exp.totalAmount)}</span>
                    </div>
                  ))}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
