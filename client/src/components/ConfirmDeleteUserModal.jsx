import { useState } from 'react';
import { AlertTriangle, Eye, EyeOff } from 'lucide-react';
import Modal from './Modal';
import Button from './Button';

/**
 * Modal for confirming user deletion from company
 */
export default function ConfirmDeleteUserModal({ isOpen, onClose, user, onConfirm, loading = false }) {
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState('');

  const handleSubmit = async (e) => {
    e.preventDefault();

    if (!password) {
      setError('Password is required for security');
      return;
    }

    try {
      await onConfirm(user?.id, password);
      setPassword('');
      setShowPassword(false);
    } catch (err) {
      setError(err.message || 'Failed to remove user');
      setPassword('');
    }
  };

  if (!isOpen) return null;

  return (
    <Modal
      isOpen
      onClose={onClose}
      title="Remove user"
      size="sm"
      footer={
        <>
          <Button onClick={onClose} variant="secondary" disabled={loading}>Cancel</Button>
          <Button type="submit" form="confirm-delete-user-form" variant="danger" loading={loading}>Remove user</Button>
        </>
      }
    >
      <div className="flex items-start gap-3 -mt-1 mb-5">
        <div className="w-9 h-9 rounded-full bg-danger-soft flex items-center justify-center flex-shrink-0">
          <AlertTriangle size={18} className="text-danger" />
        </div>
      </div>

      <form id="confirm-delete-user-form" onSubmit={handleSubmit}>
        {error && (
          <div className="bg-danger-soft border border-danger/20 text-danger-ink px-4 py-3 rounded-control mb-4 text-sm">
            {error}
          </div>
        )}

        <div className="mb-6 p-4 bg-canvas rounded-card border border-line">
          <p className="text-sm text-ink">
            You are about to remove <span className="font-bold text-ink">{user?.name}</span> from the company.
          </p>
          <p className="text-sm text-ink-soft mt-2">
            This action cannot be undone. They will lose access to all company data.
          </p>
        </div>

        <div>
          <label className="label">Confirm your password</label>
          <div className="relative">
            <input
              type={showPassword ? 'text' : 'password'}
              value={password}
              onChange={(e) => {
                setPassword(e.target.value);
                setError('');
              }}
              placeholder="Enter your password"
              className="input pr-10"
              disabled={loading}
            />
            <button
              type="button"
              onClick={() => setShowPassword(!showPassword)}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-ink-soft hover:text-ink"
              aria-label={showPassword ? 'Hide password' : 'Show password'}
            >
              {showPassword ? <EyeOff size={16} /> : <Eye size={16} />}
            </button>
          </div>
          <p className="field-hint">This is required for security purposes</p>
        </div>
      </form>
    </Modal>
  );
}
