import React, { useState, useEffect, useRef } from 'react';
import {
  Plus, Search, Eye, Printer, Trash2, Receipt, Users, Wallet,
  CalendarClock, CreditCard, Lock, Shirt, Clock,
} from 'lucide-react';
import { apiRequest } from '../api.js';
import BillForm from './BillForm.jsx';
import Button from './Button.jsx';
import useConfirm from '../hooks/useConfirm';

const PAYMENT_BADGE = {
  Cash: 'badge-success',
  Bank: 'badge-info',
  bKash: 'badge-warning',
};

export default function BillsPage({ token, showToast, setLastReceipt }) {
  const [confirm, confirmDialog] = useConfirm();
  const [bills, setBills] = useState([]);
  const [stats, setStats] = useState({
    totalBillsToday: 0,
    todayRevenue: 0,
    thisMonthRevenue: 0,
    totalPersonsToday: 0,
    totalPersonsThisMonth: 0,
    totalCustomersToday: 0,
  });
  const [showBillForm, setShowBillForm] = useState(false);
  const [activeSessions, setActiveSessions] = useState([]);
  const [loading, setLoading] = useState(false);
  const [sessionLoading, setSessionLoading] = useState(false);
  const [sessionLockers, setSessionLockers] = useState({}); // Map of sessionId -> lockerAssignments
  const [sessionDresses, setSessionDresses] = useState({}); // Map of sessionId -> dressRentals
  const [filters, setFilters] = useState({
    search: '',
    dateRange: 'today',
    paymentMethod: '',
    amountPerPerson: '',
  });
  const [sessionTick, setSessionTick] = useState(Date.now());
  const alertedSessionIds = useRef(new Set());

  const formatSessionTime = (value) => {
    if (!value) return '—';
    return new Date(value).toLocaleString('en-US', {
      hour: '2-digit',
      minute: '2-digit',
      day: 'numeric',
      month: 'short',
    });
  };

  const formatMinutes = (minutes) => {
    const total = Math.max(0, Math.floor(minutes || 0));
    const hours = Math.floor(total / 60);
    const mins = total % 60;
    if (hours === 0) return `${mins}m`;
    return `${hours}h ${mins}m`;
  };

  const formatCurrency = (value) => `৳ ${Number(value || 0).toLocaleString()}`;

  const loadActiveSessions = async () => {
    setSessionLoading(true);
    try {
      const response = await apiRequest('/hourly-sessions/active', {
        method: 'GET',
        token,
      });
      setActiveSessions(response.sessions || []);
    } catch (error) {
      console.error('Error loading active sessions:', error);
      showToast('Error loading active sessions', 'error');
    } finally {
      setSessionLoading(false);
    }
  };

  // Fetch locker assignments for a session
  const fetchLockerData = async (sessionId) => {
    try {
      const response = await apiRequest(`/lockers/assignments-by-bill/${sessionId}`, {
        method: 'GET',
        token,
      });
      if (response.success && response.lockerAssignments) {
        setSessionLockers((prev) => ({
          ...prev,
          [sessionId]: response.lockerAssignments,
        }));
      }
    } catch (error) {
      console.error(`Error fetching locker data for session ${sessionId}:`, error);
      // Don't show error toast for locker fetching - it's optional
    }
  };

  // Fetch dress rental assignments for a session
  const fetchDressData = async (sessionId) => {
    try {
      const response = await apiRequest(`/dress-rentals/assignments-by-bill/${sessionId}`, {
        method: 'GET',
        token,
      });
      if (response.success && response.dressAssignments) {
        setSessionDresses((prev) => ({
          ...prev,
          [sessionId]: response.dressAssignments,
        }));
      }
    } catch (error) {
      console.error(`Error fetching dress data for session ${sessionId}:`, error);
    }
  };

  // Fetch locker and dress data for all active sessions
  useEffect(() => {
    if (activeSessions.length > 0) {
      activeSessions.forEach((session) => {
        fetchLockerData(session._id);
        fetchDressData(session._id);
      });
    }
  }, [activeSessions]);

  // Load bills and stats
  const loadBills = async () => {
    setLoading(true);
    try {
      const today = new Date();
      today.setHours(0, 0, 0, 0);
      const tomorrow = new Date(today);
      tomorrow.setDate(tomorrow.getDate() + 1);

      // Determine date range
      let startDate, endDate;
      const now = new Date();

      if (filters.dateRange === 'today') {
        startDate = today;
        endDate = tomorrow;
      } else if (filters.dateRange === 'yesterday') {
        const yesterday = new Date(today);
        yesterday.setDate(yesterday.getDate() - 1);
        startDate = yesterday;
        endDate = today;
      } else if (filters.dateRange === 'thisWeek') {
        const weekStart = new Date(today);
        weekStart.setDate(weekStart.getDate() - weekStart.getDay());
        startDate = weekStart;
        endDate = tomorrow;
      } else if (filters.dateRange === 'thisMonth') {
        startDate = new Date(now.getFullYear(), now.getMonth(), 1);
        endDate = new Date(now.getFullYear(), now.getMonth() + 1, 1);
      } else {
        startDate = today;
        endDate = tomorrow;
      }

      const params = new URLSearchParams({
        startDate: startDate.toISOString(),
        endDate: endDate.toISOString(),
        ...(filters.paymentMethod && { paymentMethod: filters.paymentMethod }),
        ...(filters.amountPerPerson && { amountPerPerson: filters.amountPerPerson }),
        ...(filters.search && { search: filters.search }),
      });

      const response = await apiRequest(`/transactions/bills/list?${params}`, {
        method: 'GET',
        token,
      });

      setBills(response.bills || []);
    } catch (error) {
      console.error('Error loading bills:', error);
      showToast('Error loading bills', 'error');
    } finally {
      setLoading(false);
    }
  };

  // Load stats
  const loadStats = async () => {
    try {
      const response = await apiRequest('/transactions/stats/bills', {
        method: 'GET',
        token,
      });
      setStats(response);
    } catch (error) {
      console.error('Error loading stats:', error);
    }
  };

  const startHourlyTimerForBill = async (billData, transaction) => {
    try {
      await apiRequest('/hourly-sessions', {
        method: 'POST',
        token,
        body: {
          customerName: billData.name || transaction.name || 'Walk-in swimmer',
          phone: billData.phone || transaction.phone || '',
          hourlyRate: Number(transaction.amount || billData.amount || 0),
          durationHours: 1,
          notes: `Auto-started from bill ${transaction.receiptId}`,
        },
      });
      loadActiveSessions();
      return true;
    } catch (error) {
      console.error('Error starting hourly timer for bill:', error);
      showToast('Bill saved, but timer could not be started automatically', 'warning');
      return false;
    }
  };

  // Load on mount and when filters change
  useEffect(() => {
    loadBills();
  }, [filters]);

  useEffect(() => {
    loadActiveSessions();
  }, [token]);

  useEffect(() => {
    const interval = setInterval(() => setSessionTick(Date.now()), 1000);
    return () => clearInterval(interval);
  }, []);

  useEffect(() => {
    const expiringSessions = activeSessions.filter((session) => session.status === 'active' && session.remainingMinutes <= 0);
    expiringSessions.forEach((session) => {
      if (!alertedSessionIds.current.has(session._id)) {
        alertedSessionIds.current.add(session._id);
        showToast(`${session.customerName} session time finished. Extend or close the session.`, 'warning');
      }
    });
  }, [activeSessions, sessionTick, showToast]);

  useEffect(() => {
    loadStats();
    const interval = setInterval(loadStats, 30000); // Refresh every 30 seconds
    return () => clearInterval(interval);
  }, []);

  const handleSaveBill = async (billData) => {
    try {
      const response = await apiRequest('/transactions', {
        method: 'POST',
        token,
        body: {
          ...billData,
          serviceType: 'Bill',
        },
      });

      await startHourlyTimerForBill(billData, response.transaction);

      showToast('Bill saved successfully', 'success');
      setShowBillForm(false);
      loadBills();
      loadStats();
    } catch (error) {
      console.error('Error saving bill:', error);
      showToast('Error saving bill', 'error');
    }
  };

  const handleSaveAndPrint = async (billData) => {
    try {
      const response = await apiRequest('/transactions', {
        method: 'POST',
        token,
        body: {
          ...billData,
          serviceType: 'Bill',
        },
      });

      await startHourlyTimerForBill(billData, response.transaction);

      // Format bill for receipt
      const receipt = {
        receiptId: response.transaction.receiptId,
        date: response.transaction.date,
        name: response.transaction.name,
        phone: response.transaction.phone,
        amount: response.transaction.amount,
        paymentMethod: response.transaction.paymentMethod,
        serviceType: 'Bill',
        price: response.transaction.price,
        discount: response.transaction.discount,
      };

      setLastReceipt(receipt);
      showToast('Bill saved! Opening receipt for printing...', 'success');
      setShowBillForm(false);
      loadBills();
      loadStats();

      // Trigger print after a short delay
      setTimeout(() => {
        window.print();
      }, 500);
    } catch (error) {
      console.error('Error saving bill:', error);
      showToast('Error saving bill', 'error');
    }
  };

  const handleExtendSession = async (sessionId) => {
    try {
      await apiRequest(`/hourly-sessions/${sessionId}/extend`, {
        method: 'POST',
        token,
        body: { extraHours: 1 },
      });

      showToast('Session extended by 1 hour', 'success');
      loadActiveSessions();
    } catch (error) {
      console.error('Error extending session:', error);
      showToast(error.message || 'Failed to extend session', 'error');
    }
  };

  const handleCloseSession = async (session) => {
    // Default to 'Cash' payment method without prompting
    const paymentMethod = 'Cash';

    try {
      await apiRequest(`/hourly-sessions/${session._id}/close`, {
        method: 'POST',
        token,
        body: {
          paymentMethod,
        },
      });

      alertedSessionIds.current.delete(session._id);
      showToast(`Session closed for ${session.customerName}`, 'success');
      loadActiveSessions();
      loadStats();
      loadBills();
    } catch (error) {
      console.error('Error closing session:', error);
      showToast(error.message || 'Failed to close session', 'error');
    }
  };

  const getSessionLockers = (sessionId) => {
    const lockers = sessionLockers[sessionId] || [];
    if (lockers.length === 0) return '—';
    return lockers
      .map((l) => l.lockerNumber)
      .sort()
      .join(', ');
  };

  const getLockerDue = (sessionId) => {
    const lockers = sessionLockers[sessionId] || [];
    return lockers
      .filter((l) => l.paymentStatus === 'Due' && l.chargeAmount > 0)
      .reduce((sum, l) => sum + (l.chargeAmount || 0), 0);
  };

  const handleCollectLockerDue = async (sessionId) => {
    const lockers = sessionLockers[sessionId] || [];
    const dueLockers = lockers.filter((l) => l.paymentStatus === 'Due' && l.chargeAmount > 0 && l.transactionId);

    if (dueLockers.length === 0) {
      showToast('No locker due to collect', 'warning');
      return;
    }

    try {
      for (const locker of dueLockers) {
        await apiRequest(`/lockers/payment/${locker.transactionId}`, {
          method: 'POST',
          token,
          body: {
            amount: locker.chargeAmount,
            paymentMethod: 'Cash',
            notes: 'Collected from billing section',
          },
        });
      }
      showToast(`Locker due collected from ${dueLockers.length} locker(s)`, 'success');
      fetchLockerData(sessionId);
    } catch (error) {
      console.error('Error collecting locker due:', error);
      showToast(error.message || 'Failed to collect locker due', 'error');
    }
  };

  const getSessionDresses = (sessionId) => {
    const dresses = sessionDresses[sessionId] || [];
    if (dresses.length === 0) return '—';
    return dresses
      .map((d) => d.dressNumber)
      .sort()
      .join(', ');
  };

  const getDressDue = (sessionId) => {
    const dresses = sessionDresses[sessionId] || [];
    return dresses
      .filter((d) => d.paymentStatus === 'Due' && d.chargeAmount > 0)
      .reduce((sum, d) => sum + (d.chargeAmount || 0), 0);
  };

  const handleCollectDressDue = async (sessionId) => {
    const dresses = sessionDresses[sessionId] || [];
    const dueDresses = dresses.filter((d) => d.paymentStatus === 'Due' && d.chargeAmount > 0 && d.transactionId);

    if (dueDresses.length === 0) {
      showToast('No dress due to collect', 'warning');
      return;
    }

    try {
      for (const dress of dueDresses) {
        await apiRequest(`/dress-rentals/payment/${dress.transactionId}`, {
          method: 'POST',
          token,
          body: {
            amount: dress.chargeAmount,
            paymentMethod: 'Cash',
            notes: 'Collected from billing section',
          },
        });
      }
      showToast(`Dress due collected from ${dueDresses.length} dress(es)`, 'success');
      fetchDressData(sessionId);
    } catch (error) {
      console.error('Error collecting dress due:', error);
      showToast(error.message || 'Failed to collect dress due', 'error');
    }
  };

  const renderActiveSessionCard = (session) => {
    const remainingMinutes = session.remainingMinutes || 0;
    const isExpired = remainingMinutes <= 0;
    const overtimeMinutes = session.overtimeMinutes || 0;
    const displayRemaining = isExpired ? `Overtime ${formatMinutes(overtimeMinutes)}` : formatMinutes(remainingMinutes);
    const lockerDue = getLockerDue(session._id);
    const dressDue = getDressDue(session._id);

    return (
      <div key={session._id} className={`rounded-lg border p-4 space-y-3 ${isExpired ? 'bg-danger-soft/70 border-danger/20' : 'bg-white border-line'}`}>
        <div className="flex items-start justify-between">
          <div>
            <div className="font-semibold text-ink">{session.customerName}</div>
            <div className="text-xs text-ink-soft">{session.phone || 'No phone'}</div>
          </div>
          <span className={`text-sm font-bold px-2 py-1 rounded ${isExpired ? 'bg-danger-soft text-danger-ink' : 'bg-success-soft text-success-ink'}`}>
            {displayRemaining}
          </span>
        </div>

        <div className="grid grid-cols-2 gap-2 text-sm">
          <div>
            <span className="text-xs text-ink-soft">Start</span>
            <p className="font-medium">{formatSessionTime(session.startTime)}</p>
          </div>
          <div>
            <span className="text-xs text-ink-soft">Planned End</span>
            <p className="font-medium">{formatSessionTime(session.plannedEndTime)}</p>
          </div>
          <div>
            <span className="text-xs text-ink-soft">Total</span>
            <p className="font-semibold">{formatCurrency(session.totalAmount || session.baseCharge || 0)}</p>
          </div>
          <div>
            <span className="text-xs text-ink-soft">Beverage</span>
            <p className="font-semibold">{formatCurrency(session.beverageCharge || 0)}</p>
          </div>
        </div>

        {(getSessionLockers(session._id) !== '—' || getSessionDresses(session._id) !== '—') && (
          <div className="flex flex-wrap gap-2 text-xs">
            {getSessionLockers(session._id) !== '—' && (
              <span className="badge-info"><Lock size={11} /> {getSessionLockers(session._id)}</span>
            )}
            {getSessionDresses(session._id) !== '—' && (
              <span className="badge-neutral"><Shirt size={11} /> {getSessionDresses(session._id)}</span>
            )}
          </div>
        )}

        {(lockerDue > 0 || dressDue > 0) && (
          <div className="flex flex-wrap gap-2">
            {lockerDue > 0 && (
              <div className="flex items-center gap-2">
                <span className="text-xs text-danger font-semibold">Locker: {formatCurrency(lockerDue)}</span>
                <button type="button" onClick={() => handleCollectLockerDue(session._id)} className="px-2 py-1 text-xs font-medium text-white bg-danger rounded hover:bg-danger-ink min-h-[36px]">Collect</button>
              </div>
            )}
            {dressDue > 0 && (
              <div className="flex items-center gap-2">
                <span className="text-xs text-danger font-semibold">Dress: {formatCurrency(dressDue)}</span>
                <button type="button" onClick={() => handleCollectDressDue(session._id)} className="px-2 py-1 text-xs font-medium text-white bg-danger rounded hover:bg-danger-ink min-h-[36px]">Collect</button>
              </div>
            )}
          </div>
        )}

        <div className="flex gap-2 pt-1">
          <button type="button" onClick={() => handleExtendSession(session._id)} className="btn-ghost flex-1 text-sm py-2">+1 hr</button>
          <button type="button" onClick={() => handleCloseSession(session)} className="btn-primary flex-1 text-sm py-2">Collect</button>
        </div>
      </div>
    );
  };

  const renderActiveSessionRow = (session) => {
    const remainingMinutes = session.remainingMinutes || 0;
    const isExpired = remainingMinutes <= 0;
    const overtimeMinutes = session.overtimeMinutes || 0;
    const displayRemaining = isExpired ? `Overtime ${formatMinutes(overtimeMinutes)}` : formatMinutes(remainingMinutes);

    return (
      <tr key={session._id} className={isExpired ? 'bg-danger-soft/70' : 'bg-white'}>
        <td className="px-4 py-3">
          <div className="font-semibold text-ink">{session.customerName}</div>
          <div className="text-xs text-ink-soft">{session.phone || 'No phone provided'}</div>
        </td>
        <td className="px-4 py-3 text-sm text-ink">{getSessionLockers(session._id)}</td>
        <td className="px-4 py-3 text-sm text-ink">{getSessionDresses(session._id)}</td>
        <td className="px-4 py-3 text-sm text-ink">{formatSessionTime(session.startTime)}</td>
        <td className="px-4 py-3 text-sm text-ink">{formatSessionTime(session.plannedEndTime)}</td>
        <td className="px-4 py-3 text-sm font-semibold">
          <span className={isExpired ? 'text-danger-ink' : 'text-ink'}>{displayRemaining}</span>
        </td>
        <td className="px-4 py-3 text-sm font-semibold text-ink">{formatCurrency(session.totalAmount || session.baseCharge || 0)}</td>
        <td className="px-4 py-3 text-sm text-ink">{formatCurrency(session.beverageCharge || 0)}</td>
        <td className="px-4 py-3 text-sm">
          {(() => {
            const lockerDue = getLockerDue(session._id);
            return lockerDue > 0 ? (
              <div className="flex items-center gap-2">
                <span className="text-danger font-semibold">{formatCurrency(lockerDue)}</span>
                <button
                  type="button"
                  onClick={() => handleCollectLockerDue(session._id)}
                  className="px-2 py-1 text-xs font-medium text-white bg-danger rounded hover:bg-danger-ink transition-colors"
                >
                  Collect
                </button>
              </div>
            ) : (
              <span className="text-ink">{formatCurrency(0)}</span>
            );
          })()}
        </td>
        <td className="px-4 py-3 text-sm">
          {(() => {
            const dressDue = getDressDue(session._id);
            return dressDue > 0 ? (
              <div className="flex items-center gap-2">
                <span className="text-danger font-semibold">{formatCurrency(dressDue)}</span>
                <button
                  type="button"
                  onClick={() => handleCollectDressDue(session._id)}
                  className="px-2 py-1 text-xs font-medium text-white bg-danger rounded hover:bg-danger-ink transition-colors"
                >
                  Collect
                </button>
              </div>
            ) : (
              <span className="text-ink">{formatCurrency(0)}</span>
            );
          })()}
        </td>
        <td className="px-4 py-3">
          <div className="flex flex-wrap justify-end gap-2">
            <button type="button" onClick={() => handleExtendSession(session._id)} className="btn-ghost">+1 hr</button>
            <button type="button" onClick={() => handleCloseSession(session)} className="btn-primary">Collect</button>
          </div>
        </td>
      </tr>
    );
  };

  const handleDeleteBill = async (id) => {
    if (!(await confirm({ title: 'Delete this bill?', message: 'The receipt will be permanently removed.', confirmText: 'Delete bill', destructive: true }))) return;

    try {
      await apiRequest(`/transactions/${id}`, {
        method: 'DELETE',
        token,
      });

      showToast('Bill deleted successfully', 'success');
      loadBills();
      loadStats();
    } catch (error) {
      console.error('Error deleting bill:', error);
      showToast('Error deleting bill', 'error');
    }
  };

  const handleViewReceipt = (bill) => {
    const receipt = {
      receiptId: bill.receiptId,
      date: bill.date,
      name: bill.name,
      phone: bill.phone,
      amount: bill.amount,
      paymentMethod: bill.paymentMethod,
      serviceType: 'Bill',
      price: bill.price,
      discount: bill.discount,
    };
    setLastReceipt(receipt);
  };

  const renderBillCard = (bill) => (
    <div key={bill._id} className="bg-white rounded-lg border border-line p-4 space-y-2">
      <div className="flex items-start justify-between">
        <div>
          <div className="font-semibold text-ink">{bill.name || '—'}</div>
          <div className="text-xs text-ink-soft">{bill.phone || 'No phone'}</div>
        </div>
        <span className="text-lg font-bold text-ink">৳ {bill.amount.toLocaleString()}</span>
      </div>
      <div className="flex flex-wrap items-center gap-2 text-xs text-ink-soft">
        <span>{formatDate(bill.date)}</span>
        <span>•</span>
        <span>{bill.numberOfPersons || 1} person(s)</span>
        <span>•</span>
        <span>৳ {(bill.amountPerPerson || 0).toLocaleString()}/person</span>
      </div>
      <div className="flex items-center justify-between pt-1">
        <div className="flex items-center gap-2">
          <span className={PAYMENT_BADGE[bill.paymentMethod] || 'badge-neutral'}>{bill.paymentMethod}</span>
          {bill.discount > 0 && (
            <span className="text-xs text-danger font-medium">-৳ {bill.discount.toLocaleString()}</span>
          )}
        </div>
        <div className="flex items-center gap-1">
          <button onClick={() => handleViewReceipt(bill)} className="w-9 h-9 flex items-center justify-center rounded-control text-primary hover:bg-primary-50" title="View receipt" aria-label="View receipt"><Eye size={16} /></button>
          <button onClick={() => { handleViewReceipt(bill); setTimeout(() => window.print(), 300); }} className="w-9 h-9 flex items-center justify-center rounded-control text-success hover:bg-success-soft" title="Print" aria-label="Print"><Printer size={16} /></button>
          <button onClick={() => handleDeleteBill(bill._id)} className="w-9 h-9 flex items-center justify-center rounded-control text-danger hover:bg-danger-soft" title="Delete" aria-label="Delete"><Trash2 size={16} /></button>
        </div>
      </div>
    </div>
  );

  const StatCard = ({ title, value, hint, icon: Icon }) => (
    <div className="stat-card">
      <span className="stat-label">{Icon && <Icon size={15} className="text-primary" />}{title}</span>
      <span className="stat-value">{value}</span>
      {hint && <span className="stat-hint">{hint}</span>}
    </div>
  );

  const formatDate = (dateStr) => {
    return new Date(dateStr).toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  };

  return (
    <div className="grid gap-4">
      {confirmDialog}

      <div className="card p-4 space-y-4 border-l-4 border-l-warning">
        <div>
          <h2 className="text-lg font-semibold text-ink">Live billing timers</h2>
          <p className="text-sm text-ink-soft">A 1-hour timer starts automatically when a bill is saved. Overtime stays visible and can be extended or closed from here.</p>
        </div>

        {sessionLoading ? (
          <div className="text-sm text-ink-soft">Loading active timers…</div>
        ) : activeSessions.length === 0 ? (
          <div className="rounded-card border border-dashed border-line-strong p-4 text-sm text-ink-soft">
            No active timers right now.
          </div>
        ) : (
          <>
            {/* Mobile card view */}
            <div className="md:hidden space-y-3">
              {activeSessions.map(renderActiveSessionCard)}
            </div>
            {/* Desktop table view */}
            <div className="table-shell">
              <table className="table-modern min-w-full">
                <thead>
                  <tr>
                    <th>Customer</th>
                    <th>Assigned Lockers</th>
                    <th>Assigned Dresses</th>
                    <th>Start</th>
                    <th>Planned End</th>
                    <th>Live Timer</th>
                    <th>Live Total</th>
                    <th>Beverage Due</th>
                    <th>Locker Due</th>
                    <th>Dress Due</th>
                    <th className="text-right">Action</th>
                  </tr>
                </thead>
                <tbody>
                  {activeSessions.map(renderActiveSessionRow)}
                </tbody>
              </table>
            </div>
          </>
        )}
      </div>

      {/* Summary Cards */}
      <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard icon={Receipt} title="Total Bills Today" value={stats.totalBillsToday} hint={`${stats.totalBillsToday} bills`} />
        <StatCard icon={Wallet} title="Today's Revenue" value={`৳ ${stats.todayRevenue.toLocaleString()}`} hint="Total collected" />
        <StatCard icon={CalendarClock} title="This Month Revenue" value={`৳ ${stats.thisMonthRevenue.toLocaleString()}`} hint="Total month" />
        <StatCard
          icon={Users}
          title="Persons &amp; Customers Today"
          value={`${stats.totalPersonsToday} / ${stats.totalCustomersToday}`}
          hint={`${stats.totalPersonsToday} persons • ${stats.totalCustomersToday} customers`}
        />
      </div>

      {/* Toolbar & Filters */}
      <div className="card p-4 space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <h2 className="section-title">Bills list</h2>
          <Button onClick={() => setShowBillForm(true)} icon={Plus}>
            Add new bill
          </Button>
        </div>

        {/* Filters */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
          <div className="relative">
            <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-ink-faint pointer-events-none" />
            <input
              type="text"
              placeholder="Search by name or phone…"
              value={filters.search}
              onChange={(e) => setFilters({ ...filters, search: e.target.value })}
              className="input pl-9"
            />
          </div>
          <select
            value={filters.dateRange}
            onChange={(e) => setFilters({ ...filters, dateRange: e.target.value })}
            className="select"
          >
            <option value="today">Today</option>
            <option value="yesterday">Yesterday</option>
            <option value="thisWeek">This Week</option>
            <option value="thisMonth">This Month</option>
          </select>
          <select
            value={filters.paymentMethod}
            onChange={(e) => setFilters({ ...filters, paymentMethod: e.target.value })}
            className="select"
          >
            <option value="">All Payment Methods</option>
            <option value="Cash">Cash</option>
            <option value="Bank">Bank</option>
            <option value="bKash">bKash</option>
          </select>
          <select
            value={filters.amountPerPerson}
            onChange={(e) => setFilters({ ...filters, amountPerPerson: e.target.value })}
            className="select"
          >
            <option value="">All Amounts</option>
            <option value="300">৳ 300</option>
            <option value="400">৳ 400</option>
            <option value="500">৳ 500</option>
            <option value="750">৳ 750</option>
            <option value="1000">৳ 1000</option>
          </select>
        </div>
      </div>

      {/* Bills Table */}
      <div className="card overflow-hidden">
        {loading ? (
          <div className="p-8 text-center text-sm text-ink-soft">Loading bills…</div>
        ) : bills.length === 0 ? (
          <div className="p-8 text-center text-sm text-ink-soft">
            No bills found for the selected filters.
          </div>
        ) : (
          <>
            {/* Mobile card view */}
            <div className="md:hidden p-4 space-y-3">
              {bills.map(renderBillCard)}
              {/* Mobile totals */}
              <div className="bg-canvas rounded-card p-3 text-sm font-semibold flex flex-col gap-1">
                <div className="flex justify-between"><span>Total Persons:</span><span>{bills.reduce((sum, b) => sum + (b.numberOfPersons || 1), 0)}</span></div>
                <div className="flex justify-between"><span>Total Discount:</span><span className="text-danger">-৳ {bills.reduce((sum, b) => sum + b.discount, 0).toLocaleString()}</span></div>
                <div className="flex justify-between text-base"><span>TOTAL:</span><span className="text-ink">৳ {bills.reduce((sum, b) => sum + b.amount, 0).toLocaleString()}</span></div>
              </div>
            </div>
            {/* Desktop table view */}
            <div className="hidden md:block overflow-x-auto">
              <table className="table-modern w-full">
                <thead>
                  <tr>
                    <th>Date</th>
                    <th>Name</th>
                    <th>Phone</th>
                    <th>Per Person</th>
                    <th className="text-center">Persons</th>
                    <th>Discount</th>
                    <th className="text-right">Total</th>
                    <th>Method</th>
                    <th className="text-center">Action</th>
                  </tr>
                </thead>
                <tbody>
                  {bills.map((bill) => (
                    <tr key={bill._id}>
                      <td>{formatDate(bill.date)}</td>
                      <td className="font-medium">{bill.name || '—'}</td>
                      <td>{bill.phone || '—'}</td>
                      <td>৳ {(bill.amountPerPerson || 0).toLocaleString()}</td>
                      <td className="text-center">{bill.numberOfPersons || 1}</td>
                      <td>
                        {bill.discount > 0 ? (
                          <span className="text-danger font-medium">- ৳ {bill.discount.toLocaleString()}</span>
                        ) : (
                          '—'
                        )}
                      </td>
                      <td className="font-semibold text-ink text-right">
                        ৳ {bill.amount.toLocaleString()}
                      </td>
                      <td>
                        <span className={PAYMENT_BADGE[bill.paymentMethod] || 'badge-neutral'}>{bill.paymentMethod}</span>
                      </td>
                      <td>
                        <div className="flex items-center justify-center gap-1">
                          <button
                            onClick={() => handleViewReceipt(bill)}
                            className="w-8 h-8 flex items-center justify-center rounded-control text-primary hover:bg-primary-50"
                            title="View receipt"
                            aria-label="View receipt"
                          >
                            <Eye size={15} />
                          </button>
                          <button
                            onClick={() => {
                              handleViewReceipt(bill);
                              setTimeout(() => window.print(), 300);
                            }}
                            className="w-8 h-8 flex items-center justify-center rounded-control text-success hover:bg-success-soft"
                            title="Print"
                            aria-label="Print"
                          >
                            <Printer size={15} />
                          </button>
                          <button
                            onClick={() => handleDeleteBill(bill._id)}
                            className="w-8 h-8 flex items-center justify-center rounded-control text-danger hover:bg-danger-soft"
                            title="Delete"
                            aria-label="Delete"
                          >
                            <Trash2 size={15} />
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
                {bills.length > 0 && (
                  <tfoot className="bg-canvas border-t-2 border-line font-semibold sticky bottom-0">
                    <tr>
                      <td colSpan="4" className="px-4 py-3 text-right">
                        TOTAL
                      </td>
                      <td className="px-4 py-3 text-center">
                        {bills.reduce((sum, b) => sum + (b.numberOfPersons || 1), 0)}
                      </td>
                      <td className="px-4 py-3">
                        - ৳ {bills.reduce((sum, b) => sum + b.discount, 0).toLocaleString()}
                      </td>
                      <td className="px-4 py-3 text-right text-ink">
                        ৳ {bills.reduce((sum, b) => sum + b.amount, 0).toLocaleString()}
                      </td>
                      <td colSpan="2"></td>
                    </tr>
                  </tfoot>
                )}
              </table>
            </div>
          </>
        )}
      </div>

      {/* Bill Form Modal */}
      {showBillForm && (
        <BillForm
          onClose={() => setShowBillForm(false)}
          onSave={handleSaveBill}
          onSaveAndPrint={handleSaveAndPrint}
        />
      )}

    </div>
  );
}
