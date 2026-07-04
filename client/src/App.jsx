import { useCallback, useEffect, useMemo, useState } from 'react';

import './styles/codeforces.css';

const MAX_CWND = 80;

const INITIAL_GAME = {
  active: false,
  tick: 0,
  maxTicks: 80,
  cwnd: 1,
  ssthresh: 16,
  score: 0,
  currentPhase: 'Slow Start',
  packets: [],
  totalSent: 0,
  totalAcked: 0,
  totalDropped: 0,
  congestionEvents: 0,
  lastDropCount: 0,
  lastAckCount: 0
};

const SPEED_OPTIONS = [
  ['800', 'Slow'],
  ['400', 'Normal'],
  ['150', 'Fast'],
  ['40', 'Turbo']
];

const PHASE_CLASS = {
  'Slow Start': 'status-ok',
  'Congestion Avoidance': 'status-warn',
  Recovery: 'status-bad'
};

const PACKET_STATUS_LABEL = {
  acked: 'ACK',
  dropped: 'DROP',
  inFlight: 'FLY',
  empty: ''
};

function getNetworkCapacity(tick) {
  return Math.round(22 + 8 * Math.abs(Math.sin(tick / 14)));
}

function getDropChance(cwnd, capacity, tick) {
  const pressure = Math.max(0, cwnd - capacity) / MAX_CWND;
  const noise = 0.025 + 0.025 * Math.abs(Math.sin(tick / 9));

  return Math.min(0.7, noise + pressure * 1.8);
}

function buildPacketWindow({ tick, cwnd, capacity, dropChance }) {
  const packetCount = Math.max(1, Math.round(cwnd));

  return Array.from({ length: packetCount }, (_, index) => {
    const sequence = index + 1;
    const dropped = Math.random() < dropChance;
    const beyondCapacity = sequence > capacity;

    let state = 'acked';

    if (dropped) {
      state = 'dropped';
    } else if (beyondCapacity) {
      state = 'inFlight';
    }

    return {
      id: `${tick}-${sequence}`,
      sequence,
      state
    };
  });
}

function advanceSimulation(prev) {
  if (!prev.active || prev.tick >= prev.maxTicks) {
    return {
      ...prev,
      active: false
    };
  }

  const nextTick = prev.tick + 1;
  const capacity = getNetworkCapacity(nextTick);
  const dropChance = getDropChance(prev.cwnd, capacity, nextTick);

  const packets = buildPacketWindow({
    tick: nextTick,
    cwnd: prev.cwnd,
    capacity,
    dropChance
  });

  const ackedCount = packets.filter((packet) => packet.state === 'acked').length;
  const droppedCount = packets.filter((packet) => packet.state === 'dropped').length;
  const hasCongestion = droppedCount > 0;

  let cwnd = prev.cwnd;
  let ssthresh = prev.ssthresh;
  let currentPhase = prev.currentPhase;

  if (hasCongestion) {
    ssthresh = Math.max(2, Math.floor(prev.cwnd / 2));
    cwnd = 1;
    currentPhase = 'Recovery';
  } else if (prev.cwnd < prev.ssthresh) {
    cwnd = Math.min(MAX_CWND, prev.cwnd + Math.max(1, ackedCount));
    currentPhase = 'Slow Start';
  } else {
    cwnd = Math.min(
      MAX_CWND,
      prev.cwnd + Math.max(1 / Math.max(prev.cwnd, 1), ackedCount / Math.max(prev.cwnd, 1))
    );
    currentPhase = 'Congestion Avoidance';
  }

  const scoreDelta = ackedCount - droppedCount * 4;

  return {
    ...prev,
    tick: nextTick,
    cwnd,
    ssthresh,
    currentPhase,
    packets,
    score: prev.score + scoreDelta,
    totalSent: prev.totalSent + packets.length,
    totalAcked: prev.totalAcked + ackedCount,
    totalDropped: prev.totalDropped + droppedCount,
    congestionEvents: prev.congestionEvents + (hasCongestion ? 1 : 0),
    lastDropCount: droppedCount,
    lastAckCount: ackedCount,
    active: nextTick < prev.maxTicks
  };
}

function statusToClass(status) {
  if (status === 'Good' || status === 'OK') return 'status-ok';
  if (status === 'Warning') return 'status-warn';
  if (status === 'High' || status === '[!]') return 'status-bad';

  return 'muted-status';
}

function PacketGrid({ packets, windowSize }) {
  const visibleCells = Math.max(24, Math.min(96, Math.ceil(windowSize / 8) * 8));

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
        <span>Window size: {Math.round(windowSize)} packets</span>
        <span>{packets.length ? 'Latest tick window' : 'Waiting for first tick'}</span>
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
        <span>
          <i className="legend-box in-flight" />
          In-flight
        </span>
        <span>
          <i className="legend-box acked" />
          Acknowledged
        </span>
        <span>
          <i className="legend-box dropped" />
          Dropped
        </span>
      </div>
    </div>
  );
}

