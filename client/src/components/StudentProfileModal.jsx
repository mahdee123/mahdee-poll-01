import React, { useState, useEffect } from 'react';
import { apiRequest } from '../api.js';
import ConfirmDialog from './ConfirmDialog.jsx';

const BATCH_TYPES = [
  { value: 'Regular', label: 'Regular (30 days)' },
  { value: 'Weekend', label: 'Weekend (40 days)' },
];

const CLASS_SLOTS = {
  1: { label: 'Class 01', time: '08:00 AM - 09:00 AM' },
  2: { label: 'Class 02', time: '09:00 AM - 10:00 AM' },
  3: { label: 'Class 03', time: '05:00 PM - 06:00 PM' },
  4: { label: 'Class 04', time: '06:00 PM - 07:00 PM' },
};

const formatDate = (d) => {
  if (!d) return '';
  return new Date(d).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' });
};

export default function StudentProfileModal({ isOpen, student, onClose, token, showToast, onSave }) {
  const [isEditMode, setIsEditMode] = useState(false);
  const [loading, setLoading] = useState(false);
  const [classHistory, setClassHistory] = useState([]);
  const [confirmDialog, setConfirmDialog] = useState({ isOpen: false, title: '', message: '', action: null });

  const [editForm, setEditForm] = useState({
    name: '',
    phone: '',
    batchType: '',
    classSlot: '',
    endDate: '',
  });

  useEffect(() => {
    if (isOpen && student) {
      setEditForm({
        name: student.name || '',
        phone: student.phone || '',
        batchType: student.batchType || '',
        classSlot: student.classSlot || '',
        endDate: student.endDate ? student.endDate.split('T')[0] : '',
      });
      loadClassHistory();
      setIsEditMode(false);
    }
  }, [isOpen, student]);

  const loadClassHistory = async () => {
    if (!student?._id) return;
    try {
      const res = await apiRequest(`/training/students/${student._id}/history`, { token });
      setClassHistory(res.records || []);
    } catch (err) {
      console.error('Failed to load class history:', err);
    }
  };

  const handleSave = async () => {
    try {
      setLoading(true);
      await apiRequest(`/training/students/${student._id}`, {
        method: 'PUT',
        body: editForm,
        token,
      });
      showToast('Student profile updated');
      setIsEditMode(false);
      if (onSave) onSave();
    } catch (err) {
      showToast(err.message);
    } finally {
      setLoading(false);
    }
  };

  const handleStatusChange = (newStatus) => {
    setConfirmDialog({
      isOpen: true,
      title: `Mark as ${newStatus}?`,
      message: `Are you sure you want to mark this student as ${newStatus.toLowerCase()}? This action can be changed later.`,
      action: async () => {
        try {
          setLoading(true);
          await apiRequest(`/training/students/${student._id}/status`, {
            method: 'POST',
            body: { status: newStatus },
            token,
          });
          showToast(`Student marked as ${newStatus}`);
          setConfirmDialog({ isOpen: false, title: '', message: '', action: null });
          if (onSave) onSave();
          // Close modal after status change
          setTimeout(() => onClose(), 500);
        } catch (err) {
          showToast(err.message);
        } finally {
          setLoading(false);
        }
      },
    });
  };

  const handlePayDue = () => {
    setConfirmDialog({
      isOpen: true,
      title: 'Pay Due Amount?',
      message: `Process a payment for ${student.name}? Current due: ৳${student.due?.toLocaleString() || 0}. You can pay the full amount or a partial amount.`,
      action: async () => {
        try {
          setLoading(true);
          await apiRequest(`/training/students/${student._id}/pay-due`, {
            method: 'POST',
            body: { paymentAmount: student.due, paymentMethod: 'Cash' },
            token,
          });
          showToast('Payment processed successfully');
          setConfirmDialog({ isOpen: false, title: '', message: '', action: null });
          if (onSave) onSave();
        } catch (err) {
          showToast(err.message);
        } finally {
          setLoading(false);
        }
      },
    });
  };

  if (!isOpen || !student) return null;

  return (
    <>
      <div className="fixed inset-0 bg-black/30 flex items-center justify-center z-40 p-4">
        <div className="card p-6 max-w-2xl w-full max-h-96 overflow-y-auto shadow-lg">
          <div className="flex items-center justify-between mb-6">
            <h2 className="text-2xl font-bold">Student Profile</h2>
            <button
              onClick={onClose}
              className="text-gray-500 hover:text-gray-700 text-2xl leading-none"
            >
              ✕
            </button>
          </div>

          {isEditMode ? (
            // EDIT MODE
            <div className="space-y-6">
              <div className="space-y-3">
                <h3 className="font-semibold text-lg">👤 Basic Info</h3>
                <input
                  type="text"
                  placeholder="Name"
                  value={editForm.name}
                  onChange={(e) => setEditForm({ ...editForm, name: e.target.value })}
                  className="border rounded-lg px-3 py-2 w-full"
                />
                <input
                  type="text"
                  placeholder="Phone"
                  value={editForm.phone}
                  onChange={(e) => setEditForm({ ...editForm, phone: e.target.value })}
                  className="border rounded-lg px-3 py-2 w-full"
                />
              </div>

              <div className="space-y-3">
                <h3 className="font-semibold text-lg">🏊 Training Details</h3>
                <div className="grid sm:grid-cols-2 gap-3">
                  <select
                    value={editForm.batchType}
                    onChange={(e) => setEditForm({ ...editForm, batchType: e.target.value })}
                    className="border rounded-lg px-3 py-2"
                  >
                    <option value="">Select Batch</option>
                    {BATCH_TYPES.map((b) => (
                      <option key={b.value} value={b.value}>
                        {b.label}
                      </option>
                    ))}
                  </select>
                  <select
                    value={editForm.classSlot}
                    onChange={(e) => setEditForm({ ...editForm, classSlot: e.target.value })}
                    className="border rounded-lg px-3 py-2"
                  >
                    <option value="">Select Slot</option>
                    {[1, 2, 3, 4].map((s) => (
                      <option key={s} value={s}>
                        {CLASS_SLOTS[s].label} - {CLASS_SLOTS[s].time}
                      </option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="text-sm text-gray-600">End Date (optional)</label>
                  <input
                    type="date"
                    value={editForm.endDate}
                    onChange={(e) => setEditForm({ ...editForm, endDate: e.target.value })}
                    className="border rounded-lg px-3 py-2 w-full"
                  />
                </div>
              </div>

              <div className="flex gap-2">
                <button
                  onClick={handleSave}
                  disabled={loading}
                  className="flex-1 btn-primary disabled:opacity-50"
                >
                  {loading ? 'Saving...' : 'Save Changes'}
                </button>
                <button
                  onClick={() => setIsEditMode(false)}
                  className="flex-1 px-4 py-2 rounded-lg bg-gray-200 hover:bg-gray-300 text-gray-800 font-medium"
                >
                  Cancel
                </button>
              </div>
            </div>
          ) : (
            // VIEW MODE
            <div className="space-y-6">
              <div>
                <h3 className="font-semibold text-lg mb-3">👤 Basic Info</h3>
                <div className="grid sm:grid-cols-2 gap-4 text-sm">
                  <div>
                    <p className="text-gray-600">Name</p>
                    <p className="font-semibold">{student.name}</p>
                  </div>
                  <div>
                    <p className="text-gray-600">Phone</p>
                    <p className="font-semibold">{student.phone}</p>
                  </div>
                </div>
              </div>

              <div>
                <h3 className="font-semibold text-lg mb-3">💰 Payment Information</h3>
                <div className="grid sm:grid-cols-2 gap-4 text-sm">
                  <div className="bg-blue-50 border border-blue-100 rounded-lg p-3">
                    <p className="text-blue-600 text-xs uppercase font-semibold">Package Price</p>
                    <p className="text-lg font-bold text-blue-700">৳{student.price?.toLocaleString() || 0}</p>
                  </div>
                  <div className="bg-slate-50 border border-slate-100 rounded-lg p-3">
                    <p className="text-slate-600 text-xs uppercase font-semibold">Amount Paid</p>
                    <p className="text-lg font-bold text-slate-700">৳{student.amountPaid?.toLocaleString() || 0}</p>
                  </div>
                  <div className={`border rounded-lg p-3 ${student.due > 0 ? 'bg-orange-50 border-orange-200' : 'bg-green-50 border-green-200'}`}>
                    <p className={`text-xs uppercase font-semibold ${student.due > 0 ? 'text-orange-600' : 'text-green-600'}`}>Due Amount</p>
                    <p className={`text-lg font-bold ${student.due > 0 ? 'text-orange-700' : 'text-green-700'}`}>৳{student.due?.toLocaleString() || 0}</p>
                  </div>
                </div>
                {student.due > 0 && (
                  <button
                    onClick={handlePayDue}
                    disabled={loading}
                    className="w-full mt-3 px-4 py-2 bg-blue-500 hover:bg-blue-600 text-white font-medium rounded-lg disabled:opacity-50"
                  >
                    💳 Pay Due Amount (৳{student.due?.toLocaleString() || 0})
                  </button>
                )}
              </div>

              <div>
                <h3 className="font-semibold text-lg mb-3">🏊 Training Details</h3>
                <div className="grid sm:grid-cols-2 gap-4 text-sm">
                  <div>
                    <p className="text-gray-600">Age Group</p>
                    <p className="font-semibold">{student.ageGroup === '4-8' ? '4-8 years' : '9+ years'}</p>
                  </div>
                  <div>
                    <p className="text-gray-600">Package</p>
                    <p className="font-semibold">{student.totalClasses} classes</p>
                  </div>
                  <div>
                    <p className="text-gray-600">Batch</p>
                    <p className="font-semibold">{student.batchType}</p>
                  </div>
                  <div>
                    <p className="text-gray-600">Class Slot</p>
                    <p className="font-semibold">
                      {CLASS_SLOTS[student.classSlot]?.label} - {CLASS_SLOTS[student.classSlot]?.time}
                    </p>
                  </div>
                  <div>
                    <p className="text-gray-600">Start Date</p>
                    <p className="font-semibold">{formatDate(student.startDate)}</p>
                  </div>
                  <div>
                    <p className="text-gray-600">End Date</p>
                    <p className="font-semibold">{formatDate(student.endDate)}</p>
                  </div>
                  <div>
                    <p className="text-gray-600">Total Classes</p>
                    <p className="font-semibold">{student.totalClasses}</p>
                  </div>
                  <div>
                    <p className="text-gray-600">Remaining Classes</p>
                    <p className="font-semibold text-green-600">{student.remainingClasses}</p>
                  </div>
                </div>
              </div>

              <div>
                <h3 className="font-semibold text-lg mb-3">📊 Status</h3>
                <div className="flex items-center gap-3 mb-4">
                  <span
                    className={`inline-block px-3 py-1 rounded-lg font-semibold text-sm ${
                      student.status === 'active'
                        ? 'bg-green-100 text-green-800'
                        : 'bg-red-100 text-red-800'
                    }`}
                  >
                    {student.status === 'active' ? '🟢 Active' : '🔴 ' + student.status.charAt(0).toUpperCase() + student.status.slice(1)}
                  </span>
                </div>
                <div className="flex gap-2 flex-wrap">
                  {student.status !== 'active' && (
                    <button
                      onClick={() => handleStatusChange('active')}
                      className="px-3 py-2 text-sm rounded-lg bg-green-100 hover:bg-green-200 text-green-700 font-medium"
                    >
                      Mark Active
                    </button>
                  )}
                  {student.status !== 'completed' && (
                    <button
                      onClick={() => handleStatusChange('completed')}
                      className="px-3 py-2 text-sm rounded-lg bg-yellow-100 hover:bg-yellow-200 text-yellow-700 font-medium"
                    >
                      Mark Completed
                    </button>
                  )}
                  {student.status !== 'expired' && (
                    <button
                      onClick={() => handleStatusChange('expired')}
                      className="px-3 py-2 text-sm rounded-lg bg-red-100 hover:bg-red-200 text-red-700 font-medium"
                    >
                      Mark Expired
                    </button>
                  )}
                </div>
              </div>

              <div>
                <h3 className="font-semibold text-lg mb-3">📚 Class History</h3>
                {classHistory.length === 0 ? (
                  <p className="text-gray-500 text-sm">No class records yet</p>
                ) : (
                  <div className="max-h-40 overflow-y-auto border rounded-lg">
                    <table className="w-full text-sm">
                      <thead className="bg-gray-100 sticky top-0 border-b">
                        <tr>
                          <th className="text-left px-3 py-2 font-semibold">Date</th>
                          <th className="text-left px-3 py-2 font-semibold">Status</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y">
                        {classHistory.map((record) => (
                          <tr key={record._id} className="hover:bg-gray-50">
                            <td className="px-3 py-2">{formatDate(record.date)}</td>
                            <td className="px-3 py-2">
                              <span
                                className={`inline-block px-2 py-1 rounded text-xs font-semibold ${
                                  record.status === 'Attended'
                                    ? 'bg-green-100 text-green-800'
                                    : record.status === 'Missed'
                                    ? 'bg-red-100 text-red-800'
                                    : 'bg-yellow-100 text-yellow-800'
                                }`}
                              >
                                {record.status}
                              </span>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>

              <div className="flex gap-2">
                <button
                  onClick={() => setIsEditMode(true)}
                  className="flex-1 btn-primary"
                >
                  ✏️ Edit Profile
                </button>
                <button
                  onClick={onClose}
                  className="flex-1 px-4 py-2 rounded-lg bg-gray-200 hover:bg-gray-300 text-gray-800 font-medium"
                >
                  Close
                </button>
              </div>
            </div>
          )}
        </div>
      </div>

      <ConfirmDialog
        isOpen={confirmDialog.isOpen}
        title={confirmDialog.title}
        message={confirmDialog.message}
        confirmText="Confirm"
        destructive={true}
        onConfirm={() => {
          if (confirmDialog.action) confirmDialog.action();
        }}
        onCancel={() => setConfirmDialog({ isOpen: false, title: '', message: '', action: null })}
      />
    </>
  );
}
