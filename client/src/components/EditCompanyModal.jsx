import { useState } from 'react';
import Modal from './Modal';
import Button from './Button';

/**
 * Modal for editing company information
 */
export default function EditCompanyModal({ isOpen, onClose, company, onSave, loading = false }) {
  const [formData, setFormData] = useState({
    name: company?.name || '',
    address: company?.address || '',
    phone: company?.phone || '',
    email: company?.email || '',
  });
  const [error, setError] = useState('');

  const handleChange = (e) => {
    const { name, value } = e.target;
    setFormData(prev => ({ ...prev, [name]: value }));
    setError('');
  };

  const handleSubmit = async (e) => {
    e.preventDefault();

    if (!formData.name.trim()) {
      setError('Company name is required');
      return;
    }

    try {
      await onSave(formData);
    } catch (err) {
      setError(err.message || 'Failed to update company');
    }
  };

  if (!isOpen) return null;

  return (
    <Modal
      isOpen
      onClose={onClose}
      title="Edit company information"
      size="sm"
      footer={
        <>
          <Button onClick={onClose} variant="secondary" disabled={loading}>Cancel</Button>
          <Button type="submit" form="edit-company-form" variant="primary" loading={loading}>Save changes</Button>
        </>
      }
    >
      <form id="edit-company-form" onSubmit={handleSubmit}>
        {error && (
          <div className="bg-danger-soft border border-danger/20 text-danger-ink px-4 py-3 rounded-control mb-4 text-sm">
            {error}
          </div>
        )}

        <div className="mb-4">
          <label className="label">Company name</label>
          <input
            type="text"
            name="name"
            value={formData.name}
            onChange={handleChange}
            placeholder="Enter company name"
            className="input"
            disabled={loading}
          />
        </div>

        <div className="mb-4">
          <label className="label">Address</label>
          <input
            type="text"
            name="address"
            value={formData.address}
            onChange={handleChange}
            placeholder="Enter company address"
            className="input"
            disabled={loading}
          />
        </div>

        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="label">Phone</label>
            <input
              type="text"
              name="phone"
              value={formData.phone}
              onChange={handleChange}
              placeholder="Enter phone number"
              className="input"
              disabled={loading}
            />
          </div>
          <div>
            <label className="label">Email</label>
            <input
              type="email"
              name="email"
              value={formData.email}
              onChange={handleChange}
              placeholder="Enter email address"
              className="input"
              disabled={loading}
            />
          </div>
        </div>
      </form>
    </Modal>
  );
}
