import mongoose from 'mongoose';

const beverageSaleSchema = new mongoose.Schema(
  {
    companyId: { type: mongoose.Schema.Types.ObjectId, required: true, index: true },
    productId: { type: mongoose.Schema.Types.ObjectId, ref: 'BeverageProduct', required: true },
    productName: { type: String, required: true }, // Stored for historical tracking (in case product is deleted)
    quantity: { type: Number, required: true, min: 1 }, // Quantity sold
    costPricePerUnit: { type: Number, required: true, min: 0 }, // Cost price per unit at time of sale
    sellingPricePerUnit: { type: Number, required: true, min: 0 }, // Selling price per unit (may differ from default)
    totalAmount: { type: Number, required: true }, // Total revenue: quantity × sellingPricePerUnit
    totalCost: { type: Number, required: true }, // Total cost: quantity × costPricePerUnit
    profit: { type: Number, required: true }, // Profit: totalAmount - totalCost
    profitMargin: { type: Number, required: true }, // Profit margin %: (profit / totalAmount) × 100
    paymentMethod: { type: String, enum: ['Cash', 'Bank', 'bKash'], required: true },
    date: { type: Date, default: Date.now, required: true, index: true },
    receiptId: { type: String, unique: true, index: true }, // For receipt generation
    notes: { type: String, default: '' }, // Optional notes
  },
  { timestamps: true }
);

// Indexes for common queries
beverageSaleSchema.index({ companyId: 1, date: 1 });
beverageSaleSchema.index({ productId: 1, date: 1 });
beverageSaleSchema.index({ paymentMethod: 1 });

export default mongoose.model('BeverageSale', beverageSaleSchema);
