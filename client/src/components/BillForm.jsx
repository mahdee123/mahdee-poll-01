import React, { useState, useEffect } from 'react';

export default function BillForm({ onClose, onSave, onSaveAndPrint }) {
  const [formData, setFormData] = useState({
    date: new Date().toISOString().split('T')[0],
    name: '',
    phone: '',
    amountPerPerson: 300,
    numberOfPersons: 1,
    discount: 0,
    paymentMethod: 'Cash',
  });

  const [calculation, setCalculation] = useState({
    subtotal: 0,
    finalAmount: 0,
  });

  // Auto-calculate when form changes
  useEffect(() => {
    const subtotal = formData.amountPerPerson * formData.numberOfPersons;
    const finalAmount = Math.max(0, subtotal - (formData.discount || 0));
    setCalculation({ subtotal, finalAmount });
  }, [formData.amountPerPerson, formData.numberOfPersons, formData.discount]);

  const formatDate = (dateStr) => {
    return new Date(dateStr).toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
    });
  };

  const handleInputChange = (e) => {
    const { name, value } = e.target;
    const processedValue = ['amountPerPerson', 'numberOfPersons', 'discount'].includes(name)
      ? Math.max(0, Number(value))
      : value;
    setFormData({ ...formData, [name]: processedValue });
  };

  const handleSave = () => {
    onSave({
      ...formData,
      amount: calculation.finalAmount,
      price: calculation.subtotal,
      amountPerPerson: Number(formData.amountPerPerson),
      numberOfPersons: Number(formData.numberOfPersons),
      discount: Number(formData.discount),
    });
  };

  const handleSaveAndPrint = () => {
    onSaveAndPrint({
      ...formData,
      amount: calculation.finalAmount,
      price: calculation.subtotal,
      amountPerPerson: Number(formData.amountPerPerson),
      numberOfPersons: Number(formData.numberOfPersons),
      discount: Number(formData.discount),
    });
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-lg max-w-2xl w-full max-h-screen overflow-y-auto">
        {/* Header */}
        <div className="sticky top-0 bg-white border-b p-4 flex items-center justify-between">
          <h2 className="text-lg font-semibold">➕ Add New Bill</h2>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600 text-2xl">
            ✕
          </button>
        </div>

        {/* Form Content */}
        <div className="p-6 space-y-6">
          {/* Date, Name, Phone */}
          <div className="grid md:grid-cols-3 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">📅 Date</label>
              <input
                type="date"
                name="date"
                value={formData.date}
                onChange={handleInputChange}
                className="w-full border rounded-lg px-3 py-2 text-sm"
                disabled
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">👤 Name</label>
              <input
                type="text"
                name="name"
                placeholder="Optional"
                value={formData.name}
                onChange={handleInputChange}
                className="w-full border rounded-lg px-3 py-2 text-sm"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">📱 Phone</label>
              <input
                type="tel"
                name="phone"
                placeholder="Optional"
                value={formData.phone}
                onChange={handleInputChange}
                className="w-full border rounded-lg px-3 py-2 text-sm"
              />
            </div>
          </div>

          {/* Billing Section */}
          <div className="border-t pt-4">
            <h3 className="text-sm font-semibold text-gray-900 mb-4">💰 Billing Section</h3>
            <div className="grid md:grid-cols-3 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Amount (Per Person) 💵
                </label>
                <select
                  name="amountPerPerson"
                  value={formData.amountPerPerson}
                  onChange={handleInputChange}
                  className="w-full border rounded-lg px-3 py-2 text-sm"
                >
                  <option value={300}>৳ 300</option>
                  <option value={400}>৳ 400</option>
                  <option value={500}>৳ 500</option>
                  <option value={750}>৳ 750</option>
                  <option value={1000}>৳ 1000</option>
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">👥 Persons</label>
                <input
                  type="number"
                  name="numberOfPersons"
                  min="1"
                  value={formData.numberOfPersons}
                  onChange={handleInputChange}
                  className="w-full border rounded-lg px-3 py-2 text-sm"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  🏷 Discount Amount
                </label>
                <input
                  type="number"
                  name="discount"
                  min="0"
                  value={formData.discount}
                  onChange={handleInputChange}
                  className="w-full border rounded-lg px-3 py-2 text-sm"
                  placeholder="0"
                />
              </div>
            </div>
          </div>

          {/* Auto Calculation Preview */}
          <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
            <h3 className="text-sm font-semibold text-gray-900 mb-3">🧠 Calculation Preview</h3>
            <div className="space-y-2 text-sm">
              <div className="flex justify-between">
                <span className="text-gray-600">Subtotal (৳ {formData.amountPerPerson} × {formData.numberOfPersons}):</span>
                <span className="font-medium">৳ {calculation.subtotal.toLocaleString()}</span>
              </div>
              {formData.discount > 0 && (
                <div className="flex justify-between text-red-600">
                  <span>Discount:</span>
                  <span className="font-medium">- ৳ {formData.discount.toLocaleString()}</span>
                </div>
              )}
              <div className="border-t pt-2 flex justify-between text-base font-semibold text-secondary">
                <span>Total Amount:</span>
                <span>৳ {calculation.finalAmount.toLocaleString()}</span>
              </div>
            </div>
          </div>

          {/* Payment Section */}
          <div className="border-t pt-4">
            <h3 className="text-sm font-semibold text-gray-900 mb-4">💳 Payment</h3>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">Payment Method</label>
              <div className="grid grid-cols-3 gap-2">
                {['Cash', 'Bank', 'bKash'].map((method) => (
                  <button
                    key={method}
                    onClick={() => setFormData({ ...formData, paymentMethod: method })}
                    className={`px-3 py-2 rounded-lg border-2 text-sm font-medium transition ${
                      formData.paymentMethod === method
                        ? 'border-secondary bg-secondary text-white'
                        : 'border-gray-200 text-gray-700 hover:border-secondary'
                    }`}
                  >
                    {method}
                  </button>
                ))}
              </div>
            </div>
          </div>
        </div>

        {/* Footer Buttons */}
        <div className="sticky bottom-0 bg-white border-t p-4 flex gap-3 justify-end">
          <button onClick={onClose} className="btn-ghost">
            Cancel
          </button>
          <button onClick={handleSave} className="btn-primary">
            ✅ Save Bill
          </button>
          <button onClick={handleSaveAndPrint} className="btn-primary bg-green-600 hover:bg-green-700">
            🖨 Save & Print Receipt
          </button>
        </div>
      </div>
    </div>
  );
}
