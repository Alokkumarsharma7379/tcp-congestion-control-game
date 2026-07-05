import { BrowserRouter, Navigate, Route, Routes } from 'react-router-dom';

import MainLayout from './components/layout/MainLayout.jsx';
import { AuthProvider } from './context/AuthContext.jsx';

import HomePage from './pages/HomePage.jsx';
import LoginPage from './pages/LoginPage.jsx';
import RegisterPage from './pages/RegisterPage.jsx';
import DashboardPage from './pages/DashboardPage.jsx';
import DashboardOverview from './pages/dashboard/DashboardOverview.jsx';
import DashboardSettings from './pages/dashboard/DashboardSettings.jsx';
import DashboardBlog from './pages/dashboard/DashboardBlog.jsx';
import DashboardTeams from './pages/dashboard/DashboardTeams.jsx';
import DashboardGroups from './pages/dashboard/DashboardGroups.jsx';
import DashboardGames from './pages/dashboard/DashboardGames.jsx';
import GamePage from './pages/GamePage.jsx';
import LeaderboardPage from './pages/LeaderboardPage.jsx';

function App() {
  return (
    <AuthProvider>
      <BrowserRouter>
        <Routes>
          <Route element={<MainLayout />}>
            <Route path="/" element={<HomePage />} />
            <Route path="/login" element={<LoginPage />} />
            <Route path="/register" element={<RegisterPage />} />

            <Route path="/dashboard" element={<DashboardPage />}>
              <Route index element={<DashboardOverview />} />
              <Route path="settings" element={<DashboardSettings />} />
              <Route path="blog" element={<DashboardBlog />} />
              <Route path="teams" element={<DashboardTeams />} />
              <Route path="groups" element={<DashboardGroups />} />
              <Route path="games" element={<DashboardGames />} />
            </Route>

            <Route path="/game" element={<GamePage />} />
            <Route path="/leaderboard" element={<LeaderboardPage />} />
          </Route>

          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </BrowserRouter>
    </AuthProvider>
  );
}

export default App;