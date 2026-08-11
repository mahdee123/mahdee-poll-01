import React, { useState, useEffect } from 'react';
import {
  Settings2, PackagePlus, ShoppingCart, Boxes, TrendingUp, AlertTriangle,
  Trash2, RefreshCw,
} from 'lucide-react';
import { API_BASE_URL, NetworkError } from '../api';
import BeverageProductManager from './BeverageProductManager';
import InventoryPurchaseForm from './InventoryPurchaseForm';
import BeverageSalesForm from './BeverageSalesForm';
import { useToast } from '../context/ToastContext';
import useConfirm from '../hooks/useConfirm';
import Button from './Button';
import Card from './Card';
import EmptyState from './EmptyState';

export default function BeverageSalesDashboard({ token }) {
  const toast = useToast();
  const [confirm, confirmDialog] = useConfirm();
  const [products, setProducts] = useState([]);
  const [sales, setSales] = useState([]);
  const [stats, setStats] = useState({
    today: { revenue: 0, profit: 0, quantitySold: 0, transactionCount: 0 },
    month: { revenue: 0, profit: 0, quantitySold: 0, transactionCount: 0 },
    inventory: { totalProducts: 0, totalInventoryValue: 0, products: [] },
    productBreakdown: [],
  });

  const [activeModal, setActiveModal] = useState(null); // 'products', 'purchase', 'sale', null
  const [filters, setFilters] = useState({
    startDate: '',
    endDate: '',
    productId: '',
    paymentMethod: '',
  });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  // Helper function to make authenticated requests
  const fetchWithToken = async (url, options = {}) => {
    let response;

    try {
      response = await fetch(url, {
        ...options,
        headers: {
          'Content-Type': 'application/json',
          ...(token && { Authorization: `Bearer ${token}` }),
          ...options.headers,
        },
      });
    } catch {
      // The request never reached the server.
      throw new NetworkError();
    }

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      const error = new Error(errorData.message || errorData.error || `Request failed (${response.status}).`);
      error.statusCode = response.status;
      error.responseData = errorData;
      throw error;
    }

    return response.json();
  };

  // Fetch all data on mount and every 30 seconds (but not when modal is open)
  useEffect(() => {
    const loadData = async () => {
      try {
        setLoading(true);
        setError(null);
        const [productsRes, statsRes, salesRes] = await Promise.all([
          fetchWithToken(`${API_BASE_URL}/beverages/products`),
          fetchWithToken(`${API_BASE_URL}/beverages/sales/stats`),
          fetchWithToken(
            `${API_BASE_URL}/beverages/sales${
              filters.startDate || filters.endDate || filters.productId || filters.paymentMethod
                ? '?' +
                  new URLSearchParams({
                    ...(filters.startDate && { startDate: filters.startDate }),
                    ...(filters.endDate && { endDate: filters.endDate }),
                    ...(filters.productId && { productId: filters.productId }),
                    ...(filters.paymentMethod && { paymentMethod: filters.paymentMethod }),
                  }).toString()
                : ''
            }`
          ),
        ]);

        setProducts(productsRes.products || []);
        setStats(statsRes);
        setSales(salesRes.sales || []);
      } catch (err) {
        console.error('Error loading beverage data:', err);
        setError(err.message || 'Failed to load beverage data');
      } finally {
        setLoading(false);
      }
    };

    if (token) {
      loadData();
      // Only auto-refresh when no modal is open
      let interval;
      if (!activeModal) {
        interval = setInterval(loadData, 30000); // Refresh every 30 seconds
      }
      return () => {
        if (interval) clearInterval(interval);
      };
    }
  }, [filters, token, activeModal]);

  const handleAddProduct = async (formData) => {
    try {
      const response = await fetchWithToken(`${API_BASE_URL}/beverages/products`, {
        method: 'POST',
        body: JSON.stringify(formData),
      });
      setProducts([...products, response.product]);
      setActiveModal(null);
    } catch (err) {
      console.error('Error adding product:', err);
      toast.error(`Could not add product. ${err.message}`);
    }
  };

  const handleUpdateProduct = async (productId, formData) => {
    try {
      const response = await fetchWithToken(`${API_BASE_URL}/beverages/products/${productId}`, {
        method: 'PATCH',
        body: JSON.stringify(formData),
      });
      setProducts(products.map((p) => (p._id === productId ? response.product : p)));
      setActiveModal(null);
    } catch (err) {
      console.error('Error updating product:', err);
      toast.error(`Could not update product. ${err.message}`);
    }
  };

  const handleDeleteProduct = async (productId) => {
    try {
      await fetchWithToken(`${API_BASE_URL}/beverages/products/${productId}`, {
        method: 'DELETE',
      });
      setProducts(products.filter((p) => p._id !== productId));
    } catch (err) {
      console.error('Error deleting product:', err);
      toast.error(`Could not delete product. ${err.message}`);
    }
  };

  const handleRecordPurchase = async (formData) => {
    try {
      const response = await fetchWithToken(`${API_BASE_URL}/beverages/inventory/purchase`, {
        method: 'POST',
        body: JSON.stringify(formData),
      });
      setProducts(products.map((p) => (p._id === formData.productId ? response.product : p)));
      setActiveModal(null);
    } catch (err) {
      console.error('Error recording purchase:', err);
      toast.error(`Could not record purchase. ${err.message}`);
    }
  };

  const handleRecordSale = async (formData) => {
    try {
      const response = await fetchWithToken(`${API_BASE_URL}/beverages/sales`, {
        method: 'POST',
        body: JSON.stringify(formData),
      });

      // Reload products since multiple products' stock may have changed
      const updatedProducts = await fetchWithToken(`${API_BASE_URL}/beverages/products`);
      setProducts(updatedProducts.products || []);

      setSales([response.sale, ...sales]);
      setActiveModal(null);
      toast.success('Sale recorded.');
    } catch (err) {
      console.error('[Error] Failed to record sale:', err);

      // Build detailed error message
      let errorMessage = err.message || 'Unknown error';
      if (err.responseData?.error) {
        errorMessage = err.responseData.error;
      }
      if (err.responseData?.details) {
        errorMessage += `\nDetails: ${err.responseData.details}`;
      }

      toast.error(`Could not record sale. ${errorMessage}`);
    }
  };

  const handleDeleteSale = async (saleId) => {
    if (!(await confirm({ title: 'Delete this sale?', message: 'Inventory will be restored to stock.', confirmText: 'Delete sale', destructive: true }))) return;

    try {
      await fetchWithToken(`${API_BASE_URL}/beverages/sales/${saleId}`, {
        method: 'DELETE',
      });
      setSales(sales.filter((s) => s._id !== saleId));
      // Refresh products to get updated stock
      const resp = await fetchWithToken(`${API_BASE_URL}/beverages/products`);
      setProducts(resp.products || []);
    } catch (err) {
      console.error('Error deleting sale:', err);
      toast.error(`Could not delete sale. ${err.message}`);
    }
  };

  const formatDate = (date) => new Date(date).toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
  const formatTime = (date) => new Date(date).toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' });

  if (!token) {
    return (
      <div className="p-6 text-center text-danger text-sm">
        <p>Authentication required. Please log in again.</p>
      </div>
    );
  }

  if (error) {
    return (
      <div className="p-6 text-center text-sm text-danger space-y-3">
        <p>Error: {error}</p>
        <Button variant="secondary" icon={RefreshCw} onClick={() => window.location.reload()}>Reload</Button>
      </div>
    );
  }

  if (loading) {
    return <div className="p-6 text-center text-sm text-ink-soft">Loading beverage data…</div>;
  }

  return (
    <div className="space-y-6">
      {confirmDialog}

      {/* Top Stats */}
      <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-4">
        <div className="stat-card">
          <span className="stat-label">Today's revenue</span>
          <span className="stat-value">{stats.today.revenue.toFixed(0)} ৳</span>
          <span className="stat-hint">{stats.today.transactionCount} transactions</span>
        </div>
        <div className="stat-card">
          <span className="stat-label">Today's profit</span>
          <span className="stat-value text-success">{stats.today.profit.toFixed(0)} ৳</span>
          <span className="stat-hint">{stats.today.quantitySold} units sold</span>
        </div>
        <div className="stat-card">
          <span className="stat-label">This month revenue</span>
          <span className="stat-value">{stats.month.revenue.toFixed(0)} ৳</span>
          <span className="stat-hint">{stats.month.transactionCount} transactions</span>
        </div>
        <div className="stat-card">
          <span className="stat-label">This month profit</span>
          <span className="stat-value text-success">{stats.month.profit.toFixed(0)} ৳</span>
          <span className="stat-hint">{stats.month.quantitySold} units sold</span>
        </div>
      </div>

      {/* Action Buttons */}
      <div className="flex flex-wrap gap-3">
        <Button variant="secondary" icon={Settings2} onClick={() => setActiveModal('products')}>Manage products</Button>
        <Button variant="secondary" icon={PackagePlus} onClick={() => setActiveModal('purchase')}>Record purchase</Button>
        <Button icon={ShoppingCart} onClick={() => setActiveModal('sale')}>Record sale</Button>
      </div>

      {/* Inventory Status Section */}
      <Card title="Inventory status" icon={Boxes}>
        {products.length === 0 ? (
          <EmptyState icon={Boxes} title="No products yet" message="Create your first beverage product to start tracking inventory." />
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {products.map((product) => (
              <div
                key={product._id}
                className={`p-4 border rounded-card ${product.currentStock === 0 ? 'bg-danger-soft border-danger/30' : product.currentStock < 10 ? 'bg-warning-soft border-warning/30' : 'bg-success-soft border-success/30'}`}
              >
                <h4 className="font-semibold text-ink">{product.name}</h4>
                <div className="mt-2 space-y-1 text-sm text-ink-soft">
                  <p>
                    Stock: <span className="font-bold text-lg text-ink tabular">{product.currentStock}</span> {product.unit}s
                  </p>
                  <p className="tabular">Cost: {product.costPrice} ৳ · Sell: {product.sellingPrice} ৳</p>
                  <p className="tabular">Value: {(product.currentStock * product.costPrice).toFixed(0)} ৳</p>
                </div>
                {product.currentStock === 0 && (
                  <p className="mt-2 flex items-center gap-1 text-xs text-danger font-semibold"><AlertTriangle size={12} /> Out of stock</p>
                )}
                {product.currentStock < 10 && product.currentStock > 0 && (
                  <p className="mt-2 flex items-center gap-1 text-xs text-warning-ink font-semibold"><AlertTriangle size={12} /> Low stock warning</p>
                )}
              </div>
            ))}
          </div>
        )}

        <div className="mt-4 p-3 bg-canvas rounded-card">
          <p className="text-sm text-ink">
            <strong className="tabular">{stats.inventory.totalProducts}</strong> products ·{' '}
            <strong className="tabular">Total inventory value: {stats.inventory.totalInventoryValue.toFixed(0)} ৳</strong>
          </p>
        </div>
      </Card>

      {/* Product Profit Breakdown */}
      {stats.productBreakdown.length > 0 && (
        <Card title="Today's performance by product" icon={TrendingUp}>
          <div className="table-shell -m-5 rounded-none border-0">
            <table className="table-modern w-full">
              <thead>
                <tr>
                  <th>Product</th>
                  <th className="text-center">Stock</th>
                  <th className="text-right">Sold Today</th>
                  <th className="text-right">Revenue</th>
                  <th className="text-right">Cost</th>
                  <th className="text-right">Profit</th>
                  <th className="text-right">Margin</th>
                </tr>
              </thead>
              <tbody>
                {stats.productBreakdown.map((item) => (
                  <tr key={item.productId}>
                    <td className="font-semibold text-ink">{item.productName}</td>
                    <td className="text-center">{item.currentStock} {item.currentStock === 1 ? 'unit' : 'units'}</td>
                    <td className="text-right">{item.quantitySoldToday}</td>
                    <td className="text-right font-semibold text-primary tabular">
                      {item.revenueToday.toFixed(0)} ৳
                    </td>
                    <td className="text-right tabular">{item.totalCost ? item.totalCost.toFixed(0) : 0} ৳</td>
                    <td className="text-right font-bold text-success tabular">
                      {item.profitToday.toFixed(0)} ৳
                    </td>
                    <td className="text-right">{item.profitMarginToday}%</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Card>
      )}

      {/* Sales History with Filters */}
      <Card title="Sales history">
        {/* Filters */}
        <div className="mb-4 grid md:grid-cols-4 gap-3">
          <input
            type="date"
            value={filters.startDate}
            onChange={(e) => setFilters({ ...filters, startDate: e.target.value })}
            className="input"
            placeholder="Start date"
          />
          <input
            type="date"
            value={filters.endDate}
            onChange={(e) => setFilters({ ...filters, endDate: e.target.value })}
            className="input"
            placeholder="End date"
          />
          <select
            value={filters.productId}
            onChange={(e) => setFilters({ ...filters, productId: e.target.value })}
            className="select"
          >
            <option value="">All products</option>
            {products.map((p) => (
              <option key={p._id} value={p._id}>
                {p.name}
              </option>
            ))}
          </select>
          <select
            value={filters.paymentMethod}
            onChange={(e) => setFilters({ ...filters, paymentMethod: e.target.value })}
            className="select"
          >
            <option value="">All payment methods</option>
            <option value="Cash">Cash</option>
            <option value="Bank">Bank</option>
            <option value="bKash">bKash</option>
          </select>
        </div>

        {/* Sales List */}
        {sales.length === 0 ? (
          <EmptyState title="No sales recorded yet" message="Sales you record will show up here." />
        ) : (
          <div className="table-shell -m-5 mt-0 rounded-none border-0">
            <table className="table-modern w-full">
              <thead>
                <tr>
                  <th>Date &amp; Time</th>
                  <th>Receipt</th>
                  <th>Product</th>
                  <th className="text-center">Qty</th>
                  <th className="text-right">Price/Unit</th>
                  <th className="text-right">Line Total</th>
                  <th className="text-right">Profit</th>
                  <th className="text-center">Payment</th>
                  <th className="text-center">Action</th>
                </tr>
              </thead>
              <tbody>
                {sales.map((sale) => {
                  if (!sale.items || sale.items.length === 0) {
                    return null;
                  }
                  return sale.items.map((item, itemIndex) => (
                    <tr key={`${sale._id}-${itemIndex}`}>
                      {itemIndex === 0 && (
                        <>
                          <td rowSpan={sale.items.length} className="text-ink-soft align-top">
                            <div className="text-sm">{formatDate(sale.date)}</div>
                            <div className="text-xs text-ink-faint">{formatTime(sale.date)}</div>
                          </td>
                          <td rowSpan={sale.items.length} className="font-mono text-xs text-ink-soft align-top">
                            {sale.receiptId}
                          </td>
                        </>
                      )}
                      <td className="font-semibold text-ink">{item.productName}</td>
                      <td className="text-center font-semibold">{item.quantity}</td>
                      <td className="text-right tabular">{item.sellingPricePerUnit} ৳</td>
                      <td className="text-right font-semibold text-primary tabular">
                        {item.lineTotal.toFixed(0)} ৳
                      </td>
                      <td className="text-right font-bold text-success tabular">
                        {item.lineProfit.toFixed(0)} ৳
                      </td>
                      {itemIndex === 0 && (
                        <>
                          <td rowSpan={sale.items.length} className="text-center align-top">
                            <span className="badge-info">{sale.paymentMethod}</span>
                          </td>
                          <td rowSpan={sale.items.length} className="text-center align-top">
                            <button
                              onClick={() => handleDeleteSale(sale._id)}
                              className="w-8 h-8 inline-flex items-center justify-center rounded-control text-danger hover:bg-danger-soft"
                              aria-label="Delete sale"
                            >
                              <Trash2 size={14} />
                            </button>
                          </td>
                        </>
                      )}
                    </tr>
                  ));
                })}
              </tbody>
            </table>
          </div>
        )}
      </Card>

      {/* Modals */}
      {activeModal === 'products' && (
        <BeverageProductManager
          products={products}
          onAdd={handleAddProduct}
          onUpdate={handleUpdateProduct}
          onDelete={handleDeleteProduct}
          onClose={() => setActiveModal(null)}
        />
      )}

      {activeModal === 'purchase' && (
        <InventoryPurchaseForm
          products={products}
          onClose={() => setActiveModal(null)}
          onSave={handleRecordPurchase}
        />
      )}

      {activeModal === 'sale' && (
        <BeverageSalesForm
          products={products}
          onClose={() => setActiveModal(null)}
          onSave={handleRecordSale}
        />
      )}
    </div>
  );
}
