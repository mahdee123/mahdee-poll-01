import React, { useState, useEffect } from 'react';
import { apiRequest } from '../api.js';

export default function TrainingPaymentModal({ isOpen, studentId, studentName, currentDue, onClose, onSuccess, showToast, token }) {
  const [paymentAmount, setPaymentAmount] = useState('');
  const [paymentMethod, setPaymentMethod] = useState('Cash');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    if (isOpen && currentDue) {
      setPaymentAmount(currentDue.toString());
      setPaymentMethod('Cash');
      setError('');
    }
  }, [isOpen, currentDue]);

  const handlePaymentAmountChange = (e) => {
    const value = e.target.value;
    setPaymentAmount(value);
    
    // Show warning if over due
    if (value && Number(value) > currentDue) {
      setError(`Warning: Payment exceeds due (৳${currentDue}). Extra will be saved as credit.`);
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

      const response = await apiRequest(`/training/students/${studentId}/pay-due`, {
        method: 'POST',
        body: {
          paymentAmount: amount,
          paymentMethod
        },
        token
      });

      showToast(`✅ Payment collected ৳${amount} via ${paymentMethod}`);
      
      // Close modal and call success callback
      onClose();
      if (onSuccess) {
        onSuccess(response.student);
      }
    } catch (err) {
      setError(err.message || 'Failed to process payment');
      showToast(`❌ ${err.message}`);
    } finally {
      setLoading(false);
    }
  };

  const isValidAmount = paymentAmount && Number(paymentAmount) > 0;

  if (!isOpen || !studentId) return null;

  return (
    <div className="fixed inset-0 bg-black/30 flex items-center justify-center z-50 p-4">
      <div className="card p-6 max-w-md w-full shadow-lg">
        <div className="flex items-center justify-between mb-6">
          <h2 className="text-2xl font-bold">💳 Collect Payment</h2>
          <button
            onClick={onClose}
            disabled={loading}
            className="text-gray-500 hover:text-gray-700 text-2xl leading-none disabled:opacity-50"
          >
            ✕
          </button>
        </div>

        <div className="space-y-5">
          {/* Student Info */}
          <div>
            <p className="text-sm text-gray-600">Student Name</p>
            <p className="font-semibold text-lg">{studentName}</p>
          </div>

          {/* Current Due Display */}
          <div className="bg-orange-50 border border-orange-200 rounded-lg p-4">
            <p className="text-sm text-orange-600">Current Due</p>
            <p className="text-3xl font-bold text-orange-700">৳{currentDue?.toLocaleString()}</p>
          </div>

          {/* Payment Amount */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Payment Amount (৳)
            </label>
            <input
              type="number"
              value={paymentAmount}
              onChange={handlePaymentAmountChange}
              placeholder="Enter payment amount"
              min="0"
              step="100"
              disabled={loading}
              className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 disabled:bg-gray-100 text-lg font-semibold"
            />
            {paymentAmount && (
              <p className="text-xs text-gray-500 mt-2">
                Balance after payment: ৳{Math.max(0, currentDue - Number(paymentAmount)).toLocaleString()}
              </p>
            )}
          </div>

          {/* Payment Method */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Payment Method
            </label>
            <select
              value={paymentMethod}
              onChange={(e) => setPaymentMethod(e.target.value)}
              disabled={loading}
              className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 disabled:bg-gray-100"
            >
              <option value="Cash">💵 Cash</option>
              <option value="Bank">🏦 Bank Transfer</option>
              <option value="bKash">📱 bKash</option>
            </select>
          </div>

          {/* Error Message */}
          {error && (
            <div className={`p-3 rounded-lg text-sm ${error.includes('Warning') ? 'bg-yellow-50 text-yellow-700 border border-yellow-200' : 'bg-red-50 text-red-700 border border-red-200'}`}>
              {error}
            </div>
          )}

          {/* Actions */}
          <div className="flex gap-3 pt-4">
            <button
              onClick={onClose}
              disabled={loading}
              className="flex-1 px-4 py-2 border border-gray-300 text-gray-700 font-medium rounded-lg hover:bg-gray-50 disabled:opacity-50"
            >
              Cancel
            </button>
            <button
              onClick={handleCollectPayment}
              disabled={!isValidAmount || loading}
              className="flex-1 px-4 py-2 bg-green-500 hover:bg-green-600 text-white font-medium rounded-lg disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {loading ? 'Processing...' : '✓ Collect'}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
