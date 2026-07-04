import { useCallback, useEffect, useMemo, useRef, useState } from 'react';

import './styles/codeforces.css';

const REWARD = 1.0;
const DROP_PENALTY = 4.0;
const UTIL_BONUS = 0.5;
const LOSS_WINDOW = 20;
const HISTORY_LEN = 80;
const MIN_RATE = 1;
const MAX_RATE = 80;

const SPEED_OPTIONS = [
  ['800', 'Slow'],
  ['400', 'Normal'],
  ['150', 'Fast'],
  ['40', 'Turbo']
];

const SCENARIO_NAMES = {
  1: 'Scenario 1 — Stable Bandwidth',
  2: 'Scenario 2 — Bursty Traffic',
  3: 'Scenario 3 — Shifting Bandwidth'
};

const PACKET_STATUS_LABEL = {
  acked: 'ACK',
  dropped: 'DROP',
  inFlight: 'FLY',
  empty: ''
};

function clamp(value, min, max) {
  return Math.max(min, Math.min(max, value));
}

function boundedPush(items, nextValue, limit) {
  const next = [...items, nextValue];
  return next.length > limit ? next.slice(next.length - limit) : next;
}

function getBandwidth(scenario, tick) {
  if (scenario === 1) return 30;
  if (scenario === 2) return 28;
  if (scenario === 3) return 14 + 20 * Math.abs(Math.sin(tick / 25));

  return 30;
}

function getOtherTraffic(scenario, tick) {
  if (scenario === 1) {
    return 8 + 4 * Math.sin(tick / 15);
  }

  if (scenario === 2) {
    return Math.random() < 0.1
      ? 20 + Math.random() * 16
      : 4 + Math.random() * 5;
  }

  if (scenario === 3) {
    return 6 + 3 * Math.sin(tick / 10);
  }

  return 8;
}

function createInitialGame(settings, active = false) {
  return {
    active,
    completed: false,
    tick: 0,
    playerRate: settings.initialRate,
    playerQueue: 0,
    otherQueue: 0,
    totalScore: 0,
    totalDelivered: 0,
    totalDropped: 0,
    totalSent: 0,
    congestionEvents: 0,
    aimdRate: settings.initialRate,
    sentWindow: [],
    droppedWindow: [],
    histTP: [],
    histLoss: [],
    histLat: [],
    histDelta: [],
    histAIMD: [],
    aimdLog: [],
    packets: [],
    lastResult: null
  };
}

function buildPackets({ tick, sent, dropped, delivered }) {
  return Array.from({ length: sent }, (_, index) => {
    let state = 'inFlight';

    if (index < dropped) {
      state = 'dropped';
    } else if (index < dropped + delivered) {
      state = 'acked';
    }

    return {
      id: `${tick}-${index + 1}`,
      sequence: index + 1,
      state
    };
  });
}

