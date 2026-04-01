import React, { useState } from 'react';

// Category configuration with colors and icons
const CATEGORIES = {
  Bill: { icon: '🧾', color: '#FF6B6B', bgColor: 'bg-red-50', textColor: 'text-red-600', borderColor: 'border-red-200' },
  Training: { icon: '🏊', color: '#4ECDC4', bgColor: 'bg-teal-50', textColor: 'text-teal-600', borderColor: 'border-teal-200' },
  Membership: { icon: '🎟️', color: '#FFD93D', bgColor: 'bg-yellow-50', textColor: 'text-yellow-600', borderColor: 'border-yellow-200' },
  Beverage: { icon: '🧃', color: '#A8DADC', bgColor: 'bg-blue-50', textColor: 'text-blue-600', borderColor: 'border-blue-200' }
};

const PAYMENT_METHODS = {
  Cash: { icon: '💵', color: '#06B6D4', bgColor: 'bg-cyan-50' },
  Bank: { icon: '🏦', color: '#0EA5E9', bgColor: 'bg-sky-50' },
  bKash: { icon: '📱', color: '#EC4899', bgColor: 'bg-pink-50' }
};

const DailyTransactionBreakdown = ({ data, filters, onFiltersChange }) => {
  const [expandedDates, setExpandedDates] = useState(new Set());

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

  const toggleExpand = (date) => {
    const newSet = new Set(expandedDates);
    if (newSet.has(date)) {
      newSet.delete(date);
    } else {
      newSet.add(date);
    }
    setExpandedDates(newSet);
  };

  // Calculate totals for each category across all days
  const categoryTotals = {
    Bill: { amount: 0, count: 0 },
    Training: { amount: 0, count: 0 },
    Membership: { amount: 0, count: 0 },
    Beverage: { amount: 0, count: 0 }
  };

  data.forEach(day => {
    Object.keys(categoryTotals).forEach(cat => {
      if (day.categories[cat]) {
        categoryTotals[cat].amount += day.categories[cat].amount;
        categoryTotals[cat].count += day.categories[cat].count;
      }
    });
  });

  const grandTotal = Object.values(categoryTotals).reduce((sum, cat) => sum + cat.amount, 0);

  return (
    <div className="flex flex-col gap-6">
      {/* Filter Section */}
      <FilterSection filters={filters} onFiltersChange={onFiltersChange} />

      {/* Summary Cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
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

      {/* Daily Breakdown Cards */}
      <div className="flex flex-col gap-3">
        {data.map((day) => (
          <DayCard 
            key={day.date}
            day={day}
            isExpanded={expandedDates.has(day.date)}
            onToggle={() => toggleExpand(day.date)}
          />
        ))}
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

// Daily Card Component
const DayCard = ({ day, isExpanded, onToggle }) => {
  const dayDate = new Date(day.date);
  const dayName = dayDate.toLocaleDateString('en-GB', { weekday: 'short' });
  const dateStr = dayDate.toLocaleDateString('en-GB', { month: 'short', day: 'numeric', year: 'numeric' });
  
  const dayTotal =
    (day.categories.Bill?.amount || 0) +
    (day.categories.Training?.amount || 0) +
    (day.categories.Membership?.amount || 0) +
    (day.categories.Beverage?.amount || 0);

  const activeCategoriesCount = Object.values(day.categories).filter(cat => cat && cat.amount > 0).length;

  return (
    <div className="border-2 border-gray-200 rounded-xl overflow-hidden hover:border-primary transition">
      {/* Header */}
      <div 
        className="bg-gradient-to-r from-gray-50 to-gray-100 px-4 py-4 cursor-pointer hover:from-gray-100 hover:to-gray-200 transition"
        onClick={onToggle}
      >
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3 flex-1">
            <div className="text-2xl">
              {isExpanded ? '📂' : '📋'}
            </div>
            <div>
              <div className="text-sm font-bold text-gray-700">{dayName.toUpperCase()}</div>
              <div className="text-xs text-gray-500">{dateStr}</div>
            </div>
          </div>
          
          <div className="flex items-center gap-4">
            <div className="text-right">
              <div className="text-xs text-gray-500 mb-1">Total</div>
              <div className="text-xl font-bold text-secondary">৳ {dayTotal.toLocaleString()}</div>
            </div>
            <button className="text-gray-400 hover:text-gray-600 transition text-xl">
              {isExpanded ? '▲' : '▼'}
            </button>
          </div>
        </div>
      </div>

      {/* Category Items - Always Visible */}
      <div className="px-4 py-3 bg-white">
        <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
          {Object.entries(day.categories).map(([category, data]) => (
            <CategoryItem 
              key={category}
              category={category}
              amount={data?.amount || 0}
              count={data?.count || 0}
            />
          ))}
        </div>
      </div>

      {/* Expandable Payment Method Breakdown */}
      {isExpanded && (
        <div className="bg-gradient-to-b from-gray-50 to-white border-t-2 border-gray-200 px-4 py-4">
          <div className="mb-3">
            <h4 className="text-sm font-bold text-gray-700 mb-3 flex items-center gap-2">
              <span>💳</span> Payment Method Breakdown
            </h4>
            <div className="grid grid-cols-3 gap-2">
              {Object.entries(day.paymentMethods).map(([method, amount]) => {
                const config = PAYMENT_METHODS[method];
                return (
                  <div key={method} className={`${config.bgColor} rounded-lg p-3 border border-gray-200`}>
                    <div className="text-xl mb-1">{config.icon}</div>
                    <div className="text-xs text-gray-600 font-medium">{method}</div>
                    <div className="text-sm font-bold text-gray-800">৳ {amount.toLocaleString()}</div>
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

// Category Item Component
const CategoryItem = ({ category, amount, count }) => {
  const config = CATEGORIES[category];
  
  if (amount === 0) {
    return (
      <div className={`${config.bgColor} rounded-lg p-3 border border-gray-200 opacity-50`}>
        <div className="text-lg mb-1">{config.icon}</div>
        <div className="text-xs text-gray-500 font-medium">—</div>
      </div>
    );
  }

  return (
    <div className={`${config.bgColor} rounded-lg p-3 border-2 ${config.borderColor} hover:shadow-md transition`}>
      <div className="flex items-start justify-between mb-1">
        <div className="text-lg">{config.icon}</div>
        {count > 0 && (
          <span className="text-xs font-bold bg-white px-1.5 py-0.5 rounded text-gray-700">x{count}</span>
        )}
      </div>
      <div className="text-xs font-semibold text-gray-600">{category}</div>
      <div className={`text-sm font-bold ${config.textColor}`}>৳ {amount.toLocaleString()}</div>
    </div>
  );
};

// Filter Section Component
const FilterSection = ({ filters, onFiltersChange }) => {
  const categoryOptions = ['Bill', 'Training', 'Membership', 'Beverage'];
  const paymentMethods = ['all', 'Cash', 'Bank', 'bKash'];

  const handleCategoryToggle = (category) => {
    const newCategories = filters.categories.includes(category)
      ? filters.categories.filter(c => c !== category)
      : [...filters.categories, category];
    onFiltersChange({ ...filters, categories: newCategories });
  };

  const handlePaymentMethodChange = (method) => {
    onFiltersChange({ ...filters, paymentMethod: method });
  };

  return (
    <div className="bg-white rounded-xl p-5 border-2 border-gray-200 shadow-sm">
      <div className="flex flex-col gap-4">
        {/* Category Filter */}
        <div>
          <label className="text-sm font-bold text-gray-700 block mb-3 flex items-center gap-2">
            <span>🏷️</span> Filter by Category
          </label>
          <div className="flex flex-wrap gap-2">
            {categoryOptions.map((cat) => {
              const config = CATEGORIES[cat];
              const isSelected = filters.categories.includes(cat);
              return (
                <button
                  key={cat}
                  onClick={() => handleCategoryToggle(cat)}
                  className={`px-4 py-2 rounded-full text-sm font-semibold transition ${
                    isSelected
                      ? `${config.bgColor} ${config.textColor} border-2 ${config.borderColor} shadow-md`
                      : 'bg-gray-100 text-gray-600 border-2 border-gray-200 hover:bg-gray-200'
                  }`}
                >
                  {config.icon} {cat}
                </button>
              );
            })}
          </div>
        </div>

        {/* Payment Method Filter */}
        <div>
          <label className="text-sm font-bold text-gray-700 block mb-3 flex items-center gap-2">
            <span>💳</span> Filter by Payment Method
          </label>
          <div className="flex flex-wrap gap-2">
            {paymentMethods.map((method) => {
              const config = PAYMENT_METHODS[method];
              const isSelected = filters.paymentMethod === method;
              const label = method === 'all' ? 'All Methods' : method;
              
              return (
                <button
                  key={method}
                  onClick={() => handlePaymentMethodChange(method)}
                  className={`px-4 py-2 rounded-full text-sm font-semibold transition flex items-center gap-1 ${
                    isSelected
                      ? `${method !== 'all' ? config.bgColor : 'bg-primary'} text-white border-2 border-${method === 'all' ? 'primary' : 'gray-300'} shadow-md`
                      : 'bg-gray-100 text-gray-600 border-2 border-gray-200 hover:bg-gray-200'
                  }`}
                >
                  {method !== 'all' && config.icon} {label}
                </button>
              );
            })}
          </div>
        </div>
      </div>
    </div>
  );
};

export default DailyTransactionBreakdown;
