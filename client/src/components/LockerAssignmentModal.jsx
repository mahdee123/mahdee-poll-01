import React, { useState, useEffect } from 'react';
import { Waves } from 'lucide-react';
import { apiRequest } from '../api';
import Toast from './Toast';
import Modal from './Modal';
import Button from './Button';

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
        apiRequest('/memberships?status=Active', { token }).catch(() => ({ members: [] })),
        apiRequest('/training?status=active', { token }).catch(() => ({ students: [] })),
        apiRequest('/lockers/bill-payers/list', { token }).catch(() => ({ billPayers: [] })),
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

  const updateAvailableLockers = () => {
    const available = allLockers.filter((l) => l.status === 'Available');
    setAvailableLockers(available);
  };

  const fetchSettings = async () => {
    try {
      const res = await apiRequest('/lockers/settings', { token });
      setSettings(res.settings);
      setChargeAmount(res.settings.chargeAmount || 0);
    } catch (error) {
      console.error('Error fetching settings:', error);
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
      setToast({ type: 'error', message: 'Please select a locker' });
      return;
    }
    setStep(3);
  };

  const handleAssign = async () => {
    if (!selectedMember || !selectedLocker) {
      setToast({ type: 'error', message: 'Please complete all selections' });
      return;
    }

    if (chargeType === 'AttachedToExistingBill' && !selectedBill) {
      setToast({ type: 'error', message: 'Please select a bill to attach charge to' });
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

      setToast({ type: 'success', message: 'Locker assigned successfully' });
      setTimeout(() => onSuccess(), 1000);
    } catch (error) {
      console.error('Error assigning locker:', error);
      setToast({ type: 'error', message: error.message || 'Failed to assign locker' });
    } finally {
      setLoading(false);
    }
  };

  return (
    <>
      <Modal
        isOpen
        onClose={onClose}
        title="Assign locker"
        size="sm"
        footer={
          <>
            <Button variant="secondary" onClick={() => (step > 1 ? setStep(step - 1) : onClose())}>
              {step === 1 ? 'Cancel' : 'Back'}
            </Button>
            {step < 3 && (
              <Button onClick={step === 2 ? handleSelectLocker : () => setStep(step + 1)}>Next</Button>
            )}
            {step === 3 && (
              <Button variant="primary" className="!bg-success hover:!bg-success/90" onClick={handleAssign} loading={loading}>
                Assign locker
              </Button>
            )}
          </>
        }
      >
        {/* Progress Indicator */}
        <div className="flex gap-2 mb-6 -mt-1">
          {[1, 2, 3].map((s) => (
            <div key={s} className={`h-1.5 flex-1 rounded-full ${step >= s ? 'bg-primary' : 'bg-line'}`} />
          ))}
        </div>

        {/* Step 1: Member Selection */}
        {step === 1 && (
          <div className="space-y-4">
            <div>
              <label className="label">Member type</label>
              <div className="segmented w-full">
                {['Member', 'Student', 'BillPayer'].map((type) => (
                  <button
                    key={type}
                    onClick={() => { setMemberType(type); setSelectedMember(null); setMemberSearch(''); }}
                    className={`flex-1 flex items-center justify-center gap-1 ${memberType === type ? 'segmented-item-active' : 'segmented-item'}`}
                  >
                    {type === 'BillPayer' && <Waves size={13} />} {type === 'BillPayer' ? 'Hourly swimmer' : type}
                  </button>
                ))}
              </div>
            </div>

            <div>
              <label className="label">Search {memberType === 'BillPayer' ? 'active swimmers' : memberType.toLowerCase()}</label>
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
                  No {memberType === 'BillPayer' ? 'active swimmers' : 'members'} found
                </div>
              )}
            </div>
          </div>
        )}

        {/* Step 2: Locker Selection */}
        {step === 2 && (
          <div className="space-y-4">
            <p className="text-sm text-ink-soft">
              Selected member: <strong className="text-ink">{selectedMember?.memberName}</strong>
            </p>

            <div>
              <label className="label">Select available locker</label>
              <div className="max-h-64 overflow-y-auto border border-line rounded-card divide-y divide-line">
                {availableLockers.length > 0 ? (
                  availableLockers.map((loc) => (
                    <button
                      key={loc._id}
                      onClick={() => setSelectedLocker(loc)}
                      className={`w-full text-left px-4 py-3 transition-colors ${
                        selectedLocker?._id === loc._id
                          ? 'bg-primary-50 border-l-4 border-l-primary'
                          : 'hover:bg-canvas'
                      }`}
                    >
                      <div className="font-medium text-ink">{loc.lockerNumber}</div>
                    </button>
                  ))
                ) : (
                  <div className="p-4 text-center text-sm text-ink-soft">No available lockers</div>
                )}
              </div>
            </div>
          </div>
        )}

        {/* Step 3: Billing */}
        {step === 3 && (
          <div className="space-y-4">
            <p className="text-sm text-ink-soft">
              Locker: <strong className="text-ink">{selectedLocker?.lockerNumber}</strong>
            </p>
            <p className="text-sm text-ink-soft">
              {isBillPayerAssignment ? 'Bill payer:' : 'Member:'} <strong className="text-ink">{selectedMember?.memberName}</strong>
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

            {!isBillPayerAssignment && settings && settings.pricingMode !== 'Free' && (
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
                        onChange={(e) => setChargeType(e.target.value)}
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
                      onChange={(e) => {
                        const bill = existingBills.find((b) => b._id === e.target.value);
                        setSelectedBill(bill);
                      }}
                      className="select"
                    >
                      <option value="">Select a bill…</option>
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
                <label className="label">Locker charge (৳)</label>
                <input
                  type="number"
                  value={chargeAmount}
                  onChange={(e) => setChargeAmount(parseFloat(e.target.value) || 0)}
                  className="input"
                />
              </div>
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
      </Modal>

      {toast && <Toast type={toast.type} message={toast.message} onClose={() => setToast(null)} />}
    </>
  );
}