function simulateTick(prev, settings, rateDelta) {
  if (!prev.active || prev.tick >= settings.maxTicks) {
    return {
      ...prev,
      active: false,
      completed: prev.tick > 0
    };
  }

  const tick = prev.tick + 1;
  const playerRate = clamp(prev.playerRate + rateDelta, MIN_RATE, MAX_RATE);

  const rawBW = Math.max(5, getBandwidth(settings.scenario, tick));
  const rawOT = Math.max(
    0,
    getOtherTraffic(settings.scenario, tick) + (Math.random() - 0.5) * 2
  );

  const bw = Math.round(rawBW);
  const ot = Math.round(rawOT);

  const pArr = playerRate;
  const oArr = ot;
  const arrivals = pArr + oArr;

  const curQ = prev.playerQueue + prev.otherQueue;
  const overflow = Math.max(0, curQ + arrivals - settings.bufferSize);

  let pDrop = 0;
  let oDrop = 0;

  if (overflow > 0) {
    const pShare = arrivals > 0 ? pArr / arrivals : 0.5;
    pDrop = Math.min(Math.ceil(overflow * pShare), pArr);
    oDrop = Math.min(overflow - pDrop, oArr);
  }

  let playerQueue = prev.playerQueue + pArr - pDrop;
  let otherQueue = prev.otherQueue + oArr - oDrop;

  const qLen = playerQueue + otherQueue;
  const served = Math.min(qLen, bw);

  let pDel = 0;
  let oDel = 0;

  if (qLen > 0) {
    pDel = Math.round(served * (playerQueue / qLen));
    oDel = served - pDel;
  }

  playerQueue = Math.max(0, playerQueue - pDel);
  otherQueue = Math.max(0, otherQueue - oDel);

  const qAfter = playerQueue + otherQueue;
  const latency = bw > 0 ? qAfter / bw : 10;
  const latNorm = Math.min(1, latency / 6);

  const sentWindow = boundedPush(prev.sentWindow, pArr, LOSS_WINDOW);
  const droppedWindow = boundedPush(prev.droppedWindow, pDrop, LOSS_WINDOW);

  const sentInWindow = sentWindow.reduce((sum, value) => sum + value, 0);
  const droppedInWindow = droppedWindow.reduce((sum, value) => sum + value, 0);
  const lossRate = sentInWindow > 0 ? droppedInWindow / sentInWindow : 0;

  const utilBonus = pDel > 0 && lossRate < 0.01 ? UTIL_BONUS : 0;
  const scoreDelta = REWARD * pDel - DROP_PENALTY * pDrop + utilBonus;

  const congestion = pDrop > 0 || latNorm > 0.75;
  const aimdRate = congestion
    ? Math.max(1, prev.aimdRate / 2)
    : Math.min(MAX_RATE, prev.aimdRate + 1);

  const tpNorm = playerRate > 0 ? Math.min(1, pDel / playerRate) : 0;
  const deltaNorm = clamp((scoreDelta + 15) / 35, 0, 1);
  const aimdNorm = Math.min(1, aimdRate / 50);

  const result = {
    bw,
    ot,
    pArr,
    pDrop,
    pDel,
    latNorm,
    lossRate,
    scoreDelta,
    congestion,
    qAfter,
    served,
    playerRate
  };

  const aimdLogRow = {
    tick,
    aimdRate: Math.round(aimdRate),
    playerRate,
    congestion,
    action: congestion
      ? `÷2 → ${Math.round(aimdRate)}`
      : `+1 → ${Math.round(aimdRate)}`
  };

  return {
    ...prev,
    active: tick < settings.maxTicks,
    completed: tick >= settings.maxTicks,
    tick,
    playerRate,
    playerQueue,
    otherQueue,
    totalScore: prev.totalScore + scoreDelta,
    totalDelivered: prev.totalDelivered + pDel,
    totalDropped: prev.totalDropped + pDrop,
    totalSent: prev.totalSent + pArr,
    congestionEvents: prev.congestionEvents + (congestion ? 1 : 0),
    aimdRate,
    sentWindow,
    droppedWindow,
    histTP: boundedPush(prev.histTP, tpNorm, HISTORY_LEN),
    histLoss: boundedPush(prev.histLoss, lossRate, HISTORY_LEN),
    histLat: boundedPush(prev.histLat, latNorm, HISTORY_LEN),
    histDelta: boundedPush(prev.histDelta, deltaNorm, HISTORY_LEN),
    histAIMD: boundedPush(prev.histAIMD, aimdNorm, HISTORY_LEN),
    aimdLog: [aimdLogRow, ...prev.aimdLog].slice(0, 25),
    packets: buildPackets({
      tick,
      sent: pArr,
      dropped: pDrop,
      delivered: Math.min(pDel, Math.max(0, pArr - pDrop))
    }),
    lastResult: result
  };
}

function getRateDeltaLabel(rateDelta) {
  if (rateDelta === 0) return '0 (Maintain Rate)';
  if (rateDelta > 0) return `+${rateDelta} (Accelerating)`;

  return `${rateDelta} (Decelerating)`;
}

function statusToClass(status) {
  if (status === 'Good' || status === 'OK' || status === 'Low') return 'status-ok';
  if (status === 'Warning' || status === 'Medium') return 'status-warn';
  if (status === 'High' || status === '[!]' || status === 'Critical') return 'status-bad';

  return 'muted-status';
}

