import { useEffect, useState } from 'react';
import { Link, useParams } from 'react-router-dom';

import { getPublicProfile, toggleFriend } from '../api/userApi';
import { useAuth } from '../context/AuthContext';
import HeatmapGrid from '../components/ui/HeatmapGrid';
import RatingGraph from '../components/ui/RatingGraph';
import RatingBadge from '../components/ui/RatingBadge';
import StatCard from '../components/ui/StatCard';
import { formatDate, formatShortDate, getInitials } from '../utils/dashboard';

import '../styles/codeforces.css';

function UserProfilePage() {
  const { username } = useParams();
  const { isAuthenticated } = useAuth();

  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [friendBusy, setFriendBusy] = useState(false);
  const [friendError, setFriendError] = useState('');

  useEffect(() => {
    let cancelled = false;

    const load = async () => {
      setLoading(true);
      setError('');

      try {
        const response = await getPublicProfile(username);

        if (!cancelled) {
          setData(response.data);
        }
      } catch (err) {
        if (!cancelled) {
          setError(err.message || 'This user could not be found.');
        }
      } finally {
        if (!cancelled) {
          setLoading(false);
        }
      }
    };

    load();

    return () => {
      cancelled = true;
    };
  }, [username]);

  const handleToggleFriend = async () => {
    if (!data?.user?.id) return;

    setFriendBusy(true);
    setFriendError('');

    try {
      const response = await toggleFriend(data.user.id);

      setData((prev) => ({
        ...prev,
        isFriend: response.data.isFriend,
        user: {
          ...prev.user,
          friendCount: response.data.isFriend
            ? prev.user.friendCount + 1
            : Math.max(0, prev.user.friendCount - 1)
        }
      }));
    } catch (err) {
      setFriendError(err.message || 'Could not update friend status.');
    } finally {
      setFriendBusy(false);
    }
  };

  if (loading) {
    return (
      <main className="content">
        <p className="muted-text">Loading profile...</p>
      </main>
    );
  }

  if (error || !data) {
    return (
      <main className="content">
        <section className="page-title-block">
          <h2>User not found</h2>
          <p>{error || `No player is registered with the username "${username}".`}</p>
          <Link className="cf-btn" to="/leaderboard">
            ← Back to leaderboard
          </Link>
        </section>
      </main>
    );
  }

  const { user, heatmap, ratingHistory, isSelf, isFriend } = data;

  return (
    <main className="content cf-dashboard-page">
      <section className="cf-profile-card public-profile-header">
        <div className="cf-profile-info">
          <p className="cf-user-rank">{user.rank}</p>
          <h2>{user.username}</h2>

          <p className="cf-user-line">
            {user.fullName || 'Unnamed player'}
            {user.country ? (
              <>
                , <span>{user.country}</span>
              </>
            ) : null}
          </p>

          <p><RatingBadge rank={user.rank} rating={user.rating} /></p>
        </div>

        <div className="cf-avatar-panel">
          <div className="cf-avatar-box">
            {user.avatarUrl ? (
              <img src={user.avatarUrl} alt={`${user.username} avatar`} />
            ) : (
              <div className="cf-avatar-placeholder">{getInitials(user.username)}</div>
            )}
          </div>

          {!isSelf && isAuthenticated && (
            <button
              type="button"
              className={`friend-toggle-btn ${isFriend ? 'is-friend' : ''}`}
              onClick={handleToggleFriend}
              disabled={friendBusy}
            >
              <span className="friend-star">{isFriend ? '★' : '☆'}</span>
              {friendBusy ? 'Updating...' : isFriend ? 'Friends' : 'Add Friend'}
            </button>
          )}

          {!isSelf && !isAuthenticated && (
            <Link className="cf-btn" to="/login">
              Login to add friend
            </Link>
          )}

          {isSelf && (
            <Link className="cf-btn" to="/dashboard">
              This is you — go to dashboard
            </Link>
          )}

          {friendError && <div className="form-error">{friendError}</div>}
        </div>
      </section>

      <div className="dashboard-grid">
        <StatCard icon="📈" label="Contest Rating" value={user.rating} hint={user.rank} accent="blue" />
        <StatCard icon="⭐" label="Contribution" value={user.contribution || 0} accent="orange" />
        <StatCard icon="🤝" label="Friends" value={user.friendCount} accent="purple" />
        <StatCard
          icon="🔥"
          label="Current Streak"
          value={`${user.currentStreak || 0}d`}
          hint={`Best: ${user.maxYearlyStreak || 0}d`}
          accent="red"
        />
        <StatCard icon="🎮" label="Games This Month" value={user.gamesPlayedThisMonth || 0} accent="teal" />
        <StatCard icon="🟢" label="Last Visit" value={formatShortDate(user.lastVisit)} hint={formatDate(user.lastVisit)} accent="green" />
        <StatCard icon="📝" label="Registered" value={formatShortDate(user.createdAt)} accent="blue" />
      </div>

      <section className="panel elevated-panel">
        <div className="panel-header">▶ Rating Progress</div>
        <div className="panel-body">
          <RatingGraph data={ratingHistory} />
        </div>
      </section>

      <section className="panel elevated-panel">
        <div className="panel-header">▶ Activity Heatmap</div>
        <div className="panel-body">
          <HeatmapGrid entries={heatmap} />
        </div>
      </section>
    </main>
  );
}

export default UserProfilePage;