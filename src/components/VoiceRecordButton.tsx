import { useEffect, useRef, useState } from "react";
import { Mic, Pause, Play, Square, Sparkles, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Tooltip, TooltipTrigger, TooltipContent } from "@/components/ui/tooltip";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { useStructureVoiceNote } from "@/hooks/useStructureVoiceNote";
import { toast } from "@/hooks/use-toast";

type RecState = "idle" | "recording" | "paused" | "processing";

interface Props {
  onTranscript: (text: string) => void;
  disabled?: boolean;
  lang?: string;
  context?: "check_in" | "free_note" | "responsibility_comment";
}

export function VoiceRecordButton({
  onTranscript,
  disabled,
  lang = "fr-FR",
  context = "free_note",
}: Props) {
  const [supported, setSupported] = useState(true);
  const [open, setOpen] = useState(false);
  const [state, setState] = useState<RecState>("idle");
  const [accumulated, setAccumulated] = useState("");
  const [interim, setInterim] = useState("");

  const recognitionRef = useRef<any>(null);
  const stateRef = useRef<RecState>("idle");
  const accumulatedRef = useRef("");
  const interimRef = useRef("");

  const structureMutation = useStructureVoiceNote();

  useEffect(() => {
    const SR: any =
      (typeof window !== "undefined" &&
        ((window as any).SpeechRecognition || (window as any).webkitSpeechRecognition)) ||
      null;
    if (!SR) setSupported(false);
  }, []);

  useEffect(() => {
    stateRef.current = state;
  }, [state]);
  useEffect(() => {
    accumulatedRef.current = accumulated;
  }, [accumulated]);
  useEffect(() => {
    interimRef.current = interim;
  }, [interim]);

  const startRecording = () => {
    const SR: any =
      (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
    if (!SR) return;
    try {
      const rec = new SR();
      rec.continuous = true;
      rec.interimResults = true;
      rec.lang = lang;
      rec.onresult = (event: any) => {
        let finalText = "";
        let interimText = "";
        for (let i = 0; i < event.results.length; i++) {
          const result = event.results[i];
          if (result.isFinal) finalText += result[0].transcript + " ";
          else interimText += result[0].transcript;
        }
        if (finalText) setAccumulated((prev) => prev + finalText);
        setInterim(interimText);
      };
      rec.onend = () => {
        if (stateRef.current === "recording") {
          try {
            rec.start();
          } catch {
            /* noop */
          }
        }
      };
      rec.onerror = (e: any) => {
        if (e?.error === "no-speech") return;
        toast({ title: "Microphone non accessible", variant: "destructive" });
        setState("idle");
      };
      recognitionRef.current = rec;
      rec.start();
      setState("recording");
    } catch {
      toast({ title: "Microphone non accessible", variant: "destructive" });
      setState("idle");
    }
  };

  const pauseRecording = () => {
    setState("paused");
    try {
      recognitionRef.current?.stop();
    } catch {
      /* noop */
    }
  };

  const resumeRecording = () => {
    startRecording();
  };

  const resetState = () => {
    try {
      recognitionRef.current?.stop();
    } catch {
      /* noop */
    }
    recognitionRef.current = null;
    setState("idle");
    setAccumulated("");
    setInterim("");
  };

  const closeDialog = () => {
    resetState();
    setOpen(false);
  };

  const finishRecording = () => {
    setState("processing");
    try {
      recognitionRef.current?.stop();
    } catch {
      /* noop */
    }
    const fullText = (accumulatedRef.current + " " + interimRef.current).trim();
    if (!fullText) {
      closeDialog();
      return;
    }
    structureMutation.mutate(
      { text: fullText, context },
      {
        onSuccess: (structured) => {
          onTranscript(structured ?? fullText);
          closeDialog();
        },
        onError: () => {
          onTranscript(fullText);
          closeDialog();
        },
      },
    );
  };

  const handleOpenChange = (next: boolean) => {
    if (!next) closeDialog();
    else setOpen(true);
  };

  if (!supported) {
    return (
      <Tooltip>
        <TooltipTrigger asChild>
          <span>
            <Button variant="outline" size="sm" className="gap-1.5 text-xs" disabled>
              <Mic className="h-3.5 w-3.5" />
              Dicter
            </Button>
          </span>
        </TooltipTrigger>
        <TooltipContent>Non supporté sur ce navigateur</TooltipContent>
      </Tooltip>
    );
  }

  const statusText =
    state === "recording"
      ? { text: "En écoute…", className: "text-primary" }
      : state === "paused"
        ? { text: "En pause", className: "text-muted-foreground" }
        : state === "processing"
          ? { text: "Structuration en cours…", className: "text-violet-600" }
          : { text: "Appuyez sur le micro pour commencer", className: "text-muted-foreground" };

  const hasTranscript = accumulated.trim() || interim.trim();

  return (
    <>
      <Button
        type="button"
        variant="outline"
        size="sm"
        className="gap-1.5 text-xs"
        onClick={() => setOpen(true)}
        disabled={disabled}
      >
        <Mic className="h-3.5 w-3.5" />
        Dicter
      </Button>

      <Dialog open={open} onOpenChange={handleOpenChange}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Dictée vocale</DialogTitle>
          </DialogHeader>

          <div className="space-y-4 py-2">
            {/* Waveform */}
            {(state === "recording" || state === "paused") && (
              <div className="flex items-end justify-center gap-1 h-10">
                {[0, 0.1, 0.2, 0.1, 0].map((delay, i) => (
                  <div
                    key={i}
                    className="w-1.5 rounded-full bg-primary"
                    style={{
                      height: state === "paused" ? "16px" : "8px",
                      animation:
                        state === "recording"
                          ? `voice-wave 0.8s ease-in-out infinite ${delay}s`
                          : undefined,
                    }}
                  />
                ))}
              </div>
            )}

            {/* Status text */}
            <p className={`text-sm text-center ${statusText.className}`}>
              {statusText.text}
            </p>

            {/* Transcript */}
            {hasTranscript && (
              <div className="rounded-lg border border-border bg-muted/40 p-3 text-sm max-h-40 overflow-y-auto">
                <span className="text-foreground">{accumulated}</span>
                {interim && (
                  <span className="text-muted-foreground italic">{interim}</span>
                )}
              </div>
            )}

            {/* Actions */}
            <div className="flex flex-wrap gap-2 justify-center pt-1">
              {state === "idle" && (
                <Button onClick={startRecording} className="gap-1.5">
                  <Mic className="h-4 w-4" /> Commencer
                </Button>
              )}
              {state === "recording" && (
                <>
                  <Button variant="outline" onClick={pauseRecording} className="gap-1.5">
                    <Pause className="h-4 w-4" /> Pause
                  </Button>
                  <Button onClick={finishRecording} className="gap-1.5">
                    <Sparkles className="h-4 w-4" /> Fin et structurer
                  </Button>
                </>
              )}
              {state === "paused" && (
                <>
                  <Button variant="outline" onClick={resumeRecording} className="gap-1.5">
                    <Play className="h-4 w-4" /> Reprendre
                  </Button>
                  <Button onClick={finishRecording} className="gap-1.5">
                    <Sparkles className="h-4 w-4" /> Fin et structurer
                  </Button>
                </>
              )}
              {state === "processing" && (
                <Button disabled className="gap-1.5">
                  <Loader2 className="h-4 w-4 animate-spin" /> Structuration…
                </Button>
              )}
              {state !== "processing" && (
                <Button variant="ghost" onClick={closeDialog} className="gap-1.5">
                  <Square className="h-4 w-4" /> Annuler
                </Button>
              )}
            </div>
          </div>
        </DialogContent>
      </Dialog>

      <style>{`
        @keyframes voice-wave {
          0% { height: 8px; }
          50% { height: 32px; }
          100% { height: 8px; }
        }
      `}</style>
    </>
  );
}
