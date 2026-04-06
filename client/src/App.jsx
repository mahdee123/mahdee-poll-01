import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from './context/AuthContext';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, PieChart, Pie, Cell, BarChart, Bar, Legend } from 'recharts';
import './index.css';
import { apiRequest } from './api.js';
import MembershipPage from './components/MembershipPage.jsx';
import TrainingPage from './components/TrainingPage.jsx';
import BillsPage from './components/BillsPage.jsx';
import Receipt from './components/Receipt.jsx';
import ExpensePage from './components/ExpensePage.jsx';
import BeverageSalesPage from './components/BeverageSalesPage.jsx';
import ReconciliationReport from './components/ReconciliationReport.jsx';
import CashMovementPage from './components/CashMovementPage.jsx';
import InitialOpeningBalanceModal from './components/InitialOpeningBalanceModal.jsx';
import DailyTransactionBreakdown from './components/DailyTransactionBreakdown.jsx';
import { downloadDailyReportPdf, downloadDailyReportSheet } from './utils/reportExports.js';

const SERVICE_TYPES = ['Daily Entry', 'Training', 'Membership'];
const PAYMENT_METHODS = ['Cash', 'Bank', 'bKash'];
const DAILY_REPORT_CATEGORIES = ['Bill', 'Training', 'Membership', 'Beverage', 'Hourly Session'];

const PLAN_PRESETS = {
  Monthly: 30,
  '3 Months': 90,
  '6 Months': 180,
  Yearly: 365,
};

const formatDate = (value) => new Date(value).toISOString().split('T')[0];

const Sidebar = ({ view, setView, user }) => {
  const navigate = useNavigate();
  const { clearAuth } = useAuth();
  
  const items = user?.role === 'admin'
    ? [
        { key: 'dashboard', label: 'Dashboard' },
        { key: 'billing', label: 'Bills / Receipts' },
        { key: 'beverages', label: '🧃 Beverage Sales' },
        { key: 'training', label: 'Training' },
        { key: 'members', label: 'Memberships' },
        { key: 'packages', label: 'Packages' },
        { key: 'expenses', label: 'Expenses' },
        { key: 'cash-movements', label: '💰 Cash Movements' },
        { key: 'reconciliation', label: '📊 Reconciliation' },
        { key: 'reports', label: 'Reports' },
      ]
    : [
        { key: 'billing', label: 'Bills / Receipts' },
        { key: 'training', label: 'Training' },
        { key: 'reports', label: 'Reports' },
      ];

  const handleLogout = () => {
    clearAuth();
    navigate('/login');
  };

  return (
    <aside className="w-full sm:w-72 bg-secondary text-white p-4 flex-shrink-0 flex flex-col">
      <div className="text-xl font-bold mb-6">Raya Pool</div>
      <nav className="space-y-2 flex-1">
        {items.map((item) => (
          <button
            key={item.key}
            onClick={() => setView(item.key)}
            className={`w-full text-left px-3 py-2 rounded-lg transition ${
              view === item.key ? 'bg-white text-secondary font-semibold' : 'hover:bg-white/10'
            }`}
          >
            {item.label}
          </button>
        ))}
      </nav>
      
      {/* Settings and Logout */}
      <div className="space-y-2 border-t border-white/20 pt-4 mt-4">
        {user?.role === 'admin' && (
          <button
            onClick={() => navigate('/settings/company')}
            className="w-full text-left px-3 py-2 rounded-lg hover:bg-white/10 transition text-sm"
          >
            ⚙️ Company Settings
          </button>
        )}
        <button
          onClick={handleLogout}
          className="w-full text-left px-3 py-2 rounded-lg hover:bg-red-500 transition text-sm"
        >
          🚪 Logout
        </button>
      </div>
    </aside>
  );
};

const StatCard = ({ title, value, hint, highlight }) => {
  return (
    <div className="bg-white rounded-lg p-5 border border-gray-200 hover:border-gray-300 transition hover:shadow-sm flex flex-col gap-2">
      <span className="text-sm font-medium text-gray-600">
        {title}
      </span>
      <span className="text-2xl font-bold text-gray-900">
        {value}
      </span>
      {hint ? (
        <span className="text-xs text-gray-500">
          {hint}
        </span>
      ) : null}
    </div>
  );
};



// Custom Tooltip for IncomeChart showing all three values
const IncomeChartTooltip = ({ active, payload, label }) => {
  if (active && payload && payload.length > 0) {
    const data = payload[0].payload;
    return (
      <div className="bg-white p-3 rounded-lg shadow-lg border border-gray-200">
        <p className="text-sm font-semibold text-gray-700 mb-2">{data.date}</p>
        <div className="space-y-1">
          <p className="text-sm text-blue-600">
            <span className="font-medium">Income:</span> ৳ {data.income.toLocaleString()}
          </p>
          {data.expense > 0 && (
            <p className="text-sm text-red-600">
              <span className="font-medium">Expense:</span> ৳ {data.expense.toLocaleString()}
            </p>
          )}
          <p className="text-sm text-green-600">
            <span className="font-medium">Net Cash:</span> ৳ {data.netCash.toLocaleString()}
          </p>
        </div>
      </div>
    );
  }
  return null;
};

