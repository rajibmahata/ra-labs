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
      </aside>

      <div className="main-area">
        <header className="topbar">
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
