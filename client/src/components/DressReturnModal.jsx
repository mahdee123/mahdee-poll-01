import React, { useState } from 'react';
import { Undo2, AlertTriangle } from 'lucide-react';
import { apiRequest } from '../api';
import Toast from './Toast';
import Modal from './Modal';
import Button from './Button';

export default function DressReturnModal({ isOpen, dress, rental, token, onClose, onSuccess }) {
  const [loading, setLoading] = useState(false);
  const [toast, setToast] = useState(null);

  const calculateDuration = () => {
    if (!rental) return '—';
    const assigned = new Date(rental.assignedTime);
    const now = new Date();
    const diffMs = now - assigned;
    const diffMins = Math.floor(diffMs / 60000);

    if (diffMins < 60) {
      return `${diffMins} min`;
    }
    const diffHours = Math.floor(diffMins / 60);
    return `${diffHours}h ${diffMins % 60}m`;
  };

  const handleReturn = async () => {
    try {
      setLoading(true);
      await apiRequest(`/dress-rentals/${dress._id}/return`, { method: 'POST', token });

      setToast({ type: 'success', message: 'Dress returned successfully' });
      setTimeout(() => onSuccess(), 1000);
    } catch (error) {
      console.error('Error returning dress:', error);
      setToast({ type: 'error', message: error.message || 'Failed to return dress' });
    } finally {
      setLoading(false);
    }
  };

  if (!isOpen) return null;

  if (!rental) {
    return (
      <Modal isOpen onClose={onClose} title="Return dress" size="sm" footer={<Button variant="secondary" onClick={onClose}>Close</Button>}>
        <p className="text-sm text-ink-soft">No active rental found for this dress.</p>
      </Modal>
    );
  }

  return (
    <>
      <Modal
        isOpen
        onClose={onClose}
        title="Return dress"
        size="sm"
        footer={
          <>
            <Button variant="secondary" onClick={onClose}>Cancel</Button>
            <Button variant="danger" onClick={handleReturn} loading={loading} icon={Undo2}>Confirm return</Button>
          </>
        }
      >
        <div className="space-y-5">
          <div className="bg-canvas rounded-card p-4 space-y-2">
            <div className="flex justify-between text-sm">
              <span className="text-ink-soft">Dress</span>
              <span className="font-semibold text-ink">{dress.dressNumber}</span>
            </div>
            <div className="flex justify-between text-sm">
              <span className="text-ink-soft">Type</span>
              <span className="font-semibold text-ink">{dress.type}</span>
            </div>
          </div>

          <div className="bg-primary-50 rounded-card p-4 space-y-2">
            <div className="flex justify-between text-sm">
              <span className="text-ink-soft">Member</span>
              <span className="font-semibold text-ink">{rental.memberName}</span>
            </div>
            <div className="flex justify-between text-sm">
              <span className="text-ink-soft">Phone</span>
              <span className="font-semibold text-ink">{rental.memberPhone}</span>
            </div>
          </div>

          <div className="bg-warning-soft rounded-card p-4 space-y-2">
            <div className="flex justify-between text-sm">
              <span className="text-ink-soft">Assigned time</span>
              <span className="font-semibold text-ink">{new Date(rental.assignedTime).toLocaleString()}</span>
            </div>
            <div className="flex justify-between text-sm">
              <span className="text-ink-soft">Duration</span>
              <span className="font-semibold text-ink">{calculateDuration()}</span>
            </div>
          </div>

          {rental.chargeAmount > 0 && (
            <div className="bg-success-soft rounded-card p-4">
              <div className="flex justify-between items-center">
                <span className="text-ink-soft text-sm">Charge</span>
                <span className="font-bold text-success text-lg tabular">৳{rental.chargeAmount}</span>
              </div>
              <div className="mt-2 text-xs text-ink-soft">
                Charge type: {rental.chargeType === 'SeparateTransaction' ? 'Separate Transaction' : 'Added to Bill'}
              </div>
            </div>
          )}

          {rental.notes && (
            <div className="bg-canvas rounded-card p-4">
              <div className="text-sm text-ink-soft mb-1">Notes</div>
              <p className="text-sm text-ink">{rental.notes}</p>
            </div>
          )}

          <div className="flex items-start gap-2 bg-danger-soft border border-danger/20 rounded-card p-4">
            <AlertTriangle size={16} className="text-danger flex-shrink-0 mt-0.5" />
            <p className="text-sm text-danger-ink">
              Confirming return will mark this dress as <strong>Available</strong> and close this session.
            </p>
          </div>
        </div>
      </Modal>

      {toast && <Toast type={toast.type} message={toast.message} onClose={() => setToast(null)} />}
    </>
  );
}
