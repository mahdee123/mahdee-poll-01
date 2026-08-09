import React, { useState, useEffect } from 'react';
import { apiRequest } from '../api';
import Toast from './Toast';

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
      const response = await apiRequest('/lockers/settings', {
        token,
      });
      setSettings(response.settings);
    } catch (error) {
      console.error('Error fetching settings:', error);
      setToast({
        type: 'error',
        message: 'Failed to load locker settings',
      });
    } finally {
      setLoading(false);
    }
  };

  const handleTotalLockersChange = (newTotal) => {
    const oldTotal = settings.totalLockers;
    setSettings((prev) => ({
      ...prev,
      totalLockers: newTotal,
    }));

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
      setToast({
        type: 'error',
        message: 'Please enter number of lockers',
      });
      return;
    }

    try {
      setSaving(true);
      await apiRequest('/lockers/settings', {
        method: 'POST',
        body: settings,
        token,
      });

      setToast({
        type: 'success',
        message: 'Locker settings saved successfully',
      });

      setTimeout(() => {
        onSave();
      }, 1000);
    } catch (error) {
      console.error('Error saving settings:', error);
      setToast({
        type: 'error',
        message: error.message || 'Failed to save locker settings',
      });
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
        <div className="bg-white rounded-lg p-6">
          <p className="text-gray-600">Loading settings...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
      <div className="bg-white rounded-lg shadow-xl max-w-md w-full mx-4">
        {/* Header */}
        <div className="sticky top-0 bg-white border-b border-gray-200 p-4 flex justify-between items-center">
          <h2 className="text-xl font-bold text-gray-900">⚙️ Locker Settings</h2>
          <button
            onClick={onClose}
            className="text-gray-500 hover:text-gray-700 text-2xl leading-none min-h-[44px] min-w-[44px] flex items-center justify-center"
          >
            ×
          </button>
        </div>

        {/* Form Content */}
        <div className="p-6 space-y-6 max-h-[80vh] overflow-y-auto">
          {/* Total Lockers */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Total Lockers
            </label>
            <input
              type="number"
              min="0"
              value={settings.totalLockers}
              onChange={(e) => handleTotalLockersChange(parseInt(e.target.value) || 0)}
              className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary focus:border-transparent outline-none"
            />
            {changeWarning && (
              <p className="mt-2 text-sm text-amber-600 bg-amber-50 p-2 rounded">
                ⚠️ {changeWarning}
              </p>
            )}
          </div>

          {/* Locker Prefix */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Locker Prefix (e.g., "Locker", "L")
            </label>
            <input
              type="text"
              value={settings.lockerPrefix}
              onChange={(e) =>
                setSettings((prev) => ({
                  ...prev,
                  lockerPrefix: e.target.value,
                }))
              }
              className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary focus:border-transparent outline-none"
            />
            <p className="mt-2 text-sm text-gray-500">
              Example: "{settings.lockerPrefix} 01", "{settings.lockerPrefix} 02"
            </p>
          </div>

          {/* Pricing Mode */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-3">
              Pricing Mode
            </label>
            <div className="space-y-2">
              {['Free', 'PaidPerUse', 'Fixed'].map((mode) => (
                <label key={mode} className="flex items-center gap-3 cursor-pointer">
                  <input
                    type="radio"
                    name="pricingMode"
                    value={mode}
                    checked={settings.pricingMode === mode}
                    onChange={(e) =>
                      setSettings((prev) => ({
                        ...prev,
                        pricingMode: e.target.value,
                      }))
                    }
                    className="w-4 h-4"
                  />
                  <span className="text-sm text-gray-700">
                    {mode === 'Free' && 'Free (No charge)'}
                    {mode === 'PaidPerUse' && 'Paid Per Use'}
                    {mode === 'Fixed' && 'Fixed Amount'}
                  </span>
                </label>
              ))}
            </div>
          </div>

          {/* Charge Amount */}
          {settings.pricingMode !== 'Free' && (
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Charge Amount (৳)
              </label>
              <input
                type="number"
                min="0"
                step="1"
                value={settings.chargeAmount}
                onChange={(e) =>
                  setSettings((prev) => ({
                    ...prev,
                    chargeAmount: parseFloat(e.target.value) || 0,
                  }))
                }
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary focus:border-transparent outline-none"
              />
            </div>
          )}

          {/* Auto Numbering */}
          <div>
            <label className="flex items-center gap-3 cursor-pointer">
              <input
                type="checkbox"
                checked={settings.autoNumbering}
                onChange={(e) =>
                  setSettings((prev) => ({
                    ...prev,
                    autoNumbering: e.target.checked,
                  }))
                }
                className="w-4 h-4"
              />
              <span className="text-sm text-gray-700">
                Auto-generate locker numbers
              </span>
            </label>
            <p className="mt-2 text-xs text-gray-500">
              If enabled, lockers will be numbered automatically (e.g., 01, 02, 03...)
            </p>
          </div>
        </div>

        {/* Footer Actions */}
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
