import React, { useState, useEffect } from 'react';
import { apiRequest } from '../api';
import Toast from './Toast';

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
      const res = await apiRequest('/dress-rentals', {
        token: token || localStorage.getItem('token'),
      });
      setDresses(res.dresses || []);
    } catch (error) {
      console.error('Error fetching dresses:', error);
    }
  };

  const fetchMembers = async () => {
    try {
      const [membersRes, studentsRes] = await Promise.all([
        apiRequest('/memberships?status=Active', {
          token: token || localStorage.getItem('token'),
        }).catch(() => ({ members: [] })),
        apiRequest('/training?status=active', {
          token: token || localStorage.getItem('token'),
        }).catch(() => ({ students: [] })),
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

      const res = await apiRequest(
        `/dress-rentals/${dress._id}/history?${params.toString()}`,
        {
          token: token || localStorage.getItem('token'),
        }
      );
      setDressHistory(res.history || []);
    } catch (error) {
      console.error('Error fetching dress history:', error);
      setToast({
        type: 'error',
        message: 'Failed to fetch history',
      });
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

      const res = await apiRequest(
        `/dress-rentals/member/${member._id}/history?${params.toString()}`,
        {
          token: token || localStorage.getItem('token'),
        }
      );
      setMemberHistory(res.history || []);
    } catch (error) {
      console.error('Error fetching member history:', error);
      setToast({
        type: 'error',
        message: 'Failed to fetch history',
      });
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
      <div className="bg-white rounded-lg shadow border-b border-gray-200">
        <div className="flex">
          <button
            onClick={() => {
              setActiveTab('byDress');
              setDressHistory([]);
              setSelectedDress(null);
            }}
            className={`flex-1 px-6 py-4 text-center font-medium transition-colors ${
              activeTab === 'byDress'
                ? 'border-b-2 border-primary text-primary'
                : 'text-gray-600 hover:text-gray-900'
            }`}
          >
            By Dress
          </button>
          <button
            onClick={() => {
              setActiveTab('byMember');
              setMemberHistory([]);
              setSelectedMember(null);
            }}
            className={`flex-1 px-6 py-4 text-center font-medium transition-colors ${
              activeTab === 'byMember'
                ? 'border-b-2 border-primary text-primary'
                : 'text-gray-600 hover:text-gray-900'
            }`}
          >
            By Member
          </button>
        </div>
      </div>

      <div className="bg-white rounded-lg shadow p-4 flex gap-4 flex-wrap">
        <div className="flex-1 min-w-48">
          <label className="block text-sm font-medium text-gray-700 mb-1">From Date</label>
          <input
            type="date"
            value={startDate}
            onChange={(e) => setStartDate(e.target.value)}
            className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary outline-none"
          />
        </div>
        <div className="flex-1 min-w-48">
          <label className="block text-sm font-medium text-gray-700 mb-1">To Date</label>
          <input
            type="date"
            value={endDate}
            onChange={(e) => setEndDate(e.target.value)}
            className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary outline-none"
          />
        </div>
      </div>

      {activeTab === 'byDress' && (
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          <div className="bg-white rounded-lg shadow p-4">
            <h3 className="font-semibold text-gray-900 mb-3">Dresses</h3>
            <input
              type="text"
              placeholder="Search dress..."
              value={dressSearch}
              onChange={(e) => setDressSearch(e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary outline-none mb-3"
            />
            <div className="max-h-96 overflow-y-auto border border-gray-200 rounded-lg">
              {getFilteredDresses().length > 0 ? (
                getFilteredDresses().map((dress) => (
                  <button
                    key={dress._id}
                    onClick={() => handleDressSelect(dress)}
                    className={`w-full text-left px-4 py-3 border-b border-gray-100 transition-colors hover:bg-gray-50 ${
                      selectedDress?._id === dress._id ? 'bg-primary/5 border-l-4 border-l-primary' : ''
                    }`}
                  >
                    <div className="font-medium text-gray-900">{dress.dressNumber}</div>
                    <div className="text-xs text-gray-600">{dress.type}</div>
                  </button>
                ))
              ) : (
                <div className="p-4 text-center text-gray-500">No dresses found</div>
              )}
            </div>
          </div>

          <div className="md:col-span-2 bg-white rounded-lg shadow overflow-hidden">
            {selectedDress ? (
              <>
                <div className="p-4 border-b border-gray-200 bg-gray-50">
                  <h3 className="font-semibold text-gray-900">
                    History: {selectedDress.dressNumber}
                  </h3>
                </div>
                <div className="overflow-x-auto">
                  {loading ? (
                    <div className="p-8 text-center text-gray-500">Loading...</div>
                  ) : dressHistory.length > 0 ? (
                    <table className="w-full">
                      <thead className="bg-gray-50 border-b border-gray-200">
                        <tr>
                          <th className="px-4 py-3 text-left text-sm font-semibold text-gray-700">
                            Dress
                          </th>
                          <th className="px-4 py-3 text-left text-sm font-semibold text-gray-700">
                            Type
                          </th>
                          <th className="px-4 py-3 text-left text-sm font-semibold text-gray-700">
                            Member
                          </th>
                          <th className="px-4 py-3 text-left text-sm font-semibold text-gray-700">
                            Assigned
                          </th>
                          <th className="px-4 py-3 text-left text-sm font-semibold text-gray-700">
                            Returned
                          </th>
                          <th className="px-4 py-3 text-left text-sm font-semibold text-gray-700">
                            Duration
                          </th>
                          <th className="px-4 py-3 text-left text-sm font-semibold text-gray-700">
                            Charge
                          </th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-gray-200">
                        {dressHistory.map((history) => (
                          <tr key={history._id} className="hover:bg-gray-50">
                            <td className="px-4 py-3 text-sm font-medium text-gray-900">
                              {history.dressNumber}
                            </td>
                            <td className="px-4 py-3 text-sm text-gray-600">
                              {history.dressType}
                            </td>
                            <td className="px-4 py-3 text-sm text-gray-900">
                              {history.memberName}
                            </td>
                            <td className="px-4 py-3 text-sm text-gray-600">
                              {new Date(history.assignedTime).toLocaleString()}
                            </td>
                            <td className="px-4 py-3 text-sm text-gray-600">
                              {history.returnedTime
                                ? new Date(history.returnedTime).toLocaleString()
                                : '—'}
                            </td>
                            <td className="px-4 py-3 text-sm font-medium text-gray-900">
                              {history.returnedTime
                                ? calculateDuration(history.assignedTime, history.returnedTime)
                                : '—'}
                            </td>
                            <td className="px-4 py-3 text-sm font-medium text-gray-900">
                              ৳{history.chargeAmount}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  ) : (
                    <div className="p-8 text-center text-gray-500">No history records</div>
                  )}
                </div>
              </>
            ) : (
              <div className="p-8 text-center text-gray-500">Select a dress to view history</div>
            )}
          </div>
        </div>
      )}

      {activeTab === 'byMember' && (
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          <div className="bg-white rounded-lg shadow p-4">
            <h3 className="font-semibold text-gray-900 mb-3">Members</h3>

            <div className="mb-3">
              <div className="flex gap-2">
                {['Member', 'Student'].map((type) => (
                  <button
                    key={type}
                    onClick={() => {
                      setMemberType(type);
                      setSelectedMember(null);
                    }}
                    className={`flex-1 px-2 py-1 text-xs font-medium rounded ${
                      memberType === type
                        ? 'bg-primary text-white'
                        : 'bg-gray-100 text-gray-700'
                    }`}
                  >
                    {type}
                  </button>
                ))}
              </div>
            </div>

            <input
              type="text"
              placeholder="Search member..."
              value={memberSearch}
              onChange={(e) => setMemberSearch(e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary outline-none mb-3"
            />
            <div className="max-h-96 overflow-y-auto border border-gray-200 rounded-lg">
              {getFilteredMembers().length > 0 ? (
                getFilteredMembers().map((member) => (
                  <button
                    key={member._id}
                    onClick={() => handleMemberSelect(member)}
                    className={`w-full text-left px-4 py-3 border-b border-gray-100 transition-colors hover:bg-gray-50 ${
                      selectedMember?._id === member._id ? 'bg-primary/5 border-l-4 border-l-primary' : ''
                    }`}
                  >
                    <div className="font-medium text-gray-900">{member.name}</div>
                    <div className="text-xs text-gray-600">{member.phone}</div>
                  </button>
                ))
              ) : (
                <div className="p-4 text-center text-gray-500">No members found</div>
              )}
            </div>
          </div>

          <div className="md:col-span-2 bg-white rounded-lg shadow overflow-hidden">
            {selectedMember ? (
              <>
                <div className="p-4 border-b border-gray-200 bg-gray-50">
                  <h3 className="font-semibold text-gray-900">
                    History: {selectedMember.name}
                  </h3>
                </div>
                <div className="overflow-x-auto">
                  {loading ? (
                    <div className="p-8 text-center text-gray-500">Loading...</div>
                  ) : memberHistory.length > 0 ? (
                    <table className="w-full">
                      <thead className="bg-gray-50 border-b border-gray-200">
                        <tr>
                          <th className="px-4 py-3 text-left text-sm font-semibold text-gray-700">
                            Dress
                          </th>
                          <th className="px-4 py-3 text-left text-sm font-semibold text-gray-700">
                            Type
                          </th>
                          <th className="px-4 py-3 text-left text-sm font-semibold text-gray-700">
                            Assigned
                          </th>
                          <th className="px-4 py-3 text-left text-sm font-semibold text-gray-700">
                            Returned
                          </th>
                          <th className="px-4 py-3 text-left text-sm font-semibold text-gray-700">
                            Duration
                          </th>
                          <th className="px-4 py-3 text-left text-sm font-semibold text-gray-700">
                            Charge
                          </th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-gray-200">
                        {memberHistory.map((history) => (
                          <tr key={history._id} className="hover:bg-gray-50">
                            <td className="px-4 py-3 text-sm font-medium text-gray-900">
                              {history.dressNumber}
                            </td>
                            <td className="px-4 py-3 text-sm text-gray-600">
                              {history.dressType}
                            </td>
                            <td className="px-4 py-3 text-sm text-gray-600">
                              {new Date(history.assignedTime).toLocaleString()}
                            </td>
                            <td className="px-4 py-3 text-sm text-gray-600">
                              {history.returnedTime
                                ? new Date(history.returnedTime).toLocaleString()
                                : '—'}
                            </td>
                            <td className="px-4 py-3 text-sm font-medium text-gray-900">
                              {history.returnedTime
                                ? calculateDuration(history.assignedTime, history.returnedTime)
                                : '—'}
                            </td>
                            <td className="px-4 py-3 text-sm font-medium text-gray-900">
                              ৳{history.chargeAmount}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  ) : (
                    <div className="p-8 text-center text-gray-500">No history records</div>
                  )}
                </div>
              </>
            ) : (
              <div className="p-8 text-center text-gray-500">Select a member to view history</div>
            )}
          </div>
        </div>
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
