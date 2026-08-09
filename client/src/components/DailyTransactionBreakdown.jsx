import React, { useState } from 'react';

// Category configuration with colors and icons
const CATEGORIES = {
  Bill: { icon: '🧾', color: '#FF6B6B', bgColor: 'bg-red-50', textColor: 'text-red-600', borderColor: 'border-red-200' },
  Training: { icon: '🏊', color: '#4ECDC4', bgColor: 'bg-teal-50', textColor: 'text-teal-600', borderColor: 'border-teal-200' },
  Membership: { icon: '🎟️', color: '#FFD93D', bgColor: 'bg-yellow-50', textColor: 'text-yellow-600', borderColor: 'border-yellow-200' },
  Beverage: { icon: '🧃', color: '#008CFF', bgColor: 'bg-primary/5', textColor: 'text-primary', borderColor: 'border-primary/20' },
  'Hourly Session': { icon: '⏱️', color: '#F97316', bgColor: 'bg-orange-50', textColor: 'text-orange-600', borderColor: 'border-orange-200' }
};

const PAYMENT_METHODS = {
  Cash: { icon: '💵', color: '#06B6D4', bgColor: 'bg-cyan-50' },
  Bank: { icon: '🏦', color: '#0EA5E9', bgColor: 'bg-sky-50' },
  bKash: { icon: '📱', color: '#EC4899', bgColor: 'bg-pink-50' }
};

