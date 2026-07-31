import { Link } from 'react-router-dom';

const MEDAL = { 1: '🥇', 2: '🥈', 3: '🥉' };

function ContestResultsModal({ results, currentUserId, roomCode }) {
  const podium = results.slice(0, 3);
  const rest = results.slice(3);

  const withStats = (entry) => {
    const totalAttempted = entry.packetsAcked + entry.lossCount;
    const efficiency = totalAttempted > 0 ? (entry.packetsAcked / totalAttempted) * 100 : 0;
    const lossRate = totalAttempted > 0 ? (entry.lossCount / totalAttempted) * 100 : 0;
    return { ...entry, efficiency, lossRate };
  };

  return (
    <div className="results-overlay">
      <div className="results-card contest-results-card">
        <h3>🏁 Contest Results</h3>

        <div className="contest-podium">
          {podium.map((entry) => (
            <div
              key={entry.userId}
              className={`contest-podium-slot podium-${entry.rank} ${
                String(entry.userId) === String(currentUserId) ? 'is-mine' : ''
              }`}
            >
              <div className="contest-podium-medal">{MEDAL[entry.rank] || entry.rank}</div>
              <div className="contest-podium-name">{entry.username}</div>
              <div className="contest-podium-score">{Math.round(entry.score)} pts</div>
            </div>
          ))}
        </div>

        <table className="cf-table contest-results-table">
          <thead>
            <tr>
              <th>Rank</th>
              <th>Player</th>
              <th className="right">Score</th>
              <th className="right">Delivered</th>
              <th className="right">Loss %</th>
              <th className="right">Efficiency</th>
            </tr>
          </thead>
          <tbody>
            {[...podium, ...rest].map((rawEntry) => {
              const entry = withStats(rawEntry);
              const isMine = String(entry.userId) === String(currentUserId);

              return (
                <tr key={entry.userId} className={isMine ? 'contest-row-mine' : ''}>
                  <td>{entry.rank}</td>
                  <td>{entry.username}</td>
                  <td className="value-cell">{Math.round(entry.score)}</td>
                  <td className="value-cell">{entry.packetsAcked}</td>
                  <td className="value-cell">{entry.lossRate.toFixed(1)}%</td>
                  <td className="value-cell">{entry.efficiency.toFixed(1)}%</td>
                </tr>
              );
            })}
          </tbody>
        </table>

        <div className="contest-results-actions">
          <Link className="cf-btn" to={`/contest/${roomCode}/lobby`}>
            Back to Lobby
          </Link>
          <Link className="cf-btn primary" to="/contest/host">
            Host a New Contest
          </Link>
        </div>
      </div>
    </div>
  );
}

export default ContestResultsModal;