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
  idea of pacing off an estimated max-bandwidth, cycling a gain factor to
  probe for more capacity.
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
  The core shared queue/buffer physics — player, enabled engine competitors,
  and background traffic all inject packets into the same finite bottleneck
  queue. Tail-drop overflow is charged proportionally to this tick's arrivals,
  then bottleneck service is split proportionally to each flow's queued share.

  This is the important competitive-network invariant: if the player sends
  more, there is less queue/bandwidth left for Cubic/BBR during that exact
  tick, and their loss/throughput feedback changes. Earlier versions stepped
  each bot through its own private copy of the queue with only background
  traffic, so bot curves were nearly identical from round to round no matter
  how the player behaved.
*/
const allocateProportionally = (total, weights) => {
  if (total <= 0) return weights.map(() => 0);

  const weightSum = weights.reduce((sum, weight) => sum + weight, 0);
  if (weightSum <= 0) return weights.map(() => 0);

  const rawShares = weights.map((weight) => (weight / weightSum) * total);
  const allocations = rawShares.map(Math.floor);
  let remaining = total - allocations.reduce((sum, value) => sum + value, 0);

  rawShares
    .map((share, index) => ({ index, fraction: share - Math.floor(share) }))
    .sort((a, b) => b.fraction - a.fraction)
    .forEach(({ index }) => {
      if (remaining <= 0) return;
      allocations[index] += 1;
      remaining -= 1;
    });

  return allocations;
};