const DailyTransactionBreakdown = ({ data, filters, onFiltersChange }) => {
  const [paymentMethodDropdownOpen, setPaymentMethodDropdownOpen] = useState(false);
  if (!data || data.length === 0) {
    return (
      <div className="flex flex-col gap-4">
        <FilterSection filters={filters} onFiltersChange={onFiltersChange} />
        <div className="flex flex-col items-center justify-center gap-3 h-56 text-center bg-gradient-to-br from-gray-50 to-gray-100 rounded-xl border-2 border-dashed border-gray-300">
          <div className="text-4xl">📊</div>
          <div className="text-gray-600 font-medium">No transactions found</div>
          <div className="text-sm text-gray-500">Try adjusting your filters above</div>
        </div>
      </div>
    );
  }

  // Calculate totals for each category across all days
  const categoryTotals = {
    Bill: { amount: 0, count: 0 },
    Training: { amount: 0, count: 0 },
    Membership: { amount: 0, count: 0 },
    Beverage: { amount: 0, count: 0 },
    'Hourly Session': { amount: 0, count: 0 }
  };

  // Calculate payment method totals
  const paymentMethodTotals = {
    Cash: 0,
    Bank: 0,
    bKash: 0
  };

  data.forEach(day => {
    Object.keys(categoryTotals).forEach(cat => {
      if (day.categories[cat]) {
        categoryTotals[cat].amount += day.categories[cat].amount;
        categoryTotals[cat].count += day.categories[cat].count;
      }
    });

    Object.keys(paymentMethodTotals).forEach(method => {
      if (day.paymentMethods && day.paymentMethods[method]) {
        paymentMethodTotals[method] += day.paymentMethods[method];
      }
    });
  });

  const grandTotal = Object.values(categoryTotals).reduce((sum, cat) => sum + cat.amount, 0);

  return (
    <div className="flex flex-col gap-6">
      {/* Filter Section */}
      <FilterSection filters={filters} onFiltersChange={onFiltersChange} />

      {/* Summary Cards */}
      <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
        {Object.entries(categoryTotals).map(([category, data]) => (
          <SummaryCard 
            key={category}
            category={category} 
            amount={data.amount} 
            count={data.count}
          />
        ))}
      </div>

      {/* Grand Total Card */}
      <div className="bg-gradient-to-r from-primary to-secondary rounded-xl p-5 text-white shadow-lg">
        <div className="flex justify-between items-end">
          <div>
            <div className="text-white/70 text-sm font-medium mb-1">Total Income</div>
            <div className="text-3xl font-bold">৳ {grandTotal.toLocaleString()}</div>
          </div>
          <div className="text-5xl opacity-20">💰</div>
        </div>
      </div>

      {/* Payment Method Breakdown Dropdown */}
      <div className="bg-white rounded-lg border border-gray-200">
        <button
          onClick={() => setPaymentMethodDropdownOpen(!paymentMethodDropdownOpen)}
          className="w-full px-4 py-4 flex items-center justify-between hover:bg-gray-50 transition"
        >
          <h3 className="text-lg font-semibold text-gray-800 flex items-center gap-2">
            💳 Payment Method Breakdown
          </h3>
          <span className={`transition text-xl ${paymentMethodDropdownOpen ? 'rotate-180' : ''}`}>▼</span>
        </button>

        {paymentMethodDropdownOpen && (
          <div className="border-t border-gray-200 p-4">
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              {Object.entries(paymentMethodTotals).map(([method, amount]) => {
                const config = PAYMENT_METHODS[method];
                return (
                  <div key={method} className={`${config.bgColor} rounded-lg p-4 border border-gray-200 transition hover:shadow-md`}>
                    <div className="flex items-center justify-between mb-2">
                      <span className="text-2xl">{config.icon}</span>
                    </div>
                    <div className="text-xs text-gray-600 font-medium mb-1">{method}</div>
                    <div className="text-lg font-bold text-gray-800">৳ {amount.toLocaleString()}</div>
                  </div>
                );
              })}
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

// Summary Card Component
const SummaryCard = ({ category, amount, count }) => {
  const config = CATEGORIES[category];
  
  return (
    <div className={`${config.bgColor} rounded-lg p-4 border-2 ${config.borderColor} transition hover:shadow-md`}>
      <div className="flex items-center justify-between mb-2">
        <span className="text-2xl">{config.icon}</span>
        {count > 0 && <span className="text-xs font-bold bg-white px-2 py-1 rounded-full text-gray-600">{count}</span>}
      </div>
      <div className="text-xs text-gray-600 font-medium mb-1">{category}</div>
      <div className="text-lg font-bold text-gray-800">৳ {amount.toLocaleString()}</div>
    </div>
  );
};
// Filter Section Component
const FilterSection = ({ filters, onFiltersChange }) => {
  const [categoryDropdownOpen, setCategoryDropdownOpen] = useState(false);
  const [paymentDropdownOpen, setPaymentDropdownOpen] = useState(false);
  const categoryOptions = ['Bill', 'Training', 'Membership', 'Beverage', 'Hourly Session'];
  const paymentMethods = ['all', 'Cash', 'Bank', 'bKash'];

  const handleCategoryToggle = (category) => {
    const newCategories = filters.categories.includes(category)
      ? filters.categories.filter(c => c !== category)
      : [...filters.categories, category];
    onFiltersChange({ ...filters, categories: newCategories });
  };

  const handlePaymentMethodChange = (method) => {
    onFiltersChange({ ...filters, paymentMethod: method });
    setPaymentDropdownOpen(false);
  };

  const getCategoryLabel = () => {
    if (filters.categories.length === 0) return 'Select Categories';
    if (filters.categories.length === categoryOptions.length) return 'All Categories';
    return `${filters.categories.length} Selected`;
  };

  const getPaymentLabel = () => {
    if (filters.paymentMethod === 'all') return 'All Methods';
    return filters.paymentMethod;
  };

  return (
    <div className="bg-white rounded-lg p-4 border border-gray-200">
      <div className="flex flex-col md:flex-row md:justify-between md:items-start gap-6 md:gap-8">
        {/* Category Filter */}
        <div className="flex-1 relative">
          <label className="text-sm font-semibold text-gray-700 block mb-2">Filter by Category</label>
          <button
            onClick={() => setCategoryDropdownOpen(!categoryDropdownOpen)}
            className="w-full px-4 py-2 bg-gray-50 border border-gray-300 rounded-lg text-left text-sm font-medium text-gray-700 hover:bg-gray-100 transition flex items-center justify-between"
          >
            <span className="flex items-center gap-2">
              🏷️ {getCategoryLabel()}
            </span>
            <span className={`transition ${categoryDropdownOpen ? 'rotate-180' : ''}`}>▼</span>
          </button>
          
          {categoryDropdownOpen && (
            <div className="absolute top-full left-0 right-0 mt-2 bg-white border border-gray-300 rounded-lg shadow-lg z-10">
              {categoryOptions.map((cat) => {
                const config = CATEGORIES[cat];
                const isSelected = filters.categories.includes(cat);
                return (
                  <button
                    key={cat}
                    onClick={() => handleCategoryToggle(cat)}
                    className={`w-full px-4 py-3 text-left text-sm font-medium transition hover:bg-gray-50 flex items-center gap-2 border-b border-gray-100 last:border-b-0 ${
                      isSelected ? 'bg-gray-100 text-gray-900' : 'text-gray-700'
                    }`}
                  >
                    <input
                      type="checkbox"
                      checked={isSelected}
                      readOnly
                      className="w-4 h-4 rounded"
                    />
                    <span>{config.icon} {cat}</span>
                  </button>
                );
              })}
            </div>
          )}
        </div>

        {/* Payment Method Filter */}
        <div className="flex-1 relative">
          <label className="text-sm font-semibold text-gray-700 block mb-2">Filter by Payment Method</label>
          <button
            onClick={() => setPaymentDropdownOpen(!paymentDropdownOpen)}
            className="w-full px-4 py-2 bg-gray-50 border border-gray-300 rounded-lg text-left text-sm font-medium text-gray-700 hover:bg-gray-100 transition flex items-center justify-between"
          >
            <span className="flex items-center gap-2">
              💳 {getPaymentLabel()}
            </span>
            <span className={`transition ${paymentDropdownOpen ? 'rotate-180' : ''}`}>▼</span>
          </button>
          
          {paymentDropdownOpen && (
            <div className="absolute top-full left-0 right-0 mt-2 bg-white border border-gray-300 rounded-lg shadow-lg z-10">
              {paymentMethods.map((method) => {
                const isSelected = filters.paymentMethod === method;
                const label = method === 'all' ? 'All Methods' : method;
                const icon = method === 'all' ? '💳' : PAYMENT_METHODS[method]?.icon;
                
                return (
                  <button
                    key={method}
                    onClick={() => handlePaymentMethodChange(method)}
                    className={`w-full px-4 py-3 text-left text-sm font-medium transition hover:bg-gray-50 flex items-center gap-2 border-b border-gray-100 last:border-b-0 ${
                      isSelected ? 'bg-gray-100 text-gray-900' : 'text-gray-700'
                    }`}
                  >
                    <input
                      type="radio"
                      checked={isSelected}
                      readOnly
                      className="w-4 h-4"
                    />
                    <span>{icon} {label}</span>
                  </button>
                );
              })}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default DailyTransactionBreakdown;
