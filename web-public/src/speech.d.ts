export interface SpeechRecognitionResultLike {
  isFinal: boolean;
  0: { transcript: string };
}

export interface SpeechRecognitionEventLike extends Event {
  resultIndex: number;
  results: { [index: number]: SpeechRecognitionResultLike };
}

export interface SpeechRecognitionErrorLike extends Event {
  error: string;
}

export interface SpeechRecognitionLike {
  continuous: boolean;
  interimResults: boolean;
  lang: string;
  onresult: ((event: SpeechRecognitionEventLike) => void) | null;
  onerror: ((event: SpeechRecognitionErrorLike) => void) | null;
  onend: (() => void) | null;
  start: () => void;
  stop: () => void;
  abort: () => void;
}

export type SpeechRecognitionConstructor = new () => SpeechRecognitionLike;

declare global {
  interface Window {
    SpeechRecognition?: SpeechRecognitionConstructor;
    webkitSpeechRecognition?: SpeechRecognitionConstructor;
  }
}
