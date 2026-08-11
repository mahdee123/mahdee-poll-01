import { useEffect, useState } from 'react';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, PieChart, Pie, Cell, BarChart, Bar, Legend } from 'recharts';
import { Wallet, TrendingUp, Banknote, Target, Calculator, BarChart3, X, Printer, FileText, Package } from 'lucide-react';
import './index.css';
import { apiRequest } from './api.js';
import useDocumentTitle from './hooks/useDocumentTitle.js';
import Button from './components/Button.jsx';
import Badge from './components/Badge.jsx';
import Card from './components/Card.jsx';
import EmptyState from './components/EmptyState.jsx';
import MembershipPage from './components/MembershipPage.jsx';
import TrainingPage from './components/TrainingPage.jsx';
import BillsPage from './components/BillsPage.jsx';
import Receipt from './components/Receipt.jsx';
import BeverageSalesPage from './components/BeverageSalesPage.jsx';
import ReconciliationReport from './components/ReconciliationReport.jsx';
import CashMovementPage from './components/CashMovementPage.jsx';
import InitialOpeningBalanceModal from './components/InitialOpeningBalanceModal.jsx';
import LockerManagementPage from './components/LockerManagementPage.jsx';
import DressRentalPage from './components/DressRentalPage.jsx';
import AccountingPage from './components/AccountingPage.jsx';
import DailyTransactionBreakdown from './components/DailyTransactionBreakdown.jsx';
import ProfessionalReportPage from './components/ProfessionalReportPage.jsx';
import { downloadDailyReportPdf, downloadDailyReportSheet } from './utils/reportExports.js';
import Sidebar from './components/Sidebar.jsx';
import Topbar from './components/Topbar.jsx';

const SERVICE_TYPES = ['Daily Entry', 'Training', 'Membership'];
const PAYMENT_METHODS = ['Cash', 'Bank', 'bKash'];
const DAILY_REPORT_CATEGORIES = ['Bill', 'Training', 'Membership', 'Beverage', 'Hourly Session'];

const PLAN_PRESETS = {
  Monthly: 30,
  '3 Months': 90,
  '6 Months': 180,
  Yearly: 365,
};

const VIEW_TITLES = {
  dashboard: 'Dashboard',
  billing: 'Bills',
  beverages: 'Beverage Sales',
  training: 'Training',
  members: 'Memberships',
  packages: 'Packages',
  lockers: 'Lockers',
  'dress-rentals': 'Dress Rentals',
  'cash-movements': 'Cash Movements',
  reconciliation: 'Reconciliation',
  accounting: 'Accounting',
  reports: 'Reports',
};

const formatDate = (value) => new Date(value).toISOString().split('T')[0];

const StatCard = ({ title, value, hint, icon: Icon }) => {
  return (
    <div className="stat-card card-hover">
      <span className="stat-label">
        {Icon ? <Icon size={15} className="text-primary" /> : null}
        {title}
      </span>
      <span className="stat-value">{value}</span>
      {hint ? <span className="stat-hint">{hint}</span> : null}
    </div>
  );
};



