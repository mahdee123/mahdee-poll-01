import React, { useState } from 'react';
import { Settings, LayoutDashboard, History } from 'lucide-react';
import DressDashboard from './DressDashboard';
import DressHistoryPage from './DressHistoryPage';
import DressRentalSettingsModal from './DressRentalSettingsModal';
import Button from './Button';

export default function DressRentalPage({ token }) {
  const [activeTab, setActiveTab] = useState('dashboard');
  const [showSettingsModal, setShowSettingsModal] = useState(false);
  const [refreshKey, setRefreshKey] = useState(0);

  const handleSettingsSaved = () => {
    setShowSettingsModal(false);
    setRefreshKey((prev) => prev + 1);
  };

  return (
    <div className="grid gap-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div className="segmented">
          <button
            onClick={() => setActiveTab('dashboard')}
            className={`flex items-center gap-1.5 ${activeTab === 'dashboard' ? 'segmented-item-active' : 'segmented-item'}`}
          >
            <LayoutDashboard size={14} /> Dashboard
          </button>
          <button
            onClick={() => setActiveTab('history')}
            className={`flex items-center gap-1.5 ${activeTab === 'history' ? 'segmented-item-active' : 'segmented-item'}`}
          >
            <History size={14} /> History
          </button>
        </div>
        <Button variant="secondary" icon={Settings} onClick={() => setShowSettingsModal(true)}>
          Dress settings
        </Button>
      </div>

      {activeTab === 'dashboard' && <DressDashboard key={refreshKey} token={token} />}
      {activeTab === 'history' && <DressHistoryPage token={token} />}

      {/* Settings Modal */}
      {showSettingsModal && (
        <DressRentalSettingsModal
          isOpen={showSettingsModal}
          token={token}
          onClose={() => setShowSettingsModal(false)}
          onSuccess={handleSettingsSaved}
        />
      )}
    </div>
  );
}
