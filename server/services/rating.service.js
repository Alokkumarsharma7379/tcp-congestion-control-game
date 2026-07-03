const K_FACTOR = 32;
const RATING_SCALE = 400;
const MAX_DELTA = 64;

const RANK_TIERS = [
  { min: 2400, label: 'Grandmaster' },
  { min: 2200, label: 'International Master' },
  { min: 1900, label: 'Master' },
  { min: 1600, label: 'Expert' },
  { min: 1400, label: 'Specialist' },
  { min: 1200, label: 'Pupil' },
  { min: 0, label: 'Newbie' }
];

const clamp = (value, min, max) => {
  return Math.min(Math.max(value, min), max);
};

const getRankFromRating = (rating) => {
  return RANK_TIERS.find((tier) => rating >= tier.min)?.label || 'Newbie';
};

const normalizePerformanceRating = (score) => {
  const numericScore = Number(score);

  if (!Number.isFinite(numericScore)) {
    return 0;
  }

  return Math.max(0, Math.round(numericScore));
};

const calculateNewRating = (
  currentRating,
  score,
  performanceMetrics = {}
) => {
  const safeCurrentRating = Math.max(0, Number(currentRating) || 0);
  const performanceRating = normalizePerformanceRating(score);

  /*
    The final score is treated as the player's performance rating for the round.
    Delta scales by rating distance, then gets capped so one outlier round cannot
    distort the ladder too aggressively.
  */
  const rawDelta =
    K_FACTOR * ((performanceRating - safeCurrentRating) / RATING_SCALE);

  const ratingDelta = Math.round(clamp(rawDelta, -MAX_DELTA, MAX_DELTA));
  const newRating = Math.max(0, safeCurrentRating + ratingDelta);

  return {
    previousRating: safeCurrentRating,
    performanceRating,
    newRating,
    ratingDelta,
    previousRank: getRankFromRating(safeCurrentRating),
    newRank: getRankFromRating(newRating),
    kFactor: performanceMetrics.kFactor || K_FACTOR
  };
};

export {
  calculateNewRating,
  getRankFromRating
};