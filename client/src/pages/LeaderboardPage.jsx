// top of file
import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';

import { getGlobalLeaderboard } from '../api/leaderboardApi';
import '../styles/codeforces.css';


function LeaderboardPage() {
  const [rankings, setRankings] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    let cancelled = false;

    const loadLeaderboard = async () => {
      try {
        const response = await getGlobalLeaderboard();

        if (!cancelled) {
          setRankings(response.data.rankings || []);
        }
      } catch (err) {
        if (!cancelled) {
          setError(err.message || 'Failed to load leaderboard.');
        }
      } finally {
        if (!cancelled) {
          setLoading(false);
        }
      }
    };

    loadLeaderboard();

    return () => {
      cancelled = true;
    };
  }, []);

  return (
    <main className="content">
      <section className="page-title-block">
        <h2>Global Leaderboard</h2>
        <p>Players are ranked by current TCP game rating.</p>
      </section>

      <section className="panel">
        <div className="panel-header">▶ Rankings</div>

        <div className="panel-body">
          {loading && <p className="muted-text">Loading leaderboard...</p>}
          {error && <div className="form-error">{error}</div>}

          {!loading && !error && (
            <table className="cf-table">
              <thead>
                <tr>
                  <th>#</th>
                  <th>User</th>
                  <th>Full Name</th>
                  <th className="right">Rating</th>
                  <th>Rank</th>
                </tr>
              </thead>

              <tbody>
                {rankings.map((entry, index) => (
                  <tr key={entry.userId || entry.username}>
                    <td>{index + 1}</td>
                    <td><Link to={`/u/${entry.username}`}>{entry.username}</Link></td>
                    <td>{entry.fullName || '—'}</td>
                    <td className="value-cell">{entry.rating}</td>
                    <td>{entry.rank}</td>
                  </tr>
                ))}

                {rankings.length === 0 && (
                  <tr>
                    <td colSpan="5" className="empty-log">
                      No players yet.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          )}
        </div>
      </section>
    </main>
  );
}

export default LeaderboardPage;