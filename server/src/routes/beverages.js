import express from 'express';
import { authRequired, requireRole } from '../middleware/auth.js';
import { validateCompanyContext } from '../middleware/tenantContext.js';
import { generateReceiptId } from '../utils/ids.js';
import { getCompanyModel } from '../utils/modelRegistry.js';

const router = express.Router();

// ============================================================================
// PRODUCT MANAGEMENT
// ============================================================================

// Create beverage product
router.post('/products', authRequired, requireRole('admin', 'manager'), validateCompanyContext, async (req, res) => {
  try {
    const { name, costPrice, sellingPrice, unit, description } = req.body;

    // Validation
    if (!name || !name.trim()) {
      return res.status(400).json({ message: 'Product name is required' });
    }
    if (!costPrice || costPrice < 0) {
      return res.status(400).json({ message: 'Cost price must be a positive number' });
    }
    if (!sellingPrice || sellingPrice < 0) {
      return res.status(400).json({ message: 'Selling price must be a positive number' });
    }

    const BeverageProduct = getCompanyModel(req.companyDb, 'BeverageProduct');
    const product = new BeverageProduct({
      companyId: req.companyId,
      name: name.trim(),
      costPrice,
      sellingPrice,
      currentStock: 0,
      unit: unit || 'Bottle',
      description: description ? description.trim() : '',
    });

    console.log(`[Beverage] Creating product: ${name} (Cost: ${costPrice}, Selling: ${sellingPrice}, Company: ${req.companyId})`);
    await product.save();
    console.log(`[Beverage] ✓ Product created with ID: ${product._id}`);
    return res.status(201).json({ product });
  } catch (error) {
    console.error(`[Beverage] ✗ ERROR in POST /products:`, error.message);
    return res.status(500).json({ success: false, message: 'Failed to create product', error: error.message });
  }
});

// Get all products for company
router.get('/products', authRequired, requireRole('admin', 'manager'), validateCompanyContext, async (req, res) => {
  try {
    const BeverageProduct = getCompanyModel(req.companyDb, 'BeverageProduct');
    const products = await BeverageProduct.find({ companyId: req.companyId }).sort({ name: 1 });
    return res.json({ products });
  } catch (error) {
    console.error(`[Beverage] ✗ ERROR in GET /products:`, error.message);
    return res.status(500).json({ error: error.message });
  }
});

// Update product
router.patch('/products/:id', authRequired, requireRole('admin', 'manager'), validateCompanyContext, async (req, res) => {
  try {
    const { id } = req.params;
    const { name, costPrice, sellingPrice, unit, description } = req.body;

    const BeverageProduct = getCompanyModel(req.companyDb, 'BeverageProduct');
    const product = await BeverageProduct.findOne({ _id: id, companyId: req.companyId });

    if (!product) {
      return res.status(404).json({ message: 'Product not found' });
    }

    // Update fields if provided
    if (name !== undefined) product.name = name.trim();
    if (costPrice !== undefined) product.costPrice = costPrice;
    if (sellingPrice !== undefined) product.sellingPrice = sellingPrice;
    if (unit !== undefined) product.unit = unit;
    if (description !== undefined) product.description = description ? description.trim() : '';

    console.log(`[Beverage] Updating product: ${product.name} (ID: ${id})`);
    await product.save();
    console.log(`[Beverage] ✓ Product updated`);
    return res.json({ product });
  } catch (error) {
    console.error(`[Beverage] ✗ ERROR in PATCH /products/:id:`, error.message);
    return res.status(500).json({ error: error.message });
  }
});

// Delete product
router.delete('/products/:id', authRequired, requireRole('admin'), validateCompanyContext, async (req, res) => {
  try {
    const { id } = req.params;
    const BeverageProduct = getCompanyModel(req.companyDb, 'BeverageProduct');
    const product = await BeverageProduct.findOneAndDelete({ _id: id, companyId: req.companyId });

    if (!product) {
      return res.status(404).json({ message: 'Product not found' });
    }

    console.log(`[Beverage] Deleted product: ${product.name}`);
    return res.json({ message: 'Product deleted', product });
  } catch (error) {
    console.error(`[Beverage] ✗ ERROR in DELETE /products/:id:`, error.message);
    return res.status(500).json({ error: error.message });
  }
});

// ============================================================================
// INVENTORY MANAGEMENT (PURCHASES)
// ============================================================================

// Record inventory purchase
router.post('/inventory/purchase', authRequired, requireRole('admin', 'manager'), validateCompanyContext, async (req, res) => {
  try {
    const { productId, costPrice, quantity, date, notes } = req.body;

    // Validation
    if (!productId) {
      return res.status(400).json({ message: 'Product ID is required' });
    }
    if (!costPrice || costPrice < 0) {
      return res.status(400).json({ message: 'Cost price must be a positive number' });
    }
    if (!quantity || quantity <= 0) {
      return res.status(400).json({ message: 'Quantity must be greater than 0' });
    }

    const BeverageProduct = getCompanyModel(req.companyDb, 'BeverageProduct');
    const BeverageInventory = getCompanyModel(req.companyDb, 'BeverageInventory');

    // Verify product exists
    const product = await BeverageProduct.findOne({ _id: productId, companyId: req.companyId });
    if (!product) {
      return res.status(404).json({ message: 'Product not found' });
    }

    // Update product stock
    product.currentStock += quantity;
    await product.save();

    // Record inventory transaction
    const inventory = new BeverageInventory({
      companyId: req.companyId,
      productId,
      transactionType: 'Purchase',
      quantity,
      pricePerUnit: costPrice,
      runningBalance: product.currentStock,
      date: date ? new Date(date) : new Date(),
      notes: notes ? notes.trim() : `Purchase: ${quantity} units @ ${costPrice} BDT each`,
    });

    console.log(`[Beverage] Recording purchase: ${product.name} - Qty: ${quantity}, Stock now: ${product.currentStock}`);
    await inventory.save();
    console.log(`[Beverage] ✓ Purchase recorded with ID: ${inventory._id}`);
    return res.status(201).json({ inventory, product });
  } catch (error) {
    console.error(`[Beverage] ✗ ERROR in POST /inventory/purchase:`, error.message);
    return res.status(500).json({ success: false, message: 'Failed to record purchase', error: error.message });
  }
});

