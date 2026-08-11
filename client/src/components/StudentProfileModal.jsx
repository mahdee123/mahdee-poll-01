import React, { useState, useEffect, useMemo } from 'react';
import { User, Wallet, Waves, ClipboardList, CreditCard, Pencil } from 'lucide-react';
import { apiRequest } from '../api.js';
import ConfirmDialog from './ConfirmDialog.jsx';
import Modal from './Modal';
import Button from './Button';
import Badge from './Badge';

const DEFAULT_BATCH_TYPES = [
  { value: 'Regular', label: 'Regular (30 days)' },
  { value: 'Weekend', label: 'Weekend (40 days)' },
];

const DEFAULT_CLASS_SLOTS = {
  1: { label: 'Class 01', time: '08:00 AM - 09:00 AM' },
  2: { label: 'Class 02', time: '09:00 AM - 10:00 AM' },
  3: { label: 'Class 03', time: '05:00 PM - 06:00 PM' },
  4: { label: 'Class 04', time: '06:00 PM - 07:00 PM' },
};

const formatDate = (d) => {
  if (!d) return '';
  return new Date(d).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' });
};

const CLASS_STATUS_BADGE = {
  Attended: 'badge-success',
  Missed: 'badge-danger',
};

export default function StudentProfileModal({ isOpen, student, onClose, token, showToast, onSave, settings }) {
  const [isEditMode, setIsEditMode] = useState(false);
  const [loading, setLoading] = useState(false);
  const [classHistory, setClassHistory] = useState([]);
  const [confirmDialog, setConfirmDialog] = useState({ isOpen: false, title: '', message: '', action: null });

  const DYNAMIC_BATCH_TYPES = useMemo(() => {
    if (!settings?.batches) return DEFAULT_BATCH_TYPES;
    return settings.batches.map((b) => ({ value: b.name, label: `${b.name} (${b.days} days)` }));
  }, [settings]);

  const DYNAMIC_CLASS_SLOTS = useMemo(() => {
    if (!settings?.classSlots) return DEFAULT_CLASS_SLOTS;
    const map = {};
    settings.classSlots.forEach((s) => { map[s.id] = { label: s.label, time: `${s.startTime} - ${s.endTime}` }; });
    return map;
  }, [settings]);

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
      title: 'Pay due amount?',
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
      <Modal isOpen={isOpen} onClose={onClose} title="Student profile" size="lg">
        {isEditMode ? (
          // EDIT MODE
          <div className="space-y-6">
            <div className="space-y-3">
              <h3 className="flex items-center gap-1.5 font-semibold text-ink"><User size={15} className="text-primary" /> Basic info</h3>
              <input
                type="text"
                placeholder="Name"
                value={editForm.name}
                onChange={(e) => setEditForm({ ...editForm, name: e.target.value })}
                className="input"
              />
              <input
                type="text"
                placeholder="Phone"
                value={editForm.phone}
                onChange={(e) => setEditForm({ ...editForm, phone: e.target.value })}
                className="input"
              />
            </div>

            <div className="space-y-3">
              <h3 className="flex items-center gap-1.5 font-semibold text-ink"><Waves size={15} className="text-primary" /> Training details</h3>
              <div className="grid sm:grid-cols-2 gap-3">
                <select
                  value={editForm.batchType}
                  onChange={(e) => setEditForm({ ...editForm, batchType: e.target.value })}
                  className="select"
                >
                  <option value="">Select batch</option>
                  {DYNAMIC_BATCH_TYPES.map((b) => (
                    <option key={b.value} value={b.value}>
                      {b.label}
                    </option>
                  ))}
                </select>
                <select
                  value={editForm.classSlot}
                  onChange={(e) => setEditForm({ ...editForm, classSlot: e.target.value })}
                  className="select"
                >
                  <option value="">Select slot</option>
                  {Object.keys(DYNAMIC_CLASS_SLOTS).map((s) => (
                    <option key={s} value={s}>
                      {DYNAMIC_CLASS_SLOTS[s].label} - {DYNAMIC_CLASS_SLOTS[s].time}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label className="label">End date (optional)</label>
                <input
                  type="date"
                  value={editForm.endDate}
                  onChange={(e) => setEditForm({ ...editForm, endDate: e.target.value })}
                  className="input"
                />
              </div>
            </div>

            <div className="flex gap-2">
              <Button onClick={handleSave} loading={loading} className="flex-1">Save changes</Button>
              <Button variant="secondary" onClick={() => setIsEditMode(false)} className="flex-1">Cancel</Button>
            </div>
          </div>
        ) : (
          // VIEW MODE
          <div className="space-y-6">
            <div>
              <h3 className="flex items-center gap-1.5 font-semibold text-ink mb-3"><User size={15} className="text-primary" /> Basic info</h3>
              <div className="grid sm:grid-cols-2 gap-4 text-sm">
                <div>
                  <p className="text-ink-soft">Name</p>
                  <p className="font-semibold text-ink">{student.name}</p>
                </div>
                <div>
                  <p className="text-ink-soft">Phone</p>
                  <p className="font-semibold text-ink">{student.phone}</p>
                </div>
              </div>
            </div>

            <div>
              <h3 className="flex items-center gap-1.5 font-semibold text-ink mb-3"><Wallet size={15} className="text-primary" /> Payment information</h3>
              <div className="grid sm:grid-cols-2 gap-4 text-sm">
                <div className="bg-primary-50 border border-primary/10 rounded-card p-3">
                  <p className="text-primary text-xs uppercase font-semibold">Package price</p>
                  <p className="text-lg font-bold text-primary tabular">৳{student.price?.toLocaleString() || 0}</p>
                </div>
                <div className="bg-canvas border border-line rounded-card p-3">
                  <p className="text-ink-soft text-xs uppercase font-semibold">Amount paid</p>
                  <p className="text-lg font-bold text-ink tabular">৳{student.amountPaid?.toLocaleString() || 0}</p>
                </div>
                <div className={`border rounded-card p-3 ${student.due > 0 ? 'bg-warning-soft border-warning/20' : 'bg-success-soft border-success/20'}`}>
                  <p className={`text-xs uppercase font-semibold ${student.due > 0 ? 'text-warning' : 'text-success'}`}>Due amount</p>
                  <p className={`text-lg font-bold tabular ${student.due > 0 ? 'text-warning-ink' : 'text-success-ink'}`}>৳{student.due?.toLocaleString() || 0}</p>
                </div>
              </div>
              {student.due > 0 && (
                <Button onClick={handlePayDue} loading={loading} icon={CreditCard} className="w-full mt-3">
                  Pay due amount (৳{student.due?.toLocaleString() || 0})
                </Button>
              )}
            </div>

            <div>
              <h3 className="flex items-center gap-1.5 font-semibold text-ink mb-3"><Waves size={15} className="text-primary" /> Training details</h3>
              <div className="grid sm:grid-cols-2 gap-4 text-sm">
                <div>
                  <p className="text-ink-soft">Age group</p>
                  <p className="font-semibold text-ink">{student.ageGroup === '4-8' ? '4-8 years' : '9+ years'}</p>
                </div>
                <div>
                  <p className="text-ink-soft">Package</p>
                  <p className="font-semibold text-ink">{student.totalClasses} classes</p>
                </div>
                <div>
                  <p className="text-ink-soft">Batch</p>
                  <p className="font-semibold text-ink">{student.batchType}</p>
                </div>
                <div>
                  <p className="text-ink-soft">Class slot</p>
                  <p className="font-semibold text-ink">
                    {DYNAMIC_CLASS_SLOTS[student.classSlot]?.label} - {DYNAMIC_CLASS_SLOTS[student.classSlot]?.time}
                  </p>
                </div>
                <div>
                  <p className="text-ink-soft">Start date</p>
                  <p className="font-semibold text-ink">{formatDate(student.startDate)}</p>
                </div>
                <div>
                  <p className="text-ink-soft">End date</p>
                  <p className="font-semibold text-ink">{formatDate(student.endDate)}</p>
                </div>
                <div>
                  <p className="text-ink-soft">Total classes</p>
                  <p className="font-semibold text-ink">{student.totalClasses}</p>
                </div>
                <div>
                  <p className="text-ink-soft">Remaining classes</p>
                  <p className="font-semibold text-success">{student.remainingClasses}</p>
                </div>
              </div>
            </div>

            <div>
              <h3 className="flex items-center gap-1.5 font-semibold text-ink mb-3"><ClipboardList size={15} className="text-primary" /> Status</h3>
              <div className="flex items-center gap-3 mb-4">
                <Badge type="status" value={student.status === 'active' ? 'Active' : student.status.charAt(0).toUpperCase() + student.status.slice(1)} />
              </div>
              <div className="flex gap-2 flex-wrap">
                {student.status !== 'active' && (
                  <Button size="sm" variant="secondary" className="!bg-success-soft !text-success-ink !border-transparent hover:!bg-success-soft/80" onClick={() => handleStatusChange('active')}>
                    Mark active
                  </Button>
                )}
                {student.status !== 'completed' && (
                  <Button size="sm" variant="secondary" className="!bg-warning-soft !text-warning-ink !border-transparent hover:!bg-warning-soft/80" onClick={() => handleStatusChange('completed')}>
                    Mark completed
                  </Button>
                )}
                {student.status !== 'expired' && (
                  <Button size="sm" variant="secondary" className="!bg-danger-soft !text-danger-ink !border-transparent hover:!bg-danger-soft/80" onClick={() => handleStatusChange('expired')}>
                    Mark expired
                  </Button>
                )}
              </div>
            </div>

            <div>
              <h3 className="text-sm font-semibold text-ink mb-3">Class history</h3>
              {classHistory.length === 0 ? (
                <p className="text-ink-soft text-sm">No class records yet</p>
              ) : (
                <div className="max-h-40 overflow-y-auto border border-line rounded-card">
                  <table className="table-modern w-full">
                    <thead className="sticky top-0">
                      <tr>
                        <th>Date</th>
                        <th>Status</th>
                      </tr>
                    </thead>
                    <tbody>
                      {classHistory.map((record) => (
                        <tr key={record._id}>
                          <td>{formatDate(record.date)}</td>
                          <td>
                            <span className={CLASS_STATUS_BADGE[record.status] || 'badge-warning'}>
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
              <Button onClick={() => setIsEditMode(true)} icon={Pencil} className="flex-1">Edit profile</Button>
              <Button variant="secondary" onClick={onClose} className="flex-1">Close</Button>
            </div>
          </div>
        )}
      </Modal>

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
