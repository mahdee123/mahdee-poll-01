const DateRangeFilter = ({ dateFilter, setDateFilter, onFilterChange }) => {
  return (
    <div className="flex flex-col gap-3">
      <div className="flex items-center gap-3 flex-wrap">
        <select 
          className="border rounded-lg px-3 py-2"
          value={dateFilter.range}
          onChange={(e) => {
            setDateFilter({ ...dateFilter, range: e.target.value });
            onFilterChange?.();
          }}
        >
          <option value="today">Today</option>
          <option value="yesterday">Yesterday</option>
          <option value="last7days">Last 7 Days</option>
          <option value="thisMonth">This Month</option>
          <option value="custom">Custom</option>
        </select>

        {dateFilter.range === 'custom' && (
          <>
            <input
              type="date"
              className="border rounded-lg px-3 py-2"
              value={dateFilter.startDate}
              onChange={(e) => {
                setDateFilter({ ...dateFilter, startDate: e.target.value });
                onFilterChange?.();
              }}
              placeholder="Start Date"
            />
            <input
              type="date"
              className="border rounded-lg px-3 py-2"
              value={dateFilter.endDate}
              onChange={(e) => {
                setDateFilter({ ...dateFilter, endDate: e.target.value });
                onFilterChange?.();
              }}
              placeholder="End Date"
            />
          </>
        )}
      </div>
    </div>
  );
};

export default DateRangeFilter;