// Get low stock alerts (MUST be before :productId route for Express matching order)
router.get('/inventory/low-stock', authRequired, validateCompanyContext, async (req, res) => {
  try {
    const threshold = parseInt(req.query.threshold) || 10;
    const BeverageProduct = getCompanyModel(req.companyDb, 'BeverageProduct');

    const lowStockProducts = await BeverageProduct.find({
      companyId: req.companyId,
      currentStock: { $lte: threshold },
    }).sort({ currentStock: 1 });

    return res.json({
      threshold,
      lowStockCount: lowStockProducts.length,
      products: lowStockProducts.map((product) => ({
        productId: product._id,
        productName: product.name,
        currentStock: product.currentStock,
        costPrice: product.costPrice,
        sellingPrice: product.sellingPrice,
        status: product.currentStock === 0 ? 'out-of-stock' : product.currentStock < threshold / 2 ? 'critical' : 'low',
      })),
    });
  } catch (error) {
    console.error(`[Beverage] ✗ ERROR in GET /inventory/low-stock:`, error.message);
    return res.status(500).json({ error: error.message });
  }
});

// Get inventory history for a product
router.get('/inventory/:productId', authRequired, validateCompanyContext, async (req, res) => {
  try {
    const { productId } = req.params;
    const { startDate, endDate } = req.query;

    const filter = { companyId: req.companyId, productId };

    if (startDate || endDate) {
      filter.date = {};
      if (startDate) filter.date.$gte = new Date(startDate);
      if (endDate) {
        const end = new Date(endDate);
        end.setHours(23, 59, 59, 999);
        filter.date.$lte = end;
      }
    }

    const BeverageInventory = getCompanyModel(req.companyDb, 'BeverageInventory');
    const history = await BeverageInventory.find(filter).sort({ date: -1 });
    return res.json({ history });
  } catch (error) {
    console.error(`[Beverage] ✗ ERROR in GET /inventory/:productId:`, error.message);
    return res.status(500).json({ error: error.message });
  }
});

// ============================================================================
// SALES MANAGEMENT
// ============================================================================

