import React from 'react';

export default function Receipt({ receipt, receiptDetails }) {
  if (!receipt) return null;

  const formatDate = (date) => {
    return new Date(date).toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
    });
  };

  const getOriginalPrice = () => {
    if (receiptDetails?.price) return Number(receiptDetails.price);
    if (receipt.price) return Number(receipt.price);
    if (receiptDetails?.discount) {
      return receipt.amount + receiptDetails.discount;
    }
    if (receipt.discount) {
      return receipt.amount + receipt.discount;
    }
    return receipt.amount;
  };

  const getDiscount = () => {
    if (receiptDetails?.discount) return Number(receiptDetails.discount);
    if (receipt.discount) return Number(receipt.discount);
    return 0;
  };

  const originalPrice = getOriginalPrice();
  const discount = getDiscount();
  const finalAmount = receipt.amount || originalPrice - discount;

  return (
    <div id="receipt" className="receipt-container">
      <div className="receipt-wrapper">
        {/* Header */}
        <div className="receipt-header">
          <h1 className="company-name">🏊 Raya Swimming Pool</h1>
          <p className="company-address">Block#M, Road#10, Dhaka</p>
          <p className="company-phone">Phone: 01700-000000</p>
          <p className="company-email">Email: info@rayapool.com</p>
        </div>

        <hr className="receipt-divider" />

        {/* Receipt Info */}
        <div className="receipt-info">
          <div className="info-row">
            <span className="label">Receipt ID:</span>
            <span className="value">{receipt.receiptId}</span>
          </div>
          <div className="info-row">
            <span className="label">Date:</span>
            <span className="value">{formatDate(receipt.date)}</span>
          </div>
          <div className="info-row">
            <span className="label">Payment Method:</span>
            <span className="value">{receipt.paymentMethod}</span>
          </div>
        </div>

        <hr className="receipt-divider" />

        {/* Customer Info */}
        <div className="customer-section">
          <h3 className="section-title">Customer Information</h3>
          <div className="info-row">
            <span className="label">Name:</span>
            <span className="value">{receipt.name || 'N/A'}</span>
          </div>
          <div className="info-row">
            <span className="label">Phone:</span>
            <span className="value">{receipt.phone || 'N/A'}</span>
          </div>
        </div>

        <hr className="receipt-divider" />

        {/* Service Info - Conditional by Service Type */}
        <div className="service-section">
          <h3 className="section-title">Service Details</h3>

          {receipt.serviceType === 'Training' && (receiptDetails || receipt.batch) && (
            <>
              <div className="info-row">
                <span className="label">Service:</span>
                <span className="value">Swimming Training Classes</span>
              </div>
              <div className="info-row">
                <span className="label">Package:</span>
                <span className="value">{receiptDetails?.package || receipt.package || 'N/A'}</span>
              </div>
              <div className="info-row">
                <span className="label">Batch:</span>
                <span className="value">{receiptDetails?.batch || receipt.batch || 'N/A'}</span>
              </div>
              <div className="info-row">
                <span className="label">Duration:</span>
                <span className="value">{(receiptDetails?.duration || receipt.duration) ? `${receiptDetails?.duration || receipt.duration} days` : 'N/A'}</span>
              </div>
            </>
          )}

          {receipt.serviceType === 'Membership' && (receiptDetails || receipt.plan) && (
            <>
              <div className="info-row">
                <span className="label">Service:</span>
                <span className="value">Membership Plan</span>
              </div>
              <div className="info-row">
                <span className="label">Plan:</span>
                <span className="value">{receiptDetails?.plan || receipt.plan || 'N/A'}</span>
              </div>
              <div className="info-row">
                <span className="label">Start Date:</span>
                <span className="value">{(receiptDetails?.startDate || receipt.startDate) ? formatDate(receiptDetails?.startDate || receipt.startDate) : 'Today'}</span>
              </div>
              <div className="info-row">
                <span className="label">Duration:</span>
                <span className="value">{(receiptDetails?.duration || receipt.duration) ? `${receiptDetails?.duration || receipt.duration} days` : 'N/A'}</span>
              </div>
            </>
          )}

          {receipt.serviceType === 'Daily Entry' && (
            <>
              <div className="info-row">
                <span className="label">Service:</span>
                <span className="value">Daily Entry</span>
              </div>
              <div className="info-row">
                <span className="label">Time Slot:</span>
                <span className="value">{receipt.timeSlot || 'N/A'}</span>
              </div>
            </>
          )}

          {receipt.serviceType === 'Bill' && (
            <>
              <div className="info-row">
                <span className="label">Service:</span>
                <span className="value">General Bill</span>
              </div>
              {receipt.amountPerPerson && (
                <>
                  <div className="info-row">
                    <span className="label">Amount Per Person:</span>
                    <span className="value">৳ {receipt.amountPerPerson.toLocaleString()}</span>
                  </div>
                  <div className="info-row">
                    <span className="label">Number of Persons:</span>
                    <span className="value">{receipt.numberOfPersons || 1}</span>
                  </div>
                </>
              )}
            </>
          )}

          {receipt.serviceType === 'Beverage' && receipt.beverageItems && (
            <>
              <div className="info-row">
                <span className="label">Service:</span>
                <span className="value">Beverage Sale</span>
              </div>
              <div className="beverage-items">
                <h4 className="items-header">Items Sold:</h4>
                {receipt.beverageItems.map((item, idx) => (
                  <div key={idx} className="beverage-item">
                    <div className="item-name">{item.productName} × {item.quantity}</div>
                    <div className="item-price">৳ {item.lineTotal.toLocaleString()}</div>
                  </div>
                ))}
              </div>
              {receipt.profit !== undefined && (
                <>
                  <div className="info-row">
                    <span className="label">Cost of Goods:</span>
                    <span className="value">৳ {receipt.totalCost?.toLocaleString()}</span>
                  </div>
                  <div className="info-row">
                    <span className="label">Profit:</span>
                    <span className="value profit">৳ {receipt.profit.toLocaleString()}</span>
                  </div>
                  <div className="info-row">
                    <span className="label">Profit Margin:</span>
                    <span className="value profit">{receipt.profitMargin?.toFixed(2)}%</span>
                  </div>
                </>
              )}
            </>
          )}
        </div>

        <hr className="receipt-divider" />

        {/* Payment Breakdown */}
        <div className="payment-section">
          <h3 className="section-title">Payment Breakdown</h3>

          <div className="payment-row">
            <span className="label">Price:</span>
            <span className="value">৳ {originalPrice.toLocaleString()}</span>
          </div>

          {discount > 0 && (
            <div className="payment-row discount">
              <span className="label">Discount:</span>
              <span className="value">- ৳ {discount.toLocaleString()}</span>
            </div>
          )}

          <div className="payment-divider"></div>

          <div className="payment-row total">
            <span className="label font-bold">Total Amount:</span>
            <span className="value font-bold">৳ {finalAmount.toLocaleString()}</span>
          </div>
        </div>

        <hr className="receipt-divider" />

        {/* Footer */}
        <div className="receipt-footer">
          <p className="thank-you">Thank you for choosing Raya Swimming Pool</p>
          <p className="footer-text">We appreciate your business!</p>
          <p className="footer-text small">This is a computer-generated receipt</p>
        </div>
      </div>

      <style jsx>{`
        #receipt {
          width: 100%;
          max-width: 320px;
          margin: 0 auto;
          background: white;
          padding: 10px;
          font-family: 'Arial', sans-serif;
          font-size: 12px;
        }

        .receipt-wrapper {
          border: none;
          padding: 5px;
          border-radius: 0;
        }

        .receipt-header {
          text-align: center;
          margin-bottom: 20px;
        }

        .company-name {
          font-size: 16px;
          font-weight: bold;
          margin: 5px 0;
          color: #1f2937;
        }

        .company-address,
        .company-phone,
        .company-email {
          font-size: 10px;
          color: #6b7280;
          margin: 2px 0;
        }

        .receipt-divider {
          border: none;
          border-top: 1px solid #e5e7eb;
          margin: 5px 0;
        }

        .payment-divider {
          border: none;
          border-top: 1px dashed #d1d5db;
          margin: 5px 0;
        }

        .receipt-info,
        .customer-section,
        .service-section {
          margin-bottom: 8px;
        }

        .section-title {
          font-size: 11px;
          font-weight: 600;
          color: #1f2937;
          margin-bottom: 5px;
          text-transform: uppercase;
          letter-spacing: 0.5px;
        }

        .info-row {
          display: flex;
          justify-content: space-between;
          align-items: center;
          padding: 3px 0;
          font-size: 11px;
        }

        .info-row .label {
          font-weight: 500;
          color: #6b7280;
        }

        .info-row .value {
          color: #1f2937;
          text-align: right;
          flex: 1;
          margin-left: 10px;
        }

        .payment-section {
          margin-bottom: 8px;
        }

        .payment-row {
          display: flex;
          justify-content: space-between;
          align-items: center;
          padding: 4px 0;
          font-size: 11px;
        }

        .payment-row .label {
          font-weight: 500;
          color: #6b7280;
        }

        .payment-row .value {
          color: #1f2937;
          font-weight: 500;
        }

        .payment-row.discount .value {
          color: #dc2626;
        }

        .payment-row.total {
          font-size: 12px;
          padding: 8px 0;
          margin-top: 5px;
        }

        .payment-row.total .label,
        .payment-row.total .value {
          font-size: 15px;
          font-weight: bold;
          color: #1f2937;
        }

        .beverge-items {
          margin: 5px 0;
          padding: 5px;
          background-color: #f9fafb;
          border-radius: 0;
        }

        .items-header {
          font-weight: 600;
          color: #374151;
          font-size: 10px;
          margin-bottom: 4px;
        }

        .beverage-item {
          display: flex;
          justify-content: space-between;
          align-items: center;
          padding: 3px 0;
          border-bottom: 1px solid #e5e7eb;
          font-size: 10px;
        }

        .beverage-item:last-child {
          border-bottom: none;
        }

        .item-name {
          color: #6b7280;
          flex: 1;
        }

        .item-price {
          color: #1f2937;
          font-weight: 500;
          margin-left: 10px;
          text-align: right;
        }

        .info-row.profit {
          color: #10b981;
          font-weight: 500;
        }

        .info-row .value.profit {
          color: #10b981;
          font-weight: 600;
        }

        .receipt-footer {
          text-align: center;
          padding-top: 8px;
        }

        .thank-you {
          font-size: 11px;
          font-weight: 600;
          color: #1f2937;
          margin-bottom: 4px;
        }

        .footer-text {
          font-size: 9px;
          color: #9ca3af;
          margin: 2px 0;
        }

        .footer-text.small {
          font-size: 8px;
          margin-top: 5px;
        }

        /* Print styles */
        @page {
          size: 80mm auto;
          margin: 0;
          background-color: white;
          padding: 0;
        }

        @media print {
          * {
            background-color: white !important;
            background: white !important;
          }

          body {
            background-color: white !important;
            margin: 0;
            padding: 0;
          }

          body * {
            display: none;
          }

          #receipt {
            display: block !important;
            visibility: visible !important;
            position: static !important;
            width: 100% !important;
            max-width: 100% !important;
            margin: 0 !important;
            padding: 0 !important;
            border: none !important;
            font-family: Arial, sans-serif !important;
            font-size: 14px !important;
            color: black !important;
            background-color: white !important;
            page-break-after: avoid;
          }

          .receipt-container {
            width: 100% !important;
            max-width: 100% !important;
            margin: 0 !important;
            padding: 40px 20px !important;
            background-color: white !important;
            display: block !important;
          }

          .receipt-wrapper {
            border: none !important;
            padding: 30px !important;
            border-radius: 0 !important;
            background-color: white !important;
            display: block !important;
          }

          .receipt-header,
          .receipt-info,
          .customer-section,
          .service-section,
          .payment-section,
          .receipt-footer,
          .receipt-divider,
          .company-name,
          .company-address,
          .company-phone,
          .company-email,
          .section-title,
          .info-row,
          .payment-row,
          .beverge-items,
          .beverage-item,
          .thank-you,
          .footer-text,
          .payment-divider {
            display: block !important;
            visibility: visible !important;
            background-color: white !important;
            color: black !important;
          }

          .no-print {
            display: none !important;
            visibility: hidden !important;
          }
        }
      `}</style>
    </div>
  );
}
