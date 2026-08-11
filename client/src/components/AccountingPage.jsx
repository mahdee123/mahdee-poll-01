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
      {/* Tabs */}
      <div className="segmented flex-wrap">
        {tabs.map(tab => (
          <button
            key={tab.key}
            onClick={() => setActiveTab(tab.key)}
            className={activeTab === tab.key ? 'segmented-item-active' : 'segmented-item'}
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