function PacketGrid({ packets, playerRate }) {
  const visibleCells = Math.max(24, Math.min(96, Math.ceil(playerRate / 8) * 8));

  const cells = [
    ...packets,
    ...Array.from({ length: Math.max(0, visibleCells - packets.length) }, (_, index) => ({
      id: `empty-${index}`,
      state: 'empty',
      sequence: ''
    }))
  ];

  return (
    <div className="packet-grid-wrap">
      <div className="packet-grid-meta">
        <span>Current send rate: {playerRate} pkts/tick</span>
        <span>{packets.length ? 'Latest tick packet window' : 'Waiting for first tick'}</span>
      </div>

      <div className="packet-grid" aria-label="TCP packet visualizer">
        {cells.map((packet) => (
          <div
            key={packet.id}
            className={`packet-cell packet-${packet.state}`}
            title={packet.sequence ? `Packet #${packet.sequence} · ${packet.state}` : ''}
          >
            {PACKET_STATUS_LABEL[packet.state]}
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

function HistoryCanvas({ game }) {
  const canvasRef = useRef(null);

  const draw = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    canvas.width = canvas.offsetWidth || 400;
    canvas.height = canvas.offsetHeight || 175;

    const ctx = canvas.getContext('2d');
    const width = canvas.width;
    const height = canvas.height;

    ctx.clearRect(0, 0, width, height);

    ctx.fillStyle = '#fafafa';
    ctx.fillRect(0, 0, width, height);

    ctx.strokeStyle = '#e0e0e0';
    ctx.lineWidth = 0.5;

    [0.25, 0.5, 0.75].forEach((frac) => {
      ctx.beginPath();
      ctx.moveTo(0, height * frac);
      ctx.lineTo(width, height * frac);
      ctx.stroke();
    });

    const series = [
      { data: game.histTP, color: '#2e86c1' },
      { data: game.histLoss, color: '#cc0000' },
      { data: game.histLat, color: '#d4ac0d' },
      { data: game.histDelta, color: '#27ae60' },
      { data: game.histAIMD, color: '#8e44ad' }
    ];

    series.forEach(({ data, color }) => {
      if (data.length < 2) return;

      ctx.beginPath();
      ctx.strokeStyle = color;
      ctx.lineWidth = 1.5;

      data.forEach((value, index) => {
        const x = (index / (data.length - 1)) * width;
        const y = height - 4 - clamp(value, 0, 1) * (height - 8);

        if (index === 0) ctx.moveTo(x, y);
        else ctx.lineTo(x, y);
      });

      ctx.stroke();
    });
  }, [game.histAIMD, game.histDelta, game.histLat, game.histLoss, game.histTP]);

  useEffect(() => {
    draw();
  }, [draw]);

  useEffect(() => {
    window.addEventListener('resize', draw);
    return () => window.removeEventListener('resize', draw);
  }, [draw]);

  return <canvas ref={canvasRef} className="history-canvas" />;
}

function App() {
  const [settings, setSettings] = useState({
    scenario: 1,
    maxTicks: 80,
    bufferSize: 50,
    initialRate: 10
  });

  const [game, setGame] = useState(() => createInitialGame(settings));
  const [rateDelta, setRateDelta] = useState(0);
  const [autoRunning, setAutoRunning] = useState(false);
  const [speed, setSpeed] = useState(400);

  const progress = Math.round((game.tick / settings.maxTicks) * 100);
  const result = game.lastResult;

  const metrics = useMemo(() => {
    const bufferFrac = result ? result.qAfter / settings.bufferSize : 0;
    const throughputFrac = result && game.playerRate > 0 ? result.pDel / game.playerRate : 0;
    const lossRate = result ? result.lossRate : 0;

    return [
      ['Current Tick', `${game.tick} / ${settings.maxTicks}`, ''],
      ['Send Rate', `${game.playerRate} pkts/tick`, rateDelta === 0 ? 'Stable' : rateDelta > 0 ? 'Accelerating' : 'Decelerating'],
      ['Rate Delta', getRateDeltaLabel(rateDelta), ''],
      ['Buffer Fill', result ? `${Math.round(result.qAfter)} / ${settings.bufferSize} pkts` : '— / — pkts', bufferFrac > 0.85 ? 'Critical' : bufferFrac > 0.6 ? 'Warning' : 'OK'],
      ['Throughput', result ? `${result.pDel} pkts/tick` : '— pkts/tick', throughputFrac > 0.75 ? 'Good' : throughputFrac > 0.3 ? 'Warning' : 'Low'],
      ['Latency (norm 0–1)', result ? result.latNorm.toFixed(3) : '—', result && result.latNorm > 0.7 ? 'High' : result && result.latNorm > 0.3 ? 'Medium' : 'Low'],
      ['Loss Rate (20-tick window)', `${(lossRate * 100).toFixed(1)} %`, lossRate > 0.1 ? 'High' : lossRate > 0.02 ? 'Warning' : 'Good'],
      ['Packets Dropped (this tick)', result ? `${result.pDrop} pkts` : '—', result && result.pDrop > 0 ? '[!]' : 'OK'],
      ['Score Δ (this tick)', result ? `${result.scoreDelta >= 0 ? '+' : ''}${result.scoreDelta.toFixed(1)}` : '—', result && result.scoreDelta < 0 ? 'High' : 'Good'],
      ['Total Score', Math.round(game.totalScore), ''],
      ['AIMD Ghost Rate', `${Math.round(game.aimdRate)} pkts/tick`, 'reference'],
      ['Congestion This Tick?', result ? (result.congestion ? 'YES [!]' : 'No') : '—', result && result.congestion ? '[!]' : 'OK'],
      ['Total Congestion Events', game.congestionEvents, '']
    ];
  }, [game, rateDelta, result, settings.bufferSize, settings.maxTicks]);

  const updateSetting = (key, value) => {
    const numericValue = Number(value);

    setSettings((prev) => ({
      ...prev,
      [key]: numericValue
    }));
  };

  const startGame = () => {
    const safeSettings = {
      scenario: clamp(settings.scenario, 1, 3),
      maxTicks: clamp(settings.maxTicks, 10, 300),
      bufferSize: clamp(settings.bufferSize, 10, 200),
      initialRate: clamp(settings.initialRate, MIN_RATE, MAX_RATE)
    };

    setSettings(safeSettings);
    setRateDelta(0);
    setAutoRunning(false);
    setGame(createInitialGame(safeSettings, true));
  };

  const stopGame = () => {
    setAutoRunning(false);
    setGame((prev) => ({
      ...prev,
      active: false,
      completed: prev.tick > 0
    }));
  };

  const advanceTick = useCallback(() => {
    setGame((prev) => simulateTick(prev, settings, rateDelta));
  }, [rateDelta, settings]);

  useEffect(() => {
    if (!autoRunning || !game.active) {
      return undefined;
    }

    const timer = window.setInterval(advanceTick, speed);

    return () => window.clearInterval(timer);
  }, [advanceTick, autoRunning, game.active, speed]);

  useEffect(() => {
    if (!game.active && autoRunning) {
      setAutoRunning(false);
    }
  }, [autoRunning, game.active]);

  useEffect(() => {
    const onKeyDown = (event) => {
      if (event.key === 'Enter' || event.key === ' ') {
        if (!game.active) return;

        event.preventDefault();
        advanceTick();
        return;
      }

      if (event.key === 'ArrowRight' || event.key === 'ArrowUp') {
        event.preventDefault();
        setRateDelta((value) => clamp(value + 1, -10, 10));
        return;
      }

      if (event.key === 'ArrowLeft' || event.key === 'ArrowDown') {
        event.preventDefault();
        setRateDelta((value) => clamp(value - 1, -10, 10));
      }
    };

    window.addEventListener('keydown', onKeyDown);

    return () => window.removeEventListener('keydown', onKeyDown);
  }, [advanceTick, game.active]);

  return (
    <div className="app-shell">
      <header className="site-header">
        <div>
          <h1>TCP Congestion Control — The Game</h1>
          <p>Queue-based network simulation · React frontend migration</p>
        </div>

        <div className="header-meta">
          <span>Player: —</span>
          <span>
            Session:{' '}
            {game.active
              ? `Tick ${game.tick} / ${settings.maxTicks}`
              : game.completed
                ? 'Round Complete'
                : 'Setup'}
          </span>
        </div>
      </header>

      <nav className="top-nav" aria-label="Primary navigation">
        <a href="#game" className="active">Game</a>
        <a href="#visualizer">Visualizer</a>
        <a href="#controls">Controls</a>
        <a href="#algorithm">Algorithm</a>
      </nav>

      <div className="breadcrumb">
        Home &rsaquo; Game &rsaquo; <strong>{game.active ? SCENARIO_NAMES[settings.scenario] : game.completed ? 'Results' : 'Setup'}</strong>
      </div>

      <main className="content" id="game">
        <section className="page-title-block">
          <h2>TCP Congestion Control Simulation</h2>
          <p>
            You are a TCP sender sharing a hidden bottleneck with competing traffic.
            Use the acceleration slider to probe capacity, then stabilize before drops destroy your score.
          </p>
        </section>

        <section className="panel">
          <div className="panel-header">▶ Round Setup</div>

          <div className="panel-body">
            <div className="setup-grid">
              <label>
                <span>Scenario</span>
                <select
                  value={settings.scenario}
                  onChange={(event) => updateSetting('scenario', event.target.value)}
                  disabled={game.active}
                >
                  <option value="1">1 — Stable bandwidth</option>
                  <option value="2">2 — Bursty competing traffic</option>
                  <option value="3">3 — Shifting / oscillating bandwidth</option>
                </select>
              </label>

              <label>
                <span>Round Length</span>
                <input
                  type="number"
                  min="10"
                  max="300"
                  value={settings.maxTicks}
                  onChange={(event) => updateSetting('maxTicks', event.target.value)}
                  disabled={game.active}
                />
              </label>

              <label>
                <span>Buffer Size</span>
                <input
                  type="number"
                  min="10"
                  max="200"
                  value={settings.bufferSize}
                  onChange={(event) => updateSetting('bufferSize', event.target.value)}
                  disabled={game.active}
                />
              </label>

              <label>
                <span>Initial Send Rate</span>
                <input
                  type="number"
                  min="1"
                  max="80"
                  value={settings.initialRate}
                  onChange={(event) => updateSetting('initialRate', event.target.value)}
                  disabled={game.active}
                />
              </label>
            </div>
          </div>
        </section>

        <section className="panel">
          <div className="panel-header grey">Round Progress</div>

          <div className="panel-body compact">
            <div className="progress-copy">
              Tick {game.tick} of {settings.maxTicks} ({progress}% complete)
            </div>

            <div className="tick-progress-wrap">
              <div className="tick-progress-fill" style={{ width: `${progress}%` }} />
              <div className="tick-progress-label">Tick {game.tick} / {settings.maxTicks}</div>
            </div>
          </div>
        </section>

        <section className="game-grid">
          <aside className="game-column metrics-column">
            <div className="panel-header">▶ Live Network Metrics</div>

            <table className="cf-table">
              <thead>
                <tr>
                  <th>Metric</th>
                  <th className="right">Value</th>
                  <th>Status</th>
                </tr>
              </thead>

              <tbody>
                {metrics.map(([label, value, status]) => (
                  <tr key={label}>
                    <td>{label}</td>
                    <td className="value-cell">{value}</td>
                    <td className={statusToClass(status)}>{status}</td>
                  </tr>
                ))}
              </tbody>
            </table>

            <div className="hidden-state-note">
              <em>True bandwidth and background traffic are hidden. Infer from loss, latency, and throughput.</em>
            </div>
          </aside>

          <section className="game-column visualizer-column" id="visualizer">
            <div className="panel-header">▶ Signal History & Packet Window</div>

            <div className="legend-row">
              <span><i className="legend-swatch swatch-throughput" /> Throughput</span>
              <span><i className="legend-swatch swatch-loss" /> Loss rate</span>
              <span><i className="legend-swatch swatch-latency" /> Latency</span>
              <span><i className="legend-swatch swatch-score" /> Score Δ</span>
              <span><i className="legend-swatch swatch-aimd" /> AIMD ghost</span>
            </div>

            <div className="canvas-frame">
              <HistoryCanvas game={game} />
            </div>

            <PacketGrid packets={game.packets} playerRate={game.playerRate} />

            <div className="sub-panel-title">AIMD Ghost — Per-tick Rate Log</div>

            <div className="log-scroll">
              <table className="log-table">
                <thead>
                  <tr>
                    <th>Tick</th>
                    <th>Ghost Rate</th>
                    <th>Your Rate</th>
                    <th>Congestion?</th>
                    <th>Ghost Action</th>
                  </tr>
                </thead>

                <tbody>
                  {game.aimdLog.length === 0 ? (
                    <tr>
                      <td colSpan="5" className="empty-log">Send first tick to see log</td>
                    </tr>
                  ) : (
                    game.aimdLog.map((row) => (
                      <tr key={row.tick}>
                        <td>{row.tick}</td>
                        <td>{row.aimdRate}</td>
                        <td>{row.playerRate}</td>
                        <td className={row.congestion ? 'dropped' : 'clean'}>
                          {row.congestion ? 'Yes' : 'No'}
                        </td>
                        <td>{row.action}</td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </section>
        </section>

        <section className="control-panel" id="controls">
          <div className="panel-header dark">▶ Controls</div>

          <div className="control-row">
            <span className="row-label">Simulation:</span>

            <button className="cf-btn primary" onClick={game.active ? advanceTick : startGame}>
              {game.active ? '▶ Send Tick' : '▶ Start Game'}
            </button>

            <button
              className={`cf-btn ${autoRunning ? 'btn-auto-active' : ''}`}
              onClick={() => game.active && setAutoRunning((value) => !value)}
              disabled={!game.active}
            >
              {autoRunning ? '⏸ Pause' : '▶ Auto-Play'}
            </button>

            <button className="cf-btn danger" onClick={stopGame} disabled={!game.active}>
              ■ End Round
            </button>

            <span className="inline-label">Speed:</span>

            <select
              className="speed-select"
              value={speed}
              onChange={(event) => setSpeed(Number(event.target.value))}
            >
              {SPEED_OPTIONS.map(([value, label]) => (
                <option value={value} key={value}>{label}</option>
              ))}
            </select>
          </div>

          <div className="control-row delta-row">
            <span className="row-label">Acceleration:</span>

            <input
              className="delta-slider"
              type="range"
              min="-10"
              max="10"
              step="1"
              value={rateDelta}
              onChange={(event) => setRateDelta(Number(event.target.value))}
            />

            <span className="delta-value">{getRateDeltaLabel(rateDelta)}</span>

            <button className="cf-btn" onClick={() => setRateDelta(0)}>
              Reset
            </button>
          </div>

          <div className="delta-scale">
            <span>-10</span>
            <span>0</span>
            <span>+10</span>
          </div>

          <div className="control-row">
            <span className="row-label">Current Sender State:</span>
            <span className="rate-display">rate {game.playerRate}</span>
            <span className="rate-display">score {Math.round(game.totalScore)}</span>
            <span className={rateDelta === 0 ? 'phase-pill status-ok' : rateDelta > 0 ? 'phase-pill status-warn' : 'phase-pill status-bad'}>
              {rateDelta === 0 ? 'Maintain' : rateDelta > 0 ? 'Accelerate' : 'Decelerate'}
            </span>
          </div>

          <div className="keyboard-help">
            <kbd>Enter</kbd>/<kbd>Space</kbd> tick · <kbd>←</kbd>/<kbd>↓</kbd> lower delta · <kbd>→</kbd>/<kbd>↑</kbd> raise delta
          </div>
        </section>

        <section className="panel" id="algorithm">
          <div className="panel-header grey">▶ Algorithm Reference</div>

          <div className="panel-body">
            <table className="cf-table">
              <tbody>
                <tr>
                  <td className="concept-cell">Rate delta</td>
                  <td>Every tick applies <code>rate = clamp(rate + delta, 1, 80)</code>. Zero means hold the current send rate.</td>
                </tr>
                <tr>
                  <td className="concept-cell">Overflow policy</td>
                  <td>Tail-drop overflow assigns drops proportionally between player traffic and background traffic.</td>
                </tr>
                <tr>
                  <td className="concept-cell">Loss rate</td>
                  <td>Rolling 20-tick window: dropped player packets divided by sent player packets.</td>
                </tr>
                <tr>
                  <td className="concept-cell">Scoring</td>
                  <td><code>+1 × delivered − 4 × dropped + utilization bonus</code>.</td>
                </tr>
                <tr>
                  <td className="concept-cell">AIMD ghost</td>
                  <td>Reference controller halves on congestion and increases by one when clear.</td>
                </tr>
              </tbody>
            </table>
          </div>
        </section>
      </main>

      <footer className="site-footer">
        TCP Congestion Control Game · React Frontend Migration
      </footer>
    </div>
  );
}

export default App;