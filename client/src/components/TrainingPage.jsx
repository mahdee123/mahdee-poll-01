import React, { useState, useEffect, useMemo } from 'react';
import { apiRequest } from '../api.js';
import StudentProfileModal from './StudentProfileModal.jsx';
import TrainingPaymentModal from './TrainingPaymentModal.jsx';
import TrainingSettingsModal from './TrainingSettingsModal.jsx';
import ActionDropdown from './ActionDropdown.jsx';
import DateRangeFilter from './DateRangeFilter.jsx';
import EmptyState from './EmptyState.jsx';
import Button from './Button.jsx';
import { Search, Settings, UserPlus, GraduationCap, CalendarPlus, Users } from 'lucide-react';

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

const StatCard = ({ title, value, hint, icon: Icon }) => (
  <div className="stat-card">
    <span className="stat-label">
      {Icon ? <Icon size={15} className="text-primary" /> : null}
      {title}
    </span>
    <span className="stat-value">{value}</span>
    {hint ? <span className="stat-hint">{hint}</span> : null}
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
  // Capacity states. An empty slot is *not* a success state — it reads as
  // neutral "open", so a full class is the only thing that draws the eye.
  const getSlotState = (totalStudents) => {
    if (totalStudents >= DYNAMIC_SLOT_LIMIT) return 'full';
    if (totalStudents >= DYNAMIC_SLOT_LIMIT * 0.8) return 'filling';
    if (totalStudents === 0) return 'empty';
    return 'open';
  };

  const SLOT_STYLES = {
    full:    { border: 'border-danger/30 bg-danger-soft',  bar: 'bg-danger',  text: 'text-danger-ink',  badge: 'badge-danger',  note: 'Full' },
    filling: { border: 'border-warning/30 bg-warning-soft', bar: 'bg-warning', text: 'text-warning-ink', badge: 'badge-warning', note: 'Almost full' },
    open:    { border: 'border-line bg-white',              bar: 'bg-primary', text: 'text-ink',         badge: 'badge-info',    note: 'Open' },
    empty:   { border: 'border-line bg-white',              bar: 'bg-line',    text: 'text-ink',         badge: 'badge-neutral', note: 'No students yet' },
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
        <div>
          <h2 className="text-xl sm:text-2xl font-semibold text-ink">Training</h2>
          <p className="muted mt-0.5">Enrollments, payments and class capacity</p>
        </div>
        <div className="flex gap-2">
          <Button variant="secondary" icon={Settings} onClick={() => setShowSettingsModal(true)}>
            Settings
          </Button>
          <Button icon={UserPlus} onClick={() => setViewMode('form')}>
            Add student
          </Button>
        </div>
      </div>

      {/* ====== SUMMARY (driven by the date filter below) ====== */}
      <div className="card">
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-3 px-5 py-4 border-b border-line">
          <div>
            <h3 className="section-title">Summary</h3>
            <p className="muted mt-0.5">Totals for the selected period. The student list below is not affected.</p>
          </div>
          <DateRangeFilter
            dateFilter={analyticsFilter}
            setDateFilter={setAnalyticsFilter}
            onFilterChange={() => {}}
          />
        </div>

        <div className="p-5 grid gap-5 lg:grid-cols-[minmax(0,1fr)_minmax(0,1.1fr)]">
          {/* People */}
          <div>
            <p className="text-xs font-semibold uppercase tracking-wide text-ink-faint mb-3">Enrollment</p>
            <div className="grid grid-cols-3 gap-3">
              <StatCard icon={CalendarPlus} title="New today" value={stats.newToday} />
              <StatCard icon={UserPlus} title="New this period" value={stats.newMonth} />
              <StatCard icon={Users} title="Active students" value={stats.activeStudents} />
            </div>
          </div>

          {/* Money — shown as one story so billed / collected / outstanding relate to each other */}
          <div>
            <p className="text-xs font-semibold uppercase tracking-wide text-ink-faint mb-3">Payments</p>
            {(() => {
              const billed = stats.revenueMonth || 0;
              const collected = stats.trainingIncome || 0;
              const outstanding = stats.trainingDue || 0;
              const pct = billed > 0 ? Math.min(100, Math.round((collected / billed) * 100)) : 0;

              return (
                <div className="card p-4 sm:p-5">
                  <div className="flex items-baseline justify-between gap-3">
                    <span className="text-sm text-ink-soft">Total billed</span>
                    <span className="text-xl sm:text-2xl font-semibold text-ink tabular">
                      ৳ {billed.toLocaleString()}
                    </span>
                  </div>

                  <div
                    className="mt-3 h-2 w-full rounded-full bg-line overflow-hidden"
                    role="img"
                    aria-label={`${pct}% of billed training fees collected`}
                  >
                    <div className="h-full rounded-full bg-success transition-all" style={{ width: `${pct}%` }} />
                  </div>
                  <p className="mt-1.5 text-xs text-ink-faint">{pct}% collected</p>

                  <div className="mt-4 grid grid-cols-2 gap-3 pt-4 border-t border-line">
                    <div>
                      <span className="flex items-center gap-1.5 text-xs font-medium text-ink-soft">
                        <span className="w-2 h-2 rounded-full bg-success" aria-hidden="true" />
                        Collected
                      </span>
                      <p className="mt-1 text-lg font-semibold text-success tabular">
                        ৳ {collected.toLocaleString()}
                      </p>
                    </div>
                    <div>
                      <span className="flex items-center gap-1.5 text-xs font-medium text-ink-soft">
                        <span className="w-2 h-2 rounded-full bg-warning" aria-hidden="true" />
                        Outstanding
                      </span>
                      <p className="mt-1 text-lg font-semibold text-warning tabular">
                        ৳ {outstanding.toLocaleString()}
                      </p>
                    </div>
                  </div>
                </div>
              );
            })()}
          </div>
        </div>
      </div>

      {/* ====== STUDENT LIST SECTION (INDEPENDENT FROM ANALYTICS) ====== */}
      <div className="card">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 px-5 py-4 border-b border-line">
          <div>
            <h3 className="section-title">Students</h3>
            <p className="muted mt-0.5">
              {filteredStudents.length} {filteredStudents.length === 1 ? 'student' : 'students'}
              {listFilter.search || listFilter.batch ? ' matching your filters' : ' enrolled'}
            </p>
          </div>

          {/* List filters — independent of the summary filter above */}
          <div className="flex flex-col sm:flex-row gap-2 sm:items-center">
            <div className="relative">
              <Search
                size={15}
                className="absolute left-3 top-1/2 -translate-y-1/2 text-ink-faint pointer-events-none"
                aria-hidden="true"
              />
              <input
                type="search"
                className="input pl-9 sm:w-56"
                placeholder="Search name or phone"
                aria-label="Search students by name or phone"
                value={listFilter.search}
                onChange={(e) => setListFilter({ ...listFilter, search: e.target.value })}
              />
            </div>
            <select
              className="select sm:w-40"
              aria-label="Filter by batch"
              value={listFilter.batch}
              onChange={(e) => setListFilter({ ...listFilter, batch: e.target.value })}
            >
              <option value="">All batches</option>
              <option value="Regular">Regular</option>
              <option value="Weekend">Weekend</option>
            </select>
          </div>
        </div>

        <div className="p-5 pt-0 sm:p-0">

        {/* Mobile card view */}
        <div className="md:hidden space-y-3">
          {filteredStudents.length === 0 ? (
            <EmptyState
              icon={GraduationCap}
              title={listFilter.search || listFilter.batch ? 'No matching students' : 'No students enrolled yet'}
              message={
                listFilter.search || listFilter.batch
                  ? 'Try a different name, phone number or batch.'
                  : 'Add your first student to start tracking classes and payments.'
              }
              actionLabel={listFilter.search || listFilter.batch ? null : 'Add student'}
              onAction={listFilter.search || listFilter.batch ? null : () => setViewMode('form')}
            />
          ) : (
            filteredStudents.map((s) => (
              <div key={s._id} className="border border-line rounded-card p-4 space-y-2">
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <div className="font-medium text-ink truncate">{s.name}</div>
                    <div className="text-xs text-ink-faint tabular">{s.phone}</div>
                  </div>
                  <span className={s.status === 'active' ? 'badge-success' : 'badge-danger'}>
                    {s.status === 'active' ? 'Active' : 'Expired'}
                  </span>
                </div>
                <div className="grid grid-cols-2 gap-2 text-sm">
                  <div><span className="text-xs text-ink-faint">Package</span><p className="font-medium text-ink">{s.totalClasses} classes</p></div>
                  <div><span className="text-xs text-ink-faint">Batch</span><p className="font-medium text-ink">{s.batchType}</p></div>
                  <div><span className="text-xs text-ink-faint">Start</span><p className="text-xs text-ink tabular">{formatDate(s.startDate)}</p></div>
                  <div><span className="text-xs text-ink-faint">End</span><p className="text-xs text-ink tabular">{formatDate(s.endDate)}</p></div>
                  <div><span className="text-xs text-ink-faint">Classes left</span><p className="font-semibold text-ink tabular">{s.remainingClasses}</p></div>
                  <div><span className="text-xs text-ink-faint">Due</span><p className={`font-semibold tabular ${s.due > 0 ? 'text-warning' : 'text-ink-faint'}`}>{s.due > 0 ? `৳ ${s.due.toLocaleString()}` : '—'}</p></div>
                </div>
                <div className="flex items-center justify-between pt-2 border-t border-line">
                  <span className="text-xs text-success font-medium tabular">Paid ৳ {((s.price - (s.discount || 0)) - (s.due || 0)).toLocaleString()}</span>
                  <ActionDropdown
                    actions={[
                      { label: 'View Profile', onClick: async () => { const res = await apiRequest(`/training/students/${s._id}`, { token }); setSelectedStudent(res.student); setProfileModalOpen(true); } },
                      ...(s.due > 0 ? [{ label: 'Collect Payment', onClick: () => { setSelectedPaymentStudent(s); setPaymentModalOpen(true); } }] : []),
                      { label: 'Mark Completed', onClick: () => { const res = apiRequest(`/training/students/${s._id}`, { token }); res.then(r => { setSelectedStudent(r.student); setProfileModalOpen(true); }); } },
                      { label: 'Mark Expired', onClick: () => { const res = apiRequest(`/training/students/${s._id}`, { token }); res.then(r => { setSelectedStudent(r.student); setProfileModalOpen(true); }); }, destructive: true },
                    ]}
                  />
                </div>
              </div>
            ))
          )}
          {filteredStudents.length > 0 && (
            <div className="bg-canvas border border-line rounded-card p-3 text-sm space-y-1">
              <div className="flex justify-between">
                <span className="text-ink-soft">Students</span>
                <span className="font-semibold text-ink tabular">{filteredStudents.length}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-ink-soft">Outstanding</span>
                <span className="font-semibold text-warning tabular">৳ {filteredStudents.reduce((sum, s) => sum + (s.due || 0), 0).toLocaleString()}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-ink-soft">Collected</span>
                <span className="font-semibold text-success tabular">৳ {filteredStudents.reduce((sum, s) => sum + ((s.price - (s.discount || 0)) - (s.due || 0)), 0).toLocaleString()}</span>
              </div>
            </div>
          )}
        </div>

        {/* Desktop table view */}
        <div className="hidden md:block overflow-x-auto">
          <table className="table-modern">
            <thead>
              <tr>
                <th>Student</th>
                <th>Package</th>
                <th>Enrolled period</th>
                <th className="text-center">Classes left</th>
                <th className="text-right">Due</th>
                <th className="text-right">Paid</th>
                <th className="text-center">Status</th>
                <th className="text-right">Action</th>
              </tr>
            </thead>
            <tbody>
              {filteredStudents.length === 0 ? (
                <tr>
                  <td colSpan="8" className="p-0">
                    <EmptyState
                      icon={GraduationCap}
                      title={listFilter.search || listFilter.batch ? 'No matching students' : 'No students enrolled yet'}
                      message={
                        listFilter.search || listFilter.batch
                          ? 'Try a different name, phone number or batch.'
                          : 'Add your first student to start tracking classes and payments.'
                      }
                      actionLabel={listFilter.search || listFilter.batch ? null : 'Add student'}
                      onAction={listFilter.search || listFilter.batch ? null : () => setViewMode('form')}
                    />
                  </td>
                </tr>
              ) : (
                filteredStudents.map((s) => (
                  <tr key={s._id}>
                    <td>
                      <div className="font-medium text-ink">{s.name}</div>
                      <div className="text-xs text-ink-faint tabular">{s.phone}</div>
                    </td>
                    <td>
                      <div className="text-ink">{s.totalClasses} classes</div>
                      <div className="text-xs text-ink-faint">{s.batchType}</div>
                    </td>
                    <td className="text-xs text-ink-soft tabular whitespace-nowrap">
                      {formatDate(s.startDate)} → {formatDate(s.endDate)}
                    </td>
                    <td className="text-center font-semibold tabular">{s.remainingClasses}</td>
                    <td className={`text-right font-semibold tabular ${s.due > 0 ? 'text-warning' : 'text-ink-faint'}`}>
                      {s.due > 0 ? `৳ ${s.due.toLocaleString()}` : '—'}
                    </td>
                    <td className="text-right font-semibold text-success tabular">
                      ৳ {((s.price - (s.discount || 0)) - (s.due || 0)).toLocaleString()}
                    </td>
                    <td className="text-center">
                      <span className={s.status === 'active' ? 'badge-success' : 'badge-danger'}>
                        {s.status === 'active' ? 'Active' : 'Expired'}
                      </span>
                    </td>
                    <td className="text-right">
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
                            label: 'Collect Payment',
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
                <tr className="bg-canvas font-semibold border-t border-line-strong">
                  <td colSpan="4" className="text-ink">
                    {filteredStudents.length} student{filteredStudents.length !== 1 ? 's' : ''}
                  </td>
                  <td className="text-right text-warning tabular">
                    ৳ {filteredStudents.reduce((sum, s) => sum + (s.due || 0), 0).toLocaleString()}
                  </td>
                  <td className="text-right text-success tabular">
                    ৳ {filteredStudents.reduce((sum, s) => sum + ((s.price - (s.discount || 0)) - (s.due || 0)), 0).toLocaleString()}
                  </td>
                  <td colSpan="2"></td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
        </div>
      </div>

      {/* Class Slots */}
      <div className="card">
        <div className="flex flex-wrap items-center justify-between gap-3 px-5 py-4 border-b border-line">
          <div>
            <h3 className="section-title">Class capacity</h3>
            <p className="muted mt-0.5">Seats booked in each daily slot · limit {DYNAMIC_SLOT_LIMIT} per class</p>
          </div>
          <div className="flex items-center gap-3 text-xs text-ink-soft">
            <span className="flex items-center gap-1.5"><span className="w-2 h-2 rounded-full bg-primary" aria-hidden="true" />Open</span>
            <span className="flex items-center gap-1.5"><span className="w-2 h-2 rounded-full bg-warning" aria-hidden="true" />Almost full</span>
            <span className="flex items-center gap-1.5"><span className="w-2 h-2 rounded-full bg-danger" aria-hidden="true" />Full</span>
          </div>
        </div>

        <div className="p-5 grid grid-cols-1 sm:grid-cols-2 gap-3">
          {trainingSummary.map((slot) => {
            const booked = slot.totalStudents;
            const fillPct = Math.min((booked / DYNAMIC_SLOT_LIMIT) * 100, 100);
            const style = SLOT_STYLES[getSlotState(booked)];
            const seatsLeft = Math.max(DYNAMIC_SLOT_LIMIT - booked, 0);

            return (
              <div key={slot.classSlot} className={`border rounded-card p-4 space-y-3 ${style.border}`}>
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <p className={`font-medium ${style.text}`}>{slot.label}</p>
                    <p className="text-xs text-ink-soft tabular">{slot.time}</p>
                  </div>
                  <span className={style.badge}>{style.note}</span>
                </div>

                <div>
                  <div className="flex items-baseline justify-between mb-1.5">
                    <span className="text-sm text-ink-soft">
                      <strong className={`text-base ${style.text} tabular`}>{booked}</strong>
                      <span className="text-ink-faint tabular"> / {DYNAMIC_SLOT_LIMIT} booked</span>
                    </span>
                    <span className="text-xs text-ink-faint tabular">
                      {seatsLeft > 0 ? `${seatsLeft} seat${seatsLeft !== 1 ? 's' : ''} left` : 'No seats left'}
                    </span>
                  </div>
                  <div
                    className="w-full bg-line rounded-full h-2 overflow-hidden"
                    role="img"
                    aria-label={`${booked} of ${DYNAMIC_SLOT_LIMIT} seats booked`}
                  >
                    <div className={`h-full rounded-full transition-all ${style.bar}`} style={{ width: `${fillPct}%` }} />
                  </div>
                </div>

                <div className="flex gap-4 text-xs text-ink-soft pt-1 border-t border-line/70">
                  <span>Attended <strong className="text-ink tabular">{slot.attended}</strong></span>
                  <span>Missed <strong className="text-ink tabular">{slot.missed}</strong></span>
                  <span>Makeup <strong className="text-ink tabular">{slot.makeup}</strong></span>
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Needs attention — students running low on classes or time */}
      <div className="card">
        <div className="px-5 py-4 border-b border-line">
          <h3 className="section-title">Needs attention</h3>
          <p className="muted mt-0.5">Active students running low on classes or nearing their end date</p>
        </div>
        <div className="max-h-96 overflow-auto">
          {remainingList.length === 0 ? (
            <EmptyState
              icon={Users}
              title="No active students"
              message="Students with classes remaining will appear here."
            />
          ) : (
            <div className="divide-y divide-line">
              {remainingList.map((s) => {
                const daysLeft = Math.ceil((new Date(s.endDate) - new Date()) / (1000 * 60 * 60 * 24));
                const isExpiringSoon = daysLeft < 7 && daysLeft >= 0;
                const isExpired = daysLeft < 0;
                const isLowClasses = s.remainingClasses < 3;

                return (
                  <div key={s.id} className="px-5 py-3 flex items-center justify-between gap-4">
                    <div className="flex-1 min-w-0">
                      <p className="font-medium text-ink truncate">{s.name}</p>
                      <p className="text-xs text-ink-faint tabular">
                        Slot {s.classSlot} · ends {formatDate(s.endDate)}
                      </p>
                      <div className="flex gap-2 mt-2 flex-wrap">
                        {isLowClasses && <span className="badge-warning">Under 3 classes left</span>}
                        {isExpiringSoon && !isExpired && (
                          <span className="badge-warning">
                            Expires in {daysLeft} day{daysLeft !== 1 ? 's' : ''}
                          </span>
                        )}
                        {isExpired && <span className="badge-danger">Expired</span>}
                      </div>
                    </div>
                    <div className="text-right flex-shrink-0">
                      <span className="text-lg font-semibold text-ink tabular">{s.remainingClasses}</span>
                      <p className="text-xs text-ink-faint">classes left</p>
                    </div>
                  </div>
                );
              })}
            </div>
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
