import React, { useState, useEffect, useRef, useMemo } from 'react';
import { apiRequest } from '../api.js';
import LoadingSpinner from './LoadingSpinner.jsx';
import Toast from './Toast.jsx';

const PAYMENT_METHODS = ['Cash', 'Bank', 'bKash'];
const formatCurrency = (v) => v ? `৳${Number(v).toLocaleString('en-IN')}` : '৳0';
const formatDate = (d) => { if (!d) return '—'; const dt = new Date(d); return isNaN(dt) ? '—' : dt.toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' }); };
const toLocalDateStr = (d) => { const year = d.getFullYear(); const month = String(d.getMonth() + 1).padStart(2, '0'); const day = String(d.getDate()).padStart(2, '0'); return `${year}-${month}-${day}`; };
const toDateKey = (d) => d ? toLocalDateStr(new Date(d)) : '';

export default function DailyExpenseForm({ token, onManageCategories }) {
  const [saving, setSaving] = useState(false);
  const [toast, setToast] = useState(null);
  const searchRef = useRef(null);
  const dropdownRef = useRef(null);

  const [categories, setCategories] = useState([]);
  const [showForm, setShowForm] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const [showDropdown, setShowDropdown] = useState(false);
  const [selCat, setSelCat] = useState('');
  const [selSub, setSelSub] = useState('');
  const [desc, setDesc] = useState('');
  const [amount, setAmount] = useState('');
  const [payMethod, setPayMethod] = useState('');
  const [date, setDate] = useState(toLocalDateStr(new Date()));

  const [expenses, setExpenses] = useState([]);
  const [expLoading, setExpLoading] = useState(true);
  const [editId, setEditId] = useState(null);
  const [editForm, setEditForm] = useState(null);

  const [fCat, setFCat] = useState('');
  const [fPay, setFPay] = useState('');
  const [fRange, setFRange] = useState('month');
  const [fCustomStart, setFCustomStart] = useState('');
  const [fCustomEnd, setFCustomEnd] = useState('');

  const allSubs = useMemo(() => categories.flatMap(c => (c.subcategories || []).map(s => ({ name: s.name, category: c.name }))), [categories]);
  const filteredSearch = searchTerm.trim() ? allSubs.filter(s => s.name.toLowerCase().includes(searchTerm.toLowerCase()) || s.category.toLowerCase().includes(searchTerm.toLowerCase())) : allSubs.slice(0, 10);

  const toast_ = (m, t = 'success') => { setToast({ message: m, type: t }); setTimeout(() => setToast(null), 3000); };

  const fetchCats = async () => { try { const r = await apiRequest('/expense-categories', { token }); setCategories(r.categories || []); } catch { setCategories([]); } };
  const fetchExp = async () => { try { setExpLoading(true); const r = await apiRequest('/daily-expenses', { token }); setExpenses(r.expenses || r || []); } catch (e) { toast_(e?.message || 'Failed', 'error'); } finally { setExpLoading(false); } };

  useEffect(() => { if (token) { fetchCats(); fetchExp(); } /* eslint-disable-line */ }, [token]);
  useEffect(() => { const h = (e) => { if (dropdownRef.current && !dropdownRef.current.contains(e.target) && searchRef.current && !searchRef.current.contains(e.target)) setShowDropdown(false); }; document.addEventListener('mousedown', h); return () => document.removeEventListener('mousedown', h); }, []);

  const selectSub = (s) => { setSelCat(s.category); setSelSub(s.name); setSearchTerm(s.name); setShowDropdown(false); };
  const resetForm = () => { setSearchTerm(''); setSelCat(''); setSelSub(''); setDesc(''); setAmount(''); setPayMethod(''); setDate(toLocalDateStr(new Date())); setShowForm(false); };

  const handleSave = async () => {
    if (!selCat) { toast_('Select a subcategory', 'error'); return; }
    const amt = parseFloat(amount);
    if (!amt || amt <= 0) { toast_('Enter an amount', 'error'); return; }
    try {
      setSaving(true);
      await apiRequest('/daily-expenses', { method: 'POST', token, body: { date, paymentMethod: payMethod || 'Cash', categories: [{ name: selCat, subcategory: selSub || '', amount: amt, notes: desc }] } });
      toast_('Saved!'); resetForm(); fetchExp();
    } catch (e) { toast_(e?.message || 'Failed', 'error'); } finally { setSaving(false); }
  };

  const handleEdit = (exp) => { const c = exp.categories?.[0]; setEditId(exp._id); setEditForm({ date: exp.date ? toLocalDateStr(new Date(exp.date)) : '', paymentMethod: exp.paymentMethod || 'Cash', category: c?.name || '', subcategory: c?.subcategory || '', amount: String(c?.amount || 0), notes: c?.notes || '' }); };

  const handleSaveEdit = async () => {
    try {
      setSaving(true);
      const amt = parseFloat(editForm.amount);
      if (!amt || amt <= 0) { toast_('Enter an amount', 'error'); return; }
      await apiRequest(`/daily-expenses/${editId}`, { method: 'PUT', token, body: { date: editForm.date, paymentMethod: editForm.paymentMethod, categories: [{ name: editForm.category, subcategory: editForm.subcategory || '', amount: amt, notes: editForm.notes }] } });
      toast_('Updated'); setEditId(null); setEditForm(null); fetchExp();
    } catch (e) { toast_(e?.message || 'Failed', 'error'); } finally { setSaving(false); }
  };

  const handleDelete = async (id) => { if (!confirm('Delete?')) return; try { await apiRequest(`/daily-expenses/${id}`, { method: 'DELETE', token }); toast_('Deleted'); fetchExp(); } catch (e) { toast_(e?.message || 'Failed', 'error'); } };

  const uniqueCats = [...new Set(expenses.flatMap(e => (e.categories || []).map(c => c.name)))];

  const getDateRange = () => {
    const now = new Date();
    let start, end;
    if (fRange === 'today') {
      start = new Date(now); start.setHours(0, 0, 0, 0);
      end = new Date(now); end.setHours(23, 59, 59, 999);
    } else if (fRange === 'week') {
      end = new Date(now); end.setHours(23, 59, 59, 999);
      start = new Date(now); start.setDate(start.getDate() - 7); start.setHours(0, 0, 0, 0);
    } else if (fRange === 'month') {
      start = new Date(now.getFullYear(), now.getMonth(), 1);
      end = new Date(now.getFullYear(), now.getMonth() + 1, 0, 23, 59, 59, 999);
    } else if (fRange === 'year') {
      start = new Date(now.getFullYear(), 0, 1);
      end = new Date(now.getFullYear(), 11, 31, 23, 59, 59, 999);
    } else if (fRange === 'custom' && fCustomStart && fCustomEnd) {
      start = new Date(fCustomStart); start.setHours(0, 0, 0, 0);
      end = new Date(fCustomEnd); end.setHours(23, 59, 59, 999);
    } else {
      start = new Date(now.getFullYear(), now.getMonth(), 1);
      end = new Date(now); end.setHours(23, 59, 59, 999);
    }
    return { start, end };
  };

  const filtered = useMemo(() => {
    let r = expenses;
    // Date range filter
    const { start, end } = getDateRange();
    r = r.filter(e => {
      const d = new Date(e.date);
      return d >= start && d <= end;
    });
    if (fCat) r = r.filter(e => (e.categories || []).some(c => c.name === fCat));
    if (fPay) r = r.filter(e => e.paymentMethod === fPay);
    return r;
  }, [expenses, fCat, fPay, fRange, fCustomStart, fCustomEnd]);

  const grouped = useMemo(() => {
    const g = {};
    filtered.forEach(e => { const k = toDateKey(e.date); if (!g[k]) g[k] = { date: e.date, items: [], total: 0 }; g[k].items.push(e); g[k].total += e.totalAmount || 0; });
    return Object.values(g).sort((a, b) => new Date(b.date) - new Date(a.date));
  }, [filtered]);

  const renderExpenseRow = (exp) => (
    <div key={exp._id} className="flex items-center gap-3 px-5 py-2.5 hover:bg-gray-50 transition group">
      <div className="w-8 h-8 rounded-full bg-primary/10 flex items-center justify-center flex-shrink-0">
        <span className="text-xs font-bold text-primary">{(exp.categories?.[0]?.name || '?')[0]}</span>
      </div>
      <div className="flex-1 min-w-0">
        <span className="text-sm font-medium text-gray-900 truncate">
          {exp.categories?.[0]?.subcategory || exp.categories?.[0]?.name || '—'}
        </span>
        <span className="text-xs text-gray-500 ml-2">{exp.paymentMethod || 'Cash'}</span>
      </div>
      <div className="text-sm font-bold text-red-600 flex-shrink-0">{formatCurrency(exp.totalAmount)}</div>
      <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition flex-shrink-0">
        <button onClick={() => handleEdit(exp)} className="p-1 text-gray-400 hover:text-primary rounded transition">
          <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" /></svg>
        </button>
        <button onClick={() => handleDelete(exp._id)} className="p-1 text-gray-400 hover:text-red-500 rounded transition">
          <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" /></svg>
        </button>
      </div>
    </div>
  );

  return (
    <div className="space-y-4">
      {toast && <Toast message={toast.message} type={toast.type} onClose={() => setToast(null)} />}

      {/* ADD EXPENSE BUTTON / FORM */}
      {!showForm ? (
        <button onClick={() => setShowForm(true)} className="w-full bg-white rounded-xl shadow-md border-2 border-dashed border-gray-200 p-6 text-center hover:border-primary hover:bg-primary/5 transition group cursor-pointer">
          <div className="flex items-center justify-center gap-3">
            <span className="w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center text-primary text-xl font-bold group-hover:bg-primary/20 transition">+</span>
            <span className="text-lg font-semibold text-gray-700 group-hover:text-primary transition">Add Daily Expense</span>
          </div>
        </button>
      ) : (
        <div className="bg-white rounded-xl shadow-md border border-gray-100 p-4">
          <div className="flex items-center justify-between mb-3">
            <h2 className="text-base font-bold text-gray-900">Add Daily Expense</h2>
            <div className="flex gap-2">
              <button onClick={onManageCategories} className="px-2.5 py-1 text-xs font-medium text-gray-700 bg-gray-100 rounded-lg hover:bg-gray-200 transition">Add New Category</button>
              <button onClick={resetForm} className="px-2.5 py-1 text-xs font-medium text-gray-500 hover:text-gray-700 transition">✕</button>
            </div>
          </div>
          <div className="mb-2 relative" ref={dropdownRef}>
            <label className="block text-xs font-medium text-gray-600 mb-1">Search Subcategory</label>
            <div className="relative">
              <input ref={searchRef} type="text" value={searchTerm} onChange={(e) => { setSearchTerm(e.target.value); setShowDropdown(true); setSelCat(''); setSelSub(''); }} onFocus={() => setShowDropdown(true)} placeholder="Type subcategory name" className="w-full px-3 py-1.5 border border-gray-300 rounded-lg text-xs focus:ring-2 focus:ring-primary focus:border-primary outline-none transition" />
              {searchTerm && <button onClick={() => { setSearchTerm(''); setSelCat(''); setSelSub(''); setShowDropdown(false); }} className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600">&times;</button>}
            </div>
            {showDropdown && filteredSearch.length > 0 && (
              <div className="absolute z-20 w-full mt-1 bg-white border border-gray-200 rounded-lg shadow-lg max-h-48 overflow-y-auto">
                {filteredSearch.map((s, i) => (
                  <button key={i} onClick={() => selectSub(s)} className={`w-full flex items-center justify-between px-4 py-2 text-left hover:bg-primary/5 transition ${selSub === s.name ? 'bg-primary/10' : ''}`}>
                    <span className="text-sm font-medium text-gray-900">{s.name}</span>
                    <span className="text-xs text-gray-500">{s.category}</span>
                  </button>
                ))}
              </div>
            )}
            {showDropdown && searchTerm && filteredSearch.length === 0 && <div className="absolute z-20 w-full mt-1 bg-white border border-gray-200 rounded-lg shadow-lg p-3 text-center"><p className="text-xs text-gray-500">No subcategories found</p></div>}
          </div>
          <div className="mb-2">
            <label className="block text-xs font-medium text-gray-600 mb-1">Description</label>
            <textarea value={desc} onChange={(e) => setDesc(e.target.value)} placeholder="Type about your expense..." rows={2} className="w-full px-3 py-1.5 border border-gray-300 rounded-lg text-xs focus:ring-2 focus:ring-primary focus:border-primary outline-none transition resize-none" />
          </div>
          <div className="grid grid-cols-2 gap-3 mb-3">
            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1">Amount</label>
              <input type="number" min="0" step="0.01" value={amount} onChange={(e) => setAmount(e.target.value)} placeholder="Ex: 550" className="w-full px-3 py-1.5 border border-gray-300 rounded-lg text-xs focus:ring-2 focus:ring-primary focus:border-primary outline-none transition" />
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1">Payment Method</label>
              <select value={payMethod} onChange={(e) => setPayMethod(e.target.value)} className="w-full px-3 py-1.5 border border-gray-300 rounded-lg text-xs focus:ring-2 focus:ring-primary focus:border-primary outline-none transition">
                <option value="">Select Payment Method</option>
                {PAYMENT_METHODS.map(m => <option key={m} value={m}>{m}</option>)}
              </select>
            </div>
          </div>
          <div className="flex gap-2 justify-end">
            <button onClick={resetForm} className="px-3 py-1.5 text-xs font-medium text-gray-700 bg-gray-100 rounded-lg hover:bg-gray-200 transition">Cancel</button>
            <button onClick={handleSave} disabled={saving} className="px-3 py-1.5 text-xs font-semibold text-white bg-primary rounded-lg hover:bg-primary/90 disabled:opacity-50 transition">{saving ? 'Saving...' : 'Save Expense'}</button>
          </div>
        </div>
      )}

      {/* FILTERS */}
      <div className="bg-white rounded-xl shadow-md border border-gray-100 p-4">
        {/* Date Range Buttons */}
        <div className="flex flex-wrap gap-2 mb-3">
          {[
            { label: 'Today', value: 'today' },
            { label: 'Weekly', value: 'week' },
            { label: 'Monthly', value: 'month' },
            { label: 'Yearly', value: 'year' },
            { label: 'Custom', value: 'custom' },
          ].map(p => (
            <button key={p.value} onClick={() => setFRange(p.value)}
              className={`px-3 py-1.5 rounded-lg text-xs font-medium transition ${fRange === p.value ? 'bg-primary text-white' : 'bg-gray-100 text-gray-600 hover:bg-gray-200'}`}>
              {p.label}
            </button>
          ))}
        </div>

        {/* Custom Date Range */}
        {fRange === 'custom' && (
          <div className="flex gap-2 mb-3">
            <div className="flex-1">
              <label className="block text-xs text-gray-500 mb-1">Start Date</label>
              <input type="date" value={fCustomStart} onChange={e => setFCustomStart(e.target.value)}
                className="w-full px-3 py-1.5 border border-gray-300 rounded-lg text-xs focus:ring-2 focus:ring-primary outline-none" />
            </div>
            <div className="flex-1">
              <label className="block text-xs text-gray-500 mb-1">End Date</label>
              <input type="date" value={fCustomEnd} onChange={e => setFCustomEnd(e.target.value)}
                className="w-full px-3 py-1.5 border border-gray-300 rounded-lg text-xs focus:ring-2 focus:ring-primary outline-none" />
            </div>
          </div>
        )}

        {/* Payment + Category Dropdowns */}
        <div className="flex gap-3">
          <div className="flex-1">
            <label className="block text-xs text-gray-500 mb-1">Payment Method</label>
            <select value={fPay} onChange={e => setFPay(e.target.value)}
              className="w-full px-3 py-1.5 border border-gray-300 rounded-lg text-xs focus:ring-2 focus:ring-primary outline-none">
              <option value="">All Methods</option>
              {PAYMENT_METHODS.map(m => <option key={m} value={m}>{m}</option>)}
            </select>
          </div>
          <div className="flex-1">
            <label className="block text-xs text-gray-500 mb-1">Category</label>
            <select value={fCat} onChange={e => setFCat(e.target.value)}
              className="w-full px-3 py-1.5 border border-gray-300 rounded-lg text-xs focus:ring-2 focus:ring-primary outline-none">
              <option value="">All Categories</option>
              {uniqueCats.map(c => <option key={c} value={c}>{c}</option>)}
            </select>
          </div>
        </div>
      </div>

      {/* EXPENSES BY DATE */}
      <div className="bg-white rounded-xl shadow-md border border-gray-100 overflow-hidden">
        <div className="px-5 py-3 border-b border-gray-100"><h2 className="text-sm font-semibold text-gray-900">Expenses</h2></div>
        {expLoading ? <LoadingSpinner /> : grouped.length === 0 ? (
          <div className="p-8 text-center"><div className="text-4xl mb-2">📋</div><p className="text-gray-500 text-sm">{expenses.length === 0 ? 'No expenses yet' : 'No expenses match filters'}</p></div>
        ) : (
          <div>
            {grouped.map((g) => (
              <div key={toDateKey(g.date)}>
                <div className="px-5 py-2 bg-gray-50 border-b border-gray-100 flex items-center justify-between">
                  <span className="text-xs font-semibold text-gray-600">{formatDate(g.date)}</span>
                  <span className="text-xs font-bold text-gray-800">{formatCurrency(g.total)}</span>
                </div>
                <div className="divide-y divide-gray-100">
                  {g.items.map(exp => editId === exp._id ? (
                    <div key={exp._id} className="p-3 bg-primary/5">
                      <div className="grid grid-cols-2 md:grid-cols-4 gap-2 mb-2">
                        <div><label className="block text-xs text-gray-500 mb-1">Date</label><input type="date" value={editForm.date} onChange={e => setEditForm({ ...editForm, date: e.target.value })} className="w-full px-2 py-1 border border-gray-300 rounded text-xs focus:ring-1 focus:ring-primary outline-none" /></div>
                        <div><label className="block text-xs text-gray-500 mb-1">Amount</label><input type="number" value={editForm.amount} onChange={e => setEditForm({ ...editForm, amount: e.target.value })} className="w-full px-2 py-1 border border-gray-300 rounded text-xs focus:ring-1 focus:ring-primary outline-none" /></div>
                        <div><label className="block text-xs text-gray-500 mb-1">Category</label><select value={editForm.category} onChange={e => setEditForm({ ...editForm, category: e.target.value, subcategory: '' })} className="w-full px-2 py-1 border border-gray-300 rounded text-xs focus:ring-1 focus:ring-primary outline-none">{categories.map(c => <option key={c._id} value={c.name}>{c.name}</option>)}</select></div>
                        <div><label className="block text-xs text-gray-500 mb-1">Payment</label><select value={editForm.paymentMethod} onChange={e => setEditForm({ ...editForm, paymentMethod: e.target.value })} className="w-full px-2 py-1 border border-gray-300 rounded text-xs focus:ring-1 focus:ring-primary outline-none">{PAYMENT_METHODS.map(m => <option key={m} value={m}>{m}</option>)}</select></div>
                      </div>
                      <div className="flex gap-2 justify-end">
                        <button onClick={() => { setEditId(null); setEditForm(null); }} className="px-2 py-1 text-xs text-gray-600 bg-gray-100 rounded hover:bg-gray-200 transition">Cancel</button>
                        <button onClick={handleSaveEdit} disabled={saving} className="px-3 py-1 text-xs font-medium text-white bg-primary rounded hover:bg-primary/90 disabled:opacity-50 transition">{saving ? 'Saving...' : 'Save'}</button>
                      </div>
                    </div>
                  ) : renderExpenseRow(exp))}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
