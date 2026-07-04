import {
  Area,
  AreaChart,
  CartesianGrid,
  ReferenceArea,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis
} from 'recharts';

const RATING_BANDS = [
  { from: 0, to: 1199, label: 'Newbie', className: 'band-newbie' },
  { from: 1200, to: 1399, label: 'Pupil', className: 'band-pupil' },
  { from: 1400, to: 1599, label: 'Specialist', className: 'band-specialist' },
  { from: 1600, to: 1899, label: 'Expert', className: 'band-expert' },
  { from: 1900, to: 2199, label: 'Master', className: 'band-master' },
  { from: 2200, to: 2399, label: 'IM', className: 'band-im' },
  { from: 2400, to: 3000, label: 'GM', className: 'band-gm' }
];

const formatShortDate = (value) => {
  const date = new Date(value);

  if (Number.isNaN(date.getTime())) {
    return value;
  }

  return date.toLocaleDateString(undefined, {
    month: 'short',
    day: 'numeric'
  });
};

function RatingGraph({ data = [] }) {
  if (!data.length) {
    return (
      <div className="empty-chart">
        No rating history yet. Play a few rated rounds to start building your graph.
      </div>
    );
  }

  const maxRating = Math.max(...data.map((item) => item.rating || 0), 1200);
  const yMax = Math.max(1400, Math.ceil((maxRating + 100) / 100) * 100);

  return (
    <div className="rating-graph-wrap">
      <ResponsiveContainer width="100%" height={320}>
        <AreaChart data={data} margin={{ top: 8, right: 18, left: 0, bottom: 4 }}>
          {RATING_BANDS.map((band) => (
            <ReferenceArea
              key={band.label}
              y1={band.from}
              y2={Math.min(band.to, yMax)}
              className={band.className}
              ifOverflow="extendDomain"
            />
          ))}

          <CartesianGrid stroke="#bfd0db" strokeDasharray="2 2" />
          <XAxis
            dataKey="date"
            tickFormatter={formatShortDate}
            tick={{ fontSize: 11, fill: '#52606d' }}
            axisLine={{ stroke: '#9fb2c3' }}
            tickLine={{ stroke: '#9fb2c3' }}
          />
          <YAxis
            domain={[0, yMax]}
            tick={{ fontSize: 11, fill: '#52606d' }}
            axisLine={{ stroke: '#9fb2c3' }}
            tickLine={{ stroke: '#9fb2c3' }}
            width={56}
          />
          <Tooltip
            formatter={(value) => [value, 'Rating']}
            labelFormatter={(label) => `Date: ${formatShortDate(label)}`}
            contentStyle={{
              border: '1px solid #b8c7d4',
              background: '#ffffff',
              borderRadius: 0,
              fontSize: '12px'
            }}
          />
          <Area
            type="monotone"
            dataKey="rating"
            stroke="#f0b429"
            fill="rgba(240, 180, 41, 0.18)"
            strokeWidth={2}
            dot={{ r: 3, stroke: '#f0b429', strokeWidth: 2, fill: '#ffffff' }}
            activeDot={{ r: 5, stroke: '#d97706', strokeWidth: 2, fill: '#ffffff' }}
          />
        </AreaChart>
      </ResponsiveContainer>
    </div>
  );
}

export default RatingGraph;