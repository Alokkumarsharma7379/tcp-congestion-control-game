const DAY_NAMES = ['Mon', 'Tue', 'Wed', 'Thr', 'Fri', 'Sat', 'Sun'];
const MONTH_NAMES = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

const toKey = (date) => {
  const local = new Date(date);
  const year = local.getFullYear();
  const month = `${local.getMonth() + 1}`.padStart(2, '0');
  const day = `${local.getDate()}`.padStart(2, '0');

  return `${year}-${month}-${day}`;
};

const getLevel = (count) => {
  if (count <= 0) return 0;
  if (count === 1) return 1;
  if (count <= 3) return 2;
  if (count <= 6) return 3;
  return 4;
};

const buildHeatmapMatrix = (entries) => {
  const map = new Map(entries.map((entry) => [entry.date, entry]));
  const today = new Date();
  const days = [];

  for (let i = 364; i >= 0; i -= 1) {
    const date = new Date(today);
    date.setDate(today.getDate() - i);
    days.push(date);
  }

  const first = new Date(days[0]);
  const firstDay = (first.getDay() + 6) % 7;

  for (let i = 0; i < firstDay; i += 1) {
    days.unshift(null);
  }

  const weeks = [];
  for (let i = 0; i < days.length; i += 7) {
    weeks.push(days.slice(i, i + 7));
  }

  const monthLabels = weeks.map((week) => {
    const firstRealDay = week.find(Boolean);
    return firstRealDay ? MONTH_NAMES[firstRealDay.getMonth()] : '';
  });

  return {
    weeks,
    monthLabels,
    getCellData(date) {
      if (!date) return null;
      return map.get(toKey(date)) || null;
    }
  };
};

function HeatmapGrid({ entries = [] }) {
  const { weeks, monthLabels, getCellData } = buildHeatmapMatrix(entries);

  return (
    <div className="heatmap-wrap">
      <div className="heatmap-months">
        <div className="heatmap-side-gap" />
        <div className="heatmap-month-row">
          {monthLabels.map((label, index) => (
            <div key={`${label}-${index}`} className="heatmap-month-label">
              {index === 0 || monthLabels[index - 1] !== label ? label : ''}
            </div>
          ))}
        </div>
      </div>

      <div className="heatmap-grid-block">
        <div className="heatmap-day-labels">
          {DAY_NAMES.map((label, index) => (
            <div key={`${label}-${index}`} className="heatmap-day-label">
              {label}
            </div>
          ))}
        </div>

        <div className="heatmap-weeks">
          {weeks.map((week, weekIndex) => (
            <div className="heatmap-week" key={`week-${weekIndex}`}>
              {week.map((date, dayIndex) => {
                const cell = getCellData(date);
                const count = cell?.count || 0;
                const totalScore = cell?.totalScore || 0;
                const level = getLevel(count);

                return (
                  <div
                    key={`${weekIndex}-${dayIndex}`}
                    className={`heatmap-cell level-${level}`}
                    title={
                      date
                        ? `${toKey(date)} — ${count} game${count === 1 ? '' : 's'}, score ${totalScore}`
                        : ''
                    }
                  />
                );
              })}
            </div>
          ))}
        </div>
      </div>

      <div className="heatmap-legend">
        <span>Less</span>
        <div className="heatmap-cell level-0" />
        <div className="heatmap-cell level-1" />
        <div className="heatmap-cell level-2" />
        <div className="heatmap-cell level-3" />
        <div className="heatmap-cell level-4" />
        <span>More</span>
      </div>
    </div>
  );
}

export default HeatmapGrid;