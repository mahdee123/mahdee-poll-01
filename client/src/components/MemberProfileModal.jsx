import React, { useState, useEffect } from 'react';
import { apiRequest } from '../api.js';
import ConfirmDialog from './ConfirmDialog.jsx';

const PLAN_PRICING = {
  Monthly: { reg: 2500, fee: 4000, discount: 0, final: 6500 },
  Quarterly: { reg: 2500, fee: 12000, discount: 4500, final: 10000 },
  'Half-Yearly': { reg: 2500, fee: 24000, discount: 9500, final: 17000 },
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
      title: 'Pay Monthly Fee?',
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
      <div className="fixed inset-0 bg-black/30 flex items-center justify-center z-40 p-4">
        <div className="card p-6 max-w-2xl w-full max-h-96 overflow-y-auto shadow-lg">
          <div className="flex items-center justify-between mb-6">
            <h2 className="text-2xl font-bold">Member Profile</h2>
            <button
              onClick={onClose}
              className="text-gray-500 hover:text-gray-700 text-2xl leading-none"
            >
              ✕
            </button>
          </div>

          {/* Tab Navigation */}
          <div className="flex gap-4 mb-6 border-b">
            <button
              onClick={() => setActiveTab('info')}
              className={`pb-2 px-4 font-semibold transition ${
                activeTab === 'info'
                  ? 'text-blue-600 border-b-2 border-blue-600'
                  : 'text-gray-600 hover:text-gray-800'
              }`}
            >
              📋 Member Info
            </button>
            <button
              onClick={() => setActiveTab('history')}
              className={`pb-2 px-4 font-semibold transition ${
                activeTab === 'history'
                  ? 'text-blue-600 border-b-2 border-blue-600'
                  : 'text-gray-600 hover:text-gray-800'
              }`}
            >
              📜 Payment History
            </button>
          </div>

          {/* Member Info Tab */}
          {activeTab === 'info' && (
            <>
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
                    <input
                      type="text"
                      placeholder="Address"
                      value={editForm.address}
                      onChange={(e) => setEditForm({ ...editForm, address: e.target.value })}
                      className="border rounded-lg px-3 py-2 w-full"
                    />
                  </div>

                  <div className="space-y-3">
                    <h3 className="font-semibold text-lg">📋 Membership Details</h3>
                    <select
                      value={editForm.plan}
                      onChange={(e) => setEditForm({ ...editForm, plan: e.target.value })}
                      className="border rounded-lg px-3 py-2 w-full"
                    >
                      <option value="">Select Plan</option>
                      {Object.keys(PLAN_PRICING).map((plan) => (
                        <option key={plan} value={plan}>
                          {plan}
                        </option>
                      ))}
                    </select>
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
                        <p className="font-semibold">{member.name}</p>
                      </div>
                      <div>
                        <p className="text-gray-600">Phone</p>
                        <p className="font-semibold">{member.phone}</p>
                      </div>
                      {member.address && (
                        <div className="sm:col-span-2">
                          <p className="text-gray-600">Address</p>
                          <p className="font-semibold">{member.address}</p>
                        </div>
                      )}
                    </div>
                  </div>

                  <div>
                    <h3 className="font-semibold text-lg mb-3">📋 Membership Details</h3>
                    <div className="grid sm:grid-cols-2 gap-4 text-sm">
                      <div>
                        <p className="text-gray-600">Plan</p>
                        <p className="font-semibold">{member.plan}</p>
                      </div>
                      <div>
                        <p className="text-gray-600">Start Date</p>
                        <p className="font-semibold">{formatDate(member.startDate)}</p>
                      </div>
                      <div>
                        <p className="text-gray-600">End Date</p>
                        <p className="font-semibold">{formatDate(member.endDate)}</p>
                      </div>
                      <div>
                        <p className="text-gray-600">Days Remaining</p>
                        <p className="font-semibold text-green-600">
                          {Math.ceil((new Date(member.endDate) - new Date()) / (1000 * 60 * 60 * 24))}
                        </p>
                      </div>
                    </div>
                  </div>

                  <div>
                    <h3 className="font-semibold text-lg mb-3">💰 Financial Details</h3>
                    <div className="grid sm:grid-cols-2 gap-4 text-sm">
                      <div>
                        <p className="text-gray-600">Total Due</p>
                        <p className={`font-semibold ${member.totalDue > 0 ? 'text-orange-600' : 'text-gray-600'}`}>
                          ৳{member.totalDue || 0}
                        </p>
                      </div>
                      <div>
                        <p className="text-gray-600">Advance Credit</p>
                        <p className={`font-semibold ${member.advanceCredit > 0 ? 'text-green-600' : 'text-gray-600'}`}>
                          ৳{member.advanceCredit || 0}
                        </p>
                      </div>
                      <div className="sm:col-span-2">
                        <p className="text-gray-600">Last Payment</p>
                        <p className="font-semibold">{member.lastPaymentDate ? formatDate(member.lastPaymentDate) : 'Never'}</p>
                      </div>
                    </div>
                  </div>

                  <div>
                    <h3 className="font-semibold text-lg mb-3">📊 Status</h3>
                    <div className="flex items-center gap-3 mb-4">
                      <span
                        className={`inline-block px-3 py-1 rounded-lg font-semibold text-sm ${
                          member.status === 'Active'
                            ? 'bg-green-100 text-green-800'
                            : member.status === 'Expired'
                            ? 'bg-red-100 text-red-800'
                            : 'bg-gray-100 text-gray-800'
                        }`}
                      >
                        {member.status === 'Active'
                          ? '🟢 Active'
                          : member.status === 'Expired'
                          ? '🔴 Expired'
                          : '⚫ Inactive'}
                      </span>
                    </div>
                    <div className="flex gap-2 flex-wrap mb-4">
                      {member.status !== 'Active' && (
                        <button
                          onClick={() => handleStatusChange('Active')}
                          className="px-3 py-2 text-sm rounded-lg bg-green-100 hover:bg-green-200 text-green-700 font-medium"
                        >
                          Mark Active
                        </button>
                      )}
                      {member.status !== 'Expired' && (
                        <button
                          onClick={() => handleStatusChange('Expired')}
                          className="px-3 py-2 text-sm rounded-lg bg-red-100 hover:bg-red-200 text-red-700 font-medium"
                        >
                          Mark Expired
                        </button>
                      )}
                      {member.status !== 'Inactive' && (
                        <button
                          onClick={() => handleStatusChange('Inactive')}
                          className="px-3 py-2 text-sm rounded-lg bg-gray-100 hover:bg-gray-200 text-gray-700 font-medium"
                        >
                          Mark Inactive
                        </button>
                      )}
                    </div>
                    {member.status === 'Expired' && member.totalDue > 0 && (
                      <button
                        onClick={handlePayMonthlyFee}
                        disabled={loading}
                        className="w-full px-4 py-2 bg-blue-500 hover:bg-blue-600 text-white font-medium rounded-lg disabled:opacity-50"
                      >
                        💳 Pay Monthly Fee (৳2,000)
                      </button>
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
            </>
          )}

          {/* Payment History Tab */}
          {activeTab === 'history' && (
            <div>
              {historyLoading ? (
                <div className="text-center py-8 text-gray-500">⏳ Loading payment history...</div>
              ) : paymentHistory.length === 0 ? (
                <div className="text-center py-8 text-gray-500">No payments yet</div>
              ) : (
                <div className="space-y-3 overflow-y-auto max-h-64">
                  <div className="text-xs font-semibold text-gray-600 grid grid-cols-3 gap-2 pb-2 border-b sticky top-0 bg-white">
                    <div>Date</div>
                    <div className="text-right">Amount</div>
                    <div className="text-right">Method</div>
                  </div>
                  {paymentHistory.map((payment) => (
                    <div key={payment._id} className="grid grid-cols-3 gap-2 p-3 bg-gray-50 rounded-lg text-sm">
                      <div>
                        <p className="font-semibold">{formatDate(payment.date)}</p>
                        <p className="text-xs text-gray-500">{payment.transactionType === 'DuePayment' ? 'Due Payment' : 'Monthly Payment'}</p>
                      </div>
                      <div className="text-right">
                        <p className="font-semibold text-green-600">৳{payment.amount.toLocaleString()}</p>
                        <p className="text-xs text-gray-500">ID: {payment.receiptId}</p>
                      </div>
                      <div className="text-right">
                        <p className="font-semibold">{payment.paymentMethod}</p>
                      </div>
                    </div>
                  ))}
                </div>
              )}
              <div className="flex gap-2 mt-6">
                <button
                  onClick={() => setActiveTab('info')}
                  className="flex-1 px-4 py-2 rounded-lg bg-gray-200 hover:bg-gray-300 text-gray-800 font-medium"
                >
                  Back
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