// Record beverage sale (multi-product support)
router.post('/sales', authRequired, requireRole('admin', 'manager'), validateCompanyContext, async (req, res) => {
  try {
    const { items, paymentMethod, date, notes, hourlySessionId } = req.body;

    console.log('[Beverage] POST /sales request received:', { itemsCount: items?.length, paymentMethod, date });

    // Validation
    if (!items || !Array.isArray(items) || items.length === 0) {
      console.warn('[Beverage] Validation error: items array missing or empty');
      return res.status(400).json({ message: 'At least one product item is required' });
    }
    if (!paymentMethod || !['Cash', 'Bank', 'bKash'].includes(paymentMethod)) {
      console.warn('[Beverage] Validation error: invalid payment method:', paymentMethod);
      return res.status(400).json({ message: 'Invalid payment method' });
    }

    const BeverageProduct = getCompanyModel(req.companyDb, 'BeverageProduct');
    const BeverageSale = getCompanyModel(req.companyDb, 'BeverageSale');
    const BeverageInventory = getCompanyModel(req.companyDb, 'BeverageInventory');

    // Validate each item and check inventory
    const processedItems = [];
    let totalAmount = 0;
    let totalCost = 0;
    let totalProfit = 0;

    for (let itemIndex = 0; itemIndex < items.length; itemIndex++) {
      const item = items[itemIndex];
      const { productId, quantity, sellingPricePerUnit } = item;

      console.log(`[Beverage] Validating item ${itemIndex + 1}:`, { productId, quantity, sellingPricePerUnit });

      if (!productId) {
        console.warn(`[Beverage] Item ${itemIndex + 1}: Missing productId`);
        return res.status(400).json({ message: `Item ${itemIndex + 1}: Product ID is required` });
      }
      if (!quantity || quantity <= 0) {
        console.warn(`[Beverage] Item ${itemIndex + 1}: Invalid quantity`, quantity);
        return res.status(400).json({ message: `Item ${itemIndex + 1}: Quantity must be greater than 0` });
      }
      if (sellingPricePerUnit === undefined || sellingPricePerUnit === null || sellingPricePerUnit < 0) {
        console.warn(`[Beverage] Item ${itemIndex + 1}: Invalid selling price`, sellingPricePerUnit);
        return res.status(400).json({ message: `Item ${itemIndex + 1}: Selling price must be a non-negative number` });
      }

      // Fetch product
      try {
        const product = await BeverageProduct.findOne({ _id: productId, companyId: req.companyId });
        if (!product) {
          console.warn(`[Beverage] Product not found: ${productId}`);
          return res.status(404).json({ message: `Item ${itemIndex + 1}: Product not found (ID: ${productId})` });
        }

        // Check inventory
        if (product.currentStock < quantity) {
          console.warn(`[Beverage] Insufficient inventory for ${product.name}: need ${quantity}, have ${product.currentStock}`);
          return res.status(400).json({
            message: `Item ${itemIndex + 1}: Insufficient inventory for "${product.name}". Available: ${product.currentStock}, Requested: ${quantity}`,
          });
        }

        // Calculate line item profit
        const lineTotal = quantity * sellingPricePerUnit;
        const lineCost = quantity * product.costPrice;
        const lineProfit = lineTotal - lineCost;

        console.log(`[Beverage] Item ${itemIndex + 1} valid: ${product.name}, profit per item: ${lineProfit}`);

        totalAmount += lineTotal;
        totalCost += lineCost;
        totalProfit += lineProfit;

        processedItems.push({
          productId,
          productName: product.name,
          quantity,
          costPricePerUnit: product.costPrice,
          sellingPricePerUnit,
          lineTotal,
          lineCost,
          lineProfit,
          product, // Keep reference for inventory update
        });
      } catch (itemErr) {
        console.error(`[Beverage] Error processing item ${itemIndex + 1}:`, itemErr.message);
        return res.status(500).json({ message: `Error processing item ${itemIndex + 1}: ${itemErr.message}` });
      }
    }

    const profitMargin = totalAmount > 0 ? (totalProfit / totalAmount) * 100 : 0;

    console.log('[Beverage] processedItems before mapping:', JSON.stringify(processedItems.map(item => ({
      productId: item.productId,
      productName: item.productName,
      quantity: item.quantity,
      costPricePerUnit: item.costPricePerUnit,
      sellingPricePerUnit: item.sellingPricePerUnit,
      lineTotal: item.lineTotal,
      lineCost: item.lineCost,
      lineProfit: item.lineProfit,
      hasProduct: !!item.product,
    })), null, 2));

    // Create sale record with items array
    const saleItems = processedItems.map((item) => ({
      productId: item.productId,
      productName: item.productName,
      quantity: item.quantity,
      costPricePerUnit: item.costPricePerUnit,
      sellingPricePerUnit: item.sellingPricePerUnit,
      lineTotal: item.lineTotal,
      lineCost: item.lineCost,
      lineProfit: item.lineProfit,
    }));

    console.log('[Beverage] saleItems after mapping:', JSON.stringify(saleItems, null, 2));

    const saleData = {
      companyId: req.companyId,
      items: saleItems,
      totalAmount,
      totalCost,
      profit: totalProfit,
      profitMargin,
      paymentMethod,
      receiptId: generateReceiptId(),
      date: date ? new Date(date) : new Date(),
      notes: notes ? notes.trim() : '',
      hourlySessionId: hourlySessionId || null,
    };

    console.log('[Beverage] saleData structure before save:', {
      companyId: saleData.companyId,
      itemsCount: saleData.items?.length,
      itemsArray: saleData.items,
      totalAmount: saleData.totalAmount,
      totalCost: saleData.totalCost,
      profit: saleData.profit,
      profitMargin: saleData.profitMargin,
    });

    const sale = new BeverageSale(saleData);
    
    console.log('[Beverage] BeverageSale document before save:', {
      _doc: sale._doc ? Object.keys(sale._doc) : 'N/A',
      items: sale.items?.length || 0,
    });
    
    console.log(`[Beverage] Recording multi-product sale with ${processedItems.length} items. Total Profit: ${totalProfit}`);
    await sale.save();

    // Update stock and create inventory transactions for each product
    for (const { productId, quantity, sellingPricePerUnit, lineProfit, product } of processedItems) {
      product.currentStock -= quantity;
      await product.save();

      // Record inventory transaction per product
      const inventory = new BeverageInventory({
        companyId: req.companyId,
        productId,
        transactionType: 'Sale',
        quantity: -quantity,
        pricePerUnit: sellingPricePerUnit,
        runningBalance: product.currentStock,
        reference: sale._id.toString(),
        date: sale.date,
        notes: `Multi-item sale: ${quantity} units @ ${sellingPricePerUnit} BDT each (Profit: ${lineProfit} BDT)`,
      });
      await inventory.save();
    }

    // Create corresponding Transaction record for cash management integration
    try {
      const Transaction = getCompanyModel(req.companyDb, 'Transaction');
      const HourlySession = getCompanyModel(req.companyDb, 'HourlySession');
      const beverageItems = processedItems.map(item => ({
        productName: item.productName,
        quantity: item.quantity,
        sellingPricePerUnit: item.sellingPricePerUnit,
        lineTotal: item.lineTotal,
      }));

      let linkedSession = null;
      if (hourlySessionId) {
        linkedSession = await HourlySession.findOne({
          _id: hourlySessionId,
          companyId: req.companyId,
          status: 'active',
        });

        if (!linkedSession) {
          return res.status(400).json({ message: 'Selected hourly session is no longer active' });
        }

        linkedSession.beverageCharge = Number((linkedSession.beverageCharge || 0) + totalAmount);
        await linkedSession.save();
      }

      const transaction = new Transaction({
        serviceType: 'Beverage',
        amount: totalAmount,
        paymentMethod,
        date: sale.date,
        receiptId: sale.receiptId,
        beverageItems,
        beverageSaleId: sale._id,
        totalCost,
        profit: totalProfit,
        profitMargin,
        companyId: req.companyId,
        sessionId: linkedSession?._id || null,
        beverageCharge: totalAmount,
      });

      await transaction.save();
      console.log(`[Beverage] ✓ Transaction record created for cash management integration (ID: ${transaction._id})`);

      if (linkedSession) {
        sale.hourlySessionId = linkedSession._id;
        await sale.save();
      }
    } catch (txnError) {
      console.error(`[Beverage] ⚠ Warning: Transaction record creation failed, but BeverageSale saved:`, txnError.message);
      // Don't fail the entire request if transaction creation fails - sale is already saved
    }

    console.log(`[Beverage] ✓ Multi-product sale recorded with ID: ${sale._id}, Total Profit: ${totalProfit} BDT`);
    return res.status(201).json({ sale });
  } catch (error) {
    console.error(`[Beverage] ✗ ERROR in POST /sales:`, error.message);
    console.error('Full error:', error);
    return res.status(500).json({
      success: false,
      message: 'Failed to record sale',
      error: error.message,
      details: error.toString(),
    });
  }
});

// Get sales with filters
router.get('/sales', authRequired, validateCompanyContext, async (req, res) => {
  try {
    const { startDate, endDate, productId, paymentMethod } = req.query;
    const filter = { companyId: req.companyId };

    if (startDate || endDate) {
      filter.date = {};
      if (startDate) filter.date.$gte = new Date(startDate);
      if (endDate) {
        const end = new Date(endDate);
        end.setHours(23, 59, 59, 999);
        filter.date.$lte = end;
      }
    }

    // Filter by product within items array (dot notation for nested array)
    if (productId) {
      filter['items.productId'] = productId;
    }
    if (paymentMethod) filter.paymentMethod = paymentMethod;

    const BeverageSale = getCompanyModel(req.companyDb, 'BeverageSale');
    const sales = await BeverageSale.find(filter).sort({ date: -1 });
    return res.json({ sales });
  } catch (error) {
    console.error(`[Beverage] ✗ ERROR in GET /sales:`, error.message);
    return res.status(500).json({ error: error.message });
  }
});

