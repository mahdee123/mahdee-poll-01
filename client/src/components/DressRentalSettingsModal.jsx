import React, { useState, useEffect } from 'react';
import { Plus, X } from 'lucide-react';
import { apiRequest } from '../api';
import Toast from './Toast';
import Modal from './Modal';
import Button from './Button';

export default function DressRentalSettingsModal({ isOpen, token, onClose, onSuccess }) {
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [toast, setToast] = useState(null);
  const [settings, setSettings] = useState({
    dressTypes: [],
    autoNumbering: true,
    prefix: 'Dress',
  });

  useEffect(() => {
    if (isOpen) {
      fetchSettings();
    }
  }, [isOpen]);

  const fetchSettings = async () => {
    try {
      setLoading(true);
      const response = await apiRequest('/dress-rentals/settings', { token });
      const s = response.settings || {};
      setSettings({
        dressTypes: s.dressTypes || [],
        autoNumbering: s.autoNumbering !== undefined ? s.autoNumbering : true,
        prefix: s.prefix || 'Dress',
      });
    } catch (error) {
      console.error('Error fetching dress rental settings:', error);
      setToast({ type: 'error', message: 'Failed to load dress rental settings' });
    } finally {
      setLoading(false);
    }
  };

  const addDressType = () => {
    setSettings((prev) => ({
      ...prev,
      dressTypes: [...prev.dressTypes, { name: '', chargeAmount: 0, count: 1 }],
    }));
  };

  const removeDressType = (index) => {
    setSettings((prev) => ({
      ...prev,
      dressTypes: prev.dressTypes.filter((_, i) => i !== index),
    }));
  };

  const updateDressType = (index, field, value) => {
    setSettings((prev) => {
      const updated = [...prev.dressTypes];
      updated[index] = { ...updated[index], [field]: value };
      return { ...prev, dressTypes: updated };
    });
  };

  const handleSave = async () => {
    if (settings.dressTypes.length === 0) {
      setToast({ type: 'error', message: 'Please add at least one dress type' });
      return;
    }

    const hasEmpty = settings.dressTypes.some((dt) => !dt.name.trim());
    if (hasEmpty) {
      setToast({ type: 'error', message: 'Please fill in all dress type names' });
      return;
    }

    try {
      setSaving(true);
      await apiRequest('/dress-rentals/settings', { method: 'POST', body: settings, token });

      setToast({ type: 'success', message: 'Dress rental settings saved successfully' });
      setTimeout(() => onSuccess(), 1000);
    } catch (error) {
      console.error('Error saving dress rental settings:', error);
      setToast({ type: 'error', message: error.message || 'Failed to save dress rental settings' });
    } finally {
      setSaving(false);
    }
  };

  if (!isOpen) return null;

  return (
    <>
      <Modal
        isOpen
        onClose={onClose}
        title="Dress rental settings"
        size="md"
        footer={
          <>
            <Button variant="secondary" onClick={onClose}>Cancel</Button>
            <Button onClick={handleSave} loading={saving} disabled={loading}>Save settings</Button>
          </>
        }
      >
        {loading ? (
          <p className="text-sm text-ink-soft text-center py-6">Loading settings…</p>
        ) : (
          <div className="space-y-6">
            {/* Dress Types */}
            <div>
              <div className="flex justify-between items-center mb-3">
                <label className="label mb-0">Dress types</label>
                <Button size="sm" variant="secondary" icon={Plus} onClick={addDressType}>Add type</Button>
              </div>

              {settings.dressTypes.length === 0 ? (
                <div className="text-center py-4 text-sm text-ink-soft border border-dashed border-line-strong rounded-card">
                  No dress types added yet. Click "Add type" to begin.
                </div>
              ) : (
                <div className="space-y-3">
                  {settings.dressTypes.map((dressType, index) => (
                    <div key={index} className="bg-canvas rounded-card p-3 space-y-2">
                      <div className="flex gap-2">
                        <input
                          type="text"
                          value={dressType.name}
                          onChange={(e) => updateDressType(index, 'name', e.target.value)}
                          placeholder="Type name"
                          className="input flex-1"
                        />
                        <button
                          onClick={() => removeDressType(index)}
                          className="w-10 h-10 flex-shrink-0 flex items-center justify-center text-danger hover:bg-danger-soft rounded-control transition-colors"
                          title="Remove type"
                          aria-label="Remove type"
                        >
                          <X size={16} />
                        </button>
                      </div>
                      <div className="flex gap-2">
                        <div className="flex-1">
                          <label className="text-xs text-ink-soft mb-1 block">Charge (৳)</label>
                          <input
                            type="number"
                            min="0"
                            step="1"
                            value={dressType.chargeAmount}
                            onChange={(e) => updateDressType(index, 'chargeAmount', parseFloat(e.target.value) || 0)}
                            className="input"
                          />
                        </div>
                        <div className="flex-1">
                          <label className="text-xs text-ink-soft mb-1 block">Count</label>
                          <input
                            type="number"
                            min="0"
                            step="1"
                            value={dressType.count}
                            onChange={(e) => updateDressType(index, 'count', parseInt(e.target.value) || 0)}
                            className="input"
                          />
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Prefix */}
            <div>
              <label className="label">Dress number prefix (e.g., "Dress", "D")</label>
              <input
                type="text"
                value={settings.prefix}
                onChange={(e) => setSettings((prev) => ({ ...prev, prefix: e.target.value }))}
                className="input"
              />
              <p className="field-hint">
                Example: "{settings.prefix} 01", "{settings.prefix} 02"
              </p>
            </div>

            {/* Auto Numbering */}
            <div>
              <label className="flex items-center gap-3 cursor-pointer">
                <input
                  type="checkbox"
                  checked={settings.autoNumbering}
                  onChange={(e) => setSettings((prev) => ({ ...prev, autoNumbering: e.target.checked }))}
                  className="w-4 h-4"
                />
                <span className="text-sm text-ink">Auto-generate dress numbers</span>
              </label>
              <p className="field-hint">
                If enabled, dresses will be numbered automatically (e.g., 01, 02, 03…)
              </p>
            </div>
          </div>
        )}
      </Modal>

      {toast && <Toast type={toast.type} message={toast.message} onClose={() => setToast(null)} />}
    </>
  );
}
