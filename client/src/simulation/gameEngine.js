/*
  Core simulation engine for the TCP Congestion Control game.

  This was previously inline inside GamePage.jsx. It's extracted here because
  the "Engine Competitor" feature adds a meaningful amount of new math
  (TCP Cubic and BBR bot models) that doesn't belong bloating the page
  component further. GamePage.jsx imports everything it needs from here.

  IMPORTANT SCOPING NOTE: the Cubic and BBR models below are deliberately
  simplified, "spirit of the algorithm" implementations for an educational
  game — not byte-for-byte ports of the real RFCs / Linux kernel code. Cubic
  reuses the real cubic-growth-from-last-reduction shape; BBR reuses the real
  idea of pacing off an estimated max-bandwidth * min-RTT (bandwidth-delay
  product), cycling a gain factor to probe for more capacity. Full BBR has
  multiple state-machine phases (STARTUP/DRAIN/PROBE_BW/PROBE_RTT) with many
  more edge cases; this is a lightweight approximation of PROBE_BW-style
  behavior only.
*/

/* ━━━━━━━━━━ CONSTANTS ━━━━━━━━━━ */
const REWARD = 1.0;
const DROP_PENALTY = 4.0;
const UTIL_BONUS = 0.5;
const LOSS_WINDOW = 20;
const HISTORY_LEN = 80;
const MIN_RATE = 1;
const MAX_RATE = 80;

const PHASE = { SETUP: 'SETUP', RUNNING: 'RUNNING', FINISHED: 'FINISHED' };

const COMPETITOR_OPTIONS = [
  { value: 'none', label: 'None' },
  { value: 'cubic', label: 'TCP Cubic' },
  { value: 'bbr', label: 'BBR' },
  { value: 'both', label: 'Both (Cubic & BBR)' }
];

const BOT_META = {
  cubic: { label: 'TCP Cubic', color: '#e67e22' },
  bbr: { label: 'BBR', color: '#8e44ad' }
};

const getActiveBotAlgorithms = (competitor) => {
  if (competitor === 'both') return ['cubic', 'bbr'];
  if (competitor === 'cubic' || competitor === 'bbr') return [competitor];
  return [];
};

/* ━━━━━━━━━━ HELPERS ━━━━━━━━━━ */
const clamp = (v, lo, hi) => Math.max(lo, Math.min(hi, v));

const boundedPush = (arr, v, limit) =>
  arr.length >= limit ? [...arr.slice(1), v] : [...arr, v];

const getBandwidth = (s, t) =>
  s === 1 ? 30 : s === 2 ? 30 : 15 + 15 * Math.sin(t / 10);

const getOtherTraffic = (s, t) => {
  if (s === 1) return 15 + 10 * Math.sin(t / 5);
  if (s === 2) return Math.random() < 0.1 ? 25 + Math.random() * 20 : 5 + Math.random() * 5;
  return 10 + 8 * Math.sin((t + 20) / 8);
};

/*
  The core queue/buffer physics — tail-drop overflow split proportionally
  between "self" (whoever is being simulated: the player, or a bot) and
  "other" (background traffic), then service/drain proportional to queue
  share. This is a direct extraction of what used to be inline in the
  player's tick logic; calling it with the player's own numbers behaves
  identically to before. Bots call the exact same function with their own
  rate and their own virtual queue, so the physics are provably consistent
  between player and bots.
*/
const stepQueueModel = ({
  selfRate,
  otherArrival,
  selfQueue,
  otherQueue,
  bufferSize,
  bandwidth
}) => {
  const curQ = selfQueue + otherQueue;
  const overflow = Math.max(0, curQ + selfRate + otherArrival - bufferSize);
  const selfDrop = overflow
    ? Math.min(Math.ceil((selfRate / (selfRate + otherArrival)) * overflow), selfRate)
    : 0;
  const otherDrop = overflow - selfDrop;

  let nextSelfQueue = selfQueue + selfRate - selfDrop;
  let nextOtherQueue = otherQueue + otherArrival - otherDrop;
  const qLen = nextSelfQueue + nextOtherQueue;
  const served = Math.min(qLen, bandwidth);
  const selfDelivered = qLen ? Math.round((nextSelfQueue / qLen) * served) : 0;

  nextSelfQueue = Math.max(0, nextSelfQueue - selfDelivered);
  nextOtherQueue = Math.max(0, nextOtherQueue - (served - selfDelivered));

  const latency = bandwidth ? (nextSelfQueue + nextOtherQueue) / bandwidth : 10;
  const latNorm = Math.min(1, latency / 6);

  return {
    selfQueue: nextSelfQueue,
    otherQueue: nextOtherQueue,
    selfDrop,
    selfDelivered,
    latNorm
  };
};

