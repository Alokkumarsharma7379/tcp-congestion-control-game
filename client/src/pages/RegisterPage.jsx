import { Link } from 'react-router-dom';
import '../styles/codeforces.css';

function RegisterPage() {
  return (
    <div className="content">
      <h2 style={{ color: '#1a5276' }}>Register</h2>
      <form style={{ maxWidth: 340 }}>
        <label style={{ display: 'grid', gap: 4 }}>
          <span>Username</span>
          <input required />
        </label>
        <label style={{ display: 'grid', gap: 4, marginTop: 8 }}>
          <span>Email</span>
          <input type="email" required />
        </label>
        <label style={{ display: 'grid', gap: 4, marginTop: 8 }}>
          <span>Password</span>
          <input type="password" required />
        </label>
        <button className="cf-btn primary" style={{ marginTop: 12 }}>Create Account</button>
      </form>
      <p style={{ fontSize: 12, marginTop: 10 }}>
        Already have an account? <Link to="/login">Log in</Link>
      </p>
    </div>
  );
}

export default RegisterPage;