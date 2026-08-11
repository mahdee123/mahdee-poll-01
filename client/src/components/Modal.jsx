import { useEffect, useRef, useCallback } from 'react';
import { X } from 'lucide-react';

const SIZES = {
  sm: 'sm:max-w-sm',
  md: 'sm:max-w-md',
  lg: 'sm:max-w-2xl',
  xl: 'sm:max-w-4xl',
  full: 'sm:max-w-6xl',
};

const FOCUSABLE =
  'a[href], button:not([disabled]), textarea:not([disabled]), input:not([disabled]), select:not([disabled]), [tabindex]:not([tabindex="-1"])';

/**
 * The single modal shell for the app: backdrop, Escape, focus trap,
 * scroll lock and consistent sizing in one place.
 *
 * <Modal isOpen={open} onClose={close} title="Assign locker" footer={...}>
 *   ...body...
 * </Modal>
 */
export default function Modal({
  isOpen,
  onClose,
  title,
  description,
  children,
  footer = null,
  size = 'md',
  closeOnBackdrop = true,
  showClose = true,
}) {
  const panelRef = useRef(null);
  const previouslyFocused = useRef(null);

  const handleKeyDown = useCallback(
    (e) => {
      if (e.key === 'Escape') {
        e.stopPropagation();
        onClose?.();
        return;
      }

      if (e.key !== 'Tab' || !panelRef.current) return;

      const items = Array.from(panelRef.current.querySelectorAll(FOCUSABLE)).filter(
        (el) => el.offsetParent !== null,
      );
      if (items.length === 0) return;

      const first = items[0];
      const last = items[items.length - 1];

      if (e.shiftKey && document.activeElement === first) {
        e.preventDefault();
        last.focus();
      } else if (!e.shiftKey && document.activeElement === last) {
        e.preventDefault();
        first.focus();
      }
    },
    [onClose],
  );

  // Lock background scroll while open.
  useEffect(() => {
    if (!isOpen) return;
    const original = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      document.body.style.overflow = original;
    };
  }, [isOpen]);

  // Move focus into the panel, and restore it on close.
  useEffect(() => {
    if (!isOpen) return;
    previouslyFocused.current = document.activeElement;

    const target =
      panelRef.current?.querySelector('[data-autofocus]') ||
      panelRef.current?.querySelector(FOCUSABLE) ||
      panelRef.current;
    target?.focus?.();

    return () => {
      previouslyFocused.current?.focus?.();
    };
  }, [isOpen]);

  if (!isOpen) return null;

  const labelId = title ? 'modal-title' : undefined;

  return (
    <div
      className="modal-backdrop"
      onMouseDown={(e) => {
        if (closeOnBackdrop && e.target === e.currentTarget) onClose?.();
      }}
    >
      <div
        ref={panelRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby={labelId}
        tabIndex={-1}
        onKeyDown={handleKeyDown}
        className={`modal-panel ${SIZES[size] || SIZES.md}`}
      >
        {(title || showClose) && (
          <div className="modal-header">
            <div className="min-w-0">
              {title && <h2 id={labelId} className="modal-title">{title}</h2>}
              {description && <p className="mt-0.5 text-sm text-ink-soft">{description}</p>}
            </div>
            {showClose && (
              <button type="button" onClick={onClose} className="modal-close" aria-label="Close dialog">
                <X size={18} />
              </button>
            )}
          </div>
        )}

        <div className="modal-body">{children}</div>

        {footer && <div className="modal-footer">{footer}</div>}
      </div>
    </div>
  );
}
