import { useState } from 'react';
import { X } from 'lucide-react';
import Button from './Button';

/**
 * Modal for editing user role
 */
export default function EditUserRoleModal({ isOpen, onClose, user, onSave, loading = false }) {
  const [role, setRole] = useState(user?.role || 'manager');
  const [error, setError] = useState('');

  const handleSubmit = async (e) => {
    e.preventDefault();
    
    if (role === user?.role) {
      setError('Please select a different role');
      return;
    }

    try {
      await onSave(user?.id, role);
      setRole(user?.role || 'manager');
    } catch (err) {
      setError(err.message || 'Failed to update user role');
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
      <div className="bg-white rounded-lg shadow-xl max-w-md w-full mx-4">
        {/* Header */}
        <div className="flex items-center justify-between p-6 border-b border-gray-200">
          <h2 className="text-xl font-bold text-gray-800">Change User Role</h2>
          <button
            onClick={onClose}
            className="text-gray-500 hover:text-gray-700"
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

          <div className="mb-4">
            <p className="text-sm text-gray-600 mb-3">
              <span className="font-semibold text-gray-800">{user?.name}</span> ({user?.email})
            </p>
          </div>

          <div className="mb-4">
            <label className="block text-sm font-semibold text-gray-700 mb-3">
              Select Role
            </label>
            <div className="space-y-2">
              <label className="flex items-center p-3 border border-gray-200 rounded-lg cursor-pointer hover:bg-gray-50">
                <input
                  type="radio"
                  name="role"
                  value="admin"
                  checked={role === 'admin'}
                  onChange={(e) => setRole(e.target.value)}
                  className="w-4 h-4"
                  disabled={loading}
                />
                <div className="ml-3">
                  <div className="font-semibold text-gray-800">Admin</div>
                  <div className="text-xs text-gray-600">Full access to company settings and management</div>
                </div>
              </label>

              <label className="flex items-center p-3 border border-gray-200 rounded-lg cursor-pointer hover:bg-gray-50">
                <input
                  type="radio"
                  name="role"
                  value="manager"
                  checked={role === 'manager'}
                  onChange={(e) => setRole(e.target.value)}
                  className="w-4 h-4"
                  disabled={loading}
                />
                <div className="ml-3">
                  <div className="font-semibold text-gray-800">Manager</div>
                  <div className="text-xs text-gray-600">Limited access to operational features</div>
                </div>
              </label>
            </div>
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
              variant="primary"
              loading={loading}
            >
              Update Role
            </Button>
          </div>
        </form>
      </div>
    </div>
  );
}
