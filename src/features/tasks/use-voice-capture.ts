import { useCallback, useEffect, useRef, useState } from 'react';
import {
  ExpoSpeechRecognitionModule,
  useSpeechRecognitionEvent,
} from 'expo-speech-recognition';

export function useVoiceCapture(onFinalResult: (text: string) => void) {
  const [listening, setListening] = useState(false);
  const callbackRef = useRef(onFinalResult);
  callbackRef.current = onFinalResult;

  useSpeechRecognitionEvent('result', (event) => {
    if (event.isFinal && event.results[0]?.transcript) {
      callbackRef.current(event.results[0].transcript);
    }
  });
  useSpeechRecognitionEvent('end', () => setListening(false));
  useSpeechRecognitionEvent('error', () => setListening(false));

  const start = useCallback(async () => {
    const permission = await ExpoSpeechRecognitionModule.requestPermissionsAsync();
    if (!permission.granted) return;
    setListening(true);
    ExpoSpeechRecognitionModule.start({ lang: 'en-US', interimResults: false, continuous: false });
  }, []);

  const stop = useCallback(() => {
    ExpoSpeechRecognitionModule.stop();
  }, []);

  useEffect(() => stop, [stop]);

  return { listening, start, stop };
}
