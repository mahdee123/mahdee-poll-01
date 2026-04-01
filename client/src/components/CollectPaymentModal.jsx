import React, { useState, useEffect } from 'react';
import { apiRequest } from '../api.js';

export default function CollectPaymentModal({ isOpen, memberId, memberName, totalDue, monthlyDue = 0, isMonthlyDue = false, onClose, onSuccess, showToast, token }) {
  const [paymentAmount, setPaymentAmount] = useState('');
  const [paymentMethod, setPaymentMethod] = useState('Cash');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  // Determine which due amount to use
  const dueAmount = isMonthlyDue ? monthlyDue : totalDue;

  useEffect(() => {
    if (isOpen && dueAmount) {
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

      const paymentType = isMonthlyDue ? 'Monthly Due' : 'Purchase Due';
      showToast(`✅ ${paymentType} payment collected ৳${amount} via ${paymentMethod}`);
      
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
      <div className="card p-6 max-w-md w-full shadow-lg">
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

          {/* Current Due Display */}
          <div className={`rounded-lg p-4 ${isMonthlyDue ? 'bg-blue-50 border border-blue-200' : 'bg-orange-50 border border-orange-200'}`}>
            <p className={`text-sm ${isMonthlyDue ? 'text-blue-600' : 'text-orange-600'}`}>{isMonthlyDue ? 'Monthly Due' : 'Current Due'}</p>
            <p className={`text-3xl font-bold ${isMonthlyDue ? 'text-blue-700' : 'text-orange-700'}`}>৳{dueAmount}</p>
          </div>

          {/* Payment Amount Input */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Pay Amount
            </label>
            <input
              type="number"
              value={paymentAmount}
              onChange={handlePaymentAmountChange}
              disabled={loading}
              placeholder="Enter payment amount"
              className="w-full border rounded-lg px-3 py-2 text-lg font-semibold disabled:opacity-50"
              min="1"
              step="100"
            />
            {paymentAmount && !error && (
              <p className="text-xs text-gray-500 mt-1">
                Remaining: ৳{Math.max(0, totalDue - Number(paymentAmount))}
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
                ? 'bg-blue-50 text-blue-700 border border-blue-200'
                : 'bg-red-50 text-red-700 border border-red-200'
            }`}>
              {error}
            </div>
          )}

          {/* Action Buttons */}
          <div className="flex gap-3 pt-4 border-t">
            <button
              onClick={handleCollectPayment}
              disabled={loading || !isValidAmount || !paymentMethod}
              className="flex-1 btn-primary disabled:opacity-50"
            >
              {loading ? '⏳ Processing...' : '✅ Collect Payment'}
            </button>
            <button
              onClick={onClose}
              disabled={loading}
              className="flex-1 px-4 py-2 rounded-lg bg-gray-200 hover:bg-gray-300 text-gray-800 font-medium disabled:opacity-50"
            >
              Cancel
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
