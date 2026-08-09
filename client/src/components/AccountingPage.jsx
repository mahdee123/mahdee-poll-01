import React, { useState } from 'react';
import AccountingDashboard from './AccountingDashboard.jsx';
import DailyExpenseForm from './DailyExpenseForm.jsx';
import ExpenseCategoriesPage from './ExpenseCategoriesPage.jsx';
import AccountingReports from './AccountingReports.jsx';

export default function AccountingPage({ token }) {
  const [activeTab, setActiveTab] = useState('dashboard');

  const tabs = [
    { key: 'dashboard', label: 'Dashboard' },
    { key: 'expenses', label: 'Expenses' },
    { key: 'categories', label: 'Categories' },
    { key: 'reports', label: 'Reports' },
  ];

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-2">
        <h1 className="text-xl md:text-2xl font-bold text-secondary">📒 Accounting</h1>
      </div>

      {/* Tabs */}
      <div className="flex gap-2 border-b border-gray-200 pb-2 overflow-x-auto">
        {tabs.map(tab => (
          <button
            key={tab.key}
            onClick={() => setActiveTab(tab.key)}
            className={`px-4 py-2 rounded-lg font-medium transition ${
              activeTab === tab.key
                ? 'bg-primary text-white'
                : 'text-gray-600 hover:bg-gray-100'
            }`}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {/* Content */}
      {activeTab === 'dashboard' && (
        <AccountingDashboard token={token} onNavigate={setActiveTab} />
      )}
      {activeTab === 'expenses' && (
        <DailyExpenseForm token={token} onManageCategories={() => setActiveTab('categories')} />
      )}
      {activeTab === 'categories' && (
        <ExpenseCategoriesPage token={token} />
      )}
      {activeTab === 'reports' && (
        <AccountingReports token={token} />
      )}
    </div>
  );
}
