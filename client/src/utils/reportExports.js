import * as XLSX from 'xlsx';

const loadPdfTools = async () => {
  const [{ jsPDF }, autoTableModule] = await Promise.all([
    import('jspdf'),
    import('jspdf-autotable'),
  ]);

  return {
    jsPDF,
    autoTable: autoTableModule.default || autoTableModule,
  };
};

const currency = (value) => `BDT ${Number(value || 0).toLocaleString('en-US', { maximumFractionDigits: 2 })}`;

const formatDateLabel = (value) => {
  if (!value) return 'N/A';

  return new Intl.DateTimeFormat('en-GB', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
  }).format(new Date(`${value}T00:00:00`));
};

const buildSummaryRows = ({ reportSummary, selectedDaySummary, selectedDayLabel, rangeLabel }) => ([
  ['Report', 'Daily Report'],
  ['Range', rangeLabel || 'Selected range'],
  ['Selected Day', selectedDayLabel || ''],
  ['Generated At', new Date().toLocaleString()],
  ['Period Total Income', currency(reportSummary?.totalIncome)],
  ['Period Net Cash', currency(reportSummary?.netCash)],
  ['Day Total Income', currency(selectedDaySummary?.totalIncome)],
  ['Day Billing', currency(selectedDaySummary?.billingAmount)],
  ['Day Training', currency(selectedDaySummary?.trainingAmount)],
  ['Day Membership', currency(selectedDaySummary?.membershipAmount)],
  ['Day Beverage', currency(selectedDaySummary?.beverageAmount)],
  ['Day Hourly Session', currency(selectedDaySummary?.hourlySessionAmount)],
  ['Day Cash', currency(selectedDaySummary?.cashAmount)],
  ['Day Bank', currency(selectedDaySummary?.bankAmount)],
  ['Day bKash', currency(selectedDaySummary?.bKashAmount)],
]);

const buildBreakdownRows = (selectedDayBreakdown) => {
  if (!selectedDayBreakdown) return [];

  const categoryRows = Object.entries(selectedDayBreakdown.categories || {}).map(([name, entry]) => ([
    'Category',
    name,
    entry?.count || 0,
    entry?.amount || 0,
  ]));

  const paymentRows = Object.entries(selectedDayBreakdown.paymentMethods || {}).map(([name, amount]) => ([
    'Payment',
    name,
    '',
    amount || 0,
  ]));

  return [...categoryRows, ...paymentRows];
};

const getPrimaryBreakdown = (selectedDayBreakdown) => {
  if (!selectedDayBreakdown) return [];

  return Object.entries(selectedDayBreakdown.categories || {})
    .map(([name, entry]) => ({
      name,
      count: Number(entry?.count || 0),
      amount: Number(entry?.amount || 0),
    }))
    .filter((entry) => entry.amount > 0)
    .sort((left, right) => right.amount - left.amount);
};

const getPaymentBreakdown = (selectedDayBreakdown) => {
  if (!selectedDayBreakdown) return [];

  return Object.entries(selectedDayBreakdown.paymentMethods || {})
    .map(([name, amount]) => ({
      name,
      amount: Number(amount || 0),
    }))
    .filter((entry) => entry.amount > 0)
    .sort((left, right) => right.amount - left.amount);
};

const getTopItem = (items) => items[0] || null;

const addMetricCards = (doc, cards, startY) => {
  const pageWidth = doc.internal.pageSize.getWidth();
  const left = 14;
  const gutter = 4;
  const cardWidth = (pageWidth - left * 2 - gutter * 2) / 3;
  const cardHeight = 22;

  cards.forEach((card, index) => {
    const x = left + index * (cardWidth + gutter);
    doc.setFillColor(card.fill[0], card.fill[1], card.fill[2]);
    doc.roundedRect(x, startY, cardWidth, cardHeight, 2, 2, 'F');
    doc.setTextColor(card.text[0], card.text[1], card.text[2]);
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(8.5);
    doc.text(card.title, x + 3, startY + 6);
    doc.setFontSize(11);
    doc.text(card.value, x + 3, startY + 15);
  });

  doc.setTextColor(0, 0, 0);
  return startY + cardHeight;
};

