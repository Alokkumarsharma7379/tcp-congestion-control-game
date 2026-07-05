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

export {
  getInitials,
  formatDate,
  formatShortDate,
  isWithinLastDays,
  sumCounts,
  buildRatingHistoryFromSessions,
  getGameLabel,
  getRankClassName
};