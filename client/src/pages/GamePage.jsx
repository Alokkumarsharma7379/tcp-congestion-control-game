/*  This is the full game component previously living in App.jsx.
    Nothing was removed—only the outer BrowserRouter wrapper is gone. */

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';

import { submitGameSession } from '../api/gameApi';
import { useAuth } from '../context/AuthContext';
import {
  PHASE,
  REWARD,
  DROP_PENALTY,
  UTIL_BONUS,
  MIN_RATE,
  MAX_RATE,
  COMPETITOR_OPTIONS,
  clamp,
  createInitialGame,
  simulateTick
} from '../simulation/gameEngine';
import GameReviewPanel from '../components/ui/GameReviewPanel';
import '../styles/codeforces.css';


const SPEED_OPTIONS = [
  ['800', 'Slow'],
  ['400', 'Normal'],
  ['150', 'Fast'],
  ['40', 'Turbo']
];

const SCENARIO_NAMES = {
  1: 'Scenario 1 — Stable Bandwidth',
  2: 'Scenario 2 — Bursty Traffic',
  3: 'Scenario 3 — Oscillating Network'
};

const PACKET_STATUS_LABEL = {
  acked: 'ACK',
  dropped: 'DROP',
  inFlight: 'FLY',
  empty: ''
};

/* ━━━━━━━━━━ HELPERS ━━━━━━━━━━ */



const tierFromScore = (score) => {
  if (score >= 150) return ['Grandmaster', 'status-bad'];
  if (score >= 120) return ['Master', 'status-warn'];
  if (score >= 90) return ['Expert', 'status-warn'];
  if (score >= 60) return ['Specialist', 'status-ok'];
  if (score >= 40) return ['Pupil', 'status-ok'];
  if (score >= 20) return ['Newbie', 'status-ok'];
  return ['Beginner', 'muted-status'];
};

const statusToClass = (s) =>
  s === 'Good' || s === 'OK' || s === 'Low'
    ? 'status-ok'
    : s === 'Warning' || s === 'Medium'
    ? 'status-warn'
    : s === 'High' || s === '[!]' || s === 'Critical'
    ? 'status-bad'
    : 'muted-status';

const rateDeltaLabel = (d) =>
  d === 0 ? '0 (Maintain Rate)' : d > 0 ? `+${d} (Accelerating)` : `${d} (Decelerating)`;

/* ━━━━━━━━━━ SIMULATION CORE ━━━━━━━━━━ */
// const createInitialGame = (settings, phase) => ({
//   phase,
//   tick: 0,
//   playerRate: settings.initialRate,
//   peakRate: settings.initialRate,
//   playerQueue: 0,
//   otherQueue: 0,
//   totalScore: 0,
//   totalDelivered: 0,
//   totalDropped: 0,
//   totalSent: 0,
//   totalBandwidth:0,
//   congestionEvents: 0,
//   aimdRate: settings.initialRate,
//   sentWindow: [],
//   droppedWindow: [],
//   histTP: [],
//   histLoss: [],
//   histLat: [],
//   histDelta: [],
//   histAIMD: [],
//   aimdLog: [],
//   packets: [],
//   lastResult: null
// });

// const buildPackets = ({ t, sent, dropped, delivered }) =>
//   Array.from({ length: sent }, (_, i) => {
//     let state = 'inFlight';
//     if (i < dropped) state = 'dropped';
//     else if (i < dropped + delivered) state = 'acked';
//     return { id: `${t}-${i}`, sequence: i + 1, state };
//   });

// function simulateTick(prev, settings, delta) {
//   if (prev.tick >= settings.maxTicks) return { ...prev, phase: PHASE.FINISHED };

//   const t = prev.tick + 1;
//   const playerRate = clamp(prev.playerRate + delta, MIN_RATE, MAX_RATE);
//   const bw = Math.round(Math.max(5, getBandwidth(settings.scenario, t)));
//   const ot = Math.round(Math.max(0, getOtherTraffic(settings.scenario, t)));

