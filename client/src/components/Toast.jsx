import { useState, useEffect } from 'react';
import { CheckCircle, AlertCircle, Info, X } from 'lucide-react';

/**
 * Toast notification component
 * Used for non-blocking messages
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

  if (!isVisible) return null;

  const config = {
    success: {
      icon: CheckCircle,
      bgColor: 'bg-green-50',
      borderColor: 'border-green-200',
      textColor: 'text-green-800',
      iconColor: 'text-green-600'
    },
    error: {
      icon: AlertCircle,
      bgColor: 'bg-red-50',
      borderColor: 'border-red-200',
      textColor: 'text-red-800',
      iconColor: 'text-red-600'
    },
    info: {
      icon: Info,
      bgColor: 'bg-blue-50',
      borderColor: 'border-blue-200',
      textColor: 'text-blue-800',
      iconColor: 'text-blue-600'
    }
  };

  const cfg = config[type] || config.info;
  const Icon = cfg.icon;

  return (
    <div className={`fixed top-4 right-4 ${cfg.bgColor} border ${cfg.borderColor} rounded-lg p-4 shadow-lg max-w-md flex items-start gap-3 animate-slideIn`}>
      <Icon size={20} className={cfg.iconColor} />
      <p className={`${cfg.textColor} flex-1`}>{message}</p>
      <button
        onClick={() => {
          setIsVisible(false);
          onClose?.();
        }}
        className={`${cfg.textColor} hover:opacity-70`}
      >
        <X size={18} />
      </button>
    </div>
  );
}
