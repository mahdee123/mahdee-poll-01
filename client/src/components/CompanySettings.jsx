import { useState, useEffect } from 'react';
import InviteUserModal from './InviteUserModal';

export default function CompanySettings() {
  const [company, setCompany] = useState(null);
  const [users, setUsers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [inviteLoading, setInviteLoading] = useState(false);
  const [showInviteModal, setShowInviteModal] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(null);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  useEffect(() => {
    loadCompanyData();
  }, []);

  const loadCompanyData = async () => {
    const token = localStorage.getItem('token');
    try {
      const response = await fetch(`${import.meta.env.VITE_API_URL}/auth/me`, {
        headers: { Authorization: `Bearer ${token}` }
      });

      if (!response.ok) throw new Error('Failed to load company data');

      const { user, company, staff } = await response.json();
      setCompany(company);
      setUsers([user, ...(staff || [])]);
    } catch (err) {
      setError('Failed to load company data');
    } finally {
      setLoading(false);
    }
  };

  const handleInviteUser = async (data) => {
    const token = localStorage.getItem('token');
    setInviteLoading(true);
    setError('');
    setSuccess('');

    try {
      const response = await fetch(`${import.meta.env.VITE_API_URL}/auth/invite-user`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(data)
      });

      if (!response.ok) {
        const errData = await response.json();
        throw new Error(errData.message || 'Failed to invite user');
      }

      const newUser = await response.json();
      setUsers(prev => [...prev, newUser]);
      setSuccess(`Invitation sent to ${data.managerEmail}`);
      setShowInviteModal(false);
    } catch (err) {
      setError(err.message || 'Failed to invite user');
      throw err;
    } finally {
      setInviteLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="text-gray-600">Loading company settings...</div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 py-8 px-4">
      <div className="max-w-4xl mx-auto">
        {/* Header */}
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-gray-800">Company Settings</h1>
          <p className="text-gray-600 mt-2">Manage your company information and team members</p>
        </div>

        {/* Error/Success Messages */}
        {error && (
          <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-lg mb-6">
            {error}
          </div>
        )}
        {success && (
          <div className="bg-green-50 border border-green-200 text-green-700 px-4 py-3 rounded-lg mb-6">
            {success}
          </div>
        )}

        {/* Company Information Card */}
        <div className="bg-white rounded-lg shadow-md p-6 mb-6">
          <h2 className="text-xl font-bold text-gray-800 mb-4">Company Information</h2>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <p className="text-sm text-gray-600">Company Name</p>
              <p className="text-lg font-semibold text-gray-800">{company?.name}</p>
            </div>
            <div>
              <p className="text-sm text-gray-600">Company ID</p>
              <p className="text-lg font-semibold text-gray-800 font-mono text-sm">{company?._id}</p>
            </div>
            <div>
              <p className="text-sm text-gray-600">Status</p>
              <p className="text-lg font-semibold">
                <span className="inline-block px-3 py-1 rounded-full text-sm" style={{
                  backgroundColor: company?.status === 'Active' ? '#dcfce7' : '#fee2e2',
                  color: company?.status === 'Active' ? '#166534' : '#991b1b'
                }}>
                  {company?.status}
                </span>
              </p>
            </div>
            <div>
              <p className="text-sm text-gray-600">Created</p>
              <p className="text-lg font-semibold text-gray-800">
                {new Date(company?.createdAt).toLocaleDateString()}
              </p>
            </div>
          </div>
        </div>

        {/* Team Members Card */}
        <div className="bg-white rounded-lg shadow-md p-6">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-xl font-bold text-gray-800">Team Members</h2>
            <button
              onClick={() => setShowInviteModal(true)}
              className="bg-blue-600 hover:bg-blue-700 text-white font-semibold py-2 px-4 rounded-lg transition duration-200"
            >
              + Invite Manager
            </button>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="border-b">
                  <th className="text-left py-3 px-4 font-semibold text-gray-700">Name</th>
                  <th className="text-left py-3 px-4 font-semibold text-gray-700">Email</th>
                  <th className="text-left py-3 px-4 font-semibold text-gray-700">Role</th>
                  <th className="text-left py-3 px-4 font-semibold text-gray-700">Status</th>
                  <th className="text-left py-3 px-4 font-semibold text-gray-700">Joined</th>
                  <th className="text-left py-3 px-4 font-semibold text-gray-700">Action</th>
                </tr>
              </thead>
              <tbody>
                {users.map((user, idx) => (
                  <tr key={user._id || idx} className="border-b hover:bg-gray-50">
                    <td className="py-3 px-4 text-gray-800 font-medium">{user.name}</td>
                    <td className="py-3 px-4 text-gray-600">{user.email}</td>
                    <td className="py-3 px-4">
                      <span className="inline-block px-3 py-1 rounded-full text-sm font-semibold" style={{
                        backgroundColor: user.role === 'Admin' ? '#dbeafe' : '#fef3c7',
                        color: user.role === 'Admin' ? '#1e40af' : '#92400e'
                      }}>
                        {user.role}
                      </span>
                    </td>
                    <td className="py-3 px-4">
                      <span className="text-sm" style={{
                        color: user.status === 'Active' ? '#16a34a' : '#dc2626'
                      }}>
                        {user.status || 'Pending'}
                      </span>
                    </td>
                    <td className="py-3 px-4 text-gray-600 text-sm">
                      {new Date(user.createdAt).toLocaleDateString()}
                    </td>
                    <td className="py-3 px-4">
                      {user.role === 'Manager' && (
                        <button
                          onClick={() => setShowConfirmPassword(user._id)}
                          className="text-red-600 hover:text-red-800 font-medium text-sm"
                        >
                          Remove
                        </button>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {users.length === 0 && (
            <div className="text-center py-8 text-gray-600">
              No team members yet. Invite your first manager.
            </div>
          )}
        </div>
      </div>

      {/* Invite Modal */}
      <InviteUserModal
        isOpen={showInviteModal}
        onClose={() => setShowInviteModal(false)}
        onInvite={handleInviteUser}
        loading={inviteLoading}
      />
    </div>
  );
}
