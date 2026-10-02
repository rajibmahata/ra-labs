import { useCallback, useEffect, useRef, useState } from 'react';
import { api, ApiClientError, getSessionItem, removeSessionItem, setSessionItem, PlatformConfig, type ChatMessage } from '../api/client';
import { useVoice } from '../hooks/useVoice';
import { useI18n } from '../i18n';

export const AGENT_THREAD_KEY = 'ralabs-public.chat.thread';

interface AgentChatPanelProps {
  mode: 'page' | 'home';
}

interface UiMessage extends ChatMessage {
  copied?: boolean;
}

const STATUS_ONLINE = 'online';
const STATUS_OFFLINE = 'offline';

const QUICK_STARTERS: { emoji: string; key: string; fallback: string }[] = [
  { emoji: '\uD83D\uDE80', key: 'agent.starters.create', fallback: 'Start a Project' },
  { emoji: '\uD83D\uDCA1', key: 'agent.starters.about', fallback: 'Tell Me About RA Labs' },
  { emoji: '\uD83E\uDDE9', key: 'agent.starters.work', fallback: 'Explore Our Work' },
  { emoji: '\u2699\uFE0F', key: 'agent.starters.services', fallback: 'Our Services' },
  { emoji: '\uD83D\uDC65', key: 'agent.starters.team', fallback: 'Meet the Team' },
  { emoji: '\uD83D\uDCDE', key: 'agent.starters.contact', fallback: 'Contact Us' },
];

