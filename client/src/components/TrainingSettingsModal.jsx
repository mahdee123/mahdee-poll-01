import React, { useState, useEffect } from 'react';
import { apiRequest } from '../api';
import Toast from './Toast';

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

  const tabs = [
    { key: 'ageGroups', label: 'Age Groups' },
    { key: 'batches', label: 'Batches' },
    { key: 'classSlots', label: 'Class Slots' },
    { key: 'general', label: 'General' },
  ];

  if (loading) {
    return (
      <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
        <div className="bg-white rounded-lg shadow-xl max-w-2xl w-full mx-4 p-6">
          <div className="text-center text-gray-500">Loading settings...</div>
        </div>
      </div>
    );
  }

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
      <div className="bg-white rounded-lg shadow-xl max-w-3xl w-full mx-4 max-h-[90vh] flex flex-col">
        {/* Header */}
        <div className="border-b border-gray-200 p-4 flex justify-between items-center">
          <h2 className="text-xl font-bold text-gray-900">⚙️ Training Settings</h2>
          <button onClick={onClose} className="text-gray-500 hover:text-gray-700 text-2xl leading-none">×</button>
        </div>

        {/* Tabs */}
        <div className="border-b border-gray-200 px-4 flex gap-1">
          {tabs.map((tab) => (
            <button
              key={tab.key}
              onClick={() => setActiveTab(tab.key)}
              className={`px-4 py-3 text-sm font-medium border-b-2 transition-colors ${
                activeTab === tab.key
                  ? 'border-primary text-primary'
                  : 'border-transparent text-gray-500 hover:text-gray-700'
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>

        {/* Content */}
        <div className="p-6 overflow-y-auto flex-1">
          {/* Age Groups Tab */}
          {activeTab === 'ageGroups' && (
            <div className="space-y-4">
              <p className="text-sm text-gray-500">Configure age groups with per-batch pricing and class counts.</p>
              {ageGroups.map((ag, i) => (
                <div key={i} className="border border-gray-200 rounded-lg p-4 space-y-3">
                  <div className="flex items-center justify-between">
                    <input
                      type="text"
                      value={ag.label}
                      onChange={(e) => updateAgeGroup(i, 'label', e.target.value)}
                      placeholder="Age group label (e.g. 4-8)"
                      className="px-3 py-1.5 border border-gray-300 rounded-lg text-sm font-medium w-32"
                    />
                    <button onClick={() => removeAgeGroup(i)} className="text-red-500 hover:text-red-700 text-sm">Remove</button>
                  </div>
                  <div className="grid grid-cols-2 gap-4">
                    {batches.map((batch) => (
                      <div key={batch.name} className="bg-gray-50 rounded-lg p-3 space-y-2">
                        <div className="text-xs font-medium text-gray-500 uppercase">{batch.name}</div>
                        <div>
                          <label className="text-xs text-gray-600">Classes</label>
                          <input
                            type="number"
                            value={ag.classes[batch.name] || 0}
                            onChange={(e) => updateAgeGroupNested(i, 'classes', batch.name, e.target.value)}
                            className="w-full px-2 py-1 border border-gray-300 rounded text-sm"
                          />
                        </div>
                        <div>
                          <label className="text-xs text-gray-600">Price (৳)</label>
                          <input
                            type="number"
                            value={ag.pricing[batch.name] || 0}
                            onChange={(e) => updateAgeGroupNested(i, 'pricing', batch.name, e.target.value)}
                            className="w-full px-2 py-1 border border-gray-300 rounded text-sm"
                          />
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              ))}
              <button onClick={addAgeGroup} className="px-3 py-1.5 text-sm text-primary border border-primary/30 rounded-lg hover:bg-primary/5">
                + Add Age Group
              </button>
            </div>
          )}

          {/* Batches Tab */}
          {activeTab === 'batches' && (
            <div className="space-y-4">
              <p className="text-sm text-gray-500">Configure batch types and their duration in days.</p>
              {batches.map((batch, i) => (
                <div key={i} className="flex items-center gap-3 border border-gray-200 rounded-lg p-4">
                  <input
                    type="text"
                    value={batch.name}
                    onChange={(e) => updateBatch(i, 'name', e.target.value)}
                    placeholder="Batch name"
                    className="flex-1 px-3 py-1.5 border border-gray-300 rounded-lg text-sm"
                  />
                  <div className="flex items-center gap-1">
                    <input
                      type="number"
                      value={batch.days}
                      onChange={(e) => updateBatch(i, 'days', e.target.value)}
                      className="w-20 px-2 py-1.5 border border-gray-300 rounded-lg text-sm"
                    />
                    <span className="text-sm text-gray-500">days</span>
                  </div>
                  <button onClick={() => removeBatch(i)} className="text-red-500 hover:text-red-700 text-sm">Remove</button>
                </div>
              ))}
              <button onClick={addBatch} className="px-3 py-1.5 text-sm text-primary border border-primary/30 rounded-lg hover:bg-primary/5">
                + Add Batch
              </button>
            </div>
          )}

          {/* Class Slots Tab */}
          {activeTab === 'classSlots' && (
            <div className="space-y-4">
              <p className="text-sm text-gray-500">Configure class time slots. Slots 1-2 are Morning, 3+ are Evening.</p>
              {classSlots.map((slot, i) => (
                <div key={i} className="flex items-center gap-3 border border-gray-200 rounded-lg p-4">
                  <input
                    type="text"
                    value={slot.label}
                    onChange={(e) => updateClassSlot(i, 'label', e.target.value)}
                    placeholder="Label"
                    className="w-28 px-2 py-1.5 border border-gray-300 rounded-lg text-sm"
                  />
                  <input
                    type="text"
                    value={slot.startTime}
                    onChange={(e) => updateClassSlot(i, 'startTime', e.target.value)}
                    placeholder="Start (e.g. 08:00 AM)"
                    className="w-36 px-2 py-1.5 border border-gray-300 rounded-lg text-sm"
                  />
                  <input
                    type="text"
                    value={slot.endTime}
                    onChange={(e) => updateClassSlot(i, 'endTime', e.target.value)}
                    placeholder="End (e.g. 09:00 AM)"
                    className="w-36 px-2 py-1.5 border border-gray-300 rounded-lg text-sm"
                  />
                  <select
                    value={slot.period}
                    onChange={(e) => updateClassSlot(i, 'period', e.target.value)}
                    className="px-2 py-1.5 border border-gray-300 rounded-lg text-sm"
                  >
                    <option value="Morning">Morning</option>
                    <option value="Evening">Evening</option>
                  </select>
                  <button onClick={() => removeClassSlot(i)} className="text-red-500 hover:text-red-700 text-sm">Remove</button>
                </div>
              ))}
              <button onClick={addClassSlot} className="px-3 py-1.5 text-sm text-primary border border-primary/30 rounded-lg hover:bg-primary/5">
                + Add Class Slot
              </button>
            </div>
          )}

          {/* General Tab */}
          {activeTab === 'general' && (
            <div className="space-y-6">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Slot Capacity (max students per class)</label>
                <input
                  type="number"
                  value={slotLimit}
                  onChange={(e) => setSlotLimit(Number(e.target.value) || 1)}
                  min="1"
                  className="w-32 px-3 py-2 border border-gray-300 rounded-lg text-sm"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Max Makeup Classes per Student</label>
                <input
                  type="number"
                  value={maxMakeupClasses}
                  onChange={(e) => setMaxMakeupClasses(Number(e.target.value) || 0)}
                  min="0"
                  className="w-32 px-3 py-2 border border-gray-300 rounded-lg text-sm"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Payment Methods</label>
                <div className="flex gap-3">
                  {['Cash', 'Bank', 'bKash'].map((method) => (
                    <label key={method} className="flex items-center gap-2 cursor-pointer">
                      <input
                        type="checkbox"
                        checked={paymentMethods.includes(method)}
                        onChange={() => togglePaymentMethod(method)}
                        className="w-4 h-4 rounded"
                      />
                      <span className="text-sm text-gray-700">{method}</span>
                    </label>
                  ))}
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="border-t border-gray-200 p-4 flex gap-3 justify-end">
          <button
            onClick={onClose}
            className="px-4 py-2 text-gray-700 border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors"
          >
            Cancel
          </button>
          <button
            onClick={handleSave}
            disabled={saving}
            className="px-4 py-2 bg-primary text-white rounded-lg hover:bg-primary/90 disabled:bg-gray-400 transition-colors"
          >
            {saving ? 'Saving...' : 'Save Settings'}
          </button>
        </div>
      </div>

      {toast && <Toast type={toast.type} message={toast.message} onClose={() => setToast(null)} />}
    </div>
  );
}
