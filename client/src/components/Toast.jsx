import { useEffect, useState } from 'react';
import { CheckCircle2, AlertCircle, Info, X } from 'lucide-react';

const ICONS = { success: CheckCircle2, error: AlertCircle, info: Info };
const CLASSES = { success: 'toast-success', error: 'toast-error', info: 'toast-info' };
const ICON_COLORS = { success: 'text-success', error: 'text-danger', info: 'text-primary' };

/**
 * Self-positioning toast for components that manage their own toast state.
 * New code should prefer useToast() from context/ToastContext.jsx, which
 * stacks notifications app-wide instead of overlapping them.
 */
export default function Toast({ message, type = 'success', onClose, duration = 4000 }) {
  const [isVisible, setIsVisible] = useState(true);

  useEffect(() => {
    if (!duration) return;
    const timer = setTimeout(() => {
      setIsVisible(false);
      onClose?.();
    }, duration);
    return () => clearTimeout(timer);
  }, [duration, onClose]);

  if (!isVisible || !message) return null;

  const Icon = ICONS[type] || Info;

  return (
    <div className="fixed top-4 left-4 right-4 sm:left-auto sm:right-4 z-[100] flex justify-end pointer-events-none">
      <div className={CLASSES[type] || CLASSES.info} role="status" aria-live="polite">
        <Icon size={18} className={`${ICON_COLORS[type] || ICON_COLORS.info} flex-shrink-0 mt-0.5`} />
        <p className="flex-1 text-sm text-ink whitespace-pre-line">{message}</p>
        <button
          type="button"
          onClick={() => {
            setIsVisible(false);
            onClose?.();
          }}
          className="text-ink-faint hover:text-ink flex-shrink-0"
          aria-label="Dismiss notification"
        >
          <X size={16} />
        </button>
      </div>
    </div>
  );
}
