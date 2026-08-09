import React, { useState } from 'react';
import LockerDashboard from './LockerDashboard';
import LockerSettingsModal from './LockerSettingsModal';

export default function LockerManagementPage({ token }) {
  const [activeTab, setActiveTab] = useState('dashboard');
  const [showSettingsModal, setShowSettingsModal] = useState(false);
  const [refreshKey, setRefreshKey] = useState(0);

  const handleSettingsSaved = () => {
    setShowSettingsModal(false);
    setRefreshKey((prev) => prev + 1);
  };

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <div className="bg-white border-b border-gray-200 sticky top-0 z-40">
        <div className="px-4 md:px-6 py-4">
          <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-2 mb-4">
            <h1 className="text-xl md:text-2xl font-bold text-gray-900">🔐 Locker Management</h1>
            <button
              onClick={() => setShowSettingsModal(true)}
              className="px-4 py-2 bg-primary text-white rounded-lg hover:bg-primary/90 transition-colors"
            >
              ⚙️ Locker Settings
            </button>
          </div>

          {/* Tabs */}
          <div className="flex gap-2 border-b border-gray-200">
            <button
              onClick={() => setActiveTab('dashboard')}
              className={`px-4 py-3 font-medium transition-colors ${
                activeTab === 'dashboard'
                  ? 'border-b-2 border-primary text-primary'
                  : 'text-gray-600 hover:text-gray-900'
              }`}
            >
              Dashboard
            </button>
            <button
              onClick={() => setActiveTab('history')}
              className={`px-4 py-3 font-medium transition-colors ${
                activeTab === 'history'
                  ? 'border-b-2 border-primary text-primary'
                  : 'text-gray-600 hover:text-gray-900'
              }`}
            >
              History
            </button>
          </div>
        </div>
      </div>

      {/* Content */}
      <div className="p-6">
        {activeTab === 'dashboard' && <LockerDashboard key={refreshKey} token={token} onSettingsUpdated={() => setRefreshKey((prev) => prev + 1)} />}
        {activeTab === 'history' && (
          <div className="bg-white rounded-lg shadow p-6">
            <p className="text-gray-600">History view coming soon...</p>
          </div>
        )}
      </div>

      {/* Settings Modal */}
      {showSettingsModal && (
        <LockerSettingsModal
          token={token}
          onClose={() => setShowSettingsModal(false)}
          onSave={handleSettingsSaved}
        />
      )}
    </div>
  );
}
