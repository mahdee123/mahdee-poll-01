import { useState } from 'react';

export default function InitialOpeningBalanceModal({ isOpen, onSubmit, isLoading }) {
  const [amount, setAmount] = useState('');
  const [note, setNote] = useState('');
  const [error, setError] = useState('');

  const handleSubmit = (e) => {
    e.preventDefault();
    setError('');

    if (!amount || amount === '') {
      setError('Please enter the opening balance amount');
      return;
    }

    const numAmount = parseFloat(amount);
    if (isNaN(numAmount) || numAmount < 0) {
      setError('Opening balance must be a valid positive number');
      return;
    }

    onSubmit({ amount: numAmount, note });
    setAmount('');
    setNote('');
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
      <div className="bg-white rounded-lg shadow-xl p-6 max-w-md w-full mx-4">
        <div className="mb-4">
          <h2 className="text-2xl font-bold text-gray-800 mb-2">Set Opening Balance</h2>
          <p className="text-gray-600 text-sm">
            Enter your initial cash balance for the business. This amount will be set once and cannot be changed.
          </p>
        </div>

        {error && (
          <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-lg mb-4">
            {error}
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Opening Balance Amount *
            </label>
            <div className="relative">
              <span className="absolute left-3 top-2.5 text-gray-500 font-semibold">৳</span>
              <input
                type="number"
                value={amount}
                onChange={(e) => setAmount(e.target.value)}
                placeholder="0"
                className="w-full pl-8 pr-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                disabled={isLoading}
                step="0.01"
                min="0"
              />
            </div>
            <p className="text-xs text-gray-500 mt-1">Enter the cash you have at the start</p>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Note (Optional)
            </label>
            <textarea
              value={note}
              onChange={(e) => setNote(e.target.value)}
              placeholder="e.g., Bank balance + Cash in hand"
              rows="3"
              className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
              disabled={isLoading}
            />
          </div>

          <div className="flex gap-3 pt-4">
            <button
              type="submit"
              disabled={isLoading}
              className="flex-1 bg-blue-500 hover:bg-blue-600 disabled:bg-gray-400 text-white font-semibold py-2 px-4 rounded-lg transition"
            >
              {isLoading ? 'Setting...' : 'Set Opening Balance'}
            </button>
          </div>

          <p className="text-xs text-gray-500 text-center">
            ⚠️ This action cannot be undone. The opening balance will be locked after setting.
          </p>
        </form>
      </div>
    </div>
  );
}
