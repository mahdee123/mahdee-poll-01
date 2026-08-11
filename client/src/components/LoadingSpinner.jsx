/**
 * Async feedback. `inline` renders a compact row for use inside cards/tables.
 */
export default function LoadingSpinner({ message = 'Loading…', inline = false }) {
  const spinner = (
    <span
      className={`${inline ? 'w-4 h-4 border-2' : 'w-8 h-8 border-[3px]'} rounded-full border-line border-t-primary animate-spin flex-shrink-0`}
      aria-hidden="true"
    />
  );

  if (inline) {
    return (
      <span className="inline-flex items-center gap-2 text-sm text-ink-soft" role="status">
        {spinner}
        {message}
      </span>
    );
  }

  return (
    <div className="flex flex-col items-center justify-center py-12 gap-3" role="status">
      {spinner}
      <p className="text-sm text-ink-soft">{message}</p>
    </div>
  );
}
