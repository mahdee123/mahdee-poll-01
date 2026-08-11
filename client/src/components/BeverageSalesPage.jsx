import React, { useState, useEffect } from 'react';
import {
  LayoutDashboard, Receipt, Package, Warehouse, Wallet, Trash2, Pencil, PackagePlus,
} from 'lucide-react';
import { API_BASE_URL, NetworkError } from '../api';
import BeverageProductManager from './BeverageProductManager';
import InventoryPurchaseForm from './InventoryPurchaseForm';
import BeverageSalesForm from './BeverageSalesForm';
import { useToast } from '../context/ToastContext';
import useConfirm from '../hooks/useConfirm';
import Button from './Button';

export default function BeverageSalesPage({ token, setLastReceipt }) {
  const toast = useToast();
  const [confirm, confirmDialog] = useConfirm();
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
      toast.success('Purchase recorded.');
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
      
      toast.success('Sale recorded.');
      
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
      
      // IMPORTANT: Refresh cash management data since sales affect cash balance
      if (activeTab === 'cash-mgmt' || activeTab === 'dashboard') {
        await handleLoadCashData(cashSelectedDate);
      }
    } catch (err) {
      console.error('Error deleting sale:', err);
      toast.error(`Could not delete sale. ${err.message}`);
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

      toast.success(`Due collected for ${sale.receiptId}.`);
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
      toast.error(`Could not collect due sale. ${err.message}`);
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
        toast.error('Enter a valid opening balance.');
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

      toast.success('Opening balance saved.');
      await handleLoadCashData(cashSelectedDate);
    } catch (err) {
      toast.error(`Could not save opening balance. ${err.message}`);
    }
  };

  const handleRecordWithdrawal = async () => {
    try {
      if (!withdrawalForm.amount || parseFloat(withdrawalForm.amount) <= 0) {
        toast.error('Enter a valid withdrawal amount.');
        return;
      }

      if (!withdrawalForm.reason.trim()) {
        toast.error('Enter a reason for the withdrawal.');
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

      toast.success('Withdrawal recorded.');
      setWithdrawalForm({ amount: '', reason: '' });
      await handleLoadCashData(cashSelectedDate);
    } catch (err) {
      toast.error(`Could not record withdrawal. ${err.message}`);
    }
  };

  const handleDeleteWithdrawal = async (withdrawalId) => {
    if (!(await confirm({ title: 'Delete this withdrawal?', message: 'The cash drawer total will be recalculated.', confirmText: 'Delete', destructive: true }))) return;

    try {
      await fetchWithToken(`${API_BASE_URL}/beverages/cash/withdrawal/${withdrawalId}`, {
        method: 'DELETE',
      });

      toast.success('Withdrawal deleted.');
      await handleLoadCashData(cashSelectedDate);
    } catch (err) {
      toast.error(`Could not delete withdrawal. ${err.message}`);
    }
  };

  if (!token) {
    return (
      <div className="p-6 text-center text-danger">
        <p>Authentication required. Please log in again.</p>
      </div>
    );
  }

  if (error && activeTab !== 'sales') {
    return (
      <div className="p-6 text-center text-danger space-y-3">
        <p>Error: {error}</p>
        <Button onClick={() => window.location.reload()}>Reload</Button>
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
      return <div className="text-center py-8 text-ink-soft">Loading dashboard...</div>;
    }

    const displayStats = periodStats || stats;

    return (
      <div className="space-y-6">
        {/* Low Stock Alerts */}
        {lowStockAlerts.length > 0 && (
          <div className="bg-danger-soft border border-danger/30 rounded-card p-4">
            <h3 className="font-semibold text-danger-ink mb-2">Low Stock Alerts ({lowStockAlerts.length})</h3>
            <div className="space-y-2">
              {lowStockAlerts.map((product) => (
                <div key={product.productId} className="flex justify-between items-center text-sm text-danger-ink">
                  <span>{product.productName}</span>
                  <span className="font-semibold">
                    {product.currentStock === 0 ? 'OUT OF STOCK' : `${product.currentStock} units`}
                  </span>
                </div>
              ))}
            </div>
            <button
              onClick={() => setActiveModal('purchase')}
              className="mt-3 bg-danger text-white px-4 py-2 rounded-lg hover:bg-danger-ink text-sm font-medium"
            >
              Record Purchase
            </button>
          </div>
        )}

        {/* Time Period Selector */}
        <div className="card p-4">
          <div className="flex flex-wrap gap-2 items-center">
            <span className="text-sm font-semibold text-ink">Period:</span>
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
                    : 'bg-canvas text-ink hover:bg-line/60'
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
                className="input"
                placeholder="Start Date"
              />
              <input
                type="date"
                value={customDateRange.endDate}
                onChange={(e) => setCustomDateRange({ ...customDateRange, endDate: e.target.value })}
                className="input"
                placeholder="End Date"
              />
            </div>
          )}
        </div>

        {/* Stats Cards */}
        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-4">
          <div className="bg-primary/5 border border-primary/20 rounded-card p-4">
            <p className="text-sm text-ink-soft">Revenue</p>
            <p className="text-2xl font-bold text-primary">{(displayStats.totalRevenue || displayStats.revenue || 0).toFixed(0)} ৳</p>
            <p className="text-xs text-ink-soft mt-1">{displayStats.transactionCount || 0} transactions</p>
          </div>

          <div className="bg-success-soft border border-success/20 rounded-card p-4">
            <p className="text-sm text-ink-soft">Profit</p>
            <p className="text-2xl font-bold text-success">{(displayStats.totalProfit || displayStats.profit || 0).toFixed(0)} ৳</p>
            <p className="text-xs text-ink-soft mt-1">{(displayStats.profitMargin || 0).toFixed(1)}% margin</p>
          </div>

          <div className="bg-canvas border border-line rounded-card p-4">
            <p className="text-sm text-ink-soft">Units Sold</p>
            <p className="text-2xl font-bold text-ink">{displayStats.totalQuantity || displayStats.quantitySold || 0}</p>
            <p className="text-xs text-ink-soft mt-1">Beverages</p>
          </div>

          <div className="bg-warning-soft border border-warning/20 rounded-card p-4">
            <p className="text-sm text-ink-soft">Total Inventory</p>
            <p className="text-2xl font-bold text-warning">{stats.inventory?.totalInventoryValue?.toFixed(0) || 0} ৳</p>
            <p className="text-xs text-ink-soft mt-1">{stats.inventory?.totalProducts || 0} products</p>
          </div>
        </div>

        {/* Action Buttons */}
        <div className="flex flex-wrap gap-3">
          <button
            onClick={() => setActiveModal('sale')}
            className="bg-success text-white px-4 py-2 rounded-lg hover:bg-success/90 font-medium"
          >
            Record Sale
          </button>
          <button
            onClick={() => setActiveModal('purchase')}
            className="bg-ink text-white px-4 py-2 rounded-control hover:bg-ink/90 font-medium"
          >
            Record Purchase
          </button>
          <button
            onClick={() => setActiveModal('products')}
            className="bg-primary text-white px-4 py-2 rounded-lg hover:bg-primary/90 font-medium"
          >
            Manage Products
          </button>
        </div>

        {/* Inventory Status */}
        <div className="card p-6">
          <h2 className="text-lg font-semibold mb-4">Inventory Status</h2>

          {products.length === 0 ? (
            <div className="text-center p-8 text-ink-soft">
              <p>No products yet. Create your first beverage product!</p>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {products.map((product) => (
                <div
                  key={product._id}
                  className={`p-4 border rounded-lg ${
                    product.currentStock === 0
                      ? 'bg-danger-soft border-danger/30'
                      : product.currentStock < 10
                      ? 'bg-warning-soft border-warning/30'
                      : 'bg-success-soft border-success/30'
                  }`}
                >
                  <h4 className="font-semibold text-ink">{product.name}</h4>
                  <div className="mt-2 space-y-1 text-sm">
                    <p>
                      Stock: <span className="font-bold text-lg">{product.currentStock}</span> {product.unit}s
                    </p>
                    <p className="text-ink-soft">
                      Cost: {product.costPrice} ৳ | Sell: {product.sellingPrice} ৳
                    </p>
                    <p className="text-ink-soft">
                      Value: {(product.currentStock * product.costPrice).toFixed(0)} ৳
                    </p>
                  </div>
                  {product.currentStock === 0 && (
                    <p className="mt-2 text-xs text-danger font-semibold">Out of stock!</p>
                  )}
                  {product.currentStock < 10 && product.currentStock > 0 && (
                    <p className="mt-2 text-xs text-warning-ink font-semibold">Low stock warning</p>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Top Products */}
        {displayStats.productBreakdown && displayStats.productBreakdown.length > 0 && (
          <div className="card p-6">
            <h2 className="text-lg font-semibold mb-4">Top Products</h2>

            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="bg-canvas border-b">
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
                    <tr key={item.productId} className="border-b hover:bg-canvas">
                      <td className="px-4 py-2 font-semibold text-ink">{item.productName}</td>
                      <td className="px-4 py-2 text-right text-ink-soft">{item.quantitySold}</td>
                      <td className="px-4 py-2 text-right font-semibold text-primary">
                        {(item.revenue || item.revenueToday || 0).toFixed(0)} ৳
                      </td>
                      <td className="px-4 py-2 text-right font-bold text-success">
                        {(item.profit || item.profitToday || 0).toFixed(0)} ৳
                      </td>
                      <td className="px-4 py-2 text-right text-ink-soft">
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
      return <div className="text-center py-8 text-ink-soft">Loading sales data...</div>;
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
            className="bg-success text-white px-4 py-2 rounded-lg hover:bg-success/90 font-medium flex items-center gap-2"
          >
            New Sale
          </button>
        </div>

        {/* Summary Cards */}
        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-4">
          <div className="bg-primary/5 border border-primary/20 rounded-card p-4">
            <p className="text-sm text-ink-soft">Total Revenue</p>
            <p className="text-2xl font-bold text-primary">{totalRevenue.toFixed(0)} ৳</p>
          </div>
          <div className="bg-success-soft border border-success/20 rounded-card p-4">
            <p className="text-sm text-ink-soft">Total Profit</p>
            <p className="text-2xl font-bold text-success">{totalProfit.toFixed(0)} ৳</p>
            <p className="text-xs text-ink-soft mt-1">
              {totalRevenue > 0 ? ((totalProfit / totalRevenue) * 100).toFixed(1) : 0}% margin
            </p>
          </div>
          <div className="bg-canvas border border-line rounded-card p-4">
            <p className="text-sm text-ink-soft">Units Sold</p>
            <p className="text-2xl font-bold text-ink">{totalQuantity}</p>
          </div>
          <div className="bg-warning-soft border border-warning/20 rounded-card p-4">
            <p className="text-sm text-ink-soft">Transactions</p>
            <p className="text-2xl font-bold text-warning">{sales.length}</p>
          </div>
        </div>

        {/* Filters */}
        <div className="card p-4">
          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-3">
            <input
              type="date"
              value={salesFilters.startDate}
              onChange={(e) => setSalesFilters({ ...salesFilters, startDate: e.target.value })}
              className="input"
              placeholder="Start Date"
            />
            <input
              type="date"
              value={salesFilters.endDate}
              onChange={(e) => setSalesFilters({ ...salesFilters, endDate: e.target.value })}
              className="input"
              placeholder="End Date"
            />
            <select
              value={salesFilters.productId}
              onChange={(e) => setSalesFilters({ ...salesFilters, productId: e.target.value })}
              className="input"
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
              className="input"
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
          <div className="text-center p-8 text-ink-soft card">
            <p>No sales recorded yet.</p>
          </div>
        ) : (
          <>
            {/* Mobile card view */}
            <div className="md:hidden space-y-3">
              {sales.map((sale) => {
                if (!sale.items || sale.items.length === 0) return null;
                return (
                  <div key={sale._id} className="card p-4 border-line space-y-2">
                    <div className="flex items-start justify-between">
                      <div>
                        <div className="text-xs text-ink-soft">{formatDate(sale.date)} {formatTime(sale.date)}</div>
                        <div className="text-xs text-ink-faint font-mono">{sale.receiptId}</div>
                      </div>
                      <span className={`px-2 py-1 rounded text-xs font-medium ${sale.paymentMethod === 'Cash' ? 'bg-success-soft text-success-ink' : sale.paymentMethod === 'Bank' ? 'bg-primary/10 text-primary' : 'bg-warning-soft text-warning-ink'}`}>{sale.paymentMethod}</span>
                    </div>
                    {sale.items.map((item, i) => (
                      <div key={i} className="flex items-center justify-between text-sm">
                        <span className="font-medium">{item.productName} × {item.quantity}</span>
                        <span className="font-semibold text-primary">{item.lineTotal.toFixed(0)} ৳</span>
                      </div>
                    ))}
                    <div className="flex items-center justify-between pt-1 border-t text-xs">
                      <span className="text-success font-semibold">Profit: {sale.items.reduce((s, i) => s + i.lineProfit, 0).toFixed(0)} ৳</span>
                      <button onClick={() => handleDeleteSale(sale._id)} className="w-8 h-8 flex items-center justify-center rounded-control text-danger hover:bg-danger-soft" aria-label="Delete sale"><Trash2 size={14} /></button>
                    </div>
                  </div>
                );
              })}
            </div>
            {/* Desktop table view */}
            <div className="hidden md:block table-shell">
            <table className="w-full text-sm">
              <thead className="bg-canvas border-b">
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
                    <tr key={`${sale._id}-${itemIndex}`} className="border-b hover:bg-canvas">
                      {itemIndex === 0 && (
                        <>
                          <td rowSpan={sale.items.length} className="px-4 py-2 text-ink-soft">
                            <div className="text-sm">{formatDate(sale.date)}</div>
                            <div className="text-xs text-ink-soft">{formatTime(sale.date)}</div>
                          </td>
                          <td rowSpan={sale.items.length} className="px-4 py-2 font-mono text-xs text-ink-soft">
                            {sale.receiptId}
                          </td>
                        </>
                      )}
                      <td className="px-4 py-2 font-semibold text-ink">{item.productName}</td>
                      <td className="px-4 py-2 text-center font-semibold">{item.quantity}</td>
                      <td className="px-4 py-2 text-right text-ink-soft">{item.sellingPricePerUnit} ৳</td>
                      <td className="px-4 py-2 text-right font-semibold text-primary">
                        {item.lineTotal.toFixed(0)} ৳
                      </td>
                      <td className="px-4 py-2 text-right font-bold">
                        <span className="text-success">{item.lineProfit.toFixed(0)} ৳</span>
                      </td>
                      {itemIndex === 0 && (
                        <>
                          <td rowSpan={sale.items.length} className="px-4 py-2 text-center">
                            <span
                              className={`px-2 py-1 rounded text-xs font-medium ${
                                sale.paymentMethod === 'Cash'
                                  ? 'bg-success-soft text-success-ink'
                                  : sale.paymentMethod === 'Bank'
                                  ? 'bg-primary/10 text-primary'
                                  : 'bg-warning-soft text-warning-ink'
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
                                  className="bg-success text-white px-2 py-1 rounded text-xs hover:bg-success/90"
                                >
                                  Collect
                                </button>
                              )}
                              <button
                                onClick={() => handleDeleteSale(sale._id)}
                                className="w-8 h-8 flex items-center justify-center rounded-control text-danger hover:bg-danger-soft"
                                aria-label="Delete sale"
                              >
                                <Trash2 size={14} />
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
            Add Product
          </button>
        </div>

        {products.length === 0 ? (
          <div className="text-center p-8 text-ink-soft card">
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
                <div key={product._id} className="card p-4 border-line space-y-2">
                  <div className="flex items-start justify-between">
                    <div>
                      <div className="font-semibold text-ink">{product.name}</div>
                      <div className="text-xs text-ink-soft">Stock: {product.currentStock} units</div>
                    </div>
                    <span className={`px-2 py-1 rounded text-xs font-medium ${product.currentStock === 0 ? 'bg-danger-soft text-danger-ink' : product.currentStock < 10 ? 'bg-warning-soft text-warning-ink' : 'bg-success-soft text-success-ink'}`}>
                      {product.currentStock === 0 ? 'Out' : product.currentStock < 10 ? 'Low' : 'OK'}
                    </span>
                  </div>
                  <div className="grid grid-cols-2 gap-2 text-xs">
                    <div><span className="text-ink-soft">Cost</span><p className="font-medium">{product.costPrice} ৳</p></div>
                    <div><span className="text-ink-soft">Selling</span><p className="font-medium">{product.sellingPrice} ৳</p></div>
                    <div><span className="text-ink-soft">Stock Value</span><p className="font-semibold">{(product.currentStock * product.costPrice).toFixed(0)} ৳</p></div>
                  </div>
                  <div className="flex gap-2 pt-1 border-t">
                    <button onClick={() => setActiveModal('products')} className="flex items-center gap-1.5 bg-primary text-white px-3 py-1.5 rounded-control text-xs hover:bg-primary-600 min-h-[36px]"><Pencil size={12} /> Edit</button>
                    <button onClick={() => setActiveModal('purchase')} className="flex items-center gap-1.5 bg-ink text-white px-3 py-1.5 rounded-control text-xs hover:bg-ink/90 min-h-[36px]"><PackagePlus size={12} /> Purchase</button>
                  </div>
                </div>
              ))}
            </div>
            {/* Desktop table view */}
            <div className="hidden md:block table-shell">
            <table className="w-full text-sm">
              <thead className="bg-canvas border-b">
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
                  <tr key={product._id} className="border-b hover:bg-canvas">
                    <td className="px-4 py-2 font-semibold text-ink">{product.name}</td>
                    <td className="px-4 py-2 text-center font-semibold">{product.currentStock}</td>
                    <td className="px-4 py-2 text-right text-ink-soft">{product.costPrice} ৳</td>
                    <td className="px-4 py-2 text-right text-ink-soft">{product.sellingPrice} ৳</td>
                    <td className="px-4 py-2 text-right font-semibold">
                      {(product.currentStock * product.costPrice).toFixed(0)} ৳
                    </td>
                    <td className="px-4 py-2 text-center">
                      <span
                        className={`px-2 py-1 rounded text-xs font-medium ${
                          product.currentStock === 0
                            ? 'bg-danger-soft text-danger-ink'
                            : product.currentStock < 10
                            ? 'bg-warning-soft text-warning-ink'
                            : 'bg-success-soft text-success-ink'
                        }`}
                      >
                        {product.currentStock === 0 ? 'Out' : product.currentStock < 10 ? 'Low' : 'OK'}
                      </span>
                    </td>
                    <td className="px-4 py-2 text-center">
                      <button
                        onClick={() => setActiveModal('products')}
                        className="w-8 h-8 inline-flex items-center justify-center rounded-control text-primary hover:bg-primary-50 mr-1"
                        aria-label="Edit product"
                      >
                        <Pencil size={14} />
                      </button>
                      <button
                        onClick={() => setActiveModal('purchase')}
                        className="w-8 h-8 inline-flex items-center justify-center rounded-control text-ink-soft hover:bg-canvas"
                        aria-label="Record purchase"
                      >
                        <PackagePlus size={14} />
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
        <div className="card p-6">
          <h2 className="text-lg font-semibold mb-4">Inventory Overview</h2>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
            <div className="bg-primary/5 border border-primary/20 rounded-card p-4">
              <p className="text-sm text-ink-soft">Total Products</p>
              <p className="text-2xl font-bold text-primary">{stats.inventory?.totalProducts || 0}</p>
            </div>
            <div className="bg-canvas border border-line rounded-card p-4">
              <p className="text-sm text-ink-soft">Total Inventory Cost</p>
              <p className="text-2xl font-bold text-ink">
                {(stats.inventory?.totalInventoryValue || 0).toFixed(0)} ৳
              </p>
            </div>
            <div className="bg-warning-soft border border-warning/20 rounded-card p-4">
              <p className="text-sm text-ink-soft">Low Stock Items</p>
              <p className="text-2xl font-bold text-warning">{lowStockAlerts.length}</p>
            </div>
          </div>

          <h3 className="font-semibold mb-3">Stock Levels</h3>
          <div className="space-y-2">
            {products.map((product) => (
              <div key={product._id} className="flex justify-between items-center p-3 border rounded-lg hover:bg-canvas">
                <div>
                  <p className="font-semibold text-ink">{product.name}</p>
                  <p className="text-sm text-ink-soft">
                    Cost: {product.costPrice} ৳ | Selling: {product.sellingPrice} ৳
                  </p>
                </div>
                <div className="text-right">
                  <p className="text-lg font-bold text-ink">{product.currentStock}</p>
                  <p className="text-sm text-ink-soft">Value: {(product.currentStock * product.costPrice).toFixed(0)} ৳</p>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Low Stock Alert Details */}
        {lowStockAlerts.length > 0 && (
          <div className="bg-danger-soft border border-danger/30 rounded-card p-6">
            <h3 className="font-semibold text-danger-ink mb-3">Products Requiring Attention</h3>
            <div className="space-y-2">
              {lowStockAlerts.map((product) => (
                <div key={product.productId} className="flex justify-between items-center p-3 bg-white rounded-lg border-l-4 border-danger">
                  <div>
                    <p className="font-semibold text-ink">{product.productName}</p>
                    <p className="text-sm text-ink-soft">Status: {product.status.toUpperCase()}</p>
                  </div>
                  <div className="text-right">
                    <p className="text-lg font-bold text-danger">{product.currentStock}</p>
                    <button
                      onClick={() => setActiveModal('purchase')}
                      className="mt-1 text-xs bg-danger text-white px-2 py-1 rounded hover:bg-danger-ink"
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
        <div className="card p-4">
          <label className="block text-sm font-medium text-ink mb-2">Select Date</label>
          <input
            type="date"
            value={cashSelectedDate}
            onChange={(e) => {
              setCashSelectedDate(e.target.value);
              handleLoadCashData(e.target.value);
            }}
            className="input w-full md:w-48"
          />
        </div>

        {/* Metrics Cards */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          <div className="bg-success-soft p-4 rounded-card border-l-4 border-success">
            <p className="text-sm text-ink-soft mb-1">Opening Balance</p>
            <p className="text-2xl font-bold text-success-ink">৳{(cashFlowData.openingBalance || 0).toLocaleString()}</p>
          </div>
          <div className="bg-primary-50 p-4 rounded-card border-l-4 border-primary">
            <p className="text-sm text-ink-soft mb-1">Sales Revenue</p>
            <p className="text-2xl font-bold text-primary">+৳{(cashFlowData.totalSalesRevenue || 0).toLocaleString()}</p>
          </div>
          <div className="bg-warning-soft p-4 rounded-card border-l-4 border-warning">
            <p className="text-sm text-ink-soft mb-1">Withdrawals</p>
            <p className="text-2xl font-bold text-warning-ink">-৳{(cashFlowData.totalWithdrawals || 0).toLocaleString()}</p>
          </div>
          <div className="bg-canvas p-4 rounded-card border-l-4 border-ink">
            <p className="text-sm text-ink-soft mb-1">Closing Balance</p>
            <p className="text-2xl font-bold text-ink">৳{calculatedClosing.toLocaleString()}</p>
          </div>
        </div>

        {/* Calculation Summary */}
        <div className="bg-canvas p-4 rounded-lg border">
          <p className="text-sm text-ink">
            <span className="font-semibold">Calculation: </span>
            ৳{(cashFlowData.openingBalance || 0).toLocaleString()} (opening) + ৳{(cashFlowData.totalSalesRevenue || 0).toLocaleString()} (sales) - ৳{(cashFlowData.totalWithdrawals || 0).toLocaleString()} (withdrawn) = <span className="font-bold text-ink">৳{calculatedClosing.toLocaleString()}</span>
          </p>
        </div>

        {/* Opening Balance Section */}
        <div className="card p-6">
          <h3 className="text-lg font-semibold text-ink mb-4">Set Opening Balance</h3>
          <div className="flex flex-col md:flex-row gap-3">
            <input
              type="number"
              placeholder="Enter opening balance amount"
              value={openingBalanceForm}
              onChange={(e) => setOpeningBalanceForm(e.target.value)}
              className="input flex-1"
            />
            <button
              onClick={handleSetOpeningBalance}
              className="bg-primary text-white px-6 py-2 rounded-lg hover:bg-primary/90 font-medium"
            >
              Save Opening Balance
            </button>
          </div>
          {cashFlow && (
            <p className="text-sm text-ink-soft mt-3">Current opening balance for {cashSelectedDate}: ৳{(cashFlow.openingBalance || 0).toLocaleString()}</p>
          )}
        </div>

        {/* Withdrawal Recording Section */}
        <div className="card p-6">
          <h3 className="text-lg font-semibold text-ink mb-4">Record Withdrawal</h3>
          <div className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <input
                type="number"
                placeholder="Withdrawal amount"
                value={withdrawalForm.amount}
                onChange={(e) => setWithdrawalForm({ ...withdrawalForm, amount: e.target.value })}
                className="input"
              />
              <input
                type="text"
                placeholder="Reason (e.g., Admin fee, Maintenance)"
                value={withdrawalForm.reason}
                onChange={(e) => setWithdrawalForm({ ...withdrawalForm, reason: e.target.value })}
                className="input"
              />
            </div>
            <button
              onClick={handleRecordWithdrawal}
              className="w-full bg-warning text-white px-4 py-2 rounded-lg hover:bg-warning/90 font-medium"
            >
              Record Withdrawal
            </button>
          </div>
        </div>

        {/* Withdrawal History */}
        <div className="card p-6">
          <h3 className="text-lg font-semibold text-ink mb-4">
            Withdrawal History ({withdrawals.length} withdrawals)
          </h3>
          {withdrawals.length === 0 ? (
            <p className="text-ink-soft text-center py-6">No withdrawals recorded for this date</p>
          ) : (
            <div className="space-y-2 max-h-96 overflow-y-auto">
              {withdrawals.map((withdrawal) => (
                <div
                  key={withdrawal._id}
                  className="flex justify-between items-center p-3 bg-canvas rounded border-l-4 border-warning"
                >
                  <div>
                    <p className="font-medium text-ink">৳{withdrawal.amount.toLocaleString()}</p>
                    <p className="text-sm text-ink-soft">{withdrawal.reason}</p>
                    <p className="text-xs text-ink-soft">Recorded by: {withdrawal.recordedBy}</p>
                  </div>
                  <button
                    onClick={() => handleDeleteWithdrawal(withdrawal._id)}
                    className="bg-danger text-white px-3 py-1 rounded text-sm hover:bg-danger-ink"
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
    <div className="space-y-6">
      {confirmDialog}

      {/* Tab Navigation */}
      <div className="segmented flex-wrap">
        {[
          { id: 'dashboard', label: 'Dashboard', icon: LayoutDashboard },
          { id: 'sales', label: 'Sales', icon: Receipt },
          { id: 'products', label: 'Products', icon: Package },
          { id: 'inventory', label: 'Inventory', icon: Warehouse },
          { id: 'cash', label: 'Cash Mgmt', icon: Wallet },
        ].map((tab) => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id)}
            className={`flex items-center gap-1.5 ${activeTab === tab.id ? 'segmented-item-active' : 'segmented-item'}`}
          >
            <tab.icon size={14} /> {tab.label}
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
