import { NavLink, Outlet, useNavigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';

const navItems = [
  { to: '/admin', label: 'Dashboard', icon: '📊', end: true },
  { to: '/admin/leads', label: 'Leads', icon: '📬', end: true },
  { to: '/admin/portfolio', label: 'Portfolio', icon: '💼', end: false },
  { to: '/admin/team', label: 'Team', icon: '👥', end: false },
  { to: '/admin/my-profile', label: 'My Profile', icon: '👤', end: false },
  { to: '/admin/content', label: 'Content', icon: '📝', end: false },
  { to: '/admin/chat', label: 'Chat', icon: '💬', end: false },
  { to: '/admin/settings', label: 'Settings', icon: '⚙️', end: false },
];

export default function Layout() {
  const { user, teamProfile, logout } = useAuth();
  const navigate = useNavigate();

  const displayName = teamProfile?.name ?? user?.name ?? 'Admin';
  const initials = displayName
    .split(' ')
    .map((n) => n[0])
    .join('')
    .toUpperCase()
    .slice(0, 2);

  const handleLogout = () => {
    logout();
    navigate('/admin/login', { replace: true });
  };

  return (
    <div className="app-shell">
      <aside className="sidebar" role="navigation" aria-label="Main navigation">
        <div className="sidebar-brand">
          <div className="sidebar-brand-icon">RA</div>
          <span>R&A Labs</span>
        </div>
        <nav className="sidebar-nav">
          {navItems.map((item) => (
            <NavLink
              key={item.to}
              to={item.to}
              end={item.end}
              className={({ isActive }) => `sidebar-link${isActive ? ' active' : ''}`}
            >
              <span className="sidebar-link-icon" aria-hidden="true">{item.icon}</span>
              <span>{item.label}</span>
            </NavLink>
          ))}
        </nav>
      </aside>

      <div className="main-area">
        <header className="topbar">
          <div className="topbar-user">
            <div className="topbar-user-avatar" aria-hidden="true">{initials}</div>
            <span>{displayName}</span>
          </div>
          <button className="topbar-logout" onClick={handleLogout}>
            Sign out
          </button>
        </header>

        <main className="page-content" role="main">
          <Outlet />
        </main>
      </div>
    </div>
  );
}