/* ━━━━━━━━━━ COMPETITOR BOTS ━━━━━━━━━━ */

// TCP Cubic: on congestion, drop to cwnd * BETA and remember that point as
// wMax. Between congestion events, grow along the cubic curve
// C*(t-K)^3 + wMax, where t is ticks since the last reduction and K is the
// time the curve takes to climb back to wMax. This gives Cubic's real shape:
// fast recovery right after a cut, a plateau near the old ceiling, then
// convex acceleration past it if no new congestion shows up.
const CUBIC_C = 0.4;
const CUBIC_BETA = 0.7;

const createCubicBotState = (initialRate) => ({
  algorithm: 'cubic',
  cwnd: initialRate,
  wMax: initialRate,
  epochStart: 0,
  k: 0,
  queue: 0,
  otherQueue: 0,
  totalSent: 0,
  totalDelivered: 0,
  totalDropped: 0,
  totalBandwidth: 0,
  congestionEvents: 0,
  congestionLastTick: false,
  dropTicks: [],
  histCwnd: []
});

const nextCubicCwnd = (bot, tick) => {
  if (bot.congestionLastTick) {
    const wMax = bot.cwnd;
    const reduced = Math.max(MIN_RATE, bot.cwnd * CUBIC_BETA);
    const k = Math.cbrt((wMax * (1 - CUBIC_BETA)) / CUBIC_C) || 0;

    bot.wMax = wMax;
    bot.epochStart = tick;
    bot.k = k;

    return clamp(reduced, MIN_RATE, MAX_RATE);
  }

  const elapsed = tick - bot.epochStart;
  const target = CUBIC_C * (elapsed - bot.k) ** 3 + bot.wMax;

  return clamp(target, MIN_RATE, MAX_RATE);
};

// BBR: track a rolling max of recently-delivered throughput (a stand-in for
// "max bandwidth observed") and the minimum observed queueing latency (a
// stand-in for "min RTT" — this simulation has no separate propagation
// delay, so normalized queue latency is the closest available proxy).
// Target rate = gain * (maxBandwidth * minRtt), cycling the gain between
// 1.25 / 0.75 / 1.0 to periodically probe for more capacity, matching the
// spirit of BBR's PROBE_BW phase.
const BBR_BW_WINDOW = 10;
const BBR_GAIN_CYCLE = [1.25, 0.75, 1, 1, 1, 1, 1, 1];

const createBbrBotState = (initialRate) => ({
  algorithm: 'bbr',
  cwnd: initialRate,
  bwSamples: [],
  maxBandwidth: initialRate,
  minRtt: null,
  cycleIndex: 0,
  queue: 0,
  otherQueue: 0,
  totalSent: 0,
  totalDelivered: 0,
  totalDropped: 0,
  totalBandwidth: 0,
  congestionEvents: 0,
  congestionLastTick: false,
  dropTicks: [],
  histCwnd: []
});

const nextBbrCwnd = (bot) => {
  const minRtt = bot.minRtt === null ? 1 : Math.max(bot.minRtt, 0.15);
  const bdp = bot.maxBandwidth * minRtt;
  const gain = BBR_GAIN_CYCLE[bot.cycleIndex % BBR_GAIN_CYCLE.length];

  return clamp(gain * bdp, MIN_RATE, MAX_RATE);
};

const createBotState = (algorithm, initialRate) =>
  algorithm === 'cubic'
    ? createCubicBotState(initialRate)
    : createBbrBotState(initialRate);

