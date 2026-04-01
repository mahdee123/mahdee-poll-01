import { useEffect, useState } from 'react';
import { apiRequest } from '../api.js';

export default function ReconciliationReport({ token, showToast }) {
  const [reconciliationData, setReconciliationData] = useState([]);
  const [loading, setLoading] = useState(true);
  const [dateRange, setDateRange] = useState('thisMonth');
  const [customRange, setCustomRange] = useState({ start: '', end: '' });

  useEffect(() => {
    loadReconciliation();
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

  const loadReconciliation = async () => {
    setLoading(true);
    try {
      const range = getDateRange();
      if (!range) return;

      const startDate = range.startDate.toISOString().split('T')[0];
      const endDate = range.endDate.toISOString().split('T')[0];

      // Fetch report data
      const reportData = await apiRequest(
        `/reports/income?range=custom&startDate=${startDate}&endDate=${endDate}`,
        { token }
      );

      // Generate daily reconciliation data
      const data = [];
      const current = new Date(range.startDate);
      current.setHours(0, 0, 0, 0);

      while (current <= range.endDate) {
        const dateStr = current.toISOString().split('T')[0];

        // Get opening balance for this date
        const openingBalanceData = await apiRequest(`/opening-balance?date=${dateStr}`, {
          token,
        }).catch(() => ({ openingBalance: null }));

        const openingBalance = openingBalanceData.openingBalance?.amount || 0;

        // Get daily report (need to modify backend to support daily breakdown)
        // For now, we'll use timeline data from main report if available
        const dayData = reportData.timeline?.find(t => t.date === dateStr) || {
          income: 0,
          expense: 0,
          netCash: 0,
        };

        const closingBalance = openingBalance + dayData.income - dayData.expense;

        // Check if opening = previous day's closing
        const isReconciled =
          current.getTime() === range.startDate.getTime() || // First day always OK
          true; // Will be checked against previous day

        data.push({
          date: dateStr,
          openingBalance,
          income: dayData.income,
          expense: dayData.expense,
          closingBalance,
          isReconciled,
        });

        current.setDate(current.getDate() + 1);
      }

      // Check reconciliation: each day's opening should equal previous day's closing
      for (let i = 1; i < data.length; i++) {
        const previousClosing = data[i - 1].closingBalance;
        const currentOpening = data[i].openingBalance;
        data[i].isReconciled = previousClosing === currentOpening;
        data[i].variance = currentOpening - previousClosing;
      }

      setReconciliationData(data);
    } catch (err) {
      showToast(err.message || 'Error loading reconciliation');
    } finally {
      setLoading(false);
    }
  };

  const downloadCSV = () => {
    const headers = ['Date', 'Opening Balance', 'Income', 'Expense', 'Closing Balance', 'Status', 'Variance'];
    const rows = reconciliationData.map(d => [
      d.date,
      d.openingBalance,
      d.income,
      d.expense,
      d.closingBalance,
      d.isReconciled ? 'OK' : 'MISMATCH',
      d.variance || '',
    ]);

    const csv = [
      headers.join(','),
      ...rows.map(r => r.map(v => `"${v}"`).join(',')),
    ].join('\n');

    const blob = new Blob([csv], { type: 'text/csv' });
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `reconciliation-${new Date().toISOString().split('T')[0]}.csv`;
    a.click();
    window.URL.revokeObjectURL(url);
  };

  if (loading) {
    return (
      <div className="card p-8 flex items-center justify-center">
        <div className="text-gray-600">Loading reconciliation data...</div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
        <div>
          <h2 className="text-2xl font-bold">📊 Daily Reconciliation Report</h2>
          <p className="text-gray-600">Track opening/closing balances and cash continuity</p>
        </div>
        <button
          onClick={downloadCSV}
          disabled={reconciliationData.length === 0}
          className="px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 disabled:opacity-50 font-medium"
        >
          📥 Download CSV
        </button>
      </div>

      {/* Date Range Filter */}
      <div className="card p-4 space-y-3">
        <div className="flex flex-wrap items-center gap-2">
          {['today', 'yesterday', 'last7days', 'thisMonth'].map((r) => (
            <button
              key={r}
              onClick={() => setDateRange(r)}
              className={`px-4 py-2 text-sm rounded-lg font-medium transition-colors ${
                dateRange === r
                  ? 'bg-blue-600 text-white'
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
                ? 'bg-blue-600 text-white'
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

      {/* Reconciliation Table */}
      <div className="card overflow-x-auto">
        <table className="w-full text-sm">
          <thead className="bg-gray-50 border-b">
            <tr>
              <th className="px-4 py-3 text-left font-semibold text-gray-700">Date</th>
              <th className="px-4 py-3 text-right font-semibold text-gray-700">Opening Balance</th>
              <th className="px-4 py-3 text-right font-semibold text-gray-700">Income</th>
              <th className="px-4 py-3 text-right font-semibold text-gray-700">Expense</th>
              <th className="px-4 py-3 text-right font-semibold text-gray-700">Closing Balance</th>
              <th className="px-4 py-3 text-center font-semibold text-gray-700">Status</th>
              <th className="px-4 py-3 text-right font-semibold text-gray-700">Variance</th>
            </tr>
          </thead>
          <tbody>
            {reconciliationData.length === 0 ? (
              <tr>
                <td colSpan="7" className="px-4 py-6 text-center text-gray-500">
                  No reconciliation data available
                </td>
              </tr>
            ) : (
              reconciliationData.map((row, idx) => (
                <tr key={row.date} className="border-b hover:bg-gray-50 transition-colors">
                  <td className="px-4 py-3 font-medium text-gray-800">{row.date}</td>
                  <td className="px-4 py-3 text-right font-mono text-gray-700">
                    ৳ {row.openingBalance.toLocaleString()}
                  </td>
                  <td className="px-4 py-3 text-right font-mono text-green-600">
                    ৳ {row.income.toLocaleString()}
                  </td>
                  <td className="px-4 py-3 text-right font-mono text-red-600">
                    ৳ {row.expense.toLocaleString()}
                  </td>
                  <td className="px-4 py-3 text-right font-mono font-semibold text-gray-800">
                    ৳ {row.closingBalance.toLocaleString()}
                  </td>
                  <td className="px-4 py-3 text-center">
                    {row.isReconciled ? (
                      <span className="inline-flex items-center gap-1 px-3 py-1 rounded-full bg-green-100 text-green-700 text-xs font-semibold">
                        ✓ OK
                      </span>
                    ) : (
                      <span className="inline-flex items-center gap-1 px-3 py-1 rounded-full bg-red-100 text-red-700 text-xs font-semibold">
                        ⚠ MISMATCH
                      </span>
                    )}
                  </td>
                  <td className="px-4 py-3 text-right font-mono text-gray-700">
                    {row.variance !== undefined && row.variance !== 0 ? (
                      <span className={row.variance > 0 ? 'text-green-600' : 'text-red-600'}>
                        {row.variance > 0 ? '+' : ''} ৳ {row.variance.toLocaleString()}
                      </span>
                    ) : (
                      '-'
                    )}
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      {/* Summary Stats */}
      {reconciliationData.length > 0 && (
        <div className="grid md:grid-cols-3 gap-4">
          <div className="card p-4">
            <p className="text-sm text-gray-600">Total Records</p>
            <p className="text-2xl font-bold text-gray-800">{reconciliationData.length}</p>
          </div>
          <div className="card p-4">
            <p className="text-sm text-gray-600">Total Income</p>
            <p className="text-2xl font-bold text-green-600">
              ৳ {reconciliationData.reduce((s, r) => s + r.income, 0).toLocaleString()}
            </p>
          </div>
          <div className="card p-4">
            <p className="text-sm text-gray-600">Total Expense</p>
            <p className="text-2xl font-bold text-red-600">
              ৳ {reconciliationData.reduce((s, r) => s + r.expense, 0).toLocaleString()}
            </p>
          </div>
        </div>
      )}

      {/* Legend */}
      <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
        <p className="text-sm font-semibold text-blue-900 mb-2">📌 Legend:</p>
        <div className="grid md:grid-cols-2 gap-3 text-xs text-blue-800">
          <div>
            <p className="font-medium">✓ OK</p>
            <p>Opening Balance = Previous Day's Closing (Reconciled)</p>
          </div>
          <div>
            <p className="font-medium">⚠ MISMATCH</p>
            <p>Opening Balance ≠ Previous Day's Closing (Check for adjustments)</p>
          </div>
        </div>
      </div>
    </div>
  );
}
