import React, { useState, useEffect } from 'react';

export default function BeverageSalesForm({ products = [], activeSessions = [], onClose, onSave }) {
  // Form state for adding items
  const [staging, setStaging] = useState({
    productId: '',
    quantity: 1,
    sellingPricePerUnit: '',
  });

  // Shared transaction details
  const [shared, setShared] = useState({
    paymentMethod: 'Cash',
    date: new Date().toISOString().split('T')[0],
    notes: '',
    hourlySessionId: '',
  });

  // Array of items in the cart
  const [items, setItems] = useState([]);

  // Calculation state
  const [calculation, setCalculation] = useState({
    totalAmount: 0,
    totalCost: 0,
    profit: 0,
    profitMargin: 0,
  });

  const [error, setError] = useState('');

  const selectedProduct = products.find((p) => p._id === staging.productId);

  // Update selling price when product changes
  useEffect(() => {
    if (selectedProduct) {
      setStaging((prev) => ({
        ...prev,
        sellingPricePerUnit: selectedProduct.sellingPrice,
      }));
    }
  }, [selectedProduct]);

  // Recalculate totals whenever items change
  useEffect(() => {
    if (items.length === 0) {
      setCalculation({
        totalAmount: 0,
        totalCost: 0,
        profit: 0,
        profitMargin: 0,
      });
      return;
    }

    let totalAmount = 0;
    let totalCost = 0;
    let totalProfit = 0;

    items.forEach((item) => {
      totalAmount += item.lineTotal;
      totalCost += item.lineCost;
      totalProfit += item.lineProfit;
    });

    const profitMargin = totalAmount > 0 ? (totalProfit / totalAmount) * 100 : 0;

    setCalculation({
      totalAmount,
      totalCost,
      profit: totalProfit,
      profitMargin,
    });
  }, [items]);

  const handleStagingChange = (e) => {
    const { name, value } = e.target;
    const processed = ['quantity', 'sellingPricePerUnit'].includes(name) ? parseFloat(value) || '' : value;
    setStaging({ ...staging, [name]: processed });
    setError('');
  };

  const handleSharedChange = (e) => {
    const { name, value } = e.target;
    setShared({ ...shared, [name]: value });
  };

  const handleAddItem = () => {
    if (!staging.productId) {
      setError('Please select a product');
      return;
    }
    if (!staging.quantity || staging.quantity <= 0) {
      setError('Quantity must be greater than 0');
      return;
    }
    if (!staging.sellingPricePerUnit || staging.sellingPricePerUnit < 0) {
      setError('Selling price must be valid');
      return;
    }
    if (selectedProduct.currentStock < staging.quantity) {
      setError(`Insufficient inventory for "${selectedProduct.name}". Available: ${selectedProduct.currentStock} ${selectedProduct.unit}s`);
      return;
    }

    // Check if product already in cart - update quantity instead of adding duplicate
    const existingIndex = items.findIndex((i) => i.productId === staging.productId);
    if (existingIndex !== -1) {
      const newQuantity = items[existingIndex].quantity + staging.quantity;
      if (selectedProduct.currentStock < newQuantity) {
        setError(`Total quantity exceeds stock. Available: ${selectedProduct.currentStock} ${selectedProduct.unit}s`);
        return;
      }
      const newItems = [...items];
      newItems[existingIndex] = {
        ...newItems[existingIndex],
        quantity: newQuantity,
        lineTotal: newQuantity * staging.sellingPricePerUnit,
        lineCost: newQuantity * selectedProduct.costPrice,
        lineProfit: newQuantity * staging.sellingPricePerUnit - newQuantity * selectedProduct.costPrice,
      };
      setItems(newItems);
    } else {
      // Add new item
      const lineTotal = staging.quantity * staging.sellingPricePerUnit;
      const lineCost = staging.quantity * selectedProduct.costPrice;
      const lineProfit = lineTotal - lineCost;

      const newItem = {
        productId: staging.productId,
        productName: selectedProduct.name,
        quantity: staging.quantity,
        unit: selectedProduct.unit,
        costPricePerUnit: selectedProduct.costPrice,
        sellingPricePerUnit: staging.sellingPricePerUnit,
        lineTotal,
        lineCost,
        lineProfit,
      };

      setItems([...items, newItem]);
    }

    // Reset staging
    setStaging({
      productId: '',
      quantity: 1,
      sellingPricePerUnit: '',
    });
    setError('');
  };

  const handleRemoveItem = (index) => {
    setItems(items.filter((_, i) => i !== index));
  };

  const handleSubmit = (e) => {
    e.preventDefault();

    if (items.length === 0) {
      setError('Add at least one product to the cart');
      return;
    }

    const formattedItems = items.map((item) => ({
      productId: item.productId,
      quantity: parseInt(item.quantity),
      sellingPricePerUnit: parseFloat(item.sellingPricePerUnit),
    }));

    const saleData = {
      items: formattedItems,
      paymentMethod: shared.paymentMethod,
      date: shared.date,
      notes: shared.notes,
      ...(shared.hourlySessionId && { hourlySessionId: shared.hourlySessionId }),
    };
    
    console.log('[Debug] BeverageSalesForm submitting:', saleData);
    onSave(saleData);

    // Reset form
    setItems([]);
    setStaging({
      productId: '',
      quantity: 1,
      sellingPricePerUnit: '',
    });
    setShared({
      paymentMethod: 'Cash',
      date: new Date().toISOString().split('T')[0],
      notes: '',
      hourlySessionId: '',
    });
    setError('');
    setCalculation({
      totalAmount: 0,
      totalCost: 0,
      profit: 0,
      profitMargin: 0,
    });
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-lg max-w-4xl w-full max-h-[90vh] sm:max-h-screen overflow-y-auto">
        {/* Header */}
        <div className="sticky top-0 bg-white border-b p-4 flex items-center justify-between">
          <h2 className="text-lg font-semibold">💰 Record Beverage Sale</h2>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600 text-2xl min-h-[44px] min-w-[44px] flex items-center justify-center">
            ✕
          </button>
        </div>

        {/* Form */}
        <form onSubmit={handleSubmit} className="p-6 space-y-6">
          {/* Error Alert */}
          {error && (
            <div className="p-3 bg-red-100 border border-red-300 rounded-lg text-red-700 text-sm">
              ⚠️ {error}
            </div>
          )}

          {/* Add Product Section */}
          <div className="bg-gray-50 p-4 rounded-lg border border-gray-200">
            <h3 className="font-semibold text-gray-800 mb-4">🛒 Add Product</h3>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
              {/* Product Selection */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">🧃 Select Product *</label>
                <select
                  name="productId"
                  value={staging.productId}
                  onChange={handleStagingChange}
                  className="w-full border rounded-lg px-3 py-2 text-sm"
                >
                  <option value="">-- Choose a product --</option>
                  {products.map((product) => (
                    <option key={product._id} value={product._id}>
                      {product.name} ({product.unit}) - Stock: {product.currentStock}
                    </option>
                  ))}
                </select>
              </div>

              {/* Quantity Input */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">📍 Quantity *</label>
                <input
                  type="number"
                  name="quantity"
                  value={staging.quantity}
                  onChange={handleStagingChange}
                  placeholder="0"
                  min="1"
                  step="1"
                  className="w-full border rounded-lg px-3 py-2 text-sm"
                  disabled={!selectedProduct}
                />
              </div>

              {/* Selling Price */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  💵 Selling Price per {selectedProduct?.unit} (Taka) *
                </label>
                <input
                  type="number"
                  name="sellingPricePerUnit"
                  value={staging.sellingPricePerUnit}
                  onChange={handleStagingChange}
                  placeholder="0.00"
                  step="0.01"
                  min="0"
                  className="w-full border rounded-lg px-3 py-2 text-sm"
                  disabled={!selectedProduct}
                />
              </div>

              {/* Stock Info */}
              {selectedProduct && (
                <div className="p-3 bg-primary/5 border border-primary/20 rounded-lg text-sm">
                  <p className="text-gray-700">
                    <strong>Cost Price:</strong> {selectedProduct.costPrice} BDT
                  </p>
                  <p className={`text-gray-700 ${selectedProduct.currentStock === 0 ? 'text-red-600 font-bold' : 'text-green-600 font-bold'}`}>
                    <strong>Available Stock:</strong> {selectedProduct.currentStock} {selectedProduct.unit}s
                  </p>
                </div>
              )}
            </div>

            {/* Add Button */}
            <button
              type="button"
              onClick={handleAddItem}
              disabled={!selectedProduct || selectedProduct.currentStock === 0}
              className="w-full px-4 py-2 bg-primary text-white rounded-lg hover:bg-primary/90 font-medium disabled:bg-gray-400 disabled:cursor-not-allowed"
            >
              ➕ Add to Cart
            </button>
          </div>

          {/* Items Table */}
          {items.length > 0 && (
            <div className="overflow-x-auto">
              <table className="w-full border-collapse">
                <thead>
                  <tr className="bg-gray-100 border-b-2 border-gray-300">
                    <th className="border px-3 py-2 text-left text-sm font-semibold">Product</th>
                    <th className="border px-3 py-2 text-center text-sm font-semibold">Qty</th>
                    <th className="border px-3 py-2 text-right text-sm font-semibold">Cost/Unit</th>
                    <th className="border px-3 py-2 text-right text-sm font-semibold">Price/Unit</th>
                    <th className="border px-3 py-2 text-right text-sm font-semibold">Line Total</th>
                    <th className="border px-3 py-2 text-right text-sm font-semibold">Line Profit</th>
                    <th className="border px-3 py-2 text-center text-sm font-semibold">Action</th>
                  </tr>
                </thead>
                <tbody>
                  {items.map((item, index) => (
                    <tr key={index} className="border-b hover:bg-gray-50">
                      <td className="border px-3 py-2 text-sm">{item.productName}</td>
                      <td className="border px-3 py-2 text-center text-sm">{item.quantity} {item.unit}</td>
                      <td className="border px-3 py-2 text-right text-sm">{item.costPricePerUnit} BDT</td>
                      <td className="border px-3 py-2 text-right text-sm">{item.sellingPricePerUnit} BDT</td>
                      <td className="border px-3 py-2 text-right text-sm font-semibold">{item.lineTotal.toFixed(2)} BDT</td>
                      <td className="border px-3 py-2 text-right text-sm font-semibold text-green-600">{item.lineProfit.toFixed(2)} BDT</td>
                      <td className="border px-3 py-2 text-center">
                        <button
                          type="button"
                          onClick={() => handleRemoveItem(index)}
                          className="px-2 py-1 bg-red-500 text-white text-xs rounded hover:bg-red-600"
                        >
                          Remove
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}

          {/* Shared Transaction Details */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">📅 Sale Date</label>
              <input
                type="date"
                name="date"
                value={shared.date}
                onChange={handleSharedChange}
                className="w-full border rounded-lg px-3 py-2 text-sm"
                required
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">💳 Payment Method</label>
              <div className="flex gap-3 mt-2">
                {['Cash', 'Bank', 'bKash'].map((method) => (
                  <label key={method} className="flex items-center gap-2 cursor-pointer">
                    <input
                      type="radio"
                      name="paymentMethod"
                      value={method}
                      checked={shared.paymentMethod === method}
                      onChange={handleSharedChange}
                      className="w-4 h-4"
                    />
                    <span className="text-sm">{method}</span>
                  </label>
                ))}
              </div>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">🏊 Link to Active Session (Optional)</label>
              <select
                name="hourlySessionId"
                value={shared.hourlySessionId}
                onChange={handleSharedChange}
                className="w-full border rounded-lg px-3 py-2 text-sm"
              >
                <option value="">Standalone beverage sale</option>
                {activeSessions.map((session) => (
                  <option key={session._id} value={session._id}>
                    {session.customerName} - remaining {session.remainingMinutes <= 0 ? 'over time' : `${session.remainingMinutes} min`}
                  </option>
                ))}
              </select>
              {shared.hourlySessionId ? (
                <p className="mt-2 text-xs text-primary">
                  Beverage amount will be added to the selected swimmer account and settled with the session.
                </p>
              ) : null}
            </div>

            <div className="md:col-span-2">
              <label className="block text-sm font-medium text-gray-700 mb-1">📝 Notes (Optional)</label>
              <textarea
                name="notes"
                value={shared.notes}
                onChange={handleSharedChange}
                placeholder="e.g., Customer name, special notes"
                rows="2"
                className="w-full border rounded-lg px-3 py-2 text-sm"
              />
            </div>
          </div>

          {/* Summary Box */}
          {calculation.totalAmount > 0 && (
            <div className="p-4 bg-green-50 border border-green-200 rounded-lg">
              <h4 className="font-semibold text-gray-800 mb-3">💹 Transaction Summary</h4>
              <div className="space-y-2 text-sm mb-3">
                <div className="flex justify-between">
                  <span>Total Items:</span>
                  <span className="font-semibold">{items.length} product(s)</span>
                </div>
                <div className="flex justify-between">
                  <span>Total Revenue:</span>
                  <span className="font-semibold text-primary">{calculation.totalAmount.toFixed(2)} BDT</span>
                </div>
                <div className="flex justify-between">
                  <span>Total Cost:</span>
                  <span className="font-semibold text-gray-600">{calculation.totalCost.toFixed(2)} BDT</span>
                </div>
              </div>
              <div className="border-t pt-2 flex justify-between items-center bg-white p-2 rounded">
                <span className="font-bold">💳 Total Payment:</span>
                <div className="text-right">
                  <p className="text-lg font-bold text-green-600">{calculation.totalAmount.toFixed(2)} BDT</p>
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
              disabled={items.length === 0}
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
