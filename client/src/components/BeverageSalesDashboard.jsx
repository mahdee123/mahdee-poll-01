import React, { useState, useEffect } from 'react';
import { API_BASE_URL, NetworkError } from '../api';
import BeverageProductManager from './BeverageProductManager';
import InventoryPurchaseForm from './InventoryPurchaseForm';
import BeverageSalesForm from './BeverageSalesForm';
import { useToast } from '../context/ToastContext';
import useConfirm from '../hooks/useConfirm';

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
      console.log('[Debug] Submitting multi-product sale:', formData);
      
      const response = await fetchWithToken(`${API_BASE_URL}/beverages/sales`, {
        method: 'POST',
        body: JSON.stringify(formData),
      });
      
      console.log('[Debug] Sale recorded successfully:', response.sale);
      
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
      <div className="p-6 text-center text-red-500">
        <p>Authentication required. Please log in again.</p>
      </div>
    );
  }

  if (error) {
    return (
      <div className="p-6 text-center text-red-500">
        <p>Error: {error}</p>
        <button
          onClick={() => window.location.reload()}
          className="mt-4 px-4 py-2 bg-primary text-white rounded-lg hover:bg-primary/90"
        >
          Reload
        </button>
      </div>
    );
  }

  if (loading) {
    return (
      <div className="p-6 text-center text-gray-500">
        <p>Loading beverage data...</p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {confirmDialog}

      {/* Header */}
      <div className="flex justify-between items-center">
        <h1 className="text-xl sm:text-2xl font-semibold text-ink">Beverage Sales</h1>
      </div>

      {/* Top Stats */}
      <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-4">
        <div className="bg-primary/5 border border-primary/20 rounded-lg p-4">
          <p className="text-sm text-gray-600">Today Revenue</p>
          <p className="text-2xl font-bold text-primary">{stats.today.revenue.toFixed(0)} ৳</p>
          <p className="text-xs text-gray-500 mt-1">{stats.today.transactionCount} transactions</p>
        </div>

        <div className="bg-green-50 border border-green-200 rounded-lg p-4">
          <p className="text-sm text-gray-600">Today Profit</p>
          <p className="text-2xl font-bold text-green-600">{stats.today.profit.toFixed(0)} ৳</p>
          <p className="text-xs text-gray-500 mt-1">{stats.today.quantitySold} units sold</p>
        </div>

        <div className="bg-purple-50 border border-purple-200 rounded-lg p-4">
          <p className="text-sm text-gray-600">This Month Revenue</p>
          <p className="text-2xl font-bold text-purple-600">{stats.month.revenue.toFixed(0)} ৳</p>
          <p className="text-xs text-gray-500 mt-1">{stats.month.transactionCount} transactions</p>
        </div>

        <div className="bg-orange-50 border border-orange-200 rounded-lg p-4">
          <p className="text-sm text-gray-600">This Month Profit</p>
          <p className="text-2xl font-bold text-orange-600">{stats.month.profit.toFixed(0)} ৳</p>
          <p className="text-xs text-gray-500 mt-1">{stats.month.quantitySold} units sold</p>
        </div>
      </div>

      {/* Action Buttons */}
      <div className="flex flex-wrap gap-3">
        <button
          onClick={() => setActiveModal('products')}
          className="bg-primary text-white px-4 py-2 rounded-lg hover:bg-primary/90 font-medium"
        >
          🛠️ Manage Products
        </button>
        <button
          onClick={() => setActiveModal('purchase')}
          className="bg-purple-600 text-white px-4 py-2 rounded-lg hover:bg-purple-700 font-medium"
        >
          📦 Record Purchase
        </button>
        <button
          onClick={() => setActiveModal('sale')}
          className="bg-green-600 text-white px-4 py-2 rounded-lg hover:bg-green-700 font-medium"
        >
          💰 Record Sale
        </button>
      </div>

      {/* Inventory Status Section */}
      <div className="bg-white border rounded-lg p-6">
        <h2 className="text-lg font-semibold mb-4">📊 Inventory Status</h2>

        {products.length === 0 ? (
          <div className="text-center p-8 text-gray-500">
            <p>No products yet. Create your first beverage product!</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {products.map((product) => (
              <div
                key={product._id}
                className={`p-4 border rounded-lg ${product.currentStock === 0 ? 'bg-red-50 border-red-300' : product.currentStock < 10 ? 'bg-yellow-50 border-yellow-300' : 'bg-green-50 border-green-300'}`}
              >
                <h4 className="font-semibold text-gray-800">{product.name}</h4>
                <div className="mt-2 space-y-1 text-sm">
                  <p>
                    📦 Stock: <span className="font-bold text-lg">{product.currentStock}</span> {product.unit}s
                  </p>
                  <p className="text-gray-600">
                    💰 Cost: {product.costPrice} ৳ | Sell: {product.sellingPrice} ৳
                  </p>
                  <p className="text-gray-600">
                    💵 Value: {(product.currentStock * product.costPrice).toFixed(0)} ৳
                  </p>
                </div>
                {product.currentStock === 0 && <p className="mt-2 text-xs text-red-600 font-semibold">⚠️ Out of stock!</p>}
                {product.currentStock < 10 && product.currentStock > 0 && (
                  <p className="mt-2 text-xs text-yellow-700 font-semibold">⚠️ Low stock warning</p>
                )}
              </div>
            ))}
          </div>
        )}

        <div className="mt-4 p-3 bg-gray-100 rounded-lg">
          <p className="text-sm text-gray-700">
            📦 <strong>{stats.inventory.totalProducts}</strong> products |{' '}
            <strong>Total Inventory Value: {stats.inventory.totalInventoryValue.toFixed(0)} ৳</strong>
          </p>
        </div>
      </div>

      {/* Product Profit Breakdown */}
      {stats.productBreakdown.length > 0 && (
        <div className="bg-white border rounded-lg p-6">
          <h2 className="text-lg font-semibold mb-4">📈 Today's Performance by Product</h2>

          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-gray-100 border-b">
                <tr>
                  <th className="px-4 py-2 text-left">Product</th>
                  <th className="px-4 py-2 text-center">Stock</th>
                  <th className="px-4 py-2 text-right">Sold Today</th>
                  <th className="px-4 py-2 text-right">Revenue</th>
                  <th className="px-4 py-2 text-right">Cost</th>
                  <th className="px-4 py-2 text-right">Profit</th>
                  <th className="px-4 py-2 text-right">Margin</th>
                </tr>
              </thead>
              <tbody>
                {stats.productBreakdown.map((item) => (
                  <tr key={item.productId} className="border-b hover:bg-gray-50">
                    <td className="px-4 py-2 font-semibold text-gray-800">{item.productName}</td>
                    <td className="px-4 py-2 text-center text-gray-600">{item.currentStock} {item.currentStock === 1 ? 'unit' : 'units'}</td>
                    <td className="px-4 py-2 text-right text-gray-600">{item.quantitySoldToday}</td>
                    <td className="px-4 py-2 text-right font-semibold text-primary">
                      {item.revenueToday.toFixed(0)} ৳
                    </td>
                    <td className="px-4 py-2 text-right text-gray-600">{item.totalCost ? item.totalCost.toFixed(0) : 0} ৳</td>
                    <td className="px-4 py-2 text-right font-bold text-green-600">
                      {item.profitToday.toFixed(0)} ৳
                    </td>
                    <td className="px-4 py-2 text-right text-gray-600">{item.profitMarginToday}%</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Sales History with Filters */}
      <div className="bg-white border rounded-lg p-6">
        <h2 className="text-lg font-semibold mb-4">📜 Sales History</h2>

        {/* Filters */}
        <div className="mb-4 grid md:grid-cols-4 gap-3">
          <input
            type="date"
            value={filters.startDate}
            onChange={(e) => setFilters({ ...filters, startDate: e.target.value })}
            className="border rounded-lg px-3 py-2 text-sm"
            placeholder="Start Date"
          />
          <input
            type="date"
            value={filters.endDate}
            onChange={(e) => setFilters({ ...filters, endDate: e.target.value })}
            className="border rounded-lg px-3 py-2 text-sm"
            placeholder="End Date"
          />
          <select
            value={filters.productId}
            onChange={(e) => setFilters({ ...filters, productId: e.target.value })}
            className="border rounded-lg px-3 py-2 text-sm"
          >
            <option value="">All Products</option>
            {products.map((p) => (
              <option key={p._id} value={p._id}>
                {p.name}
              </option>
            ))}
          </select>
          <select
            value={filters.paymentMethod}
            onChange={(e) => setFilters({ ...filters, paymentMethod: e.target.value })}
            className="border rounded-lg px-3 py-2 text-sm"
          >
            <option value="">All Payment Methods</option>
            <option value="Cash">Cash</option>
            <option value="Bank">Bank</option>
            <option value="bKash">bKash</option>
          </select>
        </div>

        {/* Sales List */}
        {sales.length === 0 ? (
          <div className="text-center p-8 text-gray-500">
            <p>No sales recorded yet.</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-gray-100 border-b">
                <tr>
                  <th className="px-4 py-2 text-left">Date & Time</th>
                  <th className="px-4 py-2 text-left">Receipt</th>
                  <th className="px-4 py-2 text-left">Product</th>
                  <th className="px-4 py-2 text-center">Qty</th>
                  <th className="px-4 py-2 text-right">Price/Unit</th>
                  <th className="px-4 py-2 text-right">Line Total</th>
                  <th className="px-4 py-2 text-right">Profit</th>
                  <th className="px-4 py-2 text-center">Payment</th>
                  <th className="px-4 py-2 text-center">Action</th>
                </tr>
              </thead>
              <tbody>
                {sales.map((sale) => {
                  if (!sale.items || sale.items.length === 0) {
                    return null;
                  }
                  return sale.items.map((item, itemIndex) => (
                    <tr key={`${sale._id}-${itemIndex}`} className="border-b hover:bg-gray-50">
                      {itemIndex === 0 && (
                        <>
                          <td rowSpan={sale.items.length} className="px-4 py-2 text-gray-600">
                            <div className="text-sm">{formatDate(sale.date)}</div>
                            <div className="text-xs text-gray-500">{formatTime(sale.date)}</div>
                          </td>
                          <td rowSpan={sale.items.length} className="px-4 py-2 font-mono text-xs text-gray-600">
                            {sale.receiptId}
                          </td>
                        </>
                      )}
                      <td className="px-4 py-2 font-semibold text-gray-800">{item.productName}</td>
                      <td className="px-4 py-2 text-center font-semibold">{item.quantity}</td>
                      <td className="px-4 py-2 text-right text-gray-600">{item.sellingPricePerUnit} ৳</td>
                      <td className="px-4 py-2 text-right font-semibold text-primary">
                        {item.lineTotal.toFixed(0)} ৳
                      </td>
                      <td className="px-4 py-2 text-right font-bold">
                        <span className="text-green-600">{item.lineProfit.toFixed(0)} ৳</span>
                      </td>
                      {itemIndex === 0 && (
                        <>
                          <td rowSpan={sale.items.length} className="px-4 py-2 text-center">
                            <span className="bg-primary/10 text-primary px-2 py-1 rounded text-xs font-medium">
                              {sale.paymentMethod}
                            </span>
                          </td>
                          <td rowSpan={sale.items.length} className="px-4 py-2 text-center">
                            <button
                              onClick={() => handleDeleteSale(sale._id)}
                              className="bg-red-500 text-white px-2 py-1 rounded text-xs hover:bg-red-600"
                            >
                              🗑️
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
      </div>

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
