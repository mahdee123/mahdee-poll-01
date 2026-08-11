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
  Waves,
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

  const initials = (user?.name || user?.email || '?').trim().charAt(0).toUpperCase();

  return (
    <>
      {/* Backdrop - mobile only */}
      {isOpen && (
        <div
          className="fixed inset-0 bg-ink/40 z-40 sm:hidden animate-fade-in"
          onClick={onClose}
        />
      )}

      {/* Sidebar */}
      <aside
        className={`
          fixed top-0 left-0 h-full z-50 bg-white border-r border-line text-ink flex flex-col
          transition-transform duration-300 ease-in-out
          sm:relative sm:translate-x-0 sm:w-72 sm:z-auto sm:flex-shrink-0
          ${isOpen ? 'translate-x-0 w-72' : '-translate-x-full w-72'}
        `}
      >
        <div className="flex items-center justify-between gap-2 px-4 h-16 border-b border-line flex-shrink-0">
          <div className="flex items-center gap-2.5 min-w-0">
            <span className="w-9 h-9 rounded-control bg-primary flex items-center justify-center flex-shrink-0">
              <Waves size={18} className="text-white" />
            </span>
            <div className="min-w-0">
              <div className="text-sm font-semibold text-ink leading-tight truncate">Raya Pool</div>
              <div className="text-xs text-ink-faint leading-tight truncate">Pool management</div>
            </div>
          </div>
          <button
            onClick={onClose}
            className="sm:hidden text-ink-faint hover:text-ink p-1 min-h-[40px] min-w-[40px] flex items-center justify-center rounded-control hover:bg-canvas"
            aria-label="Close menu"
          >
            <X size={20} />
          </button>
        </div>

        <nav className="flex-1 overflow-y-auto px-3 pb-3">
          {NAV_GROUPS.map((group) => (
            <div key={group.label}>
              <div className="nav-group-label">{group.label}</div>
              <div className="space-y-0.5">
                {group.items.map((item) => {
                  const Icon = item.icon;
                  const active = view === item.key;
                  return (
                    <button
                      key={item.key}
                      onClick={() => handleNav(item.key)}
                      aria-current={active ? 'page' : undefined}
                      className={active ? 'nav-item-active' : 'nav-item'}
                    >
                      <Icon size={17} className={active ? 'text-primary' : 'text-ink-faint'} />
                      {item.label}
                    </button>
                  );
                })}
              </div>
            </div>
          ))}
        </nav>

        <div className="border-t border-line p-3 flex-shrink-0 space-y-0.5">
          {user?.role === 'admin' && (
            <button
              onClick={() => { navigate('/settings/company'); if (onClose) onClose(); }}
              className="nav-item"
            >
              <Settings size={17} className="text-ink-faint" />
              Company Settings
            </button>
          )}
          <button onClick={handleLogout} className="nav-item hover:bg-danger-soft hover:text-danger-ink">
            <LogOut size={17} className="text-ink-faint" />
            Logout
          </button>

          <div className="flex items-center gap-2.5 px-3 pt-3 mt-1 border-t border-line">
            <span className="avatar w-8 h-8 text-xs">{initials}</span>
            <div className="min-w-0">
              <p className="text-sm font-medium text-ink truncate">{user?.name || 'Account'}</p>
              <p className="text-xs text-ink-faint truncate capitalize">{user?.role || ''}</p>
            </div>
          </div>
        </div>
      </aside>
    </>
  );
}
