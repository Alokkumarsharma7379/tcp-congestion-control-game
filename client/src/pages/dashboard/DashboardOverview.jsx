import { useOutletContext } from 'react-router-dom';

import HeatmapGrid from '../../components/ui/HeatmapGrid';
import RatingGraph from '../../components/ui/RatingGraph';
import StatCard from '../../components/ui/StatCard';
import {
  buildRatingHistoryFromSessions,
  formatDate,
  formatShortDate,
  getInitials
} from '../../utils/dashboard';

function DashboardOverview() {
  const {
    account,
    heatmap,
    ratingHistory,
    sessions,
    friendCount,
    uploading,
    uploadError,
    handleAvatarChange
  } = useOutletContext();

  const chartData =
    ratingHistory.length > 0
      ? ratingHistory
      : buildRatingHistoryFromSessions(sessions);

  return (
    <>
      <section className="cf-profile-card">
        <div className="cf-profile-info">
          <p className="cf-user-rank">{account.rank}</p>
          <h2>{account.username}</h2>

          <p className="cf-user-line">
            {account.fullName || 'Unnamed player'}
            {account.country ? (
              <>
                , <span>{account.country}</span>
              </>
            ) : null}
          </p>
        </div>

        <div className="cf-avatar-panel">
          <div className="cf-avatar-box">
            {account.avatarUrl ? (
              <img src={account.avatarUrl} alt={`${account.username} avatar`} />
            ) : (
              <div className="cf-avatar-placeholder">
                {getInitials(account.username)}
              </div>
            )}
          </div>

          <label className="cf-avatar-upload">
            {uploading ? 'Uploading...' : 'Change photo'}
            <input
              type="file"
              accept="image/png,image/jpeg,image/webp"
              onChange={handleAvatarChange}
              disabled={uploading}
            />
          </label>

          {uploadError && <div className="form-error">{uploadError}</div>}
        </div>
      </section>

      <div className="dashboard-grid">
        <StatCard
          icon="📈"
          label="Contest Rating"
          value={account.rating}
          hint={account.rank}
          accent="blue"
        />
        <StatCard
          icon="⭐"
          label="Contribution"
          value={account.contribution || 0}
          accent="orange"
        />
        <StatCard
          icon="🤝"
          label="Friends"
          value={friendCount}
          accent="purple"
        />
        <StatCard
          icon="🔥"
          label="Current Streak"
          value={`${account.currentStreak || 0}d`}
          hint={`Best: ${account.maxYearlyStreak || 0}d`}
          accent="red"
        />
        <StatCard
          icon="🎮"
          label="Games This Month"
          value={account.gamesPlayedThisMonth || 0}
          accent="teal"
        />
        <StatCard
          icon="🟢"
          label="Last Visit"
          value={formatShortDate(account.lastVisit)}
          hint={formatDate(account.lastVisit)}
          accent="green"
        />
        <StatCard
          icon="📝"
          label="Registered"
          value={formatShortDate(account.createdAt)}
          accent="blue"
        />
      </div>

      <section className="panel elevated-panel">
        <div className="panel-header">▶ Rating Progress</div>
        <div className="panel-body">
          <RatingGraph data={chartData} />
        </div>
      </section>

      <section className="panel elevated-panel">
        <div className="panel-header">▶ Activity Heatmap</div>
        <div className="panel-body">
          <HeatmapGrid entries={heatmap} />
        </div>
      </section>
    </>
  );
}

export default DashboardOverview;