import { NavLink, useNavigate } from 'react-router-dom';

import { useAuth } from '../../context/AuthContext';
import RatingBadge from '../ui/RatingBadge';

const navLinkClassName = ({ isActive }) => (isActive ? 'active' : undefined);

function Navbar() {
  const navigate = useNavigate();
  const { user, isAuthenticated, logout, booting } = useAuth();

  const handleLogout = () => {
    logout();
    navigate('/');
  };

  return (
    <header className="app-navbar">
      <div className="app-navbar-brand">
        <NavLink to="/" className="app-navbar-logo">
          TCP<span>//</span>Edu
        </NavLink>
        <span className="app-navbar-tagline">Educational networking games</span>
      </div>

      <nav className="app-navbar-links" aria-label="Primary navigation">
        <NavLink to="/" end className={navLinkClassName}>Home</NavLink>
        <NavLink to="/game" className={navLinkClassName}>Play</NavLink>
        <NavLink to="/leaderboard" className={navLinkClassName}>Leaderboard</NavLink>
        <NavLink to="/dashboard" className={navLinkClassName}>Dashboard</NavLink>
      </nav>

      <div className="app-navbar-account">
        {booting && <span className="app-navbar-status">Loading session...</span>}

        {!booting && isAuthenticated && (
          <>
            <RatingBadge rank={user?.rank} rating={user?.rating} size="sm" />
            <NavLink to="/dashboard" className="app-navbar-username">
              {user?.username}
            </NavLink>
            <button className="cf-btn" type="button" onClick={handleLogout}>
              Logout
            </button>
          </>
        )}

        {!booting && !isAuthenticated && (
          <>
            <NavLink to="/login" className="cf-btn">Login</NavLink>
            <NavLink to="/register" className="cf-btn primary">Register</NavLink>
          </>
        )}
      </div>
    </header>
  );
}

export default Navbar;