import { Link } from 'react-router-dom';
import '../styles/codeforces.css';

function LoginPage() {
  return (
    <div className="content">
      <h2 style={{ color: '#1a5276' }}>Log In</h2>
      <form style={{ maxWidth: 320 }}>
        <label style={{ display: 'grid', gap: 4 }}>
          <span>Email</span>
          <input type="email" required />
        </label>
        <label style={{ display: 'grid', gap: 4, marginTop: 8 }}>
          <span>Password</span>
          <input type="password" required />
        </label>
        <button className="cf-btn primary" style={{ marginTop: 12 }}>Log In</button>
      </form>
      <p style={{ fontSize: 12, marginTop: 10 }}>
        New? <Link to="/register">Create an account</Link>
      </p>
    </div>
  );
}

export default LoginPage;