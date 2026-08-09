import React, { useState } from 'react';

export default function InventoryPurchaseForm({ products = [], onClose, onSave }) {
  const [formData, setFormData] = useState({
    productId: '',
    quantity: 1,
    costPrice: '',
    date: new Date().toISOString().split('T')[0],
    notes: '',
  });

  const [calculation, setCalculation] = useState({
    totalCost: 0,
  });

  const selectedProduct = products.find((p) => p._id === formData.productId);

  const handleInputChange = (e) => {
    const { name, value } = e.target;
    const processed = ['quantity', 'costPrice'].includes(name) ? parseFloat(value) || '' : value;
    setFormData({ ...formData, [name]: processed });

    // Auto-calculate total cost
    if (name === 'quantity' || name === 'costPrice') {
      const qty = name === 'quantity' ? parseFloat(value) : formData.quantity;
      const cost = name === 'costPrice' ? parseFloat(value) : formData.costPrice;
      setCalculation({
        totalCost: qty && cost ? qty * cost : 0,
      });
    }
  };

  const handleSubmit = (e) => {
    e.preventDefault();

    if (!formData.productId) {
      alert('Please select a product');
      return;
    }
    if (!formData.quantity || formData.quantity <= 0) {
      alert('Quantity must be greater than 0');
      return;
    }
    if (!formData.costPrice || formData.costPrice < 0) {
      alert('Cost price must be valid');
      return;
    }

    onSave({
      ...formData,
      quantity: parseInt(formData.quantity),
      costPrice: parseFloat(formData.costPrice),
    });

    setFormData({
      productId: '',
      quantity: 1,
      costPrice: '',
      date: new Date().toISOString().split('T')[0],
      notes: '',
    });
    setCalculation({ totalCost: 0 });
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-lg max-w-2xl w-full max-h-[90vh] sm:max-h-screen overflow-y-auto">
        {/* Header */}
        <div className="sticky top-0 bg-white border-b p-4 flex items-center justify-between">
          <h2 className="text-lg font-semibold">📦 Record Inventory Purchase</h2>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600 text-2xl min-h-[44px] min-w-[44px] flex items-center justify-center">
            ✕
          </button>
        </div>

        {/* Form */}
        <form onSubmit={handleSubmit} className="p-6 space-y-6">
          {/* Product Selection */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">🧃 Select Product *</label>
            <select
              name="productId"
              value={formData.productId}
              onChange={handleInputChange}
              className="w-full border rounded-lg px-3 py-2 text-sm"
              required
            >
              <option value="">-- Choose a product --</option>
              {products.map((product) => (
                <option key={product._id} value={product._id}>
                  {product.name} ({product.unit}) - Current stock: {product.currentStock}
                </option>
              ))}
            </select>
          </div>

          {/* Product Info Display */}
          {selectedProduct && (
            <div className="p-4 bg-primary/5 border border-primary/20 rounded-lg">
              <h4 className="font-semibold text-gray-800 mb-2">📊 Product Info</h4>
              <p className="text-sm text-gray-700">
                <strong>Current Stock:</strong> {selectedProduct.currentStock} {selectedProduct.unit}s
              </p>
              <p className="text-sm text-gray-700">
                <strong>Current Cost Price:</strong> {selectedProduct.costPrice} BDT per {selectedProduct.unit}
              </p>
              <p className="text-sm text-gray-700">
                <strong>Current Selling Price:</strong> {selectedProduct.sellingPrice} BDT per {selectedProduct.unit}
              </p>
            </div>
          )}

          {/* Purchase Details Grid */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">📅 Purchase Date</label>
              <input
                type="date"
                name="date"
                value={formData.date}
                onChange={handleInputChange}
                className="w-full border rounded-lg px-3 py-2 text-sm"
                required
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">📍 Quantity *</label>
              <input
                type="number"
                name="quantity"
                value={formData.quantity}
                onChange={handleInputChange}
                placeholder="0"
                min="1"
                step="1"
                className="w-full border rounded-lg px-3 py-2 text-sm"
                required
              />
            </div>

            <div className="md:col-span-2">
              <label className="block text-sm font-medium text-gray-700 mb-1">
                💰 Cost Price per {selectedProduct?.unit} (Taka) *
              </label>
              <input
                type="number"
                name="costPrice"
                value={formData.costPrice}
                onChange={handleInputChange}
                placeholder="0.00"
                step="0.01"
                min="0"
                className="w-full border rounded-lg px-3 py-2 text-sm"
                required
              />
            </div>
          </div>

          {/* Notes */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">📝 Notes (Optional)</label>
            <textarea
              name="notes"
              value={formData.notes}
              onChange={handleInputChange}
              placeholder="e.g., Supplier name, invoice number"
              rows="2"
              className="w-full border rounded-lg px-3 py-2 text-sm"
            />
          </div>

          {/* Cost Calculation */}
          {formData.quantity && formData.costPrice && (
            <div className="p-4 bg-green-50 border border-green-200 rounded-lg">
              <h4 className="font-semibold text-gray-800 mb-2">💵 Purchase Cost Summary</h4>
              <p className="text-sm text-gray-700 mb-1">
                Quantity: <strong>{formData.quantity}</strong> {selectedProduct?.unit}s
              </p>
              <p className="text-sm text-gray-700 mb-2">
                Cost per unit: <strong>{formData.costPrice} BDT</strong>
              </p>
              <p className="text-lg text-gray-800 font-bold border-t pt-2">
                Total Cost: <span className="text-green-600">{calculation.totalCost.toFixed(2)} BDT</span>
              </p>
            </div>
          )}

          {/* Buttons */}
          <div className="flex gap-2 justify-end pt-4 border-t">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 bg-gray-200 text-gray-800 rounded-lg hover:bg-gray-300 font-medium"
            >
              Cancel
            </button>
            <button
              type="submit"
              className="px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 font-medium"
            >
              ✓ Record Purchase
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
