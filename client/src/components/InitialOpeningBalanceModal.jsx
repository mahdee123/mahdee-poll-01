import { useState } from 'react';
import { AlertTriangle } from 'lucide-react';
import Modal from './Modal';
import Button from './Button';

export default function InitialOpeningBalanceModal({ isOpen, onSubmit, isLoading }) {
  const [amount, setAmount] = useState('');
  const [note, setNote] = useState('');
  const [error, setError] = useState('');

  const handleSubmit = (e) => {
    e.preventDefault();
    setError('');

    if (!amount || amount === '') {
      setError('Please enter the opening balance amount');
      return;
    }

    const numAmount = parseFloat(amount);
    if (isNaN(numAmount) || numAmount < 0) {
      setError('Opening balance must be a valid positive number');
      return;
    }

    onSubmit({ amount: numAmount, note });
    setAmount('');
    setNote('');
  };

  if (!isOpen) return null;

  return (
    <Modal
      isOpen
      onClose={() => {}}
      showClose={false}
      closeOnBackdrop={false}
      title="Set opening balance"
      description="Enter your initial cash balance for the business. This amount will be set once and cannot be changed."
      size="sm"
    >
      {error && (
        <div className="bg-danger-soft border border-danger/20 text-danger-ink px-4 py-3 rounded-control mb-4 text-sm">
          {error}
        </div>
      )}

      <form onSubmit={handleSubmit} className="space-y-4">
        <div>
          <label className="label">Opening balance amount *</label>
          <div className="relative">
            <span className="absolute left-3 top-1/2 -translate-y-1/2 text-ink-soft font-semibold">৳</span>
            <input
              type="number"
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
              placeholder="0"
              className="input pl-8"
              disabled={isLoading}
              step="0.01"
              min="0"
              autoFocus
            />
          </div>
          <p className="field-hint">Enter the cash you have at the start</p>
        </div>

        <div>
          <label className="label">Note (optional)</label>
          <textarea
            value={note}
            onChange={(e) => setNote(e.target.value)}
            placeholder="e.g., Bank balance + Cash in hand"
            rows="3"
            className="textarea"
            disabled={isLoading}
          />
        </div>

        <Button type="submit" loading={isLoading} className="w-full">
          Set opening balance
        </Button>

        <p className="flex items-center justify-center gap-1.5 text-xs text-ink-soft text-center">
          <AlertTriangle size={12} className="flex-shrink-0" />
          This action cannot be undone. The opening balance will be locked after setting.
        </p>
      </form>
    </Modal>
  );
}
