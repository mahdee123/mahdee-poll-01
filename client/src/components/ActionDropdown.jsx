import React, { useRef, useEffect, useState } from 'react';

export default function ActionDropdown({ actions = [] }) {
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
    <div className="relative" ref={dropdownRef}>
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="px-3 py-1 text-sm rounded-lg bg-blue-100 hover:bg-blue-200 text-blue-700 font-medium transition"
      >
        Actions ▼
      </button>
      {isOpen && (
        <div className="absolute right-0 mt-1 w-48 bg-white border border-gray-200 rounded-lg shadow-lg z-10">
          {actions.map((action, idx) => (
            <button
              key={idx}
              onClick={() => handleActionClick(action)}
              className={`w-full text-left px-4 py-2 text-sm transition ${
                action.destructive
                  ? 'hover:bg-red-50 text-red-600 hover:text-red-700'
                  : 'hover:bg-gray-50 text-gray-700'
              } ${idx > 0 ? 'border-t border-gray-100' : ''} ${
                idx === actions.length - 1 ? '' : ''
              }`}
            >
              {action.label}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
