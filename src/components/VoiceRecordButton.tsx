import { useEffect, useRef, useState } from "react";
import { Mic, MicOff } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Tooltip, TooltipTrigger, TooltipContent } from "@/components/ui/tooltip";
import { toast } from "@/hooks/use-toast";

interface Props {
  onTranscript: (text: string) => void;
  disabled?: boolean;
  lang?: string;
}

export function VoiceRecordButton({ onTranscript, disabled, lang = "fr-FR" }: Props) {
  const [supported, setSupported] = useState(true);
  const [listening, setListening] = useState(false);
  const recognitionRef = useRef<any>(null);

  useEffect(() => {
    const SR: any =
      (typeof window !== "undefined" && ((window as any).SpeechRecognition || (window as any).webkitSpeechRecognition)) || null;
    if (!SR) {
      setSupported(false);
      return;
    }
  }, []);

  const start = () => {
    const SR: any =
      (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
    if (!SR) return;
    try {
      const rec = new SR();
      rec.continuous = false;
      rec.interimResults = false;
      rec.lang = lang;
      rec.onresult = (event: any) => {
        const transcript = Array.from(event.results)
          .map((r: any) => r[0]?.transcript ?? "")
          .join(" ")
          .trim();
        if (transcript) onTranscript(transcript);
      };
      rec.onerror = () => {
        toast({ title: "Microphone non accessible", variant: "destructive" });
        setListening(false);
      };
      rec.onend = () => setListening(false);
      recognitionRef.current = rec;
      rec.start();
      setListening(true);
    } catch {
      toast({ title: "Microphone non accessible", variant: "destructive" });
      setListening(false);
    }
  };

  const stop = () => {
    try {
      recognitionRef.current?.stop();
    } catch {
      /* noop */
    }
    setListening(false);
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

  if (listening) {
    return (
      <Button
        type="button"
        variant="outline"
        size="sm"
        className="gap-1.5 text-xs border-red-400 text-red-600 animate-pulse"
        onClick={stop}
        disabled={disabled}
      >
        <MicOff className="h-3.5 w-3.5" />
        En écoute…
      </Button>
    );
  }

  return (
    <Button
      type="button"
      variant="outline"
      size="sm"
      className="gap-1.5 text-xs"
      onClick={start}
      disabled={disabled}
    >
      <Mic className="h-3.5 w-3.5" />
      Dicter
    </Button>
  );
}