//   const pArr = playerRate;
//   const oArr = ot;
//   const curQ = prev.playerQueue + prev.otherQueue;
//   const overflow = Math.max(0, curQ + pArr + oArr - settings.bufferSize);
//   const pDrop = overflow ? Math.min(Math.ceil((pArr / (pArr + oArr)) * overflow), pArr) : 0;
//   const oDrop = overflow - pDrop;

//   let playerQ = prev.playerQueue + pArr - pDrop;
//   let otherQ = prev.otherQueue + oArr - oDrop;
//   const qLen = playerQ + otherQ;
//   const served = Math.min(qLen, bw);
//   const pDel = qLen ? Math.round((playerQ / qLen) * served) : 0;

//   playerQ = Math.max(0, playerQ - pDel);
//   otherQ = Math.max(0, otherQ - (served - pDel));

//   const latency = bw ? (playerQ + otherQ) / bw : 10;
//   const latNorm = Math.min(1, latency / 6);

//   const sentWindow = boundedPush(prev.sentWindow, pArr, LOSS_WINDOW);
//   const droppedWindow = boundedPush(prev.droppedWindow, pDrop, LOSS_WINDOW);
//   const lossRate =
//     sentWindow.reduce((s, v) => s + v, 0)
//       ? droppedWindow.reduce((s, v) => s + v, 0) /
//         sentWindow.reduce((s, v) => s + v, 0)
//       : 0;

//   const utilBonus = pDel && lossRate < 0.01 ? UTIL_BONUS : 0;
//   const scoreΔ = REWARD * pDel - DROP_PENALTY * pDrop + utilBonus;
//   const congestion = pDrop > 0 || latNorm > 0.75;
//   const aimdRate = congestion ? Math.max(1, prev.aimdRate / 2) : Math.min(MAX_RATE, prev.aimdRate + 1);

//   const tpNorm = playerRate ? Math.min(1, pDel / playerRate) : 0;
//   const deltaNorm = clamp((scoreΔ + 15) / 35, 0, 1);
//   const aimdNorm = Math.min(1, aimdRate / 50);

//   const aimdRow = {
//     tick: t,
//     aimdRate: Math.round(aimdRate),
//     playerRate,
//     congestion,
//     action: congestion ? `÷2 → ${Math.round(aimdRate)}` : `+1 → ${Math.round(aimdRate)}`
//   };

//   return {
//     ...prev,
//     phase: t >= settings.maxTicks ? PHASE.FINISHED : PHASE.RUNNING,
//     tick: t,
//     playerRate,
//     peakRate: Math.max(prev.peakRate, playerRate),
//     playerQueue: playerQ,
//     otherQueue: otherQ,
//     totalScore: prev.totalScore + scoreΔ,
//     totalDelivered: prev.totalDelivered + pDel,
//     totalDropped: prev.totalDropped + pDrop,
//     // simulateTick's return value
//     totalSent: prev.totalSent + pArr,
//     totalBandwidth: prev.totalBandwidth + bw,
//     congestionEvents: prev.congestionEvents + (congestion ? 1 : 0),
//     aimdRate,
//     sentWindow,
//     droppedWindow,
//     histTP: boundedPush(prev.histTP, tpNorm, HISTORY_LEN),
//     histLoss: boundedPush(prev.histLoss, lossRate, HISTORY_LEN),
//     histLat: boundedPush(prev.histLat, latNorm, HISTORY_LEN),
//     histDelta: boundedPush(prev.histDelta, deltaNorm, HISTORY_LEN),
//     histAIMD: boundedPush(prev.histAIMD, aimdNorm, HISTORY_LEN),
//     aimdLog: [aimdRow, ...prev.aimdLog].slice(0, 25),
//     packets: buildPackets({ t, sent: pArr, dropped: pDrop, delivered: Math.min(pDel, pArr - pDrop) }),
//     lastResult: {
//       bw,
//       ot,
//       pArr,
//       pDrop,
//       pDel,
//       latNorm,
//       lossRate,
//       scoreΔ,
//       congestion,
//       queue: playerQ + otherQ,
//       playerRate
//     }
//   };
// }

