import { useState, useEffect, useRef } from 'react';
import { useSearchParams } from 'react-router-dom';
import { chat as chatApi, ApiClientError } from '../api/client';
import { useToast } from '../components/useToast';
import type { ChatThread, ChatThreadDetail } from '../types';

export default function Chat() {
  const { addToast, ToastContainer } = useToast();
  const [searchParams] = useSearchParams();
  const [threads, setThreads] = useState<ChatThread[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [typeFilter, setTypeFilter] = useState('');
  const [interventionFilter, setInterventionFilter] = useState<string>('');
  const [selectedThread, setSelectedThread] = useState<ChatThreadDetail | null>(null);
  const [threadLoading, setThreadLoading] = useState(false);
  const [replyText, setReplyText] = useState('');
  const [sending, setSending] = useState(false);
  const deepLinkOpened = useRef(false);

  const fetchThreads = async () => {
    setLoading(true);
    setError('');
    try {
      const params: Record<string, unknown> = { page: 1, pageSize: 50 };
      if (typeFilter) params.type = typeFilter;
      if (interventionFilter !== '') params.needsManualIntervention = interventionFilter === 'true';
      const res = await chatApi.list(params as { type?: string; needsManualIntervention?: boolean });
      setThreads(res.data as ChatThread[]);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to load threads');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { fetchThreads(); }, [typeFilter, interventionFilter]);

  // Auto-open thread from query param — retries when thread list loads
  useEffect(() => {
    const threadId = searchParams.get('threadId');
    if (!threadId) return;
    if (deepLinkOpened.current) return;
    if (threads.length > 0 && !loading) {
      const exists = threads.some((t) => t.id === threadId);
      if (exists) {
        deepLinkOpened.current = true;
        openThread(threadId);
      }
    }
  }, [threads, loading, searchParams]);

  const openThread = async (threadId: string) => {
    setThreadLoading(true);
    try {
      const res = await chatApi.getThread(threadId);
      setSelectedThread(res.data as ChatThreadDetail);
    } catch (e) {
      addToast(e instanceof ApiClientError ? e.message : 'Failed to load thread', 'error');
    } finally {
      setThreadLoading(false);
    }
  };

  const handleSendReply = async () => {
    if (!selectedThread || !replyText.trim()) return;
    setSending(true);
    try {
      await chatApi.sendMessage(selectedThread.id, replyText.trim());
      addToast('Reply sent', 'success');
      setReplyText('');
      // Refresh the thread
      const res = await chatApi.getThread(selectedThread.id);
      setSelectedThread(res.data as ChatThreadDetail);
    } catch (e) {
      addToast(e instanceof ApiClientError ? e.message : 'Failed to send message', 'error');
    } finally {
      setSending(false);
    }
  };

  const handleClearIntervention = async (threadId: string) => {
    try {
      await chatApi.patchThread(threadId, { needsManualIntervention: false });
      addToast('Intervention flag cleared', 'success');
      fetchThreads();
      if (selectedThread?.id === threadId) {
        setSelectedThread((prev) => prev ? { ...prev, needsManualIntervention: false } : null);
      }
    } catch (e) {
      addToast(e instanceof ApiClientError ? e.message : 'Failed to update thread', 'error');
    }
  };

  const formatDate = (dateStr: string) => new Date(dateStr).toLocaleString();

  return (
    <div>
      <ToastContainer />
      <div className="page-header">
        <div>
          <h1 className="page-title">Chat</h1>
          <p className="page-subtitle">Monitor and respond to chat conversations.</p>
        </div>
      </div>

      <div className="filter-bar">
        <select className="form-select" value={typeFilter} onChange={(e) => setTypeFilter(e.target.value)}>
          <option value="">All types</option>
          <option value="lead">Lead</option>
          <option value="customer_project">Customer Project</option>
        </select>
        <select className="form-select" value={interventionFilter} onChange={(e) => setInterventionFilter(e.target.value)}>
          <option value="">All threads</option>
          <option value="true">Needs intervention</option>
          <option value="false">Resolved</option>
        </select>
      </div>

      {error && <div className="alert alert--error" role="alert">{error}</div>}

      <div className="chat-layout">
        <div className="chat-thread-list">
          <div className="chat-thread-list-header">
            Threads {threads.length > 0 && `(${threads.length})`}
          </div>
          <div className="chat-thread-list-body">
            {loading ? (
              <div className="page-loader"><div className="spinner" /></div>
            ) : threads.length === 0 ? (
              <div className="state-message" style={{ padding: 'var(--space-4)' }}>
                <p>No threads found</p>
              </div>
            ) : (
              threads.map((t) => (
                <div
                  key={t.id}
                  className={`chat-thread-item${selectedThread?.id === t.id ? ' selected' : ''}`}
                  onClick={() => openThread(t.id)}
                  onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { openThread(t.id); } }}
                  role="button"
                  tabIndex={0}
                >
                  <div className="chat-thread-item-type">
                    {t.type.replace('_', ' ')}
                    {t.needsManualIntervention && <span className="badge badge--intervention" style={{ marginLeft: 8 }}>!</span>}
                  </div>
                  <div className="chat-thread-item-date">
                    {t.messageCount ?? 0} msgs · {t.lastMessageAt ? formatDate(t.lastMessageAt) : formatDate(t.createdAt)}
                  </div>
                </div>
              ))
            )}
          </div>
        </div>

        <div className="chat-message-area">
          {!selectedThread ? (
            <div className="state-message">
              <span className="state-message-icon">💬</span>
              <h3>Select a thread</h3>
              <p>Click a thread from the list to view messages.</p>
            </div>
          ) : threadLoading ? (
            <div className="page-loader"><div className="spinner" /></div>
          ) : (
            <>
              <div className="chat-message-header">
                <span>Thread {selectedThread.id.slice(0, 8)}...</span>
                <div className="form-inline">
                  {selectedThread.needsManualIntervention && (
                    <button className="btn btn--outline btn--sm" onClick={() => handleClearIntervention(selectedThread.id)}>
                      Clear Flag
                    </button>
                  )}
                </div>
              </div>
              <div className="chat-message-list">
                {selectedThread.messages.map((msg) => (
                  <div key={msg.id} className={`chat-message ${msg.senderType}`}>
                    <div className="chat-message-sender">{msg.senderName}</div>
                    <div>{msg.content}</div>
                    {msg.attachmentUrl && (
                      <div style={{ marginTop: 4 }}>
                        <a href={msg.attachmentUrl} target="_blank" rel="noopener noreferrer" style={{ fontSize: 'var(--font-size-xs)' }}>
                          View attachment
                        </a>
                      </div>
                    )}
                    <div className="chat-message-time">{formatDate(msg.createdAt)}</div>
                  </div>
                ))}
              </div>
              <div className="chat-reply-bar">
                <input
                  type="text"
                  value={replyText}
                  onChange={(e) => setReplyText(e.target.value)}
                  onKeyDown={(e) => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); handleSendReply(); } }}
                  placeholder="Type a reply as admin..."
                  maxLength={5000}
                  disabled={sending}
                />
                <button className="btn btn--primary btn--sm" onClick={handleSendReply} disabled={sending || !replyText.trim()}>
                  {sending ? 'Sending...' : 'Send'}
                </button>
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
