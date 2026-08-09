import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';

const ALL_ITEMS = [
  { key: 'dashboard', label: '📊 Dashboard' },
  { key: 'billing', label: '🧾 Bills / Receipts' },
  { key: 'beverages', label: '🧃 Beverage Sales' },
  { key: 'training', label: '🏋️ Training' },
  { key: 'members', label: '👥 Memberships' },
  { key: 'packages', label: '📦 Packages' },
  { key: 'lockers', label: '🔐 Lockers' },
  { key: 'dress-rentals', label: '👕 Dress Rentals' },
  { key: 'cash-movements', label: '💰 Cash Movements' },
  { key: 'reconciliation', label: '📊 Reconciliation' },
  { key: 'accounting', label: '📒 Accounting' },
  { key: 'reports', label: '📈 Reports' },
];

export default function Sidebar({ view, setView, user, isOpen, onClose }) {
  const navigate = useNavigate();
  const { clearAuth } = useAuth();

  const items = ALL_ITEMS;

  const handleLogout = () => {
    clearAuth();
    navigate('/login');
  };

  const handleNav = (key) => {
    setView(key);
    if (onClose) onClose();
  };

  return (
    <>
      {/* Backdrop - mobile only */}
      {isOpen && (
        <div
          className="fixed inset-0 bg-black/50 z-40 sm:hidden"
          onClick={onClose}
        />
      )}

      {/* Sidebar */}
      <aside
        className={`
          fixed top-0 left-0 h-full z-50 bg-secondary text-white p-4 flex flex-col
          transition-transform duration-300 ease-in-out
          sm:relative sm:translate-x-0 sm:w-72 sm:z-auto
          ${isOpen ? 'translate-x-0 w-72' : '-translate-x-full w-72'}
        `}
      >
        <div className="flex items-center justify-between mb-6 sm:justify-start">
          <div className="text-xl font-bold">Raya Pool</div>
          <button
            onClick={onClose}
            className="sm:hidden text-white/70 hover:text-white text-2xl leading-none p-1"
            aria-label="Close menu"
          >
            ✕
          </button>
        </div>

        <nav className="space-y-1 flex-1 overflow-y-auto">
          {items.map((item) => (
            <button
              key={item.key}
              onClick={() => handleNav(item.key)}
              className={`w-full text-left px-3 py-2.5 rounded-lg transition min-h-[44px] flex items-center ${
                view === item.key ? 'bg-white text-secondary font-semibold' : 'hover:bg-white/10'
              }`}
            >
              {item.label}
            </button>
          ))}
        </nav>

        <div className="space-y-1 border-t border-white/20 pt-4 mt-4 flex-shrink-0">
          {user?.role === 'admin' && (
            <button
              onClick={() => { navigate('/settings/company'); if (onClose) onClose(); }}
              className="w-full text-left px-3 py-2.5 rounded-lg hover:bg-white/10 transition text-sm min-h-[44px] flex items-center"
            >
              ⚙️ Company Settings
            </button>
          )}
          <button
            onClick={handleLogout}
            className="w-full text-left px-3 py-2.5 rounded-lg hover:bg-red-500 transition text-sm min-h-[44px] flex items-center"
          >
            🚪 Logout
          </button>
        </div>
      </aside>
    </>
  );
}
