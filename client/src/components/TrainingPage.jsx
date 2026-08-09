import React, { useState, useEffect, useMemo } from 'react';
import { apiRequest } from '../api.js';
import StudentProfileModal from './StudentProfileModal.jsx';
import TrainingPaymentModal from './TrainingPaymentModal.jsx';
import TrainingSettingsModal from './TrainingSettingsModal.jsx';
import ActionDropdown from './ActionDropdown.jsx';
import DateRangeFilter from './DateRangeFilter.jsx';

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
  <div className="card p-3 sm:p-4 flex flex-col gap-1 sm:gap-2">
    <span className="text-xs sm:text-sm text-gray-500">{title}</span>
    <span className="text-xl sm:text-2xl font-semibold text-secondary">{value}</span>
    {hint ? <span className="text-xs text-gray-400">{hint}</span> : null}
  </div>
);

export default function TrainingPage({ token, showToast, setLastReceipt }) {
  // ============ SUMMARY STATS ============
  const [stats, setStats] = useState({ newToday: 0, newMonth: 0, activeStudents: 0, revenueMonth: 0, trainingIncome: 0, trainingDue: 0 });

  // ============ STUDENT LIST & FILTERS ============
  const [students, setStudents] = useState([]);
  const [trainingSummary, setTrainingSummary] = useState([]);
  const [remainingList, setRemainingList] = useState([]);

  // ====== SPLIT FILTER STATES ======
  // Analytics Filter: affects stats cards (date range)
  const [analyticsFilter, setAnalyticsFilter] = useState({ range: 'today', startDate: '', endDate: '' });
  // List Filter: affects student table (search + batch)
  const [listFilter, setListFilter] = useState({
    search: '',
    batch: '', // 'Regular', 'Weekend', or ''
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

  // ============ TRAINING SETTINGS STATE ============
  const [showSettingsModal, setShowSettingsModal] = useState(false);
  const [trainingSettings, setTrainingSettings] = useState(null);

  // Dynamic constants from settings
  const DYNAMIC_AGE_GROUPS = useMemo(() => {
    if (!trainingSettings?.ageGroups) return [{ value: '4-8', label: '4-8 years (16 classes)' }, { value: '9+', label: '9+ years (12 classes)' }];
    return trainingSettings.ageGroups.map((ag) => ({ value: ag.label, label: `${ag.label} years (${ag.classes.Regular} classes)` }));
  }, [trainingSettings]);

  const DYNAMIC_BATCH_TYPES = useMemo(() => {
    if (!trainingSettings?.batches) return [{ value: 'Regular', label: 'Regular (30 days)' }, { value: 'Weekend', label: 'Weekend (40 days)' }];
    return trainingSettings.batches.map((b) => ({ value: b.name, label: `${b.name} (${b.days} days)` }));
  }, [trainingSettings]);

  const DYNAMIC_CLASS_SLOTS = useMemo(() => {
    if (!trainingSettings?.classSlots) return CLASS_SLOTS;
    const map = {};
    trainingSettings.classSlots.forEach((s) => { map[s.id] = { label: s.label, time: `${s.startTime} - ${s.endTime}`, period: s.period }; });
    return map;
  }, [trainingSettings]);

  const DYNAMIC_SLOT_LIMIT = trainingSettings?.slotLimit || SLOT_LIMIT;
  const DYNAMIC_PAYMENT_METHODS = trainingSettings?.paymentMethods || PAYMENT_METHODS;

  // ============ DERIVED CALCULATIONS ============
  const deriveTraining = useMemo(() => {
    const ageConfig = trainingSettings?.ageGroups?.find((a) => a.label === form.ageGroup);
    const batchConfig = trainingSettings?.batches?.find((b) => b.name === form.batchType);
    const totalClasses = ageConfig?.classes?.[form.batchType] || 12;
    const price = ageConfig?.pricing?.[form.batchType] || 9000;
    const days = batchConfig?.days || 30;
    const startDate = new Date(form.startDate);
    const endDate = new Date(startDate.setDate(startDate.getDate() + days));
    const endDateStr = endDate.toISOString().split('T')[0];
    return { totalClasses, price, durationDays: days, endDate: endDateStr };
  }, [form.ageGroup, form.batchType, form.startDate, trainingSettings]);

  const finalAmount = deriveTraining.price - Number(form.discount || 0);
  const paidAmount = form.amountPaid !== null && form.amountPaid !== '' ? Number(form.amountPaid) : finalAmount;
  const dueAmount = Math.max(0, finalAmount - paidAmount);

  // ============ SEPARATE DATA LOADING ============
  const loadAnalyticsData = async () => {
    try {
      // Load dashboard stats for analytics section with date range filter
      let query = `?range=${analyticsFilter.range}`;
      if (analyticsFilter.range === 'custom') {
        if (analyticsFilter.startDate) query += `&startDate=${analyticsFilter.startDate}`;
        if (analyticsFilter.endDate) query += `&endDate=${analyticsFilter.endDate}`;
      }
      
      const dashRes = await apiRequest(`/training/dashboard${query}`, { token });

      setTrainingSummary(dashRes.summary || []);
      setRemainingList(dashRes.remainingByStudent || []);
      if (dashRes.settings) setTrainingSettings(dashRes.settings);

      // Set stats from response
      setStats({ 
        newToday: dashRes.newToday || 0, 
        newMonth: dashRes.newMonth || 0, 
        activeStudents: dashRes.activeStudents || 0, 
        revenueMonth: dashRes.revenueMonth || 0, 
        trainingIncome: dashRes.trainingIncome || 0, 
        trainingDue: dashRes.trainingDue || 0 
      });
    } catch (err) {
      showToast(err.message);
    }
  };

  const loadListData = async () => {
    try {
      // Load students list for the table - without date filtering
      let query = '';
      if (listFilter.search) query += `&search=${encodeURIComponent(listFilter.search)}`;
      if (listFilter.batch) query += `&batch=${encodeURIComponent(listFilter.batch)}`;
      
      const queryString = query ? '?' + query.substring(1) : '';

      const studentsRes = await apiRequest(`/training/students${queryString}`, { token });
      setStudents(studentsRes.students || []);
    } catch (err) {
      showToast(err.message);
    }
  };

  // Load analytics when filters change
  useEffect(() => {
    loadAnalyticsData();
  }, [analyticsFilter, token, showToast]);

  // Load list when filters change
  useEffect(() => {
    loadListData();
  }, [listFilter, token, showToast]);

  // Initial load on component mount
  useEffect(() => {
    loadAnalyticsData();
    loadListData();
  }, [token]);

  // ============ FILTERING LOGIC ============
  const filteredStudents = useMemo(() => {
    // Students are already filtered by API based on listFilter
    // This just applies any additional client-side filtering if needed
    return students;
  }, [students]);

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
      loadAnalyticsData();
      loadListData();
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
    if (totalStudents >= DYNAMIC_SLOT_LIMIT) return 'bg-red-100 border-red-300';
    if (totalStudents >= 10) return 'bg-yellow-100 border-yellow-300';
    return 'bg-green-100 border-green-300';
  };

  const getSlotTextColor = (totalStudents) => {
    if (totalStudents >= DYNAMIC_SLOT_LIMIT) return 'text-red-700';
    if (totalStudents >= 10) return 'text-yellow-700';
    return 'text-green-700';
  };

  const getProgressBarColor = (totalStudents) => {
    if (totalStudents >= DYNAMIC_SLOT_LIMIT) return 'bg-red-500';
    if (totalStudents >= 10) return 'bg-yellow-500';
    return 'bg-green-500';
  };

  // ============ RENDER ============

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
                {DYNAMIC_AGE_GROUPS.map((a) => (
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
                {DYNAMIC_BATCH_TYPES.map((b) => (
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
                  {Object.keys(DYNAMIC_CLASS_SLOTS).map((slot) => (
                    <option key={slot} value={slot}>
                      {DYNAMIC_CLASS_SLOTS[slot].label} - {DYNAMIC_CLASS_SLOTS[slot].time}
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
            <div className="card p-4 space-y-2 bg-primary/5">
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
                  <span className="font-bold text-primary">৳ {paidAmount.toLocaleString()}</span>
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
                <li>Class slot capacity: {DYNAMIC_SLOT_LIMIT} students</li>
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
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <h2 className="text-xl font-bold">Training</h2>
        <div className="flex gap-3">
          <button
            onClick={() => setShowSettingsModal(true)}
            className="px-4 py-2 text-sm rounded-lg bg-gray-200 hover:bg-gray-300 text-gray-800 font-medium min-h-[44px]"
          >
            ⚙️ Settings
          </button>
          <button
            onClick={() => setViewMode('form')}
            className="btn-primary"
          >
            ➕ Add New Student
          </button>
        </div>
      </div>

      {/* ====== ANALYTICS FILTER SECTION (TOP MARKED AREA) ====== */}
      {/* Date Range Filter - Only affects stats cards */}
      <div className="bg-purple-50 border-2 border-purple-200 rounded-lg p-4">
        <DateRangeFilter 
          dateFilter={analyticsFilter} 
          setDateFilter={setAnalyticsFilter} 
          onFilterChange={() => {}} 
        />
      </div>

      {/* Summary Cards (Filtered by Analytics Filter) */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-6 gap-4">
        <StatCard title="New Enrollments Today" value={stats.newToday} />
        <StatCard title="Enrollments This Month" value={stats.newMonth} />
        <StatCard title="Active Students" value={stats.activeStudents} />
        <StatCard title="Training Revenue (This Month)" value={`৳ ${stats.revenueMonth.toLocaleString()}`} />
        <StatCard title="🟢 Training Income (This Month)" value={`৳ ${stats.trainingIncome.toLocaleString()}`} hint="Collected from students" />
        <StatCard title="🔴 Pending Due (Training)" value={`৳ ${stats.trainingDue.toLocaleString()}`} hint="Outstanding payments" />
      </div>

      {/* ====== STUDENT LIST SECTION (INDEPENDENT FROM ANALYTICS) ====== */}
      <div className="card p-4 space-y-4">
        <h3 className="text-lg font-semibold">Students List</h3>

        {/* List Filters - Separate from Analytics */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3 p-3 bg-gray-50 rounded-lg">
          <div>
            <label className="text-xs text-gray-600 block mb-1">🔍 Search (Name / Phone)</label>
            <input
              type="text"
              className="border rounded-lg px-3 py-2 w-full text-sm"
              placeholder="Search..."
              value={listFilter.search}
              onChange={(e) => setListFilter({ ...listFilter, search: e.target.value })}
            />
          </div>
          <div>
            <label className="text-xs text-gray-600 block mb-1">📅 Batch</label>
            <select
              className="border rounded-lg px-3 py-2 w-full text-sm"
              value={listFilter.batch}
              onChange={(e) => setListFilter({ ...listFilter, batch: e.target.value })}
            >
              <option value="">All Batches</option>
              <option value="Regular">Regular</option>
              <option value="Weekend">Weekend</option>
            </select>
          </div>
        </div>

        {/* Mobile card view */}
        <div className="md:hidden space-y-3">
          {filteredStudents.length === 0 ? (
            <div className="text-center py-6 text-gray-500">No students found</div>
          ) : (
            filteredStudents.map((s) => (
              <div key={s._id} className="bg-white rounded-lg border border-gray-200 p-4 space-y-2">
                <div className="flex items-start justify-between">
                  <div>
                    <div className="font-semibold text-gray-900">{s.name}</div>
                    <div className="text-xs text-gray-500">{s.phone}</div>
                  </div>
                  <span className={`text-xs font-semibold px-2 py-1 rounded ${
                    s.status === 'active' ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-800'
                  }`}>
                    {s.status === 'active' ? '🟢 Active' : '🔴 Expired'}
                  </span>
                </div>
                <div className="grid grid-cols-2 gap-2 text-sm">
                  <div><span className="text-xs text-gray-500">Package</span><p className="font-medium">{s.totalClasses} classes</p></div>
                  <div><span className="text-xs text-gray-500">Batch</span><p className="font-medium">{s.batchType}</p></div>
                  <div><span className="text-xs text-gray-500">Start</span><p className="font-medium text-xs">{formatDate(s.startDate)}</p></div>
                  <div><span className="text-xs text-gray-500">End</span><p className="font-medium text-xs">{formatDate(s.endDate)}</p></div>
                  <div><span className="text-xs text-gray-500">Remaining</span><p className="font-semibold">{s.remainingClasses}</p></div>
                  <div><span className="text-xs text-gray-500">Due</span><p className={`font-semibold ${s.due > 0 ? 'text-orange-600' : 'text-gray-500'}`}>{s.due > 0 ? `৳ ${s.due.toLocaleString()}` : '-'}</p></div>
                </div>
                <div className="flex items-center justify-between pt-1 border-t">
                  <span className="text-xs text-green-700 font-semibold">Collected: ৳ {((s.price - (s.discount || 0)) - (s.due || 0)).toLocaleString()}</span>
                  <ActionDropdown
                    actions={[
                      { label: 'View Profile', onClick: async () => { const res = await apiRequest(`/training/students/${s._id}`, { token }); setSelectedStudent(res.student); setProfileModalOpen(true); } },
                      ...(s.due > 0 ? [{ label: '💳 Collect Payment', onClick: () => { setSelectedPaymentStudent(s); setPaymentModalOpen(true); } }] : []),
                      { label: 'Mark Completed', onClick: () => { const res = apiRequest(`/training/students/${s._id}`, { token }); res.then(r => { setSelectedStudent(r.student); setProfileModalOpen(true); }); } },
                      { label: 'Mark Expired', onClick: () => { const res = apiRequest(`/training/students/${s._id}`, { token }); res.then(r => { setSelectedStudent(r.student); setProfileModalOpen(true); }); }, destructive: true },
                    ]}
                  />
                </div>
              </div>
            ))
          )}
          {filteredStudents.length > 0 && (
            <div className="bg-gray-50 rounded-lg p-3 text-sm font-semibold">
              <div className="flex justify-between"><span>Total: {filteredStudents.length} students</span></div>
              <div className="flex justify-between"><span className="text-orange-600">Total Due: ৳ {filteredStudents.reduce((sum, s) => sum + (s.due || 0), 0).toLocaleString()}</span></div>
              <div className="flex justify-between"><span className="text-green-700">Total Collected: ৳ {filteredStudents.reduce((sum, s) => sum + ((s.price - (s.discount || 0)) - (s.due || 0)), 0).toLocaleString()}</span></div>
            </div>
          )}
        </div>

        {/* Desktop table view */}
        <div className="hidden md:block overflow-x-auto">
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
            const fillPct = (slot.totalStudents / DYNAMIC_SLOT_LIMIT) * 100;
            return (
              <div key={slot.classSlot} className={`border-2 rounded-lg p-3 space-y-2 ${getSlotColor(slot.totalStudents)}`}>
                <div className="flex items-center justify-between">
                  <div>
                    <p className={`font-semibold ${getSlotTextColor(slot.totalStudents)}`}>{slot.label}</p>
                    <p className="text-xs text-gray-600">{slot.time}</p>
                  </div>
                  <span className={`text-sm font-bold ${getSlotTextColor(slot.totalStudents)}`}>
                    {slot.totalStudents} / {DYNAMIC_SLOT_LIMIT}
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
        settings={trainingSettings}
        onSave={() => {
          loadAnalyticsData();
          loadListData();
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
          loadAnalyticsData();
          loadListData();
        }}
        showToast={showToast}
        token={token}
      />

      {showSettingsModal && (
        <TrainingSettingsModal
          token={token}
          onClose={() => setShowSettingsModal(false)}
          onSuccess={() => {
            setShowSettingsModal(false);
            loadAnalyticsData();
          }}
        />
      )}
    </div>
  );
}
