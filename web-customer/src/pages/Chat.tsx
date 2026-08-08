import { useState, useEffect, useCallback, useRef, type FormEvent } from 'react';
import { useParams, Link, useNavigate } from 'react-router-dom';
import { api, ApiClientError } from '../api/client';
import {
  countQueuedChatMessages,
  flushQueuedChatMessages,
  queueChatMessage,
} from '../api/offlineQueue';
import type { ChatMessage } from '../types';
import LoadingSpinner from '../components/LoadingSpinner';
import { parseVoiceCommand } from '../voiceCommands';

// 5 second poll interval
const POLL_INTERVAL = 5000;

type SpeechRecognitionLike = {
  start: () => void;
  stop: () => void;
  lang?: string;
  interimResults?: boolean;
  maxAlternatives?: number;
  onresult: ((event: { results: ArrayLike<ArrayLike<{ transcript: string }>> }) => void) | null;
  onend: (() => void) | null;
};

export default function Chat() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();

  const [projectId, setProjectId] = useState<string | null>(null);
  const [projectTitle, setProjectTitle] = useState('');
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const [input, setInput] = useState('');
  const [sending, setSending] = useState(false);
  const [sendError, setSendError] = useState('');
  const [queuedCount, setQueuedCount] = useState(0);
  const [listening, setListening] = useState(false);
  const [voiceStatus, setVoiceStatus] = useState('');

  const messagesEndRef = useRef<HTMLDivElement>(null);
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const recognitionRef = useRef<SpeechRecognitionLike | null>(null);

  useEffect(() => () => recognitionRef.current?.stop(), []);

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
        setProjectId(id);
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
    if (!projectId) return;

    try {
      const res = await api.getProjectChat(projectId);
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
  }, [projectId, loading]);

  // Initial load
  useEffect(() => {
    if (projectId) {
      loadMessages();
    }
  }, [projectId]); // eslint-disable-line react-hooks/exhaustive-deps

  // Poll for new messages
  useEffect(() => {
    if (!projectId) return;

    pollRef.current = setInterval(() => {
      loadMessages();
    }, POLL_INTERVAL);

    return () => {
      if (pollRef.current) clearInterval(pollRef.current);
    };
  }, [projectId, loadMessages]);

  const flushQueue = useCallback(async () => {
    if (!navigator.onLine) return;
    await flushQueuedChatMessages(async (queuedProjectId, content) => {
      const response = await api.sendProjectChatMessage(queuedProjectId, {
        content,
        attachmentUrl: null,
      });
      return response.data;
    });
    setQueuedCount(await countQueuedChatMessages());
    await loadMessages();
  }, [loadMessages]);

  useEffect(() => {
    const handleOnline = () => {
      void flushQueue().catch(() => undefined);
    };
    window.addEventListener('online', handleOnline);
    void countQueuedChatMessages().then(setQueuedCount).catch(() => undefined);
    return () => window.removeEventListener('online', handleOnline);
  }, [flushQueue]);

  // Scroll to bottom when messages update
  useEffect(() => {
    scrollToBottom();
  }, [messages, scrollToBottom]);

  const handleSend = async (e: FormEvent) => {
    e.preventDefault();
    if (!projectId || !input.trim()) return;

    setSending(true);
    setSendError('');
    try {
      const content = input.trim();
      if (!navigator.onLine) {
        await queueChatMessage(projectId, content);
        setQueuedCount(await countQueuedChatMessages());
      } else {
        await api.sendProjectChatMessage(projectId, {
          content,
          attachmentUrl: null,
        });
      }
      setInput('');
      // Immediately poll for new messages
      await loadMessages();
    } catch (err) {
      if (!navigator.onLine && !(err instanceof ApiClientError)) {
        try {
          await queueChatMessage(projectId, input.trim());
          setQueuedCount(await countQueuedChatMessages());
          setInput('');
          setSendError('Message saved on this device and will send when you are back online.');
          return;
        } catch {
          // Fall through to the normal error state if local storage is unavailable.
        }
      }
      setSendError(
        err instanceof ApiClientError ? err.message : 'Failed to send message.'
      );
    } finally {
      setSending(false);
    }
  };

  const toggleVoiceInput = () => {
    const SpeechRecognition = (window as unknown as { SpeechRecognition?: new () => SpeechRecognitionLike; webkitSpeechRecognition?: new () => SpeechRecognitionLike }).SpeechRecognition
      ?? (window as unknown as { webkitSpeechRecognition?: new () => SpeechRecognitionLike }).webkitSpeechRecognition;
    if (!SpeechRecognition) {
      setSendError('Voice input is not supported by this browser.');
      return;
    }
    if (listening) {
      recognitionRef.current?.stop();
      return;
    }
    const recognition = new SpeechRecognition();
    recognition.lang = 'en-US';
    recognition.interimResults = false;
    recognition.maxAlternatives = 1;
    recognition.onresult = (event) => {
      const transcript = event.results[0]?.[0]?.transcript ?? '';
      const command = parseVoiceCommand(transcript, id);
      if (command?.type === 'navigate') {
        setVoiceStatus(command.label);
        navigate(command.path);
        return;
      }
      if (command?.type === 'back') {
        setVoiceStatus(command.label);
        navigate(-1);
        return;
      }
      setVoiceStatus('Voice dictation added to the message.');
      setInput((current) => `${current}${current ? ' ' : ''}${transcript}`.trim());
    };
    recognition.onend = () => setListening(false);
    recognitionRef.current = recognition;
    setListening(true);
    recognition.start();
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

  if (!projectId) {
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
          type="button"
          className="btn btn-secondary"
          onClick={toggleVoiceInput}
          aria-label={listening ? 'Stop voice input' : 'Start voice input'}
          title={listening ? 'Stop voice input' : 'Voice input'}
        >
          {listening ? 'Stop' : 'Mic'}
        </button>
        <button
          type="submit"
          className="btn btn-primary"
          disabled={sending || !input.trim()}
        >
          {sending ? '...' : 'Send'}
        </button>
      </form>

      {voiceStatus && (
        <div className="voice-status" role="status" aria-live="polite">
          {voiceStatus}
        </div>
      )}

      {queuedCount > 0 && (
        <div className="offline-banner" role="status">
          {queuedCount} message{queuedCount === 1 ? '' : 's'} saved on this device and waiting to send.
        </div>
      )}

      {sendError && (
        <div className="error-banner" role="alert" style={{ marginTop: 8 }}>
          {sendError}
        </div>
      )}
    </div>
  );
}
