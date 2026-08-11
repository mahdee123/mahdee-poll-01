import React, { useState, useEffect } from 'react';
import { Shirt, Users, Search } from 'lucide-react';
import { apiRequest } from '../api';
import Toast from './Toast';
import EmptyState from './EmptyState';
import LoadingSpinner from './LoadingSpinner';

export default function DressHistoryPage({ token }) {
  const [activeTab, setActiveTab] = useState('byDress');
  const [loading, setLoading] = useState(false);
  const [toast, setToast] = useState(null);

  // By Dress tab
  const [dresses, setDresses] = useState([]);
  const [selectedDress, setSelectedDress] = useState(null);
  const [dressHistory, setDressHistory] = useState([]);
  const [dressSearch, setDressSearch] = useState('');

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
    fetchDresses();
    fetchMembers();
  }, []);

  const fetchDresses = async () => {
    try {
      const res = await apiRequest('/dress-rentals', { token });
      setDresses(res.dresses || []);
    } catch (error) {
      console.error('Error fetching dresses:', error);
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

  const handleDressSelect = async (dress) => {
    setSelectedDress(dress);
    try {
      setLoading(true);
      const params = new URLSearchParams();
      if (startDate) params.append('startDate', startDate);
      if (endDate) params.append('endDate', endDate);

      const res = await apiRequest(`/dress-rentals/${dress._id}/history?${params.toString()}`, { token });
      setDressHistory(res.history || []);
    } catch (error) {
      console.error('Error fetching dress history:', error);
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

      const res = await apiRequest(`/dress-rentals/member/${member._id}/history?${params.toString()}`, { token });
      setMemberHistory(res.history || []);
    } catch (error) {
      console.error('Error fetching member history:', error);
      setToast({ type: 'error', message: 'Failed to fetch history' });
    } finally {
      setLoading(false);
    }
  };

  const getFilteredDresses = () => {
    return dresses.filter((d) =>
      d.dressNumber?.toLowerCase().includes(dressSearch.toLowerCase()) ||
      d.dressType?.toLowerCase().includes(dressSearch.toLowerCase())
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
      <div className="segmented">
        <button
          onClick={() => { setActiveTab('byDress'); setDressHistory([]); setSelectedDress(null); }}
          className={`flex-1 flex items-center justify-center gap-1.5 ${activeTab === 'byDress' ? 'segmented-item-active' : 'segmented-item'}`}
        >
          <Shirt size={14} /> By dress
        </button>
        <button
          onClick={() => { setActiveTab('byMember'); setMemberHistory([]); setSelectedMember(null); }}
          className={`flex-1 flex items-center justify-center gap-1.5 ${activeTab === 'byMember' ? 'segmented-item-active' : 'segmented-item'}`}
        >
          <Users size={14} /> By member
        </button>
      </div>

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

      {activeTab === 'byDress' && (
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          <div className="card p-4">
            <h3 className="section-title mb-3">Dresses</h3>
            <div className="relative mb-3">
              <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-ink-faint pointer-events-none" />
              <input
                type="text"
                placeholder="Search dress…"
                value={dressSearch}
                onChange={(e) => setDressSearch(e.target.value)}
                className="input pl-9"
              />
            </div>
            <div className="max-h-96 overflow-y-auto border border-line rounded-card divide-y divide-line">
              {getFilteredDresses().length > 0 ? (
                getFilteredDresses().map((dress) => (
                  <button
                    key={dress._id}
                    onClick={() => handleDressSelect(dress)}
                    className={`w-full text-left px-4 py-3 transition-colors hover:bg-canvas ${
                      selectedDress?._id === dress._id ? 'bg-primary-50 border-l-4 border-l-primary' : ''
                    }`}
                  >
                    <div className="font-medium text-ink">{dress.dressNumber}</div>
                    <div className="text-xs text-ink-soft">{dress.type}</div>
                  </button>
                ))
              ) : (
                <div className="p-4 text-center text-sm text-ink-soft">No dresses found</div>
              )}
            </div>
          </div>

          <div className="md:col-span-2 card overflow-hidden">
            {selectedDress ? (
              <>
                <div className="px-4 py-3 border-b border-line bg-canvas">
                  <h3 className="font-semibold text-ink">History: {selectedDress.dressNumber}</h3>
                </div>
                <div className="overflow-x-auto">
                  {loading ? (
                    <LoadingSpinner message="Loading history…" />
                  ) : dressHistory.length > 0 ? (
                    <table className="table-modern w-full">
                      <thead>
                        <tr>
                          <th>Dress</th>
                          <th>Type</th>
                          <th>Member</th>
                          <th>Assigned</th>
                          <th>Returned</th>
                          <th>Duration</th>
                          <th>Charge</th>
                        </tr>
                      </thead>
                      <tbody>
                        {dressHistory.map((history) => (
                          <tr key={history._id}>
                            <td className="font-medium text-ink">{history.dressNumber}</td>
                            <td className="text-ink-soft">{history.dressType}</td>
                            <td className="text-ink">{history.memberName}</td>
                            <td className="text-ink-soft">{new Date(history.assignedTime).toLocaleString()}</td>
                            <td className="text-ink-soft">
                              {history.returnedTime ? new Date(history.returnedTime).toLocaleString() : '—'}
                            </td>
                            <td className="font-medium">
                              {history.returnedTime ? calculateDuration(history.assignedTime, history.returnedTime) : '—'}
                            </td>
                            <td className="font-medium tabular">৳{history.chargeAmount}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  ) : (
                    <EmptyState icon={Shirt} title="No history records" message="Assignments for this dress will show up here." />
                  )}
                </div>
              </>
            ) : (
              <EmptyState icon={Shirt} title="Select a dress" message="Choose a dress from the list to view its history." />
            )}
          </div>
        </div>
      )}

      {activeTab === 'byMember' && (
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
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
                          <th>Dress</th>
                          <th>Type</th>
                          <th>Assigned</th>
                          <th>Returned</th>
                          <th>Duration</th>
                          <th>Charge</th>
                        </tr>
                      </thead>
                      <tbody>
                        {memberHistory.map((history) => (
                          <tr key={history._id}>
                            <td className="font-medium text-ink">{history.dressNumber}</td>
                            <td className="text-ink-soft">{history.dressType}</td>
                            <td className="text-ink-soft">{new Date(history.assignedTime).toLocaleString()}</td>
                            <td className="text-ink-soft">
                              {history.returnedTime ? new Date(history.returnedTime).toLocaleString() : '—'}
                            </td>
                            <td className="font-medium">
                              {history.returnedTime ? calculateDuration(history.assignedTime, history.returnedTime) : '—'}
                            </td>
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
