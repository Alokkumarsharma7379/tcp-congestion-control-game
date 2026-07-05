// components/ui/StatCard.jsx
function StatCard({ icon, label, value, hint, accent = 'blue' }) {
  return (
    <div className={`stat-card stat-card-${accent}`}>
      <div className="stat-card-icon">{icon}</div>
      <div className="stat-card-body">
        <div className="stat-card-value">{value}</div>
        <div className="stat-card-label">{label}</div>
        {hint && <div className="stat-card-hint">{hint}</div>}
      </div>
    </div>
  );
}

export default StatCard;