const IncomeChart = ({ points }) => {
  if (!points || !points.length) {
    return <div className="flex h-64 items-center justify-center text-gray-500 bg-gray-50 rounded-lg border border-dashed border-gray-200">No transactions found for selected date</div>;
  }
  
  // Check if points have income/expense structure (Phase 4+) or old amount structure
  const hasExpenseData = points[0]?.income !== undefined;
  
  let data;
  if (hasExpenseData) {
    // Phase 4+: Use income, expense, netCash from timeline
    data = points.map((p) => {
      const date = new Date(p.date).toLocaleDateString('en-GB', { day: 'numeric', month: 'short' });
      return {
        date,
        income: p.income || 0,
        expense: p.expense || 0,
        netCash: p.netCash !== undefined ? p.netCash : (p.income || 0) - (p.expense || 0),
      };
    });
  } else {
    // Phase 1-3: Aggregate old format by date
    const aggregated = points.reduce((acc, p) => {
      const d = new Date(p.date).toLocaleDateString('en-GB', { day: 'numeric', month: 'short' });
      acc[d] = (acc[d] || 0) + p.amount;
      return acc;
    }, {});
    data = Object.keys(aggregated).map(k => ({ date: k, income: aggregated[k], expense: 0, netCash: aggregated[k] }));
  }

  // Find peak income and expense days for highlighting
  const peakIncomeValue = Math.max(...data.map(d => d.income));
  const peakExpenseValue = Math.max(...data.map(d => d.expense));
  
  const renderCustomDot = (props) => {
    const { cx, cy, payload, dataKey } = props;
    if (!payload) return null;
    
    let isPeak = false;
    let color = '#008CFF'; // default blue
    
    if (dataKey === 'income' && payload.income === peakIncomeValue && peakIncomeValue > 0) {
      isPeak = true;
      color = '#008CFF';
    } else if (dataKey === 'expense' && payload.expense === peakExpenseValue && peakExpenseValue > 0) {
      isPeak = true;
      color = '#EF4444';
    }
    
    const radius = isPeak ? 6 : 4;
    return (
      <circle
        cx={cx}
        cy={cy}
        r={radius}
        fill={color}
        opacity={isPeak ? 1 : 0.8}
        stroke={isPeak ? 'rgba(255,255,255,0.8)' : 'none'}
        strokeWidth={isPeak ? 2 : 0}
      />
    );
  };

  return (
    <div className="h-64 mt-4 w-full">
      <ResponsiveContainer width="100%" height="100%">
        <LineChart data={data} animationDuration={800} animationEasing="ease-in-out">
          <CartesianGrid strokeDasharray="3 3" opacity={0.4} vertical={false} />
          <XAxis dataKey="date" tick={{fontSize: 12}} axisLine={false} tickLine={false} />
          <YAxis tick={{fontSize: 12}} axisLine={false} tickLine={false} tickFormatter={(v) => `৳${v}`} />
          <Tooltip content={<IncomeChartTooltip />} cursor={{strokeDasharray: '3 3', stroke: '#d1d5db'}} />
          <Legend verticalAlign="top" height={36} wrapperStyle={{paddingBottom: '10px'}} />
          <Line 
            type="monotone" 
            dataKey="income" 
            name="Income" 
            stroke="#008CFF" 
            strokeWidth={3} 
            dot={renderCustomDot}
            activeDot={{r: 8}}
            isAnimationActive={true}
          />
          {data.some(d => d.expense > 0) && (
            <Line 
              type="monotone" 
              dataKey="expense" 
              name="Expense" 
              stroke="#EF4444" 
              strokeWidth={3} 
              dot={renderCustomDot}
              activeDot={{r: 8}}
              isAnimationActive={true}
            />
          )}
          {data.some(d => d.netCash > 0) && (
            <Line 
              type="monotone" 
              dataKey="netCash" 
              name="Net Cash" 
              stroke="#10B981" 
              strokeWidth={3} 
              dot={{r: 4}}
              activeDot={{r: 8}}
              isAnimationActive={true}
            />
          )}
        </LineChart>
      </ResponsiveContainer>
    </div>
  );
};

const ServicePieChart = ({ slices }) => {
  const data = slices.filter(s => s.value > 0);
  if (!data.length) return <div className="flex h-64 items-center justify-center text-gray-500">No data available</div>;
  const COLORS = ['#008CFF', '#10b981', '#1B1B1B']; // Blue, Green, Dark
  
  return (
    <div className="h-64 w-full">
      <ResponsiveContainer width="100%" height="100%">
        <PieChart>
          <Pie data={data} cx="50%" cy="50%" innerRadius={60} outerRadius={80} paddingAngle={4} dataKey="value">
            {data.map((entry, index) => <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />)}
          </Pie>
          <Tooltip formatter={(value) => `৳ ${value.toLocaleString()}`} />
          <Legend verticalAlign="bottom" height={36} />
        </PieChart>
      </ResponsiveContainer>
    </div>
  );
};