const addPdfHeader = (doc, { selectedDayLabel, rangeLabel }) => {
  const pageWidth = doc.internal.pageSize.getWidth();
  doc.setFillColor(14, 61, 124);
  doc.rect(0, 0, pageWidth, 28, 'F');

  doc.setTextColor(255, 255, 255);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(18);
  doc.text('Raya Pool Daily Report', 14, 11);
  doc.setFontSize(9);
  doc.setFont('helvetica', 'normal');
  doc.text(`Range: ${rangeLabel || 'Selected range'}`, 14, 18);
  doc.text(`Selected day: ${selectedDayLabel || 'N/A'}`, 14, 24);
  doc.setTextColor(0, 0, 0);
};

const addSectionTitle = (doc, title, y) => {
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(12);
  doc.setTextColor(14, 61, 124);
  doc.text(title, 14, y);
  doc.setTextColor(0, 0, 0);
  return y + 2;
};

export const downloadDailyReportSheet = ({ reportSummary, selectedDaySummary, selectedDayBreakdown, selectedDayLabel, rangeLabel }) => {
  const workbook = XLSX.utils.book_new();

  const summaryWorksheet = XLSX.utils.aoa_to_sheet([
    ...buildSummaryRows({ reportSummary, selectedDaySummary, selectedDayLabel, rangeLabel }),
  ]);
  XLSX.utils.book_append_sheet(workbook, summaryWorksheet, 'Summary');

  summaryWorksheet['!cols'] = [{ wch: 24 }, { wch: 28 }];

  const breakdownWorksheet = XLSX.utils.aoa_to_sheet([
    ['Type', 'Name', 'Count', 'Amount'],
    ...buildBreakdownRows(selectedDayBreakdown),
  ]);
  XLSX.utils.book_append_sheet(workbook, breakdownWorksheet, 'Day Breakdown');
  breakdownWorksheet['!cols'] = [{ wch: 14 }, { wch: 22 }, { wch: 10 }, { wch: 16 }];

  const fileDate = selectedDayBreakdown?.date || new Date().toISOString().split('T')[0];
  XLSX.writeFile(workbook, `daily-report-${fileDate}.xlsx`);
};

