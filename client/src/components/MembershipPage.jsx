import React, { useState, useEffect, useMemo } from 'react';
import { apiRequest } from '../api.js';
import MemberProfileModal from './MemberProfileModal.jsx';
import ActionDropdown from './ActionDropdown.jsx';
import CollectPaymentModal from './CollectPaymentModal.jsx';

const PLAN_PRICING = {
  Monthly: { reg: 2500, fee: 4000, discount: 0, final: 6500 },
  Quarterly: { reg: 2500, fee: 12000, discount: 4500, final: 10000 },
  'Half-Yearly': { reg: 2500, fee: 24000, discount: 9500, final: 17000 },
  Yearly: { reg: 2500, fee: 48000, discount: 20500, final: 30000 },
};

const PLAN_DURATION = {
  Monthly: 30,
  Quarterly: 90,
  'Half-Yearly': 180,
  Yearly: 365,
};

const PAYMENT_METHODS = ['Cash', 'Bank', 'bKash'];

const StatCard = ({ title, value }) => (
  <div className="card p-4 flex flex-col gap-2">
    <span className="text-sm text-gray-500">{title}</span>
    <span className="text-2xl font-semibold text-secondary">{value}</span>
  </div>
);

const formatDate = (d) => new Date(d).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' });

export default function MembershipPage({ token, showToast, setLastReceipt, setView }) {
  const [stats, setStats] = useState({ newToday: 0, newMonth: 0, activeMembers: 0, revenueMonth: 0, totalDuePending: 0, monthlyCollection: 0 });
  const [members, setMembers] = useState([]);
  
  // Filters
  const [filters, setFilters] = useState({ search: '', status: '', plan: '', startDate: '', endDate: '' });

  // Form Modal State (REVERTED TO MODAL)
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [form, setForm] = useState({
    name: '', phone: '', address: '', plan: 'Monthly', startDate: new Date().toISOString().split('T')[0],
    extraDiscount: 0, amountPaid: null, paymentMethod: 'Cash'
  });

  // Profile Modal State
  const [profileModalOpen, setProfileModalOpen] = useState(false);
  const [selectedMember, setSelectedMember] = useState(null);

  // Collect Payment Modal State
  const [collectModalOpen, setCollectModalOpen] = useState(false);
  const [selectedMemberForCollection, setSelectedMemberForCollection] = useState(null);

  const loadData = async () => {
    try {
      const [statsRes, membersRes] = await Promise.all([
        apiRequest('/memberships/stats', { token }),
        apiRequest(`/memberships?search=${filters.search}&status=${filters.status}&plan=${filters.plan}&startDate=${filters.startDate}&endDate=${filters.endDate}`, { token })
      ]);
      setStats(statsRes);
      setMembers(membersRes.members);
    } catch (err) {
      showToast(err.message);
    }
  };

  const handleCollectClick = (member) => {
    setSelectedMemberForCollection(member);
    setCollectModalOpen(true);
  };

  const handleCollectPaymentSuccess = () => {
    // Refresh data after successful payment
    loadData();
  };

  useEffect(() => {
    let active = true;
    const fetchIt = async () => {
      try {
        const [statsRes, membersRes] = await Promise.all([
          apiRequest('/memberships/stats', { token }),
          apiRequest(`/memberships?search=${filters.search}&status=${filters.status}&plan=${filters.plan}&startDate=${filters.startDate}&endDate=${filters.endDate}`, { token })
        ]);
        if (active) {
          setStats(statsRes);
          setMembers(membersRes.members);
        }
      } catch (err) {
        if (active) showToast(err.message);
      }
    };
    fetchIt();
    return () => { active = false; };
  }, [filters, token, showToast]);

  // Calculate pricing and end date
  const pricing = useMemo(() => PLAN_PRICING[form.plan], [form.plan]);
  const extraDiscount = Number(form.extraDiscount) || 0;
  const finalPayable = pricing.final - extraDiscount;
  const paidAmount = form.amountPaid !== null && form.amountPaid !== '' ? Number(form.amountPaid) : finalPayable;
  const dueAmount = Math.max(0, finalPayable - paidAmount);

  const endDate = useMemo(() => {
    const start = new Date(form.startDate);
    const durationDays = PLAN_DURATION[form.plan] || 30;
    const end = new Date(start.setDate(start.getDate() + durationDays));
    return end.toISOString().split('T')[0];
  }, [form.startDate, form.plan]);

  const submitMember = async (shouldPrint = false) => {
    try {
      if (!form.name || !form.phone) {
        showToast('Please fill in name and phone');
        return;
      }

      const totalDiscount = pricing.discount + extraDiscount;
      const body = {
        ...form,
        endDate,
        amountPaid: paidAmount,
        price: pricing.final + totalDiscount,
        discount: totalDiscount,
      };

      const res = await apiRequest('/memberships', { method: 'POST', body, token });
      showToast('Member saved successfully');
      setIsModalOpen(false);

      // Reset form
      setForm({ name: '', phone: '', address: '', plan: 'Monthly', startDate: new Date().toISOString().split('T')[0], extraDiscount: 0, amountPaid: null, paymentMethod: 'Cash' });
      loadData();

      // Handle print if requested
      if (shouldPrint && res.transaction && setView) {
        const details = {
          plan: form.plan,
          startDate: form.startDate,
          endDate: endDate,
          duration: res.transaction.duration,
        };
        setLastReceipt(res.transaction, details);
        setTimeout(() => setView('receipt'), 100);
      }
    } catch (err) {
      showToast(err.message);
    }
  };

  return (
    <div className="grid gap-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <h2 className="text-xl font-bold">Membership</h2>
        <button className="btn-primary" onClick={() => setIsModalOpen(true)}>➕ Add New Member</button>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <StatCard title="New Members Today" value={stats.newToday} />
        <StatCard title="New Members This Month" value={stats.newMonth} />
        <StatCard title="Active Memberships" value={stats.activeMembers} />
        <StatCard title="Revenue (This Month)" value={`৳ ${stats.revenueMonth.toLocaleString()}`} />
      </div>

      {/* New Stats: Due & Collection */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div className="card p-4 bg-orange-50 border border-orange-200">
          <span className="text-xs text-orange-600 font-medium uppercase">Total Pending Due</span>
          <span className="text-3xl font-bold text-orange-700">৳ {stats.totalDuePending?.toLocaleString() || 0}</span>
        </div>
        <div className="card p-4 bg-green-50 border border-green-200">
          <span className="text-xs text-green-600 font-medium uppercase">Monthly Collection</span>
          <span className="text-3xl font-bold text-green-700">৳ {stats.monthlyCollection?.toLocaleString() || 0}</span>
        </div>
      </div>

      {/* Members List */}
      <div className="card p-4">
        <h3 className="text-lg font-semibold mb-4">Members List</h3>
        <div className="flex flex-col md:flex-row gap-3 mb-4">
          <input className="border rounded-lg px-3 py-2 flex-1" placeholder="Search name or phone..." value={filters.search} onChange={(e) => setFilters({...filters, search: e.target.value})} />
          <select className="border rounded-lg px-3 py-2" value={filters.plan} onChange={(e) => setFilters({...filters, plan: e.target.value})}>
            <option value="">All Plans</option>
            {Object.keys(PLAN_PRICING).map(p => <option key={p} value={p}>{p}</option>)}
          </select>
          <select className="border rounded-lg px-3 py-2" value={filters.status} onChange={(e) => setFilters({...filters, status: e.target.value})}>
            <option value="">All Status</option>
            <option value="Active">Active</option>
            <option value="Expired">Expired</option>
            <option value="Inactive">Inactive</option>
          </select>
        </div>

        <div className="overflow-x-auto text-sm">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="border-b bg-gray-50">
                <th className="p-3">Name</th>
                <th className="p-3">Phone</th>
                <th className="p-3">Plan</th>
                <th className="p-3">Status</th>
                <th className="p-3">Due Amount</th>
                <th className="p-3">Last Payment</th>
                <th className="p-3">Action</th>
              </tr>
            </thead>
            <tbody>
              {members.map(m => (
                <tr key={m._id} className="border-b hover:bg-gray-50">
                  <td className="p-3 font-medium">{m.name}</td>
                  <td className="p-3 text-sm">{m.phone}</td>
                  <td className="p-3">{m.plan}</td>
                  <td className="p-3">
                    <span className={`px-2 py-1 rounded-full text-xs font-semibold ${m.status === 'Active' ? 'bg-green-100 text-green-700' : m.status === 'Expired' ? 'bg-red-100 text-red-700' : 'bg-gray-100 text-gray-700'}`}>
                      {m.status === 'Active' ? '🟢 Active' : m.status === 'Expired' ? '🔴 Expired' : '⚫ Inactive'}
                    </span>
                  </td>
                  <td className="p-3 font-medium">
                    {m.totalDue > 0 ? (
                      <button
                        onClick={() => handleCollectClick(m)}
                        title="Click to collect payment"
                        className="text-blue-600 hover:text-blue-800 hover:underline cursor-pointer font-semibold"
                      >
                        🔴 ৳{m.totalDue.toLocaleString()}
                      </button>
                    ) : (
                      '-'
                    )}
                  </td>
                  <td className="p-3 text-sm text-gray-500">{m.lastPaymentDate ? formatDate(m.lastPaymentDate) : '-'}</td>
                  <td className="p-3">
                    <ActionDropdown
                      actions={[
                        ...(m.totalDue > 0 ? [{
                          label: '💰 Collect Due',
                          onClick: () => handleCollectClick(m),
                        }] : []),
                        {
                          label: 'View Profile',
                          onClick: async () => {
                            const res = await apiRequest(`/memberships/${m._id}`, { token });
                            setSelectedMember(res.member);
                            setProfileModalOpen(true);
                          },
                        },
                        {
                          label: m.status === 'Active' ? 'Mark Expired' : 'Mark Active',
                          onClick: async () => {
                            const newStatus = m.status === 'Active' ? 'Expired' : 'Active';
                            await apiRequest(`/memberships/${m._id}/status`, { method: 'POST', body: { status: newStatus }, token });
                            showToast(`Member marked as ${newStatus}`);
                            loadData();
                          },
                        },
                        {
                          label: m.status === 'Inactive' ? 'Reactivate' : 'Mark Inactive',
                          onClick: async () => {
                            const newStatus = m.status === 'Inactive' ? 'Active' : 'Inactive';
                            await apiRequest(`/memberships/${m._id}/status`, { method: 'POST', body: { status: newStatus }, token });
                            showToast(`Member marked as ${newStatus}`);
                            loadData();
                          },
                        },
                      ]}
                    />
                  </td>
                </tr>
              ))}
              {members.length === 0 && (
                <tr><td colSpan="7" className="p-4 text-center text-gray-500">No members found.</td></tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Add Member Modal */}
      {isModalOpen && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center p-4 z-50 overflow-y-auto">
          <div className="bg-white rounded-xl max-w-2xl w-full p-6 shadow-xl my-8">
            <div className="flex justify-between items-center mb-6 border-b pb-4">
              <h2 className="text-xl font-bold">Add New Member</h2>
              <button className="text-gray-500 hover:text-black text-2xl font-bold" onClick={() => setIsModalOpen(false)}>&times;</button>
            </div>

            <div className="grid md:grid-cols-2 gap-8">
              <div className="space-y-4">
                <h3 className="font-semibold text-gray-700">Basic Info</h3>
                <div>
                  <label className="block text-sm mb-1 text-gray-600">Name *</label>
                  <input className="w-full border rounded-lg px-3 py-2" value={form.name} onChange={(e) => setForm({...form, name: e.target.value})} placeholder="John Doe" />
                </div>
                <div>
                  <label className="block text-sm mb-1 text-gray-600">Phone *</label>
                  <input className="w-full border rounded-lg px-3 py-2" value={form.phone} onChange={(e) => setForm({...form, phone: e.target.value})} placeholder="01XXXXXXXXX" />
                </div>
                <div>
                  <label className="block text-sm mb-1 text-gray-600">Address</label>
                  <input className="w-full border rounded-lg px-3 py-2" value={form.address} onChange={(e) => setForm({...form, address: e.target.value})} placeholder="Enter address" />
                </div>
                <div>
                  <label className="block text-sm mb-1 text-gray-600">Start Date</label>
                  <input type="date" className="w-full border rounded-lg px-3 py-2" value={form.startDate} onChange={(e) => setForm({...form, startDate: e.target.value})} />
                </div>
              </div>

              <div className="space-y-4">
                <h3 className="font-semibold text-gray-700">Package & Payment</h3>
                <div>
                  <label className="block text-sm mb-1 text-gray-600">Membership Plan</label>
                  <select className="w-full border rounded-lg px-3 py-2 font-medium" value={form.plan} onChange={(e) => setForm({...form, plan: e.target.value})}>
                    {Object.keys(PLAN_PRICING).map(p => <option key={p} value={p}>{p}</option>)}
                  </select>
                </div>
                
                <div className="bg-gray-50 border rounded-lg p-3 text-sm space-y-2">
                   <div className="flex justify-between text-gray-600"><span>Registration Fee:</span> <span>{pricing.reg.toLocaleString()}৳</span></div>
                   <div className="flex justify-between text-gray-600"><span>Package Fee:</span> <span>{pricing.fee.toLocaleString()}৳</span></div>
                   <div className="flex justify-between text-gray-600"><span>Base Discount:</span> <span>-{pricing.discount.toLocaleString()}৳</span></div>
                   <div className="border-t pt-2 flex justify-between font-semibold"><span>Package Final:</span> <span>{pricing.final.toLocaleString()}৳</span></div>
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-sm mb-1 text-gray-600">Extra Discount</label>
                    <input type="number" className="w-full border rounded-lg px-3 py-2" value={form.extraDiscount} onChange={(e) => setForm({...form, extraDiscount: e.target.value})} placeholder="0" />
                  </div>
                  <div>
                    <label className="block text-sm mb-1 text-gray-600">Amount Paid (Optional)</label>
                    <input type="number" className="w-full border rounded-lg px-3 py-2" value={form.amountPaid ?? ''} onChange={(e) => setForm({...form, amountPaid: e.target.value === '' ? null : e.target.value})} placeholder={finalPayable.toLocaleString()} />
                  </div>
                </div>

                <div className="grid grid-cols-1 gap-3">
                  <div>
                    <label className="block text-sm mb-1 text-gray-600">Payment Method</label>
                    <select className="w-full border rounded-lg px-3 py-2" value={form.paymentMethod} onChange={(e) => setForm({...form, paymentMethod: e.target.value})}>
                      {PAYMENT_METHODS.map(p => <option key={p} value={p}>{p}</option>)}
                    </select>
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-3 text-sm">
                  <div className="bg-blue-50 text-blue-900 border border-blue-100 rounded-lg p-3">
                     <span className="font-semibold">Total Payable:</span>
                     <div className="text-lg font-bold">{finalPayable.toLocaleString()}৳</div>
                  </div>
                  <div className={`border rounded-lg p-3 ${dueAmount > 0 ? 'bg-orange-50 text-orange-900 border-orange-100' : 'bg-green-50 text-green-900 border-green-100'}`}>
                     <span className="font-semibold">Remaining Due:</span>
                     <div className="text-lg font-bold">{dueAmount.toLocaleString()}৳</div>
                  </div>
                </div>

                <div className="bg-slate-50 border rounded-lg p-3">
                   <span className="text-xs text-slate-600 font-medium uppercase">Amount Paid Today</span>
                   <div className="text-xl font-bold text-slate-800">{paidAmount.toLocaleString()}৳</div>
                </div>
              </div>
            </div>

            <div className="mt-8 flex justify-end gap-3 border-t pt-4">
              <button className="px-4 py-2 border rounded-lg hover:bg-gray-50 no-print" onClick={() => setIsModalOpen(false)}>Cancel</button>
              <button className="px-5 py-2 bg-secondary text-white rounded-lg font-semibold hover:opacity-90 no-print" onClick={() => submitMember(false)}>Save Member</button>
              <button className="px-5 py-2 bg-primary text-white rounded-lg font-semibold hover:opacity-90 no-print" onClick={() => submitMember(true)}>Save & Print Receipt</button>
            </div>
          </div>
        </div>
      )}

      <MemberProfileModal
        isOpen={profileModalOpen}
        member={selectedMember}
        onClose={() => {
          setProfileModalOpen(false);
          setSelectedMember(null);
        }}
        token={token}
        showToast={showToast}
        onSave={() => {
          loadData();
        }}
      />

      <CollectPaymentModal
        isOpen={collectModalOpen}
        memberId={selectedMemberForCollection?._id}
        memberName={selectedMemberForCollection?.name}
        totalDue={selectedMemberForCollection?.totalDue}
        onClose={() => {
          setCollectModalOpen(false);
          setSelectedMemberForCollection(null);
        }}
        onSuccess={handleCollectPaymentSuccess}
        showToast={showToast}
        token={token}
      />
    </div>
  );
}