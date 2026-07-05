import { useEffect, useMemo, useState } from 'react';
import { Link, NavLink, Outlet } from 'react-router-dom';

import { getGameHistory } from '../api/gameApi';
import { uploadAvatar } from '../api/userApi';
import { useAuth } from '../context/AuthContext';
import {
  getInitials,
  isWithinLastDays,
  sumCounts
} from '../utils/dashboard';

import '../styles/codeforces.css';

const DASHBOARD_TABS = [
  { to: '/dashboard', label: 'Profile', end: true, showAsUsername: true },
  { to: '/dashboard/settings', label: 'Settings' },
  { to: '/dashboard/blog', label: 'Blog' },
  { to: '/dashboard/teams', label: 'Teams' },
  { to: '/dashboard/groups', label: 'Groups' },
  { to: '/dashboard/games', label: 'Games' }
];

const tabClassName = ({ isActive }) => (isActive ? 'active' : undefined);

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

  const outletContext = {
    account,
    profile,
    heatmap,
    summary,
    sessions,
    friendCount,
    uploading,
    uploadError,
    handleAvatarChange
  };

  return (
    <main className="content cf-dashboard-page">
      <section className="cf-profile-tabs">
        {DASHBOARD_TABS.map((tab) => (
          <NavLink key={tab.to} to={tab.to} end={tab.end} className={tabClassName}>
            {tab.showAsUsername ? account.username : tab.label}
          </NavLink>
        ))}
      </section>

      <section className="cf-profile-layout">
        <div className="cf-profile-main">
          <Outlet context={outletContext} />
        </div>

        <aside className="cf-profile-sidebar">
          <section className="cf-side-box">
            <div className="cf-side-title">→ {account.username}</div>

            <div className="cf-mini-profile">
              <div>
                <p>Rating: <b>{account.rating}</b></p>
                <p>Contribution: <b>{account.contribution || 0}</b></p>

                <ul>
                  {DASHBOARD_TABS.map((tab) => (
                    <li key={tab.to}>
                      <NavLink to={tab.to} end={tab.end} className={tabClassName}>
                        {tab.showAsUsername ? account.username : tab.label}
                      </NavLink>
                    </li>
                  ))}
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
                    Score {session.score} · {new Date(session.playedAt).toLocaleDateString()}
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