export const downloadDailyReportPdf = async ({ reportSummary, selectedDaySummary, selectedDayBreakdown, selectedDayLabel, rangeLabel }) => {
  const { jsPDF, autoTable } = await loadPdfTools();
  const doc = new jsPDF({ orientation: 'landscape', unit: 'mm', format: 'a4' });
  const fileDate = selectedDayBreakdown?.date || new Date().toISOString().split('T')[0];
  const primaryBreakdown = getPrimaryBreakdown(selectedDayBreakdown);
  const paymentBreakdown = getPaymentBreakdown(selectedDayBreakdown);
  const topCategory = getTopItem(primaryBreakdown);
  const topPayment = getTopItem(paymentBreakdown);

  addPdfHeader(doc, { selectedDayLabel, rangeLabel });

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(9);
  doc.setTextColor(71, 85, 105);
  doc.text('This report starts with the big picture, then breaks the selected day into categories and payment methods.', 14, 35);
  doc.text('Amounts are shown in BDT. Larger amounts appear first in each table.', 14, 40);

  const overviewCardsY = 46;
  addMetricCards(doc, [
    { title: 'Period Income', value: currency(reportSummary?.totalIncome), fill: [239, 246, 255], text: [30, 64, 175] },
    { title: 'Net Cash', value: currency(reportSummary?.netCash), fill: [240, 253, 244], text: [21, 128, 61] },
    { title: 'Selected Day', value: formatDateLabel(selectedDayBreakdown?.date), fill: [245, 243, 255], text: [91, 33, 182] },
  ], overviewCardsY);

  const secondRowY = overviewCardsY + 27;
  addMetricCards(doc, [
    { title: 'Billing', value: currency(selectedDaySummary?.billingAmount), fill: [254, 242, 242], text: [185, 28, 28] },
    { title: 'Training', value: currency(selectedDaySummary?.trainingAmount), fill: [240, 253, 250], text: [13, 148, 136] },
    { title: 'Membership', value: currency(selectedDaySummary?.membershipAmount), fill: [254, 252, 232], text: [161, 98, 7] },
    { title: 'Beverage', value: currency(selectedDaySummary?.beverageAmount), fill: [239, 246, 255], text: [29, 78, 216] },
  ], secondRowY);

  const summaryTableStartY = secondRowY + 31;
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(11);
  doc.setTextColor(14, 61, 124);
  doc.text('How to Read This Day', 14, summaryTableStartY);
  doc.setTextColor(0, 0, 0);

  const readingBody = [
    ['What happened most', topCategory ? `${topCategory.name} at ${currency(topCategory.amount)}` : 'No category activity'],
    ['Main payment method', topPayment ? `${topPayment.name} at ${currency(topPayment.amount)}` : 'No payment activity'],
    ['Report date', formatDateLabel(selectedDayBreakdown?.date)],
  ];

  autoTable(doc, {
    startY: summaryTableStartY + 2,
    head: [['Question', 'Answer']],
    body: readingBody,
    theme: 'grid',
    styles: { fontSize: 9, cellPadding: 3 },
    headStyles: { fillColor: [51, 65, 85], textColor: 255 },
    columnStyles: {
      0: { fontStyle: 'bold', cellWidth: 42 },
      1: { cellWidth: 180 },
    },
    margin: { left: 14, right: 14 },
  });

  const summaryTableEnd = doc.lastAutoTable?.finalY || summaryTableStartY;

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(11);
  doc.setTextColor(14, 61, 124);
  doc.text('Category Breakdown', 14, summaryTableEnd + 8);
  doc.setTextColor(0, 0, 0);

  autoTable(doc, {
    startY: summaryTableEnd + 10,
    head: [['Category', 'Count', 'Amount (BDT)', 'Share']],
    body: primaryBreakdown.map((entry) => [
      entry.name,
      String(entry.count),
      currency(entry.amount),
      `${selectedDaySummary?.totalIncome > 0 ? ((entry.amount / selectedDaySummary.totalIncome) * 100).toFixed(1) : '0.0'}%`,
    ]),
    theme: 'grid',
    styles: { fontSize: 9, cellPadding: 3, valign: 'middle' },
    headStyles: { fillColor: [14, 61, 124], textColor: 255, halign: 'center' },
    alternateRowStyles: { fillColor: [247, 249, 252] },
    columnStyles: {
      0: { cellWidth: 78, fontStyle: 'bold' },
      1: { halign: 'center', cellWidth: 22 },
      2: { halign: 'right', cellWidth: 40 },
      3: { halign: 'right', cellWidth: 24 },
    },
    margin: { left: 14, right: 14 },
  });

  const breakdownTableEnd = doc.lastAutoTable?.finalY || summaryTableEnd;

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(11);
  doc.setTextColor(14, 61, 124);
  doc.text('Payment Method Breakdown', 14, breakdownTableEnd + 8);
  doc.setTextColor(0, 0, 0);

  autoTable(doc, {
    startY: breakdownTableEnd + 10,
    head: [['Payment Method', 'Amount (BDT)', 'Share']],
    body: paymentBreakdown.map((entry) => [
      entry.name,
      currency(entry.amount),
      `${selectedDaySummary?.totalIncome > 0 ? ((entry.amount / selectedDaySummary.totalIncome) * 100).toFixed(1) : '0.0'}%`,
    ]),
    theme: 'grid',
    styles: { fontSize: 9, cellPadding: 3, valign: 'middle' },
    headStyles: { fillColor: [51, 65, 85], textColor: 255, halign: 'center' },
    alternateRowStyles: { fillColor: [248, 250, 252] },
    columnStyles: {
      0: { fontStyle: 'bold', cellWidth: 70 },
      1: { halign: 'right', cellWidth: 42 },
      2: { halign: 'right', cellWidth: 24 },
    },
    margin: { left: 14, right: 14 },
  });

  const paymentTableEnd = doc.lastAutoTable?.finalY || breakdownTableEnd;

  doc.setFontSize(9);
  doc.setTextColor(100, 116, 139);
  doc.text(`Generated on ${new Date().toLocaleString()}`, 14, paymentTableEnd + 8);
  doc.text('Currency: BDT', 248, paymentTableEnd + 8);
  doc.setTextColor(0, 0, 0);

  autoTable(doc, {
    startY: paymentTableEnd + 14,
    head: [['Report Notes', 'Details']],
    body: [
      ['Range', rangeLabel || 'Selected range'],
      ['Selected Day', selectedDayLabel || formatDateLabel(selectedDayBreakdown?.date)],
      ['Sheet Export', `daily-report-${fileDate}.xlsx`],
    ],
    theme: 'plain',
    styles: { fontSize: 8.5, cellPadding: 2 },
    headStyles: { fillColor: [14, 61, 124], textColor: 255 },
    columnStyles: {
      0: { fontStyle: 'bold', textColor: [51, 65, 85], cellWidth: 28 },
      1: { textColor: [71, 85, 105] },
    },
    margin: { left: 14, right: 14 },
  });

  doc.save(`daily-report-${fileDate}.pdf`);
};

