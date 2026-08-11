import React, { useState, useEffect } from 'react';
import { CircleDollarSign, AlertTriangle } from 'lucide-react';
import { apiRequest } from '../api.js';
import Modal from './Modal';
import Button from './Button';

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

      showToast(`Payment collected ৳${amount} via ${paymentMethod}`);

      // Close modal and call success callback
      onClose();
      if (onSuccess) {
        onSuccess(response.student);
      }
    } catch (err) {
      setError(err.message || 'Failed to process payment');
      showToast(err.message || 'Failed to process payment');
    } finally {
      setLoading(false);
    }
  };

  const isValidAmount = paymentAmount && Number(paymentAmount) > 0;

  if (!isOpen || !studentId) return null;

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title="Collect payment"
      size="sm"
      footer={
        <>
          <Button variant="secondary" onClick={onClose} disabled={loading}>Cancel</Button>
          <Button onClick={handleCollectPayment} disabled={!isValidAmount} loading={loading} icon={CircleDollarSign}>
            Collect
          </Button>
        </>
      }
    >
      <div className="space-y-5">
        {/* Student Info */}
        <div>
          <p className="text-sm text-ink-soft">Student name</p>
          <p className="font-semibold text-lg text-ink">{studentName}</p>
        </div>

        {/* Current Due Display */}
        <div className="bg-warning-soft border border-warning/20 rounded-card p-4">
          <p className="text-sm text-warning-ink">Current due</p>
          <p className="text-3xl font-bold text-warning-ink tabular">৳{currentDue?.toLocaleString()}</p>
        </div>

        {/* Payment Amount */}
        <div>
          <label className="label">Payment amount (৳)</label>
          <input
            type="number"
            value={paymentAmount}
            onChange={handlePaymentAmountChange}
            placeholder="Enter payment amount"
            min="0"
            step="100"
            disabled={loading}
            className="input text-lg font-semibold"
          />
          {paymentAmount && (
            <p className="field-hint">
              Balance after payment: ৳{Math.max(0, currentDue - Number(paymentAmount)).toLocaleString()}
            </p>
          )}
        </div>

        {/* Payment Method */}
        <div>
          <label className="label">Payment method</label>
          <select
            value={paymentMethod}
            onChange={(e) => setPaymentMethod(e.target.value)}
            disabled={loading}
            className="select"
          >
            <option value="Cash">Cash</option>
            <option value="Bank">Bank Transfer</option>
            <option value="bKash">bKash</option>
          </select>
        </div>

        {/* Error Message */}
        {error && (
          <div className={`flex items-start gap-2 p-3 rounded-control text-sm ${error.includes('Warning') ? 'bg-warning-soft text-warning-ink border border-warning/20' : 'bg-danger-soft text-danger-ink border border-danger/20'}`}>
            <AlertTriangle size={15} className="flex-shrink-0 mt-0.5" />
            <span>{error}</span>
          </div>
        )}
      </div>
    </Modal>
  );
}
