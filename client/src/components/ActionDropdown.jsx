import { useRef, useEffect, useState } from 'react';
import { MoreHorizontal, ChevronDown } from 'lucide-react';

/**
 * Row/card action menu. Pass `actions` as
 * [{ label, onClick, icon?, destructive? }], with `null` entries rendered
 * as dividers (handy for separating a destructive action from the rest).
 *
 * `trigger="icon"` (default) renders a compact "···" icon button for table
 * rows; `trigger="button"` renders the labeled "Actions ⌄" button used in
 * card headers.
 */
export default function ActionDropdown({ actions = [], trigger = 'icon', label = 'Actions' }) {
  const [isOpen, setIsOpen] = useState(false);
  const dropdownRef = useRef(null);

  useEffect(() => {
    function handleClickOutside(event) {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target)) {
        setIsOpen(false);
      }
    }

    if (isOpen) {
      document.addEventListener('mousedown', handleClickOutside);
      return () => document.removeEventListener('mousedown', handleClickOutside);
    }
  }, [isOpen]);

  const handleActionClick = (action) => {
    action.onClick();
    setIsOpen(false);
  };

  return (
    <div className="relative inline-block" ref={dropdownRef}>
      {trigger === 'button' ? (
        <button
          onClick={() => setIsOpen((v) => !v)}
          className="btn-secondary btn-sm"
          aria-haspopup="menu"
          aria-expanded={isOpen}
        >
          {label} <ChevronDown size={14} />
        </button>
      ) : (
        <button
          onClick={() => setIsOpen((v) => !v)}
          className="w-8 h-8 flex items-center justify-center rounded-control text-ink-faint hover:text-ink hover:bg-canvas transition-colors"
          aria-haspopup="menu"
          aria-expanded={isOpen}
          aria-label={label}
        >
          <MoreHorizontal size={17} />
        </button>
      )}

      {isOpen && (
        <div className="dropdown-panel right-0 mt-1.5" role="menu">
          {actions.map((action, idx) =>
            action === null ? (
              <div key={idx} className="dropdown-divider" />
            ) : (
              <button
                key={idx}
                role="menuitem"
                onClick={() => handleActionClick(action)}
                disabled={action.disabled}
                className={action.destructive ? 'dropdown-item-danger' : 'dropdown-item'}
              >
                {action.icon && <action.icon size={15} className="flex-shrink-0" />}
                <span className="truncate">{action.label}</span>
              </button>
            ),
          )}
        </div>
      )}
    </div>
  );
}
