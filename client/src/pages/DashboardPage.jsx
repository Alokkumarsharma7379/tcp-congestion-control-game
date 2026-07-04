import { Link } from 'react-router-dom';

import { useAuth } from '../context/AuthContext';
import '../styles/codeforces.css';

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
          <Link className="cf-btn primary" to="/login">Login</Link>
        </section>
      </main>
    );
  }

  const heatmap = profile?.heatmap || [];

  return (
    <main className="content">
      <section className="page-title-block">
        <h2>{user.username}'s Dashboard</h2>
        <p>Rating, rank, streaks, and activity summary.</p>
      </section>

      <section className="dashboard-grid">
        <div className="stat-card">
          <span>Rating</span>
          <strong>{user.rating}</strong>
        </div>

        <div className="stat-card">
          <span>Rank</span>
          <strong>{user.rank}</strong>
        </div>

        <div className="stat-card">
          <span>Current Streak</span>
          <strong>{user.currentStreak}</strong>
        </div>

        <div className="stat-card">
          <span>Games This Month</span>
          <strong>{user.gamesPlayedThisMonth}</strong>
        </div>
      </section>

      <section className="panel">
        <div className="panel-header">▶ Activity Heatmap</div>

        <div className="panel-body">
          {heatmap.length === 0 ? (
            <p className="muted-text">No activity yet. Play a game to start building your history.</p>
          ) : (
            <table className="cf-table">
              <thead>
                <tr>
                  <th>Date</th>
                  <th>Games</th>
                  <th>Total Score</th>
                </tr>
              </thead>

              <tbody>
                {heatmap.map((day) => (
                  <tr key={day.date}>
                    <td>{day.date}</td>
                    <td>{day.count}</td>
                    <td>{day.totalScore}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      </section>
    </main>
  );
}

export default DashboardPage;