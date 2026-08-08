import { useEffect, useState } from 'react';
import { notifications as notificationsApi } from '../api/client';
import type { AdminNotification } from '../types';

export default function Notifications() {
  const [items, setItems] = useState<AdminNotification[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const load = async () => {
    setLoading(true);
    setError('');
    try {
      const response = await notificationsApi.list({ page: 1, pageSize: 50 });
      setItems(response.data);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load notifications.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { void load(); }, []);

  const markRead = async (item: AdminNotification) => {
    if (item.isRead) return;
    await notificationsApi.markRead(item.id);
    setItems((current) => current.map((notification) =>
      notification.id === item.id
        ? { ...notification, isRead: true, readAt: new Date().toISOString() }
        : notification,
    ));
  };

  return (
    <div>
      <div className="page-header">
        <div>
          <h1 className="page-title">Notifications</h1>
          <p className="page-subtitle">Requests and activity that may need a team response.</p>
        </div>
        <button className="btn btn--secondary" type="button" onClick={() => void load()}>Refresh</button>
      </div>

      {error && <div className="alert alert--error" role="alert">{error}</div>}
      <div className="card">
        {loading ? (
          <div className="page-loader"><div className="spinner" /></div>
        ) : items.length === 0 ? (
          <div className="state-message">
            <span className="state-message-icon">🔔</span>
            <h3>No notifications yet</h3>
            <p>New contact requests, registrations, and escalated chats will appear here.</p>
          </div>
        ) : (
          <div className="notification-list">
            {items.map((item) => (
              <article key={item.id} className={`notification-row${item.isRead ? '' : ' notification-row--unread'}`}>
                <div className="notification-row-icon" aria-hidden="true">{item.type === 'chat_escalation' ? '💬' : item.type === 'customer_registration' ? '👤' : '📥'}</div>
                <div className="notification-row-content">
                  <strong>{item.title}</strong>
                  <p>{item.message}</p>
                  <time dateTime={item.createdAt}>{new Date(item.createdAt).toLocaleString()}</time>
                </div>
                {!item.isRead && <button className="btn btn--secondary btn--small" type="button" onClick={() => void markRead(item)}>Mark read</button>}
              </article>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
