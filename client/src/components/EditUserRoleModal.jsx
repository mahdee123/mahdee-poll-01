import { useState } from 'react';
import Modal from './Modal';
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
    <Modal
      isOpen
      onClose={onClose}
      title="Edit user role"
      size="sm"
      footer={
        <>
          <Button onClick={onClose} variant="secondary" disabled={loading}>Cancel</Button>
          <Button type="submit" form="edit-user-role-form" variant="primary" loading={loading}>Update</Button>
        </>
      }
    >
      <form id="edit-user-role-form" onSubmit={handleSubmit}>
        {error && (
          <div className="bg-danger-soft border border-danger/20 text-danger-ink px-4 py-3 rounded-control mb-4 text-sm">{error}</div>
        )}

        <p className="text-sm text-ink-soft mb-4">
          <span className="font-semibold text-ink">{user?.name}</span> ({user?.email})
        </p>

        {/* Role Selection */}
        <div className="mb-4">
          <label className="label">Select role</label>
          <div className="space-y-2">
            <label className="flex items-center p-3 border border-line rounded-card cursor-pointer hover:bg-canvas">
              <input type="radio" name="role" value="admin" checked={role === 'admin'}
                onChange={(e) => setRole(e.target.value)} className="w-4 h-4" disabled={loading} />
              <div className="ml-3">
                <div className="font-semibold text-ink">Admin</div>
                <div className="text-xs text-ink-soft">Full access to all features</div>
              </div>
            </label>
            <label className="flex items-center p-3 border border-line rounded-card cursor-pointer hover:bg-canvas">
              <input type="radio" name="role" value="manager" checked={role === 'manager'}
                onChange={(e) => setRole(e.target.value)} className="w-4 h-4" disabled={loading} />
              <div className="ml-3">
                <div className="font-semibold text-ink">Manager</div>
                <div className="text-xs text-ink-soft">Custom access below</div>
              </div>
            </label>
          </div>
        </div>

        {/* Permissions (only for managers) */}
        {role === 'manager' && (
          <div className="mb-2">
            <label className="label">Permissions</label>
            <div className="grid grid-cols-1 gap-2">
              {PERMISSIONS.map((p) => (
                <label key={p.key} className="flex items-center gap-3 p-2.5 border border-line rounded-card cursor-pointer hover:bg-canvas">
                  <input
                    type="checkbox"
                    checked={permissions.includes(p.key)}
                    onChange={() => togglePermission(p.key)}
                    className="w-4 h-4 rounded"
                    disabled={loading}
                  />
                  <div className="flex-1">
                    <span className="text-sm font-medium text-ink">{p.label}</span>
                    <span className="text-xs text-ink-soft ml-2">{p.desc}</span>
                  </div>
                </label>
              ))}
            </div>
          </div>
        )}
      </form>
    </Modal>
  );
}