// Advances one bot by one tick, using the SAME bandwidth/other-traffic
// values the player saw this tick (passed in via `env`), so the comparison
// is apples-to-apples.
const stepBot = (bot, { tick, bandwidth, otherArrival, bufferSize }) => {
  const cwnd =
    bot.algorithm === 'cubic' ? nextCubicCwnd(bot, tick) : nextBbrCwnd(bot);

  const result = stepQueueModel({
    selfRate: cwnd,
    otherArrival,
    selfQueue: bot.queue,
    otherQueue: bot.otherQueue,
    bufferSize,
    bandwidth
  });

  const congestion = result.selfDrop > 0 || result.latNorm > 0.75;

  const bwSamples =
    bot.algorithm === 'bbr'
      ? boundedPush(bot.bwSamples, result.selfDelivered, BBR_BW_WINDOW)
      : bot.bwSamples;

  return {
    ...bot,
    cwnd,
    queue: result.selfQueue,
    otherQueue: result.otherQueue,
    totalSent: bot.totalSent + cwnd,
    totalDelivered: bot.totalDelivered + result.selfDelivered,
    totalDropped: bot.totalDropped + result.selfDrop,
    totalBandwidth: bot.totalBandwidth + bandwidth,
    congestionEvents: bot.congestionEvents + (congestion ? 1 : 0),
    congestionLastTick: congestion,
    dropTicks: congestion && result.selfDrop > 0
      ? [...bot.dropTicks, tick]
      : bot.dropTicks,
    bwSamples,
    maxBandwidth:
      bot.algorithm === 'bbr' ? Math.max(...bwSamples, 1) : bot.maxBandwidth,
    minRtt:
      bot.algorithm === 'bbr'
        ? bot.minRtt === null
          ? result.latNorm
          : Math.min(bot.minRtt, result.latNorm)
        : bot.minRtt,
    cycleIndex: bot.algorithm === 'bbr' ? bot.cycleIndex + 1 : bot.cycleIndex,
    histCwnd: boundedPush(bot.histCwnd, Math.round(cwnd), HISTORY_LEN)
  };
};

/* ━━━━━━━━━━ SIMULATION CORE ━━━━━━━━━━ */
const createInitialGame = (settings, phase) => {
  const bots = {};

  getActiveBotAlgorithms(settings.competitor).forEach((algorithm) => {
    bots[algorithm] = createBotState(algorithm, settings.initialRate);
  });

  return {
    phase,
    tick: 0,
    playerRate: settings.initialRate,
    peakRate: settings.initialRate,
    playerQueue: 0,
    otherQueue: 0,
    totalScore: 0,
    totalDelivered: 0,
    totalDropped: 0,
    totalSent: 0,
    totalBandwidth: 0,
    congestionEvents: 0,
    aimdRate: settings.initialRate,
    sentWindow: [],
    droppedWindow: [],
    histTP: [],
    histLoss: [],
    histLat: [],
    histDelta: [],
    histAIMD: [],
    histPlayerCwnd: [],
    dropTicks: [],
    aimdLog: [],
    packets: [],
    lastResult: null,
    bots
  };
};

const buildPackets = ({ t, sent, dropped, delivered }) =>
  Array.from({ length: sent }, (_, i) => {
    let state = 'inFlight';
    if (i < dropped) state = 'dropped';
    else if (i < dropped + delivered) state = 'acked';
    return { id: `${t}-${i}`, sequence: i + 1, state };
  });

