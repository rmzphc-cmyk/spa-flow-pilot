import { authenticate, authorizeReportAccess, corsHeaders, internalError, json } from "../_shared/auth.ts";

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  try {
    const auth = await authenticate(req);
    if (!auth.ok) return auth.response;
    const { caller, admin } = auth;

    const openaiKey = Deno.env.get("OPENAI_API_KEY");
    if (!openaiKey) return json({ error: "OPENAI_API_KEY manquant — transcription impossible." }, 500);

    const { report_id } = (await req.json()) as { report_id?: string };
    if (!report_id) return json({ error: "Missing report_id" }, 400);

    const access = await authorizeReportAccess(admin, caller, report_id);
    if (!access.ok) return access.response;
    const report = access.report;

    if (!report.audio_storage_path) {
      return json({ error: "Aucun enregistrement audio disponible pour ce rapport." }, 404);
    }

    await admin.from("meeting_summaries").upsert(
      { report_id, transcript_status: "pending", updated_at: new Date().toISOString() },
      { onConflict: "report_id" },
    );

    const { data: fileData, error: dlErr } = await admin.storage
      .from("meeting-recordings").download(report.audio_storage_path);

    if (dlErr || !fileData) {
      await admin.from("meeting_summaries")
        .update({ transcript_status: "error", updated_at: new Date().toISOString() })
        .eq("report_id", report_id);
      return json({ error: "Impossible de télécharger le fichier audio depuis le stockage." }, 500);
    }

    if (fileData.size > 25 * 1024 * 1024) {
      await admin.from("meeting_summaries")
        .update({ transcript_status: "error", updated_at: new Date().toISOString() })
        .eq("report_id", report_id);
      return json({ error: "Le fichier audio dépasse la limite de 25 Mo pour la transcription Whisper." }, 413);
    }

    const mimeType = report.audio_mime_type ?? "audio/webm";
    const ext = mimeType.includes("mp4") || mimeType.includes("m4a") ? "m4a"
      : mimeType.includes("mpeg") || mimeType.includes("mp3") || mimeType.includes("mpga") ? "mp3"
      : mimeType.includes("wav") ? "wav"
      : mimeType.includes("ogg") ? "ogg"
      : "webm";

    const formData = new FormData();
    formData.append("file", fileData, `recording.${ext}`);
    formData.append("model", "whisper-1");
    formData.append("language", "fr");
    formData.append("response_format", "verbose_json");

    const whisperResp = await fetch("https://api.openai.com/v1/audio/transcriptions", {
      method: "POST",
      headers: { Authorization: `Bearer ${openaiKey}` },
      body: formData,
    });

    if (!whisperResp.ok) {
      console.error("Whisper API error:", whisperResp.status, await whisperResp.text());
      await admin.from("meeting_summaries")
        .update({ transcript_status: "error", updated_at: new Date().toISOString() })
        .eq("report_id", report_id);
      return json({ error: `Erreur Whisper (${whisperResp.status}) — vérifiez le format du fichier.` }, 500);
    }

    const whisperResult = await whisperResp.json();
    const transcriptText = whisperResult.text ?? "";
    const transcriptDuration = whisperResult.duration ?? report.audio_duration_s ?? null;

    const { error: upErr } = await admin.from("meeting_summaries").upsert(
      {
        report_id,
        transcript_text: transcriptText,
        transcript_status: "done",
        transcript_generated_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      },
      { onConflict: "report_id" },
    );
    if (upErr) throw upErr;

    return json({ data: { transcript_text: transcriptText, duration: transcriptDuration } }, 200);
  } catch (e) {
    return internalError(e);
  }
});
