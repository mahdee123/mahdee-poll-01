import { AlertTriangle } from 'lucide-react';
import Modal from './Modal';
import Button from './Button';

/**
 * Confirmation prompt — the in-app replacement for window.confirm().
 * Inherits Escape, focus trap and backdrop behaviour from <Modal/>.
 */
export default function ConfirmDialog({
  isOpen,
  title = 'Are you sure?',
  message,
  confirmText = 'Confirm',
  cancelText = 'Cancel',
  destructive = false,
  loading = false,
  onConfirm,
  onCancel,
}) {
  return (
    <Modal
      isOpen={isOpen}
      onClose={onCancel}
      size="sm"
      showClose={false}
      footer={
        <>
          <Button variant="secondary" onClick={onCancel} disabled={loading}>
            {cancelText}
          </Button>
          <Button
            variant={destructive ? 'danger' : 'primary'}
            onClick={onConfirm}
            loading={loading}
            data-autofocus
          >
            {confirmText}
          </Button>
        </>
      }
    >
      <div className="flex gap-3">
        {destructive && (
          <div className="w-9 h-9 rounded-full bg-danger-soft flex items-center justify-center flex-shrink-0">
            <AlertTriangle size={18} className="text-danger" />
          </div>
        )}
        <div className="min-w-0">
          <h2 className="modal-title">{title}</h2>
          {message && <p className="mt-1.5 text-sm text-ink-soft whitespace-pre-line">{message}</p>}
        </div>
      </div>
    </Modal>
  );
}
