import { useState, useEffect, useCallback, useRef, type FormEvent } from 'react';
import { useParams, Link } from 'react-router-dom';
import { api, ApiClientError } from '../api/client';
import type { ChatMessage } from '../types';
import LoadingSpinner from '../components/LoadingSpinner';

// 5 second poll interval
const POLL_INTERVAL = 5000;

export default function Chat() {
  const { id } = useParams<{ id: string }>();

  const [threadId, setThreadId] = useState<string | null>(null);
  const [projectTitle, setProjectTitle] = useState('');
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const [input, setInput] = useState('');
  const [sending, setSending] = useState(false);
  const [sendError, setSendError] = useState('');

  const messagesEndRef = useRef<HTMLDivElement>(null);
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const scrollToBottom = useCallback(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, []);

  // Load project to get threadId
  useEffect(() => {
    if (!id) return;

    const load = async () => {
      setLoading(true);
      setError('');
      try {
        const res = await api.getProject(id);
        setThreadId(res.data.chatThreadId);
        setProjectTitle(res.data.title);
      } catch (err) {
        setError(
          err instanceof ApiClientError ? err.message : 'Failed to load project.'
        );
        setLoading(false);
      }
    };

    load();
  }, [id]);

  // Load messages when we have threadId
  const loadMessages = useCallback(async () => {
    if (!threadId) return;

    try {
      const res = await api.getChatThread(threadId);
      setMessages(res.data.messages ?? []);
      setLoading(false);
    } catch (err) {
      console.debug('Chat poll failed:', err instanceof Error ? err.message : err);
      // Don't set error on poll failures to avoid flashing, unless initial load
      if (loading) {
        setError(
          err instanceof ApiClientError ? err.message : 'Failed to load messages.'
        );
        setLoading(false);
      }
    }
  }, [threadId, loading]);

  // Initial load
  useEffect(() => {
    if (threadId) {
      loadMessages();
    }
  }, [threadId]); // eslint-disable-line react-hooks/exhaustive-deps

  // Poll for new messages
  useEffect(() => {
    if (!threadId) return;

    pollRef.current = setInterval(() => {
      loadMessages();
    }, POLL_INTERVAL);

    return () => {
      if (pollRef.current) clearInterval(pollRef.current);
    };
  }, [threadId, loadMessages]);

  // Scroll to bottom when messages update
  useEffect(() => {
    scrollToBottom();
  }, [messages, scrollToBottom]);

  const handleSend = async (e: FormEvent) => {
    e.preventDefault();
    if (!threadId || !input.trim()) return;

    setSending(true);
    setSendError('');
    try {
      await api.sendChatMessage(threadId, {
        content: input.trim(),
        attachmentUrl: null,
      });
      setInput('');
      // Immediately poll for new messages
      await loadMessages();
    } catch (err) {
      setSendError(
        err instanceof ApiClientError ? err.message : 'Failed to send message.'
      );
    } finally {
      setSending(false);
    }
  };

  const formatTime = (iso: string): string => {
    try {
      return new Date(iso).toLocaleTimeString('en-US', {
        hour: '2-digit',
        minute: '2-digit',
      });
    } catch {
      return '';
    }
  };

  const formatDate = (iso: string): string => {
    try {
      return new Date(iso).toLocaleDateString('en-US', {
        month: 'short',
        day: 'numeric',
      });
    } catch {
      return '';
    }
  };

  if (loading) {
    return <LoadingSpinner />;
  }

  if (error) {
    return (
      <div className="project-detail">
        <Link to={`/projects/${id}`} className="back-link">
          ← Back to Project
        </Link>
        <div className="state-placeholder" role="alert">
          <h3>Error</h3>
          <p>{error}</p>
        </div>
      </div>
    );
  }

  if (!threadId) {
    return (
      <div className="project-detail">
        <Link to={`/projects/${id}`} className="back-link">
          ← Back to Project
        </Link>
        <div className="state-placeholder" role="status">
          <h3>No chat thread</h3>
          <p>This project does not have a chat thread yet.</p>
        </div>
      </div>
    );
  }

  // Group messages by date
  let lastDate = '';

  return (
    <div className="chat-page">
      <div className="chat-header">
        <Link to={`/projects/${id}`} className="back-link" style={{ marginBottom: 8 }}>
          ← Back to Project
        </Link>
        <h2>{projectTitle || 'Chat'}</h2>
      </div>

      <div
        className="chat-messages"
        role="log"
        aria-live="polite"
        aria-label="Chat messages"
      >
        {messages.length === 0 && (
          <div className="state-placeholder" style={{ padding: '40px 24px' }}>
            <p>No messages yet. Start the conversation.</p>
          </div>
        )}

        {messages.map((msg) => {
          const date = formatDate(msg.createdAt);
          const showDate = date !== lastDate;
          lastDate = date;

          return (
            <div key={msg.id}>
              {showDate && (
                <div
                  style={{
                    textAlign: 'center',
                    fontSize: 11,
                    color: 'var(--ink-dim)',
                    fontFamily: 'var(--font-mono)',
                    margin: '8px 0',
                  }}
                >
                  {date}
                </div>
              )}
              <div className={`chat-bubble ${msg.senderType}`}>
                <div className="sender">
                  {msg.senderName || msg.senderType}
                </div>
                <div>{msg.content}</div>
                <div className="time">{formatTime(msg.createdAt)}</div>
              </div>
            </div>
          );
        })}
        <div ref={messagesEndRef} />
      </div>

      <form className="chat-input-area" onSubmit={handleSend}>
        <label htmlFor="chat-input" className="sr-only">
          Type a message
        </label>
        <input
          id="chat-input"
          type="text"
          placeholder="Type a message..."
          value={input}
          onChange={(e) => setInput(e.target.value)}
          disabled={sending}
          autoComplete="off"
        />
        <button
          type="submit"
          className="btn btn-primary"
          disabled={sending || !input.trim()}
        >
          {sending ? '...' : 'Send'}
        </button>
      </form>

      {sendError && (
        <div className="error-banner" role="alert" style={{ marginTop: 8 }}>
          {sendError}
        </div>
      )}
    </div>
  );
}