// Get sales statistics
router.get('/sales/stats', authRequired, validateCompanyContext, async (req, res) => {
  try {
    const BeverageSale = getCompanyModel(req.companyDb, 'BeverageSale');
    const BeverageProduct = getCompanyModel(req.companyDb, 'BeverageProduct');

    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const todayEnd = new Date(today);
    todayEnd.setHours(23, 59, 59, 999);

    const monthStart = new Date(today.getFullYear(), today.getMonth(), 1);
    const monthEnd = new Date(today.getFullYear(), today.getMonth() + 1, 0);
    monthEnd.setHours(23, 59, 59, 999);

    // Today's stats - FIX: only get sales from today (00:00:00 to 23:59:59)
    const todaySales = await BeverageSale.find({
      companyId: req.companyId,
      date: { $gte: today, $lte: todayEnd },
    });

    // This month's stats
    const monthSales = await BeverageSale.find({
      companyId: req.companyId,
      date: { $gte: monthStart, $lte: monthEnd },
    });

    // All products with current stock
    const products = await BeverageProduct.find({ companyId: req.companyId });

    // Calculate totals (work with items array)
    const todayRevenue = todaySales.reduce((sum, sale) => sum + sale.totalAmount, 0);
    const todayProfit = todaySales.reduce((sum, sale) => sum + sale.profit, 0);
    const todayQuantitySold = todaySales.reduce((sum, sale) => {
      return sum + (sale.items ? sale.items.reduce((itemSum, item) => itemSum + item.quantity, 0) : 0);
    }, 0);

    const monthRevenue = monthSales.reduce((sum, sale) => sum + sale.totalAmount, 0);
    const monthProfit = monthSales.reduce((sum, sale) => sum + sale.profit, 0);
    const monthQuantitySold = monthSales.reduce((sum, sale) => {
      return sum + (sale.items ? sale.items.reduce((itemSum, item) => itemSum + item.quantity, 0) : 0);
    }, 0);

    // Total inventory value
    const totalInventoryValue = products.reduce((sum, product) => sum + product.currentStock * product.costPrice, 0);

    // Per-product breakdown for today (iterate through items in each sale)
    const productBreakdown = products.map((product) => {
      let quantitySold = 0;
      let revenue = 0;
      let profit = 0;

      todaySales.forEach((sale) => {
        if (sale.items) {
          sale.items.forEach((item) => {
            if (item.productId.toString() === product._id.toString()) {
              quantitySold += item.quantity;
              revenue += item.lineTotal;
              profit += item.lineProfit;
            }
          });
        }
      });

      return {
        productId: product._id,
        productName: product.name,
        currentStock: product.currentStock,
        costPrice: product.costPrice,
        sellingPrice: product.sellingPrice,
        quantitySoldToday: quantitySold,
        revenueToday: revenue,
        profitToday: profit,
        profitMarginToday: revenue > 0 ? ((profit / revenue) * 100).toFixed(2) : 0,
      };
    });

    return res.json({
      today: {
        revenue: todayRevenue,
        profit: todayProfit,
        quantitySold: todayQuantitySold,
        transactionCount: todaySales.length,
      },
      month: {
        revenue: monthRevenue,
        profit: monthProfit,
        quantitySold: monthQuantitySold,
        transactionCount: monthSales.length,
      },
      inventory: {
        totalProducts: products.length,
        totalInventoryValue,
        products,
      },
      productBreakdown,
    });
  } catch (error) {
    console.error(`[Beverage] ✗ ERROR in GET /sales/stats:`, error.message);
    return res.status(500).json({ error: error.message });
  }
});

// Delete sale (reverses the transaction)
router.delete('/sales/:id', authRequired, requireRole('admin', 'manager'), validateCompanyContext, async (req, res) => {
  try {
    const { id } = req.params;
    const BeverageSale = getCompanyModel(req.companyDb, 'BeverageSale');
    const BeverageProduct = getCompanyModel(req.companyDb, 'BeverageProduct');
    const BeverageInventory = getCompanyModel(req.companyDb, 'BeverageInventory');

    // Find sale
    const sale = await BeverageSale.findOne({ _id: id, companyId: req.companyId });
    if (!sale) {
      return res.status(404).json({ message: 'Sale not found' });
    }

    // Restore inventory for each item in the sale
    if (sale.items && sale.items.length > 0) {
      for (const item of sale.items) {
        const product = await BeverageProduct.findOne({ _id: item.productId, companyId: req.companyId });
        if (product) {
          product.currentStock += item.quantity;
          await product.save();
          console.log(`[Beverage] Restored stock for ${product.name}: +${item.quantity} units`);
        }
      }
    }

    // Delete all inventory records for this sale
    await BeverageInventory.deleteMany({ reference: id });

    // Delete sale
    await BeverageSale.deleteOne({ _id: id });

    console.log(`[Beverage] ✓ Multi-item sale deleted: ${sale.items.length} products, Inventory restored`);
    return res.json({ message: 'Sale deleted and inventory restored', sale });
  } catch (error) {
    console.error(`[Beverage] ✗ ERROR in DELETE /sales/:id:`, error.message);
    return res.status(500).json({ error: error.message });
  }
});

// ============================================================================
// ADVANCED REPORTING & ANALYTICS
// ============================================================================

// Helper function to get date range
function getDateRange(period, baseDate = new Date()) {
  const date = new Date(baseDate);
  date.setHours(0, 0, 0, 0);

  let startDate, endDate;

  switch (period) {
    case 'today':
      startDate = new Date(date);
      endDate = new Date(date);
      endDate.setHours(23, 59, 59, 999);
      break;
    case 'yesterday':
      startDate = new Date(date);
      startDate.setDate(startDate.getDate() - 1);
      endDate = new Date(startDate);
      endDate.setHours(23, 59, 59, 999);
      break;
    case 'this-week':
      const dayOfWeek = date.getDay();
      const diff = date.getDate() - dayOfWeek;
      startDate = new Date(date);
      startDate.setDate(diff);
      startDate.setHours(0, 0, 0, 0);
      endDate = new Date(startDate);
      endDate.setDate(endDate.getDate() + 6);
      endDate.setHours(23, 59, 59, 999);
      break;
    case 'last-week':
      const lastWeekEnd = new Date(date);
      lastWeekEnd.setDate(lastWeekEnd.getDate() - date.getDay());
      lastWeekEnd.setHours(23, 59, 59, 999);
      const lastWeekStart = new Date(lastWeekEnd);
      lastWeekStart.setDate(lastWeekStart.getDate() - 6);
      lastWeekStart.setHours(0, 0, 0, 0);
      startDate = lastWeekStart;
      endDate = lastWeekEnd;
      break;
    case 'this-month':
      startDate = new Date(date.getFullYear(), date.getMonth(), 1);
      endDate = new Date(date.getFullYear(), date.getMonth() + 1, 0);
      endDate.setHours(23, 59, 59, 999);
      break;
    case 'last-month':
      startDate = new Date(date.getFullYear(), date.getMonth() - 1, 1);
      endDate = new Date(date.getFullYear(), date.getMonth(), 0);
      endDate.setHours(23, 59, 59, 999);
      break;
    default:
      startDate = new Date(date);
      endDate = new Date(date);
      endDate.setHours(23, 59, 59, 999);
  }

  return { startDate, endDate };
}

