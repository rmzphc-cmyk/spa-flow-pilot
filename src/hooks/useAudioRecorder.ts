
import { useCallback, useEffect, useRef, useState } from "react";

export type RecorderStatus =
  | "idle"
  | "acquiring"
  | "recording"
  | "paused"
  | "stopped"
  | "error";

export interface UseAudioRecorderReturn {
  status: RecorderStatus;
  blob: Blob | null;
  durationSeconds: number;
  error: string | null;
  startRecording: () => Promise<void>;
  stopRecording: () => void;
  pauseRecording: () => void;
  resumeRecording: () => void;
}

function getSupportedMimeType(): string {
  const candidates = [
    "audio/webm;codecs=opus",
    "audio/mp4",
    "audio/webm;codecs=vorbis",
    "audio/ogg;codecs=opus",
    "audio/webm",
    "audio/ogg",
  ];
  for (const mime of candidates) {
    if (typeof MediaRecorder !== "undefined" && MediaRecorder.isTypeSupported(mime)) {
      return mime;
    }
  }
  return "audio/webm";
}

function handleGetUserMediaError(err: unknown): string {
  if (!(err instanceof DOMException) && !(err instanceof Error)) {
    return "Erreur inconnue lors de l'accès au micro.";
  }
  const name = (err as DOMException).name ?? "";
  if (name === "NotAllowedError" || name === "PermissionDeniedError") {
    return "Accès au micro refusé. Vérifiez les permissions du navigateur.";
  }
  if (name === "NotFoundError" || name === "DevicesNotFoundError") {
    return "Aucun micro trouvé sur cet appareil.";
  }
  if (name === "NotReadableError" || name === "TrackStartError") {
    return "Le micro est déjà utilisé par une autre application.";
  }
  return `Erreur micro : ${(err as Error).message || name}`;
}

export function useAudioRecorder(): UseAudioRecorderReturn {
  const [status, setStatus] = useState<RecorderStatus>("idle");
  const [blob, setBlob] = useState<Blob | null>(null);
  const [durationSeconds, setDurationSeconds] = useState(0);
  const [error, setError] = useState<string | null>(null);

  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<Blob[]>([]);
  const streamRef = useRef<MediaStream | null>(null);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const startTimer = useCallback(() => {
    timerRef.current = setInterval(() => {
      setDurationSeconds((s) => s + 1);
    }, 1000);
  }, []);

  const stopTimer = useCallback(() => {
    if (timerRef.current) {
      clearInterval(timerRef.current);
      timerRef.current = null;
    }
  }, []);

  const startRecording = useCallback(async () => {
    setStatus("acquiring");
    setError(null);
    setBlob(null);
    setDurationSeconds(0);
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      streamRef.current = stream;
      const mimeType = getSupportedMimeType();
      const mediaRecorder = new MediaRecorder(stream, { mimeType });
      chunksRef.current = [];
      mediaRecorder.ondataavailable = (e) => {
        if (e.data.size > 0) chunksRef.current.push(e.data);
      };
      mediaRecorder.onstop = () => {
        const finalBlob = new Blob(chunksRef.current, { type: mimeType });
        setBlob(finalBlob);
        setStatus("stopped");
        stopTimer();
      };
      mediaRecorder.onerror = () => {
        setError("Erreur lors de l'enregistrement.");
        setStatus("error");
        stopTimer();
      };
      mediaRecorderRef.current = mediaRecorder;
      mediaRecorder.start();
      setStatus("recording");
      startTimer();
    } catch (err) {
      setError(handleGetUserMediaError(err));
      setStatus("error");
    }
  }, [startTimer, stopTimer]);

  const stopRecording = useCallback(() => {
    if (mediaRecorderRef.current && mediaRecorderRef.current.state !== "inactive") {
      mediaRecorderRef.current.stop();
    }
    streamRef.current?.getTracks().forEach((t) => t.stop());
    stopTimer();
  }, [stopTimer]);

  const pauseRecording = useCallback(() => {
    if (mediaRecorderRef.current?.state === "recording") {
      mediaRecorderRef.current.pause();
      setStatus("paused");
      stopTimer();
    }
  }, [stopTimer]);

  const resumeRecording = useCallback(() => {
    if (mediaRecorderRef.current?.state === "paused") {
      mediaRecorderRef.current.resume();
      setStatus("recording");
      startTimer();
    }
  }, [startTimer]);

  useEffect(() => {
    return () => {
      streamRef.current?.getTracks().forEach((t) => t.stop());
      stopTimer();
    };
  }, [stopTimer]);

  return {
    status,
    blob,
    durationSeconds,
    error,
    startRecording,
    stopRecording,
    pauseRecording,
    resumeRecording,
  };
}