/* ━━━━━━━━━━ PRESENTATION COMPONENTS ━━━━━━━━━━ */
function PacketGrid({ packets, playerRate }) {
  const cells = useMemo(() => {
    const visible = Math.max(24, Math.min(96, Math.ceil(playerRate / 8) * 8));
    return [
      ...packets,
      ...Array.from({ length: Math.max(0, visible - packets.length) }, (_, i) => ({
        id: `e-${i}`,
        state: 'empty',
        sequence: ''
      }))
    ];
  }, [packets, playerRate]);

  return (
    <div className="packet-grid-wrap">
      <div className="packet-grid-meta">
        <span>Current send rate: {playerRate} pkts/tick</span>
        <span>{packets.length ? 'Latest tick packet window' : 'Waiting for first tick'}</span>
      </div>
      <div className="packet-grid">
        {cells.map((p) => (
          <div key={p.id} className={`packet-cell packet-${p.state}`}>
            {PACKET_STATUS_LABEL[p.state]}
          </div>
        ))}
      </div>
      <div className="packet-legend">
        <span><i className="legend-box in-flight" /> In-flight</span>
        <span><i className="legend-box acked" /> Acknowledged</span>
        <span><i className="legend-box dropped" /> Dropped</span>
      </div>
    </div>
  );
}


function HowToPlayPanel() {
  return (
    <section className="panel how-to-play">
      <div className="panel-header">▶ What Is This Game &amp; Why Play It</div>
      <div className="panel-body">
        <p>
          You play a data sender sharing one network link with background
          traffic. Every tick you decide how fast to send — the same
          trade-off every real TCP connection makes, thousands of times a
          second, without you ever noticing. Here, you get to feel it happen
          in slow motion.
        </p>

        <p>
          <strong>Why it's worth playing:</strong> reading about congestion
          control tells you the rules; playing it builds the intuition —
          why speeding up feels great until it suddenly isn't, and why
          playing it too safe quietly wastes the bandwidth you paid for.
        </p>

        <div className="how-to-play-grid">
          <div>
            <h4>What to watch</h4>
            <ul>
              <li><strong>TP (Throughput)</strong> — how much of what you send actually gets through.</li>
              <li><strong>Loss</strong> — the share of your packets dropped in the last 20 ticks.</li>
              <li><strong>Lat (Latency)</strong> — how backed-up the shared queue is.</li>
              <li><strong>Ghost</strong> — a reference sender playing it "by the book" (classic AIMD). Beating it is the real goal.</li>
            </ul>
          </div>

          <div>
            <h4>What to increase / decrease</h4>
            <ul>
              <li><strong>Increase rate</strong> when Loss is 0%, Latency is low or falling, and Ghost sits above your current rate.</li>
              <li><strong>Decrease rate</strong> right after any drop, or once Latency climbs past roughly 0.7 — don't wait for a drop to confirm what Latency is already telling you.</li>
              <li><strong>Hold steady</strong> when you're tracking close to Ghost with clean delivery — that's usually close to the sweet spot.</li>
            </ul>
          </div>
        </div>

        <p className="how-to-play-footnote">
          Full scoring rules, the exact simulation formulas, and detailed
          strategy tips are in the reference table below — worth a skim
          before your first round.
        </p>
      </div>
    </section>
  );
}

