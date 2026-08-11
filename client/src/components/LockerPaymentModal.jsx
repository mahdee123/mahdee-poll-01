import React, { useState, useEffect } from 'react';
import { CreditCard, CircleDollarSign, CheckCircle2 } from 'lucide-react';
import { apiRequest } from '../api';
import Toast from './Toast';
import Modal from './Modal';
import Button from './Button';

export default function LockerPaymentModal({ token, locker, onClose, onSuccess }) {
  const [loading, setLoading] = useState(false);
  const [assignment, setAssignment] = useState(null);
  const [toast, setToast] = useState(null);
  const [paymentMethod, setPaymentMethod] = useState('Cash');
  const [notes, setNotes] = useState('');

  useEffect(() => {
    if (locker.assignment) {
      setAssignment(locker.assignment);
    }
  }, [locker]);

  const handlePayment = async () => {
    try {
      setLoading(true);
      if (assignment.transactionId) {
        await apiRequest(`/transactions/${assignment.transactionId}/payment`, {
          method: 'POST',
          body: { amount: assignment.chargeAmount, paymentMethod, notes },
          token,
        });
      }

      setToast({ type: 'success', message: 'Payment recorded successfully' });
      setTimeout(() => onSuccess(), 1000);
    } catch (error) {
      console.error('Error recording payment:', error);
      setToast({ type: 'error', message: error.message || 'Failed to record payment' });
    } finally {
      setLoading(false);
    }
  };

  if (!assignment) {
    return (
      <Modal isOpen onClose={onClose} title="Payment" size="sm" footer={<Button variant="secondary" onClick={onClose}>Close</Button>}>
        <p className="text-sm text-ink-soft">No active assignment found for this locker.</p>
      </Modal>
    );
  }

  const isPaid = assignment.paymentStatus === 'Paid';

  return (
    <>
      <Modal
        isOpen
        onClose={onClose}
        title={isPaid ? 'Payment details' : 'Collect payment'}
        size="sm"
        footer={
          <>
            <Button variant="secondary" onClick={onClose}>{isPaid ? 'Close' : 'Cancel'}</Button>
            {!isPaid && (
              <Button onClick={handlePayment} loading={loading} icon={CircleDollarSign}>Record payment</Button>
            )}
          </>
        }
      >
        <div className="space-y-6">
          {/* Locker Info */}
          <div className="bg-canvas rounded-card p-4 space-y-2">
            <div className="flex justify-between text-sm">
              <span className="text-ink-soft">Locker</span>
              <span className="font-semibold text-ink">{locker.lockerNumber}</span>
            </div>
            <div className="flex justify-between text-sm">
              <span className="text-ink-soft">Member</span>
              <span className="font-semibold text-ink">{assignment.memberName}</span>
            </div>
          </div>

          {/* Payment Status */}
          <div className={`rounded-card p-4 ${isPaid ? 'bg-success-soft' : 'bg-danger-soft'}`}>
            <div className="flex justify-between items-center">
              <span className="text-ink-soft text-sm">Amount</span>
              <span className={`font-bold text-lg tabular ${isPaid ? 'text-success' : 'text-danger'}`}>
                ৳{assignment.chargeAmount}
              </span>
            </div>
            <div className="mt-2">
              <span className={isPaid ? 'badge-success' : 'badge-danger'}>{isPaid ? 'Paid' : 'Due'}</span>
            </div>
          </div>

          {/* Payment Form (only for Due) */}
          {!isPaid && (
            <div className="space-y-4">
              <div>
                <label className="label">Payment method</label>
                <select value={paymentMethod} onChange={(e) => setPaymentMethod(e.target.value)} className="select">
                  <option value="Cash">Cash</option>
                  <option value="bKash">bKash</option>
                  <option value="Bank">Bank Transfer</option>
                </select>
              </div>

              <div>
                <label className="label">Notes (optional)</label>
                <textarea
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  rows={2}
                  className="textarea"
                  placeholder="Add payment notes…"
                />
              </div>
            </div>
          )}

          {/* Paid Info */}
          {isPaid && (
            <div className="flex items-start gap-2 bg-success-soft border border-success/20 rounded-card p-4">
              <CheckCircle2 size={16} className="text-success flex-shrink-0 mt-0.5" />
              <p className="text-sm text-success-ink">
                This locker payment has been recorded. No further action needed.
              </p>
            </div>
          )}
        </div>
      </Modal>

      {toast && <Toast type={toast.type} message={toast.message} onClose={() => setToast(null)} />}
    </>
  );
}
