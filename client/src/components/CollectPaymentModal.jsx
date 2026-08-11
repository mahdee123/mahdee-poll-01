import { useState, useEffect } from 'react';
import { CircleDollarSign, AlertTriangle } from 'lucide-react';
import { apiRequest } from '../api.js';
import Modal from './Modal';
import Button from './Button';

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
      showToast(`${paymentType} payment collected ৳${amount} via ${paymentMethod}${monthInfo}`);

      // Close modal and call success callback
      onClose();
      if (onSuccess) {
        onSuccess(response.member);
      }
    } catch (err) {
      setError(err.message || 'Failed to process payment');
      showToast(err.message || 'Failed to process payment');
    } finally {
      setLoading(false);
    }
  };

  const isValidAmount = paymentAmount && Number(paymentAmount) > 0;

  if (!isOpen || !memberId) return null;

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title={isMonthlyDue ? 'Collect monthly due' : 'Collect payment'}
      size="sm"
      footer={
        <>
          <Button variant="secondary" onClick={onClose} disabled={loading}>Cancel</Button>
          <Button
            onClick={handleCollectPayment}
            disabled={!isValidAmount || !paymentMethod}
            loading={loading}
            icon={CircleDollarSign}
          >
            Collect payment
          </Button>
        </>
      }
    >
      <div className="space-y-5">
        {/* Member Info */}
        <div>
          <p className="text-sm text-ink-soft">Member</p>
          <p className="font-semibold text-lg text-ink">{memberName}</p>
        </div>

        {/* Monthly Due - Show month being collected */}
        {isMonthlyDue && oldestUnpaid && (
          <div className="bg-primary-50 border border-primary/20 rounded-card p-4">
            <p className="text-sm text-primary">Collecting month</p>
            <p className="text-2xl font-bold text-primary">{formatMonth(oldestUnpaid.month)}</p>
            <p className="text-sm text-primary mt-1">Amount: ৳{oldestUnpaid.amount?.toLocaleString()}</p>
          </div>
        )}

        {/* Unpaid Months List */}
        {isMonthlyDue && unpaidMonths.length > 0 && (
          <div className="bg-warning-soft border border-warning/20 rounded-card p-3">
            <p className="text-xs font-semibold text-warning-ink mb-2">Unpaid months ({unpaidMonths.length})</p>
            <div className="max-h-32 overflow-y-auto space-y-1">
              {unpaidMonths.map((entry, i) => (
                <div key={i} className={`flex justify-between text-xs px-2 py-1 rounded-control ${i === 0 ? 'bg-warning/15 font-semibold' : ''}`}>
                  <span>{formatMonth(entry.month)}{i === 0 ? ' ← collecting' : ''}</span>
                  <span className="tabular">৳{entry.amount?.toLocaleString()}</span>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Current Due Display (for non-monthly) */}
        {!isMonthlyDue && (
          <div className="bg-warning-soft border border-warning/20 rounded-card p-4">
            <p className="text-sm text-warning-ink">Current due</p>
            <p className="text-3xl font-bold text-warning-ink tabular">৳{dueAmount}</p>
          </div>
        )}

        {/* Payment Amount Input */}
        <div>
          <label className="label">Pay amount</label>
          <input
            type="number"
            value={paymentAmount}
            onChange={handlePaymentAmountChange}
            disabled={loading || isMonthlyDue}
            placeholder="Enter payment amount"
            className="input text-lg font-semibold"
            min="1"
            step="100"
          />
          {!isMonthlyDue && paymentAmount && !error && (
            <p className="field-hint">
              Remaining: ৳{Math.max(0, totalDue - Number(paymentAmount))}
            </p>
          )}
          {isMonthlyDue && (
            <p className="field-hint">
              Monthly fee is fixed at ৳{oldestUnpaid?.amount?.toLocaleString() || monthlyDue}
            </p>
          )}
        </div>

        {/* Payment Method Selection */}
        <div>
          <label className="label">Payment method</label>
          <select
            value={paymentMethod}
            onChange={(e) => setPaymentMethod(e.target.value)}
            disabled={loading}
            className="select"
          >
            <option value="Cash">Cash</option>
            <option value="Bank">Bank</option>
            <option value="bKash">bKash</option>
          </select>
        </div>

        {/* Error/Warning Message */}
        {error && (
          <div className={`flex items-start gap-2 p-3 rounded-control text-sm ${
            error.includes('Warning')
              ? 'bg-primary-50 text-primary border border-primary/20'
              : 'bg-danger-soft text-danger-ink border border-danger/20'
          }`}>
            <AlertTriangle size={15} className="flex-shrink-0 mt-0.5" />
            <span>{error}</span>
          </div>
        )}
      </div>
    </Modal>
  );
}
