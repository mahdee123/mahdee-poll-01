import { createContext, useCallback, useContext, useMemo, useState } from 'react';
import { CheckCircle2, AlertCircle, Info, X } from 'lucide-react';

const ToastContext = createContext(null);

const ICONS = {
  success: CheckCircle2,
  error: AlertCircle,
  info: Info,
};

const ICON_COLOR = {
  success: 'text-success',
  error: 'text-danger',
  info: 'text-primary',
};

let nextId = 0;

export function ToastProvider({ children }) {
  const [toasts, setToasts] = useState([]);

  const dismiss = useCallback((id) => {
    setToasts((list) => list.filter((t) => t.id !== id));
  }, []);

  const push = useCallback(
    (message, type = 'success', duration = 4000) => {
      if (!message) return;
      const id = ++nextId;
      setToasts((list) => [...list, { id, message: String(message), type }]);
      if (duration) setTimeout(() => dismiss(id), duration);
      return id;
    },
    [dismiss],
  );

  const api = useMemo(
    () => ({
      toast: push,
      success: (m, d) => push(m, 'success', d),
      error: (m, d) => push(m, 'error', d ?? 6000),
      info: (m, d) => push(m, 'info', d),
      dismiss,
    }),
    [push, dismiss],
  );

  return (
    <ToastContext.Provider value={api}>
      {children}
      <div
        className="fixed top-4 left-4 right-4 sm:left-auto sm:right-4 z-[100] flex flex-col items-stretch sm:items-end gap-2 pointer-events-none"
        role="region"
        aria-live="polite"
        aria-label="Notifications"
      >
        {toasts.map((t) => {
          const Icon = ICONS[t.type] || Info;
          return (
            <div key={t.id} className={`toast-${t.type === 'error' ? 'error' : t.type === 'info' ? 'info' : 'success'}`}>
              <Icon size={18} className={`${ICON_COLOR[t.type] || ICON_COLOR.info} flex-shrink-0 mt-0.5`} />
              <p className="flex-1 text-sm text-ink whitespace-pre-line">{t.message}</p>
              <button
                type="button"
                onClick={() => dismiss(t.id)}
                className="text-ink-faint hover:text-ink flex-shrink-0"
                aria-label="Dismiss notification"
              >
                <X size={16} />
              </button>
            </div>
          );
        })}
      </div>
    </ToastContext.Provider>
  );
}

/**
 * Returns { toast, success, error, info, dismiss }.
 * Safe to call outside a provider — falls back to no-ops rather than throwing,
 * so a component can be rendered in isolation without crashing.
 */
export function useToast() {
  const ctx = useContext(ToastContext);
  return (
    ctx || {
      toast: () => {},
      success: () => {},
      error: () => {},
      info: () => {},
      dismiss: () => {},
    }
  );
}
