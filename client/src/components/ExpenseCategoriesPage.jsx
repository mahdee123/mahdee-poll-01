import React, { useState, useEffect } from 'react';
import { apiRequest } from '../api.js';
import LoadingSpinner from './LoadingSpinner.jsx';
import Toast from './Toast.jsx';

export default function ExpenseCategoriesPage({ token }) {
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

  // Three-dot menu
  const [openMenu, setOpenMenu] = useState(null);

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
    if (!confirm(`Delete "${name}" and all its subcategories?`)) return;
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
    if (!confirm('Delete this subcategory?')) return;
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
      {toast && <Toast message={toast.message} type={toast.type} onClose={() => setToast(null)} />}

      <div className="flex gap-4">
        {/* ============ LEFT PANEL: Categories ============ */}
        <div className="w-80 flex-shrink-0 bg-white rounded-lg shadow overflow-hidden flex flex-col">
          <div className="px-4 py-3 border-b border-gray-200 flex items-center justify-between">
            <h2 className="text-sm font-semibold text-gray-900">All Categories</h2>
            <button
              onClick={() => setShowAddCat(!showAddCat)}
              className="w-7 h-7 flex items-center justify-center rounded-lg bg-primary/10 text-primary hover:bg-primary/20 transition text-lg font-bold"
            >
              +
            </button>
          </div>

          {/* Add Category Form */}
          {showAddCat && (
            <div className="px-4 py-3 border-b border-gray-200 bg-gray-50">
              <div className="flex gap-2">
                <input
                  type="text"
                  value={newCatName}
                  onChange={(e) => setNewCatName(e.target.value)}
                  onKeyDown={(e) => e.key === 'Enter' && handleAddCategory()}
                  placeholder="Category name..."
                  className="flex-1 px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-primary outline-none"
                  autoFocus
                />
                <button
                  onClick={handleAddCategory}
                  disabled={!newCatName.trim()}
                  className="px-4 py-2 bg-primary text-white rounded-lg text-sm font-medium hover:bg-primary/90 disabled:opacity-50 transition"
                >
                  Add
                </button>
              </div>
            </div>
          )}

          {/* Category List */}
          <div className="flex-1 overflow-y-auto">
            {loading ? (
              <LoadingSpinner />
            ) : categories.length === 0 ? (
              <div className="p-8 text-center">
                <p className="text-gray-500 text-sm">No categories yet</p>
              </div>
            ) : (
              <div className="divide-y divide-gray-100">
                {categories.map((cat) => (
                  <div
                    key={cat._id}
                    onClick={() => { setSelectedCat(cat._id); setEditingCatId(null); setOpenMenu(null); }}
                    className={`flex items-center gap-3 px-4 py-3 cursor-pointer transition ${
                      selectedCat === cat._id
                        ? 'bg-primary/5 border-l-4 border-primary'
                        : 'hover:bg-gray-50 border-l-4 border-transparent'
                    }`}
                  >
                    {editingCatId === cat._id ? (
                      <input
                        type="text"
                        value={editCatName}
                        onChange={(e) => setEditCatName(e.target.value)}
                        onKeyDown={(e) => e.key === 'Enter' && handleRenameCategory(cat._id)}
                        onClick={(e) => e.stopPropagation()}
                        className="flex-1 px-2 py-1 border border-gray-300 rounded text-sm focus:ring-2 focus:ring-primary outline-none"
                        autoFocus
                      />
                    ) : (
                      <>
                        <div className="w-3 h-3 rounded-full flex-shrink-0" style={{ backgroundColor: cat.color }} />
                        <span className="flex-1 text-sm font-medium text-gray-800">{cat.name}</span>
                        <span className="text-xs text-gray-400">{cat.subcategories?.length || 0}</span>
                        <div className="relative">
                          <button
                            onClick={(e) => { e.stopPropagation(); setOpenMenu(openMenu === `cat-${cat._id}` ? null : `cat-${cat._id}`); }}
                            className="text-gray-400 hover:text-gray-600 text-lg leading-none px-1"
                          >
                            ⋮
                          </button>
                          {openMenu === `cat-${cat._id}` && (
                            <div className="absolute right-0 top-8 bg-white border border-gray-200 rounded-lg shadow-lg z-10 py-1 w-24">
                              <button
                                onClick={(e) => { e.stopPropagation(); setEditingCatId(cat._id); setEditCatName(cat.name); setOpenMenu(null); }}
                                className="w-full text-left px-3 py-2 text-sm text-gray-700 hover:bg-gray-100 flex items-center gap-2"
                              >
                                ✏️ Edit
                              </button>
                              <button
                                onClick={(e) => { e.stopPropagation(); handleDeleteCategory(cat._id, cat.name); setOpenMenu(null); }}
                                className="w-full text-left px-3 py-2 text-sm text-red-600 hover:bg-red-50 flex items-center gap-2"
                              >
                                🗑️ Delete
                              </button>
                            </div>
                          )}
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
            <div className="p-3 border-t border-gray-200">
              <button
                onClick={() => setShowAddCat(true)}
                className="w-full py-2 border-2 border-dashed border-gray-300 rounded-lg text-sm text-gray-500 hover:text-primary hover:border-primary transition font-medium"
              >
                + Add New Category
              </button>
            </div>
          )}
        </div>

        {/* ============ RIGHT PANEL: Subcategories ============ */}
        <div className="flex-1 bg-white rounded-lg shadow overflow-hidden flex flex-col">
          {selectedCategory ? (
            <>
              <div className="px-5 py-3 border-b border-gray-200 flex items-center justify-between">
                <div>
                  <h2 className="text-sm font-semibold text-gray-900">
                    {selectedCategory.name} — Subcategories
                  </h2>
                  <p className="text-xs text-gray-500">{selectedCategory.subcategories?.length || 0} items</p>
                </div>
                <button
                  onClick={() => setShowAddSub(!showAddSub)}
                  className="px-3 py-1.5 bg-primary text-white rounded-lg text-sm font-medium hover:bg-primary/90 transition"
                >
                  + Add
                </button>
              </div>

              {/* Add Subcategory Form */}
              {showAddSub && (
                <div className="px-5 py-3 border-b border-gray-200 bg-gray-50">
                  <div className="flex gap-2">
                    <input
                      type="text"
                      value={newSubName}
                      onChange={(e) => setNewSubName(e.target.value)}
                      onKeyDown={(e) => e.key === 'Enter' && handleAddSubcategory()}
                      placeholder="Subcategory name..."
                      className="flex-1 px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-primary outline-none"
                      autoFocus
                    />
                    <button
                      onClick={handleAddSubcategory}
                      disabled={!newSubName.trim()}
                      className="px-4 py-2 bg-primary text-white rounded-lg text-sm font-medium hover:bg-primary/90 disabled:opacity-50 transition"
                    >
                      Add
                    </button>
                  </div>
                </div>
              )}

              {/* Subcategory List */}
              <div className="flex-1 overflow-y-auto">
                {!selectedCategory.subcategories || selectedCategory.subcategories.length === 0 ? (
                  <div className="p-12 text-center">
                    <div className="text-4xl mb-3">📂</div>
                    <p className="text-gray-500 text-sm">No subcategories yet</p>
                    <p className="text-gray-400 text-xs mt-1">Add one using the button above</p>
                  </div>
                ) : (
                  <div className="divide-y divide-gray-100">
                    {selectedCategory.subcategories.map((sub) => (
                      <div key={sub._id} className="flex items-center gap-3 px-5 py-3 hover:bg-gray-50 transition group">
                        {editingSubId === sub._id ? (
                          <>
                            <input
                              type="text"
                              value={editSubName}
                              onChange={(e) => setEditSubName(e.target.value)}
                              onKeyDown={(e) => e.key === 'Enter' && handleRenameSub(sub._id)}
                              className="flex-1 px-3 py-1.5 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-primary outline-none"
                              autoFocus
                            />
                            <button
                              onClick={() => handleRenameSub(sub._id)}
                              className="px-3 py-1.5 bg-primary text-white text-sm rounded-lg font-medium hover:bg-primary/90 transition"
                            >
                              Save
                            </button>
                            <button
                              onClick={() => setEditingSubId(null)}
                              className="px-3 py-1.5 bg-gray-100 text-gray-700 text-sm rounded-lg font-medium hover:bg-gray-200 transition"
                            >
                              Cancel
                            </button>
                          </>
                        ) : (
                          <>
                            <span className="flex-1 text-sm text-gray-800">{sub.name}</span>
                            <div className="relative">
                              <button
                                onClick={() => setOpenMenu(openMenu === `sub-${sub._id}` ? null : `sub-${sub._id}`)}
                                className="text-gray-400 hover:text-gray-600 text-lg leading-none px-1"
                              >
                                ⋮
                              </button>
                              {openMenu === `sub-${sub._id}` && (
                                <div className="absolute right-0 top-8 bg-white border border-gray-200 rounded-lg shadow-lg z-10 py-1 w-28">
                                  <button
                                    onClick={() => { setEditingSubId(sub._id); setEditSubName(sub.name); setOpenMenu(null); }}
                                    className="w-full text-left px-3 py-2 text-sm text-gray-700 hover:bg-gray-100 flex items-center gap-2"
                                  >
                                    ✏️ Edit
                                  </button>
                                  <button
                                    onClick={() => { handleDeleteSub(sub._id); setOpenMenu(null); }}
                                    className="w-full text-left px-3 py-2 text-sm text-red-600 hover:bg-red-50 flex items-center gap-2"
                                  >
                                    🗑️ Delete
                                  </button>
                                </div>
                              )}
                            </div>
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
              <div className="text-center">
                <div className="text-5xl mb-3">👈</div>
                <p className="text-gray-500 text-sm">Select a category to manage subcategories</p>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