// Professional Report - Row per day with opening/closing balances
export const downloadProfessionalReportPdf = async ({ report, startDate, endDate }) => {
  const { jsPDF, autoTable } = await loadPdfTools();
  const doc = new jsPDF({ orientation: 'landscape', unit: 'mm', format: 'a4' });

  // Header
  const pageWidth = doc.internal.pageSize.getWidth();
  doc.setFillColor(14, 61, 124);
  doc.rect(0, 0, pageWidth, 25, 'F');

  doc.setTextColor(255, 255, 255);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(16);
  doc.text('Raya Pool - Professional Business Report', 14, 11);
  doc.setFontSize(10);
  doc.setFont('helvetica', 'normal');
  doc.text(`Period: ${formatDateLabel(startDate)} to ${formatDateLabel(endDate)}`, 14, 18);
  doc.text(`Generated: ${new Date().toLocaleString()}`, 14, 22);
  doc.setTextColor(0, 0, 0);

  // Prepare table data
  const tableData = report.dailyData.map(day => [
    formatDateLabel(day.date),
    currency(day.openingBalance),
    currency(day.transactions.Bill),
    currency(day.transactions.Training),
    currency(day.transactions.Membership),
    currency(day.transactions.Beverage),
    currency(day.transactions['Hourly Session']),
    currency(day.transactions.totalIncome),
    currency(day.paymentMethods.Cash),
    currency(day.paymentMethods.Bank),
    currency(day.paymentMethods.bKash),
    currency(day.closingBalance),
  ]);

  // Add totals row
  tableData.push([
    'TOTAL',
    currency(report.totals.openingBalance),
    currency(report.totals.billIncome),
    currency(report.totals.trainingIncome),
    currency(report.totals.membershipIncome),
    currency(report.totals.beverageIncome),
    currency(report.totals.hourlySessionIncome),
    currency(report.totals.totalIncome),
    currency(report.totals.cashIncome),
    currency(report.totals.bankIncome),
    currency(report.totals.bkashIncome),
    currency(report.totals.closingBalance),
  ]);

  autoTable(doc, {
    startY: 30,
    head: [[
      'Date',
      'Opening',
      'Bill',
      'Training',
      'Member',
      'Beverage',
      'Hourly',
      'Total Income',
      'Cash',
      'Bank',
      'bKash',
      'Closing'
    ]],
    body: tableData,
    theme: 'grid',
    styles: {
      fontSize: 7,
      cellPadding: 2,
      valign: 'middle',
      halign: 'right',
    },
    headStyles: {
      fillColor: [14, 61, 124],
      textColor: 255,
      fontStyle: 'bold',
      halign: 'center',
    },
    alternateRowStyles: {
      fillColor: [245, 248, 252],
    },
    columnStyles: {
      0: { halign: 'left', cellWidth: 18 },
      1: { cellWidth: 15 },
      2: { cellWidth: 13 },
      3: { cellWidth: 13 },
      4: { cellWidth: 13 },
      5: { cellWidth: 13 },
      6: { cellWidth: 13 },
      7: { cellWidth: 15, fillColor: [200, 220, 255], fontStyle: 'bold' },
      8: { cellWidth: 12 },
      9: { cellWidth: 12 },
      10: { cellWidth: 12 },
      11: { cellWidth: 15, fillColor: [200, 255, 200], fontStyle: 'bold' },
    },
    margin: { left: 5, right: 5 },
  });

  // Footer
  const finalY = doc.lastAutoTable?.finalY || 30;
  doc.setFontSize(8);
  doc.setTextColor(100, 116, 139);
  doc.text('Report Details:', 14, finalY + 5);
  doc.text(`• Opening Balance: ${currency(report.totals.openingBalance)}`, 14, finalY + 9);
  doc.text(`• Total Income: ${currency(report.totals.totalIncome)}`, 70, finalY + 9);
  doc.text(`• Closing Balance: ${currency(report.totals.closingBalance)}`, 14, finalY + 13);

  const filename = `professional-report-${startDate}-to-${endDate}.pdf`;
  doc.save(filename);
};

