import { Menu } from 'lucide-react';

/**
 * Persistent page header — sits above every view, on both mobile and desktop.
 * Mobile gets the sidebar-toggle button; desktop just shows the page title.
 */
export default function Topbar({ title, subtitle, onOpenSidebar, actions = null }) {
  return (
    <header className="topbar">
      <button
        onClick={onOpenSidebar}
        className="sm:hidden text-ink-soft hover:text-ink p-1.5 min-h-[40px] min-w-[40px] flex items-center justify-center rounded-control hover:bg-canvas flex-shrink-0"
        aria-label="Open menu"
      >
        <Menu size={20} />
      </button>

      <div className="min-w-0 flex-1">
        <h1 className="text-base sm:text-lg font-semibold text-ink truncate">{title}</h1>
        {subtitle && <p className="text-xs text-ink-faint truncate">{subtitle}</p>}
      </div>

      {actions && <div className="flex items-center gap-2 flex-shrink-0">{actions}</div>}
    </header>
  );
}
