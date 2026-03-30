import React, { useState, useEffect } from 'react';
import { apiRequest } from '../api.js';
import BillForm from './BillForm.jsx';

export default function BillsPage({ token, showToast, setLastReceipt }) {
  const [bills, setBills] = useState([]);
  const [stats, setStats] = useState({
    totalBillsToday: 0,
    todayRevenue: 0,
    thisMonthRevenue: 0,
    totalPersonsToday: 0,
    totalPersonsThisMonth: 0,
    totalCustomersToday: 0,
  });
  const [showBillForm, setShowBillForm] = useState(false);
  const [loading, setLoading] = useState(false);
  const [filters, setFilters] = useState({
    search: '',
    dateRange: 'today',
    paymentMethod: '',
    amountPerPerson: '',
  });

  // Load bills and stats
  const loadBills = async () => {
    setLoading(true);
    try {
      const today = new Date();
      today.setHours(0, 0, 0, 0);
      const tomorrow = new Date(today);
      tomorrow.setDate(tomorrow.getDate() + 1);

      // Determine date range
      let startDate, endDate;
      const now = new Date();

      if (filters.dateRange === 'today') {
        startDate = today;
        endDate = tomorrow;
      } else if (filters.dateRange === 'yesterday') {
        const yesterday = new Date(today);
        yesterday.setDate(yesterday.getDate() - 1);
        startDate = yesterday;
        endDate = today;
      } else if (filters.dateRange === 'thisWeek') {
        const weekStart = new Date(today);
        weekStart.setDate(weekStart.getDate() - weekStart.getDay());
        startDate = weekStart;
        endDate = tomorrow;
      } else if (filters.dateRange === 'thisMonth') {
        startDate = new Date(now.getFullYear(), now.getMonth(), 1);
        endDate = new Date(now.getFullYear(), now.getMonth() + 1, 1);
      } else {
        startDate = today;
        endDate = tomorrow;
      }

      const params = new URLSearchParams({
        startDate: startDate.toISOString(),
        endDate: endDate.toISOString(),
        ...(filters.paymentMethod && { paymentMethod: filters.paymentMethod }),
        ...(filters.amountPerPerson && { amountPerPerson: filters.amountPerPerson }),
        ...(filters.search && { search: filters.search }),
      });

      const response = await apiRequest(`/transactions/bills/list?${params}`, {
        method: 'GET',
        token,
      });

      setBills(response.bills || []);
    } catch (error) {
      console.error('Error loading bills:', error);
      showToast('Error loading bills', 'error');
    } finally {
      setLoading(false);
    }
  };

  // Load stats
  const loadStats = async () => {
    try {
      const response = await apiRequest('/transactions/stats/bills', {
        method: 'GET',
        token,
      });
      setStats(response);
    } catch (error) {
      console.error('Error loading stats:', error);
    }
  };

  // Load on mount and when filters change
  useEffect(() => {
    loadBills();
  }, [filters]);

  useEffect(() => {
    loadStats();
    const interval = setInterval(loadStats, 30000); // Refresh every 30 seconds
    return () => clearInterval(interval);
  }, []);

  const handleSaveBill = async (billData) => {
    try {
      const response = await apiRequest('/transactions', {
        method: 'POST',
        token,
        body: {
          ...billData,
          serviceType: 'Bill',
        },
      });

      showToast('Bill saved successfully', 'success');
      setShowBillForm(false);
      loadBills();
      loadStats();
    } catch (error) {
      console.error('Error saving bill:', error);
      showToast('Error saving bill', 'error');
    }
  };

  const handleSaveAndPrint = async (billData) => {
    try {
      const response = await apiRequest('/transactions', {
        method: 'POST',
        token,
        body: {
          ...billData,
          serviceType: 'Bill',
        },
      });

      // Format bill for receipt
      const receipt = {
        receiptId: response.transaction.receiptId,
        date: response.transaction.date,
        name: response.transaction.name,
        phone: response.transaction.phone,
        amount: response.transaction.amount,
        paymentMethod: response.transaction.paymentMethod,
        serviceType: 'Bill',
        price: response.transaction.price,
        discount: response.transaction.discount,
      };

      setLastReceipt(receipt);
      showToast('Bill saved! Opening receipt for printing...', 'success');
      setShowBillForm(false);
      loadBills();
      loadStats();

      // Trigger print after a short delay
      setTimeout(() => {
        window.print();
      }, 500);
    } catch (error) {
      console.error('Error saving bill:', error);
      showToast('Error saving bill', 'error');
    }
  };

  const handleDeleteBill = async (id) => {
    if (!window.confirm('⚠️ Are you sure you want to delete this bill?')) return;

    try {
      await apiRequest(`/transactions/${id}`, {
        method: 'DELETE',
        token,
      });

      showToast('Bill deleted successfully', 'success');
      loadBills();
      loadStats();
    } catch (error) {
      console.error('Error deleting bill:', error);
      showToast('Error deleting bill', 'error');
    }
  };

  const handleViewReceipt = (bill) => {
    const receipt = {
      receiptId: bill.receiptId,
      date: bill.date,
      name: bill.name,
      phone: bill.phone,
      amount: bill.amount,
      paymentMethod: bill.paymentMethod,
      serviceType: 'Bill',
      price: bill.price,
      discount: bill.discount,
    };
    setLastReceipt(receipt);
  };

  const StatCard = ({ title, value, hint }) => (
    <div className="card p-4 flex flex-col gap-2">
      <span className="text-sm text-gray-500">{title}</span>
      <span className="text-2xl font-semibold text-secondary">{value}</span>
      {hint && <span className="text-xs text-gray-400">{hint}</span>}
    </div>
  );

  const formatDate = (dateStr) => {
    return new Date(dateStr).toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  };

  return (
    <div className="grid gap-4">
      {/* Summary Cards */}
      <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard
          title="🧾 Total Bills Today"
          value={stats.totalBillsToday}
          hint={`${stats.totalBillsToday} bills`}
        />
        <StatCard
          title="💰 Today's Revenue"
          value={`৳ ${stats.todayRevenue.toLocaleString()}`}
          hint="Total collected"
        />
        <StatCard
          title="📅 This Month Revenue"
          value={`৳ ${stats.thisMonthRevenue.toLocaleString()}`}
          hint="Total month"
        />
        <StatCard
          title="👥 Total Persons & Customers Today"
          value={`${stats.totalPersonsToday} / ${stats.totalCustomersToday}`}
          hint={`${stats.totalPersonsToday} persons • ${stats.totalCustomersToday} customers`}
        />
      </div>

      {/* Toolbar & Filters */}
      <div className="card p-4 space-y-4">
        <div className="flex items-center justify-between gap-4">
          <h2 className="text-lg font-semibold">📝 Bills List</h2>
          <button
            onClick={() => setShowBillForm(true)}
            className="btn-primary"
          >
            ➕ Add New Bill
          </button>
        </div>

        {/* Filters */}
        <div className="grid md:grid-cols-4 gap-3">
          <input
            type="text"
            placeholder="🔍 Search by name or phone..."
            value={filters.search}
            onChange={(e) => setFilters({ ...filters, search: e.target.value })}
            className="border rounded-lg px-3 py-2 text-sm"
          />
          <select
            value={filters.dateRange}
            onChange={(e) => setFilters({ ...filters, dateRange: e.target.value })}
            className="border rounded-lg px-3 py-2 text-sm"
          >
            <option value="today">📅 Today</option>
            <option value="yesterday">Yesterday</option>
            <option value="thisWeek">This Week</option>
            <option value="thisMonth">This Month</option>
          </select>
          <select
            value={filters.paymentMethod}
            onChange={(e) => setFilters({ ...filters, paymentMethod: e.target.value })}
            className="border rounded-lg px-3 py-2 text-sm"
          >
            <option value="">💳 All Payment Methods</option>
            <option value="Cash">Cash</option>
            <option value="Bank">Bank</option>
            <option value="bKash">bKash</option>
          </select>
          <select
            value={filters.amountPerPerson}
            onChange={(e) => setFilters({ ...filters, amountPerPerson: e.target.value })}
            className="border rounded-lg px-3 py-2 text-sm"
          >
            <option value="">💵 All Amounts</option>
            <option value="300">৳ 300</option>
            <option value="400">৳ 400</option>
            <option value="500">৳ 500</option>
            <option value="750">৳ 750</option>
            <option value="1000">৳ 1000</option>
          </select>
        </div>
      </div>

      {/* Bills Table */}
      <div className="card overflow-x-auto">
        {loading ? (
          <div className="p-8 text-center text-gray-500">Loading bills...</div>
        ) : bills.length === 0 ? (
          <div className="p-8 text-center text-gray-500">
            No bills found for the selected filters.
          </div>
        ) : (
          <table className="w-full">
            <thead className="bg-gray-50 border-b">
              <tr>
                <th className="px-4 py-2 text-left text-sm font-semibold">📅 Date</th>
                <th className="px-4 py-2 text-left text-sm font-semibold">👤 Name</th>
                <th className="px-4 py-2 text-left text-sm font-semibold">📱 Phone</th>
                <th className="px-4 py-2 text-left text-sm font-semibold">💵 Per Person</th>
                <th className="px-4 py-2 text-left text-sm font-semibold">👥 Persons</th>
                <th className="px-4 py-2 text-left text-sm font-semibold">🏷 Discount</th>
                <th className="px-4 py-2 text-right text-sm font-semibold">💰 Total</th>
                <th className="px-4 py-2 text-left text-sm font-semibold">💳 Method</th>
                <th className="px-4 py-2 text-center text-sm font-semibold">⚙️ Action</th>
              </tr>
            </thead>
            <tbody className="divide-y">
              {bills.map((bill) => (
                <tr key={bill._id} className="hover:bg-gray-50 transition">
                  <td className="px-4 py-2 text-sm">{formatDate(bill.date)}</td>
                  <td className="px-4 py-2 text-sm font-medium">{bill.name || '—'}</td>
                  <td className="px-4 py-2 text-sm">{bill.phone || '—'}</td>
                  <td className="px-4 py-2 text-sm">৳ {(bill.amountPerPerson || 0).toLocaleString()}</td>
                  <td className="px-4 py-2 text-sm text-center">{bill.numberOfPersons || 1}</td>
                  <td className="px-4 py-2 text-sm">
                    {bill.discount > 0 ? (
                      <span className="text-red-600 font-medium">- ৳ {bill.discount.toLocaleString()}</span>
                    ) : (
                      '—'
                    )}
                  </td>
                  <td className="px-4 py-2 text-sm font-semibold text-secondary text-right">
                    ৳ {bill.amount.toLocaleString()}
                  </td>
                  <td className="px-4 py-2 text-sm">
                    <span className={`px-2 py-1 rounded-full text-xs font-medium ${
                      bill.paymentMethod === 'Cash'
                        ? 'bg-green-100 text-green-800'
                        : bill.paymentMethod === 'Bank'
                        ? 'bg-blue-100 text-blue-800'
                        : 'bg-purple-100 text-purple-800'
                    }`}>
                      {bill.paymentMethod}
                    </span>
                  </td>
                  <td className="px-4 py-2 text-sm text-center">
                    <div className="flex items-center justify-center gap-2">
                      <button
                        onClick={() => handleViewReceipt(bill)}
                        className="text-blue-600 hover:text-blue-800 font-medium"
                        title="View Receipt"
                      >
                        👁️
                      </button>
                      <button
                        onClick={() => {
                          handleViewReceipt(bill);
                          setTimeout(() => window.print(), 300);
                        }}
                        className="text-green-600 hover:text-green-800 font-medium"
                        title="Print"
                      >
                        🖨️
                      </button>
                      <button
                        onClick={() => handleDeleteBill(bill._id)}
                        className="text-red-600 hover:text-red-800 font-medium"
                        title="Delete"
                      >
                        🗑️
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
            {bills.length > 0 && (
              <tfoot className="bg-gray-100 border-t-2 font-semibold sticky bottom-0">
                <tr>
                  <td colSpan="4" className="px-4 py-3 text-right">
                    TOTAL
                  </td>
                  <td className="px-4 py-3 text-center">
                    👥 {bills.reduce((sum, b) => sum + (b.numberOfPersons || 1), 0)}
                  </td>
                  <td className="px-4 py-3">
                    - ৳ {bills.reduce((sum, b) => sum + b.discount, 0).toLocaleString()}
                  </td>
                  <td className="px-4 py-3 text-right text-secondary">
                    💰 ৳ {bills.reduce((sum, b) => sum + b.amount, 0).toLocaleString()}
                  </td>
                  <td colSpan="2"></td>
                </tr>
              </tfoot>
            )}
          </table>
        )}
      </div>

      {/* Bill Form Modal */}
      {showBillForm && (
        <BillForm
          onClose={() => setShowBillForm(false)}
          onSave={handleSaveBill}
          onSaveAndPrint={handleSaveAndPrint}
        />
      )}
    </div>
  );
}
