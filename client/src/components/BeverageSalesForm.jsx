import React, { useState, useEffect } from 'react';

export default function BeverageSalesForm({ products = [], onClose, onSave }) {
  const [formData, setFormData] = useState({
    productId: '',
    quantity: 1,
    sellingPricePerUnit: '',
    paymentMethod: 'Cash',
    date: new Date().toISOString().split('T')[0],
    notes: '',
  });

  const [calculation, setCalculation] = useState({
    totalAmount: 0,
    totalCost: 0,
    profit: 0,
    profitMargin: 0,
  });

  const selectedProduct = products.find((p) => p._id === formData.productId);

  // Update selling price when product changes
  useEffect(() => {
    if (selectedProduct) {
      setFormData((prev) => ({
        ...prev,
        sellingPricePerUnit: selectedProduct.sellingPrice,
      }));
    }
  }, [selectedProduct]);

  // Recalculate whenever relevant fields change
  useEffect(() => {
    if (selectedProduct && formData.quantity && formData.sellingPricePerUnit) {
      const totalAmount = formData.quantity * formData.sellingPricePerUnit;
      const totalCost = formData.quantity * selectedProduct.costPrice;
      const profit = totalAmount - totalCost;
      const profitMargin = totalAmount > 0 ? (profit / totalAmount) * 100 : 0;

      setCalculation({
        totalAmount,
        totalCost,
        profit,
        profitMargin,
      });
    }
  }, [selectedProduct, formData.quantity, formData.sellingPricePerUnit]);

  const handleInputChange = (e) => {
    const { name, value } = e.target;
    const processed = ['quantity', 'sellingPricePerUnit'].includes(name) ? parseFloat(value) || '' : value;
    setFormData({ ...formData, [name]: processed });
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
    if (!formData.sellingPricePerUnit || formData.sellingPricePerUnit < 0) {
      alert('Selling price must be valid');
      return;
    }
    if (selectedProduct.currentStock < formData.quantity) {
      alert(`Insufficient inventory! Available: ${selectedProduct.currentStock} ${selectedProduct.unit}s`);
      return;
    }

    onSave({
      ...formData,
      quantity: parseInt(formData.quantity),
      sellingPricePerUnit: parseFloat(formData.sellingPricePerUnit),
    });

    setFormData({
      productId: '',
      quantity: 1,
      sellingPricePerUnit: '',
      paymentMethod: 'Cash',
      date: new Date().toISOString().split('T')[0],
      notes: '',
    });
    setCalculation({
      totalAmount: 0,
      totalCost: 0,
      profit: 0,
      profitMargin: 0,
    });
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-lg max-w-2xl w-full max-h-screen overflow-y-auto">
        {/* Header */}
        <div className="sticky top-0 bg-white border-b p-4 flex items-center justify-between">
          <h2 className="text-lg font-semibold">💰 Record Beverage Sale</h2>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600 text-2xl">
            ✕
          </button>
        </div>

        {/* Form */}
        <form onSubmit={handleSubmit} className="p-6 space-y-6">
          {/* Product Selection */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">🧃 Select Product to Sell *</label>
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
                  {product.name} ({product.unit}) - Stock: {product.currentStock}
                </option>
              ))}
            </select>
          </div>

          {/* Stock Warning */}
          {selectedProduct && selectedProduct.currentStock === 0 && (
            <div className="p-3 bg-red-100 border border-red-300 rounded-lg text-red-700 text-sm">
              ⚠️ <strong>No stock available!</strong> Please record a purchase first.
            </div>
          )}

          {/* Product Info Display */}
          {selectedProduct && (
            <div className="p-4 bg-blue-50 border border-blue-200 rounded-lg">
              <h4 className="font-semibold text-gray-800 mb-2">📊 Product Info</h4>
              <p className="text-sm text-gray-700">
                <strong>Available Stock:</strong>{' '}
                <span className={selectedProduct.currentStock === 0 ? 'text-red-600 font-bold' : 'text-green-600 font-bold'}>
                  {selectedProduct.currentStock} {selectedProduct.unit}s
                </span>
              </p>
              <p className="text-sm text-gray-700">
                <strong>Cost Price:</strong> {selectedProduct.costPrice} BDT per {selectedProduct.unit}
              </p>
              <p className="text-sm text-gray-700">
                <strong>Default Selling Price:</strong> {selectedProduct.sellingPrice} BDT per {selectedProduct.unit}
              </p>
            </div>
          )}

          {/* Sale Details */}
          <div className="grid md:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">📅 Sale Date</label>
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
              <label className="block text-sm font-medium text-gray-700 mb-1">📍 Quantity to Sell *</label>
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
                disabled={!selectedProduct}
              />
            </div>

            <div className="md:col-span-2">
              <label className="block text-sm font-medium text-gray-700 mb-1">
                💵 Selling Price per {selectedProduct?.unit} (Taka) *
              </label>
              <input
                type="number"
                name="sellingPricePerUnit"
                value={formData.sellingPricePerUnit}
                onChange={handleInputChange}
                placeholder="0.00"
                step="0.01"
                min="0"
                className="w-full border rounded-lg px-3 py-2 text-sm"
                required
                disabled={!selectedProduct}
              />
              <p className="text-xs text-gray-500 mt-1">
                (Default price is {selectedProduct?.sellingPrice} BDT, change if needed)
              </p>
            </div>

            <div className="md:col-span-2">
              <label className="block text-sm font-medium text-gray-700 mb-1">💳 Payment Method</label>
              <div className="flex gap-3">
                {['Cash', 'Bank', 'bKash'].map((method) => (
                  <label key={method} className="flex items-center gap-2 cursor-pointer">
                    <input
                      type="radio"
                      name="paymentMethod"
                      value={method}
                      checked={formData.paymentMethod === method}
                      onChange={handleInputChange}
                      className="w-4 h-4"
                    />
                    <span className="text-sm">{method}</span>
                  </label>
                ))}
              </div>
            </div>
          </div>

          {/* Notes */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">📝 Notes (Optional)</label>
            <textarea
              name="notes"
              value={formData.notes}
              onChange={handleInputChange}
              placeholder="e.g., Customer name, special notes"
              rows="2"
              className="w-full border rounded-lg px-3 py-2 text-sm"
            />
          </div>

          {/* Profit Calculation */}
          {calculation.totalAmount > 0 && (
            <div className="p-4 bg-green-50 border border-green-200 rounded-lg">
              <h4 className="font-semibold text-gray-800 mb-3">💹 Sale Summary & Profit</h4>
              <div className="space-y-2 text-sm mb-3">
                <div className="flex justify-between">
                  <span>Quantity:</span>
                  <span className="font-semibold">{formData.quantity} {selectedProduct?.unit}s</span>
                </div>
                <div className="flex justify-between">
                  <span>Unit Selling Price:</span>
                  <span className="font-semibold">{formData.sellingPricePerUnit} BDT</span>
                </div>
                <div className="flex justify-between">
                  <span>Total Revenue:</span>
                  <span className="font-semibold text-blue-600">{calculation.totalAmount.toFixed(2)} BDT</span>
                </div>
                <div className="flex justify-between">
                  <span>Total Cost:</span>
                  <span className="font-semibold text-gray-600">{calculation.totalCost.toFixed(2)} BDT</span>
                </div>
              </div>
              <div className="border-t pt-2 flex justify-between items-center bg-white p-2 rounded">
                <span className="font-bold">Profit:</span>
                <div className="text-right">
                  <p className="text-lg font-bold text-green-600">{calculation.profit.toFixed(2)} BDT</p>
                  <p className="text-xs text-gray-600">{calculation.profitMargin.toFixed(1)}% margin</p>
                </div>
              </div>
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
              disabled={!selectedProduct || selectedProduct.currentStock === 0}
              className="px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 font-medium disabled:bg-gray-400 disabled:cursor-not-allowed"
            >
              ✓ Record Sale
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
