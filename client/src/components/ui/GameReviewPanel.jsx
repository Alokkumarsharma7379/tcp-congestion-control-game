import { useCallback, useEffect, useRef } from 'react';

import { BOT_META, getActiveBotAlgorithms } from '../../simulation/gameEngine';

const LOSS_WEIGHT = 3; // mirrors server/services/rating.service.js

const clamp = (v, lo, hi) => Math.max(lo, Math.min(hi, v));

const pct = (v) => `${(v * 100).toFixed(1)}%`;

const average = (values) => {
  const clean = values.filter((v) => Number.isFinite(v));
  return clean.length ? clean.reduce((sum, v) => sum + v, 0) / clean.length : null;
};

// Same shape as calculatePerformanceIndex in rating.service.js, duplicated
// client-side (deliberately small and stable) so the review can show a
// number immediately without waiting on the async rating API response.
const buildStats = ({ totalSent, totalDelivered, totalDropped, totalBandwidth }) => {
  const utilization = totalBandwidth > 0 ? clamp(totalDelivered / totalBandwidth, 0, 1) : 0;
  const lossRate = totalSent > 0 ? clamp(totalDropped / totalSent, 0, 1) : 0;
  const lossFactor = clamp(1 - lossRate * LOSS_WEIGHT, 0, 1);
  const performanceIndex = Math.round(utilization * lossFactor * 100);

  return { utilization, lossRate, performanceIndex };
};

// Finds meaningful dips in a rate history (a proxy for "a congestion event
// happened here") and measures how many ticks it took to climb back to 90%
// of the pre-dip level. Works purely on array-index space, which is safe
// here because histPlayerCwnd and every bot's histCwnd are pushed once per
// tick in lockstep, so index i always means "the same tick" across all of
// them.
const estimateAvgRecoveryTicks = (rateHistory) => {
  const recoveries = [];

  for (let i = 1; i < rateHistory.length; i += 1) {
    const prevValue = rateHistory[i - 1];
    const currentValue = rateHistory[i];

    if (prevValue <= 0) continue;

    const dipRatio = currentValue / prevValue;
    if (dipRatio > 0.85) continue;

    const target = prevValue * 0.9;
    let recoveryTicks = rateHistory.length - i;

    for (let j = i; j < rateHistory.length; j += 1) {
      if (rateHistory[j] >= target) {
        recoveryTicks = j - i;
        break;
      }
    }

    recoveries.push(recoveryTicks);
  }

  return recoveries.length ? average(recoveries) : null;
};

function CwndComparisonChart({ playerHistory, bots }) {
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

    const allSeries = [playerHistory, ...bots.map((b) => b.histCwnd)];
    const maxLen = Math.max(...allSeries.map((s) => s.length), 2);
    const maxValue = Math.max(1, ...allSeries.flat());

    const toX = (i) => (i / (maxLen - 1)) * width;
    const toY = (v) => height - 4 - clamp(v / maxValue, 0, 1) * (height - 8);

    const drawLine = (data, color) => {
      if (data.length < 2) return;
      ctx.beginPath();
      ctx.strokeStyle = color;
      ctx.lineWidth = 2;
      data.forEach((v, i) => (i ? ctx.lineTo(toX(i), toY(v)) : ctx.moveTo(toX(i), toY(v))));
      ctx.stroke();
    };

    bots.forEach((bot) => drawLine(bot.histCwnd, bot.color));
    drawLine(playerHistory, '#378ADD');
  }, [playerHistory, bots]);

  useEffect(() => draw(), [draw]);
  useEffect(() => {
    const handler = () => draw();
    window.addEventListener('resize', handler);
    return () => window.removeEventListener('resize', handler);
  }, [draw]);

  return (
    <div className="game-review-chart">
      <div className="game-review-chart-legend">
        <span><i className="legend-dot" style={{ background: '#378ADD' }} /> You</span>
        {bots.map((bot) => (
          <span key={bot.algo}>
            <i className="legend-dot" style={{ background: bot.color }} /> {bot.label}
          </span>
        ))}
      </div>
      <canvas ref={ref} className="game-review-canvas" />
    </div>
  );
}

