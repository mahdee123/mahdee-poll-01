import { useEffect, useState } from 'react';
import * as XLSX from 'xlsx';
import { Download, FileSpreadsheet, CheckCircle2, AlertTriangle, Info } from 'lucide-react';
import { apiRequest } from '../api.js';
import Button from './Button.jsx';
import EmptyState from './EmptyState.jsx';

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
          netCash: 0,
        };

        const closingBalance = openingBalance + dayData.income;

        // Check if opening = previous day's closing
        const isReconciled =
          current.getTime() === range.startDate.getTime() || // First day always OK
          true; // Will be checked against previous day

        data.push({
          date: dateStr,
          openingBalance,
          income: dayData.income,
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
    const headers = ['Date', 'Opening Balance', 'Income', 'Closing Balance', 'Status', 'Variance'];
    const rows = reconciliationData.map(d => [
      d.date,
      d.openingBalance,
      d.income,
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

  const getRangeLabel = () => {
    switch (dateRange) {
      case 'today':
        return 'Today';
      case 'yesterday':
        return 'Yesterday';
      case 'last7days':
        return 'Last 7 Days';
      case 'thisMonth':
        return 'This Month';
      case 'custom':
        return customRange.start && customRange.end
          ? `${customRange.start} to ${customRange.end}`
          : 'Custom Range';
      default:
        return 'Selected Range';
    }
  };

  const formatCurrency = (value) => `৳${Number(value || 0).toLocaleString()}`;

  const downloadSheet = () => {
    const rangeLabel = getRangeLabel();
    const generatedAt = new Date().toLocaleString();
    const totalIncome = reconciliationData.reduce((sum, row) => sum + row.income, 0);
    const mismatchCount = reconciliationData.filter((row) => !row.isReconciled).length;

    const summaryRows = [
      ['Report', 'Daily Reconciliation Report'],
      ['Range', rangeLabel],
      ['Generated', generatedAt],
      ['Records', reconciliationData.length],
      ['Total Income', formatCurrency(totalIncome)],
      ['Mismatches', mismatchCount],
      [],
    ];

    const dataRows = [
      ['Date', 'Opening Balance', 'Income', 'Closing Balance', 'Status', 'Variance'],
      ...reconciliationData.map((row) => [
        row.date,
        row.openingBalance,
        row.income,
        row.closingBalance,
        row.isReconciled ? 'OK' : 'MISMATCH',
        row.variance !== undefined && row.variance !== 0 ? row.variance : '',
      ]),
    ];

    const worksheet = XLSX.utils.aoa_to_sheet([...summaryRows, ...dataRows]);
    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, 'Reconciliation');
    XLSX.writeFile(workbook, `reconciliation-${new Date().toISOString().split('T')[0]}.xlsx`);
  };

  if (loading) {
    return (
      <div className="card p-8 flex items-center justify-center">
        <div className="text-sm text-ink-soft">Loading reconciliation data…</div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
        <div>
          <h2 className="text-xl font-semibold text-ink">Daily reconciliation report</h2>
          <p className="muted mt-0.5">Track opening/closing balances and cash continuity</p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button variant="secondary" icon={Download} onClick={downloadCSV} disabled={reconciliationData.length === 0}>
            Download CSV
          </Button>
          <Button icon={FileSpreadsheet} onClick={downloadSheet} disabled={reconciliationData.length === 0}>
            Download sheet
          </Button>
        </div>
      </div>

      {/* Date Range Filter */}
      <div className="card p-4 space-y-3">
        <div className="segmented flex-wrap">
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

      {/* Reconciliation Table */}
      <div className="table-shell">
        <table className="table-modern w-full">
          <thead>
            <tr>
              <th>Date</th>
              <th className="text-right">Opening Balance</th>
              <th className="text-right">Income</th>
              <th className="text-right">Closing Balance</th>
              <th className="text-center">Status</th>
              <th className="text-right">Variance</th>
            </tr>
          </thead>
          <tbody>
            {reconciliationData.length === 0 ? (
              <tr>
                <td colSpan="6" className="p-0">
                  <EmptyState title="No reconciliation data available" message="Try a different date range." />
                </td>
              </tr>
            ) : (
              reconciliationData.map((row) => (
                <tr key={row.date}>
                  <td className="font-medium text-ink">{row.date}</td>
                  <td className="text-right tabular text-ink">
                    ৳ {row.openingBalance.toLocaleString()}
                  </td>
                  <td className="text-right tabular text-success">
                    ৳ {row.income.toLocaleString()}
                  </td>
                  <td className="text-right tabular font-semibold text-ink">
                    ৳ {row.closingBalance.toLocaleString()}
                  </td>
                  <td className="text-center">
                    {row.isReconciled ? (
                      <span className="badge-success"><CheckCircle2 size={12} /> OK</span>
                    ) : (
                      <span className="badge-danger"><AlertTriangle size={12} /> Mismatch</span>
                    )}
                  </td>
                  <td className="text-right tabular text-ink">
                    {row.variance !== undefined && row.variance !== 0 ? (
                      <span className={row.variance > 0 ? 'text-success' : 'text-danger'}>
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
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div className="stat-card">
            <span className="stat-label">Total records</span>
            <span className="stat-value">{reconciliationData.length}</span>
          </div>
          <div className="stat-card">
            <span className="stat-label">Total income</span>
            <span className="stat-value text-success">
              ৳ {reconciliationData.reduce((s, r) => s + r.income, 0).toLocaleString()}
            </span>
          </div>
        </div>
      )}

      {/* Legend */}
      <div className="bg-primary-50 border border-primary/20 rounded-card p-4">
        <p className="flex items-center gap-1.5 text-sm font-semibold text-primary mb-2">
          <Info size={14} /> Legend
        </p>
        <div className="grid md:grid-cols-2 gap-3 text-xs text-primary">
          <div>
            <p className="flex items-center gap-1 font-medium"><CheckCircle2 size={12} /> OK</p>
            <p>Opening balance = previous day's closing (reconciled)</p>
          </div>
          <div>
            <p className="flex items-center gap-1 font-medium"><AlertTriangle size={12} /> Mismatch</p>
            <p>Opening balance ≠ previous day's closing (check for adjustments)</p>
          </div>
        </div>
      </div>
    </div>
  );
}
