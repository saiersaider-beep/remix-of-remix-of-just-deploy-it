import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { supabaseAdmin } from "@/integrations/supabase/client.server";

/**
 * Transcribe a voice message via Lovable AI Gateway (Gemini multimodal).
 * Caches the result in messages.transcript so it's computed once.
 */
export const transcribeVoiceMessage = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: { messageId: string }) =>
    z.object({ messageId: z.string().uuid() }).parse(d),
  )
  .handler(async ({ data, context }) => {
    const { userId } = context;

    const { data: msg, error: msgErr } = await supabaseAdmin
      .from("messages")
      .select("id, conversation_id, audio_url, transcript")
      .eq("id", data.messageId)
      .maybeSingle();
    if (msgErr) throw msgErr;
    if (!msg) throw new Error("Message introuvable.");
    if (!msg.audio_url) throw new Error("Ce message n'a pas d'audio.");

    // Verify the caller is a participant of this conversation.
    const { data: conv, error: convErr } = await supabaseAdmin
      .from("conversations")
      .select("user1_id, user2_id")
      .eq("id", msg.conversation_id)
      .maybeSingle();
    if (convErr) throw convErr;
    if (!conv || (conv.user1_id !== userId && conv.user2_id !== userId)) {
      throw new Error("Accès refusé.");
    }

    if (msg.transcript && msg.transcript.trim().length > 0) {
      return { transcript: msg.transcript };
    }

    // Download audio from the chat-media bucket.
    const path = msg.audio_url;
    const { data: blob, error: dlErr } = await supabaseAdmin.storage
      .from("chat-media")
      .download(path);
    if (dlErr || !blob) throw dlErr ?? new Error("Audio introuvable.");

    const arrayBuf = await blob.arrayBuffer();
    const base64 = Buffer.from(arrayBuf).toString("base64");
    const mime = blob.type || "audio/webm";
    // OpenAI input_audio format expects "wav" | "mp3" | "webm" | "mp4" ...
    const format = mime.includes("mp4")
      ? "mp4"
      : mime.includes("mpeg") || mime.includes("mp3")
      ? "mp3"
      : mime.includes("wav")
      ? "wav"
      : "webm";

    const apiKey = process.env.OPENAI_API_KEY;
    if (!apiKey) throw new Error("OPENAI_API_KEY manquante (configure-la dans Vercel → Settings → Environment Variables).");

    const resp = await fetch("https://api.openai.com/v1/chat/completions", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        model: "gpt-4o-mini-audio-preview",
        modalities: ["text"],
        messages: [
          {
            role: "system",
            content:
              "Tu es un transcripteur audio. Retourne UNIQUEMENT le texte parlé, sans commentaire, sans guillemets, sans ponctuation ajoutée superflue. Conserve la langue d'origine.",
          },
          {
            role: "user",
            content: [
              { type: "text", text: "Transcris ce message vocal." },
              {
                type: "input_audio",
                input_audio: { data: base64, format },
              },
            ],
          },
        ],
      }),
    });

    if (!resp.ok) {
      const txt = await resp.text().catch(() => "");
      if (resp.status === 429) throw new Error("Trop de requêtes, réessaie plus tard.");
      if (resp.status === 402) throw new Error("Crédits IA épuisés.");
      throw new Error(`Transcription échouée (${resp.status}): ${txt.slice(0, 200)}`);
    }
    const json = (await resp.json()) as {
      choices?: Array<{ message?: { content?: string } }>;
    };
    const transcript = json.choices?.[0]?.message?.content?.trim() ?? "";
    if (!transcript) throw new Error("Transcription vide.");

    await supabaseAdmin
      .from("messages")
      .update({ transcript })
      .eq("id", msg.id);

    return { transcript };
  });