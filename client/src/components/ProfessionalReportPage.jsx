import React, { useState, useEffect } from 'react';
import { apiRequest } from '../api.js';
import { downloadProfessionalReportPdf, downloadProfessionalReportSheet } from '../utils/reportExports.js';
import LoadingSpinner from './LoadingSpinner.jsx';
import Toast from './Toast.jsx';

const formatCurrency = (value) => {
  if (!value) return 'BDT 0.00';
  return `BDT ${Number(value).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
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
    <div className="flex-1 overflow-y-auto bg-gray-50 p-6">
      <div className="max-w-7xl mx-auto">
        {/* Header */}
        <div className="mb-6">
          <h1 className="text-3xl font-bold text-gray-900">Professional Business Report</h1>
          <p className="text-gray-600 mt-1">Daily breakdown with opening/closing balances, income by category, and expenses</p>
        </div>

        {/* Date Filter Section */}
        <div className="bg-white rounded-lg shadow p-6 mb-6">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {/* Date Presets */}
            <div>
              <label className="block text-sm font-semibold text-gray-700 mb-3">Quick Select</label>
              <div className="flex flex-wrap gap-2">
                {[
                  { label: 'Today', value: 'today' },
                  { label: 'This Week', value: 'week' },
                  { label: 'This Month', value: 'month' },
                  { label: 'This Year', value: 'year' },
                ].map((preset) => (
                  <button
                    key={preset.value}
                    onClick={() => handlePresetClick(preset.value)}
                    className={`px-4 py-2 rounded-lg font-medium transition ${
                      datePreset === preset.value
                        ? 'bg-primary text-white'
                        : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                    }`}
                  >
                    {preset.label}
                  </button>
                ))}
              </div>
            </div>

            {/* Custom Date Range */}
            <div>
              <label className="block text-sm font-semibold text-gray-700 mb-3">Custom Range</label>
              <div className="flex flex-col sm:flex-row gap-3 items-end">
                <div className="flex-1">
                  <label className="block text-xs text-gray-600 mb-1">Start Date</label>
                  <input
                    type="date"
                    value={startDate}
                    onChange={(e) => setStartDate(e.target.value)}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm"
                  />
                </div>
                <div className="flex-1">
                  <label className="block text-xs text-gray-600 mb-1">End Date</label>
                  <input
                    type="date"
                    value={endDate}
                    onChange={(e) => setEndDate(e.target.value)}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm"
                  />
                </div>
                <button
                  onClick={handleFetchReport}
                  disabled={loading}
                  className="px-6 py-2 bg-primary text-white rounded-lg font-medium hover:bg-primary/90 disabled:bg-gray-400 transition"
                >
                  {loading ? 'Loading...' : 'Generate'}
                </button>
              </div>
            </div>
          </div>
        </div>

        {/* Download Buttons */}
        {report && (
          <div className="bg-white rounded-lg shadow p-4 mb-6 flex flex-col sm:flex-row gap-3">
            <button
              onClick={handleDownloadPdf}
              className="flex items-center justify-center gap-2 px-4 py-2 bg-red-600 text-white rounded-lg font-medium hover:bg-red-700 transition min-h-[44px]"
            >
              📥 Download PDF
            </button>
            <button
              onClick={handleDownloadSheet}
              className="flex items-center justify-center gap-2 px-4 py-2 bg-green-600 text-white rounded-lg font-medium hover:bg-green-700 transition min-h-[44px]"
            >
              📊 Download Google Sheet
            </button>
          </div>
        )}

        {/* Report Table */}
        {loading ? (
          <LoadingSpinner />
        ) : report && report.dailyData.length > 0 ? (
          <div className="bg-white rounded-lg shadow overflow-hidden">
            {/* Mobile card view */}
            <div className="md:hidden p-4 space-y-3">
              {report.dailyData.map((day, idx) => (
                <div key={idx} className="border border-gray-200 rounded-lg p-3 space-y-2">
                  <div className="flex items-center justify-between">
                    <span className="font-semibold text-gray-900">{formatDate(day.date)}</span>
                    <span className={`font-semibold px-2 py-1 rounded text-sm ${day.closingBalance >= 0 ? 'bg-green-100 text-green-900' : 'bg-red-100 text-red-900'}`}>{formatCurrency(day.closingBalance)}</span>
                  </div>
                  <div className="grid grid-cols-2 gap-2 text-xs">
                    <div><span className="text-gray-500">Opening</span><p className="font-medium">{formatCurrency(day.openingBalance)}</p></div>
                    <div><span className="text-gray-500">Total Income</span><p className="font-semibold text-primary">{formatCurrency(day.transactions.totalIncome)}</p></div>
                    <div><span className="text-gray-500">Bill</span><p>{formatCurrency(day.transactions.Bill)}</p></div>
                    <div><span className="text-gray-500">Training</span><p>{formatCurrency(day.transactions.Training)}</p></div>
                    <div><span className="text-gray-500">Membership</span><p>{formatCurrency(day.transactions.Membership)}</p></div>
                    <div><span className="text-gray-500">Beverage</span><p>{formatCurrency(day.transactions.Beverage)}</p></div>
                    <div><span className="text-gray-500">Hourly</span><p>{formatCurrency(day.transactions['Hourly Session'])}</p></div>
                    <div><span className="text-gray-500">Cash</span><p>{formatCurrency(day.paymentMethods.Cash)}</p></div>
                    <div><span className="text-gray-500">Bank</span><p>{formatCurrency(day.paymentMethods.Bank)}</p></div>
                    <div><span className="text-gray-500">bKash</span><p>{formatCurrency(day.paymentMethods.bKash)}</p></div>
                  </div>
                </div>
              ))}
              {/* Mobile totals */}
              <div className="bg-gray-800 text-white rounded-lg p-3 text-xs font-semibold space-y-1">
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
                    <th className="px-4 py-3 text-right font-semibold bg-green-600">Closing</th>
                  </tr>
                </thead>
                <tbody>
                  {report.dailyData.map((day, idx) => (
                    <tr
                      key={idx}
                      className={`border-b ${idx % 2 === 0 ? 'bg-white' : 'bg-gray-50'} hover:bg-primary/5 transition`}
                    >
                      <td className="px-4 py-3 font-medium text-gray-900">{formatDate(day.date)}</td>
                      <td className="px-4 py-3 text-right text-gray-700">{formatCurrency(day.openingBalance)}</td>
                      
                      {/* Income Categories */}
                      <td className="px-4 py-3 text-right text-gray-700">{formatCurrency(day.transactions.Bill)}</td>
                      <td className="px-4 py-3 text-right text-gray-700">{formatCurrency(day.transactions.Training)}</td>
                      <td className="px-4 py-3 text-right text-gray-700">{formatCurrency(day.transactions.Membership)}</td>
                      <td className="px-4 py-3 text-right text-gray-700">{formatCurrency(day.transactions.Beverage)}</td>
                      <td className="px-4 py-3 text-right text-gray-700">{formatCurrency(day.transactions['Hourly Session'])}</td>
                      <td className="px-4 py-3 text-right font-semibold bg-primary/10 text-primary">{formatCurrency(day.transactions.totalIncome)}</td>

                      {/* Payment Methods */}
                      <td className="px-4 py-3 text-right text-gray-700">{formatCurrency(day.paymentMethods.Cash)}</td>
                      <td className="px-4 py-3 text-right text-gray-700">{formatCurrency(day.paymentMethods.Bank)}</td>
                      <td className="px-4 py-3 text-right text-gray-700">{formatCurrency(day.paymentMethods.bKash)}</td>

                      {/* Closing Balance */}
                      <td className={`px-4 py-3 text-right font-semibold ${
                        day.closingBalance >= 0
                          ? 'bg-green-100 text-green-900'
                          : 'bg-red-100 text-red-900'
                      }`}>
                        {formatCurrency(day.closingBalance)}
                      </td>
                    </tr>
                  ))}
                  
                  {/* Summary Row */}
                  <tr className="bg-gray-800 text-white font-bold text-sm">
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

                    <td className="px-4 py-4 text-right bg-green-600">{formatCurrency(report.totals.closingBalance)}</td>
                  </tr>
                </tbody>
              </table>
            </div>
          </div>
        ) : (
          <div className="bg-white rounded-lg shadow p-12 text-center">
            <div className="text-6xl mb-4">📊</div>
            <p className="text-gray-600 text-lg font-medium">No data available for the selected period</p>
            <p className="text-gray-500 mt-2">Try selecting a different date range</p>
          </div>
        )}
      </div>

      {/* Toast Notifications */}
      {toast && <Toast message={toast.message} type={toast.type} />}
    </div>
  );
};

export default ProfessionalReportPage;
