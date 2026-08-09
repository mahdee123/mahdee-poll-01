import React, { useState } from 'react';

export default function BeverageProductManager({ products = [], onAdd, onUpdate, onDelete, onClose }) {
  const [showForm, setShowForm] = useState(false);
  const [editingId, setEditingId] = useState(null);
  const [formData, setFormData] = useState({
    name: '',
    costPrice: '',
    sellingPrice: '',
    unit: 'Bottle',
    description: '',
  });

  const handleAddClick = () => {
    setFormData({
      name: '',
      costPrice: '',
      sellingPrice: '',
      unit: 'Bottle',
      description: '',
    });
    setEditingId(null);
    setShowForm(true);
  };

  const handleEditClick = (product) => {
    setFormData({
      name: product.name,
      costPrice: product.costPrice,
      sellingPrice: product.sellingPrice,
      unit: product.unit,
      description: product.description,
    });
    setEditingId(product._id);
    setShowForm(true);
  };

  const handleInputChange = (e) => {
    const { name, value } = e.target;
    setFormData({
      ...formData,
      [name]: ['costPrice', 'sellingPrice'].includes(name) ? parseFloat(value) || '' : value,
    });
  };

  const handleSubmit = (e) => {
    e.preventDefault();

    if (!formData.name.trim()) {
      alert('Product name is required');
      return;
    }
    if (!formData.costPrice || formData.costPrice < 0) {
      alert('Valid cost price is required');
      return;
    }
    if (!formData.sellingPrice || formData.sellingPrice < 0) {
      alert('Valid selling price is required');
      return;
    }

    if (editingId) {
      onUpdate(editingId, formData);
    } else {
      onAdd(formData);
    }
    setShowForm(false);
  };

  const handleCancel = () => {
    setShowForm(false);
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-lg max-w-4xl w-full max-h-[90vh] sm:max-h-screen overflow-y-auto">
        {/* Header */}
        <div className="sticky top-0 bg-white border-b p-4 flex items-center justify-between">
          <h2 className="text-lg font-semibold">🧃 Beverage Products</h2>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600 text-2xl min-h-[44px] min-w-[44px] flex items-center justify-center">
            ✕
          </button>
        </div>

        {/* Content */}
        <div className="p-6">
          {/* Add Button */}
          {!showForm && (
            <button
              onClick={handleAddClick}
              className="mb-6 bg-primary text-white px-4 py-2 rounded-lg hover:bg-primary/90 font-medium"
            >
              ➕ Add New Product
            </button>
          )}

          {/* Form */}
          {showForm && (
            <form onSubmit={handleSubmit} className="mb-6 p-4 bg-gray-50 rounded-lg border">
              <h3 className="font-semibold mb-4">{editingId ? '✏️ Edit Product' : '📝 New Product'}</h3>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Product Name *</label>
                  <input
                    type="text"
                    name="name"
                    value={formData.name}
                    onChange={handleInputChange}
                    placeholder="e.g., Water, Orange Juice, Mango Juice"
                    className="w-full border rounded-lg px-3 py-2 text-sm"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Unit</label>
                  <select
                    name="unit"
                    value={formData.unit}
                    onChange={handleInputChange}
                    className="w-full border rounded-lg px-3 py-2 text-sm"
                  >
                    <option value="Bottle">Bottle</option>
                    <option value="Cup">Cup</option>
                    <option value="Liter">Liter</option>
                    <option value="Glass">Glass</option>
                  </select>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Cost Price (Taka) *</label>
                  <input
                    type="number"
                    name="costPrice"
                    value={formData.costPrice}
                    onChange={handleInputChange}
                    placeholder="0.00"
                    step="0.01"
                    min="0"
                    className="w-full border rounded-lg px-3 py-2 text-sm"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Selling Price (Taka) *</label>
                  <input
                    type="number"
                    name="sellingPrice"
                    value={formData.sellingPrice}
                    onChange={handleInputChange}
                    placeholder="0.00"
                    step="0.01"
                    min="0"
                    className="w-full border rounded-lg px-3 py-2 text-sm"
                  />
                </div>
              </div>

              <div className="mb-4">
                <label className="block text-sm font-medium text-gray-700 mb-1">Description</label>
                <textarea
                  name="description"
                  value={formData.description}
                  onChange={handleInputChange}
                  placeholder="Optional description"
                  rows="2"
                  className="w-full border rounded-lg px-3 py-2 text-sm"
                />
              </div>

              {/* Profit calculation display */}
              {formData.costPrice && formData.sellingPrice && (
                <div className="mb-4 p-3 bg-primary/5 border border-primary/20 rounded-lg">
                  <p className="text-sm text-gray-700">
                    📊 <strong>Profit per unit:</strong> {formData.sellingPrice - formData.costPrice} BDT
                    ({(((formData.sellingPrice - formData.costPrice) / formData.sellingPrice) * 100).toFixed(1)}% margin)
                  </p>
                </div>
              )}

              <div className="flex gap-2 justify-end">
                <button
                  type="button"
                  onClick={handleCancel}
                  className="px-4 py-2 bg-gray-200 text-gray-800 rounded-lg hover:bg-gray-300 font-medium"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 font-medium"
                >
                  {editingId ? '✓ Update Product' : '✓ Add Product'}
                </button>
              </div>
            </form>
          )}

          {/* Products List */}
          {products.length === 0 ? (
            <div className="text-center p-8 text-gray-500">
              <p>No products yet. Add your first beverage product!</p>
            </div>
          ) : (
            <div className="space-y-3">
              {products.map((product) => (
                <div
                  key={product._id}
                  className="p-4 border rounded-lg hover:bg-gray-50 flex items-center justify-between"
                >
                  <div className="flex-1">
                    <h4 className="font-semibold text-gray-800">
                      {product.name}
                      <span className="text-xs bg-primary/10 text-primary px-2 py-1 rounded ml-2">
                        {product.unit}
                      </span>
                    </h4>
                    <p className="text-sm text-gray-600 mt-1">
                      💰 Cost: {product.costPrice} BDT | Sell: {product.sellingPrice} BDT |
                      <span className="text-green-600 font-semibold ml-1">
                        Profit: {product.sellingPrice - product.costPrice} BDT
                      </span>
                    </p>
                    <p className="text-sm text-gray-600">
                      📦 Current Stock: <strong className="text-lg">{product.currentStock}</strong> {product.unit}s
                    </p>
                    {product.description && (
                      <p className="text-xs text-gray-500 mt-1 italic">{product.description}</p>
                    )}
                  </div>

                  <div className="flex gap-2 ml-4">
                    <button
                      onClick={() => handleEditClick(product)}
                      className="px-3 py-1 bg-yellow-500 text-white rounded hover:bg-yellow-600 text-sm font-medium"
                    >
                      ✏️ Edit
                    </button>
                    <button
                      onClick={() => {
                        if (window.confirm(`Delete "${product.name}"?`)) {
                          onDelete(product._id);
                        }
                      }}
                      className="px-3 py-1 bg-red-500 text-white rounded hover:bg-red-600 text-sm font-medium"
                    >
                      🗑️ Delete
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
