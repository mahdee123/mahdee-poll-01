import React, { useState, useEffect } from 'react';
import { Plus, Trash2 } from 'lucide-react';
import { apiRequest } from '../api';
import Toast from './Toast';
import Modal from './Modal';
import Button from './Button';

const TABS = [
  { key: 'ageGroups', label: 'Age Groups' },
  { key: 'batches', label: 'Batches' },
  { key: 'classSlots', label: 'Class Slots' },
  { key: 'general', label: 'General' },
];

export default function TrainingSettingsModal({ token, onClose, onSuccess }) {
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [toast, setToast] = useState(null);
  const [activeTab, setActiveTab] = useState('ageGroups');

  const [ageGroups, setAgeGroups] = useState([]);
  const [batches, setBatches] = useState([]);
  const [classSlots, setClassSlots] = useState([]);
  const [slotLimit, setSlotLimit] = useState(15);
  const [maxMakeupClasses, setMaxMakeupClasses] = useState(2);
  const [paymentMethods, setPaymentMethods] = useState([]);

  useEffect(() => {
    fetchSettings();
  }, []);

  const fetchSettings = async () => {
    try {
      setLoading(true);
      const res = await apiRequest('/training/settings', { token });
      const s = res.settings;
      setAgeGroups(s.ageGroups || []);
      setBatches(s.batches || []);
      setClassSlots(s.classSlots || []);
      setSlotLimit(s.slotLimit || 15);
      setMaxMakeupClasses(s.maxMakeupClasses ?? 2);
      setPaymentMethods(s.paymentMethods || []);
    } catch (error) {
      console.error('Error fetching settings:', error);
      setToast({ type: 'error', message: 'Failed to load settings' });
    } finally {
      setLoading(false);
    }
  };

  const handleSave = async () => {
    try {
      setSaving(true);
      await apiRequest('/training/settings', {
        method: 'POST',
        token,
        body: { ageGroups, batches, classSlots, slotLimit, maxMakeupClasses, paymentMethods },
      });
      setToast({ type: 'success', message: 'Settings saved successfully' });
      setTimeout(() => onSuccess(), 1000);
    } catch (error) {
      console.error('Error saving settings:', error);
      setToast({ type: 'error', message: error.message || 'Failed to save settings' });
    } finally {
      setSaving(false);
    }
  };

  // Age Groups helpers
  const addAgeGroup = () => {
    setAgeGroups([...ageGroups, { label: '', classes: { Regular: 12, Weekend: 12 }, pricing: { Regular: 9000, Weekend: 11000 } }]);
  };
  const updateAgeGroup = (index, field, value) => {
    const updated = [...ageGroups];
    updated[index] = { ...updated[index], [field]: value };
    setAgeGroups(updated);
  };
  const updateAgeGroupNested = (index, group, field, value) => {
    const updated = [...ageGroups];
    updated[index] = { ...updated[index], [group]: { ...updated[index][group], [field]: Number(value) || 0 } };
    setAgeGroups(updated);
  };
  const removeAgeGroup = (index) => {
    setAgeGroups(ageGroups.filter((_, i) => i !== index));
  };

  // Batch helpers
  const addBatch = () => {
    setBatches([...batches, { name: '', days: 30 }]);
  };
  const updateBatch = (index, field, value) => {
    const updated = [...batches];
    updated[index] = { ...updated[index], [field]: field === 'days' ? Number(value) || 0 : value };
    setBatches(updated);
  };
  const removeBatch = (index) => {
    setBatches(batches.filter((_, i) => i !== index));
  };

  // Class Slot helpers
  const addClassSlot = () => {
    const nextId = classSlots.length > 0 ? Math.max(...classSlots.map((s) => s.id)) + 1 : 1;
    setClassSlots([...classSlots, { id: nextId, label: `Class ${String(nextId).padStart(2, '0')}`, startTime: '', endTime: '', period: 'Morning' }]);
  };
  const updateClassSlot = (index, field, value) => {
    const updated = [...classSlots];
    updated[index] = { ...updated[index], [field]: value };
    setClassSlots(updated);
  };
  const removeClassSlot = (index) => {
    setClassSlots(classSlots.filter((_, i) => i !== index));
  };

  // Payment methods
  const togglePaymentMethod = (method) => {
    if (paymentMethods.includes(method)) {
      setPaymentMethods(paymentMethods.filter((m) => m !== method));
    } else {
      setPaymentMethods([...paymentMethods, method]);
    }
  };

  return (
    <>
      <Modal
        isOpen
        onClose={onClose}
        title="Training settings"
        size="lg"
        footer={
          <>
            <Button variant="secondary" onClick={onClose}>Cancel</Button>
            <Button onClick={handleSave} loading={saving}>Save settings</Button>
          </>
        }
      >
        {loading ? (
          <div className="text-center text-sm text-ink-soft py-8">Loading settings…</div>
        ) : (
          <>
            {/* Tabs */}
            <div className="segmented mb-6 flex-wrap">
              {TABS.map((tab) => (
                <button
                  key={tab.key}
                  onClick={() => setActiveTab(tab.key)}
                  className={activeTab === tab.key ? 'segmented-item-active' : 'segmented-item'}
                >
                  {tab.label}
                </button>
              ))}
            </div>

            {/* Age Groups Tab */}
            {activeTab === 'ageGroups' && (
              <div className="space-y-4">
                <p className="text-sm text-ink-soft">Configure age groups with per-batch pricing and class counts.</p>
                {ageGroups.map((ag, i) => (
                  <div key={i} className="border border-line rounded-card p-4 space-y-3">
                    <div className="flex items-center justify-between gap-3">
                      <input
                        type="text"
                        value={ag.label}
                        onChange={(e) => updateAgeGroup(i, 'label', e.target.value)}
                        placeholder="Age group label (e.g. 4-8)"
                        className="input w-40 font-medium"
                      />
                      <button onClick={() => removeAgeGroup(i)} className="w-8 h-8 flex items-center justify-center rounded-control text-danger hover:bg-danger-soft flex-shrink-0" aria-label="Remove age group">
                        <Trash2 size={15} />
                      </button>
                    </div>
                    <div className="grid grid-cols-2 gap-4">
                      {batches.map((batch) => (
                        <div key={batch.name} className="bg-canvas rounded-card p-3 space-y-2">
                          <div className="text-xs font-medium text-ink-soft uppercase">{batch.name}</div>
                          <div>
                            <label className="text-xs text-ink-soft">Classes</label>
                            <input
                              type="number"
                              value={ag.classes[batch.name] || 0}
                              onChange={(e) => updateAgeGroupNested(i, 'classes', batch.name, e.target.value)}
                              className="input py-1"
                            />
                          </div>
                          <div>
                            <label className="text-xs text-ink-soft">Price (৳)</label>
                            <input
                              type="number"
                              value={ag.pricing[batch.name] || 0}
                              onChange={(e) => updateAgeGroupNested(i, 'pricing', batch.name, e.target.value)}
                              className="input py-1"
                            />
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                ))}
                <Button variant="secondary" size="sm" icon={Plus} onClick={addAgeGroup}>Add age group</Button>
              </div>
            )}

            {/* Batches Tab */}
            {activeTab === 'batches' && (
              <div className="space-y-4">
                <p className="text-sm text-ink-soft">Configure batch types and their duration in days.</p>
                {batches.map((batch, i) => (
                  <div key={i} className="flex items-center gap-3 border border-line rounded-card p-4">
                    <input
                      type="text"
                      value={batch.name}
                      onChange={(e) => updateBatch(i, 'name', e.target.value)}
                      placeholder="Batch name"
                      className="input flex-1"
                    />
                    <div className="flex items-center gap-1.5">
                      <input
                        type="number"
                        value={batch.days}
                        onChange={(e) => updateBatch(i, 'days', e.target.value)}
                        className="input w-20"
                      />
                      <span className="text-sm text-ink-soft">days</span>
                    </div>
                    <button onClick={() => removeBatch(i)} className="w-9 h-9 flex items-center justify-center rounded-control text-danger hover:bg-danger-soft flex-shrink-0" aria-label="Remove batch">
                      <Trash2 size={15} />
                    </button>
                  </div>
                ))}
                <Button variant="secondary" size="sm" icon={Plus} onClick={addBatch}>Add batch</Button>
              </div>
            )}

            {/* Class Slots Tab */}
            {activeTab === 'classSlots' && (
              <div className="space-y-4">
                <p className="text-sm text-ink-soft">Configure class time slots. Slots 1-2 are Morning, 3+ are Evening.</p>
                {classSlots.map((slot, i) => (
                  <div key={i} className="flex flex-wrap items-center gap-3 border border-line rounded-card p-4">
                    <input
                      type="text"
                      value={slot.label}
                      onChange={(e) => updateClassSlot(i, 'label', e.target.value)}
                      placeholder="Label"
                      className="input w-28"
                    />
                    <input
                      type="text"
                      value={slot.startTime}
                      onChange={(e) => updateClassSlot(i, 'startTime', e.target.value)}
                      placeholder="Start (e.g. 08:00 AM)"
                      className="input w-36"
                    />
                    <input
                      type="text"
                      value={slot.endTime}
                      onChange={(e) => updateClassSlot(i, 'endTime', e.target.value)}
                      placeholder="End (e.g. 09:00 AM)"
                      className="input w-36"
                    />
                    <select
                      value={slot.period}
                      onChange={(e) => updateClassSlot(i, 'period', e.target.value)}
                      className="select w-auto"
                    >
                      <option value="Morning">Morning</option>
                      <option value="Evening">Evening</option>
                    </select>
                    <button onClick={() => removeClassSlot(i)} className="w-9 h-9 flex items-center justify-center rounded-control text-danger hover:bg-danger-soft flex-shrink-0 ml-auto" aria-label="Remove class slot">
                      <Trash2 size={15} />
                    </button>
                  </div>
                ))}
                <Button variant="secondary" size="sm" icon={Plus} onClick={addClassSlot}>Add class slot</Button>
              </div>
            )}

            {/* General Tab */}
            {activeTab === 'general' && (
              <div className="space-y-6">
                <div>
                  <label className="label">Slot capacity (max students per class)</label>
                  <input
                    type="number"
                    value={slotLimit}
                    onChange={(e) => setSlotLimit(Number(e.target.value) || 1)}
                    min="1"
                    className="input w-32"
                  />
                </div>
                <div>
                  <label className="label">Max makeup classes per student</label>
                  <input
                    type="number"
                    value={maxMakeupClasses}
                    onChange={(e) => setMaxMakeupClasses(Number(e.target.value) || 0)}
                    min="0"
                    className="input w-32"
                  />
                </div>
                <div>
                  <label className="label">Payment methods</label>
                  <div className="flex gap-4">
                    {['Cash', 'Bank', 'bKash'].map((method) => (
                      <label key={method} className="flex items-center gap-2 cursor-pointer">
                        <input
                          type="checkbox"
                          checked={paymentMethods.includes(method)}
                          onChange={() => togglePaymentMethod(method)}
                          className="w-4 h-4 rounded"
                        />
                        <span className="text-sm text-ink">{method}</span>
                      </label>
                    ))}
                  </div>
                </div>
              </div>
            )}
          </>
        )}
      </Modal>

      {toast && <Toast type={toast.type} message={toast.message} onClose={() => setToast(null)} />}
    </>
  );
}
