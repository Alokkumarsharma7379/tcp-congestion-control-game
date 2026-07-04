import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';

import { useAuth } from '../context/AuthContext';
import '../styles/codeforces.css';

function RegisterPage() {
  const navigate = useNavigate();
  const { register } = useAuth();

  const [form, setForm] = useState({
    username: '',
    fullName: '',
    email: '',
    password: '',
    country: ''
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
      await register(form);
      navigate('/dashboard');
    } catch (err) {
      setError(err.message || 'Registration failed.');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <main className="content">
      <section className="page-title-block">
        <h2>Create Account</h2>
        <p>Register once, then every TCP game session can update your rating and history.</p>
      </section>

      <section className="panel auth-panel">
        <div className="panel-header">▶ New User Registration</div>

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
              <span>Full Name</span>
              <input
                name="fullName"
                type="text"
                value={form.fullName}
                onChange={updateField}
                autoComplete="name"
              />
            </label>

            <label>
              <span>Email</span>
              <input
                name="email"
                type="email"
                value={form.email}
                onChange={updateField}
                autoComplete="email"
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
                autoComplete="new-password"
                required
              />
            </label>

            <label>
              <span>Country</span>
              <input
                name="country"
                type="text"
                value={form.country}
                onChange={updateField}
                autoComplete="country-name"
              />
            </label>

            {error && <div className="form-error">{error}</div>}

            <div className="form-actions">
              <button className="cf-btn primary" type="submit" disabled={submitting}>
                {submitting ? 'Creating...' : 'Register'}
              </button>

              <Link to="/login">Already have an account?</Link>
            </div>
          </form>
        </div>
      </section>
    </main>
  );
}

export default RegisterPage;