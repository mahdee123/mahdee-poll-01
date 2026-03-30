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

// Record beverage sale
router.post('/sales', authRequired, requireRole('admin', 'manager'), validateCompanyContext, async (req, res) => {
  try {
    const { productId, quantity, sellingPricePerUnit, paymentMethod, date, notes } = req.body;

    // Validation
    if (!productId) {
      return res.status(400).json({ message: 'Product ID is required' });
    }
    if (!quantity || quantity <= 0) {
      return res.status(400).json({ message: 'Quantity must be greater than 0' });
    }
    if (!sellingPricePerUnit || sellingPricePerUnit < 0) {
      return res.status(400).json({ message: 'Selling price must be a positive number' });
    }
    if (!paymentMethod || !['Cash', 'Bank', 'bKash'].includes(paymentMethod)) {
      return res.status(400).json({ message: 'Invalid payment method' });
    }

    const BeverageProduct = getCompanyModel(req.companyDb, 'BeverageProduct');
    const BeverageSale = getCompanyModel(req.companyDb, 'BeverageSale');
    const BeverageInventory = getCompanyModel(req.companyDb, 'BeverageInventory');

    // Verify product exists
    const product = await BeverageProduct.findOne({ _id: productId, companyId: req.companyId });
    if (!product) {
      return res.status(404).json({ message: 'Product not found' });
    }

    // Check inventory sufficiency
    if (product.currentStock < quantity) {
      return res.status(400).json({
        message: `Insufficient inventory. Available: ${product.currentStock}, Requested: ${quantity}`,
      });
    }

    // Calculate profit
    const totalAmount = quantity * sellingPricePerUnit;
    const totalCost = quantity * product.costPrice;
    const profit = totalAmount - totalCost;
    const profitMargin = totalAmount > 0 ? (profit / totalAmount) * 100 : 0;

    // Create sale record
    const sale = new BeverageSale({
      companyId: req.companyId,
      productId,
      productName: product.name,
      quantity,
      costPricePerUnit: product.costPrice,
      sellingPricePerUnit,
      totalAmount,
      totalCost,
      profit,
      profitMargin,
      paymentMethod,
      receiptId: generateReceiptId(),
      date: date ? new Date(date) : new Date(),
      notes: notes ? notes.trim() : '',
    });

    console.log(`[Beverage] Recording sale: ${product.name} - Qty: ${quantity}, Profit: ${profit}, Stock before: ${product.currentStock}`);
    await sale.save();

    // Update product stock
    product.currentStock -= quantity;
    await product.save();

    // Record inventory transaction
    const inventory = new BeverageInventory({
      companyId: req.companyId,
      productId,
      transactionType: 'Sale',
      quantity: -quantity, // Negative for sale
      pricePerUnit: sellingPricePerUnit,
      runningBalance: product.currentStock,
      reference: sale._id.toString(),
      date: sale.date,
      notes: `Sale: ${quantity} units @ ${sellingPricePerUnit} BDT each (Profit: ${profit} BDT)`,
    });

    await inventory.save();
    console.log(`[Beverage] ✓ Sale recorded with ID: ${sale._id}, Stock now: ${product.currentStock}`);
    return res.status(201).json({ sale, product });
  } catch (error) {
    console.error(`[Beverage] ✗ ERROR in POST /sales:`, error.message);
    return res.status(500).json({ success: false, message: 'Failed to record sale', error: error.message });
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

    if (productId) filter.productId = productId;
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

    const monthStart = new Date(today.getFullYear(), today.getMonth(), 1);
    const monthEnd = new Date(today.getFullYear(), today.getMonth() + 1, 0);
    monthEnd.setHours(23, 59, 59, 999);

    // Today's stats
    const todaySales = await BeverageSale.find({
      companyId: req.companyId,
      date: { $gte: today },
    });

    // This month's stats
    const monthSales = await BeverageSale.find({
      companyId: req.companyId,
      date: { $gte: monthStart, $lte: monthEnd },
    });

    // All products with current stock
    const products = await BeverageProduct.find({ companyId: req.companyId });

    // Calculate totals
    const todayRevenue = todaySales.reduce((sum, sale) => sum + sale.totalAmount, 0);
    const todayProfit = todaySales.reduce((sum, sale) => sum + sale.profit, 0);
    const todayQuantitySold = todaySales.reduce((sum, sale) => sum + sale.quantity, 0);

    const monthRevenue = monthSales.reduce((sum, sale) => sum + sale.totalAmount, 0);
    const monthProfit = monthSales.reduce((sum, sale) => sum + sale.profit, 0);
    const monthQuantitySold = monthSales.reduce((sum, sale) => sum + sale.quantity, 0);

    // Total inventory value
    const totalInventoryValue = products.reduce((sum, product) => sum + product.currentStock * product.costPrice, 0);

    // Per-product breakdown for today
    const productBreakdown = products.map((product) => {
      const productTodaySales = todaySales.filter((sale) => sale.productId.toString() === product._id.toString());
      const quantitySold = productTodaySales.reduce((sum, sale) => sum + sale.quantity, 0);
      const revenue = productTodaySales.reduce((sum, sale) => sum + sale.totalAmount, 0);
      const profit = productTodaySales.reduce((sum, sale) => sum + sale.profit, 0);

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

    // Restore inventory
    const product = await BeverageProduct.findOne({ _id: sale.productId, companyId: req.companyId });
    if (product) {
      product.currentStock += sale.quantity;
      await product.save();
    }

    // Delete inventory record
    await BeverageInventory.deleteOne({ reference: id });

    // Delete sale
    await BeverageSale.deleteOne({ _id: id });

    console.log(`[Beverage] ✓ Sale deleted: ${sale.productName} - Qty: ${sale.quantity}, Restored inventory`);
    return res.json({ message: 'Sale deleted and inventory restored', sale });
  } catch (error) {
    console.error(`[Beverage] ✗ ERROR in DELETE /sales/:id:`, error.message);
    return res.status(500).json({ error: error.message });
  }
});

export default router;
