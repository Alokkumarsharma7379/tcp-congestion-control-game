import { Link, useOutletContext } from 'react-router-dom';

import { formatDate, getGameLabel } from '../../utils/dashboard';

function DashboardGames() {
  const { sessions } = useOutletContext();

  return (
    <>
      <section className="panel elevated-panel">
        <div className="panel-header">▶ Available Games</div>
        <div className="panel-body">
          <div className="cf-games-grid">
            <div className="cf-game-card">
              <h4>TCP Congestion Control</h4>
              <p>
                Steer a sender's rate through shared bandwidth, avoid buffer
                overflow, and beat the AIMD ghost.
              </p>
              <Link className="cf-btn primary" to="/game">
                ▶ Play now
              </Link>
            </div>

            <div className="cf-game-card disabled">
              <h4>More games coming soon</h4>
              <p>
                Additional CS-simulation games will show up here as they ship —
                each with its own rating pool and leaderboard.
              </p>
            </div>
          </div>
        </div>
      </section>

      <section className="panel elevated-panel">
        <div className="panel-header">▶ Match History</div>
        <div className="panel-body">
          {sessions.length === 0 ? (
            <p>No games played yet. Jump into a round to start building your history.</p>
          ) : (
            <table className="cf-table">
              <thead>
                <tr>
                  <th>Game</th>
                  <th className="right">Score</th>
                  <th className="right">Peak Window</th>
                  <th className="right">Timeouts</th>
                  <th className="right">Duration</th>
                  <th>Played</th>
                </tr>
              </thead>
              <tbody>
                {sessions.map((session) => (
                  <tr key={session._id}>
                    <td>{getGameLabel(session.gameType)}</td>
                    <td className="value-cell">{Math.round(session.score)}</td>
                    <td className="value-cell">{session.peakWindowSize ?? '—'}</td>
                    <td className="value-cell">{session.timeoutsCount ?? '—'}</td>
                    <td className="value-cell">{session.durationInSeconds ?? '—'}s</td>
                    <td>{formatDate(session.playedAt)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      </section>
    </>
  );
}

export default DashboardGames;