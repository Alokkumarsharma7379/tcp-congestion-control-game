import { useCallback, useEffect, useRef, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { io } from 'socket.io-client';

import { useAuth } from '../../context/AuthContext';
import { API_BASE_URL } from '../../api/http';
import { createContestState, stepContestTick } from '../../simulation/contestEngine';
import ContestResultsModal from '../../components/ui/ContestResultsModal';

import '../../styles/codeforces.css';

const SOCKET_URL = API_BASE_URL.replace(/\/api\/?$/, '') || undefined;
const TICK_INTERVAL_MS = 500;

function ContestGameCanvas() {
  const { token, user } = useAuth();
  const navigate = useNavigate();
  const { roomCode } = useParams();

  const [phase, setPhase] = useState('connecting'); // connecting | countdown | in_progress | finished
  const [config, setConfig] = useState(null);
  const [countdownStartAt, setCountdownStartAt] = useState(null);
  const [endsAt, setEndsAt] = useState(null);
  const [countdownDisplay, setCountdownDisplay] = useState(null);
  const [timeRemaining, setTimeRemaining] = useState(null);

  const [contestState, setContestState] = useState(() => createContestState({ initialCwnd: 10 }));
  const [rateDelta, setRateDelta] = useState(0);
  const [leaderboard, setLeaderboard] = useState([]);
  const [finalResults, setFinalResults] = useState(null);
  const [error, setError] = useState('');

  const socketRef = useRef(null);
  const configRef = useRef(null);

  useEffect(() => {
    configRef.current = config;
  }, [config]);

  /* persistent socket connection for the match */
  useEffect(() => {
    if (!token) return;

    const socket = io(SOCKET_URL, {
      auth: { token },
      withCredentials: true
    });

    socketRef.current = socket;

    socket.on('connect', () => {
      socket.emit('join_contest_room', { roomCode });
    });

    socket.on('connect_error', () => {
      setError('Could not connect to the contest server.');
    });

    socket.on('joined_contest', (payload) => {
      setConfig(payload.config);

      if (payload.status === 'waiting') {
        navigate(`/contest/${roomCode}/lobby`, { replace: true });
        return;
      }

      if (payload.status === 'countdown' && payload.countdownStartAt) {
        setPhase('countdown');
        setCountdownStartAt(payload.countdownStartAt);
      } else if (payload.status === 'in_progress' && payload.endsAt) {
        setPhase('in_progress');
        setEndsAt(payload.endsAt);
        setContestState(createContestState(payload.config));
      } else if (payload.status === 'completed') {
        setPhase('finished');
      }
    });

    socket.on('contest_countdown', ({ startAt }) => {
      setPhase('countdown');
      setCountdownStartAt(startAt);
    });

    socket.on('contest_started', (payload) => {
      setConfig(payload.config);
      setPhase('in_progress');
      setEndsAt(payload.endsAt);
      setContestState(createContestState(payload.config));
    });

    socket.on('leaderboard_update', (payload) => {
      setLeaderboard(payload.leaderboard);
    });

    socket.on('contest_time_up', (payload) => {
      setPhase('finished');
      setFinalResults(payload.finalResults);
    });

    socket.on('contest_error', (message) => setError(message));

    return () => {
      socket.off('connect');
      socket.off('connect_error');
      socket.off('joined_contest');
      socket.off('contest_countdown');
      socket.off('contest_started');
      socket.off('leaderboard_update');
      socket.off('contest_time_up');
      socket.off('contest_error');
      socket.disconnect();
      socketRef.current = null;
    };
  }, [token, roomCode, navigate]);

  /* countdown display, resynced continuously against the server's absolute
     startAt timestamp rather than counting down independently — this is
     what keeps every player's countdown showing the same number regardless
     of individual network latency */
  useEffect(() => {
    if (phase !== 'countdown' || !countdownStartAt) return;

    const interval = setInterval(() => {
      const remainingMs = countdownStartAt - Date.now();
      setCountdownDisplay(Math.max(0, Math.ceil(remainingMs / 1000)));
    }, 100);

    return () => clearInterval(interval);
  }, [phase, countdownStartAt]);

  /* time-remaining display during the match, similarly resynced against
     the server's absolute endsAt timestamp */
  useEffect(() => {
    if (phase !== 'in_progress' || !endsAt) return;

    const interval = setInterval(() => {
      const remainingMs = endsAt - Date.now();
      setTimeRemaining(Math.max(0, Math.round(remainingMs / 1000)));
    }, 250);

    return () => clearInterval(interval);
  }, [phase, endsAt]);

  const reportScore = useCallback(
    (state) => {
      socketRef.current?.emit('update_live_score', {
        score: Math.round(state.totalScore),
        packetsAcked: state.totalDelivered,
        lossCount: state.totalDropped
      });
    },
    []
  );

  /* the actual local simulation loop, only while the match is live */
  useEffect(() => {
    if (phase !== 'in_progress' || !config) return;

    const interval = setInterval(() => {
      setContestState((prev) => {
        const next = stepContestTick(prev, config, rateDelta);
        reportScore(next);
        return next;
      });
    }, TICK_INTERVAL_MS);

    return () => clearInterval(interval);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [phase, config, rateDelta, reportScore]);

  const isMine = (entry) => String(entry.userId) === String(user?._id);

  return (
    <main className="content contest-canvas">
      {error && <div className="form-error">{error}</div>}

      {phase === 'connecting' && <p className="muted-text">Connecting to contest...</p>}

      {phase === 'countdown' && (
        <div className="contest-countdown-overlay">
          <div className="contest-countdown-number">
            {countdownDisplay === null || countdownDisplay <= 0 ? 'GO!' : countdownDisplay}
          </div>
        </div>
      )}

      {phase === 'in_progress' && config && (
        <div className="contest-play-grid">
          <section className="panel contest-play-main">
            <div className="panel-header dark">
              ▶ Contest In Progress — {timeRemaining ?? '--'}s remaining
            </div>
            <div className="panel-body">
              <div className="contest-stat-row">
                <span>Send Rate: <b>{Math.round(contestState.rate)}</b> pkts/tick</span>
                <span>Score: <b>{Math.round(contestState.totalScore)}</b></span>
                <span>Delivered: <b>{contestState.totalDelivered}</b></span>
                <span>Dropped: <b>{contestState.totalDropped}</b></span>
                <span>Queue: <b>{Math.round(contestState.queue)}</b> / {config.queueSize}</span>
              </div>

              <div className="control-row delta-row">
                <span className="row-label">Rate Adjustment:</span>
                <input
                  className="delta-slider"
                  type="range"
                  min="-10"
                  max="10"
                  step="1"
                  value={rateDelta}
                  onChange={(e) => setRateDelta(Number(e.target.value))}
                />
                <span className="delta-value">
                  {rateDelta === 0 ? '0 (Maintain)' : rateDelta > 0 ? `+${rateDelta}` : rateDelta}
                </span>
                <button type="button" className="cf-btn" onClick={() => setRateDelta(0)}>
                  Reset
                </button>
              </div>
            </div>
          </section>

          <aside className="panel contest-leaderboard">
            <div className="panel-header">▶ Live Leaderboard</div>
            <table className="cf-table">
              <thead>
                <tr>
                  <th>#</th>
                  <th>Player</th>
                  <th className="right">Score</th>
                </tr>
              </thead>
              <tbody>
                {leaderboard.map((entry) => (
                  <tr key={entry.userId} className={isMine(entry) ? 'contest-row-mine' : ''}>
                    <td>{entry.rank}</td>
                    <td>{entry.username}</td>
                    <td className="value-cell">{Math.round(entry.score)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </aside>
        </div>
      )}

      {phase === 'finished' && finalResults && (
        <ContestResultsModal
          results={finalResults}
          currentUserId={user?._id}
          roomCode={roomCode}
        />
      )}
    </main>
  );
}

export default ContestGameCanvas;