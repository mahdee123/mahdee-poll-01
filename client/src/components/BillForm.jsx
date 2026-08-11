import React, { useState, useEffect } from 'react';
import { Calculator, Printer, Check } from 'lucide-react';
import Modal from './Modal';
import Button from './Button';

const PAYMENT_METHODS = ['Cash', 'Bank', 'bKash'];

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
    <Modal
      isOpen
      onClose={onClose}
      title="Add new bill"
      size="lg"
      footer={
        <>
          <Button variant="secondary" onClick={onClose}>Cancel</Button>
          <Button variant="secondary" onClick={handleSaveAndPrint} icon={Printer}>Save &amp; print</Button>
          <Button onClick={handleSave} icon={Check}>Save bill</Button>
        </>
      }
    >
      <div className="space-y-6">
        {/* Date, Name, Phone */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          <div>
            <label className="label">Date</label>
            <input type="date" name="date" value={formData.date} onChange={handleInputChange} className="input" disabled />
          </div>
          <div>
            <label className="label">Name</label>
            <input type="text" name="name" placeholder="Optional" value={formData.name} onChange={handleInputChange} className="input" />
          </div>
          <div>
            <label className="label">Phone</label>
            <input type="tel" name="phone" placeholder="Optional" value={formData.phone} onChange={handleInputChange} className="input" />
          </div>
        </div>

        {/* Billing Section */}
        <div className="border-t border-line pt-5">
          <h3 className="text-sm font-semibold text-ink mb-4">Billing</h3>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <div>
              <label className="label">Amount per person</label>
              <select name="amountPerPerson" value={formData.amountPerPerson} onChange={handleInputChange} className="select">
                <option value={300}>৳ 300</option>
                <option value={400}>৳ 400</option>
                <option value={500}>৳ 500</option>
                <option value={750}>৳ 750</option>
                <option value={1000}>৳ 1000</option>
              </select>
            </div>
            <div>
              <label className="label">Persons</label>
              <input type="number" name="numberOfPersons" min="1" value={formData.numberOfPersons} onChange={handleInputChange} className="input" />
            </div>
            <div>
              <label className="label">Discount amount</label>
              <input type="number" name="discount" min="0" value={formData.discount} onChange={handleInputChange} className="input" placeholder="0" />
            </div>
          </div>
        </div>

        {/* Auto Calculation Preview */}
        <div className="bg-primary-50 border border-primary/20 rounded-card p-4">
          <h3 className="flex items-center gap-1.5 text-sm font-semibold text-ink mb-3">
            <Calculator size={15} className="text-primary" /> Calculation preview
          </h3>
          <div className="space-y-2 text-sm">
            <div className="flex justify-between">
              <span className="text-ink-soft">Subtotal (৳ {formData.amountPerPerson} × {formData.numberOfPersons})</span>
              <span className="font-medium tabular">৳ {calculation.subtotal.toLocaleString()}</span>
            </div>
            {formData.discount > 0 && (
              <div className="flex justify-between text-danger">
                <span>Discount</span>
                <span className="font-medium tabular">− ৳ {formData.discount.toLocaleString()}</span>
              </div>
            )}
            <div className="border-t border-primary/20 pt-2 flex justify-between text-base font-semibold text-ink">
              <span>Total amount</span>
              <span className="tabular">৳ {calculation.finalAmount.toLocaleString()}</span>
            </div>
          </div>
        </div>

        {/* Payment Section */}
        <div className="border-t border-line pt-5">
          <label className="label">Payment method</label>
          <div className="segmented w-full">
            {PAYMENT_METHODS.map((method) => (
              <button
                key={method}
                type="button"
                onClick={() => setFormData({ ...formData, paymentMethod: method })}
                className={`flex-1 ${formData.paymentMethod === method ? 'segmented-item-active' : 'segmented-item'}`}
              >
                {method}
              </button>
            ))}
          </div>
        </div>
      </div>
    </Modal>
  );
}