const stepSharedQueueModel = ({ flows, backgroundQueue, backgroundArrival, bufferSize, bandwidth }) => {
  const currentQueue = backgroundQueue + flows.reduce((sum, flow) => sum + flow.queue, 0);
  const totalArrival = backgroundArrival + flows.reduce((sum, flow) => sum + flow.arrival, 0);
  const overflow = Math.max(0, currentQueue + totalArrival - bufferSize);

  const dropWeights = [...flows.map((flow) => flow.arrival), backgroundArrival];
  const rawDrops = allocateProportionally(overflow, dropWeights);
  const flowDrops = flows.map((flow, index) => Math.min(rawDrops[index], flow.arrival));
  const backgroundDrop = Math.min(rawDrops[flows.length], backgroundArrival);

  const queuedFlows = flows.map((flow, index) => ({
    ...flow,
    drop: flowDrops[index],
    nextQueue: flow.queue + flow.arrival - flowDrops[index]
  }));
  let nextBackgroundQueue = backgroundQueue + backgroundArrival - backgroundDrop;

  const qLen = nextBackgroundQueue + queuedFlows.reduce((sum, flow) => sum + flow.nextQueue, 0);
  const served = Math.min(qLen, bandwidth);
  const serviceWeights = [...queuedFlows.map((flow) => flow.nextQueue), nextBackgroundQueue];
  const rawDelivered = allocateProportionally(served, serviceWeights);

  const nextFlows = queuedFlows.map((flow, index) => {
    const delivered = Math.min(rawDelivered[index], flow.nextQueue);
    return {
      id: flow.id,
      queue: Math.max(0, flow.nextQueue - delivered),
      drop: flow.drop,
      delivered
    };
  });

  const backgroundDelivered = Math.min(rawDelivered[queuedFlows.length], nextBackgroundQueue);
  nextBackgroundQueue = Math.max(0, nextBackgroundQueue - backgroundDelivered);

  const latency = bandwidth
    ? (nextBackgroundQueue + nextFlows.reduce((sum, flow) => sum + flow.queue, 0)) / bandwidth
    : 10;
  const latNorm = Math.min(1, latency / 6);

  return {
    flows: Object.fromEntries(nextFlows.map((flow) => [flow.id, flow])),
    backgroundQueue: nextBackgroundQueue,
    backgroundDrop,
    backgroundDelivered,
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

/*
  BBR: track a rolling max of the bot's own recent DELIVERED throughput and
  pace the target off that, cycling a gain factor between 1.25 / 0.75 / 1.0
  to probe for more capacity, matching the spirit of BBR's PROBE_BW phase.
  Tracking delivered (not attempted) throughput is deliberate and important:
  it's what gives BBR real negative feedback from congestion — if sending
  more just causes drops rather than more delivery, the estimate correctly
  stops climbing.

  BUG FIX (round 1): the original version multiplied the target by a
  tracked "minRtt" that was actually sourced from this simulation's
  normalized QUEUEING latency. Queueing latency legitimately reads near 0
  whenever the queue is briefly empty (e.g. tick 1, before congestion
  builds). Once minRtt locked onto a near-zero reading, bdp = maxBandwidth *
  minRtt collapsed toward 0 permanently — minRtt is a running MINIMUM, so it
  could only ever get smaller, never recover. Fix: drop the RTT multiplier
  entirely (this simulation has no real propagation delay to derive one
  from) — target = gain * maxBandwidth.

  BUG FIX (round 2 — caught by testing round 1's fix before shipping it):
  round 1 also switched maxBandwidth to sample ATTEMPTED rate (cwnd) instead
  of delivered throughput, reasoning that delivered is capped by the bot's
  own already-collapsed cwnd. That fixed the collapse but removed all
  negative feedback — with nothing but attempted rate feeding the estimate,
  the gain cycle's 1.25x probe just ratchets upward every cycle regardless
  of how much congestion it's causing (verified: 61/80 ticks congested,
  ~50% delivery ratio, growth all the way to the rate cap — clearly wrong).
  Reverted to tracking delivered throughput, keeping only the round-1 fix
  (dropping the RTT multiplier).
*/
const BBR_RATE_WINDOW = 10;
const BBR_GAIN_CYCLE = [1.25, 0.75, 1, 1, 1, 1, 1, 1];

const createBbrBotState = (initialRate) => ({
  algorithm: 'bbr',
  cwnd: initialRate,
  rateSamples: [initialRate],
  maxBandwidth: initialRate,
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
  const gain = BBR_GAIN_CYCLE[bot.cycleIndex % BBR_GAIN_CYCLE.length];
  return clamp(gain * bot.maxBandwidth, MIN_RATE, MAX_RATE);
};

const createBotState = (algorithm, initialRate) =>
  algorithm === 'cubic'
    ? createCubicBotState(initialRate)
    : createBbrBotState(initialRate);

// Advances one bot by one tick after the shared queue has already decided
// that bot's delivered packets, drops, and remaining queue. The congestion
// signal therefore reflects the player's traffic and every other enabled bot
// in the same bottleneck, not an isolated per-bot copy of the network.
const prepareBotCwnd = (bot, tick) =>
  bot.algorithm === 'cubic' ? nextCubicCwnd(bot, tick) : nextBbrCwnd(bot);

const applyBotSharedResult = (bot, { tick, cwnd, flowResult, bandwidth, latNorm }) => {
  const congestion = flowResult.drop > 0 || latNorm > 0.75;

  const rateSamples =
    bot.algorithm === 'bbr'
      ? boundedPush(bot.rateSamples, flowResult.delivered, BBR_RATE_WINDOW)
      : bot.rateSamples;

  return {
    ...bot,
    cwnd,
    queue: flowResult.queue,
    otherQueue: 0,
    totalSent: bot.totalSent + cwnd,
    totalDelivered: bot.totalDelivered + flowResult.delivered,
    totalDropped: bot.totalDropped + flowResult.drop,
    totalBandwidth: bot.totalBandwidth + bandwidth,
    congestionEvents: bot.congestionEvents + (congestion ? 1 : 0),
    congestionLastTick: congestion,
    dropTicks: congestion && flowResult.drop > 0
      ? [...bot.dropTicks, tick]
      : bot.dropTicks,
    rateSamples,
    maxBandwidth:
      bot.algorithm === 'bbr' ? Math.max(...rateSamples, MIN_RATE) : bot.maxBandwidth,
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

  const botCwnds = Object.fromEntries(
    Object.entries(prev.bots).map(([algorithm, botState]) => [
      algorithm,
      Math.round(prepareBotCwnd(botState, t))
    ])
  );

  const sharedResult = stepSharedQueueModel({
    flows: [
      {
        id: 'player',
        arrival: playerRate,
        queue: prev.playerQueue
      },
      ...Object.entries(prev.bots).map(([algorithm, botState]) => ({
        id: algorithm,
        arrival: botCwnds[algorithm],
        queue: botState.queue
      }))
    ],
    backgroundQueue: prev.otherQueue,
    backgroundArrival: ot,
    bufferSize: settings.bufferSize,
    bandwidth: bw
  });

  const playerFlow = sharedResult.flows.player;
  const playerQ = playerFlow.queue;
  const otherQ = sharedResult.backgroundQueue;
  const pDrop = playerFlow.drop;
  const pDel = playerFlow.delivered;
  const { latNorm } = sharedResult;

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
    nextBots[algorithm] = applyBotSharedResult(botState, {
      tick: t,
      cwnd: botCwnds[algorithm],
      flowResult: sharedResult.flows[algorithm],
      bandwidth: bw,
      latNorm
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
      queue: playerQ + otherQ + Object.values(nextBots).reduce((sum, bot) => sum + bot.queue, 0),
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