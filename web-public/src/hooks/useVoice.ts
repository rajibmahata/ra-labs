import { useCallback, useEffect, useRef, useState } from 'react';
import type { SpeechRecognitionEventLike, SpeechRecognitionErrorLike } from '../speech';

type VoiceStatus = 'idle' | 'listening' | 'transcribing' | 'speaking' | 'denied' | 'unsupported' | 'error';

interface UseVoiceOptions {
  enabled: boolean;
  voiceResponse: boolean;
  maxDurationSeconds?: number;
  onTranscript?: (text: string) => void;
  onInterimTranscript?: (text: string) => void;
}

interface UseVoiceReturn {
  status: VoiceStatus;
  supported: boolean;
  errorMessage: string | null;
  listen: () => void;
  stop: () => void;
  cancel: () => void;
  speak: (text: string) => void;
  stopSpeaking: () => void;
  isSpeaking: boolean;
}

export function useVoice(options: UseVoiceOptions): UseVoiceReturn {
  const [status, setStatus] = useState<VoiceStatus>('idle');
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const recognitionRef = useRef<{ abort: () => void; stop: () => void } | null>(null);
  const timerRef = useRef<number | null>(null);
  const speakingRef = useRef(false);
  const intentRef = useRef<'stop' | 'cancel' | null>(null);
  const lastFinalRef = useRef<string>('');

  const supported =
    typeof window !== 'undefined' &&
    !!((window as any).SpeechRecognition || (window as any).webkitSpeechRecognition);

  const clearTimer = useCallback(() => {
    if (timerRef.current !== null) {
      window.clearTimeout(timerRef.current);
      timerRef.current = null;
    }
  }, []);

  const teardownRecognition = useCallback(() => {
    clearTimer();
    recognitionRef.current = null;
  }, [clearTimer]);

  const stopSpeaking = useCallback(() => {
    if (speakingRef.current && 'speechSynthesis' in window) {
      window.speechSynthesis.cancel();
    }
    speakingRef.current = false;
    setStatus((current) => (current === 'speaking' ? 'idle' : current));
  }, []);

  const stop = useCallback(() => {
    intentRef.current = 'stop';
    teardownRecognition();
    const recognition = recognitionRef.current;
    if (recognition) {
      recognition.stop();
    } else {
      setStatus('idle');
    }
  }, [teardownRecognition]);

  const cancel = useCallback(() => {
    intentRef.current = 'cancel';
    teardownRecognition();
    const recognition = recognitionRef.current;
    if (recognition) {
      recognition.abort();
    } else {
      setStatus('idle');
    }
  }, [teardownRecognition]);

  useEffect(() => {
    return () => {
      if (timerRef.current !== null) window.clearTimeout(timerRef.current);
      if (speakingRef.current && 'speechSynthesis' in window) {
        window.speechSynthesis.cancel();
      }
    };
  }, []);

  const speak = useCallback(
    (text: string) => {
      if (!options.enabled || !options.voiceResponse) return;
      if (!('speechSynthesis' in window)) {
        setErrorMessage('Voice response is not supported in this browser.');
        return;
      }
      window.speechSynthesis.cancel();
      const utterance = new SpeechSynthesisUtterance(text.replace(/[•·\n]/g, '. '));
      utterance.rate = 1;
      utterance.onstart = () => {
        speakingRef.current = true;
        setStatus('speaking');
      };
      utterance.onend = () => {
        speakingRef.current = false;
        setStatus('idle');
      };
      utterance.onerror = () => {
        speakingRef.current = false;
        setStatus('idle');
      };
      window.speechSynthesis.speak(utterance);
    },
    [options.enabled, options.voiceResponse],
  );

  const listen = useCallback(() => {
    setErrorMessage(null);
    if (!options.enabled) {
      setStatus('idle');
      return;
    }
    if (!supported) {
      setStatus('unsupported');
      setErrorMessage('Voice input is not supported in this browser. You can still type.');
      return;
    }

    const Recognition =
      (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
    if (!Recognition) {
      setStatus('unsupported');
      return;
    }

    if (status === 'speaking') stopSpeaking();

    const recognition = new Recognition();
    recognition.continuous = true;
    recognition.interimResults = true;
    recognition.lang = document.documentElement.lang || 'en-US';

    lastFinalRef.current = '';

    recognition.onresult = (event: SpeechRecognitionEventLike) => {
      let interim = '';
      let final = '';

      for (let i = event.resultIndex; i < (event.results as any).length; i++) {
        const result = event.results[i];
        if (result.isFinal) {
          final += result[0]?.transcript ?? '';
        } else {
          interim += result[0]?.transcript ?? '';
        }
      }

      if (final) {
        lastFinalRef.current = final.trim();
      }

      if (interim) {
        options.onInterimTranscript?.(interim);
      }
    };

    recognition.onerror = (event: SpeechRecognitionErrorLike) => {
      recognitionRef.current = null;
      clearTimer();
      if (event.error === 'not-allowed' || event.error === 'service-not-allowed') {
        setStatus('denied');
        setErrorMessage('Microphone permission was denied. Enable it in your browser and try again.');
      } else if (event.error === 'no-speech') {
        setStatus('idle');
        setErrorMessage('No speech was detected. Please try again.');
      } else if (event.error === 'aborted') {
        setStatus('idle');
      } else {
        setStatus('error');
        setErrorMessage('Voice input was not available. You can still type your message.');
      }
    };

    recognition.onend = () => {
      recognitionRef.current = null;
      clearTimer();

      const intent = intentRef.current;
      intentRef.current = null;

      if (intent === 'cancel') {
        setStatus('idle');
        return;
      }

      const transcript = lastFinalRef.current;
      if (transcript) {
        setStatus('transcribing');
        options.onTranscript?.(transcript);
        setTimeout(() => {
          setStatus((current) => (current === 'transcribing' ? 'idle' : current));
        }, 300);
      } else {
        setStatus('idle');
      }
    };

    const maxSeconds = options.maxDurationSeconds ?? 60;
    recognitionRef.current = recognition;
    timerRef.current = window.setTimeout(() => {
      intentRef.current = 'stop';
      recognition.stop();
    }, maxSeconds * 1000);

    setStatus('listening');
    try {
      recognition.start();
    } catch {
      recognitionRef.current = null;
      setStatus('error');
      setErrorMessage('Voice input could not be started. You can still type your message.');
    }
  }, [supported, status, stopSpeaking, options.enabled, options.maxDurationSeconds, options.onTranscript, options.onInterimTranscript, clearTimer]);

  return {
    status,
    supported,
    errorMessage,
    listen,
    stop,
    cancel,
    speak,
    stopSpeaking,
    isSpeaking: status === 'speaking',
  };
}

export function isListening(status: VoiceStatus): boolean {
  return status === 'listening' || status === 'transcribing';
}
