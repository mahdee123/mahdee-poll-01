import { useEffect, useState } from 'react';
import { apiRequest } from '../api.js';

export default function CashMovementPage({ token, showToast }) {
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

      showToast(`✓ ${form.type} recorded successfully`);
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
    if (!window.confirm('Delete this cash movement?')) return;
    try {
      await apiRequest(`/cash-movements/${id}`, { method: 'DELETE', token });
      showToast('✓ Movement deleted');
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
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
        <div>
          <h2 className="text-2xl font-bold">💰 Cash Movements</h2>
          <p className="text-gray-600">Track cash deposits and withdrawals</p>
        </div>
        <button
          onClick={() => setShowForm(!showForm)}
          className={`px-4 py-2 rounded-lg font-medium transition-colors ${
            showForm
              ? 'bg-red-600 text-white hover:bg-red-700'
              : 'bg-primary text-white hover:bg-primary/90'
          }`}
        >
          {showForm ? '✕ Close' : '➕ Add Movement'}
        </button>
      </div>

      {/* Form */}
      {showForm && (
        <div className="card p-6 space-y-4">
          <h3 className="text-lg font-semibold">Record Cash Movement</h3>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {/* Type */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Type *</label>
              <select
                value={form.type}
                onChange={(e) => {
                  setForm({ ...form, type: e.target.value, category: '' });
                  setFormErrors({ ...formErrors, type: '' });
                }}
                className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-primary"
              >
                <option value="DEPOSIT">DEPOSIT (+)</option>
                <option value="WITHDRAWAL">WITHDRAWAL (-)</option>
              </select>
            </div>

            {/* Category */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Category *</label>
              <select
                value={form.category}
                onChange={(e) => {
                  setForm({ ...form, category: e.target.value });
                  setFormErrors({ ...formErrors, category: '' });
                }}
                className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-primary"
              >
                <option value="">Select category...</option>
                {categories.map((cat) => (
                  <option key={cat} value={cat}>
                    {cat}
                  </option>
                ))}
              </select>
            </div>

            {/* Date */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Date *</label>
              <input
                type="date"
                value={form.date}
                onChange={(e) => {
                  setForm({ ...form, date: e.target.value });
                  setFormErrors({ ...formErrors, date: '' });
                }}
                className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-primary"
              />
              {formErrors.date && <p className="text-xs text-red-600 mt-1">{formErrors.date}</p>}
            </div>

            {/* Amount */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Amount (৳) *</label>
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
                className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-primary"
              />
              {formErrors.amount && <p className="text-xs text-red-600 mt-1">{formErrors.amount}</p>}
            </div>

            {/* Method */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Method</label>
              <select
                value={form.method}
                onChange={(e) => setForm({ ...form, method: e.target.value })}
                className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-primary"
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
              <label className="block text-sm font-medium text-gray-700 mb-1">Reference (Cheque #, TxID)</label>
              <input
                type="text"
                value={form.reference}
                onChange={(e) => setForm({ ...form, reference: e.target.value })}
                placeholder="e.g., CHQ12345"
                className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-primary"
              />
            </div>
          </div>

          {/* Reason */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Reason *</label>
            <input
              type="text"
              value={form.reason}
              onChange={(e) => {
                setForm({ ...form, reason: e.target.value });
                setFormErrors({ ...formErrors, reason: '' });
              }}
              placeholder="Why this movement?"
              className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-primary"
            />
            {formErrors.reason && <p className="text-xs text-red-600 mt-1">{formErrors.reason}</p>}
          </div>

          {/* Notes */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Notes</label>
            <textarea
              value={form.notes}
              onChange={(e) => setForm({ ...form, notes: e.target.value })}
              placeholder="Additional details..."
              rows="2"
              className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-primary resize-none"
            />
          </div>

          {/* Submit */}
          <div className="flex gap-2 justify-end">
            <button
              onClick={() => setShowForm(false)}
              className="px-4 py-2 bg-gray-300 text-gray-700 rounded-lg hover:bg-gray-400 font-medium"
            >
              Cancel
            </button>
            <button
              onClick={handleSubmit}
              className="px-4 py-2 bg-primary text-white rounded-lg hover:bg-primary/90 font-medium"
            >
              ✓ Record
            </button>
          </div>
        </div>
      )}

      {/* Summary Cards */}
      {summary && (
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div className="card p-4">
            <p className="text-sm text-gray-600">Total Deposits</p>
            <p className="text-2xl font-bold text-green-600">
              ৳ {summary.totalDeposits.toLocaleString()}
            </p>
          </div>
          <div className="card p-4">
            <p className="text-sm text-gray-600">Total Withdrawals</p>
            <p className="text-2xl font-bold text-red-600">
              ৳ {summary.totalWithdrawals.toLocaleString()}
            </p>
          </div>
          <div className="card p-4">
            <p className="text-sm text-gray-600">Net Movement</p>
            <p className={`text-2xl font-bold ${summary.netMovement >= 0 ? 'text-green-600' : 'text-red-600'}`}>
              {summary.netMovement >= 0 ? '+' : ''} ৳ {summary.netMovement.toLocaleString()}
            </p>
          </div>
        </div>
      )}

      {/* Date Range Filter */}
      <div className="card p-4 space-y-3">
        <div className="flex flex-wrap items-center gap-2">
          {['today', 'yesterday', 'last7days', 'thisMonth'].map((r) => (
            <button
              key={r}
              onClick={() => setDateRange(r)}
              className={`px-4 py-2 text-sm rounded-lg font-medium transition-colors ${
                dateRange === r
                  ? 'bg-primary text-white'
                  : 'bg-gray-100 hover:bg-gray-200 text-gray-700'
              }`}
            >
              {r === 'last7days' ? 'Last 7 Days' : r === 'thisMonth' ? 'This Month' : r.charAt(0).toUpperCase() + r.slice(1)}
            </button>
          ))}
          <button
            onClick={() => setDateRange('custom')}
            className={`px-4 py-2 text-sm rounded-lg font-medium transition-colors ${
              dateRange === 'custom'
                ? 'bg-primary text-white'
                : 'bg-gray-100 hover:bg-gray-200 text-gray-700'
            }`}
          >
            Custom
          </button>
        </div>

        {dateRange === 'custom' && (
          <div className="flex gap-2 border rounded-lg p-2 bg-gray-50">
            <input
              type="date"
              value={customRange.start}
              onChange={(e) => setCustomRange({ ...customRange, start: e.target.value })}
              className="flex-1 px-2 py-1 border rounded text-sm"
            />
            <span className="text-gray-400 px-2 py-1">-</span>
            <input
              type="date"
              value={customRange.end}
              onChange={(e) => setCustomRange({ ...customRange, end: e.target.value })}
              className="flex-1 px-2 py-1 border rounded text-sm"
            />
          </div>
        )}
      </div>

      {/* Movements List */}
      <div className="card overflow-hidden">
        {/* Mobile card view */}
        <div className="md:hidden p-4 space-y-3">
          {loading ? (
            <div className="text-center py-6 text-gray-500">Loading...</div>
          ) : movements.length === 0 ? (
            <div className="text-center py-6 text-gray-500">No cash movements recorded</div>
          ) : (
            movements.map((mov) => (
              <div key={mov._id} className="bg-white rounded-lg border border-gray-200 p-3 space-y-2">
                <div className="flex items-start justify-between">
                  <div>
                    <span className="text-xs text-gray-500">{mov.date.split('T')[0]}</span>
                    <p className="text-sm font-medium">{mov.category}</p>
                    <p className="text-xs text-gray-500">{mov.reason}</p>
                  </div>
                  <div className="text-right">
                    <span className={`px-2 py-1 rounded text-xs font-semibold ${mov.type === 'DEPOSIT' ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'}`}>{mov.type}</span>
                    <p className={`text-sm font-semibold mt-1 ${mov.type === 'DEPOSIT' ? 'text-green-600' : 'text-red-600'}`}>{mov.type === 'DEPOSIT' ? '+' : '-'} ৳ {mov.amount.toLocaleString()}</p>
                  </div>
                </div>
                <div className="flex justify-end">
                  <button onClick={() => handleDelete(mov._id)} className="text-red-600 hover:text-red-700 font-medium text-xs min-h-[36px]">🗑 Delete</button>
                </div>
              </div>
            ))
          )}
        </div>
        {/* Desktop table view */}
        <div className="hidden md:block overflow-x-auto">
        <table className="w-full text-sm">
          <thead className="bg-gray-50 border-b">
            <tr>
              <th className="px-4 py-3 text-left font-semibold text-gray-700">Date</th>
              <th className="px-4 py-3 text-left font-semibold text-gray-700">Type</th>
              <th className="px-4 py-3 text-left font-semibold text-gray-700">Category</th>
              <th className="px-4 py-3 text-left font-semibold text-gray-700">Reason</th>
              <th className="px-4 py-3 text-right font-semibold text-gray-700">Amount</th>
              <th className="px-4 py-3 text-center font-semibold text-gray-700">Action</th>
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr>
                <td colSpan="6" className="px-4 py-6 text-center text-gray-500">
                  Loading...
                </td>
              </tr>
            ) : movements.length === 0 ? (
              <tr>
                <td colSpan="6" className="px-4 py-6 text-center text-gray-500">
                  No cash movements recorded
                </td>
              </tr>
            ) : (
              movements.map((mov) => (
                <tr key={mov._id} className="border-b hover:bg-gray-50">
                  <td className="px-4 py-3 text-gray-800">{mov.date.split('T')[0]}</td>
                  <td className="px-4 py-3">
                    <span
                      className={`px-2 py-1 rounded text-xs font-semibold ${
                        mov.type === 'DEPOSIT'
                          ? 'bg-green-100 text-green-700'
                          : 'bg-red-100 text-red-700'
                      }`}
                    >
                      {mov.type}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-gray-700">{mov.category}</td>
                  <td className="px-4 py-3 text-gray-700">{mov.reason}</td>
                  <td className="px-4 py-3 text-right font-mono font-semibold">
                    <span
                      className={mov.type === 'DEPOSIT' ? 'text-green-600' : 'text-red-600'}
                    >
                      {mov.type === 'DEPOSIT' ? '+' : '-'} ৳ {mov.amount.toLocaleString()}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-center">
                    <button
                      onClick={() => handleDelete(mov._id)}
                      className="text-red-600 hover:text-red-700 font-medium text-xs"
                    >
                      🗑 Delete
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
