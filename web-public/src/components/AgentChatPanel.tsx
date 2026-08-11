import { useCallback, useEffect, useRef, useState } from 'react';
import { api, ApiClientError, getSessionItem, removeSessionItem, setSessionItem, PlatformConfig, type ChatMessage } from '../api/client';
import { useVoice } from '../hooks/useVoice';
import { useI18n } from '../i18n';

export const AGENT_THREAD_KEY = 'ralabs-public.chat.thread';

interface AgentChatPanelProps {
  /** 'page' — full-page assistant screen (/agent). 'home' — embedded hero panel;
   * collapses to a floating trigger + bottom sheet below the desktop breakpoint. */
  mode: 'page' | 'home';
}

interface UiMessage extends ChatMessage {
  copied?: boolean;
}

const STATUS_ONLINE = 'online';
const STATUS_OFFLINE = 'offline';

export default function AgentChatPanel({ mode }: AgentChatPanelProps) {
  const { t } = useI18n();

  const [messages, setMessages] = useState<UiMessage[]>([]);
  const [threadId, setThreadId] = useState<string | null>(null);
  const [config, setConfig] = useState<PlatformConfig | null>(null);
  const [input, setInput] = useState('');
  const [sending, setSending] = useState(false);
  const [thinking, setThinking] = useState(false);
  const [streaming, setStreaming] = useState(false);
  const [streamingId, setStreamingId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [pendingFile, setPendingFile] = useState<{ name: string; url: string } | null>(null);
  const [handoffUrl, setHandoffUrl] = useState<string | null>(null);
  const [status, setStatus] = useState<'online' | 'offline'>(STATUS_ONLINE);
  const [sheetOpen, setSheetOpen] = useState(false);
  const [drafting, setDrafting] = useState(false);

  const fileRef = useRef<HTMLInputElement>(null);
  const endRef = useRef<HTMLDivElement>(null);
  const composerRef = useRef<HTMLTextAreaElement>(null);
  const lastVisitorSentRef = useRef<string>('');

  // Draft = composer holds text that has not been finalized (sent) yet.
  const isDraft = drafting && input.trim().length > 0;

  const voice = useVoice({
    enabled: config?.voiceEnabled ?? false,
    voiceResponse: config?.voiceResponse ?? false,
    maxDurationSeconds: config?.maxAudioDuration ?? 60,
    onTranscript: (text) => setInput((current) => `${current.trim()}${current.trim() ? ' ' : ''}${text}`),
  });

  const ensureThread = useCallback(async (): Promise<string> => {
    const saved = getSessionItem(AGENT_THREAD_KEY);
    if (saved) {
      try {
        const existing = await api.getChatThread(saved);
        if (existing.data?.id) return saved;
      } catch (err) {
        if (!(err instanceof ApiClientError) || err.status !== 404) throw err;
        removeSessionItem(AGENT_THREAD_KEY);
      }
    }
    const created = await api.createChatThread();
    setSessionItem(AGENT_THREAD_KEY, created.data.id);
    return created.data.id;
  }, []);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const [cfg, threadIdResolved] = await Promise.all([
          api.getConfig(),
          ensureThread(),
        ]);
        if (cancelled) return;
        setConfig(cfg.data);
        setThreadId(threadIdResolved);
        const thread = await api.getChatThread(threadIdResolved);
        if (cancelled) return;
        setMessages((thread.data.messages ?? []).map((m) => ({ ...m, copied: false })));
        setStatus(STATUS_ONLINE);
      } catch {
        if (!cancelled) {
          setStatus(STATUS_OFFLINE);
          setError(t('agent.loadFailed', 'Could not reach the assistant right now. Please try again later.'));
        }
      }
    })();
    return () => {
      cancelled = true;
      voice.stop();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    endRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, thinking]);

  // Conversation continuity: the agent thread is shared between the homepage
  // panel and the /agent page (same session key), so a brief started in the
  // hero follows the visitor to the full screen.
  useEffect(() => {
    const last = [...messages].reverse().find((m) => m.senderType === 'agent');
    setHandoffUrl(null);
    if (last && /register as a customer|track it yourself|customer portal/i.test(last.content)) {
      const base = config?.customerPortalUrl?.replace(/\/$/, '') ?? '/';
      setHandoffUrl(`${base}?agent=${threadId ?? ''}`);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [messages, threadId, config]);

  const speakReply = useCallback((reply: UiMessage | undefined) => {
    if (reply && config?.voiceResponse) voice.speak(reply.content);
  }, [config, voice]);

  const send = useCallback(
    async (content: string) => {
      const text = content.trim();
      if (!text || sending) return;
      setError(null);
      setInput('');
      setDrafting(false);
      lastVisitorSentRef.current = text;
      const attachmentUrl = pendingFile?.url ?? null;
      setPendingFile(null);

      const optimistic: UiMessage = {
        id: `local-${Date.now()}`,
        senderType: 'visitor',
        senderName: 'Visitor',
        content: text,
        attachmentUrl,
        suggestedActions: null,
        createdAt: new Date().toISOString(),
        copied: false,
      };
      setMessages((current) => [...current, optimistic]);

      let streamedId: string | null = null;
      try {
        setThinking(true);
        setSending(true);
        const thread = threadId ?? (await ensureThread());

        // Streaming path (only when enabled server-side and no guided flow pending).
        let streamed = false;
        if (config?.streamingEnabled) {
          setStreaming(true);
          const streamedMessage: UiMessage = {
            id: `stream-${Date.now()}`,
            senderType: 'agent',
            senderName: 'Agent',
            content: '',
            attachmentUrl: null,
            suggestedActions: null,
            createdAt: new Date().toISOString(),
            copied: false,
          };
          streamedId = streamedMessage.id;
          setStreamingId(streamedMessage.id);
          setMessages((current) => [...current, streamedMessage]);
          const final = await api.streamChatMessage(thread, { content: text, attachmentUrl }, (delta) => {
            setMessages((current) =>
              current.map((m) => (m.id === streamedMessage.id ? { ...m, content: m.content + delta } : m))
            );
          });
          if (final !== null) {
            streamed = true;
            setMessages((current) =>
              current.map((m) => (m.id === streamedMessage.id ? { ...m, content: final } : m))
            );
            if (config.voiceResponse) voice.speak(final);
          } else {
            setMessages((current) => current.filter((m) => m.id !== streamedMessage.id));
          }
        }

        if (!streamed) {
          const summary = await api.sendChatMessage(thread, { content: text, attachmentUrl });
          if (summary.data?.id && summary.data.id !== thread) setThreadId(summary.data.id);
          const updated = await api.getChatThread(thread);
          setMessages((updated.data.messages ?? []).map((m) => ({ ...m, copied: false })));
          const agentReply = [...(updated.data.messages ?? [])].reverse().find((m) => m.senderType === 'agent');
          if (agentReply) speakReply(agentReply);
        }
      } catch (err) {
        setMessages((current) => current.filter((m) => m.id !== optimistic.id && m.id !== streamedId));
        if (err instanceof ApiClientError) {
          if (err.status === 404) {
            removeSessionItem(AGENT_THREAD_KEY);
            setError(t('agent.sessionExpired', 'Session expired. Send your message again and a new conversation will start.'));
          } else if (err.code === 'RATE_LIMITED') {
            setError(t('agent.rateLimited', 'You are sending messages too quickly. Please wait a moment.'));
          } else {
            setError(err.message);
          }
        } else {
          setError(t('agent.sendFailed', 'Failed to send the message. Please try again.'));
        }
      } finally {
        setThinking(false);
        setSending(false);
        setStreaming(false);
        setStreamingId(null);
      }
    },
    [threadId, sending, pendingFile, ensureThread, speakReply]
  );

  const pickFile = async (file: File | undefined) => {
    if (!file) return;
    setError(null);
    try {
      const result = await api.uploadChatAttachment(file);
      setPendingFile({ name: file.name, url: result.data.url });
    } catch (err) {
      setError(err instanceof ApiClientError ? err.message : t('agent.uploadFailed', 'Could not upload the file.'));
    }
  };

  const copyMessage = async (id: string, text: string) => {
    try {
      await navigator.clipboard.writeText(text);
      setMessages((current) => current.map((m) => (m.id === id ? { ...m, copied: true } : m)));
      window.setTimeout(() => {
        setMessages((current) => current.map((m) => (m.id === id ? { ...m, copied: false } : m)));
      }, 2000);
    } catch {
      setError(t('agent.copyFailed', 'Could not copy the message.'));
    }
  };

  const onKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && e.shiftKey) return; // newline
    if (e.key === 'Enter' && (e.ctrlKey || e.metaKey)) {
      e.preventDefault();
      void send(input);
      return;
    }
    if (e.key === 'Enter') {
      e.preventDefault();
      void send(input);
      return;
    }
    if (e.key === 'ArrowUp' && input.trim() === '') {
      e.preventDefault();
      const last = [...messages].reverse().find((m) => m.senderType === 'visitor');
      if (last) setInput(last.content);
    }
  };

  // Focus the composer when the mobile sheet opens; lock body scroll so the
  // page does not scroll behind the sheet.
  useEffect(() => {
    if (mode === 'home' && sheetOpen) {
      composerRef.current?.focus();
      document.body.style.overflow = 'hidden';
      return () => {
        document.body.style.overflow = '';
      };
    }
    return undefined;
  }, [mode, sheetOpen]);

  // Esc closes the mobile bottom sheet (home mode). On the page mode there is
  // nothing to dismiss, so Esc just blurs the composer.
  useEffect(() => {
    if (mode === 'home' && !sheetOpen) return;
    const onEsc = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        if (mode === 'home' && sheetOpen) {
          setSheetOpen(false);
          return;
        }
        composerRef.current?.blur();
      }
    };
    document.addEventListener('keydown', onEsc);
    return () => document.removeEventListener('keydown', onEsc);
  }, [mode, sheetOpen]);

  const agentList = messages.filter((m) => m.senderType === 'agent');
  const suggested = agentList[agentList.length - 1]?.suggestedActions ?? null;
  const showQuickActions = messages.length === 0 || (suggested?.length ?? 0) === 0;

  const QUICK_ACTIONS = [
    t('agent.starters.create', 'Create a project'),
    t('agent.starters.about', 'Tell me about RA Labs'),
    t('agent.starters.work', 'Explore projects'),
    t('agent.starters.contact', 'Contact us'),
  ];

  const renderPanel = (inSheet: boolean) => (
    <section
      className={`agent-panel agent-panel--${mode}${inSheet ? ' agent-panel--sheet' : ''}`}
      aria-label={t('agent.panel.label', 'R&A Labs AI agent')}
      {...(inSheet ? { role: 'dialog', 'aria-modal': 'true' } : {})}
    >
      <header className="agent-panel-header">
        <div className="agent-panel-title">
          <span className="agent-avatar" aria-hidden="true" />
          <div>
            <strong>RA Labs AI Agent</strong>
            <span className={`agent-status agent-status--${status}`} role="status">
              <span className="agent-status-dot" aria-hidden="true" />
              {status === STATUS_ONLINE
                ? t('agent.status.online', 'Online — replies in seconds')
                : t('agent.status.offline', 'Temporarily offline')}
            </span>
          </div>
        </div>
        {inSheet && (
          <button
            type="button"
            className="agent-panel-close"
            aria-label={t('agent.close', 'Close assistant')}
            onClick={() => setSheetOpen(false)}
          >
            &times;
          </button>
        )}
      </header>

      <div className="agent-messages" role="log" aria-live="polite">
        {messages.length === 0 && (
          <div className="agent-welcome">
            <p>
              {t(
                'agent.welcome',
                "Hi! I'm the R&A Labs assistant. Ask about our work, services and process — or tell me about your project and I'll collect a brief for the team."
              )}
            </p>
          </div>
        )}

        {messages.map((message) => (
          <div key={message.id} className={`agent-message ${message.senderType}`}>
            {message.attachmentUrl && (
              <div className="agent-attachment">
                <a href={message.attachmentUrl} target="_blank" rel="noreferrer">
                  {message.attachmentUrl.toLowerCase().match(/\.(png|jpe?g|gif|webp)(\?|$)/)
                    ? <img src={message.attachmentUrl} alt={t('agent.attachment.alt', 'Attached file')} />
                    : t('agent.attachment.view', 'View attached file')}
                </a>
              </div>
            )}
            <div className="agent-bubble">
              <span className="visually-hidden">{message.senderType === 'agent' ? 'RA Labs agent' : 'You'}:</span>
              {message.content}
            </div>
            <div className="agent-message-meta">
              {message.senderType === 'visitor' && (
                <span className="agent-msg-tag">{t('agent.draft.final', 'Sent')}</span>
              )}
              {message.senderType === 'agent' && (
                <span className="agent-msg-tag">
                  {streamingId === message.id
                    ? t('agent.draft.finalizing', 'Finalizing…')
                    : t('agent.draft.finalized', 'Finalized')}
                </span>
              )}
              <button
                type="button"
                className="agent-copy"
                onClick={() => void copyMessage(message.id, message.content)}
                disabled={message.content.length === 0}
              >
                {message.copied ? t('agent.copied', 'Copied') : t('agent.copy', 'Copy')}
              </button>
            </div>
          </div>
        ))}

        {thinking && !streaming && (
          <div className="agent-message agent">
            <div className="agent-bubble agent-thinking" aria-hidden="true">
              <span /> <span /> <span />
            </div>
            <div className="agent-message-meta">
              <span className="agent-msg-tag">{t('agent.typing', 'Finalizing…')}</span>
            </div>
            <span className="visually-hidden">{t('agent.typing', 'Agent is responding')}</span>
          </div>
        )}
        <div ref={endRef} />
      </div>

      {handoffUrl && (
        <div className="agent-handoff">
          <p>{t('agent.handoff.body', 'Want to track this request? Continue in the customer portal.')}</p>
          <a href={handoffUrl} className="agent-handoff-link">
            {t('agent.handoff.cta', 'Open customer portal')} &rarr;
          </a>
        </div>
      )}

      {error && (
        <div className="agent-error" role="alert">
          <span aria-hidden="true" /> {error}
        </div>
      )}

      <div className="agent-composer">
        <input
          ref={fileRef}
          type="file"
          accept="image/*,.pdf,.txt,.md,.json,.zip"
          className="visually-hidden"
          onChange={(e) => pickFile(e.target.files?.[0])}
        />
        <button
          type="button"
          className="agent-tool-btn"
          aria-label={t('agent.attach', 'Attach a file')}
          title={t('agent.attach', 'Attach a file')}
          onClick={() => fileRef.current?.click()}
        >
          +
        </button>
        {pendingFile && (
          <span className="agent-file-chip">
            {pendingFile.name}{' '}
            <button type="button" aria-label={t('agent.attach.remove', 'Remove attachment')} onClick={() => setPendingFile(null)}>
              &times;
            </button>
          </span>
        )}
        {(config?.voiceEnabled && voice.supported) ? (
          <button
            type="button"
            className={`agent-tool-btn ${voice.status === 'listening' ? 'agent-voice-on' : ''}`}
            aria-label={voice.status === 'listening' ? t('agent.voice.stop', 'Stop voice input') : t('agent.voice.start', 'Speak your message')}
            title={voice.status === 'listening' ? t('agent.voice.stop', 'Stop') : t('agent.voice.start', 'Speak')}
            onClick={() => (voice.status === 'listening' ? voice.stop() : voice.listen())}
          >
            <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
              <rect x="9" y="2" width="6" height="12" rx="3" />
              <path d="M5 11a7 7 0 0 0 14 0M12 18v4M8 22h8" />
            </svg>
          </button>
        ) : null}
        <label className="agent-composer-field">
          <span className="visually-hidden">{t('agent.composer.label', 'Message')}</span>
          {isDraft && (
            <span className="agent-draft-chip">
              {t('agent.draft.label', 'Draft')}
            </span>
          )}
          <textarea
            ref={composerRef}
            value={input}
            onChange={(e) => {
              setInput(e.target.value);
              setDrafting(true);
            }}
            onKeyDown={onKeyDown}
            placeholder={t('agent.composer.placeholder', 'Ask the agent or describe your project…')}
            rows={1}
            aria-label={t('agent.composer.label', 'Message')}
          />
        </label>
        <button
          type="button"
          className="agent-send"
          onClick={() => void send(input)}
          disabled={!input.trim() || sending}
        >
          {sending ? t('agent.sending', 'Sending…') : t('agent.send', 'Send')}
        </button>
      </div>

      {showQuickActions && (
        <div className="agent-starters">
          <span className="agent-starters-label">{t('agent.starters.label', 'Conversation starters')}</span>
          {QUICK_ACTIONS.map((action) => (
            <button key={action} type="button" onClick={() => void send(action)} disabled={sending}>
              {action}
            </button>
          ))}
        </div>
      )}
    </section>
  );

  if (mode === 'page') {
    return <div className="agent-page">{renderPanel(false)}</div>;
  }

  // Home mode: one panel instance. On desktop it sits inline in the hero grid;
  // below the breakpoint the same instance becomes a bottom sheet (CSS), opened
  // by the floating trigger. Single instance = one thread, one config fetch.
  return (
    <>
      <div className={`agent-home-inline${sheetOpen ? ' agent-home-inline--open' : ''}`}>
        {renderPanel(sheetOpen)}
      </div>
      <button
        type="button"
        className="agent-fab"
        aria-label={sheetOpen ? t('agent.close', 'Close assistant') : t('agent.open', 'Open assistant')}
        aria-expanded={sheetOpen}
        onClick={() => setSheetOpen((open) => !open)}
      >
        <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
          {sheetOpen ? (<><line x1="18" y1="6" x2="6" y2="18" /><line x1="6" y1="6" x2="18" y2="18" /></>) : (<><path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" /><path d="M8 9h8M8 13h5" /></>)}
        </svg>
      </button>
      {sheetOpen && (
        <div className="agent-sheet-scrim agent-sheet-scrim--show" onClick={() => setSheetOpen(false)} aria-hidden="true" />
      )}
    </>
  );
}