// Custom Tooltip for IncomeChart showing all three values
const IncomeChartTooltip = ({ active, payload, label }) => {
  if (active && payload && payload.length > 0) {
    const data = payload[0].payload;
    return (
      <div className="bg-white p-3 rounded-card shadow-raised border border-line">
        <p className="text-sm font-semibold text-ink mb-2">{data.date}</p>
        <div className="space-y-1">
          <p className="text-sm text-primary">
            <span className="font-medium">Income:</span> ৳ {data.income.toLocaleString()}
          </p>
          <p className="text-sm text-success">
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
    return <div className="flex h-48 sm:h-64 items-center justify-center text-sm text-ink-faint bg-canvas rounded-card border border-dashed border-line">No transactions found for selected date</div>;
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
  
  const renderCustomDot = (props) => {
    const { cx, cy, payload, dataKey } = props;
    if (!payload) return null;
    
    let isPeak = false;
    let color = '#375DFB'; // primary
    
    if (dataKey === 'income' && payload.income === peakIncomeValue && peakIncomeValue > 0) {
      isPeak = true;
      color = '#375DFB';
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
    <div className="h-48 sm:h-64 mt-4 w-full">
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
            stroke="#375DFB" 
            strokeWidth={3} 
            dot={renderCustomDot}
            activeDot={{r: 8}}
            isAnimationActive={true}
          />
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
  if (!data.length) return <div className="flex h-48 sm:h-64 items-center justify-center text-sm text-ink-faint">No data available</div>;
  const COLORS = ['#375DFB', '#10b981', '#1B1B1B']; // Blue, Green, Dark
  
  return (
    <div className="h-48 sm:h-64 w-full">
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
  if (!slices || !slices.reduce((a,b)=>a+b.value, 0)) return <div className="flex h-48 sm:h-64 items-center justify-center text-sm text-ink-faint">No data available</div>;;
  const COLORS = ['#375DFB', '#10b981', '#1B1B1B'];
  return (
    <div className="h-48 sm:h-64 w-full">
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
    <div className="fixed top-4 left-4 right-4 sm:left-auto sm:right-4 sm:w-auto z-[60] flex justify-end pointer-events-none">
      <div className="toast-info">
        <span className="flex-1 text-sm text-ink">{toast.message}</span>
        <button className="text-ink-faint hover:text-ink flex-shrink-0" onClick={onClose} aria-label="Close toast">
          <X size={16} />
        </button>
      </div>
    </div>
  );
};

function App() {
  const [token, setToken] = useState('');
  const [user, setUser] = useState(null);
  const [view, setView] = useState('dashboard');
  const [toast, setToast] = useState(null);
  const [sidebarOpen, setSidebarOpen] = useState(false);

  useDocumentTitle(VIEW_TITLES[view]);

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
  const [report, setReport] = useState({ totalIncome: 0, entryIncome: 0, trainingIncome: 0, membershipIncome: 0, billIncome: 0, beveragesIncome: 0, totalExpense: 0, netCash: 0, timeline: [], distribution: [], dailyBalance: null, dailyTransactionBreakdown: [] });

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

      // Fetch expense data for the same date range
      const toLocal = (d) => {
        const year = d.getFullYear();
        const month = String(d.getMonth() + 1).padStart(2, '0');
        const day = String(d.getDate()).padStart(2, '0');
        return `${year}-${month}-${day}`;
      };
      let expenseQuery = '';
      if (filterOverride.range === 'today') {
        expenseQuery = `?startDate=${toLocal(new Date())}&endDate=${toLocal(new Date())}`;
      } else if (filterOverride.range === 'custom' && filterOverride.startDate) {
        expenseQuery = `?startDate=${filterOverride.startDate}&endDate=${filterOverride.endDate || toLocal(new Date())}`;
      } else {
        // For week/month/year, compute approximate range
        const now = new Date();
        let start;
        if (filterOverride.range === 'yesterday') {
          start = new Date(now); start.setDate(start.getDate() - 1);
        } else if (filterOverride.range === 'last7days') {
          start = new Date(now); start.setDate(start.getDate() - 7);
        } else if (filterOverride.range === 'thisMonth') {
          start = new Date(now.getFullYear(), now.getMonth(), 1);
        } else if (filterOverride.range === 'thisYear') {
          start = new Date(now.getFullYear(), 0, 1);
        } else {
          start = new Date(now.getFullYear(), now.getMonth(), 1);
        }
        expenseQuery = `?startDate=${toLocal(start)}&endDate=${toLocal(now)}`;
      }
      requests.push(apiRequest(`/daily-expenses/summary${expenseQuery}`, { token: tk }));

      if (roleOverride === 'admin') {
        requests.push(apiRequest('/packages', { token: tk }));
      }

      const responses = await Promise.all(requests);
      const [income, expenseRes, packagesRes] = responses;
      if (roleOverride === 'admin') {
        setPackages(packagesRes?.packages || []);
      }
      setReport({ ...income, totalExpense: expenseRes?.totalAmount || 0 });
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
    <div className="min-h-screen bg-canvas text-ink flex">
      <Toast toast={toast} onClose={() => setToast(null)} />
      <InitialOpeningBalanceModal
        isOpen={showOpeningBalanceModal && user?.role === 'admin'}
        onSubmit={handleInitializeOpeningBalance}
        isLoading={isInitializingBalance}
      />

      <Sidebar
        view={view}
        setView={setView}
        user={user}
        isOpen={sidebarOpen}
        onClose={() => setSidebarOpen(false)}
      />

      <div className="flex-1 flex flex-col min-w-0 h-screen overflow-hidden">
        <Topbar title={VIEW_TITLES[view] || 'Raya Pool'} onOpenSidebar={() => setSidebarOpen(true)} />

        <main className="flex-1 overflow-y-auto p-4 sm:p-8 space-y-6 min-w-0">

          {view === 'dashboard' && (
            <div className="grid gap-6">
              {/* Date Filter Bar */}
              <div className="card p-4 flex flex-col gap-4">
                <div className="flex flex-wrap items-center gap-3">
                  <div className="segmented">
                    {['today', 'yesterday', 'last7days', 'thisMonth', 'custom'].map((r) => (
                      <button
                        key={r}
                        onClick={() => {
                          const newFilter = { ...dateFilter, range: r };
                          setDateFilter(newFilter);
                          refreshAll(token, newFilter);
                        }}
                        className={dateFilter.range === r ? 'segmented-item-active' : 'segmented-item'}
                      >
                        {r === 'last7days' ? 'Last 7 Days' : r === 'thisMonth' ? 'This Month' : r.charAt(0).toUpperCase() + r.slice(1)}
                      </button>
                    ))}
                  </div>

                  {dateFilter.range === 'custom' && (
                    <div className="flex items-center gap-2">
                      <input
                        type="date"
                        className="input w-auto"
                        value={dateFilter.startDate}
                        onChange={(e) => {
                           const obj = { ...dateFilter, startDate: e.target.value };
                           setDateFilter(obj);
                           if (obj.endDate) refreshAll(token, obj);
                        }}
                      />
                      <span className="text-ink-faint text-sm">to</span>
                      <input
                        type="date"
                        className="input w-auto"
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
              </div>

              {/* Stats Row */}
              {dateFilter.range === 'today' && report.dailyBalance ? (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                  <StatCard
                    icon={Wallet}
                    title="Cash in Hand"
                    value={`৳ ${report.dailyBalance.closingBalance.toLocaleString()}`}
                    hint="Current cash position"
                  />
                  <StatCard
                    icon={TrendingUp}
                    title="Income"
                    value={`৳ ${report.dailyBalance.income.toLocaleString()}`}
                    hint="Today's earnings"
                  />
                  <StatCard
                    icon={Banknote}
                    title="Expense"
                    value={`৳ ${(report.totalExpense || 0).toLocaleString()}`}
                    hint="Today's costs"
                  />
                  <StatCard
                    icon={Target}
                    title="Closing Balance"
                    value={`৳ ${report.dailyBalance.closingBalance.toLocaleString()}`}
                    hint={report.dailyBalance.closingBalance >= 0 ? "End of day" : "Deficit"}
                  />
                </div>
              ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                  <StatCard icon={Wallet} title="Total Income" value={`৳ ${report.totalIncome.toLocaleString()}`} hint="All services" />
                  <StatCard icon={Banknote} title="Total Expense" value={`৳ ${(report.totalExpense || 0).toLocaleString()}`} hint="All costs" />
                  <StatCard icon={Calculator} title="Net Cash" value={`৳ ${report.netCash.toLocaleString()}`} hint={report.netCash >= 0 ? "Income" : "Deficit"} />
                  <StatCard icon={BarChart3} title="Entry" value={`৳ ${report.entryIncome.toLocaleString()}`} hint="Daily income" />
                </div>
              )}

              {/* Daily Transaction Breakdown */}
              <Card title="Daily Transactions">
                <DailyTransactionBreakdown
                  data={report.dailyTransactionBreakdown}
                  filters={dailyTransactionFilters}
                  onFiltersChange={handleDailyTransactionFiltersChange}
                />
              </Card>

              {/* Bottom Breakdown Row */}
              <div className="grid md:grid-cols-2 gap-4">
                <Card title="Service Distribution">
                  <ServicePieChart slices={report.distribution} />
                </Card>
                <Card title="Service Comparison">
                  <BreakdownBarChart slices={report.distribution} />
                </Card>
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
            <BeverageSalesPage token={token} setLastReceipt={handleSetLastReceipt} />
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
            <div className="grid gap-6">
              <div className="card">
                <div className="flex items-center justify-between gap-4 px-5 py-4 border-b border-line">
                  <h2 className="section-title">New package</h2>
                  <Button onClick={submitPackage}>Save package</Button>
                </div>
                <div className="grid md:grid-cols-2 gap-4 p-5">
                  <div>
                    <label className="label">Name</label>
                    <input className="input" placeholder="e.g. Gold Monthly" value={packageForm.name} onChange={(e) => setPackageForm({ ...packageForm, name: e.target.value })} />
                  </div>
                  <div>
                    <label className="label">Type</label>
                    <select className="select" value={packageForm.type} onChange={(e) => setPackageForm({ ...packageForm, type: e.target.value })}>
                      <option>Training</option>
                      <option>Membership</option>
                    </select>
                  </div>
                  <div>
                    <label className="label">Price (৳)</label>
                    <input className="input" type="number" placeholder="0" value={packageForm.price} onChange={(e) => setPackageForm({ ...packageForm, price: Number(e.target.value) })} />
                  </div>
                  <div>
                    <label className="label">Duration (days)</label>
                    <input className="input" type="number" placeholder="0" value={packageForm.durationDays} onChange={(e) => setPackageForm({ ...packageForm, durationDays: Number(e.target.value) })} />
                  </div>
                  <div className="md:col-span-2">
                    <label className="label">Total classes (for training packages)</label>
                    <input className="input" type="number" placeholder="0" value={packageForm.totalClasses} onChange={(e) => setPackageForm({ ...packageForm, totalClasses: Number(e.target.value) })} />
                  </div>
                </div>
              </div>

              <Card title="Existing packages" icon={Package}>
                {packages.length === 0 ? (
                  <EmptyState title="No packages yet" message="Packages you create will show up here." icon={Package} />
                ) : (
                  <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-3">
                    {packages.map((p) => (
                      <div key={p._id} className="border border-line rounded-card p-4 space-y-1.5">
                        <div className="flex items-start justify-between gap-2">
                          <p className="font-semibold text-ink">{p.name}</p>
                          <Badge type="status" value={p.active ? 'Active' : 'Inactive'} />
                        </div>
                        <p className="text-sm text-ink-soft">{p.type}</p>
                        <p className="text-sm font-medium text-ink tabular">৳ {p.price}</p>
                        <p className="text-xs text-ink-faint">{p.durationDays} days{p.totalClasses ? ` · ${p.totalClasses} classes` : ''}</p>
                      </div>
                    ))}
                  </div>
                )}
              </Card>
            </div>
          )}

          {view === 'lockers' && (
            <LockerManagementPage token={token} />
          )}

          {view === 'dress-rentals' && (
            <DressRentalPage token={token} />
          )}

          {view === 'reports' && (
            <ProfessionalReportPage token={token} />
          )}

          {view === 'cash-movements' && (
            <CashMovementPage token={token} showToast={showToast} />
          )}

          {view === 'reconciliation' && (
            <ReconciliationReport token={token} showToast={showToast} />
          )}

          {view === 'accounting' && (
            <AccountingPage token={token} />
          )}

          {/* Receipt Display */}
          {lastReceipt && (
            <div className="card p-4 mt-6">
              <div className="flex items-center justify-between mb-4 no-print">
                <h3 className="text-lg font-semibold flex items-center gap-2"><FileText size={18} className="text-primary" />Receipt</h3>
                <div className="flex gap-2">
                  <button className="btn-ghost flex items-center gap-1.5" onClick={() => window.print()}><Printer size={16} />Print</button>
                  <button className="btn-ghost flex items-center gap-1.5" onClick={() => setLastReceipt(null)}><X size={16} />Close</button>
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
    <div className="min-h-screen flex items-center justify-center bg-canvas p-4">
      <Toast toast={toast} onClose={onCloseToast} />
      <div className="card p-6 w-full max-w-md space-y-4">
        <div>
          <h1 className="text-2xl font-semibold text-ink">Raya Pool Login</h1>
          <p className="text-sm text-ink-soft">Admin / Manager</p>
        </div>
        <input className="input" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="Email" />
        <input className="input" value={password} type="password" onChange={(e) => setPassword(e.target.value)} placeholder="Password" />
        <Button className="w-full" onClick={() => onLogin(email, password)}>Sign in</Button>
      </div>
    </div>
  );
};

export default App;
