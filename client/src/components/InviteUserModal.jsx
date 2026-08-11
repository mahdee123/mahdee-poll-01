import { useState } from 'react';
import { Eye, EyeOff } from 'lucide-react';
import Modal from './Modal';
import Button from './Button';

export default function InviteUserModal({ isOpen, onClose, onInvite, loading }) {
  const [formData, setFormData] = useState({
    managerEmail: '',
    managerName: '',
    managerPassword: ''
  });
  const [error, setError] = useState('');
  const [showPassword, setShowPassword] = useState(false);

  const handleChange = (e) => {
    const { name, value } = e.target;
    setFormData(prev => ({
      ...prev,
      [name]: value
    }));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');

    if (!formData.managerEmail.trim()) {
      setError('Email is required');
      return;
    }
    if (!formData.managerName.trim()) {
      setError('Name is required');
      return;
    }
    if (!formData.managerPassword.trim()) {
      setError('Password is required');
      return;
    }
    if (formData.managerPassword.length < 6) {
      setError('Password must be at least 6 characters');
      return;
    }

    try {
      await onInvite(formData);
      setFormData({ managerEmail: '', managerName: '', managerPassword: '' });
      onClose();
    } catch (err) {
      setError(err.message || 'Failed to create manager account');
    }
  };

  if (!isOpen) return null;

  return (
    <Modal
      isOpen
      onClose={onClose}
      title="Create manager account"
      description="Create a manager account to help manage your pool membership business."
      size="sm"
      footer={
        <>
          <Button variant="secondary" onClick={onClose} disabled={loading}>Cancel</Button>
          <Button type="submit" form="invite-user-form" loading={loading}>Create account</Button>
        </>
      }
    >
      {error && (
        <div className="bg-danger-soft border border-danger/20 text-danger-ink px-4 py-3 rounded-control mb-4 text-sm">
          {error}
        </div>
      )}

      <form id="invite-user-form" onSubmit={handleSubmit} className="space-y-4">
        <div>
          <label className="label">Manager name</label>
          <input
            type="text"
            name="managerName"
            value={formData.managerName}
            onChange={handleChange}
            placeholder="Full name"
            className="input"
            disabled={loading}
          />
        </div>

        <div>
          <label className="label">Email address</label>
          <input
            type="email"
            name="managerEmail"
            value={formData.managerEmail}
            onChange={handleChange}
            placeholder="manager@example.com"
            className="input"
            disabled={loading}
          />
          <p className="field-hint">Email must be unique</p>
        </div>

        <div>
          <label className="label">Password</label>
          <div className="relative">
            <input
              type={showPassword ? 'text' : 'password'}
              name="managerPassword"
              value={formData.managerPassword}
              onChange={handleChange}
              placeholder="Minimum 6 characters"
              className="input pr-10"
              disabled={loading}
            />
            <button
              type="button"
              onClick={() => setShowPassword(!showPassword)}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-ink-soft hover:text-ink"
              disabled={loading}
              aria-label={showPassword ? 'Hide password' : 'Show password'}
            >
              {showPassword ? <EyeOff size={16} /> : <Eye size={16} />}
            </button>
          </div>
          <p className="field-hint">At least 6 characters</p>
        </div>
      </form>
    </Modal>
  );
}
