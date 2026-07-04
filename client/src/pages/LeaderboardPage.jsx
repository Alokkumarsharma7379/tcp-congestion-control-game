import { Link } from 'react-router-dom';
import '../styles/codeforces.css';

function LeaderboardPage() {
  return (
    <div className="content">
      <h2 style={{ color: '#1a5276' }}>Leaderboard</h2>
      <p>Global rankings coming soon…</p>
      <p><Link to="/game">Back to Game</Link></p>
    </div>
  );
}

export default LeaderboardPage;