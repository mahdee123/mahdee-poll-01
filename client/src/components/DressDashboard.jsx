import React, { useState, useEffect } from 'react';
import { apiRequest } from '../api';
import Badge from './Badge';
import DressAssignmentModal from './DressAssignmentModal';
import DressReturnModal from './DressReturnModal';
import Toast from './Toast';

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
      setToast({
        type: 'error',
        message: 'Failed to load dress rental data',
      });
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
    setToast({
      type: 'success',
      message: 'Dress assigned successfully',
    });
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

  const getStatusBadge = (status) => {
    const statusMap = {
      Available: 'success',
      Rented: 'warning',
      Maintenance: 'danger',
      Disabled: 'secondary',
    };
    return <Badge type={statusMap[status] || 'secondary'} label={status} />;
  };

  const getDressTypes = () => {
    const types = [...new Set(dresses.map((d) => d.dressType).filter(Boolean))];
    return types.sort();
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="text-gray-600">Loading dress rental data...</div>
      </div>
    );
  }

  const filteredDresses = getFilteredDresses();

  return (
    <div className="space-y-6">
      {/* Analytics Cards */}
      {stats && (
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          <div className="bg-white rounded-lg shadow p-6">
            <div className="text-gray-600 text-sm font-medium mb-1">Total Dresses</div>
            <div className="text-3xl font-bold text-gray-900">{stats.totalDresses}</div>
          </div>

          <div className="bg-white rounded-lg shadow p-6">
            <div className="text-gray-600 text-sm font-medium mb-1">Available</div>
            <div className="text-3xl font-bold text-green-600">{stats.availableDresses}</div>
          </div>

          <div className="bg-white rounded-lg shadow p-6">
            <div className="text-gray-600 text-sm font-medium mb-1">Rented</div>
            <div className="text-3xl font-bold text-amber-600">{stats.rentedDresses}</div>
          </div>

          <div className="bg-white rounded-lg shadow p-6">
            <div className="text-gray-600 text-sm font-medium mb-1">Revenue Today</div>
            <div className="text-3xl font-bold text-primary">৳{stats.revenueToday}</div>
          </div>
        </div>
      )}

      {/* Dress List */}
      <div className="bg-white rounded-lg shadow">
        {/* List Header */}
        <div className="border-b border-gray-200 p-6 flex flex-col md:flex-row gap-4 justify-between items-start md:items-center">
          <div className="flex gap-4 items-center flex-1">
            <input
              type="text"
              placeholder="Search dress..."
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
              <option value="Rented">Rented</option>
              <option value="Maintenance">Maintenance</option>
              <option value="Disabled">Disabled</option>
            </select>

            <select
              value={typeFilter}
              onChange={(e) => setTypeFilter(e.target.value)}
              className="px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary outline-none"
            >
              <option value="All">All Types</option>
              {getDressTypes().map((type) => (
                <option key={type} value={type}>
                  {type}
                </option>
              ))}
            </select>
          </div>

          <button
            onClick={() => handleAssignClick(null)}
            className="px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors"
          >
            ➕ Assign Dress
          </button>
        </div>

        {/* Table */}
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead className="bg-gray-50 border-b border-gray-200">
              <tr>
                <th className="px-6 py-3 text-left text-sm font-semibold text-gray-700">
                  Dress No
                </th>
                <th className="px-6 py-3 text-left text-sm font-semibold text-gray-700">
                  Type
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
              {filteredDresses.length > 0 ? (
                filteredDresses.map((dress) => (
                  <tr key={dress._id} className="hover:bg-gray-50 transition-colors">
                    <td className="px-6 py-4 text-sm font-medium text-gray-900">
                      {dress.dressNumber}
                    </td>
                    <td className="px-6 py-4 text-sm text-gray-600">
                      {dress.type || '—'}
                    </td>
                    <td className="px-6 py-4">{getStatusBadge(dress.status)}</td>
                    <td className="px-6 py-4 text-sm text-gray-600">
                      {dress.rental ? (
                        <div className="flex items-center gap-2">
                          {dress.rental.isBillPayer && (
                            <span className="px-2 py-1 bg-primary/10 text-primary text-xs rounded font-medium">
                              💳 Payer
                            </span>
                          )}
                          <span>{dress.rental.memberName}</span>
                        </div>
                      ) : (
                        '—'
                      )}
                    </td>
                    <td className="px-6 py-4 text-sm text-gray-600">
                      {dress.rental ? dress.rental.memberPhone : '—'}
                    </td>
                    <td className="px-6 py-4 text-sm text-gray-600">
                      {dress.rental
                        ? new Date(dress.rental.assignedTime).toLocaleString()
                        : '—'}
                    </td>
                    <td className="px-6 py-4 text-sm font-medium text-gray-900">
                      {dress.rental ? `৳${dress.rental.chargeAmount}` : '—'}
                    </td>
                    <td className="px-6 py-4 text-right">
                      <div className="flex items-center justify-end gap-2">
                        {dress.status === 'Available' && (
                          <button
                            onClick={() => handleAssignClick(dress)}
                            className="px-4 py-1.5 text-sm font-medium text-white bg-green-500 rounded hover:bg-green-600 transition-colors"
                          >
                            Assign
                          </button>
                        )}
                        {dress.status === 'Rented' && dress.rental && (
                          <button
                            onClick={() => handleReturnClick(dress)}
                            className="px-4 py-1.5 text-sm font-medium text-white bg-amber-500 rounded hover:bg-amber-600 transition-colors"
                          >
                            Return
                          </button>
                        )}
                        {dress.status === 'Maintenance' && (
                          <span className="px-4 py-1.5 text-sm font-medium text-white bg-yellow-500 rounded">
                            Maintenance
                          </span>
                        )}
                        {dress.status === 'Disabled' && (
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
                  <td colSpan="8" className="px-6 py-8 text-center text-gray-500">
                    No dresses found
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>

        {/* Show count */}
        <div className="border-t border-gray-200 p-6 text-sm text-gray-600">
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
