import React, { useState } from 'react';
import { CircleDollarSign, CheckCircle2 } from 'lucide-react';
import { apiRequest } from '../api';
import Toast from './Toast';
import Modal from './Modal';
import Button from './Button';

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
          body: { amount: rental.chargeAmount, paymentMethod, notes },
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

  if (!isOpen) return null;

  if (!rental) {
    return (
      <Modal isOpen onClose={onClose} title="Payment" size="sm" footer={<Button variant="secondary" onClick={onClose}>Close</Button>}>
        <p className="text-sm text-ink-soft">No active rental found for this dress.</p>
      </Modal>
    );
  }

  const isPaid = rental.paymentStatus === 'Paid';

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
          <div className="bg-canvas rounded-card p-4 space-y-2">
            <div className="flex justify-between text-sm">
              <span className="text-ink-soft">Dress</span>
              <span className="font-semibold text-ink">{rental.dressNumber}</span>
            </div>
            <div className="flex justify-between text-sm">
              <span className="text-ink-soft">Type</span>
              <span className="font-semibold text-ink">{rental.dressType}</span>
            </div>
            <div className="flex justify-between text-sm">
              <span className="text-ink-soft">Member</span>
              <span className="font-semibold text-ink">{rental.memberName}</span>
            </div>
          </div>

          <div className={`rounded-card p-4 ${isPaid ? 'bg-success-soft' : 'bg-danger-soft'}`}>
            <div className="flex justify-between items-center">
              <span className="text-ink-soft text-sm">Amount</span>
              <span className={`font-bold text-lg tabular ${isPaid ? 'text-success' : 'text-danger'}`}>
                ৳{rental.chargeAmount}
              </span>
            </div>
            <div className="mt-2">
              <span className={isPaid ? 'badge-success' : 'badge-danger'}>{isPaid ? 'Paid' : 'Due'}</span>
            </div>
          </div>

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

          {isPaid && (
            <div className="flex items-start gap-2 bg-success-soft border border-success/20 rounded-card p-4">
              <CheckCircle2 size={16} className="text-success flex-shrink-0 mt-0.5" />
              <p className="text-sm text-success-ink">
                This dress rental payment has been recorded. No further action needed.
              </p>
            </div>
          )}
        </div>
      </Modal>

      {toast && <Toast type={toast.type} message={toast.message} onClose={() => setToast(null)} />}
    </>
  );
}
