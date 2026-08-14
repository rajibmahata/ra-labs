import { useState, useRef, useEffect, useCallback, type FormEvent } from 'react';
import {
  api,
  ApiClientError,
  type ChatMessage,
} from '../api/client';
import { getSessionItem, setSessionItem, removeSessionItem } from '../api/client';
import { useI18n } from '../i18n';
import { useVoice } from '../hooks/useVoice';

const THREAD_STORAGE_KEY = 'chat.thread';

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
  const { t } = useI18n();

  const [open, setOpen] = useState(false);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [input, setInput] = useState('');
  const [sending, setSending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const panelRef = useRef<HTMLDivElement>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);

  const voice = useVoice({
    enabled: true,
    voiceResponse: false,
    onTranscript: (text) => {
      setInput((current) => `${current.trim()}${current.trim() ? ' ' : ''}${text.trim()}`);
    },
  });

  const showRegistrationCta = messages.some(
    (message) =>
      message.senderType === 'agent' &&
      message.content.toLowerCase().includes('private workspace')
  );

  // Scroll to bottom when messages change
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  // Focus input when panel opens
  useEffect(() => {
    if (open) {
      inputRef.current?.focus();
      document.body.style.overflow = 'hidden';
      return () => {
        document.body.style.overflow = '';
      };
    } else {
      triggerRef.current?.focus();
    }
    return undefined;
  }, [open]);

  useEffect(() => {
    if (!open) return;
    const panel = panelRef.current;
    if (!panel) return;

    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key !== 'Tab') return;
      const focusable = panel.querySelectorAll<HTMLElement>(
        'button:not([disabled]), input:not([disabled]), a[href]'
      );
      const first = focusable[0];
      const last = focusable[focusable.length - 1];
      if (e.shiftKey && document.activeElement === first) {
        e.preventDefault();
        last?.focus();
      } else if (!e.shiftKey && document.activeElement === last) {
        e.preventDefault();
        first?.focus();
      }
    };

    document.addEventListener('keydown', onKeyDown);
    return () => document.removeEventListener('keydown', onKeyDown);
  }, [open]);

  useEffect(() => () => {
    voice.stop();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

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
          clearThreadId();
          setMessages([]);
        }
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

      const optimisticId = `opt-${Date.now()}`;
      const optimisticMessage: ChatMessage = {
        id: optimisticId,
        senderType: 'visitor',
        senderName: 'Visitor',
        content: trimmed,
        attachmentUrl: null,
        suggestedActions: null,
        createdAt: new Date().toISOString(),
      };

      setMessages((prev) => [...prev, optimisticMessage]);

      try {
        let threadId = getStoredThreadId();
        const send = (id: string) => api.sendChatMessage(id, {
          content: trimmed,
          attachmentUrl: null,
        });

        if (!threadId) {
          const thread = await api.createChatThread();
          threadId = thread.data.id;
          storeThreadId(threadId);
        }

        try {
          await send(threadId);
        } catch (err) {
          if (!(err instanceof ApiClientError) || err.status !== 404) throw err;

          const thread = await api.createChatThread();
          threadId = thread.data.id;
          storeThreadId(threadId);
          await send(threadId);
        }

        setTimeout(async () => {
          try {
            const threadRes = await api.getChatThread(threadId!);
            setMessages(threadRes.data.messages ?? []);
          } catch {
            // Silently ignore polling errors
          }
        }, 1500);
      } catch (err: unknown) {
        setMessages((prev) => prev.filter((m) => m.id !== optimisticId));

        if (err instanceof ApiClientError) {
          if (err.status === 404) {
            clearThreadId();
            setError(
              t('chatbot.sessionExpired', 'Session expired. Please send your message again.')
            );
          } else if (err.code === 'RATE_LIMITED') {
            setError(
              t('chatbot.rateLimited', 'You are sending messages too quickly. Please wait a moment.')
            );
          } else {
            setError(err.message);
          }
        } else {
          setError(t('chatbot.sendFailed', 'Failed to send message. Please try again.'));
        }
      } finally {
        setSending(false);
      }
    },
    [input, sending, t]
  );

  const toggleOpen = useCallback(() => {
    setOpen((prev) => !prev);
  }, []);

  const toggleVoiceInput = useCallback(() => {
    if (voice.status === 'listening' || voice.status === 'transcribing') {
      voice.stop();
    } else {
      setError(null);
      voice.listen();
    }
  }, [voice]);

  const voiceButtonLabel = () => {
    switch (voice.status) {
      case 'listening': return t('chatbot.voice.stop', 'Stop voice input');
      case 'transcribing': return t('chatbot.voice.transcribing', 'Processing speech…');
      default: return t('chatbot.voice.start', 'Use voice input');
    }
  };

  return (
    <>
      {/* Floating trigger button */}
      <button
        className="chatbot-trigger"
        ref={triggerRef}
        onClick={toggleOpen}
        aria-label={open ? t('chatbot.close', 'Close chat') : t('chatbot.open', 'Open chat')}
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
          ref={panelRef}
          role="dialog"
          aria-label={t('chatbot.panel.label', 'Chat with us')}
          aria-modal="true"
        >
          <div className="chatbot-header">
            <h3>{t('chatbot.panel.label', 'Chat with us')}</h3>
            <button
              className="chatbot-close"
              onClick={toggleOpen}
              aria-label={t('chatbot.close', 'Close chat')}
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
                {t('chatbot.empty', 'Ask us anything about our work, process, or how we can help.')}
              </div>
            )}

            {messages.map((msg) => (
              <div
                key={msg.id}
                className={`chat-message ${msg.senderType}`}
              >
                <div className="sender">
                  {msg.senderType === 'agent'
                    ? t('chatbot.sender.agent', 'R&A Assistant')
                    : t('chatbot.sender.visitor', 'You')}
                </div>
                {msg.content}
              </div>
            ))}

            {showRegistrationCta && (
              <div className="chatbot-registration-cta">
                <strong>{t('chatbot.cta.heading', 'Ready to shape the idea?')}</strong>
                <span>{t('chatbot.cta.body', 'Create a private workspace for your brief and project conversation.')}</span>
                <a href="/agent" className="cta primary">
                  {t('chatbot.cta.button', 'Start with our AI agent')}
                </a>
              </div>
            )}

            {error && (
              <div
                className="error-banner"
                role="alert"
              >
                {error}
              </div>
            )}

            {/* Show voice error if any */}
            {voice.errorMessage && !error && (
              <div
                className="error-banner"
                role="alert"
              >
                {voice.errorMessage}
              </div>
            )}

            <div ref={messagesEndRef} />
          </div>

          <form className="chatbot-input" onSubmit={sendMessage}>
            <label htmlFor="chat-input" className="sr-only">
              {t('chatbot.input.label', 'Type your message')}
            </label>
            <input
              id="chat-input"
              ref={inputRef}
              type="text"
              value={input}
              onChange={(e) => setInput(e.target.value)}
              placeholder={t('chatbot.input.placeholder', 'Type a message...')}
              maxLength={5000}
              disabled={sending}
              autoComplete="off"
            />
            {voice.supported && (
              <button
                type="button"
                className={`chatbot-voice${voice.status === 'listening' ? ' listening' : ''}`}
                onClick={toggleVoiceInput}
                disabled={sending}
                aria-label={voiceButtonLabel()}
                title={voiceButtonLabel()}
              >
                <svg
                  width="18"
                  height="18"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  aria-hidden="true"
                >
                  <rect x="9" y="2" width="6" height="12" rx="3" />
                  <path d="M5 11a7 7 0 0 0 14 0M12 18v4M8 22h8" />
                </svg>
              </button>
            )}
            <button type="submit" disabled={sending || !input.trim()}>
              {sending ? t('chatbot.sending', '...') : t('chatbot.send', 'Send')}
            </button>
          </form>
        </div>
      )}
    </>
  );
}
