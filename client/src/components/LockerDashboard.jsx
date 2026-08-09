import React, { useState, useEffect } from 'react';
import { apiRequest } from '../api';
import Badge from './Badge';
import LockerAssignmentModal from './LockerAssignmentModal';
import LockerReturnModal from './LockerReturnModal';
import Toast from './Toast';

export default function LockerDashboard({ token, onSettingsUpdated }) {
  const [stats, setStats] = useState(null);
  const [lockers, setLockers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [toast, setToast] = useState(null);
  const [statusFilter, setStatusFilter] = useState('All');
  const [searchTerm, setSearchTerm] = useState('');

  const [showAssignModal, setShowAssignModal] = useState(false);
  const [showReturnModal, setShowReturnModal] = useState(false);
  const [selectedLocker, setSelectedLocker] = useState(null);

  useEffect(() => {
    fetchData();
  }, []);

  const fetchData = async () => {
    try {
      setLoading(true);
      const [statsRes, lockersRes] = await Promise.all([
        apiRequest('/lockers/stats', { token }),
        apiRequest('/lockers', { token }),
      ]);

      setStats(statsRes.stats);
      setLockers(lockersRes.lockers);
    } catch (error) {
      console.error('Error fetching locker data:', error);
      setToast({
        type: 'error',
        message: 'Failed to load locker data',
      });
    } finally {
      setLoading(false);
    }
  };

  const handleAssignClick = (locker) => {
    setSelectedLocker(locker);
    setShowAssignModal(true);
  };

  const handleReturnClick = (locker) => {
    setSelectedLocker(locker);
    setShowReturnModal(true);
  };

  const handleAssignmentSuccess = () => {
    setShowAssignModal(false);
    setToast({
      type: 'success',
      message: 'Locker assigned successfully',
    });
    fetchData();
  };

  const handleReturnSuccess = () => {
    setShowReturnModal(false);
    setToast({ type: 'success', message: 'Locker returned successfully' });
    fetchData();
  };

  const getFilteredLockers = () => {
    let filtered = lockers;

    if (statusFilter !== 'All') {
      filtered = filtered.filter((l) => l.status === statusFilter);
    }

    if (searchTerm) {
      filtered = filtered.filter((l) =>
        l.lockerNumber.toLowerCase().includes(searchTerm.toLowerCase())
      );
    }

    return filtered;
  };

  const getStatusBadge = (status) => {
    const statusMap = {
      Available: 'success',
      Occupied: 'warning',
      Maintenance: 'danger',
      Disabled: 'secondary',
    };
    return <Badge type={statusMap[status] || 'secondary'} label={status} />;
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="text-gray-600">Loading locker data...</div>
      </div>
    );
  }

  const filteredLockers = getFilteredLockers();

  return (
    <div className="space-y-6">
      {/* Analytics Cards */}
      {stats && (
        <div className="grid grid-cols-1 md:grid-cols-5 gap-4">
          <div className="bg-white rounded-lg shadow p-6">
            <div className="text-gray-600 text-sm font-medium mb-1">Total Lockers</div>
            <div className="text-3xl font-bold text-gray-900">{stats.totalLockers}</div>
          </div>

          <div className="bg-white rounded-lg shadow p-6">
            <div className="text-gray-600 text-sm font-medium mb-1">Available</div>
            <div className="text-3xl font-bold text-green-600">{stats.availableLockers}</div>
          </div>

          <div className="bg-white rounded-lg shadow p-6">
            <div className="text-gray-600 text-sm font-medium mb-1">Occupied</div>
            <div className="text-3xl font-bold text-amber-600">{stats.occupiedLockers}</div>
          </div>

          <div className="bg-white rounded-lg shadow p-6">
            <div className="text-gray-600 text-sm font-medium mb-1">Active Sessions</div>
            <div className="text-3xl font-bold text-primary">{stats.activeSessions}</div>
          </div>

          <div className="bg-white rounded-lg shadow p-6">
            <div className="text-gray-600 text-sm font-medium mb-1">Revenue Today</div>
            <div className="text-3xl font-bold text-purple-600">৳{stats.revenueToday}</div>
          </div>
        </div>
      )}

      {/* Locker List */}
      <div className="bg-white rounded-lg shadow">
        {/* List Header */}
        <div className="border-b border-gray-200 p-6 flex flex-col md:flex-row gap-4 justify-between items-start md:items-center">
          <div className="flex gap-4 items-center flex-1">
            <input
              type="text"
              placeholder="Search locker..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary outline-none"
            />

            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
              className="px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary outline-none"
            >
              <option value="All">All Status</option>
              <option value="Available">Available</option>
              <option value="Occupied">Occupied</option>
              <option value="Maintenance">Maintenance</option>
              <option value="Disabled">Disabled</option>
            </select>
          </div>

          <button
            onClick={() => handleAssignClick(null)}
            className="px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors"
          >
            ➕ Assign Locker
          </button>
        </div>

        {/* Table */}
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead className="bg-gray-50 border-b border-gray-200">
              <tr>
                <th className="px-6 py-3 text-left text-sm font-semibold text-gray-700">
                  Locker No
                </th>
                <th className="px-6 py-3 text-left text-sm font-semibold text-gray-700">
                  Status
                </th>
                <th className="px-6 py-3 text-left text-sm font-semibold text-gray-700">
                  Assigned To
                </th>
                <th className="px-6 py-3 text-left text-sm font-semibold text-gray-700">
                  Phone
                </th>
                <th className="px-6 py-3 text-left text-sm font-semibold text-gray-700">
                  Assigned Time
                </th>
                <th className="px-6 py-3 text-left text-sm font-semibold text-gray-700">
                  Charge
                </th>
                <th className="px-6 py-3 text-right text-sm font-semibold text-gray-700">
                  Actions
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-200">
              {filteredLockers.length > 0 ? (
                filteredLockers.map((locker) => (
                  <tr key={locker._id} className="hover:bg-gray-50 transition-colors">
                    <td className="px-6 py-4 text-sm font-medium text-gray-900">
                      {locker.lockerNumber}
                    </td>
                    <td className="px-6 py-4">{getStatusBadge(locker.status)}</td>
                    <td className="px-6 py-4 text-sm text-gray-600">
                      {locker.assignment ? (
                        <div className="flex items-center gap-2">
                          {locker.assignment.isBillPayer && (
                            <span className="px-2 py-1 bg-primary/10 text-primary text-xs rounded font-medium">
                              🏊 Swimmer
                            </span>
                          )}
                          <span>{locker.assignment.memberName}</span>
                        </div>
                      ) : (
                        '—'
                      )}
                    </td>
                    <td className="px-6 py-4 text-sm text-gray-600">
                      {locker.assignment ? locker.assignment.memberPhone : '—'}
                    </td>
                    <td className="px-6 py-4 text-sm text-gray-600">
                      {locker.assignment
                        ? new Date(locker.assignment.assignedTime).toLocaleString()
                        : '—'}
                    </td>
                    <td className="px-6 py-4 text-sm font-medium text-gray-900">
                      {locker.assignment ? `৳${locker.assignment.chargeAmount}` : '—'}
                    </td>
                    <td className="px-6 py-4 text-right">
                      <div className="flex items-center justify-end gap-2">
                        {locker.status === 'Available' && (
                          <button
                            onClick={() => handleAssignClick(locker)}
                            className="px-4 py-1.5 text-sm font-medium text-white bg-green-500 rounded hover:bg-green-600 transition-colors"
                          >
                            Assign
                          </button>
                        )}
                        {locker.status === 'Occupied' && locker.assignment && (
                          <button
                            onClick={() => handleReturnClick(locker)}
                            className="px-4 py-1.5 text-sm font-medium text-white bg-amber-500 rounded hover:bg-amber-600 transition-colors"
                          >
                            Return
                          </button>
                        )}
                        {locker.status === 'Maintenance' && (
                          <span className="px-4 py-1.5 text-sm font-medium text-white bg-yellow-500 rounded">
                            Maintenance
                          </span>
                        )}
                        {locker.status === 'Disabled' && (
                          <span className="px-4 py-1.5 text-sm font-medium text-white bg-gray-500 rounded">
                            Disabled
                          </span>
                        )}
                      </div>
                    </td>
                  </tr>
                ))
              ) : (
                <tr>
                  <td colSpan="7" className="px-6 py-8 text-center text-gray-500">
                    No lockers found
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>

        {/* Show count */}
        <div className="border-t border-gray-200 p-6 text-sm text-gray-600">
          Showing {filteredLockers.length} of {lockers.length} lockers
        </div>
      </div>

      {/* Modals */}
      {showAssignModal && (
        <LockerAssignmentModal
          token={token}
          locker={selectedLocker}
          allLockers={lockers}
          onClose={() => setShowAssignModal(false)}
          onSuccess={handleAssignmentSuccess}
        />
      )}

      {showReturnModal && selectedLocker && (
        <LockerReturnModal
          token={token}
          locker={selectedLocker}
          onClose={() => setShowReturnModal(false)}
          onSuccess={handleReturnSuccess}
        />
      )}

      {toast && (
        <Toast
          type={toast.type}
          message={toast.message}
          onClose={() => setToast(null)}
        />
      )}
    </div>
  );
}
