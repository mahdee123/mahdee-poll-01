import React, { useState, useEffect, useMemo } from 'react';
import { apiRequest } from '../api.js';
import StudentProfileModal from './StudentProfileModal.jsx';
import TrainingPaymentModal from './TrainingPaymentModal.jsx';
import ActionDropdown from './ActionDropdown.jsx';

const BATCH_PRESETS = {
  Regular: {
    days: 30,
    pricing: { kids: 12000, adults: 9000 },
    totalClasses: { kids: 16, adults: 12 },
  },
  Weekend: {
    days: 40,
    pricing: { kids: 13000, adults: 11000 },
    totalClasses: { kids: 16, adults: 12 },
  },
};

const CLASS_SLOTS = {
  1: { label: 'Class 01', time: '08:00 AM - 09:00 AM', period: 'Morning' },
  2: { label: 'Class 02', time: '09:00 AM - 10:00 AM', period: 'Morning' },
  3: { label: 'Class 03', time: '05:00 PM - 06:00 PM', period: 'Evening' },
  4: { label: 'Class 04', time: '06:00 PM - 07:00 PM', period: 'Evening' },
};

const SLOT_LIMIT = 15;
const PAYMENT_METHODS = ['Cash', 'Bank', 'bKash'];
const AGE_GROUPS = [
  { value: '4-8', label: '4-8 years (16 classes)' },
  { value: '9+', label: '9+ years (12 classes)' },
];
const BATCH_TYPES = [
  { value: 'Regular', label: 'Regular (30 days)' },
  { value: 'Weekend', label: 'Weekend (40 days)' },
];

const formatDate = (d) => {
  if (!d) return '';
  return new Date(d).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' });
};

const StatCard = ({ title, value, hint }) => (
  <div className="card p-4 flex flex-col gap-2">
    <span className="text-sm text-gray-500">{title}</span>
    <span className="text-2xl font-semibold text-secondary">{value}</span>
    {hint ? <span className="text-xs text-gray-400">{hint}</span> : null}
  </div>
);