// Get stats for a specific day
router.get('/stats/daily', authRequired, validateCompanyContext, async (req, res) => {
  try {
    const { date } = req.query;
    const targetDate = date ? new Date(date) : new Date();
    targetDate.setHours(0, 0, 0, 0);

    const startOfDay = new Date(targetDate);
    const endOfDay = new Date(targetDate);
    endOfDay.setHours(23, 59, 59, 999);

    const BeverageSale = getCompanyModel(req.companyDb, 'BeverageSale');
    const BeverageProduct = getCompanyModel(req.companyDb, 'BeverageProduct');

    const sales = await BeverageSale.find({
      companyId: req.companyId,
      date: { $gte: startOfDay, $lte: endOfDay },
    }).sort({ date: 1 });

    const products = await BeverageProduct.find({ companyId: req.companyId });

    // Calculate totals
    const totalRevenue = sales.reduce((sum, sale) => sum + sale.totalAmount, 0);
    const totalProfit = sales.reduce((sum, sale) => sum + sale.profit, 0);
    const totalQuantity = sales.reduce((sum, sale) => {
      return sum + (sale.items ? sale.items.reduce((itemSum, item) => itemSum + item.quantity, 0) : 0);
    }, 0);

    // Per-product breakdown
    const productBreakdown = products.map((product) => {
      let quantitySold = 0;
      let revenue = 0;
      let profit = 0;

      sales.forEach((sale) => {
        if (sale.items) {
          sale.items.forEach((item) => {
            if (item.productId.toString() === product._id.toString()) {
              quantitySold += item.quantity;
              revenue += item.lineTotal;
              profit += item.lineProfit;
            }
          });
        }
      });

      return {
        productId: product._id,
        productName: product.name,
        currentStock: product.currentStock,
        quantitySold,
        revenue,
        profit,
        profitMargin: revenue > 0 ? parseFloat(((profit / revenue) * 100).toFixed(2)) : 0,
      };
    }).filter(p => p.quantitySold > 0);

    return res.json({
      date: targetDate.toISOString().split('T')[0],
      totalRevenue,
      totalProfit,
      totalQuantity,
      transactionCount: sales.length,
      profitMargin: totalRevenue > 0 ? parseFloat(((totalProfit / totalRevenue) * 100).toFixed(2)) : 0,
      productBreakdown,
      sales: sales.length > 0 ? sales : [],
    });
  } catch (error) {
    console.error(`[Beverage] ✗ ERROR in GET /stats/daily:`, error.message);
    return res.status(500).json({ error: error.message });
  }
});

// Get stats for a specific week
router.get('/stats/weekly', authRequired, validateCompanyContext, async (req, res) => {
  try {
    const { weekOf } = req.query;
    const baseDate = weekOf ? new Date(weekOf) : new Date();
    baseDate.setHours(0, 0, 0, 0);

    // Get start of week (Sunday)
    const dayOfWeek = baseDate.getDay();
    const startOfWeek = new Date(baseDate);
    startOfWeek.setDate(startOfWeek.getDate() - dayOfWeek);
    startOfWeek.setHours(0, 0, 0, 0);

    const endOfWeek = new Date(startOfWeek);
    endOfWeek.setDate(endOfWeek.getDate() + 6);
    endOfWeek.setHours(23, 59, 59, 999);

    const BeverageSale = getCompanyModel(req.companyDb, 'BeverageSale');
    const BeverageProduct = getCompanyModel(req.companyDb, 'BeverageProduct');

    const sales = await BeverageSale.find({
      companyId: req.companyId,
      date: { $gte: startOfWeek, $lte: endOfWeek },
    }).sort({ date: 1 });

    const products = await BeverageProduct.find({ companyId: req.companyId });

    // Calculate totals
    const totalRevenue = sales.reduce((sum, sale) => sum + sale.totalAmount, 0);
    const totalProfit = sales.reduce((sum, sale) => sum + sale.profit, 0);
    const totalQuantity = sales.reduce((sum, sale) => {
      return sum + (sale.items ? sale.items.reduce((itemSum, item) => itemSum + item.quantity, 0) : 0);
    }, 0);

    // Daily breakdown
    const dailyStats = {};
    for (let i = 0; i < 7; i++) {
      const day = new Date(startOfWeek);
      day.setDate(day.getDate() + i);
      const dayKey = day.toISOString().split('T')[0];
      dailyStats[dayKey] = { revenue: 0, profit: 0, quantity: 0, transactions: 0 };
    }

    sales.forEach((sale) => {
      const dayKey = sale.date.toISOString().split('T')[0];
      if (dailyStats[dayKey]) {
        dailyStats[dayKey].revenue += sale.totalAmount;
        dailyStats[dayKey].profit += sale.profit;
        dailyStats[dayKey].transactions += 1;
        if (sale.items) {
          dailyStats[dayKey].quantity += sale.items.reduce((sum, item) => sum + item.quantity, 0);
        }
      }
    });

    // Per-product breakdown
    const productBreakdown = products.map((product) => {
      let quantitySold = 0;
      let revenue = 0;
      let profit = 0;

      sales.forEach((sale) => {
        if (sale.items) {
          sale.items.forEach((item) => {
            if (item.productId.toString() === product._id.toString()) {
              quantitySold += item.quantity;
              revenue += item.lineTotal;
              profit += item.lineProfit;
            }
          });
        }
      });

      return {
        productId: product._id,
        productName: product.name,
        quantitySold,
        revenue,
        profit,
        profitMargin: revenue > 0 ? parseFloat(((profit / revenue) * 100).toFixed(2)) : 0,
      };
    }).filter(p => p.quantitySold > 0);

    return res.json({
      weekOf: startOfWeek.toISOString().split('T')[0],
      weekEnd: endOfWeek.toISOString().split('T')[0],
      totalRevenue,
      totalProfit,
      totalQuantity,
      transactionCount: sales.length,
      profitMargin: totalRevenue > 0 ? parseFloat(((totalProfit / totalRevenue) * 100).toFixed(2)) : 0,
      dailyStats,
      productBreakdown,
    });
  } catch (error) {
    console.error(`[Beverage] ✗ ERROR in GET /stats/weekly:`, error.message);
    return res.status(500).json({ error: error.message });
  }
});

