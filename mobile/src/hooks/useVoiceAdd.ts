import { useCallback, useEffect, useRef, useState } from 'react';
import { Alert } from 'react-native';
import { ExpoSpeechRecognitionModule, useSpeechRecognitionEvent } from 'expo-speech-recognition';
import { useTasks } from '../context/TaskContext';
import { today } from '../utils';
import { commitVoiceTranscript, undoVoiceTask } from './voiceAddCommit';

const UNDO_WINDOW_MS = 5000;

export function useVoiceAdd() {
  const { tasks, save } = useTasks();
  const [isListening, setIsListening] = useState(false);
  const [addedTask, setAddedTask] = useState<{ raw: string; text: string } | null>(null);

  // Refs so the 'end' event handler (registered once) always sees the
  // latest tasks/save without needing to be re-subscribed on every render —
  // same stale-closure guard pattern as usePendingDone's tasksRef.
  const tasksRef = useRef(tasks);
  useEffect(() => { tasksRef.current = tasks; }, [tasks]);
  const saveRef = useRef(save);
  useEffect(() => { saveRef.current = save; }, [save]);

  const transcriptRef = useRef('');
  // True only between a successful start() and the 'end' event that closes
  // that same session — guards against an 'end' event firing for a session
  // that never started (e.g. permission denied) from committing stale text.
  const sessionActiveRef = useRef(false);
  const undoTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const clearUndoTimer = useCallback(() => {
    if (undoTimer.current) {
      clearTimeout(undoTimer.current);
      undoTimer.current = null;
    }
  }, []);
  useEffect(() => clearUndoTimer, [clearUndoTimer]);

  useSpeechRecognitionEvent('result', event => {
    transcriptRef.current = event.results[0]?.transcript ?? transcriptRef.current;
  });

  useSpeechRecognitionEvent('error', () => {
    sessionActiveRef.current = false;
    setIsListening(false);
  });

  // The final transcript isn't necessarily ready the instant stop() is
  // called — recognition finalizes asynchronously on the native side. The
  // 'end' event is the actual signal that the session (and its transcript)
  // is complete, so the commit happens here, not in stop().
  useSpeechRecognitionEvent('end', () => {
    if (!sessionActiveRef.current) return;
    sessionActiveRef.current = false;
    setIsListening(false);
    const transcript = transcriptRef.current;
    void (async () => {
      const created = await commitVoiceTranscript(tasksRef.current, transcript, today(), saveRef.current);
      if (created) {
        setAddedTask({ raw: created.raw, text: created.text });
        clearUndoTimer();
        undoTimer.current = setTimeout(() => setAddedTask(null), UNDO_WINDOW_MS);
      }
    })();
  });

  const start = useCallback(async () => {
    clearUndoTimer();
    setAddedTask(null);
    transcriptRef.current = '';

    const perm = await ExpoSpeechRecognitionModule.requestPermissionsAsync();
    if (!perm.granted) {
      Alert.alert('Error', 'Enable microphone and speech recognition access in Settings to add tasks by voice.');
      return;
    }

    sessionActiveRef.current = true;
    setIsListening(true);
    ExpoSpeechRecognitionModule.start({
      lang: 'en-US',
      interimResults: true,
      requiresOnDeviceRecognition: true,
    });
  }, [clearUndoTimer]);

  const stop = useCallback(() => {
    ExpoSpeechRecognitionModule.stop();
  }, []);

  const undo = useCallback(async () => {
    if (!addedTask) return;
    clearUndoTimer();
    const raw = addedTask.raw;
    setAddedTask(null);
    await undoVoiceTask(tasksRef.current, raw, saveRef.current);
  }, [addedTask, clearUndoTimer]);

  return { isListening, addedTask, start, stop, undo };
}
