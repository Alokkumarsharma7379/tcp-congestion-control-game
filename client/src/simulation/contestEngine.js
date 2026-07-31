/*
  Contest mode's per-player simulation. Deliberately self-contained (doesn't
  assume a gameEngine.js exists elsewhere in the project) since this
  project's single-player simulation logic has moved around between an
  inline implementation and an extracted module at different points — this
  file doesn't depend on knowing which state that's currently in.

  Each player runs this LOCALLY, against the contest's host-configured
  parameters (capacity, queueSize, lossProbability). There's no shared
  bottleneck queue between players in this version — see the note in
  contestSocket.js about the score-reporting trust model this implies.
*/

const REWARD = 1.0;
const DROP_PENALTY = 4.0;
const HISTORY_LEN = 80;
const MIN_RATE = 1;
const MAX_RATE = 200;

const clamp = (value, min, max) => Math.max(min, Math.min(max, value));

const boundedPush = (arr, value, limit) =>
  arr.length >= limit ? [...arr.slice(1), value] : [...arr, value];

const createContestState = (config) => ({
  tick: 0,
  rate: config.initialCwnd,
  queue: 0,
  totalScore: 0,
  totalDelivered: 0,
  totalDropped: 0,
  totalSent: 0,
  histRate: [],
  histScore: [],
  lastResult: null
});

// One tick of the player's own shadow simulation. `delta` is the player's
// manual rate adjustment for this tick (same interaction model as the
// single-player game — arrow keys / a slider that's added every tick, not
// a one-time nudge).
const stepContestTick = (prev, config, delta = 0) => {
  const rate = clamp(prev.rate + delta, MIN_RATE, MAX_RATE);

  // Independent probabilistic loss layer (the host's configured "loss
  // rate"), applied before the buffer/overflow model — represents a lossy
  // link, distinct from pure buffer exhaustion.
  let arrived = 0;
  for (let i = 0; i < rate; i += 1) {
    if (Math.random() >= config.lossProbability) arrived += 1;
  }
  const lossLayerDrops = rate - arrived;

  const overflow = Math.max(0, prev.queue + arrived - config.queueSize);
  const overflowDrops = Math.min(overflow, arrived);

  let queue = prev.queue + arrived - overflowDrops;
  const served = Math.min(queue, config.capacity);
  queue = Math.max(0, queue - served);

  const delivered = served;
  const dropped = lossLayerDrops + overflowDrops;
  const scoreDelta = REWARD * delivered - DROP_PENALTY * dropped;
  const totalScore = prev.totalScore + scoreDelta;

  return {
    tick: prev.tick + 1,
    rate,
    queue,
    totalScore,
    totalDelivered: prev.totalDelivered + delivered,
    totalDropped: prev.totalDropped + dropped,
    totalSent: prev.totalSent + rate,
    histRate: boundedPush(prev.histRate, rate, HISTORY_LEN),
    histScore: boundedPush(prev.histScore, Math.round(totalScore), HISTORY_LEN),
    lastResult: { delivered, dropped, scoreDelta }
  };
};

export {
  createContestState,
  stepContestTick,
  clamp,
  MIN_RATE,
  MAX_RATE
};