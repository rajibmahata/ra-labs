import { useCallback, useEffect, useRef, useState } from 'react';
import { api, ApiClientError } from '../api/client';
import type { ChatMessage, PlatformConfig } from '../types';

const AGENT_THREAD_KEY = 'ralabs-customer.agent-thread';

interface VoiceLike {
  continuous: boolean;
  interimResults: boolean;
  lang: string;
  onresult: ((event: { resultIndex: number; results: { [i: number]: { 0: { transcript: string } } } }) => void) | null;
  onerror: ((event: { error: string }) => void) | null;
  onend: (() => void) | null;
  start: () => void;
  stop: () => void;
}

const QUICK_ACTIONS = ['Create a project', 'Tell me about RA Labs', 'Explore projects', 'Contact us'];

export default function AgentChat() {
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [threadId, setThreadId] = useState<string | null>(null);
  const [config, setConfig] = useState<PlatformConfig | null>(null);
  const [input, setInput] = useState('');
  const [sending, setSending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [listening, setListening] = useState(false);
  const [speaking, setSpeaking] = useState(false);
  const [pendingFile, setPendingFile] = useState<{ name: string; url: string } | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);
  const recognitionRef = useRef<{ stop: () => void } | null>(null);
  const endRef = useRef<HTMLDivElement>(null);

  const ensureThread = useCallback(async (): Promise<string> => {
    const saved = getAgentThread();
    if (saved) {
      try {
        await api.claimAgentThread(saved);
        return saved;
      } catch {
        removeAgentThread();
      }
    }
    const created = await api.createAgentThread();
    setAgentThread(created.data.id);
    return created.data.id;
  }, []);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const [cfg, id] = await Promise.all([api.getConfig(), ensureThread()]);
        if (cancelled) return;
        setConfig(cfg.data);
        setThreadId(id);
        const thread = await api.getAgentThread(id);
        if (cancelled) return;
        setMessages(thread.data.messages ?? []);
      } catch {
        if (!cancelled) setError('Could not reach the assistant right now. Please try again later.');
      }
    })();
    return () => {
      cancelled = true;
      recognitionRef.current?.stop();
      window.speechSynthesis?.cancel();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    endRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, sending]);

  const speak = useCallback((text: string) => {
    if (!config?.voiceResponse || !('speechSynthesis' in window)) return;
    window.speechSynthesis.cancel();
    const utterance = new SpeechSynthesisUtterance(text.replace(/[•·\n]/g, '. '));
    utterance.onstart = () => setSpeaking(true);
    utterance.onend = () => setSpeaking(false);
    utterance.onerror = () => setSpeaking(false);
    window.speechSynthesis.speak(utterance);
  }, [config]);

  const send = useCallback(
    async (content: string) => {
      const text = content.trim();
      if (!text || sending) return;
      setError(null);
      setInput('');
      const attachmentUrl = pendingFile?.url ?? null;
      setPendingFile(null);

      try {
        setSending(true);
        const thread = threadId ?? (await ensureThread());
        await api.sendAgentMessage(thread, { content: text, attachmentUrl });
        const updated = await api.getAgentThread(thread);
        setMessages(updated.data.messages ?? []);
        const list = updated.data.messages ?? [];
        const reply = [...list].reverse().find((m) => m.senderType === 'agent');
        if (reply) speak(reply.content);
      } catch (err) {
        if (err instanceof ApiClientError) {
          setError(err.status === 429 ? 'You are sending messages too quickly. Please wait a moment.' : err.message);
        } else {
          setError('Failed to send the message. Please try again.');
        }
      } finally {
        setSending(false);
      }
    },
    [threadId, sending, pendingFile, ensureThread, speak]
  );

  const toggleVoice = useCallback(() => {
    if (listening) {
      recognitionRef.current?.stop();
      return;
    }
    setError(null);
    const windowWithSpeech = window as unknown as {
      SpeechRecognition?: new () => VoiceLike;
      webkitSpeechRecognition?: new () => VoiceLike;
    };
    const Recognition = windowWithSpeech.SpeechRecognition ?? windowWithSpeech.webkitSpeechRecognition;
    if (!Recognition) {
      setError('Voice input is not supported in this browser. You can still type.');
      return;
    }
    const recognition = new Recognition();
    recognition.continuous = false;
    recognition.interimResults = false;
    recognition.lang = document.documentElement.lang || 'en-US';
    recognition.onresult = (event) => {
      const transcript = event.results[event.resultIndex]?.[0]?.transcript?.trim();
      if (transcript) setInput((current) => `${current.trim()}${current.trim() ? ' ' : ''}${transcript}`);
    };
    recognition.onerror = (event) => {
      recognitionRef.current = null;
      setListening(false);
      if (event.error === 'not-allowed' || event.error === 'service-not-allowed') {
        setError('Microphone permission was denied. Enable it in your browser and try again.');
      } else {
        setError('Voice input was not available. You can still type your message.');
      }
    };
    recognition.onend = () => {
      recognitionRef.current = null;
      setListening(false);
    };
    recognitionRef.current = recognition;
    setListening(true);
    try {
      recognition.start();
    } catch {
      recognitionRef.current = null;
      setListening(false);
      setError('Voice input could not be started. You can still type your message.');
    }
  }, [listening]);

  const pickFile = async (file: File | undefined) => {
    if (!file) return;
    setError(null);
    try {
      const result = await api.uploadChatAttachment(file);
      setPendingFile({ name: file.name, url: result.data.url });
    } catch (err) {
      setError(err instanceof ApiClientError ? err.message : 'Could not upload the file.');
    }
  };

  const agentList = messages.filter((m) => m.senderType === 'agent');
  const suggested = agentList[agentList.length - 1]?.suggestedActions ?? null;
  const showQuickActions = messages.length === 0 || (suggested?.length ?? 0) === 0;

  return (
    <div className="agent-page">
      <header className="agent-header">
        <h1>RA Labs <em>AI Agent</em></h1>
        <p className="agent-subtitle">Ask questions or pick up where your project brief left off.</p>
        {listening && <p className="agent-voice-note">Listening… speak now.</p>}
        {speaking && (
          <button type="button" className="agent-voice-stop" onClick={() => window.speechSynthesis?.cancel()}>
            Stop reading
          </button>
        )}
      </header>

      <section className="agent-chat" aria-label="AI agent conversation">
        <div className="agent-messages" aria-live="polite">
          {messages.length === 0 && (
            <div className="agent-welcome">
              <p>Hi! I'm the R&amp;A Labs assistant. Ask me anything, or pick an option below to get started.</p>
            </div>
          )}
          {messages.map((message) => (
            <div key={message.id} className={`agent-message ${message.senderType}`}>
              {message.attachmentUrl && (
                <div className="agent-attachment">
                  <a href={message.attachmentUrl} target="_blank" rel="noreferrer">
                    {message.attachmentUrl.toLowerCase().match(/\.(png|jpe?g|gif|webp)(\?|$)/)
                      ? <img src={message.attachmentUrl} alt="Attached file" />
                      : 'View attached file'}
                  </a>
                </div>
              )}
              <div className="agent-bubble">{message.content}</div>
              {message.suggestedActions && message.suggestedActions.length > 0 && (
                <div className="agent-actions">
                  {message.suggestedActions.map((action) => (
                    <button key={action} type="button" onClick={() => void send(action)} disabled={sending}>
                      {action}
                    </button>
                  ))}
                </div>
              )}
            </div>
          ))}
          {sending && <p className="agent-sending">Assistant is typing…</p>}
          <div ref={endRef} />
        </div>

        {error && <p className="agent-error" role="alert">{error}</p>}

        <div className="agent-composer">
          <input
            ref={fileRef}
            type="file"
            accept="image/*,.pdf,.txt,.md,.json,.zip"
            className="visually-hidden"
            onChange={(e) => void pickFile(e.target.files?.[0])}
          />
          <button type="button" className="agent-tool-btn" aria-label="Attach a file" onClick={() => fileRef.current?.click()}>+</button>
          {pendingFile && (
            <span className="agent-file-chip">
              {pendingFile.name} <button type="button" onClick={() => setPendingFile(null)}>×</button>
            </span>
          )}
          {config?.voiceEnabled && (
            <button
              type="button"
              className={`agent-tool-btn ${listening ? 'agent-voice-on' : ''}`}
              aria-label={listening ? 'Stop voice input' : 'Speak your message'}
              onClick={toggleVoice}
            >
              🎤
            </button>
          )}
          <textarea
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter' && !e.shiftKey) {
                e.preventDefault();
                void send(input);
              }
            }}
            placeholder="Ask the agent or describe your project…"
            rows={1}
            aria-label="Message"
          />
          <button type="button" className="agent-send" onClick={() => void send(input)} disabled={!input.trim() || sending}>
            Send
          </button>
        </div>

        {showQuickActions && (
          <div className="agent-quick-actions">
            {QUICK_ACTIONS.map((action) => (
              <button key={action} type="button" onClick={() => void send(action)} disabled={sending}>
                {action}
              </button>
            ))}
          </div>
        )}
      </section>
    </div>
  );
}

function getAgentThread(): string | null {
  try {
    return localStorage.getItem(AGENT_THREAD_KEY);
  } catch {
    return null;
  }
}

function setAgentThread(id: string): void {
  try {
    localStorage.setItem(AGENT_THREAD_KEY, id);
  } catch {
    // Storage unavailable
  }
}

function removeAgentThread(): void {
  try {
    localStorage.removeItem(AGENT_THREAD_KEY);
  } catch {
    // No-op
  }
}
