import { Link } from 'react-router-dom';
import '../styles/codeforces.css';

function DashboardPage() {
  return (
    <div className="content">
      <h2 style={{ color: '#1a5276' }}>Dashboard</h2>
      <p>Profile summary and recent activity will appear here.</p>
      <p><Link to="/game">Play another round ➜</Link></p>
    </div>
  );
}

export default DashboardPage;