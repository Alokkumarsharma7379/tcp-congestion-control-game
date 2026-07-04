import { Link } from 'react-router-dom';

import { useAuth } from '../context/AuthContext';
import RatingGraph from '../components/ui/RatingGraph';
import HeatmapGrid from '../components/ui/HeatmapGrid';
import '../styles/codeforces.css';

const isWithinLastDays = (dateString, days) => {
  const date = new Date(dateString);
  const now = new Date();
  const cutoff = new Date(now);
  cutoff.setDate(now.getDate() - days);

  return date >= cutoff;
};

const sumCounts = (rows) => rows.reduce((sum, row) => sum + (row.count || 0), 0);

const sumScores = (rows) => rows.reduce((sum, row) => sum + (row.totalScore || 0), 0);

function DashboardPage() {
  const { user, profile, isAuthenticated, booting } = useAuth();

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

  const heatmap = profile?.heatmap || [];
  const ratingHistory = profile?.user?.ratingHistory || user?.ratingHistory || [];

  const last30 = heatmap.filter((row) => isWithinLastDays(row.date, 30));
  const last365 = heatmap.filter((row) => isWithinLastDays(row.date, 365));

  const stats = {
    totalGames: sumCounts(heatmap),
    yearlyGames: sumCounts(last365),
    monthlyGames: sumCounts(last30),
    activeDaysAllTime: heatmap.length,
    activeDaysYear: last365.length,
    activeDaysMonth: last30.length,
    totalScoreAllTime: sumScores(heatmap),
    totalScoreMonth: sumScores(last30)
  };

  return (
    <main className="content page-fade">
      <section className="hero-panel">
        <div>
          <span className="eyebrow">Player Dashboard</span>
          <h2>{user.username}</h2>
          <p>
            Track your rating progress, daily game activity, and session streaks.
          </p>
        </div>

        <div className="hero-meta-card">
          <span>Current Rating</span>
          <strong>{user.rating}</strong>
          <small>{user.rank}</small>
        </div>
      </section>

      <section className="dashboard-grid enhanced-dashboard-grid">
        <div className="stat-card">
          <span>Rank</span>
          <strong>{user.rank}</strong>
        </div>

        <div className="stat-card">
          <span>Current Streak</span>
          <strong>{user.currentStreak}</strong>
        </div>

        <div className="stat-card">
          <span>Max Yearly Streak</span>
          <strong>{user.maxYearlyStreak}</strong>
        </div>

        <div className="stat-card">
          <span>Games This Month</span>
          <strong>{user.gamesPlayedThisMonth}</strong>
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

      <section className="summary-stats-grid">
        <div className="summary-stat">
          <strong>{stats.totalGames}</strong>
          <span>games played all time</span>
        </div>

        <div className="summary-stat">
          <strong>{stats.yearlyGames}</strong>
          <span>games played in the last year</span>
        </div>

        <div className="summary-stat">
          <strong>{stats.monthlyGames}</strong>
          <span>games played in the last month</span>
        </div>

        <div className="summary-stat">
          <strong>{stats.activeDaysAllTime}</strong>
          <span>active days all time</span>
        </div>

        <div className="summary-stat">
          <strong>{stats.activeDaysYear}</strong>
          <span>active days in the last year</span>
        </div>

        <div className="summary-stat">
          <strong>{stats.activeDaysMonth}</strong>
          <span>active days in the last month</span>
        </div>
      </section>
    </main>
  );
}

export default DashboardPage;