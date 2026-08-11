import { Calendar } from 'lucide-react';

const RANGES = [
  { value: 'today', label: 'Today' },
  { value: 'yesterday', label: 'Yesterday' },
  { value: 'last7days', label: 'Last 7 Days' },
  { value: 'thisMonth', label: 'This Month' },
  { value: 'custom', label: 'Custom' },
];

/**
 * Segmented date-range picker used above tables/reports. Falls back to a
 * plain select on very narrow screens where a pill row would wrap awkwardly.
 */
const DateRangeFilter = ({ dateFilter, setDateFilter, onFilterChange }) => {
  return (
    <div className="flex flex-col gap-3">
      <div className="flex items-center gap-3 flex-wrap">
        <div className="segmented">
          {RANGES.map((r) => (
            <button
              key={r.value}
              type="button"
              onClick={() => {
                setDateFilter({ ...dateFilter, range: r.value });
                onFilterChange?.();
              }}
              className={dateFilter.range === r.value ? 'segmented-item-active' : 'segmented-item'}
            >
              {r.label}
            </button>
          ))}
        </div>

        {dateFilter.range === 'custom' && (
          <div className="flex items-center gap-2 flex-wrap">
            <div className="relative">
              <Calendar size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-ink-faint pointer-events-none" />
              <input
                type="date"
                className="input pl-9 w-auto"
                value={dateFilter.startDate}
                onChange={(e) => {
                  setDateFilter({ ...dateFilter, startDate: e.target.value });
                  onFilterChange?.();
                }}
                aria-label="Start date"
              />
            </div>
            <span className="text-ink-faint text-sm">to</span>
            <div className="relative">
              <Calendar size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-ink-faint pointer-events-none" />
              <input
                type="date"
                className="input pl-9 w-auto"
                value={dateFilter.endDate}
                onChange={(e) => {
                  setDateFilter({ ...dateFilter, endDate: e.target.value });
                  onFilterChange?.();
                }}
                aria-label="End date"
              />
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default DateRangeFilter;
