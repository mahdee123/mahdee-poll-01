import React, { useState, useRef, useEffect } from 'react';
import {
  Receipt, Waves, Ticket, CupSoda, Clock, Wallet, Landmark, Smartphone,
  ChevronDown, Tag, CreditCard, BarChart3, Check,
} from 'lucide-react';

// Category configuration with icons and a restrained accent per category —
// the chip carries the color, the card itself stays neutral.
const CATEGORIES = {
  Bill: { icon: Receipt, accent: 'bg-primary-50 text-primary' },
  Training: { icon: Waves, accent: 'bg-success-soft text-success' },
  Membership: { icon: Ticket, accent: 'bg-warning-soft text-warning' },
  Beverage: { icon: CupSoda, accent: 'bg-danger-soft text-danger' },
  'Hourly Session': { icon: Clock, accent: 'bg-warning-soft text-warning' },
};

const PAYMENT_METHODS = {
  Cash: { icon: Wallet, accent: 'bg-success-soft text-success' },
  Bank: { icon: Landmark, accent: 'bg-primary-50 text-primary' },
  bKash: { icon: Smartphone, accent: 'bg-warning-soft text-warning' },
};

const DailyTransactionBreakdown = ({ data, filters, onFiltersChange }) => {
  const [paymentMethodDropdownOpen, setPaymentMethodDropdownOpen] = useState(false);
  if (!data || data.length === 0) {
    return (
      <div className="flex flex-col gap-4">
        <FilterSection filters={filters} onFiltersChange={onFiltersChange} />
        <div className="flex flex-col items-center justify-center gap-2 h-56 text-center bg-canvas rounded-panel border-2 border-dashed border-line-strong">
          <BarChart3 size={28} className="text-ink-faint" />
          <div className="text-ink-soft font-medium">No transactions found</div>
          <div className="text-sm text-ink-faint">Try adjusting your filters above</div>
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
      <div className="bg-ink rounded-panel p-5 text-white">
        <div className="flex justify-between items-end">
          <div>
            <div className="text-white/60 text-sm font-medium mb-1">Total income</div>
            <div className="text-3xl font-bold tabular">৳ {grandTotal.toLocaleString()}</div>
          </div>
          <Wallet size={36} className="text-white/20" />
        </div>
      </div>

      {/* Payment Method Breakdown Dropdown */}
      <div className="card overflow-hidden">
        <button
          onClick={() => setPaymentMethodDropdownOpen(!paymentMethodDropdownOpen)}
          className="w-full px-5 py-4 flex items-center justify-between hover:bg-canvas transition"
        >
          <h3 className="section-title flex items-center gap-2">
            <CreditCard size={17} className="text-primary" /> Payment method breakdown
          </h3>
          <ChevronDown size={18} className={`text-ink-faint transition-transform ${paymentMethodDropdownOpen ? 'rotate-180' : ''}`} />
        </button>

        {paymentMethodDropdownOpen && (
          <div className="border-t border-line p-5">
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              {Object.entries(paymentMethodTotals).map(([method, amount]) => {
                const config = PAYMENT_METHODS[method];
                const Icon = config.icon;
                return (
                  <div key={method} className="border border-line rounded-card p-4">
                    <span className={`inline-flex w-9 h-9 items-center justify-center rounded-control mb-2 ${config.accent}`}>
                      <Icon size={17} />
                    </span>
                    <div className="text-xs text-ink-soft font-medium mb-1">{method}</div>
                    <div className="text-lg font-bold text-ink tabular">৳ {amount.toLocaleString()}</div>
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
  const Icon = config.icon;

  return (
    <div className="card p-4">
      <div className="flex items-center justify-between mb-2">
        <span className={`inline-flex w-9 h-9 items-center justify-center rounded-control ${config.accent}`}>
          <Icon size={17} />
        </span>
        {count > 0 && <span className="badge-neutral">{count}</span>}
      </div>
      <div className="text-xs text-ink-soft font-medium mb-1">{category}</div>
      <div className="text-lg font-bold text-ink tabular">৳ {amount.toLocaleString()}</div>
    </div>
  );
};

/** Small popover dropdown shared by both filters below. */
function FilterDropdown({ label, icon: TriggerIcon, triggerLabel, open, onToggle, children }) {
  const ref = useRef(null);

  useEffect(() => {
    if (!open) return;
    const handleClickOutside = (e) => {
      if (ref.current && !ref.current.contains(e.target)) onToggle(false);
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [open, onToggle]);

  return (
    <div className="flex-1 relative" ref={ref}>
      <label className="label">{label}</label>
      <button
        onClick={() => onToggle(!open)}
        className="input flex items-center justify-between text-left"
      >
        <span className="flex items-center gap-2 truncate">
          <TriggerIcon size={15} className="text-ink-faint flex-shrink-0" /> {triggerLabel}
        </span>
        <ChevronDown size={15} className={`text-ink-faint flex-shrink-0 transition-transform ${open ? 'rotate-180' : ''}`} />
      </button>

      {open && <div className="dropdown-panel left-0 right-0 w-auto mt-1.5">{children}</div>}
    </div>
  );
}

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
    if (filters.categories.length === 0) return 'Select categories';
    if (filters.categories.length === categoryOptions.length) return 'All categories';
    return `${filters.categories.length} selected`;
  };

  const getPaymentLabel = () => {
    if (filters.paymentMethod === 'all') return 'All methods';
    return filters.paymentMethod;
  };

  return (
    <div className="card p-4">
      <div className="flex flex-col md:flex-row md:justify-between md:items-start gap-4 md:gap-8">
        {/* Category Filter */}
        <FilterDropdown
          label="Filter by category"
          icon={Tag}
          triggerLabel={getCategoryLabel()}
          open={categoryDropdownOpen}
          onToggle={setCategoryDropdownOpen}
        >
          {categoryOptions.map((cat) => {
            const config = CATEGORIES[cat];
            const Icon = config.icon;
            const isSelected = filters.categories.includes(cat);
            return (
              <button
                key={cat}
                onClick={() => handleCategoryToggle(cat)}
                className="dropdown-item justify-between"
              >
                <span className="flex items-center gap-2">
                  <Icon size={14} className="text-ink-faint" /> {cat}
                </span>
                {isSelected && <Check size={14} className="text-primary" />}
              </button>
            );
          })}
        </FilterDropdown>

        {/* Payment Method Filter */}
        <FilterDropdown
          label="Filter by payment method"
          icon={CreditCard}
          triggerLabel={getPaymentLabel()}
          open={paymentDropdownOpen}
          onToggle={setPaymentDropdownOpen}
        >
          {paymentMethods.map((method) => {
            const isSelected = filters.paymentMethod === method;
            const label = method === 'all' ? 'All methods' : method;
            const Icon = method === 'all' ? CreditCard : PAYMENT_METHODS[method]?.icon;
            return (
              <button
                key={method}
                onClick={() => handlePaymentMethodChange(method)}
                className="dropdown-item justify-between"
              >
                <span className="flex items-center gap-2">
                  <Icon size={14} className="text-ink-faint" /> {label}
                </span>
                {isSelected && <Check size={14} className="text-primary" />}
              </button>
            );
          })}
        </FilterDropdown>
      </div>
    </div>
  );
};

export default DailyTransactionBreakdown;
