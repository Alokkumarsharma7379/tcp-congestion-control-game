import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';

import { useAuth } from '../context/AuthContext';
import '../styles/codeforces.css';

function LoginPage() {
  const navigate = useNavigate();
  const { login } = useAuth();

  const [form, setForm] = useState({
    username: '',
    password: ''
  });

  const [error, setError] = useState('');
  const [submitting, setSubmitting] = useState(false);

  const updateField = (event) => {
    const { name, value } = event.target;

    setForm((prev) => ({
      ...prev,
      [name]: value
    }));
  };

  const handleSubmit = async (event) => {
    event.preventDefault();

    setError('');
    setSubmitting(true);

    try {
      await login(form);
      navigate('/dashboard');
    } catch (err) {
      setError(err.message || 'Login failed.');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <main className="content">
      <section className="page-title-block">
        <h2>Login</h2>
        <p>Sign in to save game sessions, rating changes, and leaderboard progress.</p>
      </section>

      <section className="panel auth-panel">
        <div className="panel-header">▶ Account Login</div>

        <div className="panel-body">
          <form className="auth-form" onSubmit={handleSubmit}>
            <label>
              <span>Username</span>
              <input
                name="username"
                type="text"
                value={form.username}
                onChange={updateField}
                autoComplete="username"
                required
              />
            </label>

            <label>
              <span>Password</span>
              <input
                name="password"
                type="password"
                value={form.password}
                onChange={updateField}
                autoComplete="current-password"
                required
              />
            </label>

            {error && <div className="form-error">{error}</div>}

            <div className="form-actions">
              <button className="cf-btn primary" type="submit" disabled={submitting}>
                {submitting ? 'Signing in...' : 'Login'}
              </button>

              <Link to="/register">Create account</Link>
            </div>
          </form>
        </div>
      </section>
    </main>
  );
}

export default LoginPage;