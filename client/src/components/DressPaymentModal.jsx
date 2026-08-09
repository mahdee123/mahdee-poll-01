import React, { useState } from 'react';
import { apiRequest } from '../api';
import Toast from './Toast';

export default function DressPaymentModal({ isOpen, rental, token, onClose, onSuccess }) {
  const [loading, setLoading] = useState(false);
  const [toast, setToast] = useState(null);
  const [paymentMethod, setPaymentMethod] = useState('Cash');
  const [notes, setNotes] = useState('');

  const handlePayment = async () => {
    try {
      setLoading(true);
      if (rental.transactionId) {
        await apiRequest(`/dress-rentals/payment/${rental.transactionId}`, {
          method: 'POST',
          body: {
            amount: rental.chargeAmount,
            paymentMethod,
            notes,
          },
          token,
        });
      }

      setToast({
        type: 'success',
        message: 'Payment recorded successfully',
      });

      setTimeout(() => {
        onSuccess();
      }, 1000);
    } catch (error) {
      console.error('Error recording payment:', error);
      setToast({
        type: 'error',
        message: error.message || 'Failed to record payment',
      });
    } finally {
      setLoading(false);
    }
  };

  if (!isOpen) return null;

  if (!rental) {
    return (
      <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
        <div className="bg-white rounded-lg shadow-xl max-w-md w-full mx-4 p-6">
          <p className="text-gray-600">No active rental found for this dress</p>
          <button
            onClick={onClose}
            className="mt-4 px-4 py-2 bg-gray-300 text-gray-700 rounded-lg hover:bg-gray-400 transition-colors"
          >
            Close
          </button>
        </div>
      </div>
    );
  }

  const isPaid = rental.paymentStatus === 'Paid';

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
      <div className="bg-white rounded-lg shadow-xl max-w-md w-full mx-4">
        <div className="border-b border-gray-200 p-4 flex justify-between items-center">
          <h2 className="text-xl font-bold text-gray-900">
            {isPaid ? '💳 Payment Details' : '💰 Collect Payment'}
          </h2>
          <button
            onClick={onClose}
            className="text-gray-500 hover:text-gray-700 text-2xl leading-none min-h-[44px] min-w-[44px] flex items-center justify-center"
          >
            ×
          </button>
        </div>

        <div className="p-6 space-y-6">
          <div className="bg-gray-50 rounded-lg p-4 space-y-3">
            <div className="flex justify-between">
              <span className="text-gray-600">Dress:</span>
              <span className="font-semibold text-gray-900">{rental.dressNumber}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-gray-600">Type:</span>
              <span className="font-semibold text-gray-900">{rental.dressType}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-gray-600">Member:</span>
              <span className="font-semibold text-gray-900">{rental.memberName}</span>
            </div>
          </div>

          <div className={`rounded-lg p-4 ${isPaid ? 'bg-green-50' : 'bg-red-50'}`}>
            <div className="flex justify-between items-center">
              <span className="text-gray-600">Amount:</span>
              <span className={`font-bold text-lg ${isPaid ? 'text-green-600' : 'text-red-600'}`}>
                ৳{rental.chargeAmount}
              </span>
            </div>
            <div className="mt-2 text-sm">
              <span className={`px-2 py-1 rounded ${isPaid ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'}`}>
                {isPaid ? 'Paid' : 'Due'}
              </span>
            </div>
          </div>

          {!isPaid && (
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Payment Method
                </label>
                <select
                  value={paymentMethod}
                  onChange={(e) => setPaymentMethod(e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary outline-none"
                >
                  <option value="Cash">Cash</option>
                  <option value="bKash">bKash</option>
                  <option value="Bank">Bank Transfer</option>
                </select>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Notes (Optional)
                </label>
                <textarea
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  rows={2}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary outline-none"
                  placeholder="Add payment notes..."
                />
              </div>
            </div>
          )}

          {isPaid && (
            <div className="bg-green-50 border border-green-200 rounded-lg p-4">
              <p className="text-sm text-green-700">
                ✅ This dress rental payment has been recorded. No further action needed.
              </p>
            </div>
          )}
        </div>

        <div className="border-t border-gray-200 p-4 flex gap-3 justify-end">
          <button
            onClick={onClose}
            className="px-4 py-2 text-gray-700 border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors"
          >
            {isPaid ? 'Close' : 'Cancel'}
          </button>
          {!isPaid && (
            <button
              onClick={handlePayment}
              disabled={loading}
              className="px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 disabled:bg-gray-400 transition-colors"
            >
              {loading ? 'Processing...' : 'Record Payment'}
            </button>
          )}
        </div>
      </div>

      {toast && (
        <Toast
          type={toast.type}
          message={toast.message}
          onClose={() => setToast(null)}
        />
      )}
    </div>
  );
}
