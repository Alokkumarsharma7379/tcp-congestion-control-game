import { useOutletContext } from 'react-router-dom';

import HeatmapGrid from '../../components/ui/HeatmapGrid';
import RatingGraph from '../../components/ui/RatingGraph';
import {
  buildRatingHistoryFromSessions,
  formatDate,
  formatShortDate,
  getInitials
} from '../../utils/dashboard';

function DashboardOverview() {
  const {
    account,
    profile,
    heatmap,
    summary,
    sessions,
    friendCount,
    uploading,
    uploadError,
    handleAvatarChange
  } = useOutletContext();

  const ratingHistory =
    profile?.ratingHistory?.length > 0
      ? profile.ratingHistory
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

          <div className="cf-detail-list">
            <div>
              <span className="cf-icon">📈</span>
              <strong>Contest rating:</strong>
              <b className="cf-rating-value">{account.rating}</b>
              <span> max. {account.rank?.toLowerCase()}, {account.rating}</span>
            </div>

            <div>
              <span className="cf-icon">⭐</span>
              <strong>Contribution:</strong>
              <b>{account.contribution || 0}</b>
            </div>

            <div>
              <span className="cf-icon">🤝</span>
              <strong>Friend of:</strong>
              <b>{friendCount}</b>
              <span> users</span>
            </div>

            <div>
              <span className="cf-icon">🔥</span>
              <strong>Current streak:</strong>
              <b>{account.currentStreak || 0}</b>
              <span> days</span>
            </div>

            <div>
              <span className="cf-icon">📅</span>
              <strong>Games this month:</strong>
              <b>{account.gamesPlayedThisMonth || 0}</b>
            </div>

            <div>
              <span className="cf-icon">✉️</span>
              <strong>Email:</strong>
              <span>{account.email} (not visible)</span>
            </div>

            <div>
              <span className="cf-icon">🟢</span>
              <strong>Last visit:</strong>
              <span>{formatDate(account.lastVisit)}</span>
            </div>

            <div>
              <span className="cf-icon">📝</span>
              <strong>Registered:</strong>
              <span>{formatShortDate(account.createdAt)}</span>
            </div>
          </div>
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

      <section className="panel elevated-panel">
        <div className="panel-header">▶ Rating Progress</div>
        <div className="panel-body">
          <RatingGraph data={ratingHistory} />
        </div>
      </section>

      <section className="panel elevated-panel">
        <div className="panel-header">▶ Activity Heatmap</div>
        <div className="panel-body">
          <HeatmapGrid entries={heatmap} />
        </div>
      </section>

      <section className="cf-summary-row">
        <div>
          <strong>{summary.allTimeGames}</strong>
          <span>games played all time</span>
        </div>

        <div>
          <strong>{summary.yearlyGames}</strong>
          <span>games played in the last year</span>
        </div>

        <div>
          <strong>{summary.monthlyGames}</strong>
          <span>games played in the last month</span>
        </div>

        <div>
          <strong>{summary.activeDaysAllTime}</strong>
          <span>active days all time</span>
        </div>

        <div>
          <strong>{summary.activeDaysYear}</strong>
          <span>active days in the last year</span>
        </div>

        <div>
          <strong>{summary.activeDaysMonth}</strong>
          <span>active days in the last month</span>
        </div>
      </section>
    </>
  );
}

export default DashboardOverview;