import React, { useState, useEffect } from 'react';
import { FileText, FileSpreadsheet, BarChart3 } from 'lucide-react';
import { apiRequest } from '../api.js';
import { downloadProfessionalReportPdf, downloadProfessionalReportSheet } from '../utils/reportExports.js';
import LoadingSpinner from './LoadingSpinner.jsx';
import Toast from './Toast.jsx';
import Button from './Button.jsx';
import EmptyState from './EmptyState.jsx';

const formatCurrency = (value) => {
  if (!value) return '৳0.00';
  return `৳${Number(value).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
};

const formatDate = (dateString) => {
  return new Intl.DateTimeFormat('en-GB', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
  }).format(new Date(`${dateString}T00:00:00`));
};

const getDateRange = (preset) => {
  const now = new Date();
  const today = new Date(now);
  today.setHours(0, 0, 0, 0);

  if (preset === 'today') {
    return { startDate: today.toISOString().split('T')[0], endDate: today.toISOString().split('T')[0] };
  }
  if (preset === 'week') {
    const weekStart = new Date(today);
    weekStart.setDate(today.getDate() - today.getDay());
    return { startDate: weekStart.toISOString().split('T')[0], endDate: today.toISOString().split('T')[0] };
  }
  if (preset === 'month') {
    const monthStart = new Date(today.getFullYear(), today.getMonth(), 1);
    return { startDate: monthStart.toISOString().split('T')[0], endDate: today.toISOString().split('T')[0] };
  }
  if (preset === 'year') {
    const yearStart = new Date(today.getFullYear(), 0, 1);
    return { startDate: yearStart.toISOString().split('T')[0], endDate: today.toISOString().split('T')[0] };
  }
  return {};
};

const ProfessionalReportPage = ({ token }) => {
  const [loading, setLoading] = useState(false);
  const [report, setReport] = useState(null);
  const [toast, setToast] = useState(null);
  const [startDate, setStartDate] = useState(new Date().toISOString().split('T')[0]);
  const [endDate, setEndDate] = useState(new Date().toISOString().split('T')[0]);
  const [datePreset, setDatePreset] = useState('today');

  const showToast = (message, type = 'success') => {
    setToast({ message, type });
    setTimeout(() => setToast(null), 3000);
  };

  const handlePresetClick = (preset) => {
    setDatePreset(preset);
    const range = getDateRange(preset);
    setStartDate(range.startDate);
    setEndDate(range.endDate);
  };

  const handleFetchReport = async () => {
    if (!token) {
      showToast('Please sign in again to load reports', 'error');
      return;
    }

    setLoading(true);
    try {
      const response = await apiRequest(
        `/reports/professional?startDate=${startDate}&endDate=${endDate}&range=custom`,
        { method: 'GET', token }
      );
      setReport(response);
      showToast(`Report loaded: ${response.dailyData.length} days`);
    } catch (error) {
      showToast(error?.message || 'Failed to load report', 'error');
    } finally {
      setLoading(false);
    }
  };

  const handleDownloadPdf = async () => {
    try {
      await downloadProfessionalReportPdf({
        report,
        startDate,
        endDate,
      });
      showToast('PDF downloaded successfully');
    } catch (error) {
      showToast(error?.message || 'Failed to generate PDF', 'error');
    }
  };

  const handleDownloadSheet = async () => {
    try {
      downloadProfessionalReportSheet({
        report,
        startDate,
        endDate,
      });
      showToast('Google Sheet downloaded successfully');
    } catch (error) {
      showToast(error?.message || 'Failed to generate Sheet', 'error');
    }
  };

  useEffect(() => {
    if (token) {
      handleFetchReport();
    }
  }, [token]);

  return (
    <div className="space-y-6">
      <div className="max-w-7xl mx-auto space-y-6">
        {/* Date Filter Section */}
        <div className="card p-6">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {/* Date Presets */}
            <div>
              <label className="label">Quick select</label>
              <div className="segmented flex-wrap">
                {[
                  { label: 'Today', value: 'today' },
                  { label: 'This Week', value: 'week' },
                  { label: 'This Month', value: 'month' },
                  { label: 'This Year', value: 'year' },
                ].map((preset) => (
                  <button
                    key={preset.value}
                    onClick={() => handlePresetClick(preset.value)}
                    className={datePreset === preset.value ? 'segmented-item-active' : 'segmented-item'}
                  >
                    {preset.label}
                  </button>
                ))}
              </div>
            </div>

            {/* Custom Date Range */}
            <div>
              <label className="label">Custom range</label>
              <div className="flex flex-col sm:flex-row gap-3 items-end">
                <div className="flex-1">
                  <label className="text-xs text-ink-soft mb-1 block">Start date</label>
                  <input
                    type="date"
                    value={startDate}
                    onChange={(e) => setStartDate(e.target.value)}
                    className="input"
                  />
                </div>
                <div className="flex-1">
                  <label className="text-xs text-ink-soft mb-1 block">End date</label>
                  <input
                    type="date"
                    value={endDate}
                    onChange={(e) => setEndDate(e.target.value)}
                    className="input"
                  />
                </div>
                <Button onClick={handleFetchReport} loading={loading} className="w-full sm:w-auto">
                  Generate
                </Button>
              </div>
            </div>
          </div>
        </div>

        {/* Download Buttons */}
        {report && (
          <div className="card p-4 flex flex-col sm:flex-row gap-3">
            <Button variant="danger" icon={FileText} onClick={handleDownloadPdf}>Download PDF</Button>
            <Button variant="primary" className="!bg-success hover:!bg-success/90" icon={FileSpreadsheet} onClick={handleDownloadSheet}>
              Download Google Sheet
            </Button>
          </div>
        )}

        {/* Report Table */}
        {loading ? (
          <LoadingSpinner />
        ) : report && report.dailyData.length > 0 ? (
          <div className="card overflow-hidden">
            {/* Mobile card view */}
            <div className="md:hidden p-4 space-y-3">
              {report.dailyData.map((day, idx) => (
                <div key={idx} className="border border-line rounded-lg p-3 space-y-2">
                  <div className="flex items-center justify-between">
                    <span className="font-semibold text-ink">{formatDate(day.date)}</span>
                    <span className={`font-semibold px-2 py-1 rounded text-sm ${day.closingBalance >= 0 ? 'bg-success-soft text-success-ink' : 'bg-danger-soft text-danger-ink'}`}>{formatCurrency(day.closingBalance)}</span>
                  </div>
                  <div className="grid grid-cols-2 gap-2 text-xs">
                    <div><span className="text-ink-soft">Opening</span><p className="font-medium">{formatCurrency(day.openingBalance)}</p></div>
                    <div><span className="text-ink-soft">Total Income</span><p className="font-semibold text-primary">{formatCurrency(day.transactions.totalIncome)}</p></div>
                    <div><span className="text-ink-soft">Bill</span><p>{formatCurrency(day.transactions.Bill)}</p></div>
                    <div><span className="text-ink-soft">Training</span><p>{formatCurrency(day.transactions.Training)}</p></div>
                    <div><span className="text-ink-soft">Membership</span><p>{formatCurrency(day.transactions.Membership)}</p></div>
                    <div><span className="text-ink-soft">Beverage</span><p>{formatCurrency(day.transactions.Beverage)}</p></div>
                    <div><span className="text-ink-soft">Hourly</span><p>{formatCurrency(day.transactions['Hourly Session'])}</p></div>
                    <div><span className="text-ink-soft">Cash</span><p>{formatCurrency(day.paymentMethods.Cash)}</p></div>
                    <div><span className="text-ink-soft">Bank</span><p>{formatCurrency(day.paymentMethods.Bank)}</p></div>
                    <div><span className="text-ink-soft">bKash</span><p>{formatCurrency(day.paymentMethods.bKash)}</p></div>
                  </div>
                </div>
              ))}
              {/* Mobile totals */}
              <div className="bg-ink text-white rounded-lg p-3 text-xs font-semibold space-y-1">
                <div className="flex justify-between"><span>TOTAL</span><span>{formatCurrency(report.totals.totalIncome)}</span></div>
                <div className="flex justify-between"><span>Closing</span><span>{formatCurrency(report.totals.closingBalance)}</span></div>
              </div>
            </div>
            {/* Desktop table view */}
            <div className="hidden md:block overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="bg-primary text-white sticky top-0">
                  <tr>
                    <th className="px-4 py-3 text-left font-semibold">Date</th>
                    <th className="px-4 py-3 text-right font-semibold">Opening</th>
                    {/* Income by Category */}
                    <th className="px-4 py-3 text-right font-semibold">Bill</th>
                    <th className="px-4 py-3 text-right font-semibold">Training</th>
                    <th className="px-4 py-3 text-right font-semibold">Member</th>
                    <th className="px-4 py-3 text-right font-semibold">Beverage</th>
                    <th className="px-4 py-3 text-right font-semibold">Hourly</th>
                    <th className="px-4 py-3 text-right font-semibold bg-primary/90">Total Income</th>
                    {/* Payment Methods */}
                    <th className="px-4 py-3 text-right font-semibold">Cash</th>
                    <th className="px-4 py-3 text-right font-semibold">Bank</th>
                    <th className="px-4 py-3 text-right font-semibold">bKash</th>
                    <th className="px-4 py-3 text-right font-semibold bg-success">Closing</th>
                  </tr>
                </thead>
                <tbody>
                  {report.dailyData.map((day, idx) => (
                    <tr
                      key={idx}
                      className={`border-b ${idx % 2 === 0 ? 'bg-white' : 'bg-canvas'} hover:bg-primary/5 transition`}
                    >
                      <td className="px-4 py-3 font-medium text-ink">{formatDate(day.date)}</td>
                      <td className="px-4 py-3 text-right text-ink">{formatCurrency(day.openingBalance)}</td>
                      
                      {/* Income Categories */}
                      <td className="px-4 py-3 text-right text-ink">{formatCurrency(day.transactions.Bill)}</td>
                      <td className="px-4 py-3 text-right text-ink">{formatCurrency(day.transactions.Training)}</td>
                      <td className="px-4 py-3 text-right text-ink">{formatCurrency(day.transactions.Membership)}</td>
                      <td className="px-4 py-3 text-right text-ink">{formatCurrency(day.transactions.Beverage)}</td>
                      <td className="px-4 py-3 text-right text-ink">{formatCurrency(day.transactions['Hourly Session'])}</td>
                      <td className="px-4 py-3 text-right font-semibold bg-primary/10 text-primary">{formatCurrency(day.transactions.totalIncome)}</td>

                      {/* Payment Methods */}
                      <td className="px-4 py-3 text-right text-ink">{formatCurrency(day.paymentMethods.Cash)}</td>
                      <td className="px-4 py-3 text-right text-ink">{formatCurrency(day.paymentMethods.Bank)}</td>
                      <td className="px-4 py-3 text-right text-ink">{formatCurrency(day.paymentMethods.bKash)}</td>

                      {/* Closing Balance */}
                      <td className={`px-4 py-3 text-right font-semibold ${
                        day.closingBalance >= 0
                          ? 'bg-success-soft text-success-ink'
                          : 'bg-danger-soft text-danger-ink'
                      }`}>
                        {formatCurrency(day.closingBalance)}
                      </td>
                    </tr>
                  ))}
                  
                  {/* Summary Row */}
                  <tr className="bg-ink text-white font-bold text-sm">
                    <td className="px-4 py-4">TOTAL</td>
                    <td className="px-4 py-4 text-right">{formatCurrency(report.totals.openingBalance)}</td>
                    
                    <td className="px-4 py-4 text-right">{formatCurrency(report.totals.billIncome)}</td>
                    <td className="px-4 py-4 text-right">{formatCurrency(report.totals.trainingIncome)}</td>
                    <td className="px-4 py-4 text-right">{formatCurrency(report.totals.membershipIncome)}</td>
                    <td className="px-4 py-4 text-right">{formatCurrency(report.totals.beverageIncome)}</td>
                    <td className="px-4 py-4 text-right">{formatCurrency(report.totals.hourlySessionIncome)}</td>
                    <td className="px-4 py-4 text-right bg-primary">{formatCurrency(report.totals.totalIncome)}</td>

                    <td className="px-4 py-4 text-right">{formatCurrency(report.totals.cashIncome)}</td>
                    <td className="px-4 py-4 text-right">{formatCurrency(report.totals.bankIncome)}</td>
                    <td className="px-4 py-4 text-right">{formatCurrency(report.totals.bkashIncome)}</td>

                    <td className="px-4 py-4 text-right bg-success">{formatCurrency(report.totals.closingBalance)}</td>
                  </tr>
                </tbody>
              </table>
            </div>
          </div>
        ) : (
          <div className="card">
            <EmptyState icon={BarChart3} title="No data available for the selected period" message="Try selecting a different date range." />
          </div>
        )}
      </div>

      {/* Toast Notifications */}
      {toast && <Toast message={toast.message} type={toast.type} />}
    </div>
  );
};

export default ProfessionalReportPage;