// Professional Report - Google Sheets Export
export const downloadProfessionalReportSheet = ({ report, startDate, endDate }) => {
  const workbook = XLSX.utils.book_new();

  // Sheet 1: Daily Breakdown
  const dailyData = report.dailyData.map(day => [
    day.date,
    day.openingBalance,
    day.transactions.Bill,
    day.transactions.Training,
    day.transactions.Membership,
    day.transactions.Beverage,
    day.transactions['Hourly Session'],
    day.transactions.totalIncome,
    day.paymentMethods.Cash,
    day.paymentMethods.Bank,
    day.paymentMethods.bKash,
    day.closingBalance,
  ]);

  const dailyHeaders = [
    'Date',
    'Opening Balance',
    'Bill Income',
    'Training Income',
    'Membership Income',
    'Beverage Income',
    'Hourly Session Income',
    'Total Income',
    'Cash Payment',
    'Bank Payment',
    'bKash Payment',
    'Closing Balance',
  ];

  // Add totals row
  dailyData.push([
    'TOTAL',
    report.totals.openingBalance,
    report.totals.billIncome,
    report.totals.trainingIncome,
    report.totals.membershipIncome,
    report.totals.beverageIncome,
    report.totals.hourlySessionIncome,
    report.totals.totalIncome,
    report.totals.cashIncome,
    report.totals.bankIncome,
    report.totals.bkashIncome,
    report.totals.closingBalance,
  ]);

  const dailyWorksheet = XLSX.utils.aoa_to_sheet([dailyHeaders, ...dailyData]);
  dailyWorksheet['!cols'] = Array(12).fill({ wch: 16 });
  XLSX.utils.book_append_sheet(workbook, dailyWorksheet, 'Daily Report');

  // Sheet 2: Summary
  const summaryData = [
    ['Report Summary', ''],
    ['Date Range', `${startDate} to ${endDate}`],
    ['Generated', new Date().toLocaleString()],
    ['', ''],
    ['Metric', 'Amount (BDT)'],
    ['Opening Balance', report.totals.openingBalance],
    ['Total Income', report.totals.totalIncome],
    ['  - Bill', report.totals.billIncome],
    ['  - Training', report.totals.trainingIncome],
    ['  - Membership', report.totals.membershipIncome],
    ['  - Beverage', report.totals.beverageIncome],
    ['  - Hourly Session', report.totals.hourlySessionIncome],
    ['Payment Methods', ''],
    ['  - Cash', report.totals.cashIncome],
    ['  - Bank', report.totals.bankIncome],
    ['  - bKash', report.totals.bkashIncome],
    ['Closing Balance', report.totals.closingBalance],
    ['Net Profit/Loss', report.totals.closingBalance - report.totals.openingBalance],
  ];

  const summaryWorksheet = XLSX.utils.aoa_to_sheet(summaryData);
  summaryWorksheet['!cols'] = [{ wch: 24 }, { wch: 20 }];
  XLSX.utils.book_append_sheet(workbook, summaryWorksheet, 'Summary');

  const filename = `professional-report-${startDate}-to-${endDate}.xlsx`;
  XLSX.writeFile(workbook, filename);
};