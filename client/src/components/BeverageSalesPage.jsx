import React, { useState, useEffect } from 'react';
import { API_BASE_URL } from '../api';
import BeverageProductManager from './BeverageProductManager';
import InventoryPurchaseForm from './InventoryPurchaseForm';
import BeverageSalesForm from './BeverageSalesForm';

export default function BeverageSalesPage({ token, setLastReceipt }) {
  const [activeTab, setActiveTab] = useState('dashboard');
  const [products, setProducts] = useState([]);
  const [sales, setSales] = useState([]);
  const [inventoryHistory, setInventoryHistory] = useState([]);
  const [activeSessions, setActiveSessions] = useState([]);
  
  const [stats, setStats] = useState({
    today: { revenue: 0, profit: 0, quantitySold: 0, transactionCount: 0 },
    month: { revenue: 0, profit: 0, quantitySold: 0, transactionCount: 0 },
    inventory: { totalProducts: 0, totalInventoryValue: 0, products: [] },
    productBreakdown: [],
  });
  
  const [lowStockAlerts, setLowStockAlerts] = useState([]);
  const [activeModal, setActiveModal] = useState(null);
  
  // Time-period state
  const [timePeriod, setTimePeriod] = useState('today');
  const [customDateRange, setCustomDateRange] = useState({
    startDate: '',
    endDate: ''
  });
  const [periodStats, setPeriodStats] = useState(null);
  
  // Filters for Sales tab
  const [salesFilters, setSalesFilters] = useState({
    startDate: '',
    endDate: '',
    productId: '',
    paymentMethod: '',
  });

  // Cash Management state
  const [cashSelectedDate, setCashSelectedDate] = useState(new Date().toISOString().split('T')[0]);
  const [cashFlow, setCashFlow] = useState(null);
  const [withdrawals, setWithdrawals] = useState([]);
  const [openingBalanceForm, setOpeningBalanceForm] = useState('');
  const [withdrawalForm, setWithdrawalForm] = useState({ amount: '', reason: '' });

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  // Helper function to make authenticated requests
  const fetchWithToken = async (url, options = {}) => {
    const response = await fetch(url, {
      ...options,
      headers: {
        'Content-Type': 'application/json',
        ...(token && { Authorization: `Bearer ${token}` }),
        ...options.headers,
      },
    });

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      const error = new Error(errorData.message || errorData.error || `API error: ${response.status}`);
      error.statusCode = response.status;
      error.responseData = errorData;
      throw error;
    }

    return response.json();
  };

  // Get current date range based on time-period selection
  const getDateRange = () => {
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    let startDate, endDate;

    switch (timePeriod) {
      case 'today':
        startDate = new Date(today);
        endDate = new Date(today);
        endDate.setHours(23, 59, 59, 999);
        break;
      case 'yesterday':
        startDate = new Date(today);
        startDate.setDate(startDate.getDate() - 1);
        endDate = new Date(startDate);
        endDate.setHours(23, 59, 59, 999);
        break;
      case 'this-week':
        const dayOfWeek = today.getDay();
        const diff = today.getDate() - dayOfWeek;
        startDate = new Date(today);
        startDate.setDate(diff);
        startDate.setHours(0, 0, 0, 0);
        endDate = new Date(startDate);
        endDate.setDate(endDate.getDate() + 6);
        endDate.setHours(23, 59, 59, 999);
        break;
      case 'last-week':
        const lastWeekEnd = new Date(today);
        lastWeekEnd.setDate(lastWeekEnd.getDate() - today.getDay());
        lastWeekEnd.setHours(23, 59, 59, 999);
        const lastWeekStart = new Date(lastWeekEnd);
        lastWeekStart.setDate(lastWeekStart.getDate() - 6);
        lastWeekStart.setHours(0, 0, 0, 0);
        startDate = lastWeekStart;
        endDate = lastWeekEnd;
        break;
      case 'this-month':
        startDate = new Date(today.getFullYear(), today.getMonth(), 1);
        endDate = new Date(today.getFullYear(), today.getMonth() + 1, 0);
        endDate.setHours(23, 59, 59, 999);
        break;
      case 'last-month':
        startDate = new Date(today.getFullYear(), today.getMonth() - 1, 1);
        endDate = new Date(today.getFullYear(), today.getMonth(), 0);
        endDate.setHours(23, 59, 59, 999);
        break;
      case 'custom':
        startDate = customDateRange.startDate ? new Date(customDateRange.startDate) : today;
        endDate = customDateRange.endDate ? new Date(customDateRange.endDate) : today;
        endDate.setHours(23, 59, 59, 999);
        break;
      default:
        startDate = new Date(today);
        endDate = new Date(today);
        endDate.setHours(23, 59, 59, 999);
    }

    return { startDate, endDate };
  };

  const formatDateForAPI = (date) => {
    if (!date) return '';
    const d = new Date(date);
    return d.toISOString().split('T')[0];
  };

  // Load data based on active tab and filters
  useEffect(() => {
    const loadData = async () => {
      if (!token) return;

      try {
        setLoading(true);
        setError(null);

        // Always load products and stats
        const productsRes = await fetchWithToken(`${API_BASE_URL}/beverages/products`);
        setProducts(productsRes.products || []);

        const statsRes = await fetchWithToken(`${API_BASE_URL}/beverages/sales/stats`);
        // Flatten the today stats for consistent display across dashboard
        const flattenedStats = {
          totalRevenue: statsRes.today?.revenue || 0,
          totalProfit: statsRes.today?.profit || 0,
          totalQuantity: statsRes.today?.quantitySold || 0,
          transactionCount: statsRes.today?.transactionCount || 0,
          profitMargin: statsRes.today?.profit && statsRes.today?.revenue 
            ? ((statsRes.today.profit / statsRes.today.revenue) * 100).toFixed(1)
            : 0,
          month: statsRes.month,
          inventory: statsRes.inventory,
          productBreakdown: statsRes.productBreakdown,
        };
        setStats(flattenedStats);

        // Load low stock alerts
        const alertsRes = await fetchWithToken(`${API_BASE_URL}/beverages/inventory/low-stock?threshold=10`);
        setLowStockAlerts(alertsRes.products || []);

        const activeSessionsRes = await fetchWithToken(`${API_BASE_URL}/hourly-sessions/active`);
        setActiveSessions(activeSessionsRes.sessions || []);

        // Load period-specific stats based on time period
        if (activeTab === 'dashboard') {
          const { startDate, endDate } = getDateRange();
          const dateParam = formatDateForAPI(startDate);

          let periodRes;
          if (timePeriod === 'today' || timePeriod === 'yesterday') {
            periodRes = await fetchWithToken(`${API_BASE_URL}/beverages/stats/daily?date=${dateParam}`);
          } else if (timePeriod === 'this-week' || timePeriod === 'last-week') {
            periodRes = await fetchWithToken(`${API_BASE_URL}/beverages/stats/weekly?weekOf=${dateParam}`);
          } else if (timePeriod === 'this-month' || timePeriod === 'last-month') {
            const monthParam = `${startDate.getFullYear()}-${String(startDate.getMonth() + 1).padStart(2, '0')}`;
            periodRes = await fetchWithToken(`${API_BASE_URL}/beverages/stats/monthly?month=${monthParam}`);
          } else if (timePeriod === 'custom' && (customDateRange.startDate || customDateRange.endDate)) {
            // Use filtered sales endpoint
            const filterParams = new URLSearchParams({
              ...(customDateRange.startDate && { startDate: formatDateForAPI(customDateRange.startDate) }),
              ...(customDateRange.endDate && { endDate: formatDateForAPI(customDateRange.endDate) }),
            });
            const salesRes = await fetchWithToken(`${API_BASE_URL}/beverages/sales?${filterParams.toString()}`);
            periodRes = calculateCustomStats(salesRes.sales || []);
          }

          if (periodRes) {
            setPeriodStats(periodRes);
          }
        }

        // Load sales with filters if on Sales tab
        if (activeTab === 'sales') {
          const filterParams = new URLSearchParams({
            ...(salesFilters.startDate && { startDate: formatDateForAPI(salesFilters.startDate) }),
            ...(salesFilters.endDate && { endDate: formatDateForAPI(salesFilters.endDate) }),
            ...(salesFilters.productId && { productId: salesFilters.productId }),
            ...(salesFilters.paymentMethod && { paymentMethod: salesFilters.paymentMethod }),
          });
          const salesRes = await fetchWithToken(`${API_BASE_URL}/beverages/sales?${filterParams.toString()}`);
          setSales(salesRes.sales || []);
        } else {
          // Default to today's sales (not all history) to match Dashboard view
          const today = new Date().toISOString().split('T')[0];
          const filterParams = new URLSearchParams({
            startDate: today,
            endDate: today,
          });
          const recentSalesRes = await fetchWithToken(`${API_BASE_URL}/beverages/sales?${filterParams.toString()}`);
          setSales(recentSalesRes.sales || []);
        }

        // Load inventory history if on Inventory tab
        if (activeTab === 'inventory' && products.length > 0) {
          // For now, we'll aggregate inventory from all products
          // In a full implementation, you'd have a dedicated inventory endpoint
          setInventoryHistory([]);
        }

        // Load cash data if on Cash Management tab
        if (activeTab === 'cash') {
          await handleLoadCashData(cashSelectedDate);
        }
      } catch (err) {
        console.error('Error loading beverage data:', err);
        setError(err.message || 'Failed to load beverage data');
      } finally {
        setLoading(false);
      }
    };

    loadData();

    // Auto-refresh every 30 seconds when not in modal
    let interval;
    if (!activeModal && token) {
      interval = setInterval(loadData, 30000);
    }

    return () => {
      if (interval) clearInterval(interval);
    };
  }, [activeTab, timePeriod, customDateRange, salesFilters, token, activeModal]);

  // Helper to calculate custom stats
  const calculateCustomStats = (salesData) => {
    const totalRevenue = salesData.reduce((sum, sale) => sum + sale.totalAmount, 0);
    const totalProfit = salesData.reduce((sum, sale) => sum + sale.profit, 0);
    const totalQuantity = salesData.reduce((sum, sale) => {
      return sum + (sale.items ? sale.items.reduce((itemSum, item) => itemSum + item.quantity, 0) : 0);
    }, 0);

    return {
      totalRevenue,
      totalProfit,
      totalQuantity,
      transactionCount: salesData.length,
      profitMargin: totalRevenue > 0 ? parseFloat(((totalProfit / totalRevenue) * 100).toFixed(2)) : 0,
      sales: salesData,
    };
  };

  // Handler functions
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
      alert(`Failed to add product: ${err.message}`);
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
      alert(`Failed to update product: ${err.message}`);
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
      alert(`Failed to delete product: ${err.message}`);
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
      alert('✓ Purchase recorded successfully!');
    } catch (err) {
      console.error('Error recording purchase:', err);
      alert(`Failed to record purchase: ${err.message}`);
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
      
      // Generate receipt if setLastReceipt is available
      if (setLastReceipt && response.sale) {
        const receipt = {
          receiptId: response.sale.receiptId,
          date: response.sale.date,
          serviceType: 'Beverage',
          name: response.sale.notes || 'Beverage Sale',
          phone: '',
          paymentMethod: response.sale.paymentMethod,
          beverageItems: response.sale.items || [],
          totalCost: response.sale.totalCost || 0,
          amount: response.sale.totalAmount || 0,
          profit: response.sale.profit || 0,
          profitMargin: response.sale.profitMargin || 0,
        };
        setLastReceipt(receipt);
        setTimeout(() => window.print(), 500);
      }
      
      alert('✓ Sale recorded successfully!');
      
      // IMPORTANT: Refresh cash management data since sales affect cash balance
      if (activeTab === 'cash-mgmt' || activeTab === 'dashboard') {
        await handleLoadCashData(cashSelectedDate);
      }
    } catch (err) {
      console.error('Error recording sale:', err);
      let errorMessage = err.message || 'Unknown error';
      if (err.responseData?.error) {
        errorMessage = err.responseData.error;
      }
      alert(`❌ Failed to record sale:\n${errorMessage}`);
    }
  };

  const handleDeleteSale = async (saleId) => {
    if (!window.confirm('Delete this sale? Inventory will be restored.')) return;

    try {
      await fetchWithToken(`${API_BASE_URL}/beverages/sales/${saleId}`, {
        method: 'DELETE',
      });
      setSales(sales.filter((s) => s._id !== saleId));
      // Refresh products to get updated stock
      const resp = await fetchWithToken(`${API_BASE_URL}/beverages/products`);
      setProducts(resp.products || []);
      
      // IMPORTANT: Refresh cash management data since sales affect cash balance
      if (activeTab === 'cash-mgmt' || activeTab === 'dashboard') {
        await handleLoadCashData(cashSelectedDate);
      }
    } catch (err) {
      console.error('Error deleting sale:', err);
      alert(`Failed to delete sale: ${err.message}`);
    }
  };

  const handleCollectDueSale = async (sale) => {
    if (!sale.hourlySessionId) return;

    const paymentMethod = window.prompt('Enter payment method for this due sale (Cash, Bank, bKash):', 'Cash');
    if (!paymentMethod) return;

    try {
      await fetchWithToken(`${API_BASE_URL}/hourly-sessions/${sale.hourlySessionId}/close`, {
        method: 'POST',
        body: JSON.stringify({
          paymentMethod: ['Cash', 'Bank', 'bKash'].includes(paymentMethod) ? paymentMethod : 'Cash',
        }),
      });

      alert(`✓ Due sale collected for ${sale.receiptId}`);
      await Promise.all([
        fetchWithToken(`${API_BASE_URL}/hourly-sessions/active`)
          .then((response) => setActiveSessions(response.sessions || [])),
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
        ).then((response) => setSales(response.sales || [])),
      ]);
    } catch (err) {
      console.error('Error collecting due sale:', err);
      alert(`Failed to collect due sale: ${err.message}`);
    }
  };

  // Cash Management Handlers
  const handleLoadCashData = async (dateStr) => {
    try {
      const res = await fetchWithToken(`${API_BASE_URL}/beverages/cash/daily?date=${dateStr}`);
      setCashFlow(res.cashFlow);
      setWithdrawals(res.withdrawals || []);
      setOpeningBalanceForm(res.cashFlow.openingBalance.toString());
    } catch (err) {
      console.error('Error loading cash data:', err);
    }
  };

  const handleSetOpeningBalance = async () => {
    try {
      if (!openingBalanceForm || parseFloat(openingBalanceForm) < 0) {
        alert('Please enter a valid opening balance');
        return;
      }

      await fetchWithToken(`${API_BASE_URL}/beverages/cash/opening-balance`, {
        method: 'POST',
        body: JSON.stringify({
          date: cashSelectedDate,
          amount: parseFloat(openingBalanceForm),
          notes: '',
        }),
      });

      alert('✓ Opening balance saved!');
      await handleLoadCashData(cashSelectedDate);
    } catch (err) {
      alert(`Failed to save opening balance: ${err.message}`);
    }
  };

  const handleRecordWithdrawal = async () => {
    try {
      if (!withdrawalForm.amount || parseFloat(withdrawalForm.amount) <= 0) {
        alert('Please enter a valid withdrawal amount');
        return;
      }

      if (!withdrawalForm.reason.trim()) {
        alert('Please enter a reason for withdrawal');
        return;
      }

      await fetchWithToken(`${API_BASE_URL}/beverages/cash/withdrawal`, {
        method: 'POST',
        body: JSON.stringify({
          date: cashSelectedDate,
          amount: parseFloat(withdrawalForm.amount),
          reason: withdrawalForm.reason.trim(),
        }),
      });

      alert('✓ Withdrawal recorded!');
      setWithdrawalForm({ amount: '', reason: '' });
      await handleLoadCashData(cashSelectedDate);
    } catch (err) {
      alert(`Failed to record withdrawal: ${err.message}`);
    }
  };

  const handleDeleteWithdrawal = async (withdrawalId) => {
    if (!window.confirm('Delete this withdrawal?')) return;

    try {
      await fetchWithToken(`${API_BASE_URL}/beverages/cash/withdrawal/${withdrawalId}`, {
        method: 'DELETE',
      });

      alert('✓ Withdrawal deleted!');
      await handleLoadCashData(cashSelectedDate);
    } catch (err) {
      alert(`Failed to delete withdrawal: ${err.message}`);
    }
  };

  if (!token) {
    return (
      <div className="p-6 text-center text-red-500">
        <p>Authentication required. Please log in again.</p>
      </div>
    );
  }

  if (error && activeTab !== 'sales') {
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

  const formatDate = (date) => new Date(date).toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
  const formatTime = (date) => new Date(date).toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' });
  const activeSessionIdSet = new Set(activeSessions.map((session) => session._id));

  // ======================================================================
  // TAB: DASHBOARD
  // ======================================================================
  const renderDashboardTab = () => {
    if (loading && !periodStats) {
      return <div className="text-center py-8 text-gray-500">Loading dashboard...</div>;
    }

    const displayStats = periodStats || stats;

    return (
      <div className="space-y-6">
        {/* Low Stock Alerts */}
        {lowStockAlerts.length > 0 && (
          <div className="bg-red-50 border border-red-300 rounded-lg p-4">
            <h3 className="font-semibold text-red-800 mb-2">⚠️ Low Stock Alerts ({lowStockAlerts.length})</h3>
            <div className="space-y-2">
              {lowStockAlerts.map((product) => (
                <div key={product.productId} className="flex justify-between items-center text-sm text-red-700">
                  <span>{product.productName}</span>
                  <span className="font-semibold">
                    {product.currentStock === 0 ? 'OUT OF STOCK' : `${product.currentStock} units`}
                  </span>
                </div>
              ))}
            </div>
            <button
              onClick={() => setActiveModal('purchase')}
              className="mt-3 bg-red-600 text-white px-4 py-2 rounded-lg hover:bg-red-700 text-sm font-medium"
            >
              📦 Record Purchase
            </button>
          </div>
        )}

        {/* Time Period Selector */}
        <div className="bg-white border rounded-lg p-4">
          <div className="flex flex-wrap gap-2 items-center">
            <span className="text-sm font-semibold text-gray-700">Period:</span>
            {['today', 'yesterday', 'this-week', 'last-week', 'this-month', 'last-month', 'custom'].map((period) => (
              <button
                key={period}
                onClick={() => {
                  setTimePeriod(period);
                  if (period !== 'custom') {
                    setCustomDateRange({ startDate: '', endDate: '' });
                  }
                }}
                className={`px-3 py-1 rounded-lg text-sm font-medium transition-colors ${
                  timePeriod === period
                    ? 'bg-primary text-white'
                    : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                }`}
              >
                {period === 'today' ? 'Today' : period === 'yesterday' ? 'Yesterday' : period === 'this-week' ? 'This Week' : period === 'last-week' ? 'Last Week' : period === 'this-month' ? 'This Month' : period === 'last-month' ? 'Last Month' : 'Custom'}
              </button>
            ))}
          </div>

          {/* Custom Date Range Picker */}
          {timePeriod === 'custom' && (
            <div className="mt-4 flex gap-3">
              <input
                type="date"
                value={customDateRange.startDate}
                onChange={(e) => setCustomDateRange({ ...customDateRange, startDate: e.target.value })}
                className="border rounded-lg px-3 py-2 text-sm"
                placeholder="Start Date"
              />
              <input
                type="date"
                value={customDateRange.endDate}
                onChange={(e) => setCustomDateRange({ ...customDateRange, endDate: e.target.value })}
                className="border rounded-lg px-3 py-2 text-sm"
                placeholder="End Date"
              />
            </div>
          )}
        </div>

        {/* Stats Cards */}
        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-4">
          <div className="bg-primary/5 border border-primary/20 rounded-lg p-4">
            <p className="text-sm text-gray-600">Revenue</p>
            <p className="text-2xl font-bold text-primary">{(displayStats.totalRevenue || displayStats.revenue || 0).toFixed(0)} ৳</p>
            <p className="text-xs text-gray-500 mt-1">{displayStats.transactionCount || 0} transactions</p>
          </div>

          <div className="bg-green-50 border border-green-200 rounded-lg p-4">
            <p className="text-sm text-gray-600">Profit</p>
            <p className="text-2xl font-bold text-green-600">{(displayStats.totalProfit || displayStats.profit || 0).toFixed(0)} ৳</p>
            <p className="text-xs text-gray-500 mt-1">{(displayStats.profitMargin || 0).toFixed(1)}% margin</p>
          </div>

          <div className="bg-purple-50 border border-purple-200 rounded-lg p-4">
            <p className="text-sm text-gray-600">Units Sold</p>
            <p className="text-2xl font-bold text-purple-600">{displayStats.totalQuantity || displayStats.quantitySold || 0}</p>
            <p className="text-xs text-gray-500 mt-1">Beverages</p>
          </div>

          <div className="bg-orange-50 border border-orange-200 rounded-lg p-4">
            <p className="text-sm text-gray-600">Total Inventory</p>
            <p className="text-2xl font-bold text-orange-600">{stats.inventory?.totalInventoryValue?.toFixed(0) || 0} ৳</p>
            <p className="text-xs text-gray-500 mt-1">{stats.inventory?.totalProducts || 0} products</p>
          </div>
        </div>

        {/* Action Buttons */}
        <div className="flex flex-wrap gap-3">
          <button
            onClick={() => setActiveModal('sale')}
            className="bg-green-600 text-white px-4 py-2 rounded-lg hover:bg-green-700 font-medium"
          >
            💰 Record Sale
          </button>
          <button
            onClick={() => setActiveModal('purchase')}
            className="bg-purple-600 text-white px-4 py-2 rounded-lg hover:bg-purple-700 font-medium"
          >
            📦 Record Purchase
          </button>
          <button
            onClick={() => setActiveModal('products')}
            className="bg-primary text-white px-4 py-2 rounded-lg hover:bg-primary/90 font-medium"
          >
            🛠️ Manage Products
          </button>
        </div>

        {/* Inventory Status */}
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
                  className={`p-4 border rounded-lg ${
                    product.currentStock === 0
                      ? 'bg-red-50 border-red-300'
                      : product.currentStock < 10
                      ? 'bg-yellow-50 border-yellow-300'
                      : 'bg-green-50 border-green-300'
                  }`}
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
                  {product.currentStock === 0 && (
                    <p className="mt-2 text-xs text-red-600 font-semibold">⚠️ Out of stock!</p>
                  )}
                  {product.currentStock < 10 && product.currentStock > 0 && (
                    <p className="mt-2 text-xs text-yellow-700 font-semibold">⚠️ Low stock warning</p>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Top Products */}
        {displayStats.productBreakdown && displayStats.productBreakdown.length > 0 && (
          <div className="bg-white border rounded-lg p-6">
            <h2 className="text-lg font-semibold mb-4">📈 Top Products</h2>

            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="bg-gray-100 border-b">
                  <tr>
                    <th className="px-4 py-2 text-left">Product</th>
                    <th className="px-4 py-2 text-right">Sold</th>
                    <th className="px-4 py-2 text-right">Revenue</th>
                    <th className="px-4 py-2 text-right">Profit</th>
                    <th className="px-4 py-2 text-right">Margin</th>
                  </tr>
                </thead>
                <tbody>
                  {displayStats.productBreakdown.slice(0, 5).map((item) => (
                    <tr key={item.productId} className="border-b hover:bg-gray-50">
                      <td className="px-4 py-2 font-semibold text-gray-800">{item.productName}</td>
                      <td className="px-4 py-2 text-right text-gray-600">{item.quantitySold}</td>
                      <td className="px-4 py-2 text-right font-semibold text-primary">
                        {(item.revenue || item.revenueToday || 0).toFixed(0)} ৳
                      </td>
                      <td className="px-4 py-2 text-right font-bold text-green-600">
                        {(item.profit || item.profitToday || 0).toFixed(0)} ৳
                      </td>
                      <td className="px-4 py-2 text-right text-gray-600">
                        {(item.profitMargin || item.profitMarginToday || 0)}%
                      </td>
                     </tr>
                  ))}
                </tbody>
            </table>
          </div>
        </div>
        )}
      </div>
    );
  };

  // ======================================================================
  // TAB: SALES
  // ======================================================================
  const renderSalesTab = () => {
    if (loading && sales.length === 0) {
      return <div className="text-center py-8 text-gray-500">Loading sales data...</div>;
    }

    // Calculate sales summary
    const totalRevenue = sales.reduce((sum, sale) => sum + sale.totalAmount, 0);
    const totalProfit = sales.reduce((sum, sale) => sum + sale.profit, 0);
    const totalQuantity = sales.reduce((sum, sale) => {
      return sum + (sale.items ? sale.items.reduce((itemSum, item) => itemSum + item.quantity, 0) : 0);
    }, 0);

    return (
      <div className="space-y-6">
        {/* Header with New Sale Button */}
        <div className="flex justify-between items-center">
          <h2 className="text-lg font-semibold">Sales History</h2>
          <button
            onClick={() => setActiveModal('sale')}
            className="bg-green-600 text-white px-4 py-2 rounded-lg hover:bg-green-700 font-medium flex items-center gap-2"
          >
            💰 New Sale
          </button>
        </div>

        {/* Summary Cards */}
        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-4">
          <div className="bg-primary/5 border border-primary/20 rounded-lg p-4">
            <p className="text-sm text-gray-600">Total Revenue</p>
            <p className="text-2xl font-bold text-primary">{totalRevenue.toFixed(0)} ৳</p>
          </div>
          <div className="bg-green-50 border border-green-200 rounded-lg p-4">
            <p className="text-sm text-gray-600">Total Profit</p>
            <p className="text-2xl font-bold text-green-600">{totalProfit.toFixed(0)} ৳</p>
            <p className="text-xs text-gray-500 mt-1">
              {totalRevenue > 0 ? ((totalProfit / totalRevenue) * 100).toFixed(1) : 0}% margin
            </p>
          </div>
          <div className="bg-purple-50 border border-purple-200 rounded-lg p-4">
            <p className="text-sm text-gray-600">Units Sold</p>
            <p className="text-2xl font-bold text-purple-600">{totalQuantity}</p>
          </div>
          <div className="bg-orange-50 border border-orange-200 rounded-lg p-4">
            <p className="text-sm text-gray-600">Transactions</p>
            <p className="text-2xl font-bold text-orange-600">{sales.length}</p>
          </div>
        </div>

        {/* Filters */}
        <div className="bg-white border rounded-lg p-4">
          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-3">
            <input
              type="date"
              value={salesFilters.startDate}
              onChange={(e) => setSalesFilters({ ...salesFilters, startDate: e.target.value })}
              className="border rounded-lg px-3 py-2 text-sm"
              placeholder="Start Date"
            />
            <input
              type="date"
              value={salesFilters.endDate}
              onChange={(e) => setSalesFilters({ ...salesFilters, endDate: e.target.value })}
              className="border rounded-lg px-3 py-2 text-sm"
              placeholder="End Date"
            />
            <select
              value={salesFilters.productId}
              onChange={(e) => setSalesFilters({ ...salesFilters, productId: e.target.value })}
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
              value={salesFilters.paymentMethod}
              onChange={(e) => setSalesFilters({ ...salesFilters, paymentMethod: e.target.value })}
              className="border rounded-lg px-3 py-2 text-sm"
            >
              <option value="">All Payment Methods</option>
              <option value="Cash">Cash</option>
              <option value="Bank">Bank</option>
              <option value="bKash">bKash</option>
            </select>
          </div>
        </div>

        {/* Sales Table */}
        {sales.length === 0 ? (
          <div className="text-center p-8 text-gray-500 bg-white border rounded-lg">
            <p>No sales recorded yet.</p>
          </div>
        ) : (
          <>
            {/* Mobile card view */}
            <div className="md:hidden space-y-3">
              {sales.map((sale) => {
                if (!sale.items || sale.items.length === 0) return null;
                return (
                  <div key={sale._id} className="bg-white border border-gray-200 rounded-lg p-3 space-y-2">
                    <div className="flex items-start justify-between">
                      <div>
                        <div className="text-xs text-gray-500">{formatDate(sale.date)} {formatTime(sale.date)}</div>
                        <div className="text-xs text-gray-400 font-mono">{sale.receiptId}</div>
                      </div>
                      <span className={`px-2 py-1 rounded text-xs font-medium ${sale.paymentMethod === 'Cash' ? 'bg-green-100 text-green-800' : sale.paymentMethod === 'Bank' ? 'bg-primary/10 text-primary' : 'bg-purple-100 text-purple-800'}`}>{sale.paymentMethod}</span>
                    </div>
                    {sale.items.map((item, i) => (
                      <div key={i} className="flex items-center justify-between text-sm">
                        <span className="font-medium">{item.productName} × {item.quantity}</span>
                        <span className="font-semibold text-primary">{item.lineTotal.toFixed(0)} ৳</span>
                      </div>
                    ))}
                    <div className="flex items-center justify-between pt-1 border-t text-xs">
                      <span className="text-green-600 font-semibold">Profit: {sale.items.reduce((s, i) => s + i.lineProfit, 0).toFixed(0)} ৳</span>
                      <button onClick={() => handleDeleteSale(sale._id)} className="bg-red-500 text-white px-2 py-1 rounded text-xs hover:bg-red-600 min-h-[36px]">🗑️</button>
                    </div>
                  </div>
                );
              })}
            </div>
            {/* Desktop table view */}
            <div className="hidden md:block bg-white border rounded-lg overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-gray-100 border-b">
                <tr>
                  <th className="px-4 py-2 text-left">Date & Time</th>
                  <th className="px-4 py-2 text-left">Receipt</th>
                  <th className="px-4 py-2 text-left">Product</th>
                  <th className="px-4 py-2 text-center">Qty</th>
                  <th className="px-4 py-2 text-right">Price/Unit</th>
                  <th className="px-4 py-2 text-right">Total</th>
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
                            <span
                              className={`px-2 py-1 rounded text-xs font-medium ${
                                sale.paymentMethod === 'Cash'
                                  ? 'bg-green-100 text-green-800'
                                  : sale.paymentMethod === 'Bank'
                                  ? 'bg-primary/10 text-primary'
                                  : 'bg-purple-100 text-purple-800'
                              }`}
                            >
                              {sale.paymentMethod}
                            </span>
                          </td>
                          <td rowSpan={sale.items.length} className="px-4 py-2 text-center">
                            <div className="flex flex-col items-center gap-2">
                              {sale.hourlySessionId && activeSessionIdSet.has(String(sale.hourlySessionId)) && (
                                <button
                                  onClick={() => handleCollectDueSale(sale)}
                                  className="bg-emerald-500 text-white px-2 py-1 rounded text-xs hover:bg-emerald-600"
                                >
                                  💵 Collect
                                </button>
                              )}
                              <button
                                onClick={() => handleDeleteSale(sale._id)}
                                className="bg-red-500 text-white px-2 py-1 rounded text-xs hover:bg-red-600"
                              >
                                🗑️
                              </button>
                            </div>
                          </td>
                        </>
                      )}
                    </tr>
                  ));
                })}
              </tbody>
            </table>
          </div>
          </>
        )}
      </div>
    );
  };

  // ======================================================================
  // TAB: PRODUCTS
  // ======================================================================
  const renderProductsTab = () => {
    return (
      <div className="space-y-6">
        <div className="flex justify-between items-center">
          <h2 className="text-lg font-semibold">Product Catalog</h2>
          <button
            onClick={() => setActiveModal('products')}
            className="bg-primary text-white px-4 py-2 rounded-lg hover:bg-primary/90 font-medium"
          >
            ➕ Add Product
          </button>
        </div>

        {products.length === 0 ? (
          <div className="text-center p-8 text-gray-500 bg-white border rounded-lg">
            <p className="mb-4">No products yet.</p>
            <button
              onClick={() => setActiveModal('products')}
              className="bg-primary text-white px-4 py-2 rounded-lg hover:bg-primary/90"
            >
              Create Your First Product
            </button>
          </div>
        ) : (
          <>
            {/* Mobile card view */}
            <div className="md:hidden space-y-3">
              {products.map((product) => (
                <div key={product._id} className="bg-white border border-gray-200 rounded-lg p-3 space-y-2">
                  <div className="flex items-start justify-between">
                    <div>
                      <div className="font-semibold text-gray-800">{product.name}</div>
                      <div className="text-xs text-gray-500">Stock: {product.currentStock} units</div>
                    </div>
                    <span className={`px-2 py-1 rounded text-xs font-medium ${product.currentStock === 0 ? 'bg-red-100 text-red-800' : product.currentStock < 10 ? 'bg-yellow-100 text-yellow-800' : 'bg-green-100 text-green-800'}`}>
                      {product.currentStock === 0 ? 'Out' : product.currentStock < 10 ? 'Low' : 'OK'}
                    </span>
                  </div>
                  <div className="grid grid-cols-2 gap-2 text-xs">
                    <div><span className="text-gray-500">Cost</span><p className="font-medium">{product.costPrice} ৳</p></div>
                    <div><span className="text-gray-500">Selling</span><p className="font-medium">{product.sellingPrice} ৳</p></div>
                    <div><span className="text-gray-500">Stock Value</span><p className="font-semibold">{(product.currentStock * product.costPrice).toFixed(0)} ৳</p></div>
                  </div>
                  <div className="flex gap-2 pt-1 border-t">
                    <button onClick={() => setActiveModal('products')} className="bg-primary text-white px-3 py-1.5 rounded text-xs hover:bg-primary min-h-[36px]">✏️ Edit</button>
                    <button onClick={() => setActiveModal('purchase')} className="bg-purple-500 text-white px-3 py-1.5 rounded text-xs hover:bg-purple-600 min-h-[36px]">📦 Purchase</button>
                  </div>
                </div>
              ))}
            </div>
            {/* Desktop table view */}
            <div className="hidden md:block bg-white border rounded-lg overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-gray-100 border-b">
                <tr>
                  <th className="px-4 py-2 text-left">Product Name</th>
                  <th className="px-4 py-2 text-center">Current Stock</th>
                  <th className="px-4 py-2 text-right">Cost Price</th>
                  <th className="px-4 py-2 text-right">Selling Price</th>
                  <th className="px-4 py-2 text-right">Stock Value</th>
                  <th className="px-4 py-2 text-center">Status</th>
                  <th className="px-4 py-2 text-center">Actions</th>
                </tr>
              </thead>
              <tbody>
                {products.map((product) => (
                  <tr key={product._id} className="border-b hover:bg-gray-50">
                    <td className="px-4 py-2 font-semibold text-gray-800">{product.name}</td>
                    <td className="px-4 py-2 text-center font-semibold">{product.currentStock}</td>
                    <td className="px-4 py-2 text-right text-gray-600">{product.costPrice} ৳</td>
                    <td className="px-4 py-2 text-right text-gray-600">{product.sellingPrice} ৳</td>
                    <td className="px-4 py-2 text-right font-semibold">
                      {(product.currentStock * product.costPrice).toFixed(0)} ৳
                    </td>
                    <td className="px-4 py-2 text-center">
                      <span
                        className={`px-2 py-1 rounded text-xs font-medium ${
                          product.currentStock === 0
                            ? 'bg-red-100 text-red-800'
                            : product.currentStock < 10
                            ? 'bg-yellow-100 text-yellow-800'
                            : 'bg-green-100 text-green-800'
                        }`}
                      >
                        {product.currentStock === 0 ? 'Out' : product.currentStock < 10 ? 'Low' : 'OK'}
                      </span>
                    </td>
                    <td className="px-4 py-2 text-center">
                      <button
                        onClick={() => setActiveModal('products')}
                        className="bg-primary text-white px-2 py-1 rounded text-xs hover:bg-primary mr-2"
                      >
                        ✏️
                      </button>
                      <button
                        onClick={() => setActiveModal('purchase')}
                        className="bg-purple-500 text-white px-2 py-1 rounded text-xs hover:bg-purple-600"
                      >
                        📦
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          </>
        )}
      </div>
    );
  };

  // ======================================================================
  // TAB: INVENTORY
  // ======================================================================
  const renderInventoryTab = () => {
    return (
      <div className="space-y-6">
        <div className="bg-white border rounded-lg p-6">
          <h2 className="text-lg font-semibold mb-4">📦 Inventory Overview</h2>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
            <div className="bg-primary/5 border border-primary/20 rounded-lg p-4">
              <p className="text-sm text-gray-600">Total Products</p>
              <p className="text-2xl font-bold text-primary">{stats.inventory?.totalProducts || 0}</p>
            </div>
            <div className="bg-purple-50 border border-purple-200 rounded-lg p-4">
              <p className="text-sm text-gray-600">Total Inventory Cost</p>
              <p className="text-2xl font-bold text-purple-600">
                {(stats.inventory?.totalInventoryValue || 0).toFixed(0)} ৳
              </p>
            </div>
            <div className="bg-orange-50 border border-orange-200 rounded-lg p-4">
              <p className="text-sm text-gray-600">Low Stock Items</p>
              <p className="text-2xl font-bold text-orange-600">{lowStockAlerts.length}</p>
            </div>
          </div>

          <h3 className="font-semibold mb-3">Stock Levels</h3>
          <div className="space-y-2">
            {products.map((product) => (
              <div key={product._id} className="flex justify-between items-center p-3 border rounded-lg hover:bg-gray-50">
                <div>
                  <p className="font-semibold text-gray-800">{product.name}</p>
                  <p className="text-sm text-gray-600">
                    Cost: {product.costPrice} ৳ | Selling: {product.sellingPrice} ৳
                  </p>
                </div>
                <div className="text-right">
                  <p className="text-lg font-bold text-gray-800">{product.currentStock}</p>
                  <p className="text-sm text-gray-600">Value: {(product.currentStock * product.costPrice).toFixed(0)} ৳</p>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Low Stock Alert Details */}
        {lowStockAlerts.length > 0 && (
          <div className="bg-red-50 border border-red-300 rounded-lg p-6">
            <h3 className="font-semibold text-red-800 mb-3">⚠️ Products Requiring Attention</h3>
            <div className="space-y-2">
              {lowStockAlerts.map((product) => (
                <div key={product.productId} className="flex justify-between items-center p-3 bg-white rounded-lg border-l-4 border-red-500">
                  <div>
                    <p className="font-semibold text-gray-800">{product.productName}</p>
                    <p className="text-sm text-gray-600">Status: {product.status.toUpperCase()}</p>
                  </div>
                  <div className="text-right">
                    <p className="text-lg font-bold text-red-600">{product.currentStock}</p>
                    <button
                      onClick={() => setActiveModal('purchase')}
                      className="mt-1 text-xs bg-red-600 text-white px-2 py-1 rounded hover:bg-red-700"
                    >
                      Record Purchase
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    );
  };

  const renderCashManagementTab = () => {
    const cashFlowData = cashFlow || {
      openingBalance: 0,
      totalSalesRevenue: 0,
      totalWithdrawals: 0,
      closingBalance: 0,
    };

    const calculatedClosing = cashFlowData.openingBalance + cashFlowData.totalSalesRevenue - cashFlowData.totalWithdrawals;

    return (
      <div className="space-y-6 py-6">
        {/* Date Selector */}
        <div className="bg-white p-4 rounded-lg border">
          <label className="block text-sm font-medium text-gray-700 mb-2">Select Date</label>
          <input
            type="date"
            value={cashSelectedDate}
            onChange={(e) => {
              setCashSelectedDate(e.target.value);
              handleLoadCashData(e.target.value);
            }}
            className="w-full md:w-48 px-3 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-primary"
          />
        </div>

        {/* Metrics Cards */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          <div className="bg-gradient-to-br from-green-50 to-green-100 p-4 rounded-lg border-l-4 border-green-600">
            <p className="text-sm text-gray-600 mb-1">Opening Balance</p>
            <p className="text-2xl font-bold text-green-700">৳{(cashFlowData.openingBalance || 0).toLocaleString()}</p>
          </div>
          <div className="bg-gradient-to-br from-primary/5 to-primary/10 p-4 rounded-lg border-l-4 border-primary">
            <p className="text-sm text-gray-600 mb-1">Sales Revenue</p>
            <p className="text-2xl font-bold text-primary">+৳{(cashFlowData.totalSalesRevenue || 0).toLocaleString()}</p>
          </div>
          <div className="bg-gradient-to-br from-orange-50 to-orange-100 p-4 rounded-lg border-l-4 border-orange-600">
            <p className="text-sm text-gray-600 mb-1">Withdrawals</p>
            <p className="text-2xl font-bold text-orange-700">-৳{(cashFlowData.totalWithdrawals || 0).toLocaleString()}</p>
          </div>
          <div className="bg-gradient-to-br from-purple-50 to-purple-100 p-4 rounded-lg border-l-4 border-purple-600">
            <p className="text-sm text-gray-600 mb-1">Closing Balance</p>
            <p className="text-2xl font-bold text-purple-700">৳{calculatedClosing.toLocaleString()}</p>
          </div>
        </div>

        {/* Calculation Summary */}
        <div className="bg-gray-50 p-4 rounded-lg border">
          <p className="text-sm text-gray-700">
            <span className="font-semibold">Calculation: </span>
            ৳{(cashFlowData.openingBalance || 0).toLocaleString()} (opening) + ৳{(cashFlowData.totalSalesRevenue || 0).toLocaleString()} (sales) - ৳{(cashFlowData.totalWithdrawals || 0).toLocaleString()} (withdrawn) = <span className="font-bold text-purple-700">৳{calculatedClosing.toLocaleString()}</span>
          </p>
        </div>

        {/* Opening Balance Section */}
        <div className="bg-white p-6 rounded-lg border">
          <h3 className="text-lg font-semibold text-gray-800 mb-4">Set Opening Balance</h3>
          <div className="flex flex-col md:flex-row gap-3">
            <input
              type="number"
              placeholder="Enter opening balance amount"
              value={openingBalanceForm}
              onChange={(e) => setOpeningBalanceForm(e.target.value)}
              className="flex-1 px-4 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-primary"
            />
            <button
              onClick={handleSetOpeningBalance}
              className="bg-primary text-white px-6 py-2 rounded-lg hover:bg-primary/90 font-medium"
            >
              Save Opening Balance
            </button>
          </div>
          {cashFlow && (
            <p className="text-sm text-gray-600 mt-3">Current opening balance for {cashSelectedDate}: ৳{(cashFlow.openingBalance || 0).toLocaleString()}</p>
          )}
        </div>

        {/* Withdrawal Recording Section */}
        <div className="bg-white p-6 rounded-lg border">
          <h3 className="text-lg font-semibold text-gray-800 mb-4">Record Withdrawal</h3>
          <div className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <input
                type="number"
                placeholder="Withdrawal amount"
                value={withdrawalForm.amount}
                onChange={(e) => setWithdrawalForm({ ...withdrawalForm, amount: e.target.value })}
                className="px-4 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-primary"
              />
              <input
                type="text"
                placeholder="Reason (e.g., Admin fee, Maintenance)"
                value={withdrawalForm.reason}
                onChange={(e) => setWithdrawalForm({ ...withdrawalForm, reason: e.target.value })}
                className="px-4 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-primary"
              />
            </div>
            <button
              onClick={handleRecordWithdrawal}
              className="w-full bg-orange-600 text-white px-4 py-2 rounded-lg hover:bg-orange-700 font-medium"
            >
              Record Withdrawal
            </button>
          </div>
        </div>

        {/* Withdrawal History */}
        <div className="bg-white p-6 rounded-lg border">
          <h3 className="text-lg font-semibold text-gray-800 mb-4">
            Withdrawal History ({withdrawals.length} withdrawals)
          </h3>
          {withdrawals.length === 0 ? (
            <p className="text-gray-500 text-center py-6">No withdrawals recorded for this date</p>
          ) : (
            <div className="space-y-2 max-h-96 overflow-y-auto">
              {withdrawals.map((withdrawal) => (
                <div
                  key={withdrawal._id}
                  className="flex justify-between items-center p-3 bg-gray-50 rounded border-l-4 border-orange-500"
                >
                  <div>
                    <p className="font-medium text-gray-800">৳{withdrawal.amount.toLocaleString()}</p>
                    <p className="text-sm text-gray-600">{withdrawal.reason}</p>
                    <p className="text-xs text-gray-500">Recorded by: {withdrawal.recordedBy}</p>
                  </div>
                  <button
                    onClick={() => handleDeleteWithdrawal(withdrawal._id)}
                    className="bg-red-600 text-white px-3 py-1 rounded text-sm hover:bg-red-700"
                  >
                    Delete
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    );
  };

  return (
    <div className="p-6 space-y-6">
      {/* Header */}
      <div className="flex justify-between items-center">
        <h1 className="text-2xl md:text-3xl font-bold text-gray-800">🧃 Beverage Sales Management</h1>
      </div>

      {/* Tab Navigation */}
      <div className="flex flex-wrap gap-2 border-b">
        {[
          { id: 'dashboard', label: '📊 Dashboard' },
          { id: 'sales', label: '💰 Sales' },
          { id: 'products', label: '📦 Products' },
          { id: 'inventory', label: '🏭 Inventory' },
          { id: 'cash', label: '💵 Cash Mgmt' },
        ].map((tab) => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id)}
            className={`px-4 py-3 font-medium border-b-2 transition-colors ${
              activeTab === tab.id
                ? 'border-primary text-primary'
                : 'border-transparent text-gray-600 hover:text-gray-800'
            }`}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {/* Tab Content */}
      <div>
        {activeTab === 'dashboard' && renderDashboardTab()}
        {activeTab === 'sales' && renderSalesTab()}
        {activeTab === 'products' && renderProductsTab()}
        {activeTab === 'inventory' && renderInventoryTab()}
        {activeTab === 'cash' && renderCashManagementTab()}
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
          activeSessions={activeSessions}
          onClose={() => setActiveModal(null)}
          onSave={handleRecordSale}
        />
      )}
    </div>
  );
}
