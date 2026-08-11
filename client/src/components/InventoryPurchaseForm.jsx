import React, { useState } from 'react';
import Modal from './Modal';
import Button from './Button';
import { useToast } from '../context/ToastContext';

export default function InventoryPurchaseForm({ products = [], onClose, onSave }) {
  const toast = useToast();
  const [formData, setFormData] = useState({
    productId: '',
    quantity: 1,
    costPrice: '',
    date: new Date().toISOString().split('T')[0],
    notes: '',
  });

  const [calculation, setCalculation] = useState({ totalCost: 0 });

  const selectedProduct = products.find((p) => p._id === formData.productId);

  const handleInputChange = (e) => {
    const { name, value } = e.target;
    const processed = ['quantity', 'costPrice'].includes(name) ? parseFloat(value) || '' : value;
    setFormData({ ...formData, [name]: processed });

    // Auto-calculate total cost
    if (name === 'quantity' || name === 'costPrice') {
      const qty = name === 'quantity' ? parseFloat(value) : formData.quantity;
      const cost = name === 'costPrice' ? parseFloat(value) : formData.costPrice;
      setCalculation({ totalCost: qty && cost ? qty * cost : 0 });
    }
  };

  const handleSubmit = (e) => {
    e.preventDefault();

    if (!formData.productId) {
      toast.error('Select a product first.');
      return;
    }
    if (!formData.quantity || formData.quantity <= 0) {
      toast.error('Quantity must be greater than 0.');
      return;
    }
    if (!formData.costPrice || formData.costPrice < 0) {
      toast.error('Enter a valid cost price.');
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
    <Modal
      isOpen
      onClose={onClose}
      title="Record inventory purchase"
      size="lg"
      footer={
        <>
          <Button variant="secondary" onClick={onClose}>
            Cancel
          </Button>
          <Button onClick={handleSubmit}>Record purchase</Button>
        </>
      }
    >
      <form onSubmit={handleSubmit} className="space-y-5">
        <div>
          <label className="label">Product *</label>
          <select
            name="productId"
            value={formData.productId}
            onChange={handleInputChange}
            className="select"
            data-autofocus
            required
          >
            <option value="">Choose a product…</option>
            {products.map((product) => (
              <option key={product._id} value={product._id}>
                {product.name} ({product.unit}) — in stock: {product.currentStock}
              </option>
            ))}
          </select>
        </div>

        {selectedProduct && (
          <div className="p-4 bg-canvas border border-line rounded-card space-y-1">
            <p className="text-sm text-ink-soft">
              <strong className="text-ink">In stock:</strong>{' '}
              <span className="tabular">{selectedProduct.currentStock}</span> {selectedProduct.unit}s
            </p>
            <p className="text-sm text-ink-soft">
              <strong className="text-ink">Cost price:</strong>{' '}
              <span className="tabular">৳{selectedProduct.costPrice}</span> per {selectedProduct.unit}
            </p>
            <p className="text-sm text-ink-soft">
              <strong className="text-ink">Selling price:</strong>{' '}
              <span className="tabular">৳{selectedProduct.sellingPrice}</span> per {selectedProduct.unit}
            </p>
          </div>
        )}

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <label className="label">Purchase date</label>
            <input
              type="date"
              name="date"
              value={formData.date}
              onChange={handleInputChange}
              className="input"
              required
            />
          </div>

          <div>
            <label className="label">Quantity *</label>
            <input
              type="number"
              name="quantity"
              value={formData.quantity}
              onChange={handleInputChange}
              placeholder="0"
              min="1"
              step="1"
              className="input"
              required
            />
          </div>

          <div className="md:col-span-2">
            <label className="label">
              Cost price per {selectedProduct?.unit || 'unit'} (৳) *
            </label>
            <input
              type="number"
              name="costPrice"
              value={formData.costPrice}
              onChange={handleInputChange}
              placeholder="0.00"
              step="0.01"
              min="0"
              className="input"
              required
            />
          </div>
        </div>

        <div>
          <label className="label">Notes</label>
          <textarea
            name="notes"
            value={formData.notes}
            onChange={handleInputChange}
            placeholder="e.g. supplier name, invoice number"
            rows="2"
            className="textarea"
          />
        </div>

        {formData.quantity && formData.costPrice ? (
          <div className="p-4 bg-success-soft border border-success/20 rounded-card">
            <p className="text-sm text-ink-soft">
              <span className="tabular">{formData.quantity}</span> {selectedProduct?.unit || 'unit'}s ×{' '}
              <span className="tabular">৳{formData.costPrice}</span>
            </p>
            <p className="text-lg font-semibold text-ink mt-1 pt-2 border-t border-success/20">
              Total cost <span className="text-success tabular">৳{calculation.totalCost.toFixed(2)}</span>
            </p>
          </div>
        ) : null}
      </form>
    </Modal>
  );
}
