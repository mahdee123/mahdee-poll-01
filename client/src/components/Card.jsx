/**
 * Reusable Card component
 * Standardized with shadow, border, and rounded corners
 */
export default function Card({ children, className = '', header = null, title = null, icon: Icon = null }) {
  return (
    <div className={`bg-white rounded-lg shadow-lg border border-gray-100 p-6 ${className}`}>
      {header && (
        <div className="mb-6 pb-4 border-b border-gray-200">
          {header}
        </div>
      )}
      
      {(title || Icon) && !header && (
        <div className="flex items-center gap-3 mb-6">
          {Icon && <Icon className="w-6 h-6 text-primary" />}
          {title && <h2 className="text-xl font-bold text-gray-800">{title}</h2>}
        </div>
      )}
      
      {children}
    </div>
  );
}
