import { CheckCircle2, AlertCircle, Clock, Shield, Users } from 'lucide-react';

/**
 * Status / role indicator. Uses the semantic .badge-* classes so status color
 * stays separate from the brand accent.
 */
export default function Badge({ type = 'status', value, className = '' }) {
  const config = (() => {
    if (type === 'role') {
      return value === 'admin'
        ? { icon: Shield, cls: 'badge-info', label: 'Admin' }
        : { icon: Users, cls: 'badge-warning', label: 'Manager' };
    }

    if (type === 'status') {
      if (value === 'Active') return { icon: CheckCircle2, cls: 'badge-success', label: 'Active' };
      if (value === 'Pending') return { icon: Clock, cls: 'badge-warning', label: 'Pending' };
      return { icon: AlertCircle, cls: 'badge-danger', label: value || 'Inactive' };
    }

    return { icon: CheckCircle2, cls: 'badge-neutral', label: value };
  })();

  const Icon = config.icon;

  return (
    <span className={`${config.cls} ${className}`}>
      <Icon size={13} />
      {config.label}
    </span>
  );
}
