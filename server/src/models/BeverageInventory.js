import mongoose from 'mongoose';

const beverageInventorySchema = new mongoose.Schema(
  {
    companyId: { type: mongoose.Schema.Types.ObjectId, required: true, index: true },
    productId: { type: mongoose.Schema.Types.ObjectId, ref: 'BeverageProduct', required: true },
    transactionType: { type: String, enum: ['Purchase', 'Sale'], required: true }, // Purchase adds stock, Sale reduces it
    quantity: { type: Number, required: true }, // Quantity added (positive) or removed (negative)
    pricePerUnit: { type: Number, required: true, min: 0 }, // Cost price per unit (for purchases) or selling price (for sales)
    runningBalance: { type: Number, required: true, min: 0 }, // Stock quantity after this transaction
    reference: { type: String }, // Reference ID (beverageSaleId or purchase document ID)
    date: { type: Date, default: Date.now, required: true, index: true },
    notes: { type: String, default: '' },
  },
  { timestamps: true }
);

// Indexes for efficient querying
beverageInventorySchema.index({ companyId: 1, productId: 1, date: 1 });
beverageInventorySchema.index({ transactionType: 1 });

export default mongoose.model('BeverageInventory', beverageInventorySchema);