const BreakdownBarChart = ({ slices }) => {
  if (!slices || !slices.reduce((a,b)=>a+b.value, 0)) return <div className="flex h-64 items-center justify-center text-gray-500">No data available</div>;;
  const COLORS = ['#008CFF', '#10b981', '#1B1B1B'];
  return (
    <div className="h-64 w-full">
      <ResponsiveContainer width="100%" height="100%">
        <BarChart data={slices} margin={{ top: 20 }}>
          <CartesianGrid strokeDasharray="3 3" opacity={0.4} vertical={false} />
          <XAxis dataKey="name" tick={{fontSize: 12}} axisLine={false} tickLine={false} />
          <YAxis tick={{fontSize: 12}} axisLine={false} tickLine={false} tickFormatter={(v) => `৳${v}`} />
          <Tooltip formatter={(value) => `৳ ${value.toLocaleString()}`} cursor={{fill: '#f3f4f6'}} />
          <Bar dataKey="value" name="Revenue" radius={[4, 4, 0, 0]}>
            {slices.map((entry, index) => <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />)}
          </Bar>
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
};

const Toast = ({ toast, onClose }) => {
  if (!toast) return null;
  return (
    <div className="fixed top-4 right-4 bg-white border border-primary text-secondary shadow-lg rounded-lg px-4 py-3 flex items-center gap-3 z-50">
      <span>{toast.message}</span>
      <button className="text-primary" onClick={onClose} aria-label="Close toast">
        ✕
      </button>
    </div>
  );
};

function App() {
  const [token, setToken] = useState('');
  const [user, setUser] = useState(null);
  const [view, setView] = useState('dashboard');
  const [toast, setToast] = useState(null);

  const [billForm, setBillForm] = useState({
    name: '',
    phone: '',
    serviceType: 'Daily Entry',
    amount: '',
    paymentMethod: 'Cash',
    timeSlot: 'Morning',
  });
  const [lastReceipt, setLastReceipt] = useState(null);
  const [lastReceiptDetails, setLastReceiptDetails] = useState(null);

  // Wrapper to handle both receipt and details
  const handleSetLastReceipt = (receipt, details) => {
    setLastReceipt(receipt);
    if (details) setLastReceiptDetails(details);
  };

  // Removed trainingForm, attendanceForm states (now in TrainingPage)

  const [packageForm, setPackageForm] = useState({ name: '', type: 'Training', price: '', durationDays: 30, totalClasses: 16 });
  const [dateFilter, setDateFilter] = useState({ range: 'today', startDate: '', endDate: '' });
  const [sectionFilters, setSectionFilters] = useState({ 'daily-entry': true, 'training': true, 'membership': true, 'bills': true, 'beverages': true });
  const [dailyTransactionFilters, setDailyTransactionFilters] = useState({ categories: DAILY_REPORT_CATEGORIES, paymentMethod: 'all' });
  const [selectedReportDate, setSelectedReportDate] = useState('');

  // Opening balance modal states
  const [showOpeningBalanceModal, setShowOpeningBalanceModal] = useState(false);
  const [hasOpeningBalance, setHasOpeningBalance] = useState(null);
  const [isInitializingBalance, setIsInitializingBalance] = useState(false);

  // Removed students, trainingSummary, remainingList states (now in TrainingPage)
  const [packages, setPackages] = useState([]);
  const [report, setReport] = useState({ totalIncome: 0, entryIncome: 0, trainingIncome: 0, membershipIncome: 0, billIncome: 0, beveragesIncome: 0, totalExpense: 0, expenseByCategory: {}, netCash: 0, timeline: [], distribution: [], dailyBalance: null, dailyTransactionBreakdown: [] });

  const reportDays = report.dailyTransactionBreakdown || [];
  const selectedDailyReport = reportDays.find((day) => day.date === selectedReportDate) || reportDays[reportDays.length - 1] || null;

  useEffect(() => {
    if (reportDays.length === 0) {
      if (selectedReportDate) setSelectedReportDate('');
      return;
    }

    const isCurrentSelectionValid = reportDays.some((day) => day.date === selectedReportDate);
    if (!selectedReportDate || !isCurrentSelectionValid) {
      setSelectedReportDate(reportDays[reportDays.length - 1].date);
    }
  }, [reportDays, selectedReportDate]);

  const formatReportDateLabel = (value) => {
    if (!value) return 'Select a day';

    return new Intl.DateTimeFormat('en-GB', {
      day: '2-digit',
      month: 'short',
      year: 'numeric',
    }).format(new Date(`${value}T00:00:00`));
  };

  const getSelectedDaySummary = () => {
    const categories = selectedDailyReport?.categories || {};
    const paymentMethods = selectedDailyReport?.paymentMethods || {};
    const billingAmount = categories.Bill?.amount || 0;
    const trainingAmount = categories.Training?.amount || 0;
    const membershipAmount = categories.Membership?.amount || 0;
    const beverageAmount = categories.Beverage?.amount || 0;
    const hourlySessionAmount = categories['Hourly Session']?.amount || 0;

    return {
      date: selectedDailyReport?.date || '',
      billingAmount,
      trainingAmount,
      membershipAmount,
      beverageAmount,
      hourlySessionAmount,
      totalIncome: billingAmount + trainingAmount + membershipAmount + beverageAmount + hourlySessionAmount,
      cashAmount: paymentMethods.Cash || 0,
      bankAmount: paymentMethods.Bank || 0,
      bKashAmount: paymentMethods.bKash || 0,
    };
  };

  const selectedDaySummary = getSelectedDaySummary();
  const selectedDayBreakdownData = selectedDailyReport ? [selectedDailyReport] : [];

  const handleDownloadDailySheet = () => {
    downloadDailyReportSheet({
      reportSummary: report,
      selectedDaySummary,
      selectedDayBreakdown: selectedDailyReport,
      selectedDayLabel: formatReportDateLabel(selectedDaySummary.date),
      rangeLabel: dateFilter.range,
    });
  };

  const handleDownloadDailyPdf = async () => {
    try {
      await downloadDailyReportPdf({
        reportSummary: report,
        selectedDaySummary,
        selectedDayBreakdown: selectedDailyReport,
        selectedDayLabel: formatReportDateLabel(selectedDaySummary.date),
        rangeLabel: dateFilter.range,
      });
    } catch (error) {
      showToast(error?.message || 'Failed to generate PDF report');
    }
  };

  const showToast = (message) => setToast({ message });

  const handleLogin = async (email, password) => {
    const data = await apiRequest('/auth/login', { method: 'POST', body: { email, password } });
    const newFilter = data.user.role === 'manager' ? { ...dateFilter, range: 'today' } : dateFilter;
    setDateFilter(newFilter);
    setToken(data.token);
    localStorage.setItem('raya_token', data.token);
    setUser(data.user);
    setView(data.user.role === 'manager' ? 'billing' : 'dashboard');
    
    // Check if opening balance has been set (admin only)
    if (data.user.role === 'admin') {
      try {
        const balanceRes = await apiRequest('/opening-balance', { token: data.token });
        if (balanceRes.hasBeenSet) {
          setHasOpeningBalance(true);
        } else {
          setHasOpeningBalance(false);
          setShowOpeningBalanceModal(true);
        }
      } catch (err) {
        console.error('Error checking opening balance:', err);
        setHasOpeningBalance(false);
        setShowOpeningBalanceModal(true);
      }
    }
    
    refreshAll(data.token, newFilter, data.user.role);
    showToast('Signed in');
  };

  const loadUser = async (savedToken) => {
    try {
      const data = await apiRequest('/auth/me', { token: savedToken });
      const newFilter = data.user.role === 'manager' ? { ...dateFilter, range: 'today' } : dateFilter;
      setDateFilter(newFilter);
      setUser(data.user);
      setToken(savedToken);
      
      // Check if opening balance has been set (admin only)
      if (data.user.role === 'admin') {
        try {
          const balanceRes = await apiRequest('/opening-balance', { token: savedToken });
          if (balanceRes.hasBeenSet) {
            setHasOpeningBalance(true);
          } else {
            setHasOpeningBalance(false);
            setShowOpeningBalanceModal(true);
          }
        } catch (err) {
          console.error('Error checking opening balance:', err);
          setHasOpeningBalance(false);
          setShowOpeningBalanceModal(true);
        }
      }
      
      refreshAll(savedToken, newFilter, data.user.role);
    } catch (err) {
      console.error(err);
    }
  };

  useEffect(() => {
    const saved = localStorage.getItem('raya_token');
    if (saved) loadUser(saved);
  }, []);

  const refreshAll = async (tk = token, filterOverride = dateFilter, roleOverride = user?.role, sectionsOverride = sectionFilters) => {
    if (!tk) return;
    try {
      let query = `?range=${filterOverride.range}`;
      if (filterOverride.range === 'custom') {
        if (filterOverride.startDate) query += `&startDate=${filterOverride.startDate}`;
        if (filterOverride.endDate) query += `&endDate=${filterOverride.endDate}`;
      }

      // Add selected sections to query
      const selectedSections = Object.keys(sectionsOverride).filter(key => sectionsOverride[key]);
      if (selectedSections.length > 0) {
        query += `&sections=${selectedSections.join(',')}`;
      }

      // Add daily transaction filters (categories and payment method)
      if (dailyTransactionFilters.categories.length > 0) {
        query += `&categories=${dailyTransactionFilters.categories.join(',')}`;
      }
      if (dailyTransactionFilters.paymentMethod && dailyTransactionFilters.paymentMethod !== 'all') {
        query += `&paymentMethod=${dailyTransactionFilters.paymentMethod}`;
      }

      const requests = [
        apiRequest(`/reports/income${query}`, { token: tk }),
      ];

      if (roleOverride === 'admin') {
        requests.push(apiRequest('/packages', { token: tk }));
      }

      const responses = await Promise.all(requests);
      const [income, packagesRes] = responses;
      if (roleOverride === 'admin') {
        setPackages(packagesRes?.packages || []);
      }
      setReport(income);
    } catch (err) {
      console.error(err);
      showToast(err.message);
    }
  };

  const handleInitializeOpeningBalance = async (data) => {
    setIsInitializingBalance(true);
    try {
      const result = await apiRequest('/opening-balance/initialize', {
        method: 'POST',
        body: { amount: data.amount, note: data.note },
        token,
      });
      setHasOpeningBalance(true);
      setShowOpeningBalanceModal(false);
      showToast(`Opening balance set to ৳ ${data.amount.toLocaleString()}`);
      // Refresh dashboard to show the new opening balance
      refreshAll(token, dateFilter, user?.role);
    } catch (err) {
      showToast(err.message);
    } finally {
      setIsInitializingBalance(false);
    }
  };

  const handleDailyTransactionFiltersChange = (newFilters) => {
    setDailyTransactionFilters(newFilters);
    // Trigger refresh with new filters
    refreshAll(token, dateFilter, user?.role, sectionFilters);
  };

  const submitBill = async () => {
    try {
      const body = { ...billForm, amount: Number(billForm.amount) };
      const data = await apiRequest('/transactions', { method: 'POST', body, token });
      setLastReceipt(data.transaction);
      showToast('Receipt saved');
    } catch (err) {
      showToast(err.message);
    }
  };

  const submitPackage = async () => {
    try {
      await apiRequest('/packages', { method: 'POST', body: packageForm, token });
      showToast('Package saved');
      refreshAll();
    } catch (err) {
      showToast(err.message);
    }
  };

  const logout = () => {
    localStorage.removeItem('raya_token');
    setToken('');
    setUser(null);
  };

  if (!token || !user) {
    return <AuthScreen onLogin={handleLogin} toast={toast} onCloseToast={() => setToast(null)} />;
  }

  return (
    <div className="min-h-screen bg-gray-50 text-secondary flex flex-col">
      <Toast toast={toast} onClose={() => setToast(null)} />
      <InitialOpeningBalanceModal 
        isOpen={showOpeningBalanceModal && user?.role === 'admin'} 
        onSubmit={handleInitializeOpeningBalance}
        isLoading={isInitializingBalance}
      />
      <div className="flex flex-1">
        <Sidebar view={view} setView={setView} user={user} />
        <main className="flex-1 p-4 sm:p-8 space-y-6">
          <header className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
            <div>
              <h1 className="text-2xl font-bold">Raya Swimming Pool</h1>
              <p className="text-sm text-gray-500">Fast desk workflow · {user.role}</p>
            </div>
            <div className="flex items-center gap-3">
              <span className="text-sm text-gray-600">{user.email}</span>
              <button className="btn-ghost" onClick={logout}>Sign out</button>
            </div>
          </header>

          {view === 'dashboard' && (
            <div className="grid gap-6">
              {/* Date Filter Bar */}
              <div className="card p-4 flex flex-col md:flex-row md:items-center justify-between gap-4">
                <div className="flex flex-wrap items-center gap-2">
                  {['today', 'yesterday', 'last7days', 'thisMonth'].map((r) => (
                    <button
                      key={r}
                      onClick={() => {
                        const newFilter = { ...dateFilter, range: r };
                        setDateFilter(newFilter);
                        refreshAll(token, newFilter);
                      }}
                      className={`px-4 py-2 text-sm rounded-lg font-medium transition-colors ${
                        dateFilter.range === r
                          ? 'bg-primary text-white'
                          : 'bg-gray-100 hover:bg-gray-200 text-gray-700'
                      }`}
                    >
                      {r === 'last7days' ? 'Last 7 Days' : r === 'thisMonth' ? 'This Month' : r.charAt(0).toUpperCase() + r.slice(1)}
                    </button>
                  ))}
                  <button
                    onClick={() => {
                      const newFilter = { ...dateFilter, range: 'custom' };
                      setDateFilter(newFilter);
                      refreshAll(token, newFilter);
                    }}
                    className={`px-4 py-2 text-sm rounded-lg font-medium transition-colors ${
                      dateFilter.range === 'custom'
                        ? 'bg-primary text-white'
                        : 'bg-gray-100 hover:bg-gray-200 text-gray-700'
                    }`}
                  >
                    Custom
                  </button>
                </div>
                
                {dateFilter.range === 'custom' && (
                  <div className="flex items-center gap-2 border rounded-lg p-1 bg-gray-50">
                    <input
                      type="date"
                      className="px-2 py-1 bg-transparent text-sm w-32 border-none outline-none"
                      value={dateFilter.startDate}
                      onChange={(e) => {
                         const obj = { ...dateFilter, startDate: e.target.value };
                         setDateFilter(obj);
                         if (obj.endDate) refreshAll(token, obj);
                      }}
                    />
                    <span className="text-gray-400">-</span>
                    <input
                      type="date"
                      className="px-2 py-1 bg-transparent text-sm w-32 border-none outline-none"
                      value={dateFilter.endDate}
                      onChange={(e) => {
                         const obj = { ...dateFilter, endDate: e.target.value };
                         setDateFilter(obj);
                         if (obj.startDate) refreshAll(token, obj);
                      }}
                    />
                  </div>
                )}
              </div>

              {/* Stats Row */}
              {dateFilter.range === 'today' && report.dailyBalance ? (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                  <StatCard 
                    title="📈 Opening Balance" 
                    value={`৳ ${report.dailyBalance.openingBalance.toLocaleString()}`} 
                    hint="Starting balance"
                  />
                  <StatCard 
                    title="💰 Daily Income" 
                    value={`৳ ${report.dailyBalance.income.toLocaleString()}`} 
                    hint="Today's earnings"
                  />
                  <StatCard 
                    title="💸 Daily Expense" 
                    value={`৳ ${report.dailyBalance.expense.toLocaleString()}`} 
                    hint="Today's costs"
                  />
                  <StatCard 
                    title="🎯 Closing Balance" 
                    value={`৳ ${report.dailyBalance.closingBalance.toLocaleString()}`} 
                    hint={report.dailyBalance.closingBalance >= 0 ? "End of day" : "Deficit"} 
                  />
                </div>
              ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-4">
                  <StatCard title="💰 Total Income" value={`৳ ${report.totalIncome.toLocaleString()}`} hint="All services" />
                  <StatCard title="💸 Total Expense" value={`৳ ${report.totalExpense.toLocaleString()}`} hint="All costs" />
                  <StatCard title="🧮 Net Cash" value={`৳ ${report.netCash.toLocaleString()}`} hint={report.netCash >= 0 ? "Income - Expense" : "Deficit"} />
                  <StatCard title="📊 Entry" value={`৳ ${report.entryIncome.toLocaleString()}`} hint="Daily income" />
                  <StatCard title="🧃 Beverage" value={`৳ ${report.beveragesIncome.toLocaleString()}`} hint="Beverage sales" />
                </div>
              )}

              {/* Daily Transaction Breakdown */}
              <div className="card p-4">
                <div className="mb-4">
                  <h3 className="text-lg font-semibold">Daily Transactions</h3>
                </div>
                <DailyTransactionBreakdown 
                  data={report.dailyTransactionBreakdown} 
                  filters={dailyTransactionFilters}
                  onFiltersChange={handleDailyTransactionFiltersChange}
                />
              </div>

              {/* Bottom Breakdown Row */}
              <div className="grid md:grid-cols-2 gap-4">
                <div className="card p-4">
                  <h3 className="text-lg font-semibold mb-2">Service Distribution</h3>
                  <ServicePieChart slices={report.distribution} />
                </div>
                <div className="card p-4">
                  <h3 className="text-lg font-semibold mb-2">Service Comparison</h3>
                  <BreakdownBarChart slices={report.distribution} />
                </div>
              </div>
            </div>
          )}

          {view === 'billing' && (
            <BillsPage 
              token={token} 
              showToast={showToast} 
              setLastReceipt={handleSetLastReceipt}
            />
          )}

          {view === 'beverages' && (
            <BeverageSalesPage token={token} />
          )}

          {view === 'training' && (
            <TrainingPage token={token} showToast={showToast} user={user} setLastReceipt={setLastReceipt} />
          )}

          {view === 'members' && (
            <MembershipPage 
               token={token} 
               showToast={showToast} 
               setLastReceipt={handleSetLastReceipt}
               setView={setView}
            />
          )}

          {view === 'packages' && (
            <div className="grid gap-4">
              <div className="card p-4 space-y-3">
                <div className="flex items-center justify-between">
                  <h2 className="text-lg font-semibold">New Package</h2>
                  <button className="btn-primary" onClick={submitPackage}>Save</button>
                </div>
                <div className="grid md:grid-cols-2 gap-3">
                  <input className="border rounded-lg px-3 py-2" placeholder="Name" value={packageForm.name} onChange={(e) => setPackageForm({ ...packageForm, name: e.target.value })} />
                  <select className="border rounded-lg px-3 py-2" value={packageForm.type} onChange={(e) => setPackageForm({ ...packageForm, type: e.target.value })}>
                    <option>Training</option>
                    <option>Membership</option>
                  </select>
                  <input className="border rounded-lg px-3 py-2" type="number" placeholder="Price" value={packageForm.price} onChange={(e) => setPackageForm({ ...packageForm, price: Number(e.target.value) })} />
                  <input className="border rounded-lg px-3 py-2" type="number" placeholder="Duration (days)" value={packageForm.durationDays} onChange={(e) => setPackageForm({ ...packageForm, durationDays: Number(e.target.value) })} />
                  <input className="border rounded-lg px-3 py-2 md:col-span-2" type="number" placeholder="Total classes (for training)" value={packageForm.totalClasses} onChange={(e) => setPackageForm({ ...packageForm, totalClasses: Number(e.target.value) })} />
                </div>
              </div>

              <div className="card p-4">
                <h3 className="text-lg font-semibold mb-3">Existing Packages</h3>
                <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-3">
                  {packages.map((p) => (
                    <div key={p._id} className="border rounded-lg p-3 space-y-1">
                      <p className="font-semibold">{p.name}</p>
                      <p className="text-sm text-gray-500">{p.type}</p>
                      <p className="text-sm">৳ {p.price}</p>
                      <p className="text-xs text-gray-500">{p.durationDays} days</p>
                      {p.totalClasses ? <p className="text-xs text-gray-500">Classes: {p.totalClasses}</p> : null}
                      <span className={`text-xs font-semibold ${p.active ? 'text-green-600' : 'text-red-600'}`}>
                        {p.active ? 'Active' : 'Inactive'}
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          )}

          {view === 'reports' && (
            <div className="grid gap-4">
              <div className="card p-4 space-y-4">
                <div className="flex flex-col gap-3">
                  <div className="flex flex-wrap items-center gap-3">
                    <select className="border rounded-lg px-3 py-2" value={dateFilter.range} onChange={(e) => setDateFilter({ ...dateFilter, range: e.target.value })}>
                      {(user.role === 'admin' ? ['today', 'yesterday', 'last7days', 'thisMonth', 'custom'] : ['today']).map((range) => (
                        <option key={range} value={range}>
                          {range}
                        </option>
                      ))}
                    </select>
                    <select
                      className="border rounded-lg px-3 py-2 min-w-56"
                      value={selectedReportDate}
                      onChange={(e) => setSelectedReportDate(e.target.value)}
                      disabled={reportDays.length === 0}
                    >
                      {reportDays.length === 0 ? (
                        <option value="">No report days</option>
                      ) : (
                        reportDays.map((day) => (
                          <option key={day.date} value={day.date}>
                            {formatReportDateLabel(day.date)}
                          </option>
                        ))
                      )}
                    </select>
                    <button className="btn-primary" onClick={() => refreshAll(token, dateFilter, user?.role, sectionFilters)}>Refresh</button>
                    <button className="btn-ghost" onClick={handleDownloadDailyPdf} disabled={!selectedDailyReport}>
                      Download PDF
                    </button>
                    <button className="btn-ghost" onClick={handleDownloadDailySheet} disabled={!selectedDailyReport}>
                      Download Sheet
                    </button>
                  </div>

                  <div className="flex flex-wrap gap-2">
                    <button
                      className={`px-4 py-2 rounded-lg font-medium transition-colors ${
                        sectionFilters['daily-entry']
                          ? 'bg-blue-500 text-white'
                          : 'bg-gray-200 text-gray-700 hover:bg-gray-300'
                      }`}
                      onClick={() => {
                        const newFilters = { ...sectionFilters, 'daily-entry': !sectionFilters['daily-entry'] };
                        setSectionFilters(newFilters);
                        refreshAll(token, dateFilter, user?.role, newFilters);
                      }}
                    >
                      💼 Billing
                    </button>
                    <button
                      className={`px-4 py-2 rounded-lg font-medium transition-colors ${
                        sectionFilters['training']
                          ? 'bg-green-500 text-white'
                          : 'bg-gray-200 text-gray-700 hover:bg-gray-300'
                      }`}
                      onClick={() => {
                        const newFilters = { ...sectionFilters, 'training': !sectionFilters['training'] };
                        setSectionFilters(newFilters);
                        refreshAll(token, dateFilter, user?.role, newFilters);
                      }}
                    >
                      🏊 Training
                    </button>
                    <button
                      className={`px-4 py-2 rounded-lg font-medium transition-colors ${
                        sectionFilters['membership']
                          ? 'bg-purple-500 text-white'
                          : 'bg-gray-200 text-gray-700 hover:bg-gray-300'
                      }`}
                      onClick={() => {
                        const newFilters = { ...sectionFilters, 'membership': !sectionFilters['membership'] };
                        setSectionFilters(newFilters);
                        refreshAll(token, dateFilter, user?.role, newFilters);
                      }}
                    >
                      👥 Members
                    </button>
                    <button
                      className={`px-4 py-2 rounded-lg font-medium transition-colors ${
                        sectionFilters['bills']
                          ? 'bg-red-500 text-white'
                          : 'bg-gray-200 text-gray-700 hover:bg-gray-300'
                      }`}
                      onClick={() => {
                        const newFilters = { ...sectionFilters, 'bills': !sectionFilters['bills'] };
                        setSectionFilters(newFilters);
                        refreshAll(token, dateFilter, user?.role, newFilters);
                      }}
                    >
                      📄 Bills
                    </button>
                    <button
                      className={`px-4 py-2 rounded-lg font-medium transition-colors ${
                        sectionFilters['beverages']
                          ? 'bg-orange-500 text-white'
                          : 'bg-gray-200 text-gray-700 hover:bg-gray-300'
                      }`}
                      onClick={() => {
                        const newFilters = { ...sectionFilters, 'beverages': !sectionFilters['beverages'] };
                        setSectionFilters(newFilters);
                        refreshAll(token, dateFilter, user?.role, newFilters);
                      }}
                    >
                      🥤 Beverages
                    </button>
                  </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-4">
                  <StatCard title="📅 Selected Day" value={formatReportDateLabel(selectedDaySummary.date)} hint={selectedDailyReport ? 'Day-specific summary' : 'No data available'} />
                  <StatCard title="💰 Total Income" value={`৳ ${selectedDaySummary.totalIncome.toLocaleString()}`} />
                  <StatCard title="💼 Billing" value={`৳ ${selectedDaySummary.billingAmount.toLocaleString()}`} hint="Daily entry" />
                  <StatCard title="🏊 Training" value={`৳ ${selectedDaySummary.trainingAmount.toLocaleString()}`} />
                  <StatCard title="👥 Membership" value={`৳ ${selectedDaySummary.membershipAmount.toLocaleString()}`} />
                  <StatCard title="🥤 Beverage" value={`৳ ${selectedDaySummary.beverageAmount.toLocaleString()}`} hint="Beverage sales" />
                </div>

                {selectedDaySummary.hourlySessionAmount > 0 && (
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                    <StatCard title="⏱️ Hourly Session" value={`৳ ${selectedDaySummary.hourlySessionAmount.toLocaleString()}`} />
                    <StatCard title="💵 Cash" value={`৳ ${selectedDaySummary.cashAmount.toLocaleString()}`} />
                    <StatCard title="🏦 Bank / bKash" value={`৳ ${(selectedDaySummary.bankAmount + selectedDaySummary.bKashAmount).toLocaleString()}`} />
                  </div>
                )}
              </div>

              {/* Financial Overview */}
              <div className="grid md:grid-cols-4 gap-3">
                <StatCard title="💰 Total Income" value={`৳ ${report.totalIncome.toLocaleString()}`} />
                <StatCard title="💸 Total Expense" value={`৳ ${report.totalExpense.toLocaleString()}`} />
                <StatCard title="🧮 Net Profit" value={`৳ ${report.netCash.toLocaleString()}`} hint={report.netCash >= 0 ? "Profit" : "Loss"} />
                <StatCard title="🧃 Beverage" value={`৳ ${report.beveragesIncome.toLocaleString()}`} hint="Beverage sales" />
              </div>

              {/* Income Timeline */}
              <div className="card p-4">
                <h3 className="text-lg font-semibold mb-3">Income timeline</h3>
                <IncomeChart points={report.timeline} />
              </div>

              {/* Service Split & Expense Breakdown */}
              <div className="grid md:grid-cols-2 gap-4">
                <div className="card p-4">
                  <h3 className="text-lg font-semibold mb-3">Service split</h3>
                  <ServicePieChart slices={report.distribution} />
                </div>
                {Object.values(report.expenseByCategory || {}).some(v => v > 0) && (
                  <div className="card p-4">
                    <h3 className="text-lg font-semibold mb-3">Expense Breakdown</h3>
                    <table className="w-full text-sm">
                      <tbody>
                        {Object.entries(report.expenseByCategory || {}).map(([cat, amount]) => amount > 0 && (
                          <tr key={cat} className="border-b">
                            <td className="py-2">{cat}</td>
                            <td className="text-right font-semibold">৳ {amount.toLocaleString()}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>
            </div>
          )}

          {view === 'expenses' && (
            <ExpensePage token={token} showToast={showToast} onExpenseSaved={() => refreshAll(token, dateFilter)} />
          )}

          {view === 'cash-movements' && (
            <CashMovementPage token={token} showToast={showToast} />
          )}

          {view === 'reconciliation' && (
            <ReconciliationReport token={token} showToast={showToast} />
          )}

          {/* Receipt Display */}
          {lastReceipt && (
            <div className="card p-4 mt-6">
              <div className="flex items-center justify-between mb-4 no-print">
                <h3 className="text-lg font-semibold">📄 Receipt</h3>
                <div className="flex gap-2">
                  <button className="btn-ghost" onClick={() => window.print()}>🖨 Print</button>
                  <button className="btn-ghost" onClick={() => setLastReceipt(null)}>✕ Close</button>
                </div>
              </div>
              <Receipt receipt={lastReceipt} receiptDetails={lastReceiptDetails} />
            </div>
          )}


        </main>
      </div>
    </div>
  );
}

const AuthScreen = ({ onLogin, toast, onCloseToast }) => {
  const [email, setEmail] = useState('admin@raya.com');
  const [password, setPassword] = useState('admin123');
  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50 p-4">
      <Toast toast={toast} onClose={onCloseToast} />
      <div className="card p-6 w-full max-w-md space-y-4">
        <div>
          <h1 className="text-2xl font-bold text-secondary">Raya Pool Login</h1>
          <p className="text-sm text-gray-500">Admin / Manager</p>
        </div>
        <input className="border rounded-lg px-3 py-2 w-full" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="Email" />
        <input className="border rounded-lg px-3 py-2 w-full" value={password} type="password" onChange={(e) => setPassword(e.target.value)} placeholder="Password" />
        <button className="btn-primary w-full" onClick={() => onLogin(email, password)}>Sign in</button>
      </div>
    </div>
  );
};

export default App;
