import { useState } from 'react';
import { useNavigate } from 'react-router-dom';

import { createContest, getContest } from '../../api/contestApi';

import '../../styles/codeforces.css';

const DEFAULT_FORM = {
  title: '',
  duration: 60,
  capacity: 20,
  queueSize: 40,
  lossProbability: 0,
  initialCwnd: 10,
  propagationDelay: 50,
  ssthresh: 32,
  maxPlayers: 8
};

function HostContestPage() {
  const navigate = useNavigate();
  const [form, setForm] = useState(DEFAULT_FORM);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');

  const [joinCode, setJoinCode] = useState('');
  const [joining, setJoining] = useState(false);
  const [joinError, setJoinError] = useState('');

  const updateField = (key, value) => {
    setForm((prev) => ({ ...prev, [key]: value }));
  };

  const handleJoin = async (event) => {
    event.preventDefault();

    const code = joinCode.trim().toUpperCase();

    if (!code) {
      setJoinError('Enter a room code.');
      return;
    }

    setJoining(true);
    setJoinError('');

    try {
      await getContest(code); // just confirms the room exists first
      navigate(`/contest/${code}/lobby`);
    } catch (err) {
      setJoinError(err.message || 'No contest found with that code.');
      setJoining(false);
    }
  };

  const handleSubmit = async (event) => {
    event.preventDefault();

    if (!form.title.trim()) {
      setError('Contest name is required.');
      return;
    }

    setSubmitting(true);
    setError('');

    try {
      const response = await createContest({
        title: form.title.trim(),
        duration: Number(form.duration),
        capacity: Number(form.capacity),
        queueSize: Number(form.queueSize),
        lossProbability: Number(form.lossProbability) / 100,
        initialCwnd: Number(form.initialCwnd),
        propagationDelay: Number(form.propagationDelay),
        ssthresh: Number(form.ssthresh),
        maxPlayers: Number(form.maxPlayers)
      });

      navigate(`/contest/${response.data.contest.roomCode}/lobby`);
    } catch (err) {
      setError(err.message || 'Could not create the contest. Please try again.');
      setSubmitting(false);
    }
  };

  return (
    <main className="content">
      <section className="panel join-contest-panel">
        <div className="panel-header">▶ Join a Contest</div>
        <div className="panel-body">
          <form className="join-contest-form" onSubmit={handleJoin}>
            <input
              type="text"
              value={joinCode}
              maxLength={6}
              placeholder="Enter room code (e.g. K7P2QX)"
              onChange={(e) => setJoinCode(e.target.value.toUpperCase())}
            />
            <button type="submit" className="cf-btn primary" disabled={joining}>
              {joining ? 'Checking...' : 'Join'}
            </button>
          </form>
          {joinError && <div className="form-error">{joinError}</div>}
        </div>
      </section>

      <section className="panel">
        <div className="panel-header">▶ Host a Contest</div>
        <div className="panel-body">
          <form className="host-contest-form" onSubmit={handleSubmit}>
            <label>
              <span>Contest Name</span>
              <input
                type="text"
                value={form.title}
                maxLength={80}
                placeholder="Friday Night Congestion Cup"
                onChange={(e) => updateField('title', e.target.value)}
              />
            </label>

            <div className="host-contest-grid">
              <label>
                <span>Duration (seconds)</span>
                <input
                  type="number"
                  min="10"
                  max="3600"
                  value={form.duration}
                  onChange={(e) => updateField('duration', e.target.value)}
                />
              </label>

              <label>
                <span>Max Players</span>
                <input
                  type="number"
                  min="2"
                  max="100"
                  value={form.maxPlayers}
                  onChange={(e) => updateField('maxPlayers', e.target.value)}
                />
              </label>

              <label>
                <span>Bottleneck Capacity (pkts/tick)</span>
                <input
                  type="number"
                  min="1"
                  max="500"
                  value={form.capacity}
                  onChange={(e) => updateField('capacity', e.target.value)}
                />
              </label>

              <label>
                <span>Max Queue Size</span>
                <input
                  type="number"
                  min="1"
                  max="1000"
                  value={form.queueSize}
                  onChange={(e) => updateField('queueSize', e.target.value)}
                />
              </label>

              <label>
                <span>Propagation Delay (ms)</span>
                <input
                  type="number"
                  min="0"
                  max="2000"
                  value={form.propagationDelay}
                  onChange={(e) => updateField('propagationDelay', e.target.value)}
                />
              </label>

              <label>
                <span>Loss Rate (%)</span>
                <input
                  type="number"
                  min="0"
                  max="100"
                  step="0.5"
                  value={form.lossProbability}
                  onChange={(e) => updateField('lossProbability', e.target.value)}
                />
              </label>

              <label>
                <span>Initial CWND</span>
                <input
                  type="number"
                  min="1"
                  max="500"
                  value={form.initialCwnd}
                  onChange={(e) => updateField('initialCwnd', e.target.value)}
                />
              </label>

              <label>
                <span>Threshold (ssthresh)</span>
                <input
                  type="number"
                  min="1"
                  max="500"
                  value={form.ssthresh}
                  onChange={(e) => updateField('ssthresh', e.target.value)}
                />
              </label>
            </div>

            {error && <div className="form-error">{error}</div>}

            <button type="submit" className="cf-btn primary" disabled={submitting}>
              {submitting ? 'Creating...' : '▶ Create Contest Room'}
            </button>
          </form>
        </div>
      </section>
    </main>
  );
}

export default HostContestPage;