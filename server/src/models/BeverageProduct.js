import mongoose from 'mongoose';

const beverageProductSchema = new mongoose.Schema(
  {
    companyId: { type: mongoose.Schema.Types.ObjectId, required: true, index: true },
    name: { type: String, required: true }, // e.g., "Water", "Orange Juice", "Mango Juice"
    costPrice: { type: Number, required: true, min: 0 }, // Cost per unit (Taka)
    sellingPrice: { type: Number, required: true, min: 0 }, // Default selling price per unit (Taka)
    currentStock: { type: Number, required: true, default: 0, min: 0 }, // Current inventory quantity
    unit: { type: String, default: 'Bottle' }, // e.g., "Bottle", "Cup", "Liter"
    description: { type: String, default: '' }, // Optional product description
  },
  { timestamps: true }
);

// Compound index for faster lookups by company and name
beverageProductSchema.index({ companyId: 1, name: 1 });

export default mongoose.model('BeverageProduct', beverageProductSchema);
