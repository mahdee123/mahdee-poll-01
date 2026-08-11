import React, { useState, useEffect } from 'react';
import { Lock, Users, Search } from 'lucide-react';
import { apiRequest } from '../api';
import Toast from './Toast';
import EmptyState from './EmptyState';
import LoadingSpinner from './LoadingSpinner';

export default function LockerHistoryPage({ token }) {
  const [activeTab, setActiveTab] = useState('byLocker');
  const [loading, setLoading] = useState(false);
  const [toast, setToast] = useState(null);

  // By Locker tab
  const [lockers, setLockers] = useState([]);
  const [selectedLocker, setSelectedLocker] = useState(null);
  const [lockerHistory, setLockerHistory] = useState([]);
  const [lockerSearch, setLockerSearch] = useState('');

  // By Member tab
  const [members, setMembers] = useState([]);
  const [students, setStudents] = useState([]);
  const [selectedMember, setSelectedMember] = useState(null);
  const [memberHistory, setMemberHistory] = useState([]);
  const [memberSearch, setMemberSearch] = useState('');
  const [memberType, setMemberType] = useState('Member');

  // Date filters
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');

  useEffect(() => {
    fetchLockers();
    fetchMembers();
  }, []);

  const fetchLockers = async () => {
    try {
      const res = await apiRequest('/lockers', { token });
      setLockers(res.lockers || []);
    } catch (error) {
      console.error('Error fetching lockers:', error);
    }
  };

  const fetchMembers = async () => {
    try {
      const [membersRes, studentsRes] = await Promise.all([
        apiRequest('/memberships?status=Active', { token }).catch(() => ({ members: [] })),
        apiRequest('/training?status=active', { token }).catch(() => ({ students: [] })),
      ]);

      setMembers(membersRes.members || []);
      setStudents(studentsRes.students || []);
    } catch (error) {
      console.error('Error fetching members:', error);
    }
  };

  const handleLockerSelect = async (locker) => {
    setSelectedLocker(locker);
    try {
      setLoading(true);
      const params = new URLSearchParams();
      if (startDate) params.append('startDate', startDate);
      if (endDate) params.append('endDate', endDate);

      const res = await apiRequest(`/lockers/${locker._id}/history?${params.toString()}`, { token });
      setLockerHistory(res.history || []);
    } catch (error) {
      console.error('Error fetching locker history:', error);
      setToast({ type: 'error', message: 'Failed to fetch history' });
    } finally {
      setLoading(false);
    }
  };

  const handleMemberSelect = async (member) => {
    setSelectedMember(member);
    try {
      setLoading(true);
      const params = new URLSearchParams();
      if (startDate) params.append('startDate', startDate);
      if (endDate) params.append('endDate', endDate);

      const res = await apiRequest(`/lockers/member/${member._id}/history?${params.toString()}`, { token });
      setMemberHistory(res.history || []);
    } catch (error) {
      console.error('Error fetching member history:', error);
      setToast({ type: 'error', message: 'Failed to fetch history' });
    } finally {
      setLoading(false);
    }
  };

  const getFilteredLockers = () => {
    return lockers.filter((l) =>
      l.lockerNumber.toLowerCase().includes(lockerSearch.toLowerCase())
    );
  };

  const getFilteredMembers = () => {
    const list = memberType === 'Member' ? members : students;
    return list.filter(
      (m) =>
        m.name?.toLowerCase().includes(memberSearch.toLowerCase()) ||
        m.phone?.includes(memberSearch)
    );
  };

  const calculateDuration = (assignedTime, returnedTime) => {
    const assigned = new Date(assignedTime);
    const returned = new Date(returnedTime);
    const diffMs = returned - assigned;
    const diffMins = Math.floor(diffMs / 60000);

    if (diffMins < 60) {
      return `${diffMins} min`;
    }
    const diffHours = Math.floor(diffMins / 60);
    return `${diffHours}h ${diffMins % 60}m`;
  };

  return (
    <div className="space-y-6">
      {/* Tabs */}
      <div className="segmented">
        <button
          onClick={() => { setActiveTab('byLocker'); setLockerHistory([]); setSelectedLocker(null); }}
          className={`flex-1 flex items-center justify-center gap-1.5 ${activeTab === 'byLocker' ? 'segmented-item-active' : 'segmented-item'}`}
        >
          <Lock size={14} /> By locker
        </button>
        <button
          onClick={() => { setActiveTab('byMember'); setMemberHistory([]); setSelectedMember(null); }}
          className={`flex-1 flex items-center justify-center gap-1.5 ${activeTab === 'byMember' ? 'segmented-item-active' : 'segmented-item'}`}
        >
          <Users size={14} /> By member
        </button>
      </div>

      {/* Date Filters */}
      <div className="card p-4 flex gap-4 flex-wrap">
        <div className="flex-1 min-w-48">
          <label className="label">From date</label>
          <input type="date" value={startDate} onChange={(e) => setStartDate(e.target.value)} className="input" />
        </div>
        <div className="flex-1 min-w-48">
          <label className="label">To date</label>
          <input type="date" value={endDate} onChange={(e) => setEndDate(e.target.value)} className="input" />
        </div>
      </div>

      {/* By Locker Tab */}
      {activeTab === 'byLocker' && (
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          {/* Locker Selection */}
          <div className="card p-4">
            <h3 className="section-title mb-3">Lockers</h3>
            <div className="relative mb-3">
              <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-ink-faint pointer-events-none" />
              <input
                type="text"
                placeholder="Search locker…"
                value={lockerSearch}
                onChange={(e) => setLockerSearch(e.target.value)}
                className="input pl-9"
              />
            </div>
            <div className="max-h-96 overflow-y-auto border border-line rounded-card divide-y divide-line">
              {getFilteredLockers().length > 0 ? (
                getFilteredLockers().map((locker) => (
                  <button
                    key={locker._id}
                    onClick={() => handleLockerSelect(locker)}
                    className={`w-full text-left px-4 py-3 transition-colors hover:bg-canvas ${
                      selectedLocker?._id === locker._id ? 'bg-primary-50 border-l-4 border-l-primary' : ''
                    }`}
                  >
                    <div className="font-medium text-ink">{locker.lockerNumber}</div>
                  </button>
                ))
              ) : (
                <div className="p-4 text-center text-sm text-ink-soft">No lockers found</div>
              )}
            </div>
          </div>

          {/* History Table */}
          <div className="md:col-span-2 card overflow-hidden">
            {selectedLocker ? (
              <>
                <div className="px-4 py-3 border-b border-line bg-canvas">
                  <h3 className="font-semibold text-ink">History: {selectedLocker.lockerNumber}</h3>
                </div>
                <div className="overflow-x-auto">
                  {loading ? (
                    <LoadingSpinner message="Loading history…" />
                  ) : lockerHistory.length > 0 ? (
                    <table className="table-modern w-full">
                      <thead>
                        <tr>
                          <th>Member</th>
                          <th>Assigned</th>
                          <th>Returned</th>
                          <th>Duration</th>
                          <th>Charge</th>
                        </tr>
                      </thead>
                      <tbody>
                        {lockerHistory.map((history) => (
                          <tr key={history._id}>
                            <td className="text-ink">{history.memberName}</td>
                            <td className="text-ink-soft">{new Date(history.assignedTime).toLocaleString()}</td>
                            <td className="text-ink-soft">{new Date(history.returnedTime).toLocaleString()}</td>
                            <td className="font-medium">{calculateDuration(history.assignedTime, history.returnedTime)}</td>
                            <td className="font-medium tabular">৳{history.chargeAmount}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  ) : (
                    <EmptyState icon={Lock} title="No history records" message="Assignments for this locker will show up here." />
                  )}
                </div>
              </>
            ) : (
              <EmptyState icon={Lock} title="Select a locker" message="Choose a locker from the list to view its history." />
            )}
          </div>
        </div>
      )}

      {/* By Member Tab */}
      {activeTab === 'byMember' && (
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          {/* Member Selection */}
          <div className="card p-4">
            <h3 className="section-title mb-3">Members</h3>

            <div className="segmented mb-3 w-full">
              {['Member', 'Student'].map((type) => (
                <button
                  key={type}
                  onClick={() => { setMemberType(type); setSelectedMember(null); }}
                  className={`flex-1 ${memberType === type ? 'segmented-item-active' : 'segmented-item'}`}
                >
                  {type}
                </button>
              ))}
            </div>

            <div className="relative mb-3">
              <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-ink-faint pointer-events-none" />
              <input
                type="text"
                placeholder="Search member…"
                value={memberSearch}
                onChange={(e) => setMemberSearch(e.target.value)}
                className="input pl-9"
              />
            </div>
            <div className="max-h-96 overflow-y-auto border border-line rounded-card divide-y divide-line">
              {getFilteredMembers().length > 0 ? (
                getFilteredMembers().map((member) => (
                  <button
                    key={member._id}
                    onClick={() => handleMemberSelect(member)}
                    className={`w-full text-left px-4 py-3 transition-colors hover:bg-canvas ${
                      selectedMember?._id === member._id ? 'bg-primary-50 border-l-4 border-l-primary' : ''
                    }`}
                  >
                    <div className="font-medium text-ink">{member.name}</div>
                    <div className="text-xs text-ink-soft">{member.phone}</div>
                  </button>
                ))
              ) : (
                <div className="p-4 text-center text-sm text-ink-soft">No members found</div>
              )}
            </div>
          </div>

          {/* History Table */}
          <div className="md:col-span-2 card overflow-hidden">
            {selectedMember ? (
              <>
                <div className="px-4 py-3 border-b border-line bg-canvas">
                  <h3 className="font-semibold text-ink">History: {selectedMember.name}</h3>
                </div>
                <div className="overflow-x-auto">
                  {loading ? (
                    <LoadingSpinner message="Loading history…" />
                  ) : memberHistory.length > 0 ? (
                    <table className="table-modern w-full">
                      <thead>
                        <tr>
                          <th>Locker</th>
                          <th>Assigned</th>
                          <th>Returned</th>
                          <th>Duration</th>
                          <th>Charge</th>
                        </tr>
                      </thead>
                      <tbody>
                        {memberHistory.map((history) => (
                          <tr key={history._id}>
                            <td className="font-medium text-ink">Locker</td>
                            <td className="text-ink-soft">{new Date(history.assignedTime).toLocaleString()}</td>
                            <td className="text-ink-soft">{new Date(history.returnedTime).toLocaleString()}</td>
                            <td className="font-medium">{calculateDuration(history.assignedTime, history.returnedTime)}</td>
                            <td className="font-medium tabular">৳{history.chargeAmount}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  ) : (
                    <EmptyState icon={Users} title="No history records" message="Assignments for this member will show up here." />
                  )}
                </div>
              </>
            ) : (
              <EmptyState icon={Users} title="Select a member" message="Choose a member from the list to view their history." />
            )}
          </div>
        </div>
      )}

      {toast && <Toast type={toast.type} message={toast.message} onClose={() => setToast(null)} />}
    </div>
  );
}