function GameReviewPanel({ game, settings }) {
  const activeAlgorithms = getActiveBotAlgorithms(settings.competitor);

  if (activeAlgorithms.length === 0) {
    return (
      <div className="game-review game-review-empty">
        Pick a Competitor Algorithm (TCP Cubic or BBR) next round to unlock a
        head-to-head Game Review with coaching tips.
      </div>
    );
  }

  const playerStats = buildStats({
    totalSent: game.totalSent,
    totalDelivered: game.totalDelivered,
    totalDropped: game.totalDropped,
    totalBandwidth: game.totalBandwidth
  });

  const playerRecovery = estimateAvgRecoveryTicks(game.histPlayerCwnd);

  const botRows = activeAlgorithms.map((algo) => {
    const botState = game.bots[algo];

    return {
      algo,
      label: BOT_META[algo].label,
      color: BOT_META[algo].color,
      histCwnd: botState.histCwnd,
      congestionEvents: botState.congestionEvents,
      recovery: estimateAvgRecoveryTicks(botState.histCwnd),
      ...buildStats({
        totalSent: botState.totalSent,
        totalDelivered: botState.totalDelivered,
        totalDropped: botState.totalDropped,
        totalBandwidth: botState.totalBandwidth
      })
    };
  });

  const avgBotLossRate = average(botRows.map((b) => b.lossRate)) ?? 0;
  const avgBotUtilization = average(botRows.map((b) => b.utilization)) ?? 0;
  const avgBotRecovery = average(botRows.map((b) => b.recovery));

  const verdicts = [];

  if (playerStats.lossRate > 0.02 && playerStats.lossRate > avgBotLossRate * 1.5) {
    verdicts.push({
      tone: 'bad',
      title: 'Overly Aggressive',
      text: `Your loss rate (${pct(playerStats.lossRate)}) is well above the engines' average (${pct(avgBotLossRate)}). You kept pushing your rate up even after signs of congestion — back off a step as soon as Loss ticks up, rather than waiting for it to compound.`
    });
  }

  if (avgBotUtilization > 0.1 && playerStats.utilization < avgBotUtilization * 0.7) {
    verdicts.push({
      tone: 'warn',
      title: 'Underutilizing the Link',
      text: `You used ${pct(playerStats.utilization)} of the available bandwidth, versus ${pct(avgBotUtilization)} for the engine(s). There was real headroom left unused — try being a bit more aggressive while Loss is at 0%.`
    });
  }

  if (playerRecovery !== null && avgBotRecovery !== null && playerRecovery > avgBotRecovery * 1.5) {
    verdicts.push({
      tone: 'warn',
      title: 'Mistimed Recovery',
      text: `After a drop, you took about ${playerRecovery.toFixed(1)} ticks on average to climb back up, versus ${avgBotRecovery.toFixed(1)} for the engine(s). Sitting at a low rate for too long after congestion clears just leaves bandwidth on the table — ease back in sooner.`
    });
  }

  if (verdicts.length === 0) {
    verdicts.push({
      tone: 'good',
      title: 'Solid Round',
      text: 'Your utilization and loss rate were competitive with the engine(s) this round — a good balance of speed and safety.'
    });
  }

  return (
    <div className="game-review">
      <h4>
        ▶ Game Review — vs {botRows.map((b) => b.label).join(' & ')}
      </h4>

      <table className="cf-table game-review-table">
        <thead>
          <tr>
            <th>Metric</th>
            <th>You</th>
            {botRows.map((b) => (
              <th key={b.algo}>{b.label}</th>
            ))}
          </tr>
        </thead>
        <tbody>
          <tr>
            <td>Utilization</td>
            <td>{pct(playerStats.utilization)}</td>
            {botRows.map((b) => <td key={b.algo}>{pct(b.utilization)}</td>)}
          </tr>
          <tr>
            <td>Loss Rate</td>
            <td>{pct(playerStats.lossRate)}</td>
            {botRows.map((b) => <td key={b.algo}>{pct(b.lossRate)}</td>)}
          </tr>
          <tr>
            <td>Performance Index</td>
            <td>{playerStats.performanceIndex}</td>
            {botRows.map((b) => <td key={b.algo}>{b.performanceIndex}</td>)}
          </tr>
          <tr>
            <td>Congestion Events</td>
            <td>{game.congestionEvents}</td>
            {botRows.map((b) => <td key={b.algo}>{b.congestionEvents}</td>)}
          </tr>
        </tbody>
      </table>

      <CwndComparisonChart playerHistory={game.histPlayerCwnd} bots={botRows} />

      <div className="game-review-verdicts">
        {verdicts.map((v) => (
          <div key={v.title} className={`game-review-verdict tone-${v.tone}`}>
            <strong>{v.title}</strong>
            <p>{v.text}</p>
          </div>
        ))}
      </div>
    </div>
  );
}

export default GameReviewPanel;