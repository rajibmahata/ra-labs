import { NavLink, Outlet, useNavigate, Link } from 'react-router-dom';
import { useCallback, useEffect, useRef, useState } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { notifications } from '../api/client';
import type { AdminNotification } from '../types';

const navItems = [
  { to: '/admin/', label: 'Dashboard', icon: '📊', end: true },
  { to: '/admin/leads', label: 'Leads', icon: '📬', end: true },
  { to: '/admin/customers', label: 'Customers', icon: '👥', end: false },
  { to: '/admin/projects', label: 'Projects', icon: '📋', end: false },
  { to: '/admin/drafts', label: 'AI drafts', icon: '✦', end: false },
  { to: '/admin/portfolio', label: 'Portfolio', icon: '💼', end: false },
  { to: '/admin/team', label: 'Team', icon: '👥', end: false },
  { to: '/admin/my-profile', label: 'My Profile', icon: '👤', end: false },
  { to: '/admin/content', label: 'Content', icon: '📝', end: false },
  { to: '/admin/chat', label: 'Chat', icon: '💬', end: false },
  { to: '/admin/reviews', label: 'Reviews', icon: '★', end: false },
  { to: '/admin/notifications', label: 'Notifications', icon: '🔔', end: false },
  { to: '/admin/audit', label: 'Audit Log', icon: '🛡️', end: false },
  { to: '/admin/settings', label: 'Settings', icon: '⚙️', end: false },
];

export default function Layout() {
  const { user, teamProfile, logout } = useAuth();
  const navigate = useNavigate();
  const [notificationItems, setNotificationItems] = useState<AdminNotification[]>([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const [notificationsOpen, setNotificationsOpen] = useState(false);
  const [searchHint, setSearchHint] = useState('');
  const searchTimer = useRef<ReturnType<typeof setTimeout>>();
  const knownNotificationIds = useRef<Set<string> | null>(null);

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

  const loadNotifications = useCallback(async (showBrowserNotification = false) => {
    try {
      const response = await notifications.list({ unread: true, pageSize: 8 });
      const nextItems = response.data;
      const known = knownNotificationIds.current;
      if (showBrowserNotification && known && 'Notification' in window && Notification.permission === 'granted') {
        nextItems
          .filter((item) => !known.has(item.id))
          .forEach((item) => new Notification(item.title, { body: item.message, tag: item.id }));
      }
      knownNotificationIds.current = new Set(nextItems.map((item) => item.id));
      setNotificationItems(nextItems);
      setUnreadCount(response.pagination?.totalCount ?? nextItems.length);
    } catch {
      // Keep the current center usable when polling is temporarily unavailable.
    }
  }, []);

  useEffect(() => {
    if (!user) return;
    void loadNotifications();
    const timer = window.setInterval(() => void loadNotifications(true), 30000);
    return () => window.clearInterval(timer);
  }, [loadNotifications, user]);

  const openNotifications = async () => {
    setNotificationsOpen((current) => !current);
    if ('Notification' in window && Notification.permission === 'default') {
      await Notification.requestPermission();
    }
  };

  const markRead = async (notification: AdminNotification) => {
    if (!notification.isRead) {
      await notifications.markRead(notification.id);
      await loadNotifications();
    }
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
        <div className="sidebar-user">
          <div className="sidebar-user-avatar" aria-hidden="true">{initials}</div>
          <div>
            <div className="sidebar-user-name">{displayName}</div>
            <div className="sidebar-user-role">Administrator</div>
          </div>
        </div>
      </aside>

      <div className="main-area">
        <header className="topbar">
          <div style={{ position: 'relative', flex: 1, maxWidth: '320px' }}>
            <input
              className="topbar-search"
              type="search"
              placeholder="⌕  Search anything..."
              aria-label="Search"
              onChange={(e) => {
                const raw = e.target.value.trim();
                if (!raw) { setSearchHint(''); return; }
                if (searchTimer.current) clearTimeout(searchTimer.current);
                searchTimer.current = setTimeout(() => {
                  const q = raw.toLowerCase();
                  const paths: Record<string, string> = {
                    portfolio: '/admin/portfolio',
                    projects: '/admin/projects',
                    project: '/admin/projects',
                    leads: '/admin/leads',
                    lead: '/admin/leads',
                    team: '/admin/team',
                    members: '/admin/team',
                    content: '/admin/content',
                    chat: '/admin/chat',
                    settings: '/admin/settings',
                    reviews: '/admin/reviews',
                    review: '/admin/reviews',
                    dashboard: '/admin/',
                    audit: '/admin/audit',
                    log: '/admin/audit',
                    drafts: '/admin/drafts',
                    draft: '/admin/drafts',
                    customers: '/admin/customers',
                    customer: '/admin/customers',
                    notifications: '/admin/notifications',
                    profile: '/admin/my-profile',
                  };
                  for (const [kw, path] of Object.entries(paths)) {
                    if (q.includes(kw)) {
                      setSearchHint('');
                      navigate(`${path}?search=${encodeURIComponent(raw)}`);
                      return;
                    }
                  }
                  setSearchHint('No matching page');
                  setTimeout(() => setSearchHint(''), 2500);
                }, 400);
              }}
            />
            {searchHint && (
              <span style={{ position: 'absolute', left: '12px', bottom: '-18px', fontSize: 'var(--font-size-xs)', color: 'var(--color-warning)', whiteSpace: 'nowrap' }}>
                {searchHint}
              </span>
            )}
          </div>
          <div className="notification-center">
            <button
              className="notification-button"
              type="button"
              onClick={openNotifications}
              aria-expanded={notificationsOpen}
              aria-label={`Notifications${unreadCount ? `, ${unreadCount} unread` : ''}`}
            >
              <span aria-hidden="true">🔔</span>
              {unreadCount > 0 && <span className="notification-count">{unreadCount > 99 ? '99+' : unreadCount}</span>}
            </button>
            {notificationsOpen && (
              <div className="notification-popover" role="status">
                <div className="notification-popover-header">
                  <strong>Notifications</strong>
                  <Link to="/admin/notifications" onClick={() => setNotificationsOpen(false)}>View all</Link>
                </div>
                {notificationItems.length === 0 ? (
                  <p className="notification-empty">You are all caught up.</p>
                ) : notificationItems.map((notification) => (
                  <button
                    key={notification.id}
                    className="notification-item"
                    type="button"
                    onClick={() => void markRead(notification)}
                  >
                    <strong>{notification.title}</strong>
                    <span>{notification.message}</span>
                    <small>{new Date(notification.createdAt).toLocaleString()}</small>
                  </button>
                ))}
              </div>
            )}
          </div>
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
