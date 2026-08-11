import React, { useState, useEffect } from 'react';
import { Search, Plus, CreditCard } from 'lucide-react';
import { apiRequest } from '../api';
import DressAssignmentModal from './DressAssignmentModal';
import DressReturnModal from './DressReturnModal';
import Toast from './Toast';
import Button from './Button';
import LoadingSpinner from './LoadingSpinner';
import EmptyState from './EmptyState';

const STATUS_BADGE = {
  Available: 'badge-success',
  Rented: 'badge-warning',
  Maintenance: 'badge-danger',
  Disabled: 'badge-neutral',
};

export default function DressDashboard({ token }) {
  const [stats, setStats] = useState(null);
  const [dresses, setDresses] = useState([]);
  const [loading, setLoading] = useState(true);
  const [toast, setToast] = useState(null);
  const [statusFilter, setStatusFilter] = useState('All');
  const [typeFilter, setTypeFilter] = useState('All');
  const [searchTerm, setSearchTerm] = useState('');

  const [showAssignModal, setShowAssignModal] = useState(false);
  const [showReturnModal, setShowReturnModal] = useState(false);
  const [selectedDress, setSelectedDress] = useState(null);

  useEffect(() => {
    fetchData();
  }, []);

  const fetchData = async () => {
    try {
      setLoading(true);
      const [statsRes, dressesRes] = await Promise.all([
        apiRequest('/dress-rentals/stats', { token }),
        apiRequest('/dress-rentals', { token }),
      ]);

      setStats(statsRes.stats);
      setDresses(dressesRes.dresses);
    } catch (error) {
      console.error('Error fetching dress rental data:', error);
      setToast({ type: 'error', message: 'Failed to load dress rental data' });
    } finally {
      setLoading(false);
    }
  };

  const handleAssignClick = (dress) => {
    setSelectedDress(dress);
    setShowAssignModal(true);
  };

  const handleReturnClick = (dress) => {
    setSelectedDress(dress);
    setShowReturnModal(true);
  };

  const handleAssignmentSuccess = () => {
    setShowAssignModal(false);
    setToast({ type: 'success', message: 'Dress assigned successfully' });
    fetchData();
  };

  const handleReturnSuccess = () => {
    setShowReturnModal(false);
    setToast({ type: 'success', message: 'Dress returned successfully' });
    fetchData();
  };

  const getFilteredDresses = () => {
    let filtered = dresses;

    if (statusFilter !== 'All') {
      filtered = filtered.filter((d) => d.status === statusFilter);
    }

    if (typeFilter !== 'All') {
      filtered = filtered.filter((d) => d.dressType === typeFilter);
    }

    if (searchTerm) {
      filtered = filtered.filter((d) =>
        d.dressNumber.toLowerCase().includes(searchTerm.toLowerCase())
      );
    }

    return filtered;
  };

  const getDressTypes = () => {
    const types = [...new Set(dresses.map((d) => d.dressType).filter(Boolean))];
    return types.sort();
  };

  if (loading) {
    return <LoadingSpinner message="Loading dress rental data…" />;
  }

  const filteredDresses = getFilteredDresses();

  return (
    <div className="space-y-6">
      {/* Analytics Cards */}
      {stats && (
        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-4">
          <div className="stat-card">
            <span className="stat-label">Total dresses</span>
            <span className="stat-value">{stats.totalDresses}</span>
          </div>
          <div className="stat-card">
            <span className="stat-label">Available</span>
            <span className="stat-value text-success">{stats.availableDresses}</span>
          </div>
          <div className="stat-card">
            <span className="stat-label">Rented</span>
            <span className="stat-value text-warning">{stats.rentedDresses}</span>
          </div>
          <div className="stat-card">
            <span className="stat-label">Revenue today</span>
            <span className="stat-value text-primary tabular">৳{stats.revenueToday}</span>
          </div>
        </div>
      )}

      {/* Dress List */}
      <div className="card overflow-hidden">
        {/* List Header */}
        <div className="border-b border-line p-5 flex flex-col md:flex-row gap-3 justify-between items-start md:items-center">
          <div className="flex gap-3 items-center flex-1 flex-wrap">
            <div className="relative">
              <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-ink-faint pointer-events-none" />
              <input
                type="text"
                placeholder="Search dress…"
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
              <option value="Rented">Rented</option>
              <option value="Maintenance">Maintenance</option>
              <option value="Disabled">Disabled</option>
            </select>

            <select
              value={typeFilter}
              onChange={(e) => setTypeFilter(e.target.value)}
              className="select w-auto"
            >
              <option value="All">All Types</option>
              {getDressTypes().map((type) => (
                <option key={type} value={type}>
                  {type}
                </option>
              ))}
            </select>
          </div>

          <Button icon={Plus} onClick={() => handleAssignClick(null)}>Assign dress</Button>
        </div>

        {/* Table */}
        <div className="overflow-x-auto">
          <table className="table-modern w-full">
            <thead>
              <tr>
                <th>Dress No</th>
                <th>Type</th>
                <th>Status</th>
                <th>Assigned To</th>
                <th>Phone</th>
                <th>Assigned Time</th>
                <th>Charge</th>
                <th className="text-right">Actions</th>
              </tr>
            </thead>
            <tbody>
              {filteredDresses.length > 0 ? (
                filteredDresses.map((dress) => (
                  <tr key={dress._id}>
                    <td className="font-medium text-ink">{dress.dressNumber}</td>
                    <td className="text-ink-soft">{dress.type || '—'}</td>
                    <td><span className={STATUS_BADGE[dress.status] || 'badge-neutral'}>{dress.status}</span></td>
                    <td className="text-ink-soft">
                      {dress.rental ? (
                        <div className="flex items-center gap-2">
                          {dress.rental.isBillPayer && (
                            <span className="badge-info"><CreditCard size={11} /> Payer</span>
                          )}
                          <span>{dress.rental.memberName}</span>
                        </div>
                      ) : (
                        '—'
                      )}
                    </td>
                    <td className="text-ink-soft">
                      {dress.rental ? dress.rental.memberPhone : '—'}
                    </td>
                    <td className="text-ink-soft">
                      {dress.rental
                        ? new Date(dress.rental.assignedTime).toLocaleString()
                        : '—'}
                    </td>
                    <td className="font-medium text-ink tabular">
                      {dress.rental ? `৳${dress.rental.chargeAmount}` : '—'}
                    </td>
                    <td className="text-right">
                      <div className="flex items-center justify-end gap-2">
                        {dress.status === 'Available' && (
                          <Button size="sm" variant="secondary" className="!bg-success-soft !text-success-ink !border-transparent hover:!bg-success-soft/80" onClick={() => handleAssignClick(dress)}>
                            Assign
                          </Button>
                        )}
                        {dress.status === 'Rented' && dress.rental && (
                          <Button size="sm" variant="secondary" className="!bg-warning-soft !text-warning-ink !border-transparent hover:!bg-warning-soft/80" onClick={() => handleReturnClick(dress)}>
                            Return
                          </Button>
                        )}
                        {dress.status === 'Maintenance' && <span className="badge-warning">Maintenance</span>}
                        {dress.status === 'Disabled' && <span className="badge-neutral">Disabled</span>}
                      </div>
                    </td>
                  </tr>
                ))
              ) : (
                <tr>
                  <td colSpan="8" className="p-0">
                    <EmptyState title="No dresses found" message="Try a different search, status or type filter." />
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>

        {/* Show count */}
        <div className="border-t border-line px-5 py-3 text-sm text-ink-soft">
          Showing {filteredDresses.length} of {dresses.length} dresses
        </div>
      </div>

      {/* Modals */}
      {showAssignModal && (
        <DressAssignmentModal
          isOpen={showAssignModal}
          token={token}
          dress={selectedDress}
          allDresses={dresses}
          onClose={() => setShowAssignModal(false)}
          onSuccess={handleAssignmentSuccess}
        />
      )}

      {showReturnModal && selectedDress && (
        <DressReturnModal
          isOpen={showReturnModal}
          token={token}
          dress={selectedDress}
          rental={selectedDress.rental}
          onClose={() => setShowReturnModal(false)}
          onSuccess={handleReturnSuccess}
        />
      )}

      {toast && <Toast type={toast.type} message={toast.message} onClose={() => setToast(null)} />}
    </div>
  );
}
