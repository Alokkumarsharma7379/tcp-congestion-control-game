import { NavLink, Outlet, useLocation, useNavigate } from 'react-router-dom';

import { useAuth } from '../../context/AuthContext';
import '../../styles/codeforces.css';

function MainLayout() {
  const navigate = useNavigate();
  const location = useLocation();

  const { user, isAuthenticated, logout, booting } = useAuth();

  const isGamePage = location.pathname.startsWith('/game');

  const handleLogout = () => {
    logout();
    navigate('/');
  };

  return (
    <div className={`app-shell ${isGamePage ? 'game-shell' : ''}`}>
      <header className="site-header">
        <div>
          <h1>TCP Congestion Control Platform</h1>
          <p>Codeforces-style educational networking game</p>
        </div>

        <div className="header-meta">
          <span>{isAuthenticated ? `Player: ${user?.username}` : 'Guest session'}</span>
          <span>{booting ? 'Loading session...' : 'MERN Stack Build'}</span>
        </div>
      </header>

      <nav className="top-nav" aria-label="Primary navigation">
        <NavLink to="/" end>Home</NavLink>
        <NavLink to="/game">Game</NavLink>
        <NavLink to="/leaderboard">Leaderboard</NavLink>
        <NavLink to="/dashboard">Dashboard</NavLink>

        {!isAuthenticated && <NavLink to="/login">Login</NavLink>}
        {!isAuthenticated && <NavLink to="/register">Register</NavLink>}

        {isAuthenticated && (
          <button className="nav-button" type="button" onClick={handleLogout}>
            Logout
          </button>
        )}
      </nav>

      <Outlet />

      {!isGamePage && (
        <footer className="site-footer">
          TCP Congestion Control Game · React + Express + MongoDB
        </footer>
      )}
    </div>
  );
}

export default MainLayout;