// Get stats for a specific month
router.get('/stats/monthly', authRequired, validateCompanyContext, async (req, res) => {
  try {
    const { month } = req.query;
    let targetDate;

    if (month) {
      const [year, monthNum] = month.split('-');
      targetDate = new Date(parseInt(year), parseInt(monthNum) - 1, 1);
    } else {
      targetDate = new Date();
    }

    const startOfMonth = new Date(targetDate.getFullYear(), targetDate.getMonth(), 1);
    const endOfMonth = new Date(targetDate.getFullYear(), targetDate.getMonth() + 1, 0);
    endOfMonth.setHours(23, 59, 59, 999);

    const BeverageSale = getCompanyModel(req.companyDb, 'BeverageSale');
    const BeverageProduct = getCompanyModel(req.companyDb, 'BeverageProduct');

    const sales = await BeverageSale.find({
      companyId: req.companyId,
      date: { $gte: startOfMonth, $lte: endOfMonth },
    }).sort({ date: 1 });

    const products = await BeverageProduct.find({ companyId: req.companyId });

    // Calculate totals
    const totalRevenue = sales.reduce((sum, sale) => sum + sale.totalAmount, 0);
    const totalProfit = sales.reduce((sum, sale) => sum + sale.profit, 0);
    const totalQuantity = sales.reduce((sum, sale) => {
      return sum + (sale.items ? sale.items.reduce((itemSum, item) => itemSum + item.quantity, 0) : 0);
    }, 0);

    // Daily breakdown
    const daysInMonth = endOfMonth.getDate();
    const dailyStats = {};
    for (let i = 1; i <= daysInMonth; i++) {
      const day = new Date(targetDate.getFullYear(), targetDate.getMonth(), i);
      const dayKey = day.toISOString().split('T')[0];
      dailyStats[dayKey] = { revenue: 0, profit: 0, quantity: 0, transactions: 0 };
    }

    sales.forEach((sale) => {
      const dayKey = sale.date.toISOString().split('T')[0];
      if (dailyStats[dayKey]) {
        dailyStats[dayKey].revenue += sale.totalAmount;
        dailyStats[dayKey].profit += sale.profit;
        dailyStats[dayKey].transactions += 1;
        if (sale.items) {
          dailyStats[dayKey].quantity += sale.items.reduce((sum, item) => sum + item.quantity, 0);
        }
      }
    });

    // Per-product breakdown
    const productBreakdown = products.map((product) => {
      let quantitySold = 0;
      let revenue = 0;
      let profit = 0;

      sales.forEach((sale) => {
        if (sale.items) {
          sale.items.forEach((item) => {
            if (item.productId.toString() === product._id.toString()) {
              quantitySold += item.quantity;
              revenue += item.lineTotal;
              profit += item.lineProfit;
            }
          });
        }
      });

      return {
        productId: product._id,
        productName: product.name,
        quantitySold,
        revenue,
        profit,
        profitMargin: revenue > 0 ? parseFloat(((profit / revenue) * 100).toFixed(2)) : 0,
      };
    }).filter(p => p.quantitySold > 0);

    return res.json({
      month: `${startOfMonth.getFullYear()}-${String(startOfMonth.getMonth() + 1).padStart(2, '0')}`,
      totalRevenue,
      totalProfit,
      totalQuantity,
      transactionCount: sales.length,
      profitMargin: totalRevenue > 0 ? parseFloat(((totalProfit / totalRevenue) * 100).toFixed(2)) : 0,
      dailyStats,
      productBreakdown,
    });
  } catch (error) {
    console.error(`[Beverage] ✗ ERROR in GET /stats/monthly:`, error.message);
    return res.status(500).json({ error: error.message });
  }
});

// Get product performance metrics (all-time or filtered by date range)
router.get('/stats/products', authRequired, validateCompanyContext, async (req, res) => {
  try {
    const { startDate, endDate } = req.query;
    const filter = { companyId: req.companyId };

    if (startDate || endDate) {
      filter.date = {};
      if (startDate) filter.date.$gte = new Date(startDate);
      if (endDate) {
        const end = new Date(endDate);
        end.setHours(23, 59, 59, 999);
        filter.date.$lte = end;
      }
    }

    const BeverageSale = getCompanyModel(req.companyDb, 'BeverageSale');
    const BeverageProduct = getCompanyModel(req.companyDb, 'BeverageProduct');

    const sales = await BeverageSale.find(filter);
    const products = await BeverageProduct.find({ companyId: req.companyId }).sort({ name: 1 });

    // Calculate product performance
    const productStats = products.map((product) => {
      let totalQuantitySold = 0;
      let totalRevenue = 0;
      let totalProfit = 0;
      let totalTransactions = 0;

      sales.forEach((sale) => {
        if (sale.items) {
          sale.items.forEach((item) => {
            if (item.productId.toString() === product._id.toString()) {
              totalQuantitySold += item.quantity;
              totalRevenue += item.lineTotal;
              totalProfit += item.lineProfit;
              totalTransactions = totalTransactions + 1 / (sale.items.length > 1 ? sale.items.length : 1); // Pro-rate for multi-item sales
            }
          });
        }
      });

      return {
        productId: product._id,
        productName: product.name,
        currentStock: product.currentStock,
        costPrice: product.costPrice,
        sellingPrice: product.sellingPrice,
        totalQuantitySold,
        totalRevenue,
        totalProfit,
        profitMargin: totalRevenue > 0 ? parseFloat(((totalProfit / totalRevenue) * 100).toFixed(2)) : 0,
        averageSalePrice: totalQuantitySold > 0 ? parseFloat((totalRevenue / totalQuantitySold).toFixed(2)) : 0,
        transactionCount: Math.round(totalTransactions),
      };
    }).sort((a, b) => b.totalRevenue - a.totalRevenue);

    return res.json({
      productStats,
      periodStart: startDate,
      periodEnd: endDate,
      totalProductsSold: productStats.filter(p => p.totalQuantitySold > 0).length,
    });
  } catch (error) {
    console.error(`[Beverage] ✗ ERROR in GET /stats/products:`, error.message);
    return res.status(500).json({ error: error.message });
  }
});

