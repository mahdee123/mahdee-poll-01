import React, { useState, useEffect } from 'react';
import { Search, Plus, Waves } from 'lucide-react';
import { apiRequest } from '../api';
import LockerAssignmentModal from './LockerAssignmentModal';
import LockerReturnModal from './LockerReturnModal';
import Toast from './Toast';
import Button from './Button';
import LoadingSpinner from './LoadingSpinner';
import EmptyState from './EmptyState';

const STATUS_BADGE = {
  Available: 'badge-success',
  Occupied: 'badge-warning',
  Maintenance: 'badge-danger',
  Disabled: 'badge-neutral',
};

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
      setToast({ type: 'error', message: 'Failed to load locker data' });
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
    setToast({ type: 'success', message: 'Locker assigned successfully' });
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

  if (loading) {
    return <LoadingSpinner message="Loading locker data…" />;
  }

  const filteredLockers = getFilteredLockers();

  return (
    <div className="space-y-6">
      {/* Analytics Cards */}
      {stats && (
        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-5 gap-4">
          <div className="stat-card">
            <span className="stat-label">Total lockers</span>
            <span className="stat-value">{stats.totalLockers}</span>
          </div>
          <div className="stat-card">
            <span className="stat-label">Available</span>
            <span className="stat-value text-success">{stats.availableLockers}</span>
          </div>
          <div className="stat-card">
            <span className="stat-label">Occupied</span>
            <span className="stat-value text-warning">{stats.occupiedLockers}</span>
          </div>
          <div className="stat-card">
            <span className="stat-label">Active sessions</span>
            <span className="stat-value text-primary">{stats.activeSessions}</span>
          </div>
          <div className="stat-card">
            <span className="stat-label">Revenue today</span>
            <span className="stat-value text-success tabular">৳{stats.revenueToday}</span>
          </div>
        </div>
      )}

      {/* Locker List */}
      <div className="card overflow-hidden">
        {/* List Header */}
        <div className="border-b border-line p-5 flex flex-col md:flex-row gap-3 justify-between items-start md:items-center">
          <div className="flex gap-3 items-center flex-1 flex-wrap">
            <div className="relative">
              <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-ink-faint pointer-events-none" />
              <input
                type="text"
                placeholder="Search locker…"
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="input pl-9 w-auto"
              />
            </div>

            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
              className="select w-auto"
            >
              <option value="All">All Status</option>
              <option value="Available">Available</option>
              <option value="Occupied">Occupied</option>
              <option value="Maintenance">Maintenance</option>
              <option value="Disabled">Disabled</option>
            </select>
          </div>

          <Button icon={Plus} onClick={() => handleAssignClick(null)}>Assign locker</Button>
        </div>

        {/* Table */}
        <div className="overflow-x-auto">
          <table className="table-modern w-full">
            <thead>
              <tr>
                <th>Locker No</th>
                <th>Status</th>
                <th>Assigned To</th>
                <th>Phone</th>
                <th>Assigned Time</th>
                <th>Charge</th>
                <th className="text-right">Actions</th>
              </tr>
            </thead>
            <tbody>
              {filteredLockers.length > 0 ? (
                filteredLockers.map((locker) => (
                  <tr key={locker._id}>
                    <td className="font-medium text-ink">{locker.lockerNumber}</td>
                    <td><span className={STATUS_BADGE[locker.status] || 'badge-neutral'}>{locker.status}</span></td>
                    <td className="text-ink-soft">
                      {locker.assignment ? (
                        <div className="flex items-center gap-2">
                          {locker.assignment.isBillPayer && (
                            <span className="badge-info"><Waves size={11} /> Swimmer</span>
                          )}
                          <span>{locker.assignment.memberName}</span>
                        </div>
                      ) : (
                        '—'
                      )}
                    </td>
                    <td className="text-ink-soft">
                      {locker.assignment ? locker.assignment.memberPhone : '—'}
                    </td>
                    <td className="text-ink-soft">
                      {locker.assignment
                        ? new Date(locker.assignment.assignedTime).toLocaleString()
                        : '—'}
                    </td>
                    <td className="font-medium text-ink tabular">
                      {locker.assignment ? `৳${locker.assignment.chargeAmount}` : '—'}
                    </td>
                    <td className="text-right">
                      <div className="flex items-center justify-end gap-2">
                        {locker.status === 'Available' && (
                          <Button size="sm" variant="secondary" className="!bg-success-soft !text-success-ink !border-transparent hover:!bg-success-soft/80" onClick={() => handleAssignClick(locker)}>
                            Assign
                          </Button>
                        )}
                        {locker.status === 'Occupied' && locker.assignment && (
                          <Button size="sm" variant="secondary" className="!bg-warning-soft !text-warning-ink !border-transparent hover:!bg-warning-soft/80" onClick={() => handleReturnClick(locker)}>
                            Return
                          </Button>
                        )}
                        {locker.status === 'Maintenance' && <span className="badge-warning">Maintenance</span>}
                        {locker.status === 'Disabled' && <span className="badge-neutral">Disabled</span>}
                      </div>
                    </td>
                  </tr>
                ))
              ) : (
                <tr>
                  <td colSpan="7" className="p-0">
                    <EmptyState title="No lockers found" message="Try a different search or status filter." />
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>

        {/* Show count */}
        <div className="border-t border-line px-5 py-3 text-sm text-ink-soft">
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

      {toast && <Toast type={toast.type} message={toast.message} onClose={() => setToast(null)} />}
    </div>
  );
}
