import { Outlet, useLocation } from 'react-router-dom';

import Navbar from './Navbar.jsx';
import Sidebar from './Sidebar.jsx';
import Footer from './Footer.jsx';
import '../../styles/codeforces.css';

function MainLayout() {
  const location = useLocation();
  const isGamePage = location.pathname.startsWith('/game');

  return (
    <div className={`app-shell ${isGamePage ? 'game-shell' : ''}`}>
      <Navbar />

      <div className="app-body">
        {!isGamePage && <Sidebar />}

        <div className="app-main">
          <div className="page-content-wrap">
            <Outlet />
          </div>
          {!isGamePage && <Footer />}
        </div>
      </div>
    </div>
  );
}

export default MainLayout;