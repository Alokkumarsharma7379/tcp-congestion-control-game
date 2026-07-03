import './styles/codeforces.css';

const metrics = [
  ['Current Tick', '0 / —', ''],
  ['Buffer Fill', '— / — pkts', 'Normal'],
  ['Throughput', '— pkts/tick', '—'],
  ['Latency (norm 0–1)', '—', '—'],
  ['Loss Rate (20-tick window)', '— %', '—'],
  ['Packets Dropped (this tick)', '—', '—'],
  ['Score Δ (this tick)', '—', '—'],
  ['Total Score', '0', ''],
  ['AIMD Ghost Rate', '— pkts/tick', 'reference'],
  ['Congestion This Tick?', '—', '—'],
  ['Total Congestion Events', '0', '']
];

const legendItems = [
  ['Throughput', '#2e86c1'],
  ['Loss rate', '#cc0000'],
  ['Latency', '#d4ac0d'],
  ['Score Δ', '#27ae60'],
  ['AIMD ghost', '#8e44ad']
];

function App() {
  return (
    <div className="app-shell">
      <header className="site-header">
        <div>
          <h1>TCP Congestion Control — The Game</h1>
          <p>Queue-based network simulation · Educational competitive platform</p>
        </div>

        <div className="header-meta">
          <span>Player: —</span>
          <span>Session: Setup</span>
        </div>
      </header>

      <nav className="top-nav" aria-label="Primary navigation">
        <a href="#game" className="active">Game</a>
        <a href="#visualizer">Visualizer</a>
        <a href="#controls">Controls</a>
        <a href="#algorithm">Algorithm</a>
      </nav>

      <div className="breadcrumb">
        Home &rsaquo; Game &rsaquo; <strong>Setup</strong>
      </div>

      <main className="content" id="game">
        <section className="page-title-block">
          <h2>TCP Congestion Control Simulation</h2>
          <p>
            You are a TCP sender sharing a bottleneck link with hidden competing traffic.
            Watch throughput, latency, queue pressure, and packet loss to control your send rate.
          </p>
        </section>

        <section className="panel">
          <div className="panel-header">▶ Round Setup</div>

          <div className="panel-body">
            <div className="setup-grid">
              <label>
                <span>Scenario</span>
                <select defaultValue="1">
                  <option value="1">1 — Stable bandwidth</option>
                  <option value="2">2 — Bursty competing traffic</option>
                  <option value="3">3 — Shifting / oscillating bandwidth</option>
                </select>
              </label>

              <label>
                <span>Round Length</span>
                <input type="number" defaultValue="80" min="10" max="300" />
              </label>

              <label>
                <span>Buffer Size</span>
                <input type="number" defaultValue="50" min="10" max="200" />
              </label>

              <label>
                <span>Initial Send Rate</span>
                <input type="number" defaultValue="10" min="1" max="80" />
              </label>
            </div>
          </div>
        </section>

        <section className="panel">
          <div className="panel-header grey">Round Progress</div>

          <div className="panel-body compact">
            <div className="progress-copy">Tick 0 of 80 (0% complete)</div>

            <div className="tick-progress-wrap">
              <div className="tick-progress-fill" style={{ width: '0%' }} />
              <div className="tick-progress-label">Tick 0 / 80</div>
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
                    <td className={status === 'Normal' ? 'status-ok muted-status' : 'muted-status'}>
                      {status}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>

            <div className="hidden-state-note">
              <em>True bandwidth and background traffic are hidden. Infer them from observable signals.</em>
            </div>
          </aside>

          <section className="game-column visualizer-column" id="visualizer">
            <div className="panel-header">▶ Signal History & AIMD Reference</div>

            <div className="legend-row">
              {legendItems.map(([label, color]) => (
                <span className="legend-item" key={label}>
                  <span className="legend-swatch" style={{ backgroundColor: color }} />
                  {label}
                </span>
              ))}
            </div>

            <div className="canvas-frame">
              <canvas className="history-canvas" />
            </div>

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
                  <tr>
                    <td colSpan="5" className="empty-log">
                      Send first tick to see log
                    </td>
                  </tr>
                </tbody>
              </table>
            </div>
          </section>
        </section>

        <section className="control-panel" id="controls">
          <div className="panel-header dark">▶ Controls</div>

          <div className="control-row">
            <span className="row-label">Simulation:</span>
            <button className="cf-btn primary">▶ Send Tick</button>
            <button className="cf-btn">▶ Auto-Play</button>
            <button className="cf-btn danger">■ End Round</button>

            <span className="inline-label">Speed:</span>
            <select className="speed-select" defaultValue="400">
              <option value="800">Slow</option>
              <option value="400">Normal</option>
              <option value="150">Fast</option>
              <option value="40">Turbo</option>
            </select>
          </div>

          <div className="control-row">
            <span className="row-label">Send Rate:</span>
            <button className="cf-btn">−10</button>
            <button className="cf-btn">−5</button>
            <button className="cf-btn">−1</button>
            <span className="rate-display">10</span>
            <button className="cf-btn">+1</button>
            <button className="cf-btn">+5</button>
            <button className="cf-btn">+10</button>

            <input className="rate-input" type="number" defaultValue="10" min="1" max="80" />
            <button className="cf-btn">Set</button>
          </div>

          <div className="keyboard-help">
            <kbd>Enter</kbd> tick · <kbd>↑</kbd>/<kbd>↓</kbd> ±1 rate · <kbd>→</kbd>/<kbd>←</kbd> ±5 rate
          </div>
        </section>

        <section className="panel" id="algorithm">
          <div className="panel-header grey">▶ Algorithm Reference</div>

          <div className="panel-body">
            <table className="cf-table">
              <tbody>
                <tr>
                  <td className="concept-cell">Buffer model</td>
                  <td>Finite FIFO queue shared between player packets and competing background traffic.</td>
                </tr>
                <tr>
                  <td className="concept-cell">Overflow policy</td>
                  <td>Tail-drop overflow with proportional attribution between player and background arrivals.</td>
                </tr>
                <tr>
                  <td className="concept-cell">Congestion signal</td>
                  <td>Congestion occurs when packets drop or normalized latency rises above the threshold.</td>
                </tr>
                <tr>
                  <td className="concept-cell">AIMD ghost</td>
                  <td>Classic additive increase, multiplicative decrease reference controller.</td>
                </tr>
              </tbody>
            </table>
          </div>
        </section>
      </main>

      <footer className="site-footer">
        TCP Congestion Control Game · MERN Educational Platform
      </footer>
    </div>
  );
}

export default App;