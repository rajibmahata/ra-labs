import { useState, useRef, useEffect, useCallback, type FormEvent } from 'react';
import {
  api,
  ApiClientError,
  type ChatMessage,
} from '../api/client';
import { getSessionItem, setSessionItem, removeSessionItem } from '../api/client';

const THREAD_STORAGE_KEY = 'chat.thread';

function generateThreadId(): string {
  // Simple UUID v4
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (c) => {
    const r = (Math.random() * 16) | 0;
    const v = c === 'x' ? r : (r & 0x3) | 0x8;
    return v.toString(16);
  });
}

function getStoredThreadId(): string | null {
  return getSessionItem(THREAD_STORAGE_KEY);
}

function storeThreadId(id: string): void {
  setSessionItem(THREAD_STORAGE_KEY, id);
}

function clearThreadId(): void {
  removeSessionItem(THREAD_STORAGE_KEY);
}

export default function ChatbotWidget() {
  const [open, setOpen] = useState(false);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [input, setInput] = useState('');
  const [sending, setSending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  // Scroll to bottom when messages change
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  // Focus input when panel opens
  useEffect(() => {
    if (open) {
      inputRef.current?.focus();
    }
  }, [open]);

  // Load existing thread on open
  useEffect(() => {
    if (!open) return;

    const threadId = getStoredThreadId();
    if (!threadId) return;

    let cancelled = false;

    api
      .getChatThread(threadId)
      .then((res) => {
        if (!cancelled) {
          setMessages(res.data.messages ?? []);
        }
      })
      .catch((err: unknown) => {
        if (cancelled) return;
        if (err instanceof ApiClientError && err.status === 404) {
          // Thread not found on server — recreate
          clearThreadId();
          setMessages([]);
        }
        // Other errors: keep messages as-is, user can retry
      });

    return () => {
      cancelled = true;
    };
  }, [open]);

  const sendMessage = useCallback(
    async (e: FormEvent) => {
      e.preventDefault();

      const trimmed = input.trim();
      if (!trimmed || sending) return;

      setInput('');
      setError(null);
      setSending(true);

      // Optimistic visitor message
      const optimisticId = `opt-${Date.now()}`;
      const optimisticMessage: ChatMessage = {
        id: optimisticId,
        senderType: 'visitor',
        senderName: 'Visitor',
        content: trimmed,
        attachmentUrl: null,
        createdAt: new Date().toISOString(),
      };

      setMessages((prev) => [...prev, optimisticMessage]);

      try {
        let threadId = getStoredThreadId();
        if (!threadId) {
          threadId = generateThreadId();
          storeThreadId(threadId);
        }

        const res = await api.sendChatMessage(threadId, {
          content: trimmed,
          attachmentUrl: null,
        });

        // Replace optimistic message with real one
        setMessages((prev) =>
          prev.map((m) => (m.id === optimisticId ? res.data : m))
        );

        // Poll for agent response (simple approach: fetch thread after short delay)
        setTimeout(async () => {
          try {
            const threadRes = await api.getChatThread(threadId!);
            setMessages(threadRes.data.messages ?? []);
          } catch {
            // Silently ignore polling errors
          }
        }, 1500);
      } catch (err: unknown) {
        // Remove optimistic message on failure
        setMessages((prev) => prev.filter((m) => m.id !== optimisticId));

        if (err instanceof ApiClientError) {
          if (err.status === 404) {
            clearThreadId();
            setError(
              'Session expired. Please send your message again.'
            );
          } else if (err.code === 'RATE_LIMITED') {
            setError(
              'You are sending messages too quickly. Please wait a moment.'
            );
          } else {
            setError(err.message);
          }
        } else {
          setError('Failed to send message. Please try again.');
        }
      } finally {
        setSending(false);
      }
    },
    [input, sending]
  );

  const toggleOpen = useCallback(() => {
    setOpen((prev) => !prev);
  }, []);

  return (
    <>
      {/* Floating trigger button */}
      <button
        className="chatbot-trigger"
        onClick={toggleOpen}
        aria-label={open ? 'Close chat' : 'Open chat'}
        aria-expanded={open}
        type="button"
      >
        {open ? (
          <svg
            width="22"
            height="22"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2.5"
            strokeLinecap="round"
            aria-hidden="true"
          >
            <line x1="18" y1="6" x2="6" y2="18" />
            <line x1="6" y1="6" x2="18" y2="18" />
          </svg>
        ) : (
          <svg
            width="22"
            height="22"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2.5"
            strokeLinecap="round"
            strokeLinejoin="round"
            aria-hidden="true"
          >
            <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" />
          </svg>
        )}
      </button>

      {/* Chat panel */}
      {open && (
        <div
          className="chatbot-panel"
          role="dialog"
          aria-label="Chat with us"
          aria-modal="true"
        >
          <div className="chatbot-header">
            <h3>Chat with us</h3>
            <button
              className="chatbot-close"
              onClick={toggleOpen}
              aria-label="Close chat"
              type="button"
            >
              &times;
            </button>
          </div>

          <div className="chatbot-messages" role="log" aria-live="polite">
            {messages.length === 0 && !error && (
              <div
                style={{
                  color: 'var(--ink-dim)',
                  fontSize: '13.5px',
                  textAlign: 'center',
                  padding: '24px 8px',
                }}
              >
                Ask us anything about our work, process, or how we can help.
              </div>
            )}

            {messages.map((msg) => (
              <div
                key={msg.id}
                className={`chat-message ${msg.senderType}`}
              >
                <div className="sender">
                  {msg.senderType === 'agent' ? 'R&A Assistant' : 'You'}
                </div>
                {msg.content}
              </div>
            ))}

            {error && (
              <div
                role="alert"
                style={{
                  fontSize: '12px',
                  color: '#c44',
                  textAlign: 'center',
                  padding: '8px',
                  background: 'rgba(204,68,68,0.08)',
                  borderRadius: '10px',
                }}
              >
                {error}
              </div>
            )}

            <div ref={messagesEndRef} />
          </div>

          <form className="chatbot-input" onSubmit={sendMessage}>
            <label htmlFor="chat-input" className="sr-only">
              Type your message
            </label>
            <input
              id="chat-input"
              ref={inputRef}
              type="text"
              value={input}
              onChange={(e) => setInput(e.target.value)}
              placeholder="Type a message..."
              maxLength={5000}
              disabled={sending}
              autoComplete="off"
            />
            <button type="submit" disabled={sending || !input.trim()}>
              {sending ? '...' : 'Send'}
            </button>
          </form>
        </div>
      )}
    </>
  );
}
