import mongoose from 'mongoose';

const beverageSaleSchema = new mongoose.Schema(
  {
    companyId: { type: mongoose.Schema.Types.ObjectId, required: true, index: true },
    items: [
      {
        productId: { type: mongoose.Schema.Types.ObjectId, ref: 'BeverageProduct', required: true },
        productName: { type: String, required: true }, // Stored for historical tracking
        quantity: { type: Number, required: true, min: 1 },
        costPricePerUnit: { type: Number, required: true, min: 0 },
        sellingPricePerUnit: { type: Number, required: true, min: 0 },
        lineTotal: { type: Number, required: true }, // quantity × sellingPricePerUnit
        lineCost: { type: Number, required: true }, // quantity × costPricePerUnit
        lineProfit: { type: Number, required: true }, // lineTotal - lineCost
      },
    ],
    totalAmount: { type: Number, required: true }, // Sum of all line totals (revenue)
    totalCost: { type: Number, required: true }, // Sum of all line costs
    profit: { type: Number, required: true }, // Sum of all line profits
    profitMargin: { type: Number, required: true }, // (profit / totalAmount) × 100
    paymentMethod: { type: String, enum: ['Cash', 'Bank', 'bKash'], required: true },
    date: { type: Date, default: Date.now, required: true, index: true },
    receiptId: { type: String, unique: true, index: true }, // For receipt generation
    notes: { type: String, default: '' }, // Optional notes
    hourlySessionId: { type: mongoose.Schema.Types.ObjectId, ref: 'HourlySession', default: null },
  },
  { timestamps: true }
);

// Indexes for common queries
beverageSaleSchema.index({ companyId: 1, date: 1 });
beverageSaleSchema.index({ 'items.productId': 1, date: 1 });
beverageSaleSchema.index({ paymentMethod: 1 });

export default mongoose.model('BeverageSale', beverageSaleSchema);
