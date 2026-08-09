import React, { useState, useEffect } from 'react';
import { apiRequest } from '../api';
import Toast from './Toast';

export default function DressAssignmentModal({ isOpen, dress, allDresses, token, onClose, onSuccess }) {
  const [step, setStep] = useState(1);
  const [loading, setLoading] = useState(false);
  const [toast, setToast] = useState(null);

  // Dress selection (when dress prop is null)
  const [selectedDress, setSelectedDress] = useState(dress);
  const [dressSearch, setDressSearch] = useState('');

  // Member Selection
  const [members, setMembers] = useState([]);
  const [students, setStudents] = useState([]);
  const [billPayers, setBillPayers] = useState([]);
  const [membersLoading, setMembersLoading] = useState(false);
  const [selectedMember, setSelectedMember] = useState(null);
  const [memberType, setMemberType] = useState('Member');
  const [memberSearch, setMemberSearch] = useState('');
  const [isBillPayerAssignment, setIsBillPayerAssignment] = useState(false);

  // Billing
  const [chargeType, setChargeType] = useState('None');
  const [chargeAmount, setChargeAmount] = useState(0);
  const [existingBills, setExistingBills] = useState([]);
  const [selectedBill, setSelectedBill] = useState(null);
  const [notes, setNotes] = useState('');

  const needsDressSelection = !dress;
  const totalSteps = needsDressSelection ? 4 : 3;

  useEffect(() => {
    if (!isOpen) {
      setStep(1);
      setSelectedDress(dress);
      setSelectedMember(null);
      setMemberSearch('');
      setDressSearch('');
      setChargeType('None');
      setChargeAmount(dress?.chargeAmount || 0);
      setExistingBills([]);
      setSelectedBill(null);
      setNotes('');
      setIsBillPayerAssignment(false);
      return;
    }

    setSelectedDress(dress);
    if (dress?.chargeAmount) {
      setChargeAmount(dress.chargeAmount);
    }

    const effectiveStep = needsDressSelection ? step - 1 : step;
    if (effectiveStep === 1) {
      fetchMembers();
    } else if (effectiveStep === 2 && selectedMember && selectedMember.memberId && !isBillPayerAssignment) {
      fetchExistingBills();
    }
  }, [step, isOpen]);

  useEffect(() => {
    if (dress?.chargeAmount) {
      setChargeAmount(dress.chargeAmount);
    }
    setSelectedDress(dress);
  }, [dress]);

  const fetchMembers = async () => {
    try {
      setMembersLoading(true);
      const [membersRes, studentsRes, billPayersRes] = await Promise.all([
        apiRequest('/memberships?status=Active', { token }).catch(() => ({ members: [] })),
        apiRequest('/training?status=active', { token }).catch(() => ({ students: [] })),
        apiRequest('/dress-rentals/bill-payers/list', { token }).catch(() => ({ billPayers: [] })),
      ]);
      setMembers(membersRes.members || []);
      setStudents(studentsRes.students || []);
      setBillPayers(billPayersRes.billPayers || []);
    } catch (error) {
      console.error('Error fetching members:', error);
      setToast({ type: 'error', message: 'Failed to load members' });
    } finally {
      setMembersLoading(false);
    }
  };

  const fetchExistingBills = async () => {
    try {
      const res = await apiRequest(`/transactions/bills?memberId=${selectedMember.memberId}`, { token });
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

  const getFilteredDresses = () => {
    const available = (allDresses || []).filter((d) => d.status === 'Available');
    if (!dressSearch) return available;
    return available.filter(
      (d) =>
        d.dressNumber?.toLowerCase().includes(dressSearch.toLowerCase()) ||
        d.type?.toLowerCase().includes(dressSearch.toLowerCase())
    );
  };

  const handleSelectDress = (d) => {
    setSelectedDress(d);
    setChargeAmount(d.chargeAmount || 0);
    setStep(2);
  };

  const handleSelectMember = (member) => {
    if (memberType === 'BillPayer') {
      setSelectedMember({
        memberId: member.sessionId,
        memberName: member.name,
        memberPhone: member.phone,
      });
      setIsBillPayerAssignment(true);
      setChargeType('AttachedToExistingBill');
      setSelectedBill({ _id: member.sessionId, name: member.name });
      setChargeAmount(selectedDress?.chargeAmount || 0);
    } else {
      setSelectedMember({
        ...member,
        memberId: member._id,
        memberName: member.name,
        memberPhone: member.phone,
      });
      setIsBillPayerAssignment(false);
      setChargeType('None');
      setSelectedBill(null);
    }
    setStep(needsDressSelection ? 3 : 2);
  };

  const handleNextToConfirm = () => {
    if (chargeType === 'AttachedToExistingBill' && !selectedBill) {
      setToast({ type: 'error', message: 'Please select a bill to attach charge to' });
      return;
    }
    setStep(needsDressSelection ? 4 : 3);
  };

  const handleAssign = async () => {
    if (!selectedMember || !selectedDress) {
      setToast({ type: 'error', message: 'Please complete all selections' });
      return;
    }

    if (chargeType === 'AttachedToExistingBill' && !selectedBill) {
      setToast({ type: 'error', message: 'Please select a bill to attach charge to' });
      return;
    }

    try {
      setLoading(true);
      await apiRequest(`/dress-rentals/${selectedDress._id}/assign`, {
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

      const msg = 'Dress assigned successfully';
      setToast({ type: 'success', message: msg });
      setTimeout(() => onSuccess(), 1000);
    } catch (error) {
      console.error('Error assigning dress:', error);
      setToast({ type: 'error', message: error.message || 'Failed to assign dress' });
    } finally {
      setLoading(false);
    }
  };

  if (!isOpen) return null;

  const stepLabels = needsDressSelection
    ? ['Select Dress', 'Select Member', 'Billing', 'Confirm']
    : ['Select Member', 'Billing', 'Confirm'];

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
      <div className="bg-white rounded-lg shadow-xl max-w-md w-full mx-4">
        {/* Header */}
        <div className="border-b border-gray-200 p-4 flex justify-between items-center">
          <h2 className="text-xl font-bold text-gray-900">👗 Assign Dress</h2>
          <button onClick={onClose} className="text-gray-500 hover:text-gray-700 text-2xl leading-none min-h-[44px] min-w-[44px] flex items-center justify-center">×</button>
        </div>

        {/* Progress Indicator */}
        <div className="flex gap-2 px-6 py-4 border-b border-gray-200">
          {Array.from({ length: totalSteps }, (_, i) => i + 1).map((s) => (
            <div key={s} className={`h-2 flex-1 rounded ${step >= s ? 'bg-primary' : 'bg-gray-200'}`} />
          ))}
        </div>

        {/* Step Labels */}
        <div className="flex px-6 pb-2">
          {stepLabels.map((label, i) => (
            <div key={i} className={`flex-1 text-xs text-center ${step >= i + 1 ? 'text-primary font-medium' : 'text-gray-400'}`}>
              {label}
            </div>
          ))}
        </div>

        {/* Content */}
        <div className="p-6 max-h-[60vh] overflow-y-auto">

          {/* Step 1: Dress Selection (only when no dress pre-selected) */}
          {needsDressSelection && step === 1 && (
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Search Dress</label>
                <input
                  type="text"
                  placeholder="Dress number or type..."
                  value={dressSearch}
                  onChange={(e) => setDressSearch(e.target.value)}
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary outline-none"
                />
              </div>
              <div className="max-h-64 overflow-y-auto border border-gray-200 rounded-lg">
                {getFilteredDresses().length > 0 ? (
                  getFilteredDresses().map((d) => (
                    <button
                      key={d._id}
                      onClick={() => handleSelectDress(d)}
                      className="w-full text-left px-4 py-3 hover:bg-primary/5 border-b border-gray-100 transition-colors"
                    >
                      <div className="font-medium text-gray-900">#{d.dressNumber}</div>
                      <div className="text-sm text-gray-600">{d.type} — ৳{d.chargeAmount || 0}</div>
                    </button>
                  ))
                ) : (
                  <div className="p-4 text-center text-gray-500">No available dresses</div>
                )}
              </div>
            </div>
          )}

          {/* Step 1 or 2: Member Selection */}
          {((needsDressSelection && step === 2) || (!needsDressSelection && step === 1)) && (
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Member Type</label>
                <div className="flex gap-2">
                  {['Member', 'Student', 'BillPayer'].map((type) => (
                    <button
                      key={type}
                      onClick={() => { setMemberType(type); setSelectedMember(null); setMemberSearch(''); setIsBillPayerAssignment(false); }}
                      className={`flex-1 px-3 py-2 rounded-lg font-medium transition-colors text-sm ${memberType === type ? 'bg-primary text-white' : 'bg-gray-100 text-gray-700 hover:bg-gray-200'}`}
                    >
                      {type === 'BillPayer' ? '🏊 Hourly' : type}
                    </button>
                  ))}
                </div>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Search {memberType === 'BillPayer' ? 'Hourly Swimmer' : memberType}
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
                    No {memberType === 'BillPayer' ? 'hourly swimmers' : memberType.toLowerCase() + 's'} found
                  </div>
                )}
              </div>
            </div>
          )}

          {/* Billing Step */}
          {((needsDressSelection && step === 3) || (!needsDressSelection && step === 2)) && (
            <div className="space-y-4">
              <p className="text-sm text-gray-600">
                Dress: <strong>#{selectedDress?.dressNumber}</strong> ({selectedDress?.type})
              </p>
              <p className="text-sm text-gray-600">
                Member: <strong>{selectedMember?.memberName}</strong>
              </p>

              {isBillPayerAssignment && (
                <div className="bg-orange-50 border border-orange-200 rounded-lg p-3">
                  <p className="text-sm text-orange-800">
                    <strong>Active Hourly Swimmer</strong>
                  </p>
                  <p className="text-xs text-orange-700 mt-1">
                    Charge will be automatically attached to their hourly session billing
                  </p>
                </div>
              )}

              {!isBillPayerAssignment && (
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-3">Charge Type</label>
                  <div className="space-y-2">
                    {['None', 'SeparateTransaction', 'AttachedToExistingBill'].map((type) => (
                      <label key={type} className="flex items-center gap-3 cursor-pointer">
                        <input
                          type="radio"
                          name="chargeType"
                          value={type}
                          checked={chargeType === type}
                          onChange={(e) => { setChargeType(e.target.value); if (e.target.value === 'None') setSelectedBill(null); }}
                          className="w-4 h-4"
                        />
                        <span className="text-sm text-gray-700">
                          {type === 'None' && 'No Charge'}
                          {type === 'SeparateTransaction' && 'Create Separate Transaction'}
                          {type === 'AttachedToExistingBill' && 'Add to Existing Bill'}
                        </span>
                      </label>
                    ))}
                  </div>
                </div>
              )}

              {isBillPayerAssignment && (
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">Dress Charge (৳)</label>
                  <input
                    type="number"
                    value={chargeAmount}
                    onChange={(e) => setChargeAmount(parseFloat(e.target.value) || 0)}
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary outline-none"
                  />
                </div>
              )}

              {!isBillPayerAssignment && chargeType !== 'None' && (
                <>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">Charge Amount (৳)</label>
                    <input
                      type="number"
                      value={chargeAmount}
                      onChange={(e) => setChargeAmount(parseFloat(e.target.value) || 0)}
                      className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary outline-none"
                    />
                  </div>
                  {chargeType === 'AttachedToExistingBill' && (
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-2">Select Bill</label>
                      <select
                        value={selectedBill?._id || ''}
                        onChange={(e) => { const bill = existingBills.find((b) => b._id === e.target.value); setSelectedBill(bill); }}
                        className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary outline-none"
                      >
                        <option value="">Select a bill...</option>
                        {existingBills.map((bill) => (
                          <option key={bill._id} value={bill._id}>Bill #{bill.receiptId} - ৳{bill.amount}</option>
                        ))}
                      </select>
                      {existingBills.length === 0 && <p className="text-xs text-gray-500 mt-1">No unpaid bills found</p>}
                    </div>
                  )}
                </>
              )}

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Notes (Optional)</label>
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

          {/* Confirm Step */}
          {((needsDressSelection && step === 4) || (!needsDressSelection && step === 3)) && (
            <div className="space-y-4">
              <p className="text-sm text-gray-600">Dress: <strong>#{selectedDress?.dressNumber}</strong> ({selectedDress?.type})</p>
              <p className="text-sm text-gray-600">Member: <strong>{selectedMember?.memberName}</strong></p>
              <p className="text-sm text-gray-600">Phone: <strong>{selectedMember?.memberPhone}</strong></p>
              <p className="text-sm text-gray-600">Member Type: <strong>{isBillPayerAssignment ? 'Hourly Swimmer' : memberType}</strong></p>
              <div className="border border-gray-200 rounded-lg p-4 bg-gray-50 space-y-2">
                <p className="text-sm text-gray-600">
                  Charge Type: <strong>{isBillPayerAssignment ? 'Attached to Hourly Session' : chargeType === 'None' ? 'No Charge' : chargeType === 'SeparateTransaction' ? 'Separate Transaction' : 'Attached to Existing Bill'}</strong>
                </p>
                {chargeType !== 'None' && <p className="text-sm text-gray-600">Amount: <strong>৳{chargeAmount}</strong></p>}
                {chargeType === 'AttachedToExistingBill' && selectedBill && (
                  <p className="text-sm text-gray-600">Bill: <strong>#{selectedBill.receiptId || selectedBill.name || 'Session'}</strong></p>
                )}
              </div>
              {notes && (
                <div className="border border-gray-200 rounded-lg p-4 bg-gray-50">
                  <p className="text-sm text-gray-600">Notes: <strong>{notes}</strong></p>
                </div>
              )}
            </div>
          )}
        </div>

        {/* Footer Actions */}
        <div className="border-t border-gray-200 p-4 flex gap-3 justify-end">
          <button
            onClick={() => { if (step > 1) setStep(step - 1); else onClose(); }}
            className="px-4 py-2 text-gray-700 border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors"
          >
            {step === 1 ? 'Cancel' : 'Back'}
          </button>

          {needsDressSelection && step === 1 && (
            <button
              onClick={() => { if (!selectedDress) { setToast({ type: 'error', message: 'Please select a dress' }); return; } setStep(2); }}
              className="px-4 py-2 bg-primary text-white rounded-lg hover:bg-primary/90 transition-colors"
            >
              Next
            </button>
          )}

          {((needsDressSelection && step === 2) || (!needsDressSelection && step === 1)) && (
            <button
              onClick={() => {
                if (!selectedMember) { setToast({ type: 'error', message: 'Please select a member' }); return; }
                const nextStep = needsDressSelection ? 3 : 2;
                setStep(nextStep);
                if (!needsDressSelection && !isBillPayerAssignment) fetchExistingBills();
              }}
              className="px-4 py-2 bg-primary text-white rounded-lg hover:bg-primary/90 transition-colors"
            >
              Next
            </button>
          )}

          {((needsDressSelection && step === 3) || (!needsDressSelection && step === 2)) && (
            <button onClick={handleNextToConfirm} className="px-4 py-2 bg-primary text-white rounded-lg hover:bg-primary/90 transition-colors">
              Next
            </button>
          )}

          {((needsDressSelection && step === 4) || (!needsDressSelection && step === 3)) && (
            <button onClick={handleAssign} disabled={loading} className="px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 disabled:bg-gray-400 transition-colors">
              {loading ? 'Assigning...' : 'Assign Dress'}
            </button>
          )}
        </div>
      </div>

      {toast && <Toast type={toast.type} message={toast.message} onClose={() => setToast(null)} />}
    </div>
  );
}
