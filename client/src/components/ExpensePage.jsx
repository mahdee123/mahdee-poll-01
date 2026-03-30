import React, { useState, useEffect } from 'react';
import { apiRequest } from '../api.js';

const CATEGORIES = ['Staff Salary', 'Maintenance', 'Utility', 'Supplies', 'Other'];
const PAYMENT_METHODS = ['Cash', 'Bank', 'bKash'];

export default function ExpensePage({ token, showToast, onExpenseSaved }) {
  const [formData, setFormData] = useState({
    date: new Date().toISOString().split('T')[0],
    title: '',
    category: 'Staff Salary',
    amount: '',
    paymentMethod: 'Cash',
    note: '',
  });

  const [expenses, setExpenses] = useState([]);
  const [loading, setLoading] = useState(false);
  const [errors, setErrors] = useState({});

  // Fetch recent expenses
  useEffect(() => {
    fetchRecentExpenses();
  }, []);

  const fetchRecentExpenses = async () => {
    try {
      setLoading(true);
      const data = await apiRequest('/expenses', { token });
      setExpenses(data.expenses || []);
    } catch (err) {
      console.error('Error fetching expenses:', err);
      showToast({ message: 'Error loading expenses', type: 'error' });
    } finally {
      setLoading(false);
    }
  };

  const validateForm = () => {
    const newErrors = {};

    if (!formData.title.trim()) {
      newErrors.title = 'Title is required';
    }
    if (!formData.category) {
      newErrors.category = 'Category is required';
    }
    if (!formData.amount || Number(formData.amount) <= 0) {
      newErrors.amount = 'Amount must be greater than 0';
    }
    if (!formData.paymentMethod) {
      newErrors.paymentMethod = 'Payment method is required';
    }
    if (!formData.date) {
      newErrors.date = 'Date is required';
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleInputChange = (e) => {
    const { name, value } = e.target;
    setFormData((prev) => ({
      ...prev,
      [name]: value,
    }));
    // Clear error for this field
    if (errors[name]) {
      setErrors((prev) => ({
        ...prev,
        [name]: '',
      }));
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();

    if (!validateForm()) {
      return;
    }

    try {
      setLoading(true);
      const response = await apiRequest('/expenses', {
        method: 'POST',
        token,
        body: {
          ...formData,
          amount: Number(formData.amount),
        },
      });

      if (response.expense) {
        // ✅ Optimistic UI update - add new expense to list immediately
        setExpenses([response.expense, ...expenses]);
        
        showToast({ message: '✓ Expense added successfully', type: 'success' });
        setFormData({
          date: new Date().toISOString().split('T')[0],
          title: '',
          category: 'Staff Salary',
          amount: '',
          paymentMethod: 'Cash',
          note: '',
        });
        setErrors({});
        
        // ✅ Refresh dashboard data (income, expense totals, net cash)
        if (onExpenseSaved) {
          onExpenseSaved();
        }
      }
    } catch (err) {
      console.error('Error creating expense:', err);
      showToast({ message: err.message || 'Error adding expense', type: 'error' });
    } finally {
      setLoading(false);
    }
  };

  const formatDate = (dateString) => {
    const date = new Date(dateString);
    return date.toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' });
  };

  const formatCurrency = (amount) => {
    return new Intl.NumberFormat('bn-BD', {
      style: 'currency',
      currency: 'BDT',
      minimumFractionDigits: 0,
    }).format(amount);
  };

  return (
    <div className="flex-1 flex flex-col p-4 sm:p-6 bg-white overflow-auto">
      <div className="max-w-2xl">
        <h1 className="text-3xl font-bold text-secondary mb-6">Expense Management</h1>

        {/* Expense Entry Form */}
        <div className="card p-6 mb-8">
          <h2 className="text-xl font-semibold text-secondary mb-4">Add New Expense</h2>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              {/* Date */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  📅 Date
                </label>
                <input
                  type="date"
                  name="date"
                  value={formData.date}
                  onChange={handleInputChange}
                  className={`w-full px-3 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-primary ${
                    errors.date ? 'border-red-500' : 'border-gray-300'
                  }`}
                />
                {errors.date && <span className="text-red-500 text-sm mt-1">{errors.date}</span>}
              </div>

              {/* Category */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  📂 Category
                </label>
                <select
                  name="category"
                  value={formData.category}
                  onChange={handleInputChange}
                  className={`w-full px-3 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-primary ${
                    errors.category ? 'border-red-500' : 'border-gray-300'
                  }`}
                >
                  {CATEGORIES.map((cat) => (
                    <option key={cat} value={cat}>
                      {cat}
                    </option>
                  ))}
                </select>
                {errors.category && (
                  <span className="text-red-500 text-sm mt-1">{errors.category}</span>
                )}
              </div>
            </div>

            {/* Title */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                📝 Expense Title
              </label>
              <input
                type="text"
                name="title"
                placeholder="e.g., Staff Salary, Electricity Bill"
                value={formData.title}
                onChange={handleInputChange}
                className={`w-full px-3 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-primary ${
                  errors.title ? 'border-red-500' : 'border-gray-300'
                }`}
              />
              {errors.title && <span className="text-red-500 text-sm mt-1">{errors.title}</span>}
            </div>

            {/* Amount */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                💰 Amount (৳)
              </label>
              <input
                type="number"
                name="amount"
                placeholder="0"
                step="0.01"
                min="0"
                value={formData.amount}
                onChange={handleInputChange}
                className={`w-full px-3 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-primary ${
                  errors.amount ? 'border-red-500' : 'border-gray-300'
                }`}
              />
              {errors.amount && <span className="text-red-500 text-sm mt-1">{errors.amount}</span>}
            </div>

            {/* Payment Method */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                💳 Payment Method
              </label>
              <div className="flex gap-3">
                {PAYMENT_METHODS.map((method) => (
                  <label key={method} className="flex items-center gap-2 cursor-pointer">
                    <input
                      type="radio"
                      name="paymentMethod"
                      value={method}
                      checked={formData.paymentMethod === method}
                      onChange={handleInputChange}
                      className="w-4 h-4"
                    />
                    <span className="text-sm">{method}</span>
                  </label>
                ))}
              </div>
              {errors.paymentMethod && (
                <span className="text-red-500 text-sm mt-1">{errors.paymentMethod}</span>
              )}
            </div>

            {/* Note */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                📋 Note (optional)
              </label>
              <textarea
                name="note"
                placeholder="Additional details about this expense..."
                value={formData.note}
                onChange={handleInputChange}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary"
                rows="2"
              />
            </div>

            {/* Submit Button */}
            <button
              type="submit"
              disabled={loading}
              className="w-full bg-primary hover:bg-primary/90 text-white font-semibold py-2 px-4 rounded-lg transition disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {loading ? 'Saving...' : '👉 Save Expense'}
            </button>
          </form>
        </div>

        {/* Recent Expenses List */}
        <div className="card p-6">
          <h2 className="text-xl font-semibold text-secondary mb-4">Recent Expenses</h2>
          {loading && !expenses.length ? (
            <div className="text-center py-8 text-gray-500">Loading expenses...</div>
          ) : expenses.length === 0 ? (
            <div className="text-center py-8 text-gray-500">No expenses recorded yet</div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="border-b border-gray-200">
                  <tr className="text-left text-gray-600 font-semibold">
                    <th className="pb-3 px-2">Date</th>
                    <th className="pb-3 px-2">Title</th>
                    <th className="pb-3 px-2">Category</th>
                    <th className="pb-3 px-2">Amount</th>
                    <th className="pb-3 px-2">Method</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-200">
                  {expenses.slice(0, 10).map((expense) => (
                    <tr
                      key={expense._id}
                      className="hover:bg-gray-50 transition"
                    >
                      <td className="py-3 px-2 text-gray-700">
                        {formatDate(expense.date)}
                      </td>
                      <td className="py-3 px-2 text-gray-700 font-medium">
                        {expense.title}
                      </td>
                      <td className="py-3 px-2">
                        <span className="bg-secondary/10 text-secondary px-2 py-1 rounded text-xs font-semibold">
                          {expense.category}
                        </span>
                      </td>
                      <td className="py-3 px-2 font-semibold text-secondary">
                        {formatCurrency(expense.amount)}
                      </td>
                      <td className="py-3 px-2 text-gray-600">
                        {expense.paymentMethod}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
