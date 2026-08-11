import React, { useState, useEffect } from 'react';
import { ShoppingCart, Plus, Trash2, AlertCircle, Receipt, Link2 } from 'lucide-react';
import Modal from './Modal';
import Button from './Button';
import EmptyState from './EmptyState';

const PAYMENT_METHODS = ['Cash', 'Bank', 'bKash'];

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
    <Modal
      isOpen
      onClose={onClose}
      title="Record beverage sale"
      description="Add products to the cart, then confirm the sale."
      size="xl"
      footer={
        <>
          <Button variant="secondary" onClick={onClose}>Cancel</Button>
          <Button type="submit" form="beverage-sale-form" disabled={items.length === 0}>
            Record sale · ৳{calculation.totalAmount.toFixed(2)}
          </Button>
        </>
      }
    >
      <form id="beverage-sale-form" onSubmit={handleSubmit}>
        {error && (
          <div className="flex items-start gap-2 bg-danger-soft border border-danger/20 text-danger-ink px-3.5 py-3 rounded-control mb-5 text-sm">
            <AlertCircle size={16} className="flex-shrink-0 mt-0.5" />
            <span>{error}</span>
          </div>
        )}

        <div className="grid lg:grid-cols-[1fr,320px] gap-6 items-start">
          {/* Left: product picker + sale details */}
          <div className="space-y-5 min-w-0">
            <div className="border border-line rounded-card p-4 bg-canvas">
              <h3 className="flex items-center gap-2 text-sm font-semibold text-ink mb-3">
                <ShoppingCart size={16} className="text-primary" /> Add product
              </h3>

              <div className="grid sm:grid-cols-2 gap-3 mb-3">
                <div className="sm:col-span-2">
                  <label className="label">Product</label>
                  <select name="productId" value={staging.productId} onChange={handleStagingChange} className="select">
                    <option value="">— Choose a product —</option>
                    {products.map((product) => (
                      <option key={product._id} value={product._id}>
                        {product.name} ({product.unit}) — Stock: {product.currentStock}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="label">Quantity</label>
                  <input
                    type="number"
                    name="quantity"
                    value={staging.quantity}
                    onChange={handleStagingChange}
                    placeholder="0"
                    min="1"
                    step="1"
                    className="input"
                    disabled={!selectedProduct}
                  />
                </div>

                <div>
                  <label className="label">Price / {selectedProduct?.unit || 'unit'} (৳)</label>
                  <input
                    type="number"
                    name="sellingPricePerUnit"
                    value={staging.sellingPricePerUnit}
                    onChange={handleStagingChange}
                    placeholder="0.00"
                    step="0.01"
                    min="0"
                    className="input"
                    disabled={!selectedProduct}
                  />
                </div>

                {selectedProduct && (
                  <div className="sm:col-span-2 flex items-center justify-between px-3.5 py-2.5 bg-white border border-line rounded-control text-sm">
                    <span className="text-ink-soft">Cost price: <span className="text-ink font-medium tabular">৳{selectedProduct.costPrice}</span></span>
                    <span className={selectedProduct.currentStock === 0 ? 'text-danger font-semibold' : 'text-success font-semibold'}>
                      {selectedProduct.currentStock} {selectedProduct.unit}s in stock
                    </span>
                  </div>
                )}
              </div>

              <Button
                type="button"
                onClick={handleAddItem}
                disabled={!selectedProduct || selectedProduct.currentStock === 0}
                icon={Plus}
                className="w-full"
                variant="secondary"
              >
                Add to cart
              </Button>
            </div>

            <div className="border border-line rounded-card p-4">
              <h3 className="text-sm font-semibold text-ink mb-3">Sale details</h3>
              <div className="grid sm:grid-cols-2 gap-3">
                <div>
                  <label className="label">Sale date</label>
                  <input type="date" name="date" value={shared.date} onChange={handleSharedChange} className="input" required />
                </div>

                <div>
                  <label className="label">Payment method</label>
                  <div className="segmented w-full">
                    {PAYMENT_METHODS.map((method) => (
                      <button
                        key={method}
                        type="button"
                        onClick={() => setShared({ ...shared, paymentMethod: method })}
                        className={`flex-1 ${shared.paymentMethod === method ? 'segmented-item-active' : 'segmented-item'}`}
                      >
                        {method}
                      </button>
                    ))}
                  </div>
                </div>

                <div className="sm:col-span-2">
                  <label className="label flex items-center gap-1.5"><Link2 size={13} /> Link to active session (optional)</label>
                  <select
                    name="hourlySessionId"
                    value={shared.hourlySessionId}
                    onChange={handleSharedChange}
                    className="select"
                  >
                    <option value="">Standalone beverage sale</option>
                    {activeSessions.map((session) => (
                      <option key={session._id} value={session._id}>
                        {session.customerName} — remaining {session.remainingMinutes <= 0 ? 'over time' : `${session.remainingMinutes} min`}
                      </option>
                    ))}
                  </select>
                  {shared.hourlySessionId ? (
                    <p className="field-hint text-primary">
                      Beverage amount will be added to the selected swimmer account and settled with the session.
                    </p>
                  ) : null}
                </div>

                <div className="sm:col-span-2">
                  <label className="label">Notes (optional)</label>
                  <textarea
                    name="notes"
                    value={shared.notes}
                    onChange={handleSharedChange}
                    placeholder="e.g., Customer name, special notes"
                    rows="2"
                    className="textarea"
                  />
                </div>
              </div>
            </div>
          </div>

          {/* Right: running cart */}
          <div className="border border-line rounded-card overflow-hidden lg:sticky lg:top-0">
            <div className="px-4 py-3 border-b border-line bg-canvas flex items-center justify-between">
              <h3 className="text-sm font-semibold text-ink">Cart</h3>
              <span className="badge-neutral">{items.length} item{items.length === 1 ? '' : 's'}</span>
            </div>

            {items.length === 0 ? (
              <div className="py-8">
                <EmptyState icon={ShoppingCart} title="Cart is empty" message="Add products from the left to build the sale." />
              </div>
            ) : (
              <ul className="divide-y divide-line max-h-72 overflow-y-auto">
                {items.map((item, index) => (
                  <li key={index} className="px-4 py-3 flex items-start justify-between gap-2">
                    <div className="min-w-0">
                      <p className="text-sm font-medium text-ink truncate">{item.productName}</p>
                      <p className="text-xs text-ink-faint">{item.quantity} {item.unit} × ৳{item.sellingPricePerUnit}</p>
                    </div>
                    <div className="flex items-center gap-2 flex-shrink-0">
                      <span className="text-sm font-semibold text-ink tabular">৳{item.lineTotal.toFixed(2)}</span>
                      <button
                        type="button"
                        onClick={() => handleRemoveItem(index)}
                        className="w-7 h-7 flex items-center justify-center rounded-control text-ink-faint hover:text-danger hover:bg-danger-soft transition-colors"
                        aria-label={`Remove ${item.productName}`}
                      >
                        <Trash2 size={14} />
                      </button>
                    </div>
                  </li>
                ))}
              </ul>
            )}

            <div className="px-4 py-3 border-t border-line bg-canvas space-y-1.5">
              <div className="flex justify-between text-sm text-ink-soft">
                <span>Revenue</span>
                <span className="tabular text-ink">৳{calculation.totalAmount.toFixed(2)}</span>
              </div>
              <div className="flex justify-between text-sm text-ink-soft">
                <span>Cost</span>
                <span className="tabular text-ink">৳{calculation.totalCost.toFixed(2)}</span>
              </div>
              <div className="flex justify-between text-sm font-semibold pt-1.5 border-t border-line">
                <span className="flex items-center gap-1.5 text-ink"><Receipt size={14} className="text-primary" /> Total</span>
                <span className="tabular text-ink">৳{calculation.totalAmount.toFixed(2)}</span>
              </div>
            </div>
          </div>
        </div>
      </form>
    </Modal>
  );
}
