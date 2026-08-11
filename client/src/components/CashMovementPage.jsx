import { useEffect, useState } from 'react';
import { Plus, X, Check, Trash2, Wallet } from 'lucide-react';
import { apiRequest } from '../api.js';
import useConfirm from '../hooks/useConfirm';
import Button from './Button.jsx';
import EmptyState from './EmptyState.jsx';

export default function CashMovementPage({ token, showToast }) {
  const [confirm, confirmDialog] = useConfirm();
  const [movements, setMovements] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [dateRange, setDateRange] = useState('today');
  const [customRange, setCustomRange] = useState({ start: '', end: '' });
  const [summary, setSummary] = useState(null);

  const [form, setForm] = useState({
    date: new Date().toISOString().split('T')[0],
    type: 'DEPOSIT',
    category: 'Bank Deposit',
    amount: '',
    method: 'Bank',
    reason: '',
    reference: '',
    notes: '',
  });

  const [formErrors, setFormErrors] = useState({});

  useEffect(() => {
    loadMovements();
  }, [dateRange, customRange]);

  const getDateRange = () => {
    const now = new Date();
    let startDate, endDate = new Date(now);
    endDate.setHours(23, 59, 59, 999);

    switch (dateRange) {
      case 'today':
        startDate = new Date(now);
        startDate.setHours(0, 0, 0, 0);
        break;
      case 'yesterday':
        startDate = new Date(now);
        startDate.setDate(startDate.getDate() - 1);
        startDate.setHours(0, 0, 0, 0);
        endDate = new Date(startDate);
        endDate.setHours(23, 59, 59, 999);
        break;
      case 'last7days':
        startDate = new Date(now);
        startDate.setDate(startDate.getDate() - 6);
        startDate.setHours(0, 0, 0, 0);
        break;
      case 'thisMonth':
        startDate = new Date(now.getFullYear(), now.getMonth(), 1);
        startDate.setHours(0, 0, 0, 0);
        break;
      case 'custom':
        if (!customRange.start || !customRange.end) return null;
        startDate = new Date(customRange.start);
        startDate.setHours(0, 0, 0, 0);
        endDate = new Date(customRange.end);
        endDate.setHours(23, 59, 59, 999);
        break;
      default:
        startDate = new Date(now);
        startDate.setHours(0, 0, 0, 0);
    }

    return { startDate, endDate };
  };

  const loadMovements = async () => {
    setLoading(true);
    try {
      const range = getDateRange();
      if (!range) return;

      const startDate = range.startDate.toISOString().split('T')[0];
      const endDate = range.endDate.toISOString().split('T')[0];

      const [movementsData, summaryData] = await Promise.all([
        apiRequest(
          `/cash-movements?startDate=${startDate}&endDate=${endDate}`,
          { token }
        ),
        apiRequest(
          `/cash-movements/summary?startDate=${startDate}&endDate=${endDate}`,
          { token }
        ),
      ]);

      setMovements(movementsData.movements || []);
      setSummary(summaryData);
    } catch (err) {
      showToast(err.message);
    } finally {
      setLoading(false);
    }
  };

  const validateForm = () => {
    const errors = {};

    if (!form.date) errors.date = 'Date is required';
    if (!form.reason || form.reason.trim() === '') errors.reason = 'Reason is required';
    if (!form.amount || Number(form.amount) < 0) errors.amount = 'Valid amount is required';

    setFormErrors(errors);
    return Object.keys(errors).length === 0;
  };

  const handleSubmit = async () => {
    if (!validateForm()) return;

    try {
      await apiRequest('/cash-movements', {
        method: 'POST',
        token,
        body: {
          date: form.date,
          type: form.type,
          category: form.category,
          amount: Number(form.amount),
          method: form.method,
          reason: form.reason.trim(),
          reference: form.reference.trim(),
          notes: form.notes.trim(),
        },
      });

      showToast(`${form.type} recorded successfully`);
      setForm({
        date: new Date().toISOString().split('T')[0],
        type: 'DEPOSIT',
        category: 'Bank Deposit',
        amount: '',
        method: 'Bank',
        reason: '',
        reference: '',
        notes: '',
      });
      setFormErrors({});
      setShowForm(false);
      loadMovements();
    } catch (err) {
      showToast(err.message);
    }
  };

  const handleDelete = async (id) => {
    if (!(await confirm({ title: 'Delete this cash movement?', message: 'The cash balance will be recalculated.', confirmText: 'Delete', destructive: true }))) return;
    try {
      await apiRequest(`/cash-movements/${id}`, { method: 'DELETE', token });
      showToast('Movement deleted');
      loadMovements();
    } catch (err) {
      showToast(err.message);
    }
  };

  const depositCategories = [
    'Bank Deposit',
    'Owner Addition',
    'Petty Cash In',
    'Customer Advance',
    'Other',
  ];

  const withdrawalCategories = [
    'Bank Withdrawal',
    'Owner Withdrawal',
    'Petty Cash Out',
    'Salary Payment',
    'Other',
  ];

  const categories = form.type === 'DEPOSIT' ? depositCategories : withdrawalCategories;

  return (
    <div className="space-y-6">
      {confirmDialog}

      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
        <div>
          <h2 className="text-xl font-semibold text-ink">Cash movements</h2>
          <p className="muted mt-0.5">Track cash deposits and withdrawals</p>
        </div>
        <Button
          variant={showForm ? 'secondary' : 'primary'}
          icon={showForm ? X : Plus}
          onClick={() => setShowForm(!showForm)}
        >
          {showForm ? 'Close' : 'Add movement'}
        </Button>
      </div>

      {/* Form */}
      {showForm && (
        <div className="card p-6 space-y-4">
          <h3 className="section-title">Record cash movement</h3>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {/* Type */}
            <div>
              <label className="label">Type *</label>
              <select
                value={form.type}
                onChange={(e) => {
                  setForm({ ...form, type: e.target.value, category: '' });
                  setFormErrors({ ...formErrors, type: '' });
                }}
                className="select"
              >
                <option value="DEPOSIT">DEPOSIT (+)</option>
                <option value="WITHDRAWAL">WITHDRAWAL (-)</option>
              </select>
            </div>

            {/* Category */}
            <div>
              <label className="label">Category *</label>
              <select
                value={form.category}
                onChange={(e) => {
                  setForm({ ...form, category: e.target.value });
                  setFormErrors({ ...formErrors, category: '' });
                }}
                className="select"
              >
                <option value="">Select category…</option>
                {categories.map((cat) => (
                  <option key={cat} value={cat}>
                    {cat}
                  </option>
                ))}
              </select>
            </div>

            {/* Date */}
            <div>
              <label className="label">Date *</label>
              <input
                type="date"
                value={form.date}
                onChange={(e) => {
                  setForm({ ...form, date: e.target.value });
                  setFormErrors({ ...formErrors, date: '' });
                }}
                className="input"
              />
              {formErrors.date && <p className="field-error">{formErrors.date}</p>}
            </div>

            {/* Amount */}
            <div>
              <label className="label">Amount (৳) *</label>
              <input
                type="number"
                value={form.amount}
                onChange={(e) => {
                  setForm({ ...form, amount: e.target.value });
                  setFormErrors({ ...formErrors, amount: '' });
                }}
                placeholder="0"
                min="0"
                step="1"
                className="input"
              />
              {formErrors.amount && <p className="field-error">{formErrors.amount}</p>}
            </div>

            {/* Method */}
            <div>
              <label className="label">Method</label>
              <select
                value={form.method}
                onChange={(e) => setForm({ ...form, method: e.target.value })}
                className="select"
              >
                <option value="Cash">Cash</option>
                <option value="Bank">Bank</option>
                <option value="Check">Check</option>
                <option value="bKash">bKash</option>
                <option value="Other">Other</option>
              </select>
            </div>

            {/* Reference */}
            <div>
              <label className="label">Reference (Cheque #, TxID)</label>
              <input
                type="text"
                value={form.reference}
                onChange={(e) => setForm({ ...form, reference: e.target.value })}
                placeholder="e.g., CHQ12345"
                className="input"
              />
            </div>
          </div>

          {/* Reason */}
          <div>
            <label className="label">Reason *</label>
            <input
              type="text"
              value={form.reason}
              onChange={(e) => {
                setForm({ ...form, reason: e.target.value });
                setFormErrors({ ...formErrors, reason: '' });
              }}
              placeholder="Why this movement?"
              className="input"
            />
            {formErrors.reason && <p className="field-error">{formErrors.reason}</p>}
          </div>

          {/* Notes */}
          <div>
            <label className="label">Notes</label>
            <textarea
              value={form.notes}
              onChange={(e) => setForm({ ...form, notes: e.target.value })}
              placeholder="Additional details…"
              rows="2"
              className="textarea"
            />
          </div>

          {/* Submit */}
          <div className="flex gap-2 justify-end">
            <Button variant="secondary" onClick={() => setShowForm(false)}>Cancel</Button>
            <Button icon={Check} onClick={handleSubmit}>Record</Button>
          </div>
        </div>
      )}

      {/* Summary Cards */}
      {summary && (
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div className="stat-card">
            <span className="stat-label">Total deposits</span>
            <span className="stat-value text-success">৳ {summary.totalDeposits.toLocaleString()}</span>
          </div>
          <div className="stat-card">
            <span className="stat-label">Total withdrawals</span>
            <span className="stat-value text-danger">৳ {summary.totalWithdrawals.toLocaleString()}</span>
          </div>
          <div className="stat-card">
            <span className="stat-label">Net movement</span>
            <span className={`stat-value ${summary.netMovement >= 0 ? 'text-success' : 'text-danger'}`}>
              {summary.netMovement >= 0 ? '+' : ''} ৳ {summary.netMovement.toLocaleString()}
            </span>
          </div>
        </div>
      )}

      {/* Date Range Filter */}
      <div className="card p-4 space-y-3">
        <div className="flex flex-wrap items-center gap-3">
          <div className="segmented">
            {['today', 'yesterday', 'last7days', 'thisMonth', 'custom'].map((r) => (
              <button
                key={r}
                onClick={() => setDateRange(r)}
                className={dateRange === r ? 'segmented-item-active' : 'segmented-item'}
              >
                {r === 'last7days' ? 'Last 7 Days' : r === 'thisMonth' ? 'This Month' : r.charAt(0).toUpperCase() + r.slice(1)}
              </button>
            ))}
          </div>
        </div>

        {dateRange === 'custom' && (
          <div className="flex items-center gap-2">
            <input
              type="date"
              value={customRange.start}
              onChange={(e) => setCustomRange({ ...customRange, start: e.target.value })}
              className="input w-auto"
            />
            <span className="text-ink-faint text-sm">to</span>
            <input
              type="date"
              value={customRange.end}
              onChange={(e) => setCustomRange({ ...customRange, end: e.target.value })}
              className="input w-auto"
            />
          </div>
        )}
      </div>

      {/* Movements List */}
      <div className="card overflow-hidden">
        {/* Mobile card view */}
        <div className="md:hidden p-4 space-y-3">
          {loading ? (
            <div className="text-center py-6 text-sm text-ink-soft">Loading…</div>
          ) : movements.length === 0 ? (
            <EmptyState icon={Wallet} title="No cash movements recorded" message="Deposits and withdrawals you record will show up here." />
          ) : (
            movements.map((mov) => (
              <div key={mov._id} className="bg-white rounded-card border border-line p-3 space-y-2">
                <div className="flex items-start justify-between">
                  <div>
                    <span className="text-xs text-ink-soft">{mov.date.split('T')[0]}</span>
                    <p className="text-sm font-medium text-ink">{mov.category}</p>
                    <p className="text-xs text-ink-soft">{mov.reason}</p>
                  </div>
                  <div className="text-right">
                    <span className={mov.type === 'DEPOSIT' ? 'badge-success' : 'badge-danger'}>{mov.type}</span>
                    <p className={`text-sm font-semibold mt-1 tabular ${mov.type === 'DEPOSIT' ? 'text-success' : 'text-danger'}`}>{mov.type === 'DEPOSIT' ? '+' : '-'} ৳ {mov.amount.toLocaleString()}</p>
                  </div>
                </div>
                <div className="flex justify-end">
                  <button onClick={() => handleDelete(mov._id)} className="flex items-center gap-1 text-danger hover:text-danger-ink font-medium text-xs min-h-[36px]">
                    <Trash2 size={13} /> Delete
                  </button>
                </div>
              </div>
            ))
          )}
        </div>
        {/* Desktop table view */}
        <div className="hidden md:block overflow-x-auto">
        <table className="table-modern w-full">
          <thead>
            <tr>
              <th>Date</th>
              <th>Type</th>
              <th>Category</th>
              <th>Reason</th>
              <th className="text-right">Amount</th>
              <th className="text-center">Action</th>
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr>
                <td colSpan="6" className="text-center text-ink-soft">
                  Loading…
                </td>
              </tr>
            ) : movements.length === 0 ? (
              <tr>
                <td colSpan="6" className="p-0">
                  <EmptyState icon={Wallet} title="No cash movements recorded" message="Deposits and withdrawals you record will show up here." />
                </td>
              </tr>
            ) : (
              movements.map((mov) => (
                <tr key={mov._id}>
                  <td className="text-ink">{mov.date.split('T')[0]}</td>
                  <td>
                    <span className={mov.type === 'DEPOSIT' ? 'badge-success' : 'badge-danger'}>{mov.type}</span>
                  </td>
                  <td className="text-ink">{mov.category}</td>
                  <td className="text-ink">{mov.reason}</td>
                  <td className="text-right font-semibold tabular">
                    <span className={mov.type === 'DEPOSIT' ? 'text-success' : 'text-danger'}>
                      {mov.type === 'DEPOSIT' ? '+' : '-'} ৳ {mov.amount.toLocaleString()}
                    </span>
                  </td>
                  <td className="text-center">
                    <button
                      onClick={() => handleDelete(mov._id)}
                      className="w-8 h-8 inline-flex items-center justify-center rounded-control text-danger hover:bg-danger-soft"
                      aria-label="Delete movement"
                    >
                      <Trash2 size={14} />
                    </button>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
        </div>
      </div>
    </div>
  );
}
