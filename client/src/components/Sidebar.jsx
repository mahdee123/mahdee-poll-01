import { useNavigate } from 'react-router-dom';
import {
  LayoutDashboard,
  Receipt,
  CupSoda,
  Dumbbell,
  UsersRound,
  Lock,
  Shirt,
  Wallet,
  Scale,
  BookOpen,
  BarChart3,
  Package,
  Settings,
  LogOut,
  X,
} from 'lucide-react';
import { useAuth } from '../context/AuthContext';

// Grouped by how often a screen actually gets opened, not alphabetically —
// daily operator tasks first, monthly/back-office tasks second.
const NAV_GROUPS = [
  {
    label: 'Daily operations',
    items: [
      { key: 'dashboard', label: 'Dashboard', icon: LayoutDashboard },
      { key: 'billing', label: 'Bills / Receipts', icon: Receipt },
      { key: 'beverages', label: 'Beverage Sales', icon: CupSoda },
      { key: 'training', label: 'Training', icon: Dumbbell },
      { key: 'members', label: 'Memberships', icon: UsersRound },
      { key: 'lockers', label: 'Lockers', icon: Lock },
      { key: 'dress-rentals', label: 'Dress Rentals', icon: Shirt },
    ],
  },
  {
    label: 'Back office',
    items: [
      { key: 'cash-movements', label: 'Cash Movements', icon: Wallet },
      { key: 'reconciliation', label: 'Reconciliation', icon: Scale },
      { key: 'accounting', label: 'Accounting', icon: BookOpen },
      { key: 'reports', label: 'Reports', icon: BarChart3 },
      { key: 'packages', label: 'Packages', icon: Package },
    ],
  },
];

export default function Sidebar({ view, setView, user, isOpen, onClose }) {
  const navigate = useNavigate();
  const { clearAuth } = useAuth();

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
        <div className="flex items-center justify-between mb-4 sm:justify-start">
          <div className="text-xl font-bold">Raya Pool</div>
          <button
            onClick={onClose}
            className="sm:hidden text-white/70 hover:text-white p-1 min-h-[44px] min-w-[44px] flex items-center justify-center"
            aria-label="Close menu"
          >
            <X size={22} />
          </button>
        </div>

        <nav className="flex-1 overflow-y-auto">
          {NAV_GROUPS.map((group) => (
            <div key={group.label} className="mb-2">
              <div className="px-3 pt-3 pb-1 text-[11px] font-semibold uppercase tracking-wide text-white/40">
                {group.label}
              </div>
              <div className="space-y-1">
                {group.items.map((item) => {
                  const Icon = item.icon;
                  const active = view === item.key;
                  return (
                    <button
                      key={item.key}
                      onClick={() => handleNav(item.key)}
                      className={`w-full text-left px-3 py-2.5 rounded-lg transition min-h-[44px] flex items-center gap-3 ${
                        active ? 'bg-white text-secondary font-semibold' : 'hover:bg-white/10'
                      }`}
                    >
                      <Icon size={17} className={active ? 'text-secondary' : 'text-white/70'} />
                      {item.label}
                    </button>
                  );
                })}
              </div>
            </div>
          ))}
        </nav>

        <div className="space-y-1 border-t border-white/20 pt-4 mt-4 flex-shrink-0">
          {user?.role === 'admin' && (
            <button
              onClick={() => { navigate('/settings/company'); if (onClose) onClose(); }}
              className="w-full text-left px-3 py-2.5 rounded-lg hover:bg-white/10 transition text-sm min-h-[44px] flex items-center gap-3"
            >
              <Settings size={17} className="text-white/70" />
              Company Settings
            </button>
          )}
          <button
            onClick={handleLogout}
            className="w-full text-left px-3 py-2.5 rounded-lg hover:bg-red-500 transition text-sm min-h-[44px] flex items-center gap-3"
          >
            <LogOut size={17} className="text-white/70" />
            Logout
          </button>
        </div>
      </aside>
    </>
  );
}