// ============================================================================
// CASH MANAGEMENT (SEPARATE BEVERAGE CASH ACCOUNTING)
// ============================================================================

// Set or update opening balance for a day
router.post('/cash/opening-balance', authRequired, requireRole('admin', 'manager'), validateCompanyContext, async (req, res) => {
  try {
    const { date, amount, notes } = req.body;

    if (amount === undefined || amount === null || amount < 0) {
      return res.status(400).json({ message: 'Opening balance must be a non-negative number' });
    }

    const BeverageCashFlow = getCompanyModel(req.companyDb, 'BeverageCashFlow');
    const normalizedDate = new Date(date || new Date());
    normalizedDate.setHours(0, 0, 0, 0);

    // Get sales revenue for the day
    const BeverageSale = getCompanyModel(req.companyDb, 'BeverageSale');
    const endOfDay = new Date(normalizedDate);
    endOfDay.setHours(23, 59, 59, 999);

    const daySales = await BeverageSale.find({
      companyId: req.companyId,
      date: { $gte: normalizedDate, $lte: endOfDay },
    });

    const totalSalesRevenue = daySales.reduce((sum, sale) => sum + sale.totalAmount, 0);

    // Get total withdrawals for the day
    const BeverageCashWithdrawal = getCompanyModel(req.companyDb, 'BeverageCashWithdrawal');
    const withdrawals = await BeverageCashWithdrawal.find({
      companyId: req.companyId,
      date: { $gte: normalizedDate, $lte: endOfDay },
    });

    const totalWithdrawals = withdrawals.reduce((sum, w) => sum + w.amount, 0);

    // Calculate closing balance
    const closingBalance = amount + totalSalesRevenue - totalWithdrawals;

    // Upsert cash flow record
    const cashFlow = await BeverageCashFlow.findOneAndUpdate(
      { companyId: req.companyId, date: normalizedDate },
      {
        companyId: req.companyId,
        date: normalizedDate,
        openingBalance: amount,
        totalSalesRevenue,
        totalWithdrawals,
        closingBalance,
        notes: notes ? notes.trim() : '',
      },
      { upsert: true, new: true }
    );

    console.log(`[Beverage Cash] Opening balance set: ${amount} ৳ on ${normalizedDate.toISOString().split('T')[0]}`);
    return res.json({ success: true, cashFlow });
  } catch (error) {
    console.error(`[Beverage Cash] ✗ ERROR in POST /cash/opening-balance:`, error.message);
    return res.status(500).json({ error: error.message });
  }
});

// Get daily cash flow summary
router.get('/cash/daily', authRequired, validateCompanyContext, async (req, res) => {
  try {
    const { date } = req.query;
    const targetDate = date ? new Date(date) : new Date();
    targetDate.setHours(0, 0, 0, 0);
    const endOfDay = new Date(targetDate);
    endOfDay.setHours(23, 59, 59, 999);

    const BeverageCashFlow = getCompanyModel(req.companyDb, 'BeverageCashFlow');
    const BeverageCashWithdrawal = getCompanyModel(req.companyDb, 'BeverageCashWithdrawal');
    const BeverageSale = getCompanyModel(req.companyDb, 'BeverageSale');

    // Get or create cash flow record
    let cashFlow = await BeverageCashFlow.findOne({
      companyId: req.companyId,
      date: targetDate,
    });

    // Get opening balance for this date (from previous day's closing or initialize)
    let openingBalance = 0;
    if (!cashFlow) {
      // Try to get previous day's closing as opening for today
      const previousDate = new Date(targetDate);
      previousDate.setDate(previousDate.getDate() - 1);
      previousDate.setHours(0, 0, 0, 0);

      const previousCashFlow = await BeverageCashFlow.findOne({
        companyId: req.companyId,
        date: previousDate,
      });

      openingBalance = previousCashFlow ? previousCashFlow.closingBalance : 0;

      // Create new cash flow record with calculated opening balance
      cashFlow = new BeverageCashFlow({
        companyId: req.companyId,
        date: targetDate,
        openingBalance,
        totalSalesRevenue: 0,
        totalWithdrawals: 0,
        closingBalance: openingBalance,
        notes: '',
      });
    } else {
      openingBalance = cashFlow.openingBalance;
    }

    // Calculate actual sales revenue for this date
    const salesForDate = await BeverageSale.find({
      companyId: req.companyId,
      date: { $gte: targetDate, $lte: endOfDay },
    });

    const totalSalesRevenue = salesForDate.reduce((sum, sale) => sum + sale.totalAmount, 0);

    // Get withdrawals for this date
    const withdrawals = await BeverageCashWithdrawal.find({
      companyId: req.companyId,
      date: { $gte: targetDate, $lte: endOfDay },
    }).sort({ createdAt: 1 });

    const totalWithdrawals = withdrawals.reduce((sum, w) => sum + w.amount, 0);

    // Calculate closing balance
    const closingBalance = openingBalance + totalSalesRevenue - totalWithdrawals;

    // Update cash flow record with calculated values
    cashFlow.totalSalesRevenue = totalSalesRevenue;
    cashFlow.totalWithdrawals = totalWithdrawals;
    cashFlow.closingBalance = closingBalance;
    await cashFlow.save();

    return res.json({ 
      cashFlow: {
        _id: cashFlow._id,
        date: cashFlow.date,
        openingBalance,
        totalSalesRevenue,
        totalWithdrawals,
        closingBalance,
      }, 
      withdrawals 
    });
  } catch (error) {
    console.error(`[Beverage Cash] ✗ ERROR in GET /cash/daily:`, error.message);
    return res.status(500).json({ error: error.message });
  }
});

