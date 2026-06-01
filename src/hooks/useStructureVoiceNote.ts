import { useMutation } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

export function useStructureVoiceNote() {
  return useMutation({
    mutationFn: async (input: { text: string; context: "check_in" | "free_note" | "responsibility_comment" }) => {
      const { data, error } = await supabase.functions.invoke("structure-voice-note", {
        body: input,
      });
      if (error) throw error;
      if (data?.error) throw new Error(data.error);
      return data.structured_text as string;
    },
  });
}
