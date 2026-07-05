import { useOutletContext } from 'react-router-dom';

import { formatDate, formatShortDate } from '../../utils/dashboard';

function DashboardSettings() {
  const { account } = useOutletContext();

  return (
    <section className="panel elevated-panel">
      <div className="panel-header">▶ Account Settings</div>
      <div className="panel-body">
        <div className="cf-settings-list">
          <div><span>Username</span><b>{account.username}</b></div>
          <div><span>Full name</span><b>{account.fullName || '—'}</b></div>
          <div><span>Email</span><b>{account.email}</b></div>
          <div><span>Country</span><b>{account.country || '—'}</b></div>
          <div><span>Last visit</span><b>{formatDate(account.lastVisit)}</b></div>
          <div><span>Registered</span><b>{formatShortDate(account.createdAt)}</b></div>
        </div>

        <div className="cf-coming-soon" style={{ marginTop: 20 }}>
          <span className="cf-coming-soon-badge">Coming soon</span>
          <p>
            Editing these fields needs a profile-update endpoint on the backend,
            which isn't wired up yet — this view is read-only for now.
          </p>
        </div>
      </div>
    </section>
  );
}

export default DashboardSettings;