import React, { useState, useEffect } from 'react';
import { apiRequest } from '../api.js';

const formatMonth = (monthStr) => {
  if (!monthStr) return '';
  const [year, month] = monthStr.split('-');
  const date = new Date(Number(year), Number(month) - 1);
  return date.toLocaleString('en-US', { month: 'long', year: 'numeric' });
};

export default function CollectPaymentModal({ isOpen, memberId, memberName, totalDue, monthlyDue = 0, isMonthlyDue = false, memberDueHistory = [], onClose, onSuccess, showToast, token }) {
  const [paymentAmount, setPaymentAmount] = useState('');
  const [paymentMethod, setPaymentMethod] = useState('Cash');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  // Get unpaid months from dueHistory (monthly fee entries only)
  const unpaidMonths = memberDueHistory.filter(e => e.type === 'Due' && e.reason?.startsWith('Monthly Fee') && !e.paid);
  const oldestUnpaid = unpaidMonths.length > 0 ? unpaidMonths[0] : null;
  const dueAmount = isMonthlyDue ? (oldestUnpaid?.amount || monthlyDue) : totalDue;

  useEffect(() => {
    if (isOpen) {
      setPaymentAmount(dueAmount.toString());
      setPaymentMethod('Cash');
      setError('');
    }
  }, [isOpen, dueAmount]);

  const handlePaymentAmountChange = (e) => {
    const value = e.target.value;
    setPaymentAmount(value);
    
    // Show warning if over due
    if (value && Number(value) > dueAmount) {
      setError(`Warning: Payment exceeds due (৳${dueAmount}). Excess will be saved as advance credit.`);
    } else {
      setError('');
    }
  };

  const handleCollectPayment = async () => {
    const amount = Number(paymentAmount) || 0;
    
    if (amount <= 0) {
      setError('Payment amount must be greater than 0');
      return;
    }

    if (!paymentMethod) {
      setError('Please select a payment method');
      return;
    }

    try {
      setLoading(true);
      setError('');

      // Use appropriate endpoint based on payment type
      const endpoint = isMonthlyDue ? `/memberships/${memberId}/pay-monthly` : `/memberships/${memberId}/pay-due`;

      const response = await apiRequest(endpoint, {
        method: 'POST',
        body: {
          paymentAmount: amount,
          paymentMethod
        },
        token
      });

      const paymentType = isMonthlyDue ? 'Monthly' : 'Admission Due';
      const monthInfo = isMonthlyDue && response.collectedMonthName ? ` (${response.collectedMonthName})` : '';
      showToast(`✅ ${paymentType} payment collected ৳${amount} via ${paymentMethod}${monthInfo}`);
      
      // Close modal and call success callback
      onClose();
      if (onSuccess) {
        onSuccess(response.member);
      }
    } catch (err) {
      setError(err.message || 'Failed to process payment');
      showToast(`❌ ${err.message}`);
    } finally {
      setLoading(false);
    }
  };

  const isValidAmount = paymentAmount && Number(paymentAmount) > 0;

  if (!isOpen || !memberId) return null;

  return (
    <div className="fixed inset-0 bg-black/30 flex items-center justify-center z-50 p-4">
      <div className="card p-6 max-w-md w-full shadow-lg max-h-[90vh] overflow-y-auto">
        <div className="flex items-center justify-between mb-6">
          <h2 className="text-2xl font-bold">{isMonthlyDue ? 'Collect Monthly Due' : 'Collect Payment'}</h2>
          <button
            onClick={onClose}
            disabled={loading}
            className="text-gray-500 hover:text-gray-700 text-2xl leading-none disabled:opacity-50"
          >
            ✕
          </button>
        </div>

        <div className="space-y-5">
          {/* Member Info */}
          <div>
            <p className="text-sm text-gray-600">Member</p>
            <p className="font-semibold text-lg">{memberName}</p>
          </div>

          {/* Monthly Due - Show month being collected */}
          {isMonthlyDue && oldestUnpaid && (
            <div className="bg-primary/5 border border-primary/20 rounded-lg p-4">
              <p className="text-sm text-primary">Collecting Month</p>
              <p className="text-2xl font-bold text-primary">{formatMonth(oldestUnpaid.month)}</p>
              <p className="text-sm text-primary mt-1">Amount: ৳{oldestUnpaid.amount?.toLocaleString()}</p>
            </div>
          )}

          {/* Unpaid Months List */}
          {isMonthlyDue && unpaidMonths.length > 0 && (
            <div className="bg-orange-50 border border-orange-200 rounded-lg p-3">
              <p className="text-xs font-semibold text-orange-700 mb-2">Unpaid Months ({unpaidMonths.length})</p>
              <div className="max-h-32 overflow-y-auto space-y-1">
                {unpaidMonths.map((entry, i) => (
                  <div key={i} className={`flex justify-between text-xs px-2 py-1 rounded ${i === 0 ? 'bg-orange-100 font-semibold' : ''}`}>
                    <span>{formatMonth(entry.month)}{i === 0 ? ' ← collecting' : ''}</span>
                    <span>৳{entry.amount?.toLocaleString()}</span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Current Due Display (for non-monthly) */}
          {!isMonthlyDue && (
            <div className="bg-orange-50 border border-orange-200 rounded-lg p-4">
              <p className="text-sm text-orange-600">Current Due</p>
              <p className="text-3xl font-bold text-orange-700">৳{dueAmount}</p>
            </div>
          )}

          {/* Payment Amount Input */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Pay Amount
            </label>
            <input
              type="number"
              value={paymentAmount}
              onChange={handlePaymentAmountChange}
              disabled={loading || isMonthlyDue}
              placeholder="Enter payment amount"
              className="w-full border rounded-lg px-3 py-2 text-lg font-semibold disabled:opacity-50 disabled:bg-gray-50"
              min="1"
              step="100"
            />
            {!isMonthlyDue && paymentAmount && !error && (
              <p className="text-xs text-gray-500 mt-1">
                Remaining: ৳{Math.max(0, totalDue - Number(paymentAmount))}
              </p>
            )}
            {isMonthlyDue && (
              <p className="text-xs text-gray-500 mt-1">
                Monthly fee is fixed at ৳{oldestUnpaid?.amount?.toLocaleString() || monthlyDue}
              </p>
            )}
          </div>

          {/* Payment Method Selection */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Payment Method
            </label>
            <select
              value={paymentMethod}
              onChange={(e) => setPaymentMethod(e.target.value)}
              disabled={loading}
              className="w-full border rounded-lg px-3 py-2 disabled:opacity-50"
            >
              <option value="Cash">💵 Cash</option>
              <option value="Bank">🏦 Bank</option>
              <option value="bKash">📱 bKash</option>
            </select>
          </div>

          {/* Error/Warning Message */}
          {error && (
            <div className={`p-3 rounded-lg text-sm ${
              error.includes('Warning')
                ? 'bg-primary/5 text-primary border border-primary/20'
                : 'bg-red-50 text-red-700 border border-red-200'
            }`}>
              {error}
            </div>
          )}

          {/* Action Buttons */}
          <div className="flex flex-col sm:flex-row gap-3 pt-4 border-t">
            <button
              onClick={handleCollectPayment}
              disabled={loading || !isValidAmount || !paymentMethod}
              className="flex-1 btn-primary disabled:opacity-50 min-h-[44px]"
            >
              {loading ? '⏳ Processing...' : '✅ Collect Payment'}
            </button>
            <button
              onClick={onClose}
              disabled={loading}
              className="flex-1 px-4 py-2 rounded-lg bg-gray-200 hover:bg-gray-300 text-gray-800 font-medium disabled:opacity-50 min-h-[44px]"
            >
              Cancel
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