function AlgorithmReferencePanel() {
  const rows = [
    ['Buffer model', "Finite FIFO queue shared between you and background traffic. Separate counters track each sender's packets so drops are attributed fairly."],
    ['Overflow policy', 'Tail-drop: when the queue overflows, drops are split proportionally between you and other traffic based on how much each sent that tick.'],
    ['Service / drain', 'Each tick, served = min(queueLength, bandwidth). Your delivered share is served × (your queue ÷ total queue).'],
    ['Latency', 'queueAfterService ÷ bandwidth, normalized to 0–1 (capped at 6× bandwidth). A consequence of congestion, not something you set directly.'],
    ['Loss rate', 'Rolling 20-tick window: drops in that window ÷ packets sent in that window.'],
    ['Scoring', `+${REWARD.toFixed(1)} per packet delivered, −${DROP_PENALTY.toFixed(1)} per packet dropped, +${UTIL_BONUS.toFixed(1)} bonus per tick when you deliver packets with under 1% loss. Drops cost 4× more than deliveries earn.`],
    ['AIMD ghost', 'A reference sender using classic TCP Reno rules: congestion → rate ÷ 2 (multiplicative decrease); no congestion → rate + 1 (additive increase). Beat it by finding a higher stable rate without triggering more drops.'],
    ['Scenarios', 'Stable Bandwidth: fixed 30 pkts/tick, gentle background traffic. Bursty Traffic: fixed 30 pkts/tick, background mostly light with a 10% chance of a heavy burst each tick. Oscillating Network: both bandwidth and background traffic swing up and down together.'],
    [
      'Strategy tips',
      [
        'Ramp up gradually — a dropped packet costs 4× more than a delivered one earns, so aggressive jumps rarely pay off.',
        'Track near the AIMD Ghost line rather than far above it. Ghost never overshoots (halves on congestion, +1 otherwise), so matching it usually means zero drops.',
        "The +0.5 bonus needs delivery AND under 1% loss in the rolling window — one bad burst can wipe out several ticks of bonus, so back off early rather than waiting it out.",
        'Latency over 0.75 counts as congestion even with zero drops — ease off once Lat is climbing, not just after a drop happens.',
        'Prefer small, frequent rate changes (±1–2) over big swings. The buffer is a fixed size, so overshooting fills it fast and cuts everyone\u2019s packets proportionally.'
      ]
    ]
  ];

  return (
    <section className="panel algo-reference">
      <div className="panel-header">▶ Algorithm Reference — How the Simulation Works</div>
      <table className="cf-table algo-reference-table">
        <thead>
          <tr><th>Concept</th><th>Description</th></tr>
        </thead>
        <tbody>
          {rows.map(([concept, description]) => (
            <tr key={concept}>
              <td className="algo-reference-concept">{concept}</td>
              <td>
                {Array.isArray(description) ? (
                  <ul className="algo-reference-tips">
                    {description.map((tip) => (
                      <li key={tip}>{tip}</li>
                    ))}
                  </ul>
                ) : (
                  description
                )}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </section>
  );
}


function HistoryCanvas({ game }) {
  const ref = useRef(null);

  const draw = useCallback(() => {
    const c = ref.current;
    if (!c) return;
    c.width = c.offsetWidth;
    c.height = c.offsetHeight;
    const { width, height } = c;
    const ctx = c.getContext('2d');

    ctx.fillStyle = '#fafafa';
    ctx.fillRect(0, 0, width, height);

    ctx.strokeStyle = '#e0e0e0';
    ctx.lineWidth = 0.5;
    [0.25, 0.5, 0.75].forEach((f) => {
      ctx.beginPath();
      ctx.moveTo(0, height * f);
      ctx.lineTo(width, height * f);
      ctx.stroke();
    });

    const series = [
      { d: game.histTP, c: '#2e86c1' },
      { d: game.histLoss, c: '#cc0000' },
      { d: game.histLat, c: '#d4ac0d' },
      { d: game.histDelta, c: '#27ae60' },
      { d: game.histAIMD, c: '#8e44ad' }
    ];

    series.forEach(({ d, c }) => {
      if (d.length < 2) return;
      ctx.beginPath();
      ctx.strokeStyle = c;
      ctx.lineWidth = 1.5;
      d.forEach((v, i) => {
        const x = (i / (d.length - 1)) * width;
        const y = height - 4 - clamp(v, 0, 1) * (height - 8);
        i ? ctx.lineTo(x, y) : ctx.moveTo(x, y);
      });
      ctx.stroke();
    });
  }, [game]);

  useEffect(() => draw(), [draw, game]);
  useEffect(() => {
    const f = () => draw();
    window.addEventListener('resize', f);
    return () => window.removeEventListener('resize', f);
  }, [draw]);

  return <canvas ref={ref} className="history-canvas" />;
}

function ResultsOverlay({ game, settings, onReset, saveState }) {
  const lossRate = game.totalSent ? game.totalDropped / game.totalSent : 0;
  const efficiency = game.totalSent ? game.totalDelivered / game.totalSent : 0;
  const [tier, tierClass] = tierFromScore(game.totalScore);

  return (
    <div className="results-overlay">
      <div className="results-card">
        <h3>Round Results</h3>
        <table className="cf-table results-table">
          <tbody>
            <tr><td className="result-label">Total Score</td><td className="result-value">{Math.round(game.totalScore)}</td></tr>
            <tr><td className="result-label">Ticks Completed</td><td className="result-value">{game.tick}</td></tr>
            <tr><td className="result-label">Packets Sent</td><td className="result-value">{game.totalSent}</td></tr>
            <tr><td className="result-label">Delivered</td><td className="result-value status-ok">{game.totalDelivered}</td></tr>
            <tr><td className="result-label">Dropped</td><td className="result-value status-bad">{game.totalDropped}</td></tr>
            <tr><td className="result-label">Loss Rate</td><td className="result-value">{(lossRate * 100).toFixed(2)} %</td></tr>
            <tr><td className="result-label">Efficiency</td><td className="result-value">{(efficiency * 100).toFixed(2)} %</td></tr>
            <tr><td className="result-label">Congestion Events</td><td className="result-value">{game.congestionEvents}</td></tr>
            <tr><td className="result-label">Rating Tier</td><td className={`result-value ${tierClass}`}>{tier}</td></tr>
          </tbody>
        </table>

        <div className="save-status-row">
          {saveState.status === 'saving' && (
            <p className="muted-text">Saving your score...</p>
          )}

          {saveState.status === 'saved' && saveState.rating && (
            <p className="status-ok">
              ✓ Score saved — rating {saveState.rating.previousRating} →{' '}
              {saveState.rating.newRating} (
              {saveState.rating.delta >= 0 ? '+' : ''}
              {saveState.rating.delta})
            </p>
          )}

          {saveState.status === 'error' && (
            <p className="form-error">{saveState.error}</p>
          )}

          {saveState.status === 'guest' && (
            <p className="muted-text">
              <Link to="/login">Login</Link> to save this score to your profile
              and appear on the leaderboard.
            </p>
          )}
        </div>
            <GameReviewPanel game={game} settings={settings} />
            <button className="cf-btn primary play-again-btn" onClick={onReset}>Play Again</button>
      </div>
    </div>
  );
}

/* ━━━━━━━━━━ MAIN PAGE COMPONENT ━━━━━━━━━━ */

function GamePage() {
  const navigate = useNavigate();
  const { isAuthenticated, refreshProfile } = useAuth();

  /* settings state */
  const [settings, setSettings] = useState({
  scenario: 1,
  maxTicks: 80,
  bufferSize: 50,
  initialRate: 10,
  competitor: 'none'
});

  /* game state */
  const [game, setGame] = useState(() => createInitialGame(settings, PHASE.SETUP));
  const [rateDelta, setRateDelta] = useState(0);
  const [auto, setAuto] = useState(false);
  const [speed, setSpeed] = useState(400);
  const [saveState, setSaveState] = useState({ status: 'idle', rating: null, error: '' });

  const submittedRef = useRef(false);
  const startTimeRef = useRef(null);

  const progress = Math.round((game.tick / settings.maxTicks) * 100);
  const result = game.lastResult;

  const metrics = useMemo(() => {
    const bufFrac = result ? result.queue / settings.bufferSize : 0;
    const tpFrac = result && game.playerRate ? result.pDel / game.playerRate : 0;
    const loss = result ? result.lossRate : 0;

    return [
      ['Current Tick', `${game.tick} / ${settings.maxTicks}`, ''],
      ['Send Rate', `${game.playerRate} pkts/tick`, rateDelta ? 'Δ' : 'Stable'],
      ['Rate Delta', rateDeltaLabel(rateDelta), ''],
      ['Buffer Fill', result ? `${result.queue}/${settings.bufferSize}` : '—', bufFrac > 0.85 ? 'Critical' : bufFrac > 0.6 ? 'Warning' : 'OK'],
      ['Throughput', result ? `${result.pDel} pkts/tick` : '—', tpFrac > 0.75 ? 'Good' : tpFrac > 0.3 ? 'Warning' : 'Low'],
      ['Latency (norm)', result ? result.latNorm.toFixed(3) : '—', result && result.latNorm > 0.7 ? 'High' : result && result.latNorm > 0.3 ? 'Medium' : 'Low'],
      ['Loss Rate (20)', `${(loss * 100).toFixed(1)} %`, loss > 0.1 ? 'High' : loss > 0.02 ? 'Warning' : 'Good'],
      ['Dropped (tick)', result ? result.pDrop : '—', result && result.pDrop ? '[!]' : 'OK'],
      ['Score Δ (tick)', result ? `${result.scoreΔ >= 0 ? '+' : ''}${result.scoreΔ.toFixed(1)}` : '—', result && result.scoreΔ < 0 ? 'High' : 'Good'],
      ['Total Score', Math.round(game.totalScore), ''],
      ['AIMD Ghost', Math.round(game.aimdRate), 'reference'],
      ['Congestion?', result ? (result.congestion ? 'YES [!]' : 'No') : '—', result && result.congestion ? '[!]' : 'OK'],
      ['Congestion Events', game.congestionEvents, '']
    ];
  }, [game, rateDelta, result, settings.bufferSize, settings.maxTicks]);

  /* handlers */
const updateSetting = (k, v) => setSettings((s) => ({ ...s, [k]: Number(v) }));
const updateCompetitor = (v) => setSettings((s) => ({ ...s, competitor: v }));

  const reset = () => {
    setRateDelta(0);
    setAuto(false);
    setGame(createInitialGame(settings, PHASE.SETUP));
    submittedRef.current = false;
    setSaveState({ status: 'idle', rating: null, error: '' });
    window.scrollTo({ top: 0 });
  };

  const startGame = () => {
    const safe = {
    scenario: clamp(settings.scenario, 1, 3),
    maxTicks: clamp(settings.maxTicks, 10, 300),
    bufferSize: clamp(settings.bufferSize, 10, 200),
    initialRate: clamp(settings.initialRate, MIN_RATE, MAX_RATE),
    competitor: settings.competitor
  };
    setSettings(safe);
    setRateDelta(0);
    setAuto(false);
    submittedRef.current = false;
    setSaveState({ status: 'idle', rating: null, error: '' });
    startTimeRef.current = Date.now();
    setGame(createInitialGame(safe, PHASE.RUNNING));
  };

  const endGame = () => setGame((g) => ({ ...g, phase: PHASE.FINISHED }));

  const tickOnce = useCallback(
    () => setGame((g) => simulateTick(g, settings, rateDelta)),
    [rateDelta, settings]
  );

  /* submit the finished round to the backend so rating/streak/heatmap update */
  useEffect(() => {
    if (game.phase !== PHASE.FINISHED || submittedRef.current) return;
    submittedRef.current = true;

    if (!isAuthenticated) {
      setSaveState({ status: 'guest', rating: null, error: '' });
      return;
    }

    const durationInSeconds = startTimeRef.current
      ? Math.max(1, Math.round((Date.now() - startTimeRef.current) / 1000))
      : Math.max(1, game.tick);

    setSaveState({ status: 'saving', rating: null, error: '' });

    // the submission call
      submitGameSession({
        gameType: 'TCP_CONGESTION',
        score: Math.max(0, Math.round(game.totalScore)),
        peakWindowSize: Math.round(game.peakRate),
        timeoutsCount: game.congestionEvents,
        totalSent: game.totalSent,
        totalDelivered: game.totalDelivered,
        totalDropped: game.totalDropped,
        totalBandwidthAvailable: Math.round(game.totalBandwidth),
        ticks: game.tick,
        durationInSeconds
      })
      .then((response) => {
        setSaveState({ status: 'saved', rating: response.data.rating, error: '' });
        refreshProfile().catch(() => {});
      })
      .catch((error) => {
        setSaveState({
          status: 'error',
          rating: null,
          error: error.message || 'Failed to save this score. Please try again.'
        });
      });
  // the effect's dependency array
    }, [
      game.phase,
      game.totalScore,
      game.peakRate,
      game.congestionEvents,
      game.totalSent,
      game.totalDelivered,
      game.totalDropped,
      game.totalBandwidth,
      game.tick,
      isAuthenticated,
      refreshProfile
    ]);
  /* timers & shortcuts */
  useEffect(() => {
    if (game.phase !== PHASE.RUNNING || !auto) return;
    const id = setInterval(tickOnce, speed);
    return () => clearInterval(id);
  }, [auto, speed, tickOnce, game.phase]);

  useEffect(() => {
    if (game.phase !== PHASE.RUNNING && auto) setAuto(false);
  }, [game.phase, auto]);

  useEffect(() => {
    const key = (e) => {
      if (game.phase !== PHASE.RUNNING) return;
      if (e.key === ' ' || e.key === 'Enter') {
        e.preventDefault();
        tickOnce();
      } else if (['ArrowRight', 'ArrowUp'].includes(e.key)) {
        e.preventDefault();
        setRateDelta((d) => clamp(d + 1, -10, 10));
      } else if (['ArrowLeft', 'ArrowDown'].includes(e.key)) {
        e.preventDefault();
        setRateDelta((d) => clamp(d - 1, -10, 10));
      }
    };
    window.addEventListener('keydown', key);
    return () => window.removeEventListener('keydown', key);
  }, [tickOnce, game.phase]);

  /* page shortcuts */
  const inSetup = game.phase === PHASE.SETUP;
  const inRun = game.phase === PHASE.RUNNING;
  const inFinish = game.phase === PHASE.FINISHED;

  return (
    <>
      {/* internal anchor for router nav back */}
      <button
        style={{ position: 'absolute', top: 8, left: 8 }}
        className="cf-btn"
        onClick={() => navigate('/')}
      >
        ⇠ Home
      </button>

      {/* SETUP */}
      {inSetup && (
        <div className="content">
          <HowToPlayPanel />

          <section className="panel">
            <div className="panel-header">▶ Round Setup</div>
            <div className="panel-body">
              <div className="setup-grid">
                <label>
                  <span>Scenario</span>
                  <select value={settings.scenario} onChange={(e) => updateSetting('scenario', e.target.value)}>
                    <option value="1">Stable bandwidth</option>
                    <option value="2">Bursty traffic</option>
                    <option value="3">Oscillating network</option>
                  </select>
                </label>
                <label>
                  <span>Round Length</span>
                  <input type="number" min="10" max="300" value={settings.maxTicks} onChange={(e) => updateSetting('maxTicks', e.target.value)} />
                </label>
                <label>
                  <span>Buffer Size</span>
                  <input type="number" min="10" max="200" value={settings.bufferSize} onChange={(e) => updateSetting('bufferSize', e.target.value)} />
                </label>
                <label>
                  <span>Initial Rate</span>
                  <input type="number" min="1" max="80" value={settings.initialRate} onChange={(e) => updateSetting('initialRate', e.target.value)} />
                </label>
                <label>
                  <span>Competitor Algorithm</span>
                  <select value={settings.competitor} onChange={(e) => updateCompetitor(e.target.value)}>
                    {COMPETITOR_OPTIONS.map((option) => (
                      <option key={option.value} value={option.value}>{option.label}</option>
                    ))}
                  </select>
                </label>
              </div>
              <p className="competitor-hint">
                {settings.competitor === 'none'
                  ? 'Optional: pick an engine to run alongside you for a post-game comparison and coaching report.'
                  : 'The engine plays the exact same bandwidth and background traffic as you, independently — like a chess engine analyzing the same position.'}
              </p>
              <button className="cf-btn primary" style={{ marginTop: 12 }} onClick={startGame}>
                ▶ Start Game
              </button>
            </div>
          </section>

          <AlgorithmReferencePanel />
        </div>
      )}

      {/* RUNNING */}
      {inRun && (
        <div className="content">
          <section className="panel">
            <div className="panel-header grey">Round Progress</div>
            <div className="panel-body compact">
              <div className="progress-copy">Tick {game.tick} of {settings.maxTicks} ({progress}%)</div>
              <div className="tick-progress-wrap">
                <div className="tick-progress-fill" style={{ width: `${progress}%` }} />
                <div className="tick-progress-label">{game.tick}/{settings.maxTicks}</div>
              </div>
            </div>
          </section>

          <section className="game-grid">
            {/* metrics */}
            <aside className="game-column metrics-column">
              <div className="panel-header">▶ Live Metrics</div>
              <table className="cf-table">
                <thead><tr><th>Metric</th><th className="right">Value</th><th>Status</th></tr></thead>
                <tbody>
                  {metrics.map(([l, v, s]) => (
                    <tr key={l}><td>{l}</td><td className="value-cell">{v}</td><td className={statusToClass(s)}>{s}</td></tr>
                  ))}
                </tbody>
              </table>
            </aside>

            {/* visualizer */}
            <section className="game-column visualizer-column" id="visualizer">
              <div className="panel-header">▶ History & Packet Window</div>

              <div className="legend-row">
                <span><i className="legend-swatch swatch-throughput" /> TP — Throughput (delivered ÷ sent, higher is better)</span>
                <span><i className="legend-swatch swatch-loss" /> Loss — packets dropped in the last 20 ticks</span>
                <span><i className="legend-swatch swatch-latency" /> Lat — queue delay, normalized 0–1</span>
                <span><i className="legend-swatch swatch-score" /> Δ — score earned this tick</span>
                <span><i className="legend-swatch swatch-aimd" /> Ghost — AIMD reference rate</span>
              </div>

              <p className="chart-tutorial">
                All 5 lines share one 0–1 scale so you can compare them at a glance. Watch for
                <strong> TP dropping</strong> while <strong>Loss rises</strong> — that's congestion.
                If <strong>Ghost</strong> sits above your rate, you can safely speed up; if it's
                below, you're pushing too hard.
              </p>

              <div className="canvas-frame"><HistoryCanvas game={game} /></div>
              <PacketGrid packets={game.packets} playerRate={game.playerRate} />
            </section>
          </section>

          {/* controls */}
          <section className="control-panel">
            <div className="panel-header dark">▶ Controls</div>
            <div className="control-row">
              <span className="row-label">Simulation:</span>
              <button className="cf-btn primary" onClick={tickOnce}>▶ Tick</button>
              <button className={`cf-btn ${auto ? 'btn-auto-active' : ''}`} onClick={() => setAuto((v) => !v)}>
                {auto ? '⏸ Pause' : '▶ Auto-Play'}
              </button>
              <button className="cf-btn danger" onClick={endGame}>■ End Round</button>
              <span className="inline-label">Speed:</span>
              <select className="speed-select" value={speed} onChange={(e) => setSpeed(Number(e.target.value))}>
                {SPEED_OPTIONS.map(([v, l]) => <option key={v} value={v}>{l}</option>)}
              </select>
            </div>
            <div className="control-row delta-row">
              <span className="row-label">Acceleration:</span>
              <input className="delta-slider" type="range" min="-10" max="10" step="1" value={rateDelta} onChange={(e) => setRateDelta(Number(e.target.value))} />
              <span className="delta-value">{rateDeltaLabel(rateDelta)}</span>
              <button className="cf-btn" onClick={() => setRateDelta(0)}>Reset</button>
            </div>
            <div className="delta-scale"><span>-10</span><span>0</span><span>+10</span></div>
          </section>
        </div>
      )}

      {/* FINISHED */}
      {inFinish && <ResultsOverlay game={game} settings={settings} onReset={reset} saveState={saveState} />}    </>
  );
}

export default GamePage;