const QUICK_ACTIONS: { emoji: string; key: string; fallback: string }[] = [
  { emoji: '\uD83D\uDE80', key: 'agent.quick.start', fallback: 'Start a Project' },
  { emoji: '\u2039/\u203A', key: 'agent.quick.services', fallback: 'Our Services' },
  { emoji: '\uD83D\uDCC1', key: 'agent.quick.work', fallback: 'Our Work' },
  { emoji: '\uD83D\uDCA1', key: 'agent.quick.ask', fallback: 'Ask Anything' },
];

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
  const [drafting, setDrafting] = useState(false);
  const [interimTranscript, setInterimTranscript] = useState<string>('');
  const [dragOver, setDragOver] = useState(false);

  const fileRef = useRef<HTMLInputElement>(null);
  const endRef = useRef<HTMLDivElement>(null);
  const composerRef = useRef<HTMLTextAreaElement>(null);
  const lastVisitorSentRef = useRef<string>('');
  const dropRef = useRef<HTMLDivElement>(null);

  const voice = useVoice({
    enabled: config?.voiceEnabled ?? false,
    voiceResponse: config?.voiceResponse ?? false,
    maxDurationSeconds: config?.maxAudioDuration ?? 60,
    onTranscript: (text) => {
      setInput((current) => `${current.trim()}${current.trim() ? ' ' : ''}${text.trim()}`);
      setInterimTranscript('');
    },
    onInterimTranscript: (text) => {
      setInterimTranscript(text);
    },
  });

  const isDraft = drafting && input.trim().length > 0;

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
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    endRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, thinking]);

  useEffect(() => {
    const last = [...messages].reverse().find((m) => m.senderType === 'agent');
    setHandoffUrl(null);
    if (last && /register as a customer|track it yourself|customer portal/i.test(last.content)) {
      const base = config?.customerPortalUrl?.replace(/\/$/, '') ?? '/';
      setHandoffUrl(`${base}?agent=${threadId ?? ''}`);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [messages, threadId, config]);

  const send = useCallback(
    async (content: string) => {
      const text = content.trim();
      if (!text || sending) return;
      setError(null);
      setInput('');
      setDrafting(false);
      setInterimTranscript('');
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
          if (agentReply && config?.voiceResponse) voice.speak(agentReply.content);
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
    [threadId, sending, pendingFile, ensureThread, config, voice],
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

  const autosize = useCallback(() => {
    const el = composerRef.current;
    if (!el) return;
    el.style.height = 'auto';
    el.style.height = `${Math.min(el.scrollHeight, 150)}px`;
  }, []);

  const onKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && e.shiftKey) return;
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

  useEffect(() => {
    autosize();
  }, [input, autosize]);

  const agentList = messages.filter((m) => m.senderType === 'agent');
  const suggested = agentList[agentList.length - 1]?.suggestedActions ?? null;
  const showWelcome = messages.length === 0;

  const onDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setDragOver(true);
  };

  const onDragLeave = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setDragOver(false);
  };

  const onDrop = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setDragOver(false);
    if (e.dataTransfer.files.length > 0) {
      void pickFile(e.dataTransfer.files[0]);
    }
  };

  const handleVoiceClick = () => {
    if (voice.status === 'listening' || voice.status === 'transcribing') {
      voice.stop();
    } else if (voice.status === 'speaking') {
      voice.stopSpeaking();
    } else {
      voice.listen();
    }
  };

  const voiceButtonLabel = () => {
    switch (voice.status) {
      case 'listening': return t('agent.voice.stop', 'Stop voice input');
      case 'transcribing': return t('agent.voice.transcribing', 'Processing speech…');
      case 'speaking': return t('agent.voice.stopSpeaking', 'Stop speaking');
      default: return t('agent.voice.start', 'Speak your message');
    }
  };

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
        {mode === 'page' && (
          <div className="agent-panel-tools" aria-hidden="true">
            <button type="button" tabIndex={-1} aria-hidden="true">{'\u25D6'}</button>
            <button type="button" tabIndex={-1} aria-hidden="true">{'\u2667'}</button>
            <button type="button" tabIndex={-1} aria-hidden="true">{'\u22EE'}</button>
          </div>
        )}
      </header>

      <div className="agent-quick-row" role="group" aria-label={t('agent.quick.label', 'Quick actions')}>
        {QUICK_ACTIONS.map((item) => (
          <button
            key={item.key}
            type="button"
            className="agent-quick-chip"
            onClick={() => void send(t(item.key, item.fallback))}
            disabled={sending}
          >
            <span aria-hidden="true">{item.emoji}</span> {t(item.key, item.fallback)}
          </button>
        ))}
      </div>

      {showWelcome && (
        <div className="agent-welcome-premium">
          <h2 className="agent-welcome-heading">
            {t('agent.welcome.heading', "Hi, I'm the RA Labs assistant")}
          </h2>
          <div className="agent-bubble agent">
            <span className="visually-hidden">{t('agent.welcome.sr', 'RA Labs agent says:')}</span>
            {t('agent.welcome.body', "Hi! I am the R&A Labs assistant. Ask about our work, services and process — or tell me about your project and I will collect a brief for the team.")}
          </div>
          <div className="agent-starter-cards" role="list" aria-label={t('agent.starters.label', 'Conversation starters')}>
            {QUICK_STARTERS.map((item) => (
              <button
                key={item.key}
                type="button"
                className="agent-starter-card"
                role="listitem"
                onClick={() => void send(t(item.key, item.fallback))}
                disabled={sending}
              >
                <span className="agent-starter-emoji" aria-hidden="true">{item.emoji}</span>
                <span>{t(item.key, item.fallback)}</span>
              </button>
            ))}
          </div>
        </div>
      )}

      <div className="agent-messages" role="log" aria-live="polite" aria-busy={streaming}>

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
              <span className="visually-hidden">{message.senderType === 'agent' ? t('agent.sender.agent', 'RA Labs agent') : t('agent.sender.visitor', 'You')}:</span>
              {message.content}
            </div>
            <div className="agent-message-meta">
              <span className="agent-msg-time">
                {new Date(message.createdAt).toLocaleTimeString(undefined, { hour: '2-digit', minute: '2-digit' })}
              </span>
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

        {suggested && !thinking && !streaming && (
          <div className="agent-suggested-chips" role="group" aria-label={t('agent.suggested.label', 'Suggested actions')}>
            {suggested.map((action) => (
              <button
                key={action}
                type="button"
                className="agent-action-chip"
                onClick={() => void send(action)}
                disabled={sending}
              >
                {action}
              </button>
            ))}
          </div>
        )}

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

      {voice.errorMessage && (
        <div className="agent-error" role="alert">
          {voice.errorMessage}
        </div>
      )}

      <div
        className={`agent-composer${dragOver ? ' agent-composer--drop' : ''}`}
        ref={dropRef}
        onDragOver={onDragOver}
        onDragEnter={onDragOver}
        onDragLeave={onDragLeave}
        onDrop={onDrop}
      >
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
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
            <path d="M21.44 11.05l-9.19 9.19a6 6 0 0 1-8.49-8.49l9.19-9.19a4 4 0 0 1 5.66 5.66l-9.2 9.19a2 2 0 0 1-2.83-2.83l8.49-8.48" />
          </svg>
        </button>
        {pendingFile && (
          <span className="agent-file-chip">
            <span className="agent-file-chip-name">{pendingFile.name}</span>
            <button type="button" aria-label={t('agent.attach.remove', 'Remove attachment')} onClick={() => setPendingFile(null)}>
              &times;
            </button>
          </span>
        )}
        <label className="agent-composer-field">
          <span className="visually-hidden">{t('agent.composer.label', 'Message')}</span>
          {isDraft && (
            <span className="agent-draft-chip">
              {t('agent.draft.label', 'Draft')}
            </span>
          )}
          {interimTranscript && (
            <span className="agent-interim-text" aria-live="polite">
              {interimTranscript}
            </span>
          )}
          <textarea
            ref={composerRef}
            value={input}
            onChange={(e) => {
              setInput(e.target.value);
              setDrafting(true);
              if (!e.target.value.trim() && !interimTranscript) {
                setInterimTranscript('');
              }
            }}
            onKeyDown={onKeyDown}
            placeholder={t('agent.composer.placeholder', 'Ask the agent or describe your project…')}
            rows={1}
            aria-label={t('agent.composer.label', 'Message')}
          />
        </label>
        {(config?.voiceEnabled && voice.supported) ? (
          <button
            type="button"
            className={`agent-tool-btn agent-voice-btn${voice.status === 'listening' ? ' agent-voice-btn--listening' : ''}${voice.status === 'transcribing' ? ' agent-voice-btn--transcribing' : ''}${voice.status === 'speaking' ? ' agent-voice-btn--speaking' : ''}`}
            aria-label={voiceButtonLabel()}
            title={voiceButtonLabel()}
            onClick={handleVoiceClick}
          >
            {voice.status === 'speaking' ? (
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                <rect x="6" y="4" width="4" height="16" /><rect x="14" y="4" width="4" height="16" />
              </svg>
            ) : voice.status === 'transcribing' ? (
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                <circle cx="12" cy="12" r="10" /><polyline points="12 6 12 12 16 14" />
              </svg>
            ) : (
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                <rect x="9" y="2" width="6" height="12" rx="3" />
                <path d="M5 11a7 7 0 0 0 14 0M12 18v4M8 22h8" />
              </svg>
            )}
          </button>
        ) : null}
        <button
          type="button"
          className="agent-send"
          onClick={() => void send(input)}
          disabled={!input.trim() || sending}
        >
          {sending ? t('agent.sending', 'Sending…') : t('agent.send', 'Send')}
        </button>
      </div>

      {dragOver && (
        <div className="agent-dropoverlay" aria-hidden="true">
          {t('agent.drop.hint', 'Drop your file here to attach it')}
        </div>
      )}

      {!inSheet && mode === 'page' && (
        <div className="agent-voice-note">
          {t('agent.voice.note', '\u2662 You can type or use your voice to talk to the agent.')}
        </div>
      )}
    </section>
  );

  if (mode === 'page') {
    return <div className="agent-page">{renderPanel(false)}</div>;
  }

  return (
    <div className="agent-home-inline">
      {renderPanel(false)}
    </div>
  );
}
