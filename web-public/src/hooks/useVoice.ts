import { useCallback, useEffect, useRef, useState } from 'react';
import type { SpeechRecognitionEventLike, SpeechRecognitionErrorLike } from '../speech';

type VoiceStatus = 'idle' | 'listening' | 'speaking' | 'denied' | 'unsupported' | 'error';

/**
 * Voice input (Web Speech recognition) + voice response (speechSynthesis)
 * with a state machine, permission handling and interrupt support.
 * Never records/speaks anything itself — the caller decides when to start.
 */
export function useVoice(options: {
  enabled: boolean;
  voiceResponse: boolean;
  maxDurationSeconds?: number;
  onTranscript?: (text: string) => void;
}) {
  const [status, setStatus] = useState<VoiceStatus>('idle');
  const [error, setError] = useState<string | null>(null);
  const recognitionRef = useRef<{ stop: () => void } | null>(null);
  const timerRef = useRef<number | null>(null);
  const speakingRef = useRef(false);

  const supported = typeof window !== 'undefined'
    && !!(window.SpeechRecognition || window.webkitSpeechRecognition);

  const stopSpeaking = useCallback(() => {
    if (speakingRef.current && 'speechSynthesis' in window) {
      window.speechSynthesis.cancel();
    }
    speakingRef.current = false;
    setStatus((current) => (current === 'speaking' ? 'idle' : current));
  }, []);

  const stop = useCallback(() => {
    if (timerRef.current !== null) {
      window.clearTimeout(timerRef.current);
      timerRef.current = null;
    }
    recognitionRef.current?.stop();
    recognitionRef.current = null;
    stopSpeaking();
    setStatus('idle');
  }, [stopSpeaking]);

  useEffect(() => stop, [stop]);

  const speak = useCallback((text: string) => {
    if (!options.enabled || !options.voiceResponse) return;
    if (!('speechSynthesis' in window)) {
      setError('Voice response is not supported in this browser.');
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
  }, [options.enabled, options.voiceResponse]);

  const listen = useCallback(() => {
    setError(null);
    if (!options.enabled) {
      setStatus('idle');
      return;
    }
    if (!supported) {
      setStatus('unsupported');
      setError('Voice input is not supported in this browser. You can still type.');
      return;
    }

    const Recognition = window.SpeechRecognition || window.webkitSpeechRecognition;
    if (!Recognition) {
      setStatus('unsupported');
      return;
    }
    const recognition = new Recognition();
    recognition.continuous = false;
    recognition.interimResults = false;
    recognition.lang = document.documentElement.lang || 'en-US';

    if (status === 'speaking') stopSpeaking();

    recognition.onresult = (event: SpeechRecognitionEventLike) => {
      const transcript = event.results[event.resultIndex]?.[0]?.transcript?.trim();
      if (transcript) options.onTranscript?.(transcript);
    };
    recognition.onerror = (event: SpeechRecognitionErrorLike) => {
      recognitionRef.current = null;
      if (event.error === 'not-allowed' || event.error === 'service-not-allowed') {
        setStatus('denied');
        setError('Microphone permission was denied. Enable it in your browser and try again.');
      } else if (event.error === 'no-speech') {
        setStatus('idle');
        setError('No speech was detected. Please try again.');
      } else {
        setStatus('error');
        setError('Voice input was not available. You can still type your message.');
      }
    };
    recognition.onend = () => {
      recognitionRef.current = null;
      if (timerRef.current !== null) {
        window.clearTimeout(timerRef.current);
        timerRef.current = null;
      }
      setStatus((current) => (current === 'denied' ? current : 'idle'));
    };

    const maxSeconds = options.maxDurationSeconds ?? 60;
    timerRef.current = window.setTimeout(() => recognition.stop(), maxSeconds * 1000);

    recognitionRef.current = recognition;
    setStatus('listening');
    try {
      recognition.start();
    } catch {
      recognitionRef.current = null;
      setStatus('error');
      setError('Voice input could not be started. You can still type your message.');
    }
  }, [supported, status, stopSpeaking, options.enabled, options.maxDurationSeconds, options.onTranscript]);

  return {
    status,
    error,
    supported,
    listen,
    stop,
    speak,
    stopSpeaking,
    setError,
  };
}

export function isListening(status: VoiceStatus): boolean {
  return status === 'listening';
}
