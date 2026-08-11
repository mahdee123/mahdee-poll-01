import React, { useState, useEffect } from 'react';
import { Waves } from 'lucide-react';
import { apiRequest } from '../api';
import Toast from './Toast';
import Modal from './Modal';
import Button from './Button';

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

      setToast({ type: 'success', message: 'Dress assigned successfully' });
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
    <>
      <Modal
        isOpen
        onClose={onClose}
        title="Assign dress"
        size="sm"
        footer={
          <>
            <Button variant="secondary" onClick={() => { if (step > 1) setStep(step - 1); else onClose(); }}>
              {step === 1 ? 'Cancel' : 'Back'}
            </Button>

            {needsDressSelection && step === 1 && (
              <Button onClick={() => { if (!selectedDress) { setToast({ type: 'error', message: 'Please select a dress' }); return; } setStep(2); }}>
                Next
              </Button>
            )}

            {((needsDressSelection && step === 2) || (!needsDressSelection && step === 1)) && (
              <Button
                onClick={() => {
                  if (!selectedMember) { setToast({ type: 'error', message: 'Please select a member' }); return; }
                  const nextStep = needsDressSelection ? 3 : 2;
                  setStep(nextStep);
                  if (!needsDressSelection && !isBillPayerAssignment) fetchExistingBills();
                }}
              >
                Next
              </Button>
            )}

            {((needsDressSelection && step === 3) || (!needsDressSelection && step === 2)) && (
              <Button onClick={handleNextToConfirm}>Next</Button>
            )}

            {((needsDressSelection && step === 4) || (!needsDressSelection && step === 3)) && (
              <Button variant="primary" className="!bg-success hover:!bg-success/90" onClick={handleAssign} loading={loading}>
                Assign dress
              </Button>
            )}
          </>
        }
      >
        {/* Progress Indicator */}
        <div className="flex gap-2 mb-1.5 -mt-1">
          {Array.from({ length: totalSteps }, (_, i) => i + 1).map((s) => (
            <div key={s} className={`h-1.5 flex-1 rounded-full ${step >= s ? 'bg-primary' : 'bg-line'}`} />
          ))}
        </div>

        {/* Step Labels */}
        <div className="flex mb-5">
          {stepLabels.map((label, i) => (
            <div key={i} className={`flex-1 text-xs text-center ${step >= i + 1 ? 'text-primary font-medium' : 'text-ink-faint'}`}>
              {label}
            </div>
          ))}
        </div>

        {/* Step 1: Dress Selection (only when no dress pre-selected) */}
        {needsDressSelection && step === 1 && (
          <div className="space-y-4">
            <div>
              <label className="label">Search dress</label>
              <input
                type="text"
                placeholder="Dress number or type…"
                value={dressSearch}
                onChange={(e) => setDressSearch(e.target.value)}
                className="input"
              />
            </div>
            <div className="max-h-64 overflow-y-auto border border-line rounded-card divide-y divide-line">
              {getFilteredDresses().length > 0 ? (
                getFilteredDresses().map((d) => (
                  <button
                    key={d._id}
                    onClick={() => handleSelectDress(d)}
                    className="w-full text-left px-4 py-3 hover:bg-primary-50 transition-colors"
                  >
                    <div className="font-medium text-ink">#{d.dressNumber}</div>
                    <div className="text-sm text-ink-soft">{d.type} — ৳{d.chargeAmount || 0}</div>
                  </button>
                ))
              ) : (
                <div className="p-4 text-center text-sm text-ink-soft">No available dresses</div>
              )}
            </div>
          </div>
        )}

        {/* Step 1 or 2: Member Selection */}
        {((needsDressSelection && step === 2) || (!needsDressSelection && step === 1)) && (
          <div className="space-y-4">
            <div>
              <label className="label">Member type</label>
              <div className="segmented w-full">
                {['Member', 'Student', 'BillPayer'].map((type) => (
                  <button
                    key={type}
                    onClick={() => { setMemberType(type); setSelectedMember(null); setMemberSearch(''); setIsBillPayerAssignment(false); }}
                    className={`flex-1 flex items-center justify-center gap-1 ${memberType === type ? 'segmented-item-active' : 'segmented-item'}`}
                  >
                    {type === 'BillPayer' && <Waves size={13} />} {type === 'BillPayer' ? 'Hourly' : type}
                  </button>
                ))}
              </div>
            </div>
            <div>
              <label className="label">Search {memberType === 'BillPayer' ? 'hourly swimmer' : memberType.toLowerCase()}</label>
              <input
                type="text"
                placeholder="Name or phone…"
                value={memberSearch}
                onChange={(e) => setMemberSearch(e.target.value)}
                className="input"
              />
            </div>
            <div className="max-h-64 overflow-y-auto border border-line rounded-card divide-y divide-line">
              {membersLoading ? (
                <div className="p-4 text-center text-sm text-ink-soft">Loading…</div>
              ) : getFilteredMembers().length > 0 ? (
                getFilteredMembers().map((member) => (
                  <button
                    key={memberType === 'BillPayer' ? member.sessionId : member._id}
                    onClick={() => handleSelectMember(member)}
                    className="w-full text-left px-4 py-3 hover:bg-primary-50 transition-colors"
                  >
                    <div className="font-medium text-ink">{member.name}</div>
                    <div className="text-sm text-ink-soft">{member.phone}</div>
                  </button>
                ))
              ) : (
                <div className="p-4 text-center text-sm text-ink-soft">
                  No {memberType === 'BillPayer' ? 'hourly swimmers' : memberType.toLowerCase() + 's'} found
                </div>
              )}
            </div>
          </div>
        )}

        {/* Billing Step */}
        {((needsDressSelection && step === 3) || (!needsDressSelection && step === 2)) && (
          <div className="space-y-4">
            <p className="text-sm text-ink-soft">
              Dress: <strong className="text-ink">#{selectedDress?.dressNumber}</strong> ({selectedDress?.type})
            </p>
            <p className="text-sm text-ink-soft">
              Member: <strong className="text-ink">{selectedMember?.memberName}</strong>
            </p>

            {isBillPayerAssignment && (
              <div className="flex items-start gap-2 bg-warning-soft border border-warning/20 rounded-card p-3">
                <Waves size={15} className="text-warning-ink flex-shrink-0 mt-0.5" />
                <div>
                  <p className="text-sm font-semibold text-warning-ink">Active hourly swimmer</p>
                  <p className="text-xs text-warning-ink mt-0.5">
                    Charge will be automatically attached to their hourly session billing.
                  </p>
                </div>
              </div>
            )}

            {!isBillPayerAssignment && (
              <div>
                <label className="label">Charge type</label>
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
                      <span className="text-sm text-ink">
                        {type === 'None' && 'No charge'}
                        {type === 'SeparateTransaction' && 'Create separate transaction'}
                        {type === 'AttachedToExistingBill' && 'Add to existing bill'}
                      </span>
                    </label>
                  ))}
                </div>
              </div>
            )}

            {isBillPayerAssignment && (
              <div>
                <label className="label">Dress charge (৳)</label>
                <input
                  type="number"
                  value={chargeAmount}
                  onChange={(e) => setChargeAmount(parseFloat(e.target.value) || 0)}
                  className="input"
                />
              </div>
            )}

            {!isBillPayerAssignment && chargeType !== 'None' && (
              <>
                <div>
                  <label className="label">Charge amount (৳)</label>
                  <input
                    type="number"
                    value={chargeAmount}
                    onChange={(e) => setChargeAmount(parseFloat(e.target.value) || 0)}
                    className="input"
                  />
                </div>
                {chargeType === 'AttachedToExistingBill' && (
                  <div>
                    <label className="label">Select bill</label>
                    <select
                      value={selectedBill?._id || ''}
                      onChange={(e) => { const bill = existingBills.find((b) => b._id === e.target.value); setSelectedBill(bill); }}
                      className="select"
                    >
                      <option value="">Select a bill…</option>
                      {existingBills.map((bill) => (
                        <option key={bill._id} value={bill._id}>Bill #{bill.receiptId} - ৳{bill.amount}</option>
                      ))}
                    </select>
                    {existingBills.length === 0 && <p className="field-hint">No unpaid bills found</p>}
                  </div>
                )}
              </>
            )}

            <div>
              <label className="label">Notes (optional)</label>
              <textarea
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                placeholder="Add any notes…"
                rows="3"
                className="textarea"
              />
            </div>
          </div>
        )}

        {/* Confirm Step */}
        {((needsDressSelection && step === 4) || (!needsDressSelection && step === 3)) && (
          <div className="space-y-4">
            <p className="text-sm text-ink-soft">Dress: <strong className="text-ink">#{selectedDress?.dressNumber}</strong> ({selectedDress?.type})</p>
            <p className="text-sm text-ink-soft">Member: <strong className="text-ink">{selectedMember?.memberName}</strong></p>
            <p className="text-sm text-ink-soft">Phone: <strong className="text-ink">{selectedMember?.memberPhone}</strong></p>
            <p className="text-sm text-ink-soft">Member type: <strong className="text-ink">{isBillPayerAssignment ? 'Hourly Swimmer' : memberType}</strong></p>
            <div className="border border-line rounded-card p-4 bg-canvas space-y-2">
              <p className="text-sm text-ink-soft">
                Charge type: <strong className="text-ink">{isBillPayerAssignment ? 'Attached to Hourly Session' : chargeType === 'None' ? 'No Charge' : chargeType === 'SeparateTransaction' ? 'Separate Transaction' : 'Attached to Existing Bill'}</strong>
              </p>
              {chargeType !== 'None' && <p className="text-sm text-ink-soft">Amount: <strong className="text-ink tabular">৳{chargeAmount}</strong></p>}
              {chargeType === 'AttachedToExistingBill' && selectedBill && (
                <p className="text-sm text-ink-soft">Bill: <strong className="text-ink">#{selectedBill.receiptId || selectedBill.name || 'Session'}</strong></p>
              )}
            </div>
            {notes && (
              <div className="border border-line rounded-card p-4 bg-canvas">
                <p className="text-sm text-ink-soft">Notes: <strong className="text-ink">{notes}</strong></p>
              </div>
            )}
          </div>
        )}
      </Modal>

      {toast && <Toast type={toast.type} message={toast.message} onClose={() => setToast(null)} />}
    </>
  );
}
