import { useState, useEffect } from 'react';
import { Building, Users, Plus, Edit2, Trash2 } from 'lucide-react';
import Card from './Card';
import Badge from './Badge';
import Button from './Button';
import LoadingSpinner from './LoadingSpinner';
import EmptyState from './EmptyState';
import Toast from './Toast';
import InviteUserModal from './InviteUserModal';
import EditCompanyModal from './EditCompanyModal';
import EditUserRoleModal from './EditUserRoleModal';
import ConfirmDeleteUserModal from './ConfirmDeleteUserModal';

export default function CompanySettings({ token }) {
  // State for data
  const [company, setCompany] = useState(null);
  const [users, setUsers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [defaultMemberFee, setDefaultMemberFee] = useState(2000);
  const [editingFee, setEditingFee] = useState(false);
  const [newFeeValue, setNewFeeValue] = useState(2000);

  // State for modals
  const [showInviteModal, setShowInviteModal] = useState(false);
  const [showEditCompanyModal, setShowEditCompanyModal] = useState(false);
  const [showEditRoleModal, setShowEditRoleModal] = useState(false);
  const [showDeleteModal, setShowDeleteModal] = useState(false);

  // State for async operations
  const [actionLoading, setActionLoading] = useState(false);

  // State for selected user and notifications
  const [selectedUser, setSelectedUser] = useState(null);
  const [toast, setToast] = useState(null);

  useEffect(() => {
    loadCompanyData();
  }, []);

  const loadCompanyData = async () => {
    const authToken = token || localStorage.getItem('raya_token');
    if (!authToken) {
      showToast('Authentication token not found', 'error');
      setLoading(false);
      return;
    }
    try {
      const response = await fetch(`${import.meta.env.VITE_API_URL}/auth/me`, {
        headers: { Authorization: `Bearer ${authToken}` }
      });

      if (!response.ok) throw new Error('Failed to load company data');

      const { user, company, staff } = await response.json();
      setCompany(company);
      // Combine current user with staff
      setUsers([user, ...staff]);

      // Load membership fee settings
      const feeResponse = await fetch(`${import.meta.env.VITE_API_URL}/memberships/settings/company-default`, {
        headers: { Authorization: `Bearer ${authToken}` }
      });

      if (feeResponse.ok) {
        const feeData = await feeResponse.json();
        setDefaultMemberFee(feeData.defaultMemberFee);
        setNewFeeValue(feeData.defaultMemberFee);
      }
    } catch (err) {
      showToast('Failed to load company data', 'error');
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  const handleUpdateCompany = async (data) => {
    setActionLoading(true);
    try {
      const response = await fetch(`${import.meta.env.VITE_API_URL}/auth/company`, {
        method: 'PATCH',
        headers: {
          'Authorization': `Bearer ${token || localStorage.getItem('raya_token')}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(data)
      });

      if (!response.ok) {
        const errData = await response.json();
        throw new Error(errData.message || 'Failed to update company');
      }

      const result = await response.json();
      setCompany(result.company);
      setShowEditCompanyModal(false);
      showToast('Company information updated successfully', 'success');
    } catch (err) {
      showToast(err.message || 'Failed to update company', 'error');
      throw err;
    } finally {
      setActionLoading(false);
    }
  };

  const handleUpdateMemberFee = async () => {
    setActionLoading(true);
    try {
      const response = await fetch(`${import.meta.env.VITE_API_URL}/memberships/settings/company-default`, {
        method: 'PUT',
        headers: {
          'Authorization': `Bearer ${token || localStorage.getItem('raya_token')}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ defaultMemberFee: Number(newFeeValue) })
      });

      if (!response.ok) {
        const errData = await response.json();
        throw new Error(errData.message || 'Failed to update member fee');
      }

      const result = await response.json();
      setDefaultMemberFee(result.defaultMemberFee);
      setEditingFee(false);
      showToast('Default member fee updated successfully', 'success');
    } catch (err) {
      showToast(err.message || 'Failed to update member fee', 'error');
    } finally {
      setActionLoading(false);
    }
  };

  const handleUpdateUserRole = async (userId, role) => {
    setActionLoading(true);
    try {
      const response = await fetch(`${import.meta.env.VITE_API_URL}/auth/users/${userId}/role`, {
        method: 'PATCH',
        headers: {
          'Authorization': `Bearer ${token || localStorage.getItem('raya_token')}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ role })
      });

      if (!response.ok) {
        const errData = await response.json();
        throw new Error(errData.message || 'Failed to update user role');
      }

      const result = await response.json();
      // Update user in list
      setUsers(prev => prev.map(u => u.id === userId ? result.user : u));
      setShowEditRoleModal(false);
      setSelectedUser(null);
      showToast('User role updated successfully', 'success');
    } catch (err) {
      showToast(err.message || 'Failed to update user role', 'error');
      throw err;
    } finally {
      setActionLoading(false);
    }
  };

  const handleRemoveUser = async (userId, password) => {
    setActionLoading(true);
    try {
      const response = await fetch(`${import.meta.env.VITE_API_URL}/auth/users/${userId}`, {
        method: 'DELETE',
        headers: {
          'Authorization': `Bearer ${token || localStorage.getItem('raya_token')}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ confirmPassword: password })
      });

      if (!response.ok) {
        const errData = await response.json();
        throw new Error(errData.message || 'Failed to remove user');
      }

      // Remove user from list
      setUsers(prev => prev.filter(u => u.id !== userId));
      setShowDeleteModal(false);
      setSelectedUser(null);
      showToast('User removed successfully', 'success');
    } catch (err) {
      showToast(err.message || 'Failed to remove user', 'error');
      throw err;
    } finally {
      setActionLoading(false);
    }
  };

  const handleInviteUser = async (data) => {
    setActionLoading(true);
    try {
      const response = await fetch(`${import.meta.env.VITE_API_URL}/auth/invite-user`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token || localStorage.getItem('raya_token')}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(data)
      });

      if (!response.ok) {
        const errData = await response.json();
        throw new Error(errData.message || 'Failed to create manager account');
      }

      const newUser = await response.json();
      setUsers(prev => [...prev, newUser.manager]);
      setShowInviteModal(false);
      showToast(`Manager account created successfully for ${data.managerEmail}`, 'success');
    } catch (err) {
      showToast(err.message || 'Failed to create manager account', 'error');
      throw err;
    } finally {
      setActionLoading(false);
    }
  };

  const showToast = (message, type = 'success') => {
    setToast({ message, type });
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 py-8 px-4">
        <div className="max-w-6xl mx-auto">
          <LoadingSpinner message="Loading company settings..." />
        </div>
      </div>
    );
  }

  // Filter staff (all users except the first one which is the current user)
  const staff = users.slice(1);

  return (
    <div className="min-h-screen bg-gray-50 py-8 px-4">
      <div className="max-w-6xl mx-auto">
        {/* Header */}
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-gray-800">Company Settings</h1>
          <p className="text-gray-600 mt-2">Manage your company information and team members</p>
        </div>

        {/* Notifications */}
        {toast && (
          <Toast
            message={toast.message}
            type={toast.type}
            onClose={() => setToast(null)}
          />
        )}

        {/* Company Information Card */}
        <Card title="Company Information" icon={Building} className="mb-6">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-6">
            <div>
              <p className="text-sm text-gray-600 mb-1">Company Name</p>
              <p className="text-lg font-semibold text-gray-800">{company?.name}</p>
            </div>
            <div>
              <p className="text-sm text-gray-600 mb-1">Company ID</p>
              <p className="font-mono text-sm text-gray-800 break-all">{company?.id}</p>
            </div>
            <div>
              <p className="text-sm text-gray-600 mb-1">Status</p>
              <Badge type="status" value={company?.status} />
            </div>
            <div>
              <p className="text-sm text-gray-600 mb-1">Created</p>
              <p className="text-lg font-semibold text-gray-800">
                {new Date(company?.createdAt).toLocaleDateString()}
              </p>
            </div>
          </div>

          <div className="flex gap-3 justify-end pt-4 border-t border-gray-200">
            <Button
              onClick={() => setShowEditCompanyModal(true)}
              variant="primary"
              icon={Edit2}
            >
              Edit Company
            </Button>
          </div>
        </Card>

        {/* Team Members Card */}
        <Card className="mb-6">
          <div className="flex items-center justify-between mb-6">
            <div className="flex items-center gap-3">
              <Users className="w-6 h-6 text-blue-600" />
              <div>
                <h2 className="text-xl font-bold text-gray-800">Team Members</h2>
                <p className="text-sm text-gray-600">{users.length} member{users.length !== 1 ? 's' : ''}</p>
              </div>
            </div>
            <Button
              onClick={() => setShowInviteModal(true)}
              variant="primary"
              icon={Plus}
            >
              Create Manager
            </Button>
          </div>

          {/* Desktop Table View */}
          <div className="hidden md:block overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="border-b border-gray-200 bg-gray-50">
                  <th className="text-left py-3 px-4 font-semibold text-gray-700 text-sm">Name</th>
                  <th className="text-left py-3 px-4 font-semibold text-gray-700 text-sm">Email</th>
                  <th className="text-left py-3 px-4 font-semibold text-gray-700 text-sm">Role</th>
                  <th className="text-left py-3 px-4 font-semibold text-gray-700 text-sm">Status</th>
                  <th className="text-left py-3 px-4 font-semibold text-gray-700 text-sm">Joined</th>
                  <th className="text-left py-3 px-4 font-semibold text-gray-700 text-sm">Actions</th>
                </tr>
              </thead>
              <tbody>
                {users.map((user, idx) => (
                  <tr key={user.id || idx} className="border-b border-gray-100 hover:bg-gray-50 transition-colors">
                    <td className="py-3 px-4 text-gray-800 font-medium text-sm">{user.name}</td>
                    <td className="py-3 px-4 text-gray-600 text-sm">{user.email}</td>
                    <td className="py-3 px-4">
                      <Badge type="role" value={user.role} />
                    </td>
                    <td className="py-3 px-4">
                      <Badge type="status" value={user.status} />
                    </td>
                    <td className="py-3 px-4 text-gray-600 text-sm">
                      {new Date(user.createdAt).toLocaleDateString()}
                    </td>
                    <td className="py-3 px-4">
                      <div className="flex gap-2">
                        <button
                          onClick={() => {
                            setSelectedUser(user);
                            setShowEditRoleModal(true);
                          }}
                          className="p-1.5 text-blue-600 hover:bg-blue-50 rounded-lg transition-colors"
                          title="Edit role"
                        >
                          <Edit2 size={16} />
                        </button>
                        {user.role === 'manager' && (
                          <button
                            onClick={() => {
                              setSelectedUser(user);
                              setShowDeleteModal(true);
                            }}
                            className="p-1.5 text-red-600 hover:bg-red-50 rounded-lg transition-colors"
                            title="Remove user"
                          >
                            <Trash2 size={16} />
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* Mobile Card View */}
          <div className="md:hidden space-y-3">
            {users.map((user, idx) => (
              <div key={user.id || idx} className="p-4 border border-gray-200 rounded-lg bg-gray-50">
                <div className="flex items-start justify-between mb-3">
                  <div>
                    <p className="font-semibold text-gray-800">{user.name}</p>
                    <p className="text-sm text-gray-600">{user.email}</p>
                  </div>
                  <div className="flex gap-2">
                    <button
                      onClick={() => {
                        setSelectedUser(user);
                        setShowEditRoleModal(true);
                      }}
                      className="p-1.5 text-blue-600 hover:bg-blue-50 rounded-lg"
                    >
                      <Edit2 size={16} />
                    </button>
                    {user.role === 'manager' && (
                      <button
                        onClick={() => {
                          setSelectedUser(user);
                          setShowDeleteModal(true);
                        }}
                        className="p-1.5 text-red-600 hover:bg-red-50 rounded-lg"
                      >
                        <Trash2 size={16} />
                      </button>
                    )}
                  </div>
                </div>
                <div className="flex gap-2 flex-wrap">
                  <Badge type="role" value={user.role} />
                  <Badge type="status" value={user.status} />
                </div>
                <p className="text-xs text-gray-600 mt-3">
                  Joined {new Date(user.createdAt).toLocaleDateString()}
                </p>
              </div>
            ))}
          </div>

          {users.length === 0 && (
            <EmptyState
              title="No team members yet"
              message="Create your first manager account to get started"
              actionLabel="Create Manager"
              onAction={() => setShowInviteModal(true)}
            />
          )}
        </Card>
      </div>

      {/* Modals */}
      <InviteUserModal
        isOpen={showInviteModal}
        onClose={() => setShowInviteModal(false)}
        onInvite={handleInviteUser}
        loading={actionLoading}
      />

      <EditCompanyModal
        isOpen={showEditCompanyModal}
        onClose={() => setShowEditCompanyModal(false)}
        company={company}
        onSave={handleUpdateCompany}
        loading={actionLoading}
      />

      {selectedUser && (
        <EditUserRoleModal
          isOpen={showEditRoleModal}
          onClose={() => {
            setShowEditRoleModal(false);
            setSelectedUser(null);
          }}
          user={selectedUser}
          onSave={handleUpdateUserRole}
          loading={actionLoading}
        />
      )}

      {selectedUser && (
        <ConfirmDeleteUserModal
          isOpen={showDeleteModal}
          onClose={() => {
            setShowDeleteModal(false);
            setSelectedUser(null);
          }}
          user={selectedUser}
          onConfirm={handleRemoveUser}
          loading={actionLoading}
        />
      )}
    </div>
  );
}
