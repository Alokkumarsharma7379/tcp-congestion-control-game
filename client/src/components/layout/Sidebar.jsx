import { NavLink } from 'react-router-dom';

import { useAuth } from '../../context/AuthContext';
import RatingBadge from '../ui/RatingBadge';

const SIDEBAR_LINKS = [
  { to: '/', label: 'Home', icon: '🏠', end: true },
  { to: '/game', label: 'Play', icon: '▶' },
  { to: '/leaderboard', label: 'Leaderboard', icon: '🏆' },
  { to: '/dashboard', label: 'Dashboard', icon: '📊' }
];

const navLinkClassName = ({ isActive }) => (isActive ? 'active' : undefined);

function Sidebar() {
  const { user, isAuthenticated } = useAuth();

  return (
    <aside className="app-sidebar">
      <nav className="app-sidebar-nav" aria-label="Quick navigation">
        {SIDEBAR_LINKS.map((link) => (
          <NavLink key={link.to} to={link.to} end={link.end} className={navLinkClassName}>
            <span className="app-sidebar-icon" aria-hidden="true">{link.icon}</span>
            <span className="app-sidebar-label">{link.label}</span>
          </NavLink>
        ))}
      </nav>

      {isAuthenticated && (
        <div className="app-sidebar-footer">
          <RatingBadge rank={user?.rank} rating={user?.rating} size="sm" />
          <span className="app-sidebar-streak">🔥 {user?.currentStreak || 0}d streak</span>
        </div>
      )}
    </aside>
  );
}

export default Sidebar;