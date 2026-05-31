import { useMutation } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "@/hooks/use-toast";

export interface UploadAudioInput {
  reportId: string;
  spaId: string;
  blob: Blob;
  mimeType: string;
  durationSeconds: number;
  filename: string;
}

export interface UploadAudioResult {
  storagePath: string;
  mimeType: string;
  durationSeconds: number;
}

export function useUploadMeetingAudio() {
  return useMutation({
    mutationFn: async (input: UploadAudioInput): Promise<UploadAudioResult> => {
      const { reportId, spaId, blob, mimeType, durationSeconds, filename } = input;
      const path = `${spaId}/${reportId}/${filename}`;
      const { error } = await supabase.storage
        .from("meeting-recordings")
        .upload(path, blob, { contentType: mimeType, upsert: true });
      if (error) throw new Error(error.message);
      return { storagePath: path, mimeType, durationSeconds };
    },
    onSuccess: () => {
      toast({ title: "Enregistrement sauvegardé ✓" });
    },
    onError: (e: Error) => {
      toast({ title: "Erreur upload audio", description: e.message, variant: "destructive" });
    },
  });
}