export default function TrainingPage({ token, showToast, user, setLastReceipt }) {
  // ============ SUMMARY STATS ============
  const [stats, setStats] = useState({ newToday: 0, newMonth: 0, activeStudents: 0, revenueMonth: 0, trainingIncome: 0, trainingDue: 0 });

  // ============ STUDENT LIST & FILTERS ============
  const [students, setStudents] = useState([]);
  const [trainingSummary, setTrainingSummary] = useState([]);
  const [remainingList, setRemainingList] = useState([]);

  const [activeTab, setActiveTab] = useState('active'); // 'active' or 'completed'
  const [filters, setFilters] = useState({
    search: '',
    batch: '', // 'Regular', 'Weekend', or ''
    startDateMin: '',
    startDateMax: '',
    status: '', // 'active', 'expired', or ''
  });

  // ============ FORM STATE ============
  const [viewMode, setViewMode] = useState('list'); // 'list' or 'form'
  const [form, setForm] = useState({
    name: '',
    phone: '',
    ageGroup: '4-8',
    batchType: 'Regular',
    timeSlot: 'Morning',
    classSlot: 1,
    startDate: new Date().toISOString().split('T')[0],
    discount: 0,
    amountPaid: null,
    paymentMethod: 'Cash',
  });

  // ============ PROFILE MODAL STATE ============
  const [profileModalOpen, setProfileModalOpen] = useState(false);
  const [selectedStudent, setSelectedStudent] = useState(null);

  // ============ PAYMENT MODAL STATE ============
  const [paymentModalOpen, setPaymentModalOpen] = useState(false);
  const [selectedPaymentStudent, setSelectedPaymentStudent] = useState(null);

  // ============ DERIVED CALCULATIONS ============
  const deriveTraining = useMemo(() => {
    const preset = BATCH_PRESETS[form.batchType];
    const key = form.ageGroup === '4-8' ? 'kids' : 'adults';
    const totalClasses = preset.totalClasses[key];
    const price = preset.pricing[key];
    const startDate = new Date(form.startDate);
    const endDate = new Date(startDate.setDate(startDate.getDate() + preset.days));
    const endDateStr = endDate.toISOString().split('T')[0];
    return { totalClasses, price, durationDays: preset.days, endDate: endDateStr };
  }, [form.ageGroup, form.batchType, form.startDate]);

  const finalAmount = deriveTraining.price - Number(form.discount || 0);
  const paidAmount = form.amountPaid !== null && form.amountPaid !== '' ? Number(form.amountPaid) : finalAmount;
  const dueAmount = Math.max(0, finalAmount - paidAmount);

  // ============ DATA LOADING ============
  const loadTrainingData = async () => {
    try {
      const [dashRes, studentsRes] = await Promise.all([
        apiRequest('/training/dashboard', { token }),
        apiRequest('/training/students', { token }),
      ]);

      setTrainingSummary(dashRes.summary || []);
      setRemainingList(dashRes.remainingByStudent || []);
      setStudents(studentsRes.students || []);

      // Calculate stats
      const today = new Date();
      today.setHours(0, 0, 0, 0);
      const monthStart = new Date(today.getFullYear(), today.getMonth(), 1);

      const newToday = (studentsRes.students || []).filter((s) => {
        const created = new Date(s.createdAt);
        created.setHours(0, 0, 0, 0);
        return created.getTime() === today.getTime();
      }).length;

      const newMonth = (studentsRes.students || []).filter((s) => {
        const created = new Date(s.createdAt);
        return created >= monthStart;
      }).length;

      const activeStudents = (studentsRes.students || []).filter((s) => s.status === 'active').length;

      // Revenue this month (would need transaction data)
      // For now, calculate from students' price field
      const revenueMonth = (studentsRes.students || [])
        .filter((s) => {
          const created = new Date(s.createdAt);
          return created >= monthStart && s.status === 'active';
        })
        .reduce((sum, s) => sum + (s.price || 0), 0);

      setStats({ newToday, newMonth, activeStudents, revenueMonth, trainingIncome: dashRes.trainingIncome || 0, trainingDue: dashRes.trainingDue || 0 });
    } catch (err) {
      showToast(err.message);
    }
  };

  useEffect(() => {
    loadTrainingData();
  }, [token]);

  // ============ FILTERING LOGIC ============
  const filteredStudents = useMemo(() => {
    let list = students;

    // Tab filter
    if (activeTab === 'active') {
      list = list.filter((s) => s.status === 'active');
    } else {
      list = list.filter((s) => s.status === 'expired');
    }

    // Search
    if (filters.search) {
      const q = filters.search.toLowerCase();
      list = list.filter(
        (s) =>
          s.name.toLowerCase().includes(q) ||
          s.phone.includes(filters.search)
      );
    }

    // Batch
    if (filters.batch) {
      list = list.filter((s) => s.batchType === filters.batch);
    }

    // Date range
    if (filters.startDateMin) {
      list = list.filter((s) => new Date(s.startDate) >= new Date(filters.startDateMin));
    }
    if (filters.startDateMax) {
      list = list.filter((s) => new Date(s.startDate) <= new Date(filters.startDateMax));
    }

    return list;
  }, [students, activeTab, filters]);

  // ============ FORM SUBMISSION ============
  const submitStudent = async () => {
    try {
      if (!form.name || !form.phone) {
        showToast('Name and phone are required');
        return null;
      }

      const body = {
        name: form.name,
        phone: form.phone,
        ageGroup: form.ageGroup,
        batchType: form.batchType,
        timeSlot: form.timeSlot,
        classSlot: Number(form.classSlot),
        startDate: form.startDate,
        discount: Number(form.discount || 0),
        amountPaid: paidAmount,
        paymentMethod: form.paymentMethod,
      };

      const res = await apiRequest('/training/students', { method: 'POST', body, token });

      showToast('Student enrolled successfully');
      setForm({
        name: '',
        phone: '',
        ageGroup: '4-8',
        batchType: 'Regular',
        timeSlot: 'Morning',
        classSlot: 1,
        startDate: new Date().toISOString().split('T')[0],
        discount: 0,
        amountPaid: null,
        paymentMethod: 'Cash',
      });
      setViewMode('list');
      loadTrainingData();
      return res;
    } catch (err) {
      showToast(err.message);
      return null;
    }
  };

  const submitAndPrint = async () => {
    const res = await submitStudent();
    if (res && res.transaction && setLastReceipt) {
      const receiptDetails = {
        package: res.transaction.package,
        batch: res.transaction.batch,
        duration: res.transaction.duration,
      };
      setLastReceipt(res.transaction, receiptDetails);
      setTimeout(() => {
        window.print();
      }, 500);
    }
  };

  // ============ CLASS SLOT COLOR ============
  const getSlotColor = (totalStudents) => {
    if (totalStudents >= SLOT_LIMIT) return 'bg-red-100 border-red-300';
    if (totalStudents >= 10) return 'bg-yellow-100 border-yellow-300';
    return 'bg-green-100 border-green-300';
  };

  const getSlotTextColor = (totalStudents) => {
    if (totalStudents >= SLOT_LIMIT) return 'text-red-700';
    if (totalStudents >= 10) return 'text-yellow-700';
    return 'text-green-700';
  };

  const getProgressBarColor = (totalStudents) => {
    if (totalStudents >= SLOT_LIMIT) return 'bg-red-500';
    if (totalStudents >= 10) return 'bg-yellow-500';
    return 'bg-green-500';
  };

  // ============ RENDER ============

  if (user.role !== 'admin') {
    // Manager: Read-only dashboard
    return (
      <div className="grid gap-6">
        {/* Summary Cards */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-6 gap-4">
          <StatCard title="New Enrollments Today" value={stats.newToday} />
          <StatCard title="Enrollments This Month" value={stats.newMonth} />
          <StatCard title="Active Students" value={stats.activeStudents} />
          <StatCard title="Training Revenue (This Month)" value={`৳ ${stats.revenueMonth.toLocaleString()}`} />
          <StatCard title="🟢 Training Income (This Month)" value={`৳ ${stats.trainingIncome.toLocaleString()}`} hint="Collected from students" />
          <StatCard title="🔴 Pending Due (Training)" value={`৳ ${stats.trainingDue.toLocaleString()}`} hint="Outstanding payments" />
        </div>

        {/* Class Slots */}
        <div className="card p-4">
          <h3 className="text-lg font-semibold mb-3">Class Slots</h3>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            {trainingSummary.map((slot) => {
              const fillPct = (slot.totalStudents / SLOT_LIMIT) * 100;
              return (
                <div key={slot.classSlot} className={`border-2 rounded-lg p-3 space-y-2 ${getSlotColor(slot.totalStudents)}`}>
                  <div className="flex items-center justify-between">
                    <div>
                      <p className={`font-semibold ${getSlotTextColor(slot.totalStudents)}`}>{slot.label}</p>
                      <p className="text-xs text-gray-600">{slot.time}</p>
                    </div>
                    <span className={`text-sm font-bold ${getSlotTextColor(slot.totalStudents)}`}>
                      {slot.totalStudents} / {SLOT_LIMIT}
                    </span>
                  </div>
                  <div className="w-full bg-gray-300 rounded-full h-2">
                    <div
                      className={`h-2 rounded-full transition-all ${getProgressBarColor(slot.totalStudents)}`}
                      style={{ width: `${Math.min(fillPct, 100)}%` }}
                    />
                  </div>
                  <p className="text-xs text-gray-600">
                    Attended: {slot.attended} · Missed: {slot.missed} · Makeup: {slot.makeup}
                  </p>
                </div>
              );
            })}
          </div>
        </div>

        {/* Remaining Classes */}
        <div className="card p-4">
          <h3 className="text-lg font-semibold mb-3">Remaining Classes</h3>
          <div className="max-h-96 overflow-auto divide-y text-sm">
            {remainingList.length === 0 ? (
              <p className="text-gray-500 py-4">No students found</p>
            ) : (
              remainingList.map((s) => {
                const daysLeft = Math.ceil((new Date(s.endDate) - new Date()) / (1000 * 60 * 60 * 24));
                const isExpiringSoon = daysLeft < 7 && daysLeft >= 0;
                const isExpired = daysLeft < 0;
                const isLowClasses = s.remainingClasses < 3;

                return (
                  <div key={s.id} className="py-3 flex items-center justify-between">
                    <div className="flex-1">
                      <p className="font-semibold">{s.name}</p>
                      <p className="text-xs text-gray-500">Slot {s.classSlot} · {formatDate(s.endDate)}</p>
                      <div className="flex gap-2 mt-2">
                        {isLowClasses && (
                          <span className="inline-block bg-orange-200 text-orange-800 px-2 py-1 rounded text-xs font-semibold">
                            ⚠️ Less than 3 classes
                          </span>
                        )}
                        {isExpiringSoon && !isExpired && (
                          <span className="inline-block bg-yellow-200 text-yellow-800 px-2 py-1 rounded text-xs font-semibold">
                            ⚠️ Expiring soon
                          </span>
                        )}
                        {isExpired && (
                          <span className="inline-block bg-red-200 text-red-800 px-2 py-1 rounded text-xs font-semibold">
                            🔴 Expired
                          </span>
                        )}
                      </div>
                    </div>
                    <div className="text-right">
                      <span className="font-semibold text-lg">{s.remainingClasses}</span>
                      <p className="text-xs text-gray-500">Classes</p>
                    </div>
                  </div>
                );
              })
            )}
          </div>
        </div>
      </div>
    );
  }

  // ============ ADMIN VIEW ============

  if (viewMode === 'form') {
    // STUDENT ENROLLMENT FORM PAGE
    return (
      <div className="grid gap-6">
        <div className="flex items-center gap-3">
          <button
            onClick={() => setViewMode('list')}
            className="px-4 py-2 text-sm rounded-lg bg-gray-200 hover:bg-gray-300 text-gray-800 font-medium"
          >
            ← Back to List
          </button>
          <h2 className="text-2xl font-bold flex-1">Add New Student</h2>
        </div>

        <div className="grid lg:grid-cols-2 gap-6">
          {/* FORM SECTION */}
          <div className="card p-6 space-y-6">
            {/* Basic Info Section */}
            <div className="space-y-3">
              <h3 className="text-lg font-semibold">👤 Basic Info</h3>
              <input
                className="border rounded-lg px-3 py-2 w-full"
                placeholder="Full Name"
                value={form.name}
                onChange={(e) => setForm({ ...form, name: e.target.value })}
              />
              <input
                className="border rounded-lg px-3 py-2 w-full"
                placeholder="Phone Number"
                value={form.phone}
                onChange={(e) => setForm({ ...form, phone: e.target.value })}
              />
            </div>

            {/* Training Details Section */}
            <div className="space-y-3">
              <h3 className="text-lg font-semibold">🏊 Training Details</h3>
              <select
                className="border rounded-lg px-3 py-2 w-full"
                value={form.ageGroup}
                onChange={(e) => setForm({ ...form, ageGroup: e.target.value })}
              >
                {AGE_GROUPS.map((a) => (
                  <option key={a.value} value={a.value}>
                    {a.label}
                  </option>
                ))}
              </select>

              <select
                className="border rounded-lg px-3 py-2 w-full"
                value={form.batchType}
                onChange={(e) => setForm({ ...form, batchType: e.target.value })}
              >
                {BATCH_TYPES.map((b) => (
                  <option key={b.value} value={b.value}>
                    {b.label}
                  </option>
                ))}
              </select>

              <div className="grid sm:grid-cols-2 gap-3">
                <select
                  className="border rounded-lg px-3 py-2"
                  value={form.timeSlot}
                  onChange={(e) => setForm({ ...form, timeSlot: e.target.value })}
                >
                  <option>Morning</option>
                  <option>Evening</option>
                </select>
                <select
                  className="border rounded-lg px-3 py-2"
                  value={form.classSlot}
                  onChange={(e) => setForm({ ...form, classSlot: e.target.value })}
                >
                  {[1, 2, 3, 4].map((slot) => (
                    <option key={slot} value={slot}>
                      {CLASS_SLOTS[slot].label} - {CLASS_SLOTS[slot].time}
                    </option>
                  ))}
                </select>
              </div>

              <div className="grid sm:grid-cols-2 gap-3">
                <div>
                  <label className="text-xs text-gray-600 block mb-1">Start Date</label>
                  <input
                    type="date"
                    className="border rounded-lg px-3 py-2 w-full"
                    value={form.startDate}
                    onChange={(e) => setForm({ ...form, startDate: e.target.value })}
                  />
                </div>
                <div>
                  <label className="text-xs text-gray-600 block mb-1">End Date (Auto)</label>
                  <input
                    type="date"
                    className="border rounded-lg px-3 py-2 w-full bg-gray-100"
                    value={deriveTraining.endDate}
                    readOnly
                  />
                </div>
              </div>
            </div>

            {/* Payment Section */}
            <div className="space-y-3 border-t pt-4">
              <h3 className="text-lg font-semibold">💰 Payment</h3>
              <div className="grid sm:grid-cols-3 gap-3">
                <div className="card p-3">
                  <p className="text-xs text-gray-600">Price</p>
                  <p className="text-xl font-bold text-secondary">৳ {deriveTraining.price.toLocaleString()}</p>
                </div>
                <div className="card p-3">
                  <p className="text-xs text-gray-600">Discount</p>
                  <input
                    type="number"
                    className="w-full border rounded px-2 py-1 mt-1"
                    placeholder="0"
                    value={form.discount}
                    onChange={(e) => setForm({ ...form, discount: e.target.value })}
                  />
                </div>
                <div className="card p-3 bg-green-50">
                  <p className="text-xs text-gray-600">Final Amount</p>
                  <p className="text-xl font-bold text-green-700">৳ {finalAmount.toLocaleString()}</p>
                </div>
              </div>

              <div className="grid sm:grid-cols-2 gap-3">
                <div>
                  <label className="text-xs text-gray-600 block mb-2">Amount Paid (Optional)</label>
                  <input
                    type="number"
                    className="border rounded-lg px-3 py-2 w-full"
                    placeholder={finalAmount.toLocaleString()}
                    value={form.amountPaid ?? ''}
                    onChange={(e) => setForm({ ...form, amountPaid: e.target.value === '' ? null : e.target.value })}
                  />
                </div>
                <div className={`card p-3 ${dueAmount > 0 ? 'bg-orange-50 border border-orange-200' : 'bg-green-50 border border-green-200'}`}>
                  <p className="text-xs text-gray-600">Remaining Due</p>
                  <p className={`text-xl font-bold ${dueAmount > 0 ? 'text-orange-700' : 'text-green-700'}`}>৳ {dueAmount.toLocaleString()}</p>
                </div>
              </div>

              <div>
                <label className="text-xs text-gray-600 block mb-2">Payment Method</label>
                <select
                  className="border rounded-lg px-3 py-2 w-full"
                  value={form.paymentMethod}
                  onChange={(e) => setForm({ ...form, paymentMethod: e.target.value })}
                >
                  {PAYMENT_METHODS.map((p) => (
                    <option key={p}>{p}</option>
                  ))}
                </select>
              </div>
            </div>
          </div>

          {/* SUMMARY CARD */}
          <div className="space-y-3">
            <div className="card p-4 space-y-2 bg-blue-50">
              <h3 className="text-lg font-semibold">📋 Summary</h3>
              <div className="text-sm space-y-2">
                <div className="flex justify-between">
                  <span className="text-gray-600">Name:</span>
                  <span className="font-semibold">{form.name || '—'}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-600">Phone:</span>
                  <span className="font-semibold">{form.phone || '—'}</span>
                </div>
                <hr className="my-2" />
                <div className="flex justify-between">
                  <span className="text-gray-600">Age Group:</span>
                  <span className="font-semibold">
                    {AGE_GROUPS.find((a) => a.value === form.ageGroup)?.label || '—'}
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-600">Batch:</span>
                  <span className="font-semibold">{form.batchType}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-600">Class Slot:</span>
                  <span className="font-semibold">{CLASS_SLOTS[form.classSlot].label}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-600">Start Date:</span>
                  <span className="font-semibold">{formatDate(form.startDate)}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-600">End Date:</span>
                  <span className="font-semibold">{formatDate(deriveTraining.endDate)}</span>
                </div>
                <hr className="my-2" />
                <div className="flex justify-between">
                  <span className="text-gray-600">Total Classes:</span>
                  <span className="font-semibold text-lg">{deriveTraining.totalClasses}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-600">Duration:</span>
                  <span className="font-semibold">{deriveTraining.durationDays} days</span>
                </div>
                <hr className="my-2" />
                <div className="flex justify-between text-lg">
                  <span className="text-gray-600 font-semibold">Price:</span>
                  <span className="font-bold text-secondary">৳ {deriveTraining.price.toLocaleString()}</span>
                </div>
                <div className="flex justify-between text-lg">
                  <span className="text-gray-600 font-semibold">Discount:</span>
                  <span className="font-bold text-orange-600">-৳ {Number(form.discount || 0).toLocaleString()}</span>
                </div>
                <div className="flex justify-between text-xl bg-green-100 p-2 rounded font-semibold">
                  <span>Final Amount:</span>
                  <span className="text-green-700">৳ {finalAmount.toLocaleString()}</span>
                </div>
                <div className="flex justify-between text-lg">
                  <span className="text-gray-600 font-semibold">Amount Paid:</span>
                  <span className="font-bold text-blue-600">৳ {paidAmount.toLocaleString()}</span>
                </div>
                <div className={`flex justify-between text-xl p-2 rounded font-semibold ${dueAmount > 0 ? 'bg-orange-100 text-orange-700' : 'bg-green-100 text-green-700'}`}>
                  <span>Remaining Due:</span>
                  <span>৳ {dueAmount.toLocaleString()}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-600">Payment Method:</span>
                  <span className="font-semibold">{form.paymentMethod}</span>
                </div>
              </div>
            </div>

            <div className="card p-4 bg-amber-50 text-sm text-amber-800">
              <p className="font-semibold mb-2">ℹ️ Important Notes:</p>
              <ul className="space-y-1 list-disc list-inside">
                <li>Max 2 makeup classes allowed per student</li>
                <li>Class slot capacity: {SLOT_LIMIT} students</li>
                <li>Transaction will be auto-created on save</li>
                <li>Receipt will auto-print if "Save & Print" is selected</li>
              </ul>
            </div>

            <div className="flex flex-col gap-2">
              <button
                onClick={submitStudent}
                className="btn-primary w-full py-3 text-lg font-semibold"
              >
                🔵 Save Student
              </button>
              <button
                onClick={submitAndPrint}
                className="btn-primary bg-green-600 hover:bg-green-700 w-full py-3 text-lg font-semibold no-print"
              >
                🖨 Save & Print Receipt
              </button>
            </div>
          </div>
        </div>
      </div>
    );
  }

  // ============ STUDENT LIST VIEW ============
  return (
    <div className="grid gap-6">
      {/* Summary Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-6 gap-4">
        <StatCard title="New Enrollments Today" value={stats.newToday} />
        <StatCard title="Enrollments This Month" value={stats.newMonth} />
        <StatCard title="Active Students" value={stats.activeStudents} />
        <StatCard title="Training Revenue (This Month)" value={`৳ ${stats.revenueMonth.toLocaleString()}`} />
        <StatCard title="🟢 Training Income (This Month)" value={`৳ ${stats.trainingIncome.toLocaleString()}`} hint="Collected from students" />
        <StatCard title="🔴 Pending Due (Training)" value={`৳ ${stats.trainingDue.toLocaleString()}`} hint="Outstanding payments" />
      </div>

      {/* Student List Section */}
      <div className="card p-4 space-y-4">
        <div className="flex items-center justify-between">
          <div className="flex gap-2">
            <button
              onClick={() => setActiveTab('active')}
              className={`px-4 py-2 rounded-lg font-medium transition ${
                activeTab === 'active'
                  ? 'bg-green-100 text-green-800'
                  : 'bg-gray-100 hover:bg-gray-200 text-gray-700'
              }`}
            >
              🟢 Active Students
            </button>
            <button
              onClick={() => setActiveTab('completed')}
              className={`px-4 py-2 rounded-lg font-medium transition ${
                activeTab === 'completed'
                  ? 'bg-gray-700 text-white'
                  : 'bg-gray-100 hover:bg-gray-200 text-gray-700'
              }`}
            >
              ⚫ Completed / Expired
            </button>
          </div>
          <button
            onClick={() => setViewMode('form')}
            className="btn-primary"
          >
            ➕ Add New Student
          </button>
        </div>

        {/* Filters */}
        <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-3 p-3 bg-gray-50 rounded-lg">
          <div>
            <label className="text-xs text-gray-600 block mb-1">🔍 Search (Name / Phone)</label>
            <input
              type="text"
              className="border rounded-lg px-3 py-2 w-full text-sm"
              placeholder="Search..."
              value={filters.search}
              onChange={(e) => setFilters({ ...filters, search: e.target.value })}
            />
          </div>
          <div>
            <label className="text-xs text-gray-600 block mb-1">📅 Batch</label>
            <select
              className="border rounded-lg px-3 py-2 w-full text-sm"
              value={filters.batch}
              onChange={(e) => setFilters({ ...filters, batch: e.target.value })}
            >
              <option value="">All Batches</option>
              <option value="Regular">Regular</option>
              <option value="Weekend">Weekend</option>
            </select>
          </div>
          <div>
            <label className="text-xs text-gray-600 block mb-1">📆 Start Date Min</label>
            <input
              type="date"
              className="border rounded-lg px-3 py-2 w-full text-sm"
              value={filters.startDateMin}
              onChange={(e) => setFilters({ ...filters, startDateMin: e.target.value })}
            />
          </div>
          <div>
            <label className="text-xs text-gray-600 block mb-1">📆 Start Date Max</label>
            <input
              type="date"
              className="border rounded-lg px-3 py-2 w-full text-sm"
              value={filters.startDateMax}
              onChange={(e) => setFilters({ ...filters, startDateMax: e.target.value })}
            />
          </div>
        </div>

        {/* Table */}
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-gray-100 border-b">
              <tr>
                <th className="text-left px-3 py-2 font-semibold">Name</th>
                <th className="text-left px-3 py-2 font-semibold">Phone</th>
                <th className="text-left px-3 py-2 font-semibold">Package</th>
                <th className="text-left px-3 py-2 font-semibold">Batch</th>
                <th className="text-left px-3 py-2 font-semibold">Start Date</th>
                <th className="text-left px-3 py-2 font-semibold">End Date</th>
                <th className="text-center px-3 py-2 font-semibold">Remaining</th>
                <th className="text-center px-3 py-2 font-semibold">Due Amount</th>
                <th className="text-center px-3 py-2 font-semibold">🟢 Collected</th>
                <th className="text-center px-3 py-2 font-semibold">Status</th>
                <th className="text-center px-3 py-2 font-semibold">Action</th>
              </tr>
            </thead>
            <tbody className="divide-y">
              {filteredStudents.length === 0 ? (
                <tr>
                  <td colSpan="10" className="text-center py-6 text-gray-500">
                    No students found
                  </td>
                </tr>
              ) : (
                filteredStudents.map((s) => (
                  <tr key={s._id} className="hover:bg-gray-50">
                    <td className="px-3 py-2 font-semibold">{s.name}</td>
                    <td className="px-3 py-2">{s.phone}</td>
                    <td className="px-3 py-2">{s.totalClasses} classes</td>
                    <td className="px-3 py-2">{s.batchType}</td>
                    <td className="px-3 py-2 text-sm">{formatDate(s.startDate)}</td>
                    <td className="px-3 py-2 text-sm">{formatDate(s.endDate)}</td>
                    <td className="px-3 py-2 text-center font-semibold">{s.remainingClasses}</td>
                    <td className={`px-3 py-2 text-center font-semibold ${s.due > 0 ? 'text-orange-600' : 'text-gray-500'}`}>
                      {s.due > 0 ? `৳ ${s.due.toLocaleString()}` : '-'}
                    </td>
                    <td className="px-3 py-2 text-center font-semibold text-green-700">
                      ৳ {((s.price - (s.discount || 0)) - (s.due || 0)).toLocaleString()}
                    </td>
                    <td className="px-3 py-2 text-center">
                      {s.status === 'active' ? (
                        <span className="inline-block bg-green-100 text-green-800 px-2 py-1 rounded text-xs font-semibold">
                          🟢 Active
                        </span>
                      ) : (
                        <span className="inline-block bg-red-100 text-red-800 px-2 py-1 rounded text-xs font-semibold">
                          🔴 Expired
                        </span>
                      )}
                    </td>
                    <td className="px-3 py-2 text-center">
                      <ActionDropdown
                        actions={[
                          {
                            label: 'View Profile',
                            onClick: async () => {
                              const res = await apiRequest(`/training/students/${s._id}`, { token });
                              setSelectedStudent(res.student);
                              setProfileModalOpen(true);
                            },
                          },
                          ...(s.due > 0 ? [{
                            label: '💳 Collect Payment',
                            onClick: () => {
                              setSelectedPaymentStudent(s);
                              setPaymentModalOpen(true);
                            },
                          }] : []),
                          {
                            label: 'Mark Completed',
                            onClick: () => {
                              // We'll implement confirmation dialog via StudentProfileModal
                              const res = apiRequest(`/training/students/${s._id}`, { token });
                              res.then(r => {
                                setSelectedStudent(r.student);
                                setProfileModalOpen(true);
                              });
                            },
                          },
                          {
                            label: 'Mark Expired',
                            onClick: () => {
                              const res = apiRequest(`/training/students/${s._id}`, { token });
                              res.then(r => {
                                setSelectedStudent(r.student);
                                setProfileModalOpen(true);
                              });
                            },
                            destructive: true,
                          },
                        ]}
                      />
                    </td>
                  </tr>
                ))
              )}
              {filteredStudents.length > 0 && (
                <tr className="bg-gray-100 font-semibold border-t-2 border-gray-300 sticky bottom-0">
                  <td colSpan="2" className="px-3 py-3 text-left">
                    👥 Total: {filteredStudents.length} student{filteredStudents.length !== 1 ? 's' : ''}
                  </td>
                  <td colSpan="5" className="px-3 py-3"></td>
                  <td className="px-3 py-3 text-center text-orange-600">
                    🔴 ৳ {filteredStudents.reduce((sum, s) => sum + (s.due || 0), 0).toLocaleString()}
                  </td>
                  <td className="px-3 py-3 text-center text-green-700">
                    💰 ৳ {filteredStudents.reduce((sum, s) => sum + ((s.price - (s.discount || 0)) - (s.due || 0)), 0).toLocaleString()}
                  </td>
                  <td colSpan="2" className="px-3 py-3"></td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Class Slots */}
      <div className="card p-4">
        <h3 className="text-lg font-semibold mb-3">🎯 Class Slots</h3>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          {trainingSummary.map((slot) => {
            const fillPct = (slot.totalStudents / SLOT_LIMIT) * 100;
            return (
              <div key={slot.classSlot} className={`border-2 rounded-lg p-3 space-y-2 ${getSlotColor(slot.totalStudents)}`}>
                <div className="flex items-center justify-between">
                  <div>
                    <p className={`font-semibold ${getSlotTextColor(slot.totalStudents)}`}>{slot.label}</p>
                    <p className="text-xs text-gray-600">{slot.time}</p>
                  </div>
                  <span className={`text-sm font-bold ${getSlotTextColor(slot.totalStudents)}`}>
                    {slot.totalStudents} / {SLOT_LIMIT}
                  </span>
                </div>
                <div className="w-full bg-gray-300 rounded-full h-2">
                  <div
                    className={`h-2 rounded-full transition-all ${getProgressBarColor(slot.totalStudents)}`}
                    style={{ width: `${Math.min(fillPct, 100)}%` }}
                  />
                </div>
                <p className="text-xs text-gray-600">
                  Attended: {slot.attended} · Missed: {slot.missed} · Makeup: {slot.makeup}
                </p>
              </div>
            );
          })}
        </div>
      </div>

      {/* Remaining Classes */}
      <div className="card p-4">
        <h3 className="text-lg font-semibold mb-3">📚 Remaining Classes</h3>
        <div className="max-h-96 overflow-auto divide-y text-sm">
          {remainingList.length === 0 ? (
            <p className="text-gray-500 py-4">No active students</p>
          ) : (
            remainingList.map((s) => {
              const daysLeft = Math.ceil((new Date(s.endDate) - new Date()) / (1000 * 60 * 60 * 24));
              const isExpiringSoon = daysLeft < 7 && daysLeft >= 0;
              const isExpired = daysLeft < 0;
              const isLowClasses = s.remainingClasses < 3;

              return (
                <div key={s.id} className="py-3 flex items-center justify-between">
                  <div className="flex-1">
                    <p className="font-semibold">{s.name}</p>
                    <p className="text-xs text-gray-500">Slot {s.classSlot} · {formatDate(s.endDate)}</p>
                    <div className="flex gap-2 mt-2 flex-wrap">
                      {isLowClasses && (
                        <span className="inline-block bg-orange-200 text-orange-800 px-2 py-1 rounded text-xs font-semibold">
                          ⚠️ Less than 3 classes
                        </span>
                      )}
                      {isExpiringSoon && !isExpired && (
                        <span className="inline-block bg-yellow-200 text-yellow-800 px-2 py-1 rounded text-xs font-semibold">
                          ⚠️ Expiring soon
                        </span>
                      )}
                      {isExpired && (
                        <span className="inline-block bg-red-200 text-red-800 px-2 py-1 rounded text-xs font-semibold">
                          🔴 Expired
                        </span>
                      )}
                    </div>
                  </div>
                  <div className="text-right ml-4">
                    <span className="font-semibold text-lg">{s.remainingClasses}</span>
                    <p className="text-xs text-gray-500">Classes</p>
                  </div>
                </div>
              );
            })
          )}
        </div>
      </div>

      <StudentProfileModal
        isOpen={profileModalOpen}
        student={selectedStudent}
        onClose={() => {
          setProfileModalOpen(false);
          setSelectedStudent(null);
        }}
        token={token}
        showToast={showToast}
        onSave={() => {
          loadTrainingData();
        }}
      />

      <TrainingPaymentModal
        isOpen={paymentModalOpen}
        studentId={selectedPaymentStudent?._id}
        studentName={selectedPaymentStudent?.name}
        currentDue={selectedPaymentStudent?.due}
        onClose={() => {
          setPaymentModalOpen(false);
          setSelectedPaymentStudent(null);
        }}
        onSuccess={() => {
          loadTrainingData();
        }}
        showToast={showToast}
        token={token}
      />
    </div>
  );
}
