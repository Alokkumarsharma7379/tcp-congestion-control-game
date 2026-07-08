const RANK_TIERS = [
  { min: 2400, label: 'Grandmaster' },
  { min: 2200, label: 'International Master' },
  { min: 1900, label: 'Master' },
  { min: 1600, label: 'Expert' },
  { min: 1400, label: 'Specialist' },
  { min: 1200, label: 'Pupil' },
  { min: 0, label: 'Newbie' }
];

/*
  Rating is now driven entirely by how well the round matched the real
  TCP congestion-control objective: use as much of the available bandwidth
  as you can, while keeping loss low. It is NOT compared against the
  player's current rating at all anymore — a round is judged on its own
  merits, then translated into a bounded nudge up or down.

  ---- TUNING KNOBS (adjust these based on playtesting) ----
*/

// A round exactly at this utilization+loss quality nets a rating delta of 0.
// Below it you lose rating, above it you gain. Raise this if climbing feels
// too easy; lower it if it feels too hard.
const NEUTRAL_PERFORMANCE_INDEX = 0.35;

// How harshly loss is punished relative to raw utilization. 3 means a 10%
// loss rate cuts 30 percentage points off your utilization credit.
const LOSS_WEIGHT = 3;

// The biggest a single round can move your rating, before rating-based
// dampening (see getRatingVolatility) is applied.
const MAX_DELTA_PER_GAME = 30;

const clamp = (value, min, max) => {
  return Math.min(Math.max(value, min), max);
};

const getRankFromRating = (rating) => {
  return RANK_TIERS.find((tier) => rating >= tier.min)?.label || 'Newbie';
};

/*
  Higher-rated players see smaller swings once they've proven their level —
  the same idea real chess Elo systems use to keep the top of the ladder
  from gyrating wildly, while newer players calibrate to the right rating
  faster.
*/
const getRatingVolatility = (currentRating) => {
  if (currentRating >= 2200) return 0.5;
  if (currentRating >= 1900) return 0.75;
  return 1;
};

/*
  Builds a 0-1 "how well did this round actually use the network" score from
  the raw packet/bandwidth counts already tracked client-side in GamePage.jsx:

    utilization = totalDelivered / totalBandwidthAvailable
      -> how much of the network's actual capacity you put to use.
         Sending very little, even with zero drops, scores low here — in
         real congestion control, leaving the link idle is also a failure
         mode, just a quieter one than packet loss.

    lossRate = totalDropped / totalSent
      -> how much of what you attempted was wasted.

  The two combine multiplicatively: high utilization with high loss is
  brought back down, and the reverse (low loss, low utilization) doesn't
  get credit just for being "safe".
*/
const calculatePerformanceIndex = ({
  totalSent = 0,
  totalDelivered = 0,
  totalDropped = 0,
  totalBandwidthAvailable = 0
}) => {
  const utilization =
    totalBandwidthAvailable > 0
      ? clamp(totalDelivered / totalBandwidthAvailable, 0, 1)
      : 0;

  const lossRate = totalSent > 0 ? clamp(totalDropped / totalSent, 0, 1) : 0;
  const lossFactor = clamp(1 - lossRate * LOSS_WEIGHT, 0, 1);

  return clamp(utilization * lossFactor, 0, 1);
};

// Maps a 0-1 performance index onto a [-1, 1] delta fraction, using the
// neutral point as the pivot. Two different slopes above/below neutral so
// "just above neutral" and "just below neutral" both feel proportionate.
const performanceIndexToDeltaFraction = (performanceIndex) => {
  if (performanceIndex >= NEUTRAL_PERFORMANCE_INDEX) {
    return (
      (performanceIndex - NEUTRAL_PERFORMANCE_INDEX) /
      (1 - NEUTRAL_PERFORMANCE_INDEX)
    );
  }

  return (
    (performanceIndex - NEUTRAL_PERFORMANCE_INDEX) /
    NEUTRAL_PERFORMANCE_INDEX
  );
};

const calculateNewRating = (currentRating, score, performanceMetrics = {}) => {
  const safeCurrentRating = Math.max(0, Number(currentRating) || 0);

  const performanceIndex = calculatePerformanceIndex(performanceMetrics);
  const deltaFraction = performanceIndexToDeltaFraction(performanceIndex);
  const volatility = getRatingVolatility(safeCurrentRating);

  const rawDelta = deltaFraction * MAX_DELTA_PER_GAME * volatility;
  const ratingDelta = Math.round(
    clamp(rawDelta, -MAX_DELTA_PER_GAME, MAX_DELTA_PER_GAME)
  );

  const newRating = Math.max(0, safeCurrentRating + ratingDelta);

  return {
    previousRating: safeCurrentRating,
    performanceRating: Math.round(performanceIndex * 100),
    newRating,
    ratingDelta,
    previousRank: getRankFromRating(safeCurrentRating),
    newRank: getRankFromRating(newRating)
  };
};

export {
  calculateNewRating,
  getRankFromRating
};