import React, { useState, useEffect } from 'react';
import { Plus, Pencil, Trash2, ClipboardList, Loader2 } from 'lucide-react';
import { apiRequest } from '../api.js';
import Modal from './Modal';
import Button from './Button';
import EmptyState from './EmptyState';
import ActionDropdown from './ActionDropdown';

const COLORS = [
  '#EF4444','#F97316','#F59E0B','#EAB308','#84CC16','#22C55E','#10B981','#14B8A6',
  '#06B6D4','#0EA5E9','#3B82F6','#6366F1','#8B5CF6','#A855F7','#D946EC','#EC4899',
  '#F43F5E','#FB7185','#F472B6','#C084FC','#818CF8','#60A5FA','#38BDF8','#2DD4BF',
  '#34D399','#4ADE80','#A3E635','#FACC15','#FB923C','#F87171','#FB7185','#E879F9',
  '#A78BFA','#93C5FD','#7DD3FC','#67E8F9','#5EEAD4','#86EFAC','#BEF264','#FDE047',
];

const DURATION_OPTIONS = Array.from({ length: 12 }, (_, i) => ({ value: i + 1, label: `${i + 1} Month${i > 0 ? 's' : ''}` }));

const DEFAULT_PACKAGES = [
  { title: 'Monthly', duration: 1, amount: 6500, monthlyFee: 2000, color: '#3B82F6', admissionFee: true },
  { title: 'Quarterly', duration: 3, amount: 10000, monthlyFee: 2000, color: '#8B5CF6', admissionFee: true },
  { title: 'Half Yearly', duration: 6, amount: 17000, monthlyFee: 2000, color: '#F59E0B', admissionFee: true },
  { title: 'Yearly', duration: 12, amount: 30000, monthlyFee: 2000, color: '#22C55E', admissionFee: true },
];

/** Small on/off switch shared by the base-fee cards and the package editor. */
function Toggle({ checked, onChange }) {
  return (
    <label className="relative inline-flex items-center cursor-pointer">
      <input type="checkbox" checked={checked} onChange={onChange} className="sr-only peer" />
      <div className="w-11 h-6 bg-line/60 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-line-strong after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-primary"></div>
    </label>
  );
}

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
    <>
      <Modal
        isOpen={isOpen}
        onClose={onClose}
        title="Membership settings"
        description="Manage your pool's admission and monthly fees in one place."
        size="xl"
        footer={
          <>
            <Button variant="secondary" onClick={onClose} disabled={saving}>Cancel</Button>
            <Button onClick={handleSaveAll} loading={saving} disabled={loading}>Save settings</Button>
          </>
        }
      >
        {loading ? (
          <div className="flex items-center justify-center gap-2 py-12 text-sm text-ink-soft">
            <Loader2 size={18} className="animate-spin text-primary" /> Loading…
          </div>
        ) : (
          <div className="space-y-6">
            {/* Base Fees Setup */}
            <div className="border border-line rounded-card p-5">
              <h3 className="section-title mb-1">Base fees setup</h3>
              <p className="muted mb-4">Easily manage your pool's admission and monthly fees in one place.</p>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {/* Admission Fee Card */}
                <div className="border border-line rounded-card p-4 bg-canvas">
                  <div className="flex items-center justify-between mb-3">
                    <div>
                      <p className="font-medium text-ink">Admission fee</p>
                      <p className="text-xs text-ink-soft">One-time fee new members must pay</p>
                    </div>
                    <Toggle checked={admissionFeeEnabled} onChange={(e) => setAdmissionFeeEnabled(e.target.checked)} />
                  </div>
                  <div>
                    <label className="label">Amount</label>
                    <input
                      type="number"
                      value={admissionFeeAmount}
                      onChange={(e) => setAdmissionFeeAmount(e.target.value)}
                      disabled={!admissionFeeEnabled}
                      className="input"
                    />
                  </div>
                </div>

                {/* Monthly Fee Card */}
                <div className="border border-line rounded-card p-4 bg-canvas">
                  <div className="flex items-center justify-between mb-3">
                    <div>
                      <p className="font-medium text-ink">Monthly fee</p>
                      <p className="text-xs text-ink-soft">Applies every month unless a package is selected</p>
                    </div>
                    <Toggle checked={monthlyFeeEnabled} onChange={(e) => setMonthlyFeeEnabled(e.target.checked)} />
                  </div>
                  <div>
                    <label className="label">Amount</label>
                    <input
                      type="number"
                      value={monthlyFeeAmount}
                      onChange={(e) => setMonthlyFeeAmount(e.target.value)}
                      disabled={!monthlyFeeEnabled}
                      className="input"
                    />
                  </div>
                </div>
              </div>
            </div>

            {/* Packages */}
            <div className="border border-line rounded-card overflow-hidden">
              <div className="bg-canvas px-4 py-3 border-b border-line">
                <h4 className="font-semibold text-ink">Package titles</h4>
              </div>
              {packages.length === 0 ? (
                <EmptyState icon={ClipboardList} title="No packages yet" message="Once you start adding packages, everything will appear here." />
              ) : (
                <table className="table-modern w-full">
                  <thead>
                    <tr>
                      <th>Title</th>
                      <th>Duration</th>
                      <th>Amount</th>
                      <th>Colour</th>
                      <th className="text-right">Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {packages.map((pkg, idx) => (
                      <tr key={idx}>
                        <td className="font-medium text-ink">{pkg.title}</td>
                        <td>{pkg.duration} Month{pkg.duration > 1 ? 's' : ''}</td>
                        <td className="tabular">৳{pkg.amount?.toLocaleString()}</td>
                        <td>
                          <span className="inline-block w-6 h-6 rounded-full border border-line" style={{ backgroundColor: pkg.color }}></span>
                        </td>
                        <td className="text-right">
                          <ActionDropdown
                            actions={[
                              { label: 'Edit', icon: Pencil, onClick: () => openEditPkg(pkg, idx) },
                              { label: 'Delete', icon: Trash2, destructive: true, onClick: () => handleDeletePkg(idx) },
                            ]}
                          />
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
              <div className="p-4 border-t border-line">
                <Button variant="secondary" icon={Plus} onClick={openAddPkg} className="w-full">Add new package</Button>
              </div>
            </div>

            {/* Auto Inactive Setting */}
            <div className="border border-line rounded-card p-5">
              <h3 className="section-title mb-1">Auto inactive</h3>
              <p className="muted mb-3">Automatically mark members as inactive after months of no payment.</p>
              <div className="max-w-xs">
                <label className="label">Months</label>
                <input
                  type="number"
                  value={autoInactiveMonths}
                  onChange={(e) => setAutoInactiveMonths(Number(e.target.value) || 0)}
                  className="input"
                  min="0"
                />
                <p className="field-hint">Set to 0 to disable auto-inactive.</p>
              </div>
            </div>
          </div>
        )}
      </Modal>

      {/* Create/Edit Package Modal */}
      <Modal
        isOpen={pkgModalOpen}
        onClose={() => setPkgModalOpen(false)}
        title={editingPkg !== null ? 'Edit package' : 'Create package'}
        description="Add and manage pool membership packages."
        size="sm"
        footer={
          <>
            <Button variant="secondary" onClick={() => setPkgModalOpen(false)}>Cancel</Button>
            <Button onClick={handleSavePkg}>{editingPkg !== null ? 'Save' : 'Create package'}</Button>
          </>
        }
      >
        <div className="space-y-4">
          <div>
            <label className="label">Title</label>
            <input type="text" value={pkgForm.title} onChange={(e) => setPkgForm({...pkgForm, title: e.target.value})} className="input" placeholder="Type package name" />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="label">Duration</label>
              <select value={pkgForm.duration} onChange={(e) => setPkgForm({...pkgForm, duration: Number(e.target.value)})} className="select">
                {DURATION_OPTIONS.map(opt => (
                  <option key={opt.value} value={opt.value}>{opt.label}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="label">Amount</label>
              <input type="number" value={pkgForm.amount} onChange={(e) => setPkgForm({...pkgForm, amount: Number(e.target.value)})} className="input" />
            </div>
          </div>

          <div>
            <label className="label">Monthly fee</label>
            <input type="number" value={pkgForm.monthlyFee} onChange={(e) => setPkgForm({...pkgForm, monthlyFee: Number(e.target.value)})} className="input" />
          </div>

          {/* Color Picker */}
          <div>
            <label className="label">Select colour</label>
            <div className="flex items-center gap-2 mb-2">
              <span className="w-8 h-8 rounded-full border border-line" style={{ backgroundColor: pkgForm.color }}></span>
              <span className="text-sm text-ink-soft">{pkgForm.color}</span>
            </div>
            <div className="grid grid-cols-10 gap-1">
              {COLORS.map((c) => (
                <button
                  key={c}
                  type="button"
                  onClick={() => setPkgForm({...pkgForm, color: c})}
                  className={`w-7 h-7 rounded-full border-2 transition-transform hover:scale-110 ${pkgForm.color === c ? 'border-ink ring-2 ring-line-strong' : 'border-transparent'}`}
                  style={{ backgroundColor: c }}
                  aria-label={`Choose color ${c}`}
                />
              ))}
            </div>
          </div>

          {/* Admission Fee Toggle */}
          <div className="flex items-center justify-between border border-line rounded-control p-3">
            <div>
              <p className="text-sm font-medium text-ink">Admission fee</p>
              <p className="text-xs text-ink-soft">Include the admission fee with this package</p>
            </div>
            <Toggle checked={pkgForm.admissionFee} onChange={(e) => setPkgForm({...pkgForm, admissionFee: e.target.checked})} />
          </div>
        </div>
      </Modal>
    </>
  );
}
