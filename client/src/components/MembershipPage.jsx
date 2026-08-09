import React, { useState, useEffect, useMemo } from 'react';
import { apiRequest } from '../api.js';
import { BarChart, Bar, ResponsiveContainer } from 'recharts';
import MemberProfileModal from './MemberProfileModal.jsx';
import ActionDropdown from './ActionDropdown.jsx';
import CollectPaymentModal from './CollectPaymentModal.jsx';
import MembershipSettingsModal from './MembershipSettingsModal.jsx';

const MiniBarChart = ({ data, color }) => (
  <div className="w-16 h-6">
    <ResponsiveContainer width="100%" height="100%">
      <BarChart data={data}>
        <Bar dataKey="value" fill={color} radius={[2, 2, 0, 0]} />
      </BarChart>
    </ResponsiveContainer>
  </div>
);

const DEFAULT_PACKAGES = [
  { title: 'Monthly', duration: 1, amount: 6500, monthlyFee: 2000, color: '#3B82F6', admissionFee: true },
  { title: 'Quarterly', duration: 3, amount: 10000, monthlyFee: 2000, color: '#8B5CF6', admissionFee: true },
  { title: 'Half Yearly', duration: 6, amount: 17000, monthlyFee: 2000, color: '#F59E0B', admissionFee: true },
  { title: 'Yearly', duration: 12, amount: 30000, monthlyFee: 2000, color: '#22C55E', admissionFee: true },
];

const PAYMENT_METHODS = ['Cash', 'Bank', 'bKash'];
const COMPUTED_STATUSES = ['Monthly Due', 'Admission Due'];
const isComputedStatus = (s) => COMPUTED_STATUSES.includes(s);

const StatCard = ({ title, value }) => (
  <div className="card p-3 sm:p-4 flex flex-col gap-1 sm:gap-2">
    <span className="text-xs sm:text-sm text-gray-500">{title}</span>
    <span className="text-xl sm:text-2xl font-semibold text-secondary">{value}</span>
  </div>
);

const formatDate = (d) => new Date(d).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' });

const calculateMonthlyDue = (member) => {
  if (!member.dueHistory || member.dueHistory.length === 0) return 0;
  const unpaidMonths = member.dueHistory.filter(e => e.type === 'Due' && e.reason?.startsWith('Monthly Fee') && !e.paid);
  return unpaidMonths.reduce((sum, e) => sum + (e.amount || 0), 0);
};

const getOldestUnpaidMonth = (member) => {
  if (!member.dueHistory || member.dueHistory.length === 0) return null;
  const unpaid = member.dueHistory.filter(e => e.type === 'Due' && e.reason?.startsWith('Monthly Fee') && !e.paid);
  if (unpaid.length === 0) return null;
  return unpaid[0];
};

const getStatusBadges = (member) => {
  const now = new Date();
  const endDate = new Date(member.endDate);
  const badges = [];

  if (member.status === 'Inactive') {
    badges.push({ label: 'Inactive', color: 'bg-gray-100 text-gray-700' });
    return badges;
  }

  if (endDate <= now) {
    badges.push({ label: 'Expired', color: 'bg-red-100 text-red-700' });
  }

  // Admission Due (one-time admission due)
  if ((member.totalDue || 0) > 0) {
    badges.push({ label: 'Admission Due', color: 'bg-orange-100 text-orange-700' });
  }

  // Monthly Due (recurring)
  const monthlyDue = calculateMonthlyDue(member);
  if (monthlyDue > 0) {
    badges.push({ label: 'Monthly Due', color: 'bg-yellow-100 text-yellow-700' });
  }

  if (badges.length === 0) {
    badges.push({ label: 'Active', color: 'bg-green-100 text-green-700' });
  }

  return badges;
};