function simulateTick(prev, settings, delta) {
  if (prev.tick >= settings.maxTicks) return { ...prev, phase: PHASE.FINISHED };

  const t = prev.tick + 1;
  const playerRate = clamp(prev.playerRate + delta, MIN_RATE, MAX_RATE);
  const bw = Math.round(Math.max(5, getBandwidth(settings.scenario, t)));
  const ot = Math.round(Math.max(0, getOtherTraffic(settings.scenario, t)));

  const playerResult = stepQueueModel({
    selfRate: playerRate,
    otherArrival: ot,
    selfQueue: prev.playerQueue,
    otherQueue: prev.otherQueue,
    bufferSize: settings.bufferSize,
    bandwidth: bw
  });

  const {
    selfQueue: playerQ,
    otherQueue: otherQ,
    selfDrop: pDrop,
    selfDelivered: pDel,
    latNorm
  } = playerResult;

  const pArr = playerRate;

  const sentWindow = boundedPush(prev.sentWindow, pArr, LOSS_WINDOW);
  const droppedWindow = boundedPush(prev.droppedWindow, pDrop, LOSS_WINDOW);
  const lossRate =
    sentWindow.reduce((s, v) => s + v, 0)
      ? droppedWindow.reduce((s, v) => s + v, 0) /
        sentWindow.reduce((s, v) => s + v, 0)
      : 0;

  const utilBonus = pDel && lossRate < 0.01 ? UTIL_BONUS : 0;
  const scoreΔ = REWARD * pDel - DROP_PENALTY * pDrop + utilBonus;
  const congestion = pDrop > 0 || latNorm > 0.75;
  const aimdRate = congestion
    ? Math.max(1, prev.aimdRate / 2)
    : Math.min(MAX_RATE, prev.aimdRate + 1);

  const tpNorm = playerRate ? Math.min(1, pDel / playerRate) : 0;
  const deltaNorm = clamp((scoreΔ + 15) / 35, 0, 1);
  const aimdNorm = Math.min(1, aimdRate / 50);

  const aimdRow = {
    tick: t,
    aimdRate: Math.round(aimdRate),
    playerRate,
    congestion,
    action: congestion ? `÷2 → ${Math.round(aimdRate)}` : `+1 → ${Math.round(aimdRate)}`
  };

  const nextBots = {};
  Object.entries(prev.bots).forEach(([algorithm, botState]) => {
    nextBots[algorithm] = stepBot(botState, {
      tick: t,
      bandwidth: bw,
      otherArrival: ot,
      bufferSize: settings.bufferSize
    });
  });

  return {
    ...prev,
    phase: t >= settings.maxTicks ? PHASE.FINISHED : PHASE.RUNNING,
    tick: t,
    playerRate,
    peakRate: Math.max(prev.peakRate, playerRate),
    playerQueue: playerQ,
    otherQueue: otherQ,
    totalScore: prev.totalScore + scoreΔ,
    totalDelivered: prev.totalDelivered + pDel,
    totalDropped: prev.totalDropped + pDrop,
    totalSent: prev.totalSent + pArr,
    totalBandwidth: prev.totalBandwidth + bw,
    congestionEvents: prev.congestionEvents + (congestion ? 1 : 0),
    aimdRate,
    sentWindow,
    droppedWindow,
    histTP: boundedPush(prev.histTP, tpNorm, HISTORY_LEN),
    histLoss: boundedPush(prev.histLoss, lossRate, HISTORY_LEN),
    histLat: boundedPush(prev.histLat, latNorm, HISTORY_LEN),
    histDelta: boundedPush(prev.histDelta, deltaNorm, HISTORY_LEN),
    histAIMD: boundedPush(prev.histAIMD, aimdNorm, HISTORY_LEN),
    histPlayerCwnd: boundedPush(prev.histPlayerCwnd, Math.round(playerRate), HISTORY_LEN),
    dropTicks: pDrop > 0 ? [...prev.dropTicks, t] : prev.dropTicks,
    aimdLog: [aimdRow, ...prev.aimdLog].slice(0, 25),
    packets: buildPackets({
      t,
      sent: pArr,
      dropped: pDrop,
      delivered: Math.min(pDel, pArr - pDrop)
    }),
    lastResult: {
      bw,
      ot,
      pArr,
      pDrop,
      pDel,
      latNorm,
      lossRate,
      scoreΔ,
      congestion,
      queue: playerQ + otherQ,
      playerRate
    },
    bots: nextBots
  };
}

export {
  PHASE,
  REWARD,
  DROP_PENALTY,
  UTIL_BONUS,
  MIN_RATE,
  MAX_RATE,
  COMPETITOR_OPTIONS,
  BOT_META,
  getActiveBotAlgorithms,
  clamp,
  boundedPush,
  createInitialGame,
  simulateTick
};