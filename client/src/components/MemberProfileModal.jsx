import React, { useState, useEffect } from 'react';
import { User, ClipboardList, History, Wallet, CreditCard, Pencil, Loader2 } from 'lucide-react';
import { apiRequest } from '../api.js';
import ConfirmDialog from './ConfirmDialog.jsx';
import Modal from './Modal';
import Button from './Button';
import Badge from './Badge';
import EmptyState from './EmptyState';

const PLAN_PRICING = {
  Monthly: { reg: 2500, fee: 4000, discount: 0, final: 6500 },
  Quarterly: { reg: 2500, fee: 12000, discount: 4500, final: 10000 },
  'Half Yearly': { reg: 2500, fee: 24000, discount: 9500, final: 17000 },
  Yearly: { reg: 2500, fee: 48000, discount: 20500, final: 30000 },
};

const formatDate = (d) => {
  if (!d) return '';
  return new Date(d).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' });
};

export default function MemberProfileModal({ isOpen, member, onClose, token, showToast, onSave }) {
  const [isEditMode, setIsEditMode] = useState(false);
  const [loading, setLoading] = useState(false);
  const [confirmDialog, setConfirmDialog] = useState({ isOpen: false, title: '', message: '', action: null });
  const [activeTab, setActiveTab] = useState('info'); // 'info' or 'history'
  const [paymentHistory, setPaymentHistory] = useState([]);
  const [historyLoading, setHistoryLoading] = useState(false);

  const [editForm, setEditForm] = useState({
    name: '',
    phone: '',
    address: '',
    plan: '',
  });

  useEffect(() => {
    if (isOpen && member) {
      setEditForm({
        name: member.name || '',
        phone: member.phone || '',
        address: member.address || '',
        plan: member.plan || '',
      });
      setIsEditMode(false);
      setActiveTab('info');

      // Fetch payment history when modal opens
      if (member._id) {
        fetchPaymentHistory(member._id);
      }
    }
  }, [isOpen, member]);

  const fetchPaymentHistory = async (memberId) => {
    try {
      setHistoryLoading(true);
      const res = await apiRequest(`/memberships/${memberId}/payment-history`, { token });
      setPaymentHistory(res.paymentHistory || []);
    } catch (err) {
      showToast(`Failed to load payment history: ${err.message}`);
    } finally {
      setHistoryLoading(false);
    }
  };

  const handleSave = async () => {
    try {
      setLoading(true);
      await apiRequest(`/memberships/${member._id}`, {
        method: 'PUT',
        body: editForm,
        token,
      });
      showToast('Member profile updated');
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
      message: `Are you sure you want to mark this member as ${newStatus.toLowerCase()}? This action can be changed later.`,
      action: async () => {
        try {
          setLoading(true);
          await apiRequest(`/memberships/${member._id}/status`, {
            method: 'POST',
            body: { status: newStatus },
            token,
          });
          showToast(`Member marked as ${newStatus}`);
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

  const handlePayMonthlyFee = () => {
    setConfirmDialog({
      isOpen: true,
      title: 'Pay monthly fee?',
      message: `Process a ৳2,000 payment for ${member.name}? This will reduce the total due amount.`,
      action: async () => {
        try {
          setLoading(true);
          await apiRequest(`/memberships/${member._id}/pay-monthly`, {
            method: 'POST',
            body: {},
            token,
          });
          showToast('Monthly payment processed successfully');
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

  if (!isOpen || !member) return null;

  return (
    <>
      <Modal isOpen={isOpen} onClose={onClose} title="Member profile" size="lg">
        {/* Tab Navigation */}
        <div className="segmented mb-6">
          <button onClick={() => setActiveTab('info')} className={`flex-1 flex items-center justify-center gap-1.5 ${activeTab === 'info' ? 'segmented-item-active' : 'segmented-item'}`}>
            <ClipboardList size={14} /> Member info
          </button>
          <button onClick={() => setActiveTab('history')} className={`flex-1 flex items-center justify-center gap-1.5 ${activeTab === 'history' ? 'segmented-item-active' : 'segmented-item'}`}>
            <History size={14} /> Payment history
          </button>
        </div>

        {/* Member Info Tab */}
        {activeTab === 'info' && (
          <>
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
                  <input
                    type="text"
                    placeholder="Address"
                    value={editForm.address}
                    onChange={(e) => setEditForm({ ...editForm, address: e.target.value })}
                    className="input"
                  />
                </div>

                <div className="space-y-3">
                  <h3 className="flex items-center gap-1.5 font-semibold text-ink"><ClipboardList size={15} className="text-primary" /> Membership details</h3>
                  <select
                    value={editForm.plan}
                    onChange={(e) => setEditForm({ ...editForm, plan: e.target.value })}
                    className="select"
                  >
                    <option value="">Select plan</option>
                    {Object.keys(PLAN_PRICING).map((plan) => (
                      <option key={plan} value={plan}>
                        {plan}
                      </option>
                    ))}
                  </select>
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
                      <p className="font-semibold text-ink">{member.name}</p>
                    </div>
                    <div>
                      <p className="text-ink-soft">Phone</p>
                      <p className="font-semibold text-ink">{member.phone}</p>
                    </div>
                    {member.address && (
                      <div className="sm:col-span-2">
                        <p className="text-ink-soft">Address</p>
                        <p className="font-semibold text-ink">{member.address}</p>
                      </div>
                    )}
                  </div>
                </div>

                <div>
                  <h3 className="flex items-center gap-1.5 font-semibold text-ink mb-3"><ClipboardList size={15} className="text-primary" /> Membership details</h3>
                  <div className="grid sm:grid-cols-2 gap-4 text-sm">
                    <div>
                      <p className="text-ink-soft">Plan</p>
                      <p className="font-semibold text-ink">{member.plan}</p>
                    </div>
                    <div>
                      <p className="text-ink-soft">Start date</p>
                      <p className="font-semibold text-ink">{formatDate(member.startDate)}</p>
                    </div>
                    <div>
                      <p className="text-ink-soft">End date</p>
                      <p className="font-semibold text-ink">{formatDate(member.endDate)}</p>
                    </div>
                    <div>
                      <p className="text-ink-soft">Days remaining</p>
                      <p className="font-semibold text-success">
                        {Math.ceil((new Date(member.endDate) - new Date()) / (1000 * 60 * 60 * 24))}
                      </p>
                    </div>
                  </div>
                </div>

                <div>
                  <h3 className="flex items-center gap-1.5 font-semibold text-ink mb-3"><Wallet size={15} className="text-primary" /> Financial details</h3>
                  <div className="grid sm:grid-cols-2 gap-4 text-sm">
                    <div>
                      <p className="text-ink-soft">Total due</p>
                      <p className={`font-semibold tabular ${member.totalDue > 0 ? 'text-warning' : 'text-ink-soft'}`}>
                        ৳{member.totalDue || 0}
                      </p>
                    </div>
                    <div>
                      <p className="text-ink-soft">Advance credit</p>
                      <p className={`font-semibold tabular ${member.advanceCredit > 0 ? 'text-success' : 'text-ink-soft'}`}>
                        ৳{member.advanceCredit || 0}
                      </p>
                    </div>
                    <div className="sm:col-span-2">
                      <p className="text-ink-soft">Last payment</p>
                      <p className="font-semibold text-ink">{member.lastPaymentDate ? formatDate(member.lastPaymentDate) : 'Never'}</p>
                    </div>
                  </div>
                </div>

                <div>
                  <h3 className="text-sm font-semibold text-ink mb-3">Status</h3>
                  <div className="flex items-center gap-3 mb-4">
                    <Badge type="status" value={member.status === 'Active' ? 'Active' : member.status === 'Expired' ? 'Expired' : 'Inactive'} />
                  </div>
                  <div className="flex gap-2 flex-wrap mb-4">
                    {member.status !== 'Active' && (
                      <Button size="sm" variant="secondary" className="!bg-success-soft !text-success-ink !border-transparent hover:!bg-success-soft/80" onClick={() => handleStatusChange('Active')}>
                        Mark active
                      </Button>
                    )}
                    {member.status !== 'Expired' && (
                      <Button size="sm" variant="secondary" className="!bg-danger-soft !text-danger-ink !border-transparent hover:!bg-danger-soft/80" onClick={() => handleStatusChange('Expired')}>
                        Mark expired
                      </Button>
                    )}
                    {member.status !== 'Inactive' && (
                      <Button size="sm" variant="secondary" onClick={() => handleStatusChange('Inactive')}>
                        Mark inactive
                      </Button>
                    )}
                  </div>
                  {member.status === 'Expired' && member.totalDue > 0 && (
                    <Button onClick={handlePayMonthlyFee} loading={loading} icon={CreditCard} className="w-full">
                      Pay monthly fee (৳2,000)
                    </Button>
                  )}
                </div>

                <div className="flex gap-2">
                  <Button onClick={() => setIsEditMode(true)} icon={Pencil} className="flex-1">Edit profile</Button>
                  <Button variant="secondary" onClick={onClose} className="flex-1">Close</Button>
                </div>
              </div>
            )}
          </>
        )}

        {/* Payment History Tab */}
        {activeTab === 'history' && (
          <div>
            {historyLoading ? (
              <div className="flex items-center justify-center gap-2 py-8 text-sm text-ink-soft">
                <Loader2 size={16} className="animate-spin" /> Loading payment history…
              </div>
            ) : paymentHistory.length === 0 ? (
              <EmptyState icon={History} title="No payments yet" message="Payments collected from this member will show up here." />
            ) : (
              <div className="space-y-3 overflow-y-auto max-h-64">
                <div className="text-xs font-semibold text-ink-faint uppercase tracking-wide grid grid-cols-3 gap-2 pb-2 border-b border-line sticky top-0 bg-white">
                  <div>Date</div>
                  <div className="text-right">Amount</div>
                  <div className="text-right">Method</div>
                </div>
                {paymentHistory.map((payment) => (
                  <div key={payment._id} className="grid grid-cols-3 gap-2 p-3 bg-canvas rounded-card text-sm">
                    <div>
                      <p className="font-semibold text-ink">{formatDate(payment.date)}</p>
                      <p className="text-xs text-ink-soft">{payment.transactionType === 'DuePayment' ? 'Due Payment' : 'Monthly Payment'}</p>
                    </div>
                    <div className="text-right">
                      <p className="font-semibold text-success tabular">৳{payment.amount.toLocaleString()}</p>
                      <p className="text-xs text-ink-soft">ID: {payment.receiptId}</p>
                    </div>
                    <div className="text-right">
                      <p className="font-semibold text-ink">{payment.paymentMethod}</p>
                    </div>
                  </div>
                ))}
              </div>
            )}
            <div className="flex gap-2 mt-6">
              <Button variant="secondary" onClick={() => setActiveTab('info')} className="flex-1">Back</Button>
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
