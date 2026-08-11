import React, { useState, useEffect } from 'react';
import { Plus, Pencil, Trash2, FolderOpen, ArrowLeft, Check, X } from 'lucide-react';
import { apiRequest } from '../api.js';
import LoadingSpinner from './LoadingSpinner.jsx';
import Toast from './Toast.jsx';
import Button from './Button.jsx';
import ActionDropdown from './ActionDropdown.jsx';
import EmptyState from './EmptyState.jsx';
import useConfirm from '../hooks/useConfirm';

export default function ExpenseCategoriesPage({ token }) {
  const [confirm, confirmDialog] = useConfirm();
  const [categories, setCategories] = useState([]);
  const [loading, setLoading] = useState(true);
  const [toast, setToast] = useState(null);

  // Selection
  const [selectedCat, setSelectedCat] = useState(null);

  // Add category
  const [newCatName, setNewCatName] = useState('');
  const [showAddCat, setShowAddCat] = useState(false);

  // Add subcategory
  const [newSubName, setNewSubName] = useState('');
  const [showAddSub, setShowAddSub] = useState(false);

  // Edit state
  const [editingCatId, setEditingCatId] = useState(null);
  const [editCatName, setEditCatName] = useState('');
  const [editingSubId, setEditingSubId] = useState(null);
  const [editSubName, setEditSubName] = useState('');

  const showToast = (msg, type = 'success') => {
    setToast({ message: msg, type });
    setTimeout(() => setToast(null), 3000);
  };

  const fetchCategories = async () => {
    try {
      setLoading(true);
      const res = await apiRequest('/expense-categories', { token });
      setCategories(res.categories || []);
    } catch (err) {
      showToast(err?.message || 'Failed to load', 'error');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { if (token) fetchCategories(); }, [token]);

  // Auto-select first category
  useEffect(() => {
    if (categories.length > 0 && !selectedCat) {
      setSelectedCat(categories[0]._id);
    }
  }, [categories]);

  const selectedCategory = categories.find(c => c._id === selectedCat);

  // ---- Category CRUD ----
  const handleAddCategory = async () => {
    if (!newCatName.trim()) return;
    try {
      await apiRequest('/expense-categories', { method: 'POST', token, body: { name: newCatName.trim() } });
      setNewCatName(''); setShowAddCat(false);
      showToast('Category added');
      fetchCategories();
    } catch (err) { showToast(err?.message || 'Failed', 'error'); }
  };

  const handleRenameCategory = async (id) => {
    if (!editCatName.trim()) return;
    try {
      await apiRequest(`/expense-categories/${id}`, { method: 'PUT', token, body: { name: editCatName.trim() } });
      setEditingCatId(null);
      showToast('Renamed');
      fetchCategories();
    } catch (err) { showToast(err?.message || 'Failed', 'error'); }
  };

  const handleDeleteCategory = async (id, name) => {
    if (!(await confirm({ title: `Delete ${name}?`, message: 'This category and all of its subcategories will be removed.', confirmText: 'Delete category', destructive: true }))) return;
    try {
      await apiRequest(`/expense-categories/${id}`, { method: 'DELETE', token });
      if (selectedCat === id) setSelectedCat(null);
      showToast('Deleted');
      fetchCategories();
    } catch (err) { showToast(err?.message || 'Failed', 'error'); }
  };

  // ---- Subcategory CRUD ----
  const handleAddSubcategory = async () => {
    if (!newSubName.trim() || !selectedCat) return;
    try {
      const res = await apiRequest(`/expense-categories/${selectedCat}/subcategories`, {
        method: 'POST', token, body: { name: newSubName.trim() },
      });
      setNewSubName(''); setShowAddSub(false);
      showToast('Subcategory added');
      // Update local state
      setCategories(prev => prev.map(c => c._id === selectedCat ? res.category : c));
    } catch (err) { showToast(err?.message || 'Failed', 'error'); }
  };

  const handleRenameSub = async (subId) => {
    if (!editSubName.trim() || !selectedCat) return;
    try {
      const res = await apiRequest(`/expense-categories/${selectedCat}/subcategories/${subId}`, {
        method: 'PUT', token, body: { name: editSubName.trim() },
      });
      setEditingSubId(null);
      showToast('Renamed');
      setCategories(prev => prev.map(c => c._id === selectedCat ? res.category : c));
    } catch (err) { showToast(err?.message || 'Failed', 'error'); }
  };

  const handleDeleteSub = async (subId) => {
    if (!(await confirm({ title: 'Delete this subcategory?', confirmText: 'Delete', destructive: true }))) return;
    try {
      const res = await apiRequest(`/expense-categories/${selectedCat}/subcategories/${subId}`, {
        method: 'DELETE', token,
      });
      showToast('Deleted');
      setCategories(prev => prev.map(c => c._id === selectedCat ? res.category : c));
    } catch (err) { showToast(err?.message || 'Failed', 'error'); }
  };

  return (
    <div className="space-y-4">
      {confirmDialog}

      {toast && <Toast message={toast.message} type={toast.type} onClose={() => setToast(null)} />}

      <div className="grid md:grid-cols-[20rem,1fr] gap-4">
        {/* ============ LEFT PANEL: Categories ============ */}
        <div className="card overflow-hidden flex flex-col">
          <div className="px-4 py-3 border-b border-line flex items-center justify-between">
            <h2 className="text-sm font-semibold text-ink">All categories</h2>
            <button
              onClick={() => setShowAddCat(!showAddCat)}
              className="w-7 h-7 flex items-center justify-center rounded-control bg-primary-50 text-primary hover:bg-primary-100 transition"
              aria-label="Add category"
            >
              <Plus size={15} />
            </button>
          </div>

          {/* Add Category Form */}
          {showAddCat && (
            <div className="px-4 py-3 border-b border-line bg-canvas">
              <div className="flex gap-2">
                <input
                  type="text"
                  value={newCatName}
                  onChange={(e) => setNewCatName(e.target.value)}
                  onKeyDown={(e) => e.key === 'Enter' && handleAddCategory()}
                  placeholder="Category name…"
                  className="input flex-1"
                  autoFocus
                />
                <Button onClick={handleAddCategory} disabled={!newCatName.trim()}>Add</Button>
              </div>
            </div>
          )}

          {/* Category List */}
          <div className="flex-1 overflow-y-auto">
            {loading ? (
              <LoadingSpinner />
            ) : categories.length === 0 ? (
              <EmptyState title="No categories yet" message="Add your first expense category to get started." />
            ) : (
              <div className="divide-y divide-line">
                {categories.map((cat) => (
                  <div
                    key={cat._id}
                    onClick={() => { setSelectedCat(cat._id); setEditingCatId(null); }}
                    className={`flex items-center gap-3 px-4 py-3 cursor-pointer transition ${
                      selectedCat === cat._id
                        ? 'bg-primary-50 border-l-4 border-primary'
                        : 'hover:bg-canvas border-l-4 border-transparent'
                    }`}
                  >
                    {editingCatId === cat._id ? (
                      <input
                        type="text"
                        value={editCatName}
                        onChange={(e) => setEditCatName(e.target.value)}
                        onKeyDown={(e) => e.key === 'Enter' && handleRenameCategory(cat._id)}
                        onClick={(e) => e.stopPropagation()}
                        className="input flex-1 py-1"
                        autoFocus
                      />
                    ) : (
                      <>
                        <div className="w-3 h-3 rounded-full flex-shrink-0" style={{ backgroundColor: cat.color }} />
                        <span className="flex-1 text-sm font-medium text-ink">{cat.name}</span>
                        <span className="text-xs text-ink-faint">{cat.subcategories?.length || 0}</span>
                        <div onClick={(e) => e.stopPropagation()}>
                          <ActionDropdown
                            actions={[
                              { label: 'Edit', icon: Pencil, onClick: () => { setEditingCatId(cat._id); setEditCatName(cat.name); } },
                              { label: 'Delete', icon: Trash2, destructive: true, onClick: () => handleDeleteCategory(cat._id, cat.name) },
                            ]}
                          />
                        </div>
                      </>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Add Category Button */}
          {!showAddCat && (
            <div className="p-3 border-t border-line">
              <Button variant="secondary" icon={Plus} onClick={() => setShowAddCat(true)} className="w-full">
                Add new category
              </Button>
            </div>
          )}
        </div>

        {/* ============ RIGHT PANEL: Subcategories ============ */}
        <div className="card overflow-hidden flex flex-col">
          {selectedCategory ? (
            <>
              <div className="px-5 py-3 border-b border-line flex items-center justify-between">
                <div>
                  <h2 className="text-sm font-semibold text-ink">
                    {selectedCategory.name} — subcategories
                  </h2>
                  <p className="text-xs text-ink-soft">{selectedCategory.subcategories?.length || 0} items</p>
                </div>
                <Button size="sm" icon={Plus} onClick={() => setShowAddSub(!showAddSub)}>Add</Button>
              </div>

              {/* Add Subcategory Form */}
              {showAddSub && (
                <div className="px-5 py-3 border-b border-line bg-canvas">
                  <div className="flex gap-2">
                    <input
                      type="text"
                      value={newSubName}
                      onChange={(e) => setNewSubName(e.target.value)}
                      onKeyDown={(e) => e.key === 'Enter' && handleAddSubcategory()}
                      placeholder="Subcategory name…"
                      className="input flex-1"
                      autoFocus
                    />
                    <Button onClick={handleAddSubcategory} disabled={!newSubName.trim()}>Add</Button>
                  </div>
                </div>
              )}

              {/* Subcategory List */}
              <div className="flex-1 overflow-y-auto">
                {!selectedCategory.subcategories || selectedCategory.subcategories.length === 0 ? (
                  <EmptyState icon={FolderOpen} title="No subcategories yet" message="Add one using the button above." />
                ) : (
                  <div className="divide-y divide-line">
                    {selectedCategory.subcategories.map((sub) => (
                      <div key={sub._id} className="flex items-center gap-3 px-5 py-3 hover:bg-canvas transition">
                        {editingSubId === sub._id ? (
                          <>
                            <input
                              type="text"
                              value={editSubName}
                              onChange={(e) => setEditSubName(e.target.value)}
                              onKeyDown={(e) => e.key === 'Enter' && handleRenameSub(sub._id)}
                              className="input flex-1 py-1.5"
                              autoFocus
                            />
                            <button onClick={() => handleRenameSub(sub._id)} className="w-9 h-9 flex items-center justify-center rounded-control text-success hover:bg-success-soft" aria-label="Save">
                              <Check size={15} />
                            </button>
                            <button onClick={() => setEditingSubId(null)} className="w-9 h-9 flex items-center justify-center rounded-control text-ink-soft hover:bg-canvas" aria-label="Cancel">
                              <X size={15} />
                            </button>
                          </>
                        ) : (
                          <>
                            <span className="flex-1 text-sm text-ink">{sub.name}</span>
                            <ActionDropdown
                              actions={[
                                { label: 'Edit', icon: Pencil, onClick: () => { setEditingSubId(sub._id); setEditSubName(sub.name); } },
                                { label: 'Delete', icon: Trash2, destructive: true, onClick: () => handleDeleteSub(sub._id) },
                              ]}
                            />
                          </>
                        )}
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </>
          ) : (
            <div className="flex-1 flex items-center justify-center">
              <EmptyState icon={ArrowLeft} title="No category selected" message="Select a category on the left to manage its subcategories." />
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
