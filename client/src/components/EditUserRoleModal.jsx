import { useState } from 'react';
import { X } from 'lucide-react';
import Button from './Button';

const PERMISSIONS = [
  { key: 'members', label: 'Member Access', desc: 'View, Create, Edit, Delete Members' },
  { key: 'packages', label: 'Packages Access', desc: 'View Packages (Edit requires Admin)' },
  { key: 'bills', label: 'Billing Access', desc: 'Create, View, Delete Bills' },
  { key: 'training', label: 'Training Access', desc: 'View Dashboard Only' },
  { key: 'lockers', label: 'Locker Access', desc: 'Assign/Return Lockers' },
  { key: 'dress-rentals', label: 'Dress Rental Access', desc: 'Assign/Return Dresses' },
  { key: 'beverages', label: 'Beverage Access', desc: 'Create Products/Sales, View' },
  { key: 'cash-movements', label: 'Cash Movement Access', desc: 'Create/View Movements' },
  { key: 'reconciliation', label: 'Reconciliation Access', desc: 'View Daily Balances' },
  { key: 'accounting', label: 'Accounting Access', desc: 'View Accounts & Reports' },
  { key: 'reports', label: 'Reports Access', desc: 'View All Reports' },
];

export default function EditUserRoleModal({ isOpen, onClose, user, onSave, loading = false }) {
  const [role, setRole] = useState(user?.role || 'manager');
  const [permissions, setPermissions] = useState(user?.permissions || ['bills', 'training', 'reports']);
  const [error, setError] = useState('');

  const togglePermission = (key) => {
    setPermissions(prev =>
      prev.includes(key) ? prev.filter(p => p !== key) : [...prev, key]
    );
  };

  const handleSubmit = async (e) => {
    e.preventDefault();

    if (role === user?.role && JSON.stringify(permissions) === JSON.stringify(user?.permissions)) {
      setError('No changes made');
      return;
    }

    try {
      await onSave(user?.id, role, permissions);
    } catch (err) {
      setError(err.message || 'Failed to update');
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
      <div className="bg-white rounded-lg shadow-xl max-w-md w-full mx-4 max-h-[90vh] overflow-y-auto">
        <div className="flex items-center justify-between p-6 border-b border-gray-200">
          <h2 className="text-xl font-bold text-gray-800">Edit User Role</h2>
          <button onClick={onClose} className="text-gray-500 hover:text-gray-700"><X size={24} /></button>
        </div>

        <form onSubmit={handleSubmit} className="p-6">
          {error && (
            <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-lg mb-4">{error}</div>
          )}

          <p className="text-sm text-gray-600 mb-4">
            <span className="font-semibold text-gray-800">{user?.name}</span> ({user?.email})
          </p>

          {/* Role Selection */}
          <div className="mb-4">
            <label className="block text-sm font-semibold text-gray-700 mb-3">Select Role</label>
            <div className="space-y-2">
              <label className="flex items-center p-3 border border-gray-200 rounded-lg cursor-pointer hover:bg-gray-50">
                <input type="radio" name="role" value="admin" checked={role === 'admin'}
                  onChange={(e) => setRole(e.target.value)} className="w-4 h-4" disabled={loading} />
                <div className="ml-3">
                  <div className="font-semibold text-gray-800">Admin</div>
                  <div className="text-xs text-gray-600">Full access to all features</div>
                </div>
              </label>
              <label className="flex items-center p-3 border border-gray-200 rounded-lg cursor-pointer hover:bg-gray-50">
                <input type="radio" name="role" value="manager" checked={role === 'manager'}
                  onChange={(e) => setRole(e.target.value)} className="w-4 h-4" disabled={loading} />
                <div className="ml-3">
                  <div className="font-semibold text-gray-800">Manager</div>
                  <div className="text-xs text-gray-600">Custom access below</div>
                </div>
              </label>
            </div>
          </div>

          {/* Permissions (only for managers) */}
          {role === 'manager' && (
            <div className="mb-4">
              <label className="block text-sm font-semibold text-gray-700 mb-3">Permissions</label>
              <div className="grid grid-cols-1 gap-2">
                {PERMISSIONS.map((p) => (
                  <label key={p.key} className="flex items-center gap-3 p-2.5 border border-gray-200 rounded-lg cursor-pointer hover:bg-gray-50">
                    <input
                      type="checkbox"
                      checked={permissions.includes(p.key)}
                      onChange={() => togglePermission(p.key)}
                      className="w-4 h-4 rounded"
                      disabled={loading}
                    />
                    <div className="flex-1">
                      <span className="text-sm font-medium text-gray-800">{p.label}</span>
                      <span className="text-xs text-gray-500 ml-2">{p.desc}</span>
                    </div>
                  </label>
                ))}
              </div>
            </div>
          )}

          <div className="flex gap-3 justify-end pt-4 border-t border-gray-200">
            <Button onClick={onClose} variant="secondary" disabled={loading}>Cancel</Button>
            <Button type="submit" variant="primary" loading={loading}>Update</Button>
          </div>
        </form>
      </div>
    </div>
  );
}
