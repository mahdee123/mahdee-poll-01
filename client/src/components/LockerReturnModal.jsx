import React, { useState, useEffect } from 'react';
import { apiRequest } from '../api';
import Toast from './Toast';

export default function LockerReturnModal({ token, locker, onClose, onSuccess }) {
  const [loading, setLoading] = useState(false);
  const [assignment, setAssignment] = useState(null);
  const [toast, setToast] = useState(null);

  useEffect(() => {
    // The assignment info should be in locker.assignment from parent
    if (locker.assignment) {
      setAssignment(locker.assignment);
    }
  }, [locker]);

  const calculateDuration = () => {
    if (!assignment) return '—';
    const assigned = new Date(assignment.assignedTime);
    const now = new Date();
    const diffMs = now - assigned;
    const diffMins = Math.floor(diffMs / 60000);
    
    if (diffMins < 60) {
      return `${diffMins} min`;
    }
    const diffHours = Math.floor(diffMins / 60);
    return `${diffHours}h ${diffMins % 60}m`;
  };

  const handleReturn = async () => {
    try {
      setLoading(true);
      await apiRequest(`/lockers/${locker._id}/return`, {
        method: 'POST',
        token,
      });

      setToast({
        type: 'success',
        message: 'Locker returned successfully',
      });

      setTimeout(() => {
        onSuccess();
      }, 1000);
    } catch (error) {
      console.error('Error returning locker:', error);
      setToast({
        type: 'error',
        message: error.message || 'Failed to return locker',
      });
    } finally {
      setLoading(false);
    }
  };

  if (!assignment) {
    return (
      <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
        <div className="bg-white rounded-lg shadow-xl max-w-md w-full mx-4 p-6">
          <p className="text-gray-600">No active assignment found for this locker</p>
          <button
            onClick={onClose}
            className="mt-4 px-4 py-2 bg-gray-300 text-gray-700 rounded-lg hover:bg-gray-400 transition-colors"
          >
            Close
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
      <div className="bg-white rounded-lg shadow-xl max-w-md w-full mx-4">
        {/* Header */}
        <div className="border-b border-gray-200 p-4 flex justify-between items-center">
          <h2 className="text-xl font-bold text-gray-900">↩️ Return Locker</h2>
          <button
            onClick={onClose}
            className="text-gray-500 hover:text-gray-700 text-2xl leading-none min-h-[44px] min-w-[44px] flex items-center justify-center"
          >
            ×
          </button>
        </div>

        {/* Content */}
        <div className="p-6 space-y-6">
          {/* Locker Info */}
          <div className="bg-gray-50 rounded-lg p-4 space-y-3">
            <div className="flex justify-between">
              <span className="text-gray-600">Locker:</span>
              <span className="font-semibold text-gray-900">{locker.lockerNumber}</span>
            </div>
          </div>

          {/* Member Info */}
          <div className="bg-primary/5 rounded-lg p-4 space-y-3">
            <div className="flex justify-between">
              <span className="text-gray-600">Member:</span>
              <span className="font-semibold text-gray-900">{assignment.memberName}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-gray-600">Phone:</span>
              <span className="font-semibold text-gray-900">{assignment.memberPhone}</span>
            </div>
          </div>

          {/* Time Info */}
          <div className="bg-amber-50 rounded-lg p-4 space-y-3">
            <div className="flex justify-between">
              <span className="text-gray-600">Assigned Time:</span>
              <span className="font-semibold text-gray-900">
                {new Date(assignment.assignedTime).toLocaleString()}
              </span>
            </div>
            <div className="flex justify-between">
              <span className="text-gray-600">Duration:</span>
              <span className="font-semibold text-gray-900">{calculateDuration()}</span>
            </div>
          </div>

          {/* Charge Info */}
          {assignment.chargeAmount > 0 && (
            <div className="bg-green-50 rounded-lg p-4">
              <div className="flex justify-between items-center">
                <span className="text-gray-600">Charge:</span>
                <span className="font-bold text-green-600 text-lg">৳{assignment.chargeAmount}</span>
              </div>
              <div className="mt-2 text-xs text-gray-600">
                Charge Type: {assignment.chargeType === 'SeparateTransaction' ? 'Separate Transaction' : 'Added to Bill'}
              </div>
            </div>
          )}

          {/* Notes */}
          {assignment.notes && (
            <div className="bg-gray-50 rounded-lg p-4">
              <div className="text-sm text-gray-600 mb-1">Notes:</div>
              <p className="text-sm text-gray-900">{assignment.notes}</p>
            </div>
          )}

          {/* Warning */}
          <div className="bg-red-50 border border-red-200 rounded-lg p-4">
            <p className="text-sm text-red-700">
              ⚠️ Confirming return will mark this locker as <strong>Available</strong> and close this session.
            </p>
          </div>
        </div>

        {/* Footer Actions */}
        <div className="border-t border-gray-200 p-4 flex gap-3 justify-end">
          <button
            onClick={onClose}
            className="px-4 py-2 text-gray-700 border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors"
          >
            Cancel
          </button>
          <button
            onClick={handleReturn}
            disabled={loading}
            className="px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 disabled:bg-gray-400 transition-colors"
          >
            {loading ? 'Returning...' : 'Confirm Return'}
          </button>
        </div>
      </div>

      {toast && (
        <Toast
          type={toast.type}
          message={toast.message}
          onClose={() => setToast(null)}
        />
      )}
    </div>
  );
}