export default function MembershipPage({ token, showToast, setLastReceipt, setView }) {
  const [stats, setStats] = useState({ newToday: 0, newMonth: 0, activeMembers: 0, incomeMonth: 0, totalDuePending: 0, monthlyCollection: 0 });
  const [members, setMembers] = useState([]);
  const [trendData, setTrendData] = useState({
    currentIncome: 0, currentCount: 0, prevIncome: 0,
    currentMembers: 0, prevMembers: 0,
    dailyTimeline: []
  });
  
  // Filters
  const [filters, setFilters] = useState({ search: '', status: '', plan: '', startDate: '', endDate: '' });
  const [dateRangeType, setDateRangeType] = useState('daily'); // daily, weekly, monthly, custom
  const today = new Date().toISOString().split('T')[0];
  const [customStartDate, setCustomStartDate] = useState(today);
  const [customEndDate, setCustomEndDate] = useState(today);

  // Helper function to calculate date range
  const getDateRange = (type) => {
    const now = new Date();
    let startDate = '';
    let endDate = now.toISOString().split('T')[0];
    
    switch(type) {
      case 'daily':
        startDate = endDate; // Today only
        break;
      case 'weekly':
        const weekAgo = new Date(now);
        weekAgo.setDate(now.getDate() - 7);
        startDate = weekAgo.toISOString().split('T')[0];
        break;
      case 'monthly':
        const monthAgo = new Date(now);
        monthAgo.setMonth(now.getMonth() - 1);
        startDate = monthAgo.toISOString().split('T')[0];
        break;
      case 'custom':
        startDate = customStartDate;
        endDate = customEndDate;
        break;
      default:
        startDate = endDate; // Default to today
    }
    
    return { startDate, endDate };
  };

  // Update filters when date range changes
  const handleDateRangeChange = (type) => {
    setDateRangeType(type);
    if (type === 'custom') {
      setFilters((prev) => ({
        ...prev,
        startDate: customStartDate,
        endDate: customEndDate,
      }));
      return;
    }

    const { startDate, endDate } = getDateRange(type);
    setFilters((prev) => ({ ...prev, startDate, endDate }));
  };

  // Update filters when custom date changes
  const handleCustomDateChange = (nextStartDate, nextEndDate) => {
    const startDate = nextStartDate ?? customStartDate;
    const endDate = nextEndDate ?? customEndDate;
    if (startDate && endDate) {
      setFilters((prev) => ({ ...prev, startDate, endDate }));
    }
  };

  // Get label for new members based on date range
  const getNewMembersLabel = () => {
    switch(dateRangeType) {
      case 'daily': return 'New Members Today';
      case 'weekly': return 'New Members (7 Days)';
      case 'monthly': return 'New Members (30 Days)';
      case 'custom': return filters.startDate === filters.endDate ? 'New Members (This Date)' : 'New Members (Date Range)';
      default: return 'New Members (Month)';
    }
  };

  // Form Modal State (REVERTED TO MODAL)
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [companyDefaultFee, setCompanyDefaultFee] = useState(2000);
  const [form, setForm] = useState({
    name: '', phone: '', address: '', plan: 'Monthly', startDate: new Date().toISOString().split('T')[0],
    extraDiscount: 0, amountPaid: null, paymentMethod: 'Cash', monthlyFeeAmount: null
  });

  // Profile Modal State
  const [profileModalOpen, setProfileModalOpen] = useState(false);
  const [selectedMember, setSelectedMember] = useState(null);

  // Settings Modal State
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [packages, setPackages] = useState(DEFAULT_PACKAGES);

  // Collect Payment Modal State
  const [collectModalOpen, setCollectModalOpen] = useState(false);
  const [selectedMemberForCollection, setSelectedMemberForCollection] = useState(null);
  const [isCollectingMonthlyDue, setIsCollectingMonthlyDue] = useState(false);

  const filterComputedStatuses = (list, status) => {
    if (status === 'Monthly Due') return list.filter(m => calculateMonthlyDue(m) > 0);
    if (status === 'Admission Due') return list.filter(m => (m.totalDue || 0) > 0);
    return list;
  };

  const loadData = async () => {
    try {
      const serverStatus = isComputedStatus(filters.status) ? '' : filters.status;
      const [statsRes, membersRes] = await Promise.all([
        apiRequest(`/memberships/stats?startDate=${filters.startDate}&endDate=${filters.endDate}`, { token }),
        apiRequest(`/memberships?search=${filters.search}&status=${serverStatus}&plan=${filters.plan}&startDate=${filters.startDate}&endDate=${filters.endDate}`, { token })
      ]);
      setStats(statsRes);
      setMembers(filterComputedStatuses(membersRes.members, filters.status));
    } catch (err) {
      showToast(err.message);
    }
  };

  const handleCollectClick = (member, isMonthly = false) => {
    setSelectedMemberForCollection(member);
    setIsCollectingMonthlyDue(isMonthly);
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
        // Fetch company default fee (non-critical, own try/catch)
        try {
          const settingsRes = await apiRequest('/memberships/settings/company-default', { token });
          if (active) {
            setCompanyDefaultFee(settingsRes.defaultMemberFee);
            setForm(f => ({...f, monthlyFeeAmount: settingsRes.defaultMemberFee}));
          }
        } catch (e) {
          // Use defaults if settings endpoint fails
        }

        // Fetch membership settings (packages)
        try {
          const membershipRes = await apiRequest('/memberships/settings/membership', { token });
          if (active && membershipRes.settings) {
            const s = membershipRes.settings;
            if (s.packages && s.packages.length > 0) {
              setPackages(s.packages);
            }
            if (s.baseFees?.monthlyFee?.amount) {
              setCompanyDefaultFee(s.baseFees.monthlyFee.amount);
            }
          }
        } catch (e) {
          // Use defaults if settings endpoint fails
        }

        const serverStatus = isComputedStatus(filters.status) ? '' : filters.status;
        const [statsRes, membersRes] = await Promise.all([
          apiRequest(`/memberships/stats?startDate=${filters.startDate}&endDate=${filters.endDate}`, { token }),
          apiRequest(`/memberships?search=${filters.search}&status=${serverStatus}&plan=${filters.plan}&startDate=${filters.startDate}&endDate=${filters.endDate}`, { token })
        ]);
        if (active) {
          setStats(statsRes);
          setMembers(filterComputedStatuses(membersRes.members, filters.status));
        }

        // Fetch trend data for mini charts (with same date range)
        try {
          const trendRes = await apiRequest(`/memberships/stats/trend?startDate=${filters.startDate}&endDate=${filters.endDate}`, { token });
          if (active) setTrendData(trendRes);
        } catch (e) {
          // Use defaults if trend endpoint fails
        }
      } catch (err) {
        if (active) showToast(err.message);
      }
    };
    fetchIt();
    return () => { active = false; };
  }, [filters, token, showToast]);

  // Calculate pricing and end date
  const pricing = useMemo(() => {
    const pkg = packages.find(p => p.title === form.plan);
    return pkg ? { reg: 0, fee: pkg.amount, discount: 0, final: pkg.amount } : { reg: 0, fee: 0, discount: 0, final: 0 };
  }, [form.plan, packages]);
  const extraDiscount = Number(form.extraDiscount) || 0;
  const finalPayable = pricing.final - extraDiscount;
  const paidAmount = form.amountPaid !== null && form.amountPaid !== '' ? Number(form.amountPaid) : finalPayable;
  const dueAmount = Math.max(0, finalPayable - paidAmount);

  // Calculate totals from members list
  const totalsDue = members.reduce((sum, m) => sum + (m.totalDue || 0), 0);
  const totalsMonthlyDue = members.reduce((sum, m) => sum + calculateMonthlyDue(m), 0);
  const totalsCollected = members.reduce((sum, m) => {
    const pkg = packages.find(p => p.title === m.plan);
    const planPrice = pkg?.amount || 0;
    return sum + Math.max(0, planPrice - (m.totalDue || 0));
  }, 0);

  // Use server-side transaction data for income
  const incomeFromCollected = stats.incomeMonth || 0;

  // Count truly active members from visible list (endDate > now AND totalDue <= 0)
  const computedActiveCount = members.filter(m => {
    const endDate = new Date(m.endDate);
    const now = new Date();
    return m.status !== 'Inactive' && endDate > now && (m.totalDue || 0) <= 0;
  }).length;

  const endDate = useMemo(() => {
    const start = new Date(form.startDate);
    const pkg = packages.find(p => p.title === form.plan);
    const durationDays = (pkg?.duration || 1) * 30;
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
      setForm({ name: '', phone: '', address: '', plan: 'Monthly', startDate: new Date().toISOString().split('T')[0], extraDiscount: 0, amountPaid: null, paymentMethod: 'Cash', monthlyFeeAmount: null });
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
        setTimeout(() => window.print(), 500);
      }
    } catch (err) {
      showToast(err.message);
    }
  };

  return (
    <div className="grid gap-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <h2 className="text-xl font-bold">Membership</h2>
        <div className="flex gap-2">
          <button className="px-4 py-2 border rounded-lg hover:bg-gray-50 font-medium min-h-[44px]" onClick={() => setSettingsOpen(true)}>⚙️ Settings</button>
          <button className="btn-primary" onClick={() => setIsModalOpen(true)}>➕ Add New Member</button>
        </div>
      </div>

      {/* Stats Date Range Filter */}
      <div className="flex flex-col gap-2 items-start">
        <span className="text-sm font-medium text-gray-600">Stats Date Range:</span>
        <div className="flex flex-wrap items-center gap-2">
          <button onClick={() => handleDateRangeChange('daily')} className={`px-3 py-1.5 rounded-lg text-sm font-medium transition ${dateRangeType === 'daily' ? 'bg-primary text-white' : 'bg-gray-100 text-gray-700 hover:bg-gray-200'}`}>📅 Today</button>
          <button onClick={() => handleDateRangeChange('weekly')} className={`px-3 py-1.5 rounded-lg text-sm font-medium transition ${dateRangeType === 'weekly' ? 'bg-primary text-white' : 'bg-gray-100 text-gray-700 hover:bg-gray-200'}`}>📊 Weekly</button>
          <button onClick={() => handleDateRangeChange('monthly')} className={`px-3 py-1.5 rounded-lg text-sm font-medium transition ${dateRangeType === 'monthly' ? 'bg-primary text-white' : 'bg-gray-100 text-gray-700 hover:bg-gray-200'}`}>📈 Monthly</button>
          <button onClick={() => handleDateRangeChange('custom')} className={`px-3 py-1.5 rounded-lg text-sm font-medium transition ${dateRangeType === 'custom' ? 'bg-primary text-white' : 'bg-gray-100 text-gray-700 hover:bg-gray-200'}`}>📆 Custom</button>

          {dateRangeType === 'custom' && (
            <div className="flex flex-wrap items-center gap-2">
              <input
                type="date"
                className="border rounded-lg px-3 py-1.5 text-sm"
                value={customStartDate}
                onChange={(e) => {
                  const nextStartDate = e.target.value;
                  setCustomStartDate(nextStartDate);
                  handleCustomDateChange(nextStartDate, customEndDate || nextStartDate);
                }}
              />
              <span className="text-sm text-gray-500">to</span>
              <input
                type="date"
                className="border rounded-lg px-3 py-1.5 text-sm"
                value={customEndDate}
                onChange={(e) => {
                  const nextEndDate = e.target.value;
                  setCustomEndDate(nextEndDate);
                  handleCustomDateChange(customStartDate, nextEndDate);
                }}
              />
            </div>
          )}
        </div>
      </div>

      {/* Daily Analytics */}
      <div className="card p-4">
        <h3 className="text-lg font-semibold mb-4">Daily Analytic</h3>
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          
          {/* Total Member */}
          <div className="border rounded-lg p-4 bg-white">
            <div className="flex items-center justify-between mb-2">
              <p className="text-sm text-gray-500">Total Member</p>
              <button className="text-gray-400 hover:text-gray-600 text-sm">↗</button>
            </div>
            <p className="text-2xl font-bold">{members.length}</p>
            <div className="flex items-center justify-between mt-2">
              {(trendData.prevMembers ?? 0) > 0 ? (
                <span className={`text-xs font-medium ${((members.length - trendData.prevMembers) / trendData.prevMembers * 100) >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                  {((members.length - trendData.prevMembers) / trendData.prevMembers * 100) >= 0 ? '↑' : '↓'} {Math.abs(Math.round((members.length - trendData.prevMembers) / trendData.prevMembers * 100))}%
                </span>
              ) : <span className="text-xs text-gray-400">-</span>}
              <MiniBarChart data={(trendData.dailyTimeline ?? []).map(d => ({ value: d.value > 0 ? 1 : 0 }))} color="#22C55E" />
            </div>
          </div>

          {/* Monthly Due */}
          <div className="border rounded-lg p-4 bg-white">
            <p className="text-sm text-gray-500">Monthly Due</p>
            <p className="text-2xl font-bold">{totalsMonthlyDue.toLocaleString()} TK</p>
            <div className="flex items-center justify-between mt-2">
              {(trendData.prevIncome ?? 0) > 0 ? (
                <span className={`text-xs font-medium ${((totalsMonthlyDue - trendData.prevIncome) / trendData.prevIncome * 100) >= 0 ? 'text-red-600' : 'text-green-600'}`}>
                  {((totalsMonthlyDue - trendData.prevIncome) / trendData.prevIncome * 100) >= 0 ? '↑' : '↓'} {Math.abs(Math.round((totalsMonthlyDue - trendData.prevIncome) / trendData.prevIncome * 100))}%
                </span>
              ) : <span className="text-xs text-gray-400">-</span>}
              <MiniBarChart data={(trendData.dailyTimeline ?? [])} color="#EF4444" />
            </div>
          </div>

          {/* Admission Due */}
          <div className="border rounded-lg p-4 bg-white">
            <p className="text-sm text-gray-500">Admission Due</p>
            <p className="text-2xl font-bold">{totalsDue.toLocaleString()} TK</p>
            <div className="flex items-center justify-between mt-2">
              <span className="text-xs text-gray-500">{members.filter(m => (m.totalDue || 0) > 0).length}/pcs</span>
              <MiniBarChart data={(trendData.dailyTimeline ?? []).map((d, i) => ({ value: Math.max(0, 10 - i) }))} color="#F59E0B" />
            </div>
          </div>

          {/* Period Income (highlighted) */}
          <div className="border-2 border-primary rounded-lg p-4 bg-primary/5">
            <p className="text-sm text-gray-500">
              {dateRangeType === 'daily' ? 'Today' : dateRangeType === 'weekly' ? 'Weekly' : dateRangeType === 'monthly' ? 'Monthly' : 'Period'} Income
            </p>
            <p className="text-2xl font-bold">{(trendData.currentIncome ?? 0).toLocaleString()} TK</p>
            <div className="flex items-center justify-between mt-2">
              <span className="text-xs text-gray-500">{trendData.currentCount ?? 0}/pcs</span>
              <MiniBarChart data={(trendData.dailyTimeline ?? [])} color="#3B82F6" />
            </div>
          </div>

        </div>
      </div>

      {/* Members List */}
      <div className="card p-4">
        <h3 className="text-lg font-semibold mb-4">Members List</h3>
        <div className="flex flex-col gap-3 mb-4">
          {/* Search and Filter Row */}
          <div className="flex flex-col md:flex-row gap-3">
            <input className="border rounded-lg px-3 py-2 flex-1" placeholder="Search name or phone..." value={filters.search} onChange={(e) => setFilters({...filters, search: e.target.value})} />
            <select className="border rounded-lg px-3 py-2" value={filters.plan} onChange={(e) => setFilters({...filters, plan: e.target.value})}>
              <option value="">All Plans</option>
              {packages.map(p => <option key={p.title} value={p.title}>{p.title}</option>)}
            </select>
            <select className="border rounded-lg px-3 py-2" value={filters.status} onChange={(e) => setFilters({...filters, status: e.target.value})}>
              <option value="">All Status</option>
              <option value="Active">Active</option>
              <option value="Expired">Expired</option>
              <option value="Inactive">Inactive</option>
              <option value="Monthly Due">Monthly Due</option>
              <option value="Admission Due">Admission Due</option>
            </select>
          </div>
        </div>

        {/* Mobile card view */}
        <div className="md:hidden space-y-3">
          {members.length === 0 ? (
            <div className="text-center py-6 text-gray-500">No members found.</div>
          ) : (
            members.map((m) => (
              <div key={m._id} className="bg-white rounded-lg border border-gray-200 p-4 space-y-2">
                <div className="flex items-start justify-between">
                  <div>
                    <div className="font-semibold text-gray-900">{m.name}</div>
                    <div className="text-xs text-gray-500">{m.phone}</div>
                  </div>
                  <div className="flex flex-wrap gap-1">
                    {getStatusBadges(m).map((badge, i) => (
                      <span key={i} className={`px-2 py-1 rounded-full text-xs font-semibold ${badge.color}`}>{badge.label}</span>
                    ))}
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-2 text-sm">
                  <div><span className="text-xs text-gray-500">Plan</span><p className="font-medium">{m.plan}</p></div>
                  <div><span className="text-xs text-gray-500">Due</span>
                    <p className="font-semibold">
                      {m.totalDue > 0 ? (
                        <button onClick={() => handleCollectClick(m)} className="text-primary hover:underline">🔴 ৳{m.totalDue.toLocaleString()}</button>
                      ) : '-'}
                    </p>
                  </div>
                  <div><span className="text-xs text-gray-500">Collected</span>
                    <p className="font-semibold text-green-700">
                      {(() => { const pkg = packages.find(p => p.title === m.plan); return '৳' + ((pkg?.amount || 0) - m.totalDue || 0).toLocaleString(); })()}
                    </p>
                  </div>
                  <div><span className="text-xs text-gray-500">Monthly Due</span>
                    <p className="font-semibold text-orange-700">
                      {(() => { const unpaid = (m.dueHistory || []).filter(e => e.type === 'Due' && e.reason?.startsWith('Monthly Fee') && !e.paid); if (unpaid.length === 0) return '-'; return `৳ ${calculateMonthlyDue(m).toLocaleString()} (${unpaid.length} mo)`; })()}
                    </p>
                  </div>
                </div>
                <div className="flex justify-end pt-1 border-t">
                  <ActionDropdown
                    actions={[
                      ...(m.totalDue > 0 ? [{ label: '💰 Collect Admission Due', onClick: () => handleCollectClick(m, false) }] : []),
                      ...(() => { const unpaid = (m.dueHistory || []).filter(e => e.type === 'Due' && e.reason?.startsWith('Monthly Fee') && !e.paid); if (unpaid.length === 0) return []; const oldest = unpaid[0]; const monthDate = new Date(oldest.date || new Date()); const monthName = monthDate.toLocaleString('en-US', { month: 'short', year: 'numeric' }); return [{ label: `📅 Collect ${monthName}`, onClick: () => handleCollectClick(m, true) }]; })(),
                      { label: 'View Profile', onClick: async () => { const res = await apiRequest(`/memberships/${m._id}`, { token }); setSelectedMember(res.member); setProfileModalOpen(true); } },
                      { label: m.status === 'Inactive' ? 'Reactivate' : 'Mark Inactive', onClick: async () => { const newStatus = m.status === 'Inactive' ? 'Active' : 'Inactive'; await apiRequest(`/memberships/${m._id}/status`, { method: 'POST', body: { status: newStatus }, token }); showToast(`Member marked as ${newStatus}`); loadData(); } },
                    ]}
                  />
                </div>
              </div>
            ))
          )}
          {members.length > 0 && (
            <div className="bg-gray-50 rounded-lg p-3 text-sm font-semibold">
              <div className="flex justify-between"><span>TOTAL:</span></div>
              <div className="flex justify-between"><span className="text-red-600">Due: ৳{totalsDue.toLocaleString()}</span></div>
              <div className="flex justify-between"><span className="text-green-700">Collected: ৳{totalsCollected.toLocaleString()}</span></div>
              <div className="flex justify-between"><span className="text-yellow-600">Monthly Due: ৳{totalsMonthlyDue.toLocaleString()}</span></div>
            </div>
          )}
        </div>

        {/* Desktop table view */}
        <div className="hidden md:block overflow-x-auto text-sm">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="border-b bg-gray-50">
                <th className="p-3">Name</th>
                <th className="p-3">Phone</th>
                <th className="p-3">Plan</th>
                <th className="p-3">Status</th>
                <th className="p-3">Due Amount</th>
                <th className="p-3">Collected Amount</th>
                <th className="p-3">Monthly Due (When Expired)</th>
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
                    <div className="flex flex-wrap gap-1">
                      {getStatusBadges(m).map((badge, i) => (
                        <span key={i} className={`px-2 py-1 rounded-full text-xs font-semibold ${badge.color}`}>
                          {badge.label}
                        </span>
                      ))}
                    </div>
                  </td>
                  <td className="p-3 font-medium">
                    {m.totalDue > 0 ? (
                      <button
                        onClick={() => handleCollectClick(m)}
                        title="Click to collect payment"
                        className="text-primary hover:text-primary hover:underline cursor-pointer font-semibold"
                      >
                        🔴 ৳{m.totalDue.toLocaleString()}
                      </button>
                    ) : (
                      '-'
                    )}
                  </td>
                  <td className="p-3 font-medium text-green-700">
                    {(() => {
                      const pkg = packages.find(p => p.title === m.plan);
                      return '৳' + ((pkg?.amount || 0) - m.totalDue || 0).toLocaleString();
                    })()}
                  </td>
                  <td className="p-3 font-medium text-orange-700">
                    {(() => {
                      const unpaid = (m.dueHistory || []).filter(e => e.type === 'Due' && e.reason?.startsWith('Monthly Fee') && !e.paid);
                      if (unpaid.length === 0) return '-';
                      return (
                        <span title={unpaid.map(e => e.reason || e.month).join(', ')}>
                          ৳ {calculateMonthlyDue(m).toLocaleString()} ({unpaid.length} mo)
                        </span>
                      );
                    })()}
                  </td>
                  <td className="p-3">
                    <ActionDropdown
                      actions={[
                        ...(m.totalDue > 0 ? [{
                          label: '💰 Collect Admission Due',
                          onClick: () => handleCollectClick(m, false),
                        }] : []),
                        ...(() => {
                          const unpaid = (m.dueHistory || []).filter(e => e.type === 'Due' && e.reason?.startsWith('Monthly Fee') && !e.paid);
                          if (unpaid.length === 0) return [];
                          const oldest = unpaid[0];
                          const monthDate = new Date(oldest.date || new Date());
                          const monthName = monthDate.toLocaleString('en-US', { month: 'short', year: 'numeric' });
                          return [{
                            label: `📅 Collect ${monthName}`,
                            onClick: () => handleCollectClick(m, true),
                          }];
                        })(),
                        {
                          label: 'View Profile',
                          onClick: async () => {
                            const res = await apiRequest(`/memberships/${m._id}`, { token });
                            setSelectedMember(res.member);
                            setProfileModalOpen(true);
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
                <tr><td colSpan="8" className="p-4 text-center text-gray-500">No members found.</td></tr>
              )}
              {members.length > 0 && (
                <tr className="border-t-2 border-b bg-gray-100 font-bold text-gray-800">
                  <td colSpan="4" className="p-3 text-right">TOTAL:</td>
                  <td className="p-3 text-red-600">৳{totalsDue.toLocaleString()}</td>
                  <td className="p-3 text-green-700">৳{totalsCollected.toLocaleString()}</td>
                  <td className="p-3 text-yellow-600">৳{totalsMonthlyDue.toLocaleString()}</td>
                  <td></td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Add Member Modal */}
      {isModalOpen && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center p-4 z-50 overflow-y-auto">
          <div className="bg-white rounded-xl max-w-2xl w-full p-4 sm:p-6 shadow-xl my-8">
            <div className="flex justify-between items-center mb-4 sm:mb-6 border-b pb-4">
              <h2 className="text-lg sm:text-xl font-bold">Add New Member</h2>
              <button className="text-gray-500 hover:text-black text-2xl font-bold min-h-[44px] min-w-[44px] flex items-center justify-center" onClick={() => setIsModalOpen(false)}>&times;</button>
            </div>

            <div className="grid md:grid-cols-2 gap-6 sm:gap-8">
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
                      {packages.map(p => <option key={p.title} value={p.title}>{p.title}</option>)}
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

                <div className="grid grid-cols-1 gap-3">
                  <div>
                    <label className="block text-sm mb-1 text-gray-600">
                      Monthly Fee (when membership expires)
                      <span className="text-xs text-gray-500 font-normal"> - ৳{companyDefaultFee} default</span>
                    </label>
                    <input type="number" className="w-full border rounded-lg px-3 py-2" value={form.monthlyFeeAmount || companyDefaultFee} onChange={(e) => setForm({...form, monthlyFeeAmount: Number(e.target.value) || companyDefaultFee})} min="1" />
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-3 text-sm">
                  <div className="bg-primary/5 text-primary border border-primary/10 rounded-lg p-3">
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

            <div className="mt-6 sm:mt-8 flex flex-col sm:flex-row justify-end gap-3 border-t pt-4">
              <button className="px-4 py-2 border rounded-lg hover:bg-gray-50 no-print min-h-[44px]" onClick={() => setIsModalOpen(false)}>Cancel</button>
              <button className="px-5 py-2 bg-secondary text-white rounded-lg font-semibold hover:opacity-90 no-print min-h-[44px]" onClick={() => submitMember(false)}>Save Member</button>
              <button className="px-5 py-2 bg-primary text-white rounded-lg font-semibold hover:opacity-90 no-print min-h-[44px]" onClick={() => submitMember(true)}>Save & Print Receipt</button>
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
        monthlyDue={selectedMemberForCollection ? calculateMonthlyDue(selectedMemberForCollection) : 0}
        isMonthlyDue={isCollectingMonthlyDue}
        memberDueHistory={selectedMemberForCollection?.dueHistory || []}
        onClose={() => {
          setCollectModalOpen(false);
          setSelectedMemberForCollection(null);
          setIsCollectingMonthlyDue(false);
        }}
        onSuccess={handleCollectPaymentSuccess}
        showToast={showToast}
        token={token}
      />

      <MembershipSettingsModal
        isOpen={settingsOpen}
        token={token}
        onClose={() => setSettingsOpen(false)}
        onSuccess={() => {
          setSettingsOpen(false);
          // Reload packages from server
          apiRequest('/memberships/settings/membership', { token }).then(res => {
            if (res.settings?.packages) setPackages(res.settings.packages);
          }).catch(() => {});
          loadData();
        }}
        showToast={showToast}
      />
    </div>
  );
}