import { CheckCircle, AlertCircle, Clock, Shield, Users } from 'lucide-react';

/**
 * Professional badge component with icons
 * Used for status/role indicators
 */
export default function Badge({ type = 'status', value, className = '' }) {
  const getBadgeConfig = () => {
    switch (type) {
      case 'status':
        if (value === 'Active') {
          return {
            icon: CheckCircle,
            bgColor: 'bg-green-100',
            textColor: 'text-green-800',
            label: 'Active'
          };
        } else if (value === 'Pending') {
          return {
            icon: Clock,
            bgColor: 'bg-amber-100',
            textColor: 'text-amber-800',
            label: 'Pending'
          };
        } else {
          return {
            icon: AlertCircle,
            bgColor: 'bg-red-100',
            textColor: 'text-red-800',
            label: value || 'Inactive'
          };
        }

      case 'role':
        if (value === 'admin') {
          return {
            icon: Shield,
            bgColor: 'bg-blue-100',
            textColor: 'text-blue-800',
            label: 'Admin'
          };
        } else {
          return {
            icon: Users,
            bgColor: 'bg-amber-100',
            textColor: 'text-amber-800',
            label: 'Manager'
          };
        }

      default:
        return {
          icon: CheckCircle,
          bgColor: 'bg-gray-100',
          textColor: 'text-gray-800',
          label: value
        };
    }
  };

  const config = getBadgeConfig();
  const Icon = config.icon;

  return (
    <div className={`flex items-center gap-2 px-3 py-1 rounded-full text-sm font-semibold ${config.bgColor} ${config.textColor} ${className}`}>
      <Icon size={16} />
      <span>{config.label}</span>
    </div>
  );
}
