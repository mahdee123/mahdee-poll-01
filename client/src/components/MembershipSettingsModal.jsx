import React, { useState, useEffect } from 'react';
import { apiRequest } from '../api.js';

const COLORS = [
  '#EF4444','#F97316','#F59E0B','#EAB308','#84CC16','#22C55E','#10B981','#14B8A6',
  '#06B6D4','#0EA5E9','#3B82F6','#6366F1','#8B5CF6','#A855F7','#D946EC','#EC4899',
  '#F43F5E','#FB7185','#F472B6','#C084FC','#818CF8','#60A5FA','#38BDF8','#2DD4BF',
  '#34D399','#4ADE80','#A3E635','#FACC15','#FB923C','#F87171','#FB7185','#E879F9',
  '#A78BFA','#93C5FD','#7DD3FC','#67E8F9','#5EEAD4','#86EFAC','#BEF264','#FDE047',
];

const DURATION_OPTIONS = [
  { value: 1, label: '1 Month' },
  { value: 2, label: '2 Months' },
  { value: 3, label: '3 Months' },
  { value: 4, label: '4 Months' },
  { value: 5, label: '5 Months' },
  { value: 6, label: '6 Months' },
  { value: 7, label: '7 Months' },
  { value: 8, label: '8 Months' },
  { value: 9, label: '9 Months' },
  { value: 10, label: '10 Months' },
  { value: 11, label: '11 Months' },
  { value: 12, label: '12 Months' },
];

const DEFAULT_PACKAGES = [
  { title: 'Monthly', duration: 1, amount: 6500, monthlyFee: 2000, color: '#3B82F6', admissionFee: true },
  { title: 'Quarterly', duration: 3, amount: 10000, monthlyFee: 2000, color: '#8B5CF6', admissionFee: true },
  { title: 'Half Yearly', duration: 6, amount: 17000, monthlyFee: 2000, color: '#F59E0B', admissionFee: true },
  { title: 'Yearly', duration: 12, amount: 30000, monthlyFee: 2000, color: '#22C55E', admissionFee: true },
];