function App() {
  const [game, setGame] = useState(INITIAL_GAME);
  const [autoRunning, setAutoRunning] = useState(false);
  const [speed, setSpeed] = useState(400);

  const progress = Math.round((game.tick / game.maxTicks) * 100);

  const metrics = useMemo(() => {
    const lossRate = game.totalSent > 0
      ? (game.totalDropped / game.totalSent) * 100
      : 0;

    return [
      ['Current Tick', `${game.tick} / ${game.maxTicks}`, ''],
      ['Congestion Window', game.cwnd.toFixed(2), 'cwnd'],
      ['Slow-start Threshold', Math.round(game.ssthresh), 'ssthresh'],
      ['Current Phase', game.currentPhase, game.currentPhase],
      ['Packets ACKed (last tick)', game.lastAckCount, game.lastAckCount > 0 ? 'Good' : '—'],
      ['Packets Dropped (last tick)', game.lastDropCount, game.lastDropCount > 0 ? '[!]' : 'OK'],
      ['Total Score', Math.round(game.score), ''],
      ['Overall Loss Rate', `${lossRate.toFixed(1)} %`, lossRate > 10 ? 'High' : lossRate > 2 ? 'Warning' : 'Good'],
      ['Congestion Events', game.congestionEvents, '']
    ];
  }, [game]);

  const startGame = () => {
    setGame({
      ...INITIAL_GAME,
      active: true
    });
    setAutoRunning(false);
  };

  const stopGame = () => {
    setAutoRunning(false);
    setGame((prev) => ({
      ...prev,
      active: false
    }));
  };

  const advanceTick = useCallback(() => {
    setGame((prev) => advanceSimulation(prev));
  }, []);

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

  return (
    <div className="app-shell">
      <header className="site-header">
        <div>
          <h1>TCP Congestion Control — The Game</h1>
          <p>Queue-based network simulation · React visualizer build</p>
        </div>

        <div className="header-meta">
          <span>Player: —</span>
          <span>Session: {game.active ? `Tick ${game.tick} / ${game.maxTicks}` : 'Setup'}</span>
        </div>
      </header>

      <nav className="top-nav" aria-label="Primary navigation">
        <a href="#game" className="active">Game</a>
        <a href="#visualizer">Visualizer</a>
        <a href="#controls">Controls</a>
        <a href="#algorithm">Algorithm</a>
      </nav>

      <div className="breadcrumb">
        Home &rsaquo; Game &rsaquo; <strong>{game.active ? game.currentPhase : 'Setup'}</strong>
      </div>

      <main className="content" id="game">
        <section className="page-title-block">
          <h2>TCP Congestion Control Simulation</h2>
          <p>
            Control the congestion window, observe acknowledgements and packet drops,
            and keep the sender efficient without overwhelming the bottleneck.
          </p>
        </section>

        <section className="panel">
          <div className="panel-header grey">Round Progress</div>

          <div className="panel-body compact">
            <div className="progress-copy">
              Tick {game.tick} of {game.maxTicks} ({progress}% complete)
            </div>

            <div className="tick-progress-wrap">
              <div className="tick-progress-fill" style={{ width: `${progress}%` }} />
              <div className="tick-progress-label">
                Tick {game.tick} / {game.maxTicks}
              </div>
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
                    <td className={PHASE_CLASS[status] || statusToClass(status)}>
                      {status}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>

            <div className="hidden-state-note">
              <em>Packet drops and delayed packets are visible. True bottleneck capacity is hidden.</em>
            </div>
          </aside>

          <section className="game-column visualizer-column" id="visualizer">
            <div className="panel-header">▶ Congestion Window Visualizer</div>

            <PacketGrid packets={game.packets} windowSize={game.cwnd} />

            <div className="sub-panel-title">Window State</div>

            <table className="log-table">
              <thead>
                <tr>
                  <th>Tick</th>
                  <th>cwnd</th>
                  <th>ssthresh</th>
                  <th>ACKed</th>
                  <th>Dropped</th>
                  <th>Phase</th>
                </tr>
              </thead>

              <tbody>
                <tr>
                  <td>{game.tick}</td>
                  <td>{game.cwnd.toFixed(2)}</td>
                  <td>{Math.round(game.ssthresh)}</td>
                  <td className="clean">{game.lastAckCount}</td>
                  <td className={game.lastDropCount > 0 ? 'dropped' : 'clean'}>
                    {game.lastDropCount}
                  </td>
                  <td>{game.currentPhase}</td>
                </tr>
              </tbody>
            </table>
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
                <option value={value} key={value}>
                  {label}
                </option>
              ))}
            </select>
          </div>

          <div className="control-row">
            <span className="row-label">TCP State:</span>

            <span className="rate-display">
              cwnd {game.cwnd.toFixed(1)}
            </span>

            <span className="rate-display">
              ssthresh {Math.round(game.ssthresh)}
            </span>

            <span className={`phase-pill ${PHASE_CLASS[game.currentPhase] || 'status-warn'}`}>
              {game.currentPhase}
            </span>
          </div>

          <div className="keyboard-help">
            This step runs the core ticker and packet grid. Manual send-rate controls will be wired in the full game controller step.
          </div>
        </section>

        <section className="panel" id="algorithm">
          <div className="panel-header grey">▶ Algorithm Reference</div>

          <div className="panel-body">
            <table className="cf-table">
              <tbody>
                <tr>
                  <td className="concept-cell">Slow Start</td>
                  <td>
                    When there is no congestion and cwnd is below ssthresh,
                    the window grows aggressively.
                  </td>
                </tr>

                <tr>
                  <td className="concept-cell">Congestion Avoidance</td>
                  <td>
                    After crossing ssthresh, cwnd increases more cautiously
                    to probe available capacity.
                  </td>
                </tr>

                <tr>
                  <td className="concept-cell">Packet Drop</td>
                  <td>
                    A drop halves the threshold and resets cwnd to recover
                    from congestion.
                  </td>
                </tr>

                <tr>
                  <td className="concept-cell">Score</td>
                  <td>
                    ACKed packets add value; dropped packets are penalized heavily.
                  </td>
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