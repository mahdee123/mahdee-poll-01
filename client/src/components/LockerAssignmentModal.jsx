import React, { useState, useEffect } from 'react';
import { apiRequest } from '../api';
import Toast from './Toast';

export default function LockerAssignmentModal({ token, locker, allLockers, onClose, onSuccess }) {
  const [step, setStep] = useState(1); // 1: Member, 2: Locker, 3: Billing
  const [loading, setLoading] = useState(false);
  const [toast, setToast] = useState(null);

  // Step 1: Member Selection
  const [members, setMembers] = useState([]);
  const [students, setStudents] = useState([]);
  const [billPayers, setBillPayers] = useState([]);
  const [membersLoading, setMembersLoading] = useState(false);
  const [selectedMember, setSelectedMember] = useState(null);
  const [memberType, setMemberType] = useState('Member'); // Member, Student, or BillPayer
  const [memberSearch, setMemberSearch] = useState('');
  const [isBillPayerAssignment, setIsBillPayerAssignment] = useState(false);

  // Step 2: Locker Selection
  const [selectedLocker, setSelectedLocker] = useState(locker);
  const [availableLockers, setAvailableLockers] = useState([]);

  // Step 3: Billing
  const [settings, setSettings] = useState(null);
  const [chargeType, setChargeType] = useState('None');
  const [chargeAmount, setChargeAmount] = useState(0);
  const [existingBills, setExistingBills] = useState([]);
  const [selectedBill, setSelectedBill] = useState(null);
  const [notes, setNotes] = useState('');

  useEffect(() => {
    if (step === 1) {
      fetchMembers();
    } else if (step === 2) {
      updateAvailableLockers();
    } else if (step === 3) {
      fetchSettings();
      if (selectedMember && selectedMember.memberId && !isBillPayerAssignment) {
        fetchExistingBills();
      }
    }
  }, [step]);

  const fetchMembers = async () => {
    try {
      setMembersLoading(true);
      const [membersRes, studentsRes, billPayersRes] = await Promise.all([
        apiRequest('/memberships?status=Active', {
          token,
        }).catch(() => ({ members: [] })),
        apiRequest('/training?status=active', {
          token,
        }).catch(() => ({ students: [] })),
        apiRequest('/lockers/bill-payers/list', {
          token,
        }).catch(() => ({ billPayers: [] })),
      ]);

      setMembers(membersRes.members || []);
      setStudents(studentsRes.students || []);
      setBillPayers(billPayersRes.billPayers || []);
    } catch (error) {
      console.error('Error fetching members:', error);
      setToast({
        type: 'error',
        message: 'Failed to load members',
      });
    } finally {
      setMembersLoading(false);
    }
  };

  const updateAvailableLockers = () => {
    const available = allLockers.filter((l) => l.status === 'Available');
    setAvailableLockers(available);
  };

  const fetchSettings = async () => {
    try {
      const res = await apiRequest('/lockers/settings', {
        token,
      });
      setSettings(res.settings);
      setChargeAmount(res.settings.chargeAmount || 0);
    } catch (error) {
      console.error('Error fetching settings:', error);
    }
  };

  const fetchExistingBills = async () => {
    try {
      const res = await apiRequest(
        `/transactions/bills?memberId=${selectedMember.memberId}`,
        {
          token,
        }
      );
      const unpaidBills = (res.bills || []).filter((b) => b.paymentMethod === 'Due');
      setExistingBills(unpaidBills);
    } catch (error) {
      console.error('Error fetching bills:', error);
    }
  };

  const getFilteredMembers = () => {
    if (memberType === 'BillPayer') {
      return billPayers.filter(
        (bp) =>
          bp.name?.toLowerCase().includes(memberSearch.toLowerCase()) ||
          bp.phone?.includes(memberSearch)
      );
    }
    const list = memberType === 'Member' ? members : students;
    return list.filter(
      (m) =>
        m.name?.toLowerCase().includes(memberSearch.toLowerCase()) ||
        m.phone?.includes(memberSearch)
    );
  };

  const handleSelectMember = (member) => {
    if (memberType === 'BillPayer') {
      // Hourly swimmer selection
      setSelectedMember({
        memberId: member.sessionId, // Store session ID as memberId
        memberName: member.name,
        memberPhone: member.phone,
      });
      setIsBillPayerAssignment(true);
      // Auto-set billing to AttachedToExistingBill with their session
      setChargeType('AttachedToExistingBill');
      setSelectedBill({ _id: member.sessionId, name: member.name });
    } else {
      // Regular member/student selection
      setSelectedMember({
        ...member,
        memberId: member._id,
        memberName: member.name,
        memberPhone: member.phone,
      });
      setIsBillPayerAssignment(false);
      // Reset billing settings for regular members
      setChargeType('None');
      setSelectedBill(null);
    }
    setStep(2);
  };

  const handleSelectLocker = () => {
    if (!selectedLocker) {
      setToast({
        type: 'error',
        message: 'Please select a locker',
      });
      return;
    }
    setStep(3);
  };

  const handleAssign = async () => {
    if (!selectedMember || !selectedLocker) {
      setToast({
        type: 'error',
        message: 'Please complete all selections',
      });
      return;
    }

    if (chargeType === 'AttachedToExistingBill' && !selectedBill) {
      setToast({
        type: 'error',
        message: 'Please select a bill to attach charge to',
      });
      return;
    }

    try {
      setLoading(true);
      await apiRequest(`/lockers/${selectedLocker._id}/assign`, {
        method: 'POST',
        body: {
          memberId: selectedMember.memberId,
          memberName: selectedMember.memberName,
          memberPhone: selectedMember.memberPhone,
          memberType: isBillPayerAssignment ? 'BillPayer' : memberType,
          chargeType,
          chargeAmount: chargeType === 'None' ? 0 : chargeAmount,
          existingBillTransactionId: selectedBill ? selectedBill._id : null,
          notes,
          isBillPayer: isBillPayerAssignment,
        },
        token,
      });

      setToast({
        type: 'success',
        message: 'Locker assigned successfully',
      });

      setTimeout(() => {
        onSuccess();
      }, 1000);
    } catch (error) {
      console.error('Error assigning locker:', error);
      setToast({
        type: 'error',
        message: error.message || 'Failed to assign locker',
      });
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
      <div className="bg-white rounded-lg shadow-xl max-w-md w-full mx-4">
        {/* Header */}
        <div className="border-b border-gray-200 p-4 flex justify-between items-center">
          <h2 className="text-xl font-bold text-gray-900">🔑 Assign Locker</h2>
          <button
            onClick={onClose}
            className="text-gray-500 hover:text-gray-700 text-2xl leading-none min-h-[44px] min-w-[44px] flex items-center justify-center"
          >
            ×
          </button>
        </div>

        {/* Progress Indicator */}
        <div className="flex gap-2 px-6 py-4 border-b border-gray-200">
          {[1, 2, 3].map((s) => (
            <div key={s} className={`h-2 flex-1 rounded ${step >= s ? 'bg-primary' : 'bg-gray-200'}`} />
          ))}
        </div>

        {/* Content */}
        <div className="p-6 max-h-[60vh] overflow-y-auto">
          {/* Step 1: Member Selection */}
          {step === 1 && (
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Member Type
                </label>
                <div className="flex gap-2">
                  {['Member', 'Student', 'BillPayer'].map((type) => (
                    <button
                      key={type}
                      onClick={() => {
                        setMemberType(type);
                        setSelectedMember(null);
                        setMemberSearch('');
                      }}
                      className={`flex-1 px-3 py-2 rounded-lg font-medium transition-colors ${
                        memberType === type
                          ? 'bg-primary text-white'
                          : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                      }`}
                    >
                      {type === 'BillPayer' ? '🏊 Hourly Swimmer' : type}
                    </button>
                  ))}
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Search {memberType === 'BillPayer' ? 'Active Swimmers' : memberType}
                </label>
                <input
                  type="text"
                  placeholder="Name or phone..."
                  value={memberSearch}
                  onChange={(e) => setMemberSearch(e.target.value)}
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary outline-none"
                />
              </div>

              <div className="max-h-64 overflow-y-auto border border-gray-200 rounded-lg">
                {membersLoading ? (
                  <div className="p-4 text-center text-gray-500">Loading...</div>
                ) : getFilteredMembers().length > 0 ? (
                  getFilteredMembers().map((member) => (
                    <button
                      key={memberType === 'BillPayer' ? member.sessionId : member._id}
                      onClick={() => handleSelectMember(member)}
                      className="w-full text-left px-4 py-3 hover:bg-primary/5 border-b border-gray-100 transition-colors"
                    >
                      <div className="font-medium text-gray-900">{member.name}</div>
                      <div className="text-sm text-gray-600">{member.phone}</div>
                    </button>
                  ))
                ) : (
                  <div className="p-4 text-center text-gray-500">
                    No {memberType === 'BillPayer' ? 'active swimmers' : 'members'} found
                  </div>
                )}
              </div>
            </div>
          )}

          {/* Step 2: Locker Selection */}
          {step === 2 && (
            <div className="space-y-4">
              <p className="text-sm text-gray-600">
                Selected Member: <strong>{selectedMember?.memberName}</strong>
              </p>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Select Available Locker
                </label>
                <div className="max-h-64 overflow-y-auto border border-gray-200 rounded-lg">
                  {availableLockers.length > 0 ? (
                    availableLockers.map((loc) => (
                      <button
                        key={loc._id}
                        onClick={() => setSelectedLocker(loc)}
                        className={`w-full text-left px-4 py-3 border-b border-gray-100 transition-colors ${
                          selectedLocker?._id === loc._id
                            ? 'bg-primary/5 border-l-4 border-l-primary'
                            : 'hover:bg-gray-50'
                        }`}
                      >
                        <div className="font-medium text-gray-900">{loc.lockerNumber}</div>
                      </button>
                    ))
                  ) : (
                    <div className="p-4 text-center text-gray-500">No available lockers</div>
                  )}
                </div>
              </div>
            </div>
          )}

          {/* Step 3: Billing */}
          {step === 3 && (
            <div className="space-y-4">
              <p className="text-sm text-gray-600">
                Locker: <strong>{selectedLocker?.lockerNumber}</strong>
              </p>
              <p className="text-sm text-gray-600">
                {isBillPayerAssignment ? 'Bill Payer:' : 'Member:'} <strong>{selectedMember?.memberName}</strong>
              </p>

              {isBillPayerAssignment && (
                <div className="bg-orange-50 border border-orange-200 rounded-lg p-3">
                  <p className="text-sm text-orange-800">
                    <strong>🏊 Active Hourly Swimmer</strong>
                  </p>
                  <p className="text-xs text-orange-700 mt-1">
                    Charge will be automatically attached to their hourly session billing
                  </p>
                </div>
              )}

              {!isBillPayerAssignment && settings && settings.pricingMode !== 'Free' && (
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-3">
                    Charge Type
                  </label>
                  <div className="space-y-2">
                    {['None', 'SeparateTransaction', 'AttachedToExistingBill'].map(
                      (type) => (
                        <label key={type} className="flex items-center gap-3 cursor-pointer">
                          <input
                            type="radio"
                            name="chargeType"
                            value={type}
                            checked={chargeType === type}
                            onChange={(e) => setChargeType(e.target.value)}
                            className="w-4 h-4"
                          />
                          <span className="text-sm text-gray-700">
                            {type === 'None' && 'No Charge'}
                            {type === 'SeparateTransaction' && 'Create Separate Transaction'}
                            {type === 'AttachedToExistingBill' && 'Add to Existing Bill'}
                          </span>
                        </label>
                      )
                    )}
                  </div>
                </div>
              )}

              {!isBillPayerAssignment && chargeType !== 'None' && (
                <>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      Charge Amount (৳)
                    </label>
                    <input
                      type="number"
                      value={chargeAmount}
                      onChange={(e) => setChargeAmount(parseFloat(e.target.value) || 0)}
                      className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary outline-none"
                    />
                  </div>

                  {chargeType === 'AttachedToExistingBill' && (
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-2">
                        Select Bill
                      </label>
                      <select
                        value={selectedBill?._id || ''}
                        onChange={(e) => {
                          const bill = existingBills.find((b) => b._id === e.target.value);
                          setSelectedBill(bill);
                        }}
                        className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary outline-none"
                      >
                        <option value="">Select a bill...</option>
                        {existingBills.map((bill) => (
                          <option key={bill._id} value={bill._id}>
                            Bill #{bill.receiptId} - ৳{bill.amount}
                          </option>
                        ))}
                      </select>
                    </div>
                  )}
                </>
              )}

              {isBillPayerAssignment && (
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Locker Charge (৳)
                  </label>
                  <input
                    type="number"
                    value={chargeAmount}
                    onChange={(e) => setChargeAmount(parseFloat(e.target.value) || 0)}
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary outline-none"
                  />
                </div>
              )}

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Notes (Optional)
                </label>
                <textarea
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  placeholder="Add any notes..."
                  rows="3"
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary outline-none resize-none"
                />
              </div>
            </div>
          )}
        </div>

        {/* Footer Actions */}
        <div className="border-t border-gray-200 p-4 flex gap-3 justify-end">
          <button
            onClick={() => {
              if (step > 1) {
                setStep(step - 1);
              } else {
                onClose();
              }
            }}
            className="px-4 py-2 text-gray-700 border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors"
          >
            {step === 1 ? 'Cancel' : 'Back'}
          </button>

          {step < 3 && (
            <button
              onClick={step === 2 ? handleSelectLocker : () => setStep(step + 1)}
              className="px-4 py-2 bg-primary text-white rounded-lg hover:bg-primary/90 transition-colors"
            >
              Next
            </button>
          )}

          {step === 3 && (
            <button
              onClick={handleAssign}
              disabled={loading}
              className="px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 disabled:bg-gray-400 transition-colors"
            >
              {loading ? 'Assigning...' : 'Assign Locker'}
            </button>
          )}
        </div>
      </div>

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
