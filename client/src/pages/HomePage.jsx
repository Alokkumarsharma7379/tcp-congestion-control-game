import { Link } from 'react-router-dom';
import '../styles/codeforces.css';

function HomePage() {
  return (
    <div className="content">
      <h2 style={{ color: '#1a5276' }}>TCP Edu Platform</h2>
      <p>Choose an action:</p>
      <ul>
        <li><Link to="/game">Play the Game</Link></li>
        <li><Link to="/login">Log In</Link></li>
        <li><Link to="/register">Register</Link></li>
        <li><Link to="/dashboard">Dashboard</Link></li>
        <li><Link to="/leaderboard">Leaderboard</Link></li>
      </ul>
    </div>
  );
}

export default HomePage;