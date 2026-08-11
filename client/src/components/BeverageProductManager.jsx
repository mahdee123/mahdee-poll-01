import React, { useState } from 'react';
import { Plus, Pencil, Trash2 } from 'lucide-react';
import Modal from './Modal';
import Button from './Button';
import EmptyState from './EmptyState';
import { useToast } from '../context/ToastContext';
import useConfirm from '../hooks/useConfirm';

const EMPTY_FORM = {
  name: '',
  costPrice: '',
  sellingPrice: '',
  unit: 'Bottle',
  description: '',
};

export default function BeverageProductManager({ products = [], onAdd, onUpdate, onDelete, onClose }) {
  const toast = useToast();
  const [confirm, confirmDialog] = useConfirm();
  const [showForm, setShowForm] = useState(false);
  const [editingId, setEditingId] = useState(null);
  const [formData, setFormData] = useState(EMPTY_FORM);

  const handleAddClick = () => {
    setFormData(EMPTY_FORM);
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
      toast.error('Product name is required.');
      return;
    }
    if (!formData.costPrice || formData.costPrice < 0) {
      toast.error('Enter a valid cost price.');
      return;
    }
    if (!formData.sellingPrice || formData.sellingPrice < 0) {
      toast.error('Enter a valid selling price.');
      return;
    }

    if (editingId) {
      onUpdate(editingId, formData);
    } else {
      onAdd(formData);
    }
    setShowForm(false);
  };

  const handleDelete = async (product) => {
    const ok = await confirm({
      title: `Delete ${product.name}?`,
      message: 'This product will no longer be available for sale.',
      confirmText: 'Delete product',
      destructive: true,
    });
    if (ok) onDelete(product._id);
  };

  const margin =
    formData.costPrice && formData.sellingPrice
      ? (((formData.sellingPrice - formData.costPrice) / formData.sellingPrice) * 100).toFixed(1)
      : null;

  return (
    <>
      {confirmDialog}
      <Modal isOpen onClose={onClose} title="Beverage products" size="xl">
        {!showForm && (
          <Button onClick={handleAddClick} icon={Plus} size="sm" className="mb-5">
            Add product
          </Button>
        )}

        {showForm && (
          <form onSubmit={handleSubmit} className="mb-6 p-4 bg-canvas rounded-card border border-line">
            <h3 className="section-title mb-4">{editingId ? 'Edit product' : 'New product'}</h3>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
              <div>
                <label className="label">Product name *</label>
                <input
                  type="text"
                  name="name"
                  value={formData.name}
                  onChange={handleInputChange}
                  placeholder="e.g. Water, Orange Juice"
                  className="input"
                  data-autofocus
                />
              </div>

              <div>
                <label className="label">Unit</label>
                <select name="unit" value={formData.unit} onChange={handleInputChange} className="select">
                  <option value="Bottle">Bottle</option>
                  <option value="Cup">Cup</option>
                  <option value="Liter">Liter</option>
                  <option value="Glass">Glass</option>
                </select>
              </div>

              <div>
                <label className="label">Cost price (৳) *</label>
                <input
                  type="number"
                  name="costPrice"
                  value={formData.costPrice}
                  onChange={handleInputChange}
                  placeholder="0.00"
                  step="0.01"
                  min="0"
                  className="input"
                />
              </div>

              <div>
                <label className="label">Selling price (৳) *</label>
                <input
                  type="number"
                  name="sellingPrice"
                  value={formData.sellingPrice}
                  onChange={handleInputChange}
                  placeholder="0.00"
                  step="0.01"
                  min="0"
                  className="input"
                />
              </div>
            </div>

            <div className="mb-4">
              <label className="label">Description</label>
              <textarea
                name="description"
                value={formData.description}
                onChange={handleInputChange}
                placeholder="Optional"
                rows="2"
                className="textarea"
              />
            </div>

            {margin !== null && (
              <div className="mb-4 px-3 py-2.5 bg-primary-50 border border-primary-100 rounded-control">
                <p className="text-sm text-ink-soft">
                  <strong className="text-ink">Profit per unit:</strong>{' '}
                  <span className="tabular">৳{formData.sellingPrice - formData.costPrice}</span>
                  <span className="text-ink-faint"> · {margin}% margin</span>
                </p>
              </div>
            )}

            <div className="flex gap-2 justify-end">
              <Button variant="secondary" onClick={() => setShowForm(false)}>
                Cancel
              </Button>
              <Button type="submit">{editingId ? 'Save changes' : 'Add product'}</Button>
            </div>
          </form>
        )}

        {products.length === 0 ? (
          <EmptyState
            title="No products yet"
            message="Add your first beverage product to start recording sales."
            actionLabel="Add product"
            onAction={handleAddClick}
          />
        ) : (
          <div className="space-y-2">
            {products.map((product) => (
              <div
                key={product._id}
                className="p-4 border border-line rounded-card hover:border-line-strong transition flex items-start justify-between gap-4"
              >
                <div className="flex-1 min-w-0">
                  <h4 className="font-medium text-ink flex items-center gap-2">
                    {product.name}
                    <span className="badge-neutral">{product.unit}</span>
                  </h4>
                  <p className="text-sm text-ink-soft mt-1 tabular">
                    Cost ৳{product.costPrice} · Sell ৳{product.sellingPrice} ·{' '}
                    <span className="text-success font-medium">
                      Profit ৳{product.sellingPrice - product.costPrice}
                    </span>
                  </p>
                  <p className="text-sm text-ink-soft mt-0.5">
                    In stock: <strong className="text-ink tabular">{product.currentStock}</strong> {product.unit}s
                  </p>
                  {product.description && (
                    <p className="text-xs text-ink-faint mt-1">{product.description}</p>
                  )}
                </div>

                <div className="flex gap-2 flex-shrink-0">
                  <Button variant="secondary" size="sm" icon={Pencil} onClick={() => handleEditClick(product)}>
                    Edit
                  </Button>
                  <Button variant="ghost" size="sm" icon={Trash2} onClick={() => handleDelete(product)}>
                    Delete
                  </Button>
                </div>
              </div>
            ))}
          </div>
        )}
      </Modal>
    </>
  );
}
