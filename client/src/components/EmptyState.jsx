import { Users } from 'lucide-react';
import Button from './Button';

/**
 * Professional empty state component
 * Used when there's no data to display
 */
export default function EmptyState({ 
  title = 'No data yet', 
  message = 'Get started by adding your first item.',
  icon: Icon = Users,
  actionLabel = null,
  onAction = null
}) {
  return (
    <div className="flex flex-col items-center justify-center py-12 text-center">
      <div className="mb-4 p-3 bg-gray-100 rounded-full">
        <Icon size={32} className="text-gray-400" />
      </div>
      <h3 className="text-lg font-semibold text-gray-800 mb-2">{title}</h3>
      <p className="text-gray-600 mb-6 max-w-xs">{message}</p>
      {actionLabel && onAction && (
        <Button onClick={onAction} variant="primary">
          {actionLabel}
        </Button>
      )}
    </div>
  );
}
