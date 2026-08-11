import { Inbox } from 'lucide-react';
import Button from './Button';

/**
 * Shown when a list or table has nothing in it yet.
 */
export default function EmptyState({
  title = 'Nothing here yet',
  message = 'Once you add something, it will show up here.',
  icon: Icon = Inbox,
  actionLabel = null,
  onAction = null,
}) {
  return (
    <div className="flex flex-col items-center justify-center py-12 px-4 text-center">
      <div className="mb-4 w-12 h-12 rounded-full bg-canvas border border-line flex items-center justify-center">
        <Icon size={22} className="text-ink-faint" />
      </div>
      <h3 className="text-sm font-semibold text-ink mb-1">{title}</h3>
      <p className="text-sm text-ink-soft max-w-xs">{message}</p>
      {actionLabel && onAction && (
        <Button onClick={onAction} variant="primary" size="sm" className="mt-5">
          {actionLabel}
        </Button>
      )}
    </div>
  );
}
