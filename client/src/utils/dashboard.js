import { API_BASE_URL } from '../api/http';

const getInitials = (username = '') => {
  return username.charAt(0).toUpperCase() || '?';
};

const formatDate = (value) => {
  if (!value) return '—';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    return '—';
  }
  return date.toLocaleString();
};

const formatShortDate = (value) => {
  if (!value) return '—';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    return '—';
  }
  return date.toLocaleDateString();
};

const isWithinLastDays = (dateString, days) => {
  const date = new Date(dateString);
  const now = new Date();
  const cutoff = new Date(now);
  cutoff.setDate(now.getDate() - days);
  return date >= cutoff;
};

const sumCounts = (rows) => {
  return rows.reduce((sum, row) => sum + (row.count || 0), 0);
};

const buildRatingHistoryFromSessions = (sessions) => {
  return [...sessions]
    .reverse()
    .map((session) => {
      const rating =
        session.newRating ||
        session.ratingAfter ||
        session.performanceRating ||
        session.score;
      return {
        date: session.playedAt || session.createdAt,
        rating
      };
    })
    .filter((point) => Number.isFinite(point.rating));
};

const GAME_LABELS = {
  TCP_CONGESTION: 'TCP Congestion Control'
};

const getGameLabel = (gameType) => GAME_LABELS[gameType] || gameType || 'Unknown game';

const RANK_CLASS_MAP = {
  Newbie: 'rank-newbie',
  Pupil: 'rank-pupil',
  Specialist: 'rank-specialist',
  Expert: 'rank-expert',
  Master: 'rank-master',
  'International Master': 'rank-im',
  Grandmaster: 'rank-gm'
};

const getRankClassName = (rank) => RANK_CLASS_MAP[rank] || 'rank-newbie';

// Avatars (and any other uploaded file) are stored as relative paths like
// "/uploads/avatars/xxx.jpg". That only resolves correctly when the frontend
// and backend share an origin (e.g. local dev, where Vite proxies /uploads
// to the backend). In production they're usually on different domains, so
// the relative path needs to be resolved against the backend's own URL
// instead of the page's URL — which is exactly what API_BASE_URL already
// points to (minus the trailing /api).
const ASSET_BASE_URL = API_BASE_URL.replace(/\/api\/?$/, '');

const resolveAssetUrl = (path) => {
  if (!path) return '';
  if (/^https?:\/\//i.test(path)) return path; // already absolute
  return `${ASSET_BASE_URL}${path}`;
};

export {
  getInitials,
  formatDate,
  formatShortDate,
  isWithinLastDays,
  sumCounts,
  buildRatingHistoryFromSessions,
  getGameLabel,
  getRankClassName,
  resolveAssetUrl
};