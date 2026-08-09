import React, { useState, useEffect } from 'react';
import { apiRequest } from '../api';
import Toast from './Toast';

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
      const response = await apiRequest('/dress-rentals/settings', {
        token,
      });
      const s = response.settings || {};
      setSettings({
        dressTypes: s.dressTypes || [],
        autoNumbering: s.autoNumbering !== undefined ? s.autoNumbering : true,
        prefix: s.prefix || 'Dress',
      });
    } catch (error) {
      console.error('Error fetching dress rental settings:', error);
      setToast({
        type: 'error',
        message: 'Failed to load dress rental settings',
      });
    } finally {
      setLoading(false);
    }
  };

  const addDressType = () => {
    setSettings((prev) => ({
      ...prev,
      dressTypes: [
        ...prev.dressTypes,
        { name: '', chargeAmount: 0, count: 1 },
      ],
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
      setToast({
        type: 'error',
        message: 'Please add at least one dress type',
      });
      return;
    }

    const hasEmpty = settings.dressTypes.some((dt) => !dt.name.trim());
    if (hasEmpty) {
      setToast({
        type: 'error',
        message: 'Please fill in all dress type names',
      });
      return;
    }

    try {
      setSaving(true);
      await apiRequest('/dress-rentals/settings', {
        method: 'POST',
        body: settings,
        token,
      });

      setToast({
        type: 'success',
        message: 'Dress rental settings saved successfully',
      });

      setTimeout(() => {
        onSuccess();
      }, 1000);
    } catch (error) {
      console.error('Error saving dress rental settings:', error);
      setToast({
        type: 'error',
        message: error.message || 'Failed to save dress rental settings',
      });
    } finally {
      setSaving(false);
    }
  };

  if (!isOpen) return null;

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
      <div className="bg-white rounded-lg shadow-xl max-w-lg w-full mx-4">
        <div className="sticky top-0 bg-white border-b border-gray-200 p-4 flex justify-between items-center">
          <h2 className="text-xl font-bold text-gray-900">⚙️ Dress Rental Settings</h2>
          <button
            onClick={onClose}
            className="text-gray-500 hover:text-gray-700 text-2xl leading-none min-h-[44px] min-w-[44px] flex items-center justify-center"
          >
            ×
          </button>
        </div>

        <div className="p-6 space-y-6 max-h-[80vh] overflow-y-auto">
          {/* Dress Types */}
          <div>
            <div className="flex justify-between items-center mb-3">
              <label className="block text-sm font-medium text-gray-700">
                Dress Types
              </label>
              <button
                onClick={addDressType}
                className="px-3 py-1 bg-primary text-white text-sm rounded-lg hover:bg-primary/90 transition-colors"
              >
                + Add Type
              </button>
            </div>

            {settings.dressTypes.length === 0 ? (
              <div className="text-center py-4 text-gray-500 text-sm border border-dashed border-gray-300 rounded-lg">
                No dress types added yet. Click "Add Type" to begin.
              </div>
            ) : (
              <div className="space-y-3">
                {settings.dressTypes.map((dressType, index) => (
                  <div
                    key={index}
                    className="bg-gray-50 rounded-lg p-3 space-y-2"
                  >
                    <div className="flex gap-2">
                      <input
                        type="text"
                        value={dressType.name}
                        onChange={(e) => updateDressType(index, 'name', e.target.value)}
                        placeholder="Type name"
                        className="flex-1 px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary focus:border-transparent outline-none text-sm"
                      />
                      <button
                        onClick={() => removeDressType(index)}
                        className="px-2 py-2 text-red-600 hover:bg-red-50 rounded-lg transition-colors"
                        title="Remove type"
                      >
                        ✕
                      </button>
                    </div>
                    <div className="flex gap-2">
                      <div className="flex-1">
                        <label className="text-xs text-gray-500 mb-1 block">Charge (৳)</label>
                        <input
                          type="number"
                          min="0"
                          step="1"
                          value={dressType.chargeAmount}
                          onChange={(e) =>
                            updateDressType(index, 'chargeAmount', parseFloat(e.target.value) || 0)
                          }
                          className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary focus:border-transparent outline-none text-sm"
                        />
                      </div>
                      <div className="flex-1">
                        <label className="text-xs text-gray-500 mb-1 block">Count</label>
                        <input
                          type="number"
                          min="0"
                          step="1"
                          value={dressType.count}
                          onChange={(e) =>
                            updateDressType(index, 'count', parseInt(e.target.value) || 0)
                          }
                          className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary focus:border-transparent outline-none text-sm"
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
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Dress Number Prefix (e.g., "Dress", "D")
            </label>
            <input
              type="text"
              value={settings.prefix}
              onChange={(e) =>
                setSettings((prev) => ({
                  ...prev,
                  prefix: e.target.value,
                }))
              }
              className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary focus:border-transparent outline-none"
            />
            <p className="mt-2 text-sm text-gray-500">
              Example: "{settings.prefix} 01", "{settings.prefix} 02"
            </p>
          </div>

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
                Auto-generate dress numbers
              </span>
            </label>
            <p className="mt-2 text-xs text-gray-500">
              If enabled, dresses will be numbered automatically (e.g., 01, 02, 03...)
            </p>
          </div>
        </div>

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