export default function MembershipSettingsModal({ isOpen, token, onClose, onSuccess, showToast }) {
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);

  // Base fees state
  const [admissionFeeEnabled, setAdmissionFeeEnabled] = useState(true);
  const [admissionFeeAmount, setAdmissionFeeAmount] = useState(2500);
  const [monthlyFeeEnabled, setMonthlyFeeEnabled] = useState(true);
  const [monthlyFeeAmount, setMonthlyFeeAmount] = useState(2000);

  // Packages state
  const [packages, setPackages] = useState(DEFAULT_PACKAGES);

  // Auto inactive
  const [autoInactiveMonths, setAutoInactiveMonths] = useState(3);

  // Package modal state
  const [pkgModalOpen, setPkgModalOpen] = useState(false);
  const [editingPkg, setEditingPkg] = useState(null);
  const [pkgForm, setPkgForm] = useState({ title: '', duration: 1, amount: 0, monthlyFee: 2000, color: '#6366F1', admissionFee: true });

  // Color picker state
  const [showColorPicker, setShowColorPicker] = useState(null);

  useEffect(() => {
    if (isOpen) fetchSettings();
  }, [isOpen]);

  const fetchSettings = async () => {
    try {
      setLoading(true);
      const res = await apiRequest('/memberships/settings/membership', { token });
      const s = res.settings;
      if (s.baseFees) {
        setAdmissionFeeEnabled(s.baseFees.admissionFee?.enabled ?? true);
        setAdmissionFeeAmount(s.baseFees.admissionFee?.amount ?? 2500);
        setMonthlyFeeEnabled(s.baseFees.monthlyFee?.enabled ?? true);
        setMonthlyFeeAmount(s.baseFees.monthlyFee?.amount ?? 2000);
      }
      if (s.packages && s.packages.length > 0) {
        setPackages(s.packages);
      }
      if (s.autoInactiveMonths !== undefined) {
        setAutoInactiveMonths(s.autoInactiveMonths);
      }
    } catch (err) {
      showToast('Failed to load settings');
    } finally {
      setLoading(false);
    }
  };

  // --- Package handlers ---
  const openAddPkg = () => {
    setEditingPkg(null);
    setPkgForm({ title: '', duration: 1, amount: 0, monthlyFee: 2000, color: '#6366F1', admissionFee: true });
    setPkgModalOpen(true);
  };

  const openEditPkg = (pkg, idx) => {
    setEditingPkg(idx);
    setPkgForm({ ...pkg });
    setPkgModalOpen(true);
  };

  const handleSavePkg = () => {
    if (!pkgForm.title.trim()) {
      showToast('Package title is required');
      return;
    }
    const updated = [...packages];
    if (editingPkg !== null) {
      updated[editingPkg] = { ...pkgForm };
    } else {
      updated.push({ ...pkgForm });
    }
    setPackages(updated);
    setPkgModalOpen(false);
  };

  const handleDeletePkg = (idx) => {
    setPackages(packages.filter((_, i) => i !== idx));
  };

  // --- Expense handlers ---
  // --- Save all ---
  const handleSaveAll = async () => {
    try {
      setSaving(true);
      await apiRequest('/memberships/settings/membership', {
        method: 'PUT',
        body: {
          baseFees: {
            admissionFee: { enabled: admissionFeeEnabled, amount: Number(admissionFeeAmount) },
            monthlyFee: { enabled: monthlyFeeEnabled, amount: Number(monthlyFeeAmount) },
          },
          packages,
          autoInactiveMonths: Number(autoInactiveMonths),
        },
        token
      });
      showToast('Settings saved successfully');
      if (onSuccess) onSuccess();
      onClose();
    } catch (err) {
      showToast(err.message || 'Failed to save settings');
    } finally {
      setSaving(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-xl max-w-5xl w-full shadow-xl max-h-[90vh] flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between p-6 border-b">
          <div>
            <h2 className="text-2xl font-bold">⚙️ Membership Settings</h2>
            <p className="text-sm text-gray-500 mt-1">Easily manage your pool's admission and monthly fees in one place.</p>
          </div>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600 text-2xl">&times;</button>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto p-6 space-y-6">
          {loading ? (
            <div className="flex items-center justify-center py-12">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
              <span className="ml-3 text-gray-500">Loading...</span>
            </div>
          ) : (
            <>
              {/* Base Fees Setup */}
              <div className="border rounded-xl p-5">
                <h3 className="text-lg font-semibold mb-1">Base Fees Setup</h3>
                <p className="text-sm text-gray-500 mb-4">Easily manage your pool's admission and monthly fees in one place.</p>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {/* Admission Fee Card */}
                  <div className="border rounded-lg p-4 bg-gray-50">
                    <div className="flex items-center justify-between mb-3">
                      <div>
                        <p className="font-medium">Admission Fee</p>
                        <p className="text-xs text-gray-500">This is a one-time fee for new member must pay</p>
                      </div>
                      <label className="relative inline-flex items-center cursor-pointer">
                        <input type="checkbox" checked={admissionFeeEnabled} onChange={(e) => setAdmissionFeeEnabled(e.target.checked)} className="sr-only peer" />
                        <div className="w-11 h-6 bg-gray-200 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-primary"></div>
                      </label>
                    </div>
                    <div>
                      <label className="block text-xs text-gray-500 mb-1">Amount</label>
                      <input
                        type="number"
                        value={admissionFeeAmount}
                        onChange={(e) => setAdmissionFeeAmount(e.target.value)}
                        disabled={!admissionFeeEnabled}
                        className="w-full border rounded-lg px-3 py-2 text-sm disabled:opacity-50 disabled:bg-gray-100"
                      />
                    </div>
                  </div>

                  {/* Monthly Fee Card */}
                  <div className="border rounded-lg p-4 bg-gray-50">
                    <div className="flex items-center justify-between mb-3">
                      <div>
                        <p className="font-medium">Monthly Fee</p>
                        <p className="text-xs text-gray-500">This fee will apply every month unless a package is selected</p>
                      </div>
                      <label className="relative inline-flex items-center cursor-pointer">
                        <input type="checkbox" checked={monthlyFeeEnabled} onChange={(e) => setMonthlyFeeEnabled(e.target.checked)} className="sr-only peer" />
                        <div className="w-11 h-6 bg-gray-200 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-primary"></div>
                      </label>
                    </div>
                    <div>
                      <label className="block text-xs text-gray-500 mb-1">Amount</label>
                      <input
                        type="number"
                        value={monthlyFeeAmount}
                        onChange={(e) => setMonthlyFeeAmount(e.target.value)}
                        disabled={!monthlyFeeEnabled}
                        className="w-full border rounded-lg px-3 py-2 text-sm disabled:opacity-50 disabled:bg-gray-100"
                      />
                    </div>
                  </div>
                </div>
              </div>

              {/* Packages */}
              <div>
                <div className="border rounded-xl overflow-hidden">
                  <div className="bg-gray-50 px-4 py-3 border-b">
                    <h4 className="font-semibold">Package's Title</h4>
                  </div>
                  {packages.length === 0 ? (
                    <div className="py-12 text-center text-gray-400">
                      <p className="text-4xl mb-2">📋</p>
                      <p className="font-medium">No data available yet</p>
                      <p className="text-sm">Once you start adding packages, everything will appear here.</p>
                    </div>
                  ) : (
                    <table className="w-full text-sm">
                      <thead>
                        <tr className="border-b bg-gray-50 text-left text-gray-600">
                          <th className="px-4 py-3 font-medium">Title</th>
                          <th className="px-4 py-3 font-medium">Duration</th>
                          <th className="px-4 py-3 font-medium">Amount</th>
                          <th className="px-4 py-3 font-medium">Colour</th>
                          <th className="px-4 py-3 font-medium">Edit</th>
                        </tr>
                      </thead>
                      <tbody>
                        {packages.map((pkg, idx) => (
                          <tr key={idx} className="border-b hover:bg-gray-50">
                            <td className="px-4 py-3 font-medium">{pkg.title}</td>
                            <td className="px-4 py-3">{pkg.duration} Month{pkg.duration > 1 ? 's' : ''}</td>
                            <td className="px-4 py-3">৳{pkg.amount?.toLocaleString()}</td>
                            <td className="px-4 py-3">
                              <span className="inline-block w-6 h-6 rounded-full border" style={{ backgroundColor: pkg.color }}></span>
                            </td>
                            <td className="px-4 py-3">
                              <div className="relative">
                                <button onClick={() => setShowColorPicker(showColorPicker === `pkg-${idx}` ? null : `pkg-${idx}`)} className="text-gray-400 hover:text-gray-600 text-lg">⋮</button>
                                {showColorPicker === `pkg-${idx}` && (
                                  <div className="absolute right-0 top-8 bg-white border rounded-lg shadow-lg z-10 py-1 w-28">
                                    <button onClick={() => { openEditPkg(pkg, idx); setShowColorPicker(null); }} className="w-full text-left px-4 py-2 hover:bg-gray-100 text-sm">✏️ Edit</button>
                                    <button onClick={() => { handleDeletePkg(idx); setShowColorPicker(null); }} className="w-full text-left px-4 py-2 hover:bg-gray-100 text-sm text-red-600">🗑️ Delete</button>
                                  </div>
                                )}
                              </div>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  )}
                  <div className="p-4 border-t">
                    <button onClick={openAddPkg} className="w-full py-2 border-2 border-dashed rounded-lg text-gray-500 hover:text-primary hover:border-primary transition font-medium">
                      + Add New
                    </button>
                  </div>
                </div>
              </div>

              {/* Auto Inactive Setting */}
              <div className="border rounded-xl p-5">
                <h3 className="text-lg font-semibold mb-1">Auto Inactive</h3>
                <p className="text-sm text-gray-500 mb-3">Automatically mark members as inactive after months of no payment.</p>
                <div className="max-w-xs">
                  <label className="block text-sm font-medium text-gray-700 mb-1">Months</label>
                  <input
                    type="number"
                    value={autoInactiveMonths}
                    onChange={(e) => setAutoInactiveMonths(Number(e.target.value) || 0)}
                    className="w-full border rounded-lg px-3 py-2"
                    min="0"
                  />
                  <p className="text-xs text-gray-400 mt-1">Set to 0 to disable auto-inactive.</p>
                </div>
              </div>
            </>
          )}
        </div>

        {/* Footer */}
        <div className="flex justify-end gap-3 p-6 border-t">
          <button onClick={onClose} disabled={saving} className="px-4 py-2 rounded-lg bg-gray-200 hover:bg-gray-300 text-gray-800 font-medium disabled:opacity-50">Cancel</button>
          <button onClick={handleSaveAll} disabled={saving || loading} className="px-6 py-2 rounded-lg bg-primary hover:bg-primary/90 text-white font-semibold disabled:opacity-50">
            {saving ? 'Saving...' : 'Save Settings'}
          </button>
        </div>
      </div>

      {/* Create/Edit Package Modal */}
      {pkgModalOpen && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-[60] p-4">
          <div className="bg-white rounded-xl max-w-md w-full shadow-xl">
            <div className="p-6">
              <div className="flex items-center justify-between mb-4">
                <div>
                  <h3 className="text-xl font-bold">{editingPkg !== null ? 'Edit Package' : 'Create Package'}</h3>
                  <p className="text-sm text-gray-500">Add and manage pool membership packages.</p>
                </div>
                <button onClick={() => setPkgModalOpen(false)} className="text-gray-400 hover:text-gray-600 text-2xl">&times;</button>
              </div>

              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Title</label>
                  <input type="text" value={pkgForm.title} onChange={(e) => setPkgForm({...pkgForm, title: e.target.value})} className="w-full border rounded-lg px-3 py-2" placeholder="Type package name" />
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Duration</label>
                    <select value={pkgForm.duration} onChange={(e) => setPkgForm({...pkgForm, duration: Number(e.target.value)})} className="w-full border rounded-lg px-3 py-2">
                      {DURATION_OPTIONS.map(opt => (
                        <option key={opt.value} value={opt.value}>{opt.label}</option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Amount</label>
                    <input type="number" value={pkgForm.amount} onChange={(e) => setPkgForm({...pkgForm, amount: Number(e.target.value)})} className="w-full border rounded-lg px-3 py-2" />
                  </div>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Monthly Fee</label>
                  <input type="number" value={pkgForm.monthlyFee} onChange={(e) => setPkgForm({...pkgForm, monthlyFee: Number(e.target.value)})} className="w-full border rounded-lg px-3 py-2" />
                </div>

                {/* Color Picker */}
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Select Colour</label>
                  <div className="flex items-center gap-2 mb-2">
                    <span className="w-8 h-8 rounded-full border-2" style={{ backgroundColor: pkgForm.color }}></span>
                    <span className="text-sm text-gray-500">{pkgForm.color}</span>
                  </div>
                  <div className="grid grid-cols-10 gap-1">
                    {COLORS.map((c) => (
                      <button
                        key={c}
                        onClick={() => setPkgForm({...pkgForm, color: c})}
                        className={`w-7 h-7 rounded-full border-2 transition-transform hover:scale-110 ${pkgForm.color === c ? 'border-gray-800 ring-2 ring-gray-300' : 'border-transparent'}`}
                        style={{ backgroundColor: c }}
                      />
                    ))}
                  </div>
                </div>

                {/* Admission Fee Toggle */}
                <div className="flex items-center justify-between border rounded-lg p-3">
                  <div>
                    <p className="text-sm font-medium">Admission Fee</p>
                    <p className="text-xs text-gray-500">Choose whether this package will include the admission fee</p>
                  </div>
                  <label className="relative inline-flex items-center cursor-pointer">
                    <input type="checkbox" checked={pkgForm.admissionFee} onChange={(e) => setPkgForm({...pkgForm, admissionFee: e.target.checked})} className="sr-only peer" />
                    <div className="w-11 h-6 bg-gray-200 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-primary"></div>
                  </label>
                </div>
              </div>
            </div>

            <div className="flex gap-3 p-6 border-t">
              <button onClick={() => setPkgModalOpen(false)} className="flex-1 px-4 py-2 rounded-lg bg-gray-200 hover:bg-gray-300 text-gray-800 font-medium">Cancel</button>
              <button onClick={handleSavePkg} className="flex-1 px-4 py-2 rounded-lg bg-primary hover:bg-primary/90 text-white font-semibold">
                {editingPkg !== null ? 'Save' : 'Create Package'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
