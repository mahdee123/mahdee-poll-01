import React, { useState, useEffect } from 'react';
import { AlertTriangle } from 'lucide-react';
import { apiRequest } from '../api';
import Toast from './Toast';
import Modal from './Modal';
import Button from './Button';

export default function LockerSettingsModal({ token, onClose, onSave }) {
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [toast, setToast] = useState(null);
  const [settings, setSettings] = useState({
    totalLockers: 0,
    lockerPrefix: 'Locker',
    pricingMode: 'Free',
    chargeAmount: 0,
    autoNumbering: true,
  });
  const [changeWarning, setChangeWarning] = useState(null);

  useEffect(() => {
    fetchSettings();
  }, []);

  const fetchSettings = async () => {
    try {
      setLoading(true);
      const response = await apiRequest('/lockers/settings', { token });
      setSettings(response.settings);
    } catch (error) {
      console.error('Error fetching settings:', error);
      setToast({ type: 'error', message: 'Failed to load locker settings' });
    } finally {
      setLoading(false);
    }
  };

  const handleTotalLockersChange = (newTotal) => {
    const oldTotal = settings.totalLockers;
    setSettings((prev) => ({ ...prev, totalLockers: newTotal }));

    if (newTotal !== oldTotal) {
      if (newTotal > oldTotal) {
        setChangeWarning(`Will create ${newTotal - oldTotal} new lockers`);
      } else {
        setChangeWarning(`Will disable ${oldTotal - newTotal} lockers`);
      }
    } else {
      setChangeWarning(null);
    }
  };

  const handleSave = async () => {
    if (settings.totalLockers === 0) {
      setToast({ type: 'error', message: 'Please enter number of lockers' });
      return;
    }

    try {
      setSaving(true);
      await apiRequest('/lockers/settings', { method: 'POST', body: settings, token });

      setToast({ type: 'success', message: 'Locker settings saved successfully' });
      setTimeout(() => onSave(), 1000);
    } catch (error) {
      console.error('Error saving settings:', error);
      setToast({ type: 'error', message: error.message || 'Failed to save locker settings' });
    } finally {
      setSaving(false);
    }
  };

  return (
    <>
      <Modal
        isOpen
        onClose={onClose}
        title="Locker settings"
        size="sm"
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
            {/* Total Lockers */}
            <div>
              <label className="label">Total lockers</label>
              <input
                type="number"
                min="0"
                value={settings.totalLockers}
                onChange={(e) => handleTotalLockersChange(parseInt(e.target.value) || 0)}
                className="input"
              />
              {changeWarning && (
                <p className="flex items-center gap-1.5 mt-2 text-sm text-warning-ink bg-warning-soft p-2 rounded-control">
                  <AlertTriangle size={14} /> {changeWarning}
                </p>
              )}
            </div>

            {/* Locker Prefix */}
            <div>
              <label className="label">Locker prefix (e.g., "Locker", "L")</label>
              <input
                type="text"
                value={settings.lockerPrefix}
                onChange={(e) => setSettings((prev) => ({ ...prev, lockerPrefix: e.target.value }))}
                className="input"
              />
              <p className="field-hint">
                Example: "{settings.lockerPrefix} 01", "{settings.lockerPrefix} 02"
              </p>
            </div>

            {/* Pricing Mode */}
            <div>
              <label className="label">Pricing mode</label>
              <div className="space-y-2">
                {['Free', 'PaidPerUse', 'Fixed'].map((mode) => (
                  <label key={mode} className="flex items-center gap-3 cursor-pointer">
                    <input
                      type="radio"
                      name="pricingMode"
                      value={mode}
                      checked={settings.pricingMode === mode}
                      onChange={(e) => setSettings((prev) => ({ ...prev, pricingMode: e.target.value }))}
                      className="w-4 h-4"
                    />
                    <span className="text-sm text-ink">
                      {mode === 'Free' && 'Free (No charge)'}
                      {mode === 'PaidPerUse' && 'Paid per use'}
                      {mode === 'Fixed' && 'Fixed amount'}
                    </span>
                  </label>
                ))}
              </div>
            </div>

            {/* Charge Amount */}
            {settings.pricingMode !== 'Free' && (
              <div>
                <label className="label">Charge amount (৳)</label>
                <input
                  type="number"
                  min="0"
                  step="1"
                  value={settings.chargeAmount}
                  onChange={(e) => setSettings((prev) => ({ ...prev, chargeAmount: parseFloat(e.target.value) || 0 }))}
                  className="input"
                />
              </div>
            )}

            {/* Auto Numbering */}
            <div>
              <label className="flex items-center gap-3 cursor-pointer">
                <input
                  type="checkbox"
                  checked={settings.autoNumbering}
                  onChange={(e) => setSettings((prev) => ({ ...prev, autoNumbering: e.target.checked }))}
                  className="w-4 h-4"
                />
                <span className="text-sm text-ink">Auto-generate locker numbers</span>
              </label>
              <p className="field-hint">
                If enabled, lockers will be numbered automatically (e.g., 01, 02, 03…)
              </p>
            </div>
          </div>
        )}
      </Modal>

      {toast && <Toast type={toast.type} message={toast.message} onClose={() => setToast(null)} />}
    </>
  );
}
