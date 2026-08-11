import React, { useState, useEffect } from 'react';
import { ChevronDown, Download, FileText } from 'lucide-react';
import { apiRequest } from '../api.js';
import LoadingSpinner from './LoadingSpinner.jsx';
import Toast from './Toast.jsx';

const formatCurrency = (value) => {
  if (!value && value !== 0) return '৳0';
  return `৳${Number(value).toLocaleString('en-IN')}`;
};

// Local date string (avoids UTC timezone shift from toISOString)
const toLocalDateStr = (d) => {
  const year = d.getFullYear();
  const month = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
};

const CollapsibleSection = ({ title, defaultOpen = true, children }) => {
  const [open, setOpen] = useState(defaultOpen);
  return (
    <div className="card overflow-hidden mb-4">
      <button
        onClick={() => setOpen(!open)}
        className="w-full flex items-center justify-between p-4 text-left hover:bg-canvas transition"
      >
        <h2 className="section-title">{title}</h2>
        <ChevronDown size={16} className={`text-ink-faint transition-transform ${open ? 'rotate-180' : ''}`} />
      </button>
      {open && <div className="px-4 pb-4">{children}</div>}
    </div>
  );
};

export default function AccountingReports({ token }) {
  const [loading, setLoading] = useState(true);
  const [toast, setToast] = useState(null);
  const [period, setPeriod] = useState('month');
  const [company, setCompany] = useState(null);

  // P&L data
  const [incomeByCategory, setIncomeByCategory] = useState({});
  const [totalIncome, setTotalIncome] = useState(0);
  const [expenseByCategory, setExpenseByCategory] = useState([]);
  const [totalExpenses, setTotalExpenses] = useState(0);

  const getDateRange = () => {
    const now = new Date();
    let startDate, endDate;

    if (period === 'today') {
      startDate = new Date(now);
      startDate.setHours(0, 0, 0, 0);
      endDate = new Date(now);
      endDate.setHours(23, 59, 59, 999);
    } else if (period === 'week') {
      endDate = new Date(now);
      endDate.setHours(23, 59, 59, 999);
      startDate = new Date(now);
      startDate.setDate(startDate.getDate() - startDate.getDay());
      startDate.setHours(0, 0, 0, 0);
    } else if (period === 'month') {
      startDate = new Date(now.getFullYear(), now.getMonth(), 1);
      endDate = new Date(now.getFullYear(), now.getMonth() + 1, 0, 23, 59, 59, 999);
    } else if (period === 'year') {
      startDate = new Date(now.getFullYear(), 0, 1);
      endDate = new Date(now.getFullYear(), 11, 31, 23, 59, 59, 999);
    } else {
      startDate = new Date(now.getFullYear(), now.getMonth(), 1);
      endDate = new Date(now);
    }

    return {
      startDate: toLocalDateStr(startDate),
      endDate: toLocalDateStr(endDate),
    };
  };

  const fetchReports = async () => {
    try {
      setLoading(true);
      const { startDate, endDate } = getDateRange();

      // Fetch company info
      const companyRes = await apiRequest('/auth/me', { token }).catch(() => ({}));
      if (companyRes?.company) setCompany(companyRes.company);

      // Fetch income report
      const incomeRes = await apiRequest(
        `/reports/income?range=custom&startDate=${startDate}&endDate=${endDate}`,
        { token }
      ).catch(() => ({}));

      const categories = {};
      if (incomeRes?.entryIncome) categories['Daily Entry'] = incomeRes.entryIncome;
      if (incomeRes?.trainingIncome) categories['Training'] = incomeRes.trainingIncome;
      if (incomeRes?.membershipIncome) categories['Membership'] = incomeRes.membershipIncome;
      if (incomeRes?.beveragesIncome) categories['Beverage'] = incomeRes.beveragesIncome;
      if (incomeRes?.hourlySessionIncome) categories['Hourly Session'] = incomeRes.hourlySessionIncome;
      if (incomeRes?.lockerIncome) categories['Locker'] = incomeRes.lockerIncome;
      if (incomeRes?.dressRentalIncome) categories['Dress Rental'] = incomeRes.dressRentalIncome;

      setIncomeByCategory(categories);
      setTotalIncome(incomeRes?.totalIncome || 0);

      // Fetch expense summary
      const expenseRes = await apiRequest(
        `/daily-expenses/summary?startDate=${startDate}&endDate=${endDate}`,
        { token }
      ).catch(() => ({}));

      const expCats = expenseRes?.categories || [];
      setExpenseByCategory(expCats);
      setTotalExpenses(expCats.reduce((sum, c) => sum + (c.total || 0), 0));

    } catch (error) {
      console.error('Error loading reports:', error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (token) fetchReports();
  }, [token, period]);

  const netProfit = totalIncome - totalExpenses;

  const PIE_COLORS = ['#3B82F6', '#EF4444', '#22C55E', '#F59E0B', '#8B5CF6', '#EC4899', '#06B6D4', '#F97316'];

  return (
    <div className="space-y-4">
      {toast && <Toast message={toast.message} type={toast.type} onClose={() => setToast(null)} />}

      {/* Period Selector + Export */}
      <div className="flex items-center gap-2 flex-wrap">
        <div className="segmented">
          {[
            { label: 'Today', value: 'today' },
            { label: 'This Week', value: 'week' },
            { label: 'This Month', value: 'month' },
            { label: 'This Year', value: 'year' },
          ].map((p) => (
            <button
              key={p.value}
              onClick={() => setPeriod(p.value)}
              className={period === p.value ? 'segmented-item-active' : 'segmented-item'}
            >
              {p.label}
            </button>
          ))}
        </div>
        <div className="flex gap-2 ml-auto">
          <button
            onClick={() => {
              // Build CSV content
              const lines = ['Period,' + period];
              lines.push('');
              lines.push('Profit & Loss Summary');
              lines.push('Income,' + formatCurrency(totalIncome));
              Object.entries(incomeByCategory).filter(([, v]) => v > 0).forEach(([cat, amt]) => {
                lines.push('  ' + cat + ',' + formatCurrency(amt));
              });
              lines.push('Expenses,' + formatCurrency(totalExpenses));
              expenseByCategory.forEach(c => {
                lines.push('  ' + c.name + ',' + formatCurrency(c.total));
              });
              lines.push('Net Profit,' + formatCurrency(netProfit));
              lines.push('');
              lines.push('Expense Breakdown');
              expenseByCategory.forEach(c => {
                const pct = totalExpenses > 0 ? ((c.total / totalExpenses) * 100).toFixed(1) : 0;
                lines.push(c.name + ',' + formatCurrency(c.total) + ',' + pct + '%');
              });
              const bom = '\uFEFF';
              const blob = new Blob([bom + lines.join('\n')], { type: 'text/csv;charset=utf-8;' });
              const url = URL.createObjectURL(blob);
              const a = document.createElement('a');
              a.href = url; a.download = 'expense-report.csv'; a.click();
              URL.revokeObjectURL(url);
            }}
            className="btn-secondary btn-sm"
          >
            <Download size={13} />
            Download CSV
          </button>
          <button
            onClick={async () => {
              const { jsPDF } = await import('jspdf');
              const doc = new jsPDF({ unit: 'mm', format: 'a4' });
              const w = doc.internal.pageSize.getWidth();
              let y = 0;

              // ===== BLUE HEADER BAR =====
              doc.setFillColor(55, 93, 251); // primary blue
              doc.rect(0, 0, w, 38, 'F');

              // Company name
              doc.setFontSize(18);
              doc.setFont('helvetica', 'bold');
              doc.setTextColor(255, 255, 255);
              doc.text(company?.name || 'Company', 14, 14);

              // Address (second line)
              if (company?.address) {
                doc.setFontSize(8);
                doc.setFont('helvetica', 'normal');
                doc.text(company.address, 14, 22);
              }

              // Phone + Email (third line)
              const contactParts = [company?.phone, company?.email].filter(Boolean);
              if (contactParts.length > 0) {
                doc.setFontSize(8);
                doc.setFont('helvetica', 'normal');
                doc.text(contactParts.join('  |  '), 14, 29);
              }

              y = 46;

              // ===== REPORT TITLE =====
              doc.setFontSize(16);
              doc.setFont('helvetica', 'bold');
              doc.setTextColor(30, 30, 30);
              doc.text('Expense Report', 14, y); y += 8;

              // Period + Date
              doc.setFontSize(9);
              doc.setFont('helvetica', 'normal');
              doc.setTextColor(100, 100, 100);
              const periodLabel = period.charAt(0).toUpperCase() + period.slice(1);
              doc.text(`Period: ${periodLabel}`, 14, y);
              doc.text(`Generated: ${new Date().toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' })}`, w - 14, y, { align: 'right' });
              y += 4;

              // Separator
              doc.setDrawColor(220, 220, 220);
              doc.line(14, y, w - 14, y); y += 8;

              // ===== INCOME SECTION =====
              doc.setFontSize(12);
              doc.setFont('helvetica', 'bold');
              doc.setTextColor(22, 163, 74);
              doc.text('Income', 14, y);
              doc.text(`BDT ${totalIncome.toLocaleString('en-IN')}`, w - 14, y, { align: 'right' });
              y += 7;

              doc.setFontSize(9);
              doc.setFont('helvetica', 'normal');
              doc.setTextColor(60, 60, 60);
              Object.entries(incomeByCategory).filter(([, v]) => v > 0).forEach(([cat, amt]) => {
                doc.text(`  ${cat}`, 20, y);
                doc.text(`BDT ${amt.toLocaleString('en-IN')}`, w - 14, y, { align: 'right' });
                y += 5;
              });
              y += 4;

              // ===== EXPENSES SECTION =====
              doc.setFontSize(12);
              doc.setFont('helvetica', 'bold');
              doc.setTextColor(220, 38, 38);
              doc.text('Expenses', 14, y);
              doc.text(`BDT ${totalExpenses.toLocaleString('en-IN')}`, w - 14, y, { align: 'right' });
              y += 7;

              doc.setFontSize(9);
              doc.setFont('helvetica', 'normal');
              doc.setTextColor(60, 60, 60);
              expenseByCategory.forEach(c => {
                doc.text(`  ${c.name}`, 20, y);
                doc.text(`BDT ${c.total.toLocaleString('en-IN')}`, w - 14, y, { align: 'right' });
                y += 5;
              });
              y += 4;

              // ===== NET PROFIT =====
              doc.setDrawColor(180, 180, 180);
              doc.line(14, y, w - 14, y); y += 7;
              doc.setFontSize(12);
              doc.setFont('helvetica', 'bold');
              doc.setTextColor(30, 30, 30);
              doc.text('Net Profit', 14, y);
              doc.setTextColor(netProfit >= 0 ? 22 : 220, netProfit >= 0 ? 163 : 38, netProfit >= 0 ? 74 : 38);
              doc.text(`BDT ${netProfit.toLocaleString('en-IN')}`, w - 14, y, { align: 'right' });
              y += 12;

              // ===== EXPENSE BREAKDOWN =====
              if (expenseByCategory.length > 0) {
                doc.setFontSize(11);
                doc.setFont('helvetica', 'bold');
                doc.setTextColor(30, 30, 30);
                doc.text('Expense Breakdown', 14, y); y += 7;

                doc.setFontSize(9);
                doc.setFont('helvetica', 'normal');
                doc.setTextColor(60, 60, 60);
                expenseByCategory.forEach(c => {
                  const pct = totalExpenses > 0 ? ((c.total / totalExpenses) * 100).toFixed(1) : 0;
                  doc.text(`${c.name} (${pct}%)`, 20, y);
                  doc.text(`BDT ${c.total.toLocaleString('en-IN')}`, w - 14, y, { align: 'right' });
                  y += 5;
                });
              }

              // ===== FOOTER =====
              y = doc.internal.pageSize.getHeight() - 15;
              doc.setDrawColor(220, 220, 220);
              doc.line(14, y, w - 14, y); y += 5;
              doc.setFontSize(7);
              doc.setFont('helvetica', 'normal');
              doc.setTextColor(150, 150, 150);
              doc.text(`Generated by ${company?.name || 'Accounting'} System`, 14, y);

              doc.save('expense-report.pdf');
            }}
            className="btn-secondary btn-sm"
          >
            <FileText size={13} />
            Download PDF
          </button>
        </div>
      </div>

      {loading ? (
        <LoadingSpinner />
      ) : (
        <>
          {/* Monthly P&L */}
          <CollapsibleSection title="Profit & Loss Summary">
            <div className="space-y-4">
              {/* Income */}
              <div>
                <div className="flex items-center justify-between mb-2">
                  <h3 className="text-sm font-semibold text-success-ink">Income</h3>
                  <span className="text-sm font-bold text-success-ink">{formatCurrency(totalIncome)}</span>
                </div>
                {Object.entries(incomeByCategory).filter(([, v]) => v > 0).map(([cat, amount]) => (
                  <div key={cat} className="flex items-center justify-between py-1 pl-4 border-b border-line last:border-0">
                    <span className="text-sm text-ink-soft">{cat}</span>
                    <span className="text-sm text-ink">{formatCurrency(amount)}</span>
                  </div>
                ))}
                {Object.keys(incomeByCategory).length === 0 && (
                  <p className="text-sm text-ink-faint pl-4">No income recorded</p>
                )}
              </div>

              {/* Expenses */}
              <div>
                <div className="flex items-center justify-between mb-2">
                  <h3 className="text-sm font-semibold text-danger-ink">Expenses</h3>
                  <span className="text-sm font-bold text-danger-ink">{formatCurrency(totalExpenses)}</span>
                </div>
                {expenseByCategory.map((cat) => (
                  <div key={cat.name} className="flex items-center justify-between py-1 pl-4 border-b border-line last:border-0">
                    <span className="text-sm text-ink-soft">{cat.name}</span>
                    <span className="text-sm text-ink">{formatCurrency(cat.total)}</span>
                  </div>
                ))}
                {expenseByCategory.length === 0 && (
                  <p className="text-sm text-ink-faint pl-4">No expenses recorded</p>
                )}
              </div>

              {/* Net Profit */}
              <div className="border-t-2 border-line-strong pt-3">
                <div className="flex items-center justify-between">
                  <span className="text-sm font-bold text-ink">Net Profit</span>
                  <span className={`text-lg font-bold ${netProfit >= 0 ? 'text-success' : 'text-danger'}`}>
                    {formatCurrency(netProfit)}
                  </span>
                </div>
              </div>
            </div>
          </CollapsibleSection>

          {/* Expense Breakdown */}
          {expenseByCategory.length > 0 && (
            <CollapsibleSection title="Expense Breakdown">
              <div className="flex flex-col md:flex-row gap-6 items-center">
                {/* Pie Chart */}
                <div className="relative">
                  <div
                    className="w-40 h-40 rounded-full"
                    style={{
                      background: `conic-gradient(${expenseByCategory
                        .map((c, i) => {
                          const pct = totalExpenses > 0 ? (c.total / totalExpenses) * 100 : 0;
                          const start = expenseByCategory.slice(0, i).reduce((s, x) => s + (totalExpenses > 0 ? (x.total / totalExpenses) * 100 : 0), 0);
                          return `${PIE_COLORS[i % PIE_COLORS.length]} ${start}% ${start + pct}%`;
                        })
                        .join(', ') || 'gray 0% 100%'})`,
                    }}
                  />
                  <div className="absolute inset-0 flex items-center justify-center">
                    <div className="w-16 h-16 bg-white rounded-full flex items-center justify-center">
                      <span className="text-xs font-bold text-ink">{expenseByCategory.length}</span>
                    </div>
                  </div>
                </div>

                {/* Legend */}
                <div className="flex-1 space-y-2">
                  {expenseByCategory.map((cat, i) => {
                    const pct = totalExpenses > 0 ? ((cat.total / totalExpenses) * 100).toFixed(1) : 0;
                    return (
                      <div key={cat.name} className="flex items-center gap-2">
                        <div
                          className="w-3 h-3 rounded-full flex-shrink-0"
                          style={{ backgroundColor: PIE_COLORS[i % PIE_COLORS.length] }}
                        />
                        <span className="text-sm text-ink flex-1">{cat.name}</span>
                        <span className="text-sm text-ink-soft">{pct}%</span>
                        <span className="text-sm font-medium text-ink">{formatCurrency(cat.total)}</span>
                      </div>
                    );
                  })}
                </div>
              </div>
            </CollapsibleSection>
          )}
        </>
      )}
    </div>
  );
}