// Record cash withdrawal
router.post('/cash/withdrawal', authRequired, requireRole('admin', 'manager'), validateCompanyContext, async (req, res) => {
  try {
    const { amount, reason, date } = req.body;

    if (!amount || amount <= 0) {
      return res.status(400).json({ message: 'Withdrawal amount must be greater than 0' });
    }

    if (!reason || !reason.trim()) {
      return res.status(400).json({ message: 'Withdrawal reason is required' });
    }

    const BeverageCashWithdrawal = getCompanyModel(req.companyDb, 'BeverageCashWithdrawal');
    const BeverageCashFlow = getCompanyModel(req.companyDb, 'BeverageCashFlow');

    const withdrawalDate = date ? new Date(date) : new Date();
    withdrawalDate.setHours(0, 0, 0, 0);

    // Create withdrawal record
    const withdrawal = new BeverageCashWithdrawal({
      companyId: req.companyId,
      date: withdrawalDate,
      amount,
      reason: reason.trim(),
      recordedBy: req.user?.name || 'Admin',
    });

    await withdrawal.save();

    // Update cash flow summary
    const endOfDay = new Date(withdrawalDate);
    endOfDay.setHours(23, 59, 59, 999);

    const allWithdrawals = await BeverageCashWithdrawal.find({
      companyId: req.companyId,
      date: { $gte: withdrawalDate, $lte: endOfDay },
    });

    const totalWithdrawals = allWithdrawals.reduce((sum, w) => sum + w.amount, 0);

    let cashFlow = await BeverageCashFlow.findOne({
      companyId: req.companyId,
      date: withdrawalDate,
    });

    if (cashFlow) {
      cashFlow.totalWithdrawals = totalWithdrawals;
      cashFlow.closingBalance = cashFlow.openingBalance + cashFlow.totalSalesRevenue - totalWithdrawals;
      await cashFlow.save();
    }

    console.log(`[Beverage Cash] Withdrawal recorded: ${amount} ৳ (${reason})`);
    return res.status(201).json({ success: true, withdrawal });
  } catch (error) {
    console.error(`[Beverage Cash] ✗ ERROR in POST /cash/withdrawal:`, error.message);
    return res.status(500).json({ error: error.message });
  }
});

// Delete withdrawal (only by admin)
router.delete('/cash/withdrawal/:id', authRequired, requireRole('admin'), validateCompanyContext, async (req, res) => {
  try {
    const { id } = req.params;
    const BeverageCashWithdrawal = getCompanyModel(req.companyDb, 'BeverageCashWithdrawal');
    const BeverageCashFlow = getCompanyModel(req.companyDb, 'BeverageCashFlow');

    const withdrawal = await BeverageCashWithdrawal.findOneAndDelete({
      _id: id,
      companyId: req.companyId,
    });

    if (!withdrawal) {
      return res.status(404).json({ message: 'Withdrawal not found' });
    }

    // Update cash flow summary
    const withdrawalDate = new Date(withdrawal.date);
    withdrawalDate.setHours(0, 0, 0, 0);
    const endOfDay = new Date(withdrawalDate);
    endOfDay.setHours(23, 59, 59, 999);

    const allWithdrawals = await BeverageCashWithdrawal.find({
      companyId: req.companyId,
      date: { $gte: withdrawalDate, $lte: endOfDay },
    });

    const totalWithdrawals = allWithdrawals.reduce((sum, w) => sum + w.amount, 0);

    const cashFlow = await BeverageCashFlow.findOne({
      companyId: req.companyId,
      date: withdrawalDate,
    });

    if (cashFlow) {
      cashFlow.totalWithdrawals = totalWithdrawals;
      cashFlow.closingBalance = cashFlow.openingBalance + cashFlow.totalSalesRevenue - totalWithdrawals;
      await cashFlow.save();
    }

    console.log(`[Beverage Cash] Withdrawal deleted: ${withdrawal.amount} ৳`);
    return res.json({ success: true, message: 'Withdrawal deleted' });
  } catch (error) {
    console.error(`[Beverage Cash] ✗ ERROR in DELETE /cash/withdrawal/:id:`, error.message);
    return res.status(500).json({ error: error.message });
  }
});

// Get monthly cash summary (daily breakdown)
router.get('/cash/summary', authRequired, validateCompanyContext, async (req, res) => {
  try {
    const { month } = req.query;
    let targetDate;

    if (month) {
      const [year, monthNum] = month.split('-');
      targetDate = new Date(parseInt(year), parseInt(monthNum) - 1, 1);
    } else {
      targetDate = new Date();
    }

    const startOfMonth = new Date(targetDate.getFullYear(), targetDate.getMonth(), 1);
    const endOfMonth = new Date(targetDate.getFullYear(), targetDate.getMonth() + 1, 0);
    endOfMonth.setHours(23, 59, 59, 999);

    const BeverageCashFlow = getCompanyModel(req.companyDb, 'BeverageCashFlow');

    const cashFlows = await BeverageCashFlow.find({
      companyId: req.companyId,
      date: { $gte: startOfMonth, $lte: endOfMonth },
    }).sort({ date: 1 });

    // Calculate month totals
    const monthTotalRevenue = cashFlows.reduce((sum, cf) => sum + cf.totalSalesRevenue, 0);
    const monthTotalWithdrawals = cashFlows.reduce((sum, cf) => sum + cf.totalWithdrawals, 0);

    return res.json({
      month: `${startOfMonth.getFullYear()}-${String(startOfMonth.getMonth() + 1).padStart(2, '0')}`,
      dailyBreakdown: cashFlows,
      monthTotalRevenue,
      monthTotalWithdrawals,
    });
  } catch (error) {
    console.error(`[Beverage Cash] ✗ ERROR in GET /cash/summary:`, error.message);
    return res.status(500).json({ error: error.message });
  }
});

export default router;
