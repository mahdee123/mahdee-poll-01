import { useState } from 'react';
import { X, AlertTriangle } from 'lucide-react';
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
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
      <div className="bg-white rounded-lg shadow-xl max-w-md w-full mx-4">
        {/* Header */}
        <div className="flex items-center gap-3 p-6 border-b border-gray-200 bg-red-50">
          <AlertTriangle size={24} className="text-red-600" />
          <h2 className="text-xl font-bold text-red-800">Remove User</h2>
          <button
            onClick={onClose}
            className="ml-auto text-gray-500 hover:text-gray-700"
          >
            <X size={24} />
          </button>
        </div>

        {/* Content */}
        <form onSubmit={handleSubmit} className="p-6">
          {error && (
            <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-lg mb-4">
              {error}
            </div>
          )}

          <div className="mb-6 p-4 bg-gray-50 rounded-lg border border-gray-200">
            <p className="text-sm text-gray-700">
              You are about to remove <span className="font-bold text-gray-900">{user?.name}</span> from the company.
            </p>
            <p className="text-sm text-gray-600 mt-2">
              This action cannot be undone. They will lose access to all company data.
            </p>
          </div>

          <div className="mb-4">
            <label className="block text-sm font-semibold text-gray-700 mb-2">
              Confirm Your Password
            </label>
            <div className="relative">
              <input
                type={showPassword ? 'text' : 'password'}
                value={password}
                onChange={(e) => {
                  setPassword(e.target.value);
                  setError('');
                }}
                placeholder="Enter your password"
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-red-500 focus:border-transparent"
                disabled={loading}
              />
              <button
                type="button"
                onClick={() => setShowPassword(!showPassword)}
                className="absolute right-3 top-1/2 transform -translate-y-1/2 text-gray-500 hover:text-gray-700"
              >
                {showPassword ? '👁️' : '👁️‍🗨️'}
              </button>
            </div>
            <p className="text-xs text-gray-600 mt-1">
              This is required for security purposes
            </p>
          </div>

          {/* Footer */}
          <div className="flex gap-3 justify-end">
            <Button
              onClick={onClose}
              variant="secondary"
              disabled={loading}
            >
              Cancel
            </Button>
            <Button
              type="submit"
              variant="danger"
              loading={loading}
            >
              Remove User
            </Button>
          </div>
        </form>
      </div>
    </div>
  );
}
