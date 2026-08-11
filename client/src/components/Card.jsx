/**
 * Shared surface. Renders the same `.card` class the rest of the app uses,
 * so component-built and class-built cards stay identical.
 */
export default function Card({
  children,
  className = '',
  header = null,
  title = null,
  subtitle = null,
  actions = null,
  icon: Icon = null,
  padded = true,
}) {
  const hasHeading = header || title || Icon || actions;

  return (
    <div className={`card ${className}`}>
      {hasHeading && (
        <div className="flex items-start justify-between gap-4 px-5 py-4 border-b border-line">
          {header || (
            <>
              <div className="flex items-center gap-2.5 min-w-0">
                {Icon && <Icon size={18} className="text-primary flex-shrink-0" />}
                <div className="min-w-0">
                  {title && <h2 className="section-title truncate">{title}</h2>}
                  {subtitle && <p className="muted mt-0.5">{subtitle}</p>}
                </div>
              </div>
              {actions && <div className="flex items-center gap-2 flex-shrink-0">{actions}</div>}
            </>
          )}
        </div>
      )}
      <div className={padded ? 'p-5' : ''}>{children}</div>
    </div>
  );
}
