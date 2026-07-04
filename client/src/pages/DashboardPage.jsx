import { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';

import { getGameHistory } from '../api/gameApi';
import { uploadAvatar } from '../api/userApi';
import HeatmapGrid from '../components/ui/HeatmapGrid';
import RatingGraph from '../components/ui/RatingGraph';
import { useAuth } from '../context/AuthContext';

import '../styles/codeforces.css';

const getInitials = (username = '') => {
  return username.charAt(0).toUpperCase() || '?';
};

const formatDate = (value) => {
  if (!value) return '—';

  const date = new Date(value);

  if (Number.isNaN(date.getTime())) {
    return '—';
  }

  return date.toLocaleString();
};

const formatShortDate = (value) => {
  if (!value) return '—';

  const date = new Date(value);

  if (Number.isNaN(date.getTime())) {
    return '—';
  }

  return date.toLocaleDateString();
};

const isWithinLastDays = (dateString, days) => {
  const date = new Date(dateString);
  const now = new Date();
  const cutoff = new Date(now);

  cutoff.setDate(now.getDate() - days);

  return date >= cutoff;
};

const sumCounts = (rows) => {
  return rows.reduce((sum, row) => sum + (row.count || 0), 0);
};

const buildRatingHistoryFromSessions = (sessions) => {
  return [...sessions]
    .reverse()
    .map((session) => {
      const rating =
        session.newRating ||
        session.ratingAfter ||
        session.performanceRating ||
        session.score;

      return {
        date: session.playedAt || session.createdAt,
        rating
      };
    })
    .filter((point) => Number.isFinite(point.rating));
};

function DashboardPage() {
  const {
    user,
    profile,
    isAuthenticated,
    booting,
    refreshProfile
  } = useAuth();

  const [sessions, setSessions] = useState([]);
  const [uploading, setUploading] = useState(false);
  const [uploadError, setUploadError] = useState('');

  useEffect(() => {
    if (!isAuthenticated) return;

    let cancelled = false;

    const loadHistory = async () => {
      try {
        const response = await getGameHistory({ page: 1, limit: 50 });

        if (!cancelled) {
          setSessions(response.data.sessions || []);
        }
      } catch {
        if (!cancelled) {
          setSessions([]);
        }
      }
    };

    loadHistory();

    return () => {
      cancelled = true;
    };
  }, [isAuthenticated]);

  if (booting) {
    return (
      <main className="content">
        <section className="page-title-block">
          <h2>Dashboard</h2>
          <p>Loading your profile...</p>
        </section>
      </main>
    );
  }

  if (!isAuthenticated) {
    return (
      <main className="content">
        <section className="page-title-block">
          <h2>Dashboard</h2>
          <p>You need to login before viewing your dashboard.</p>
          <Link className="cf-btn primary" to="/login">
            Login
          </Link>
        </section>
      </main>
    );
  }

  const account = profile?.user || user;
  const heatmap = profile?.heatmap || [];

  const ratingHistory =
    profile?.ratingHistory?.length > 0
      ? profile.ratingHistory
      : buildRatingHistoryFromSessions(sessions);

  const last30 = heatmap.filter((row) => isWithinLastDays(row.date, 30));
  const last365 = heatmap.filter((row) => isWithinLastDays(row.date, 365));

  const friendCount = Array.isArray(account.friends) ? account.friends.length : 0;

  const summary = useMemo(
    () => ({
      allTimeGames: sumCounts(heatmap),
      yearlyGames: sumCounts(last365),
      monthlyGames: sumCounts(last30),
      activeDaysAllTime: heatmap.length,
      activeDaysYear: last365.length,
      activeDaysMonth: last30.length
    }),
    [heatmap, last365, last30]
  );

  const handleAvatarChange = async (event) => {
    const file = event.target.files?.[0];

    if (!file) return;

    setUploading(true);
    setUploadError('');

    try {
      await uploadAvatar(file);
      await refreshProfile();
    } catch (error) {
      setUploadError(error.message || 'Failed to upload profile picture.');
    } finally {
      setUploading(false);
      event.target.value = '';
    }
  };

  return (
    <main className="content cf-dashboard-page">
      <section className="cf-profile-tabs">
        <span className="active">{account.username}</span>
        <span>Settings</span>
        <span>Lists</span>
        <span>Blog</span>
        <span>Teams</span>
        <span>Submissions</span>
        <span>Favourites</span>
        <span>Groups</span>
        <span>Contests</span>
      </section>

      <section className="cf-profile-layout">
        <div className="cf-profile-main">
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
        </div>

        <aside className="cf-profile-sidebar">
          <section className="cf-side-box">
            <div className="cf-side-title">→ {account.username}</div>

            <div className="cf-mini-profile">
              <div>
                <p>Rating: <b>{account.rating}</b></p>
                <p>Contribution: <b>{account.contribution || 0}</b></p>

                <ul>
                  <li>Settings</li>
                  <li>Blog</li>
                  <li>Teams</li>
                  <li>Submissions</li>
                  <li>Favourites</li>
                  <li>Groups</li>
                  <li>Contests</li>
                </ul>
              </div>

              <div className="cf-mini-avatar">
                {account.avatarUrl ? (
                  <img src={account.avatarUrl} alt="" />
                ) : (
                  getInitials(account.username)
                )}
              </div>
            </div>
          </section>

          <section className="cf-side-box">
            <div className="cf-side-title">→ Training Status</div>

            <div className="cf-side-content">
              <p><b>{account.rank}</b></p>
              <p>Current rating: {account.rating}</p>
              <p>Max yearly streak: {account.maxYearlyStreak || 0}</p>
              <p>Total streak score: {account.totalStreak || 0}</p>
            </div>
          </section>

          <section className="cf-side-box">
            <div className="cf-side-title">→ Recent Activity</div>

            <div className="cf-side-content">
              {sessions.length === 0 ? (
                <p>No recent sessions yet.</p>
              ) : (
                sessions.slice(0, 5).map((session) => (
                  <p key={session._id}>
                    Score {session.score} · {formatShortDate(session.playedAt)}
                  </p>
                ))
              )}
            </div>
          </section>
        </aside>
      </section>
    </main>
  );
}

export default DashboardPage;