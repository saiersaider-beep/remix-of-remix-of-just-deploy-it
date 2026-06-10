import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useMemo, useRef, useState } from "react";
import { MessageSquare, Send, ArrowLeft, Check, CheckCheck, ImagePlus, X, Mic, Trash2, Play, Pause, Square, FileText, Loader2, EyeOff } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/use-auth";
import { SiteHeader } from "@/components/SiteHeader";
import { z } from "zod";
import type { RealtimeChannel } from "@supabase/supabase-js";
import { playSendSound } from "@/lib/sounds";
import { uploadChatImage, uploadChatAudio, getChatMediaSignedUrl } from "@/lib/chat-media";
import { transcribeVoiceMessage } from "@/lib/transcribe.functions";


export const Route = createFileRoute("/messages")({
  validateSearch: (s: Record<string, unknown>) => ({
    c: typeof s.c === "string" ? s.c : undefined,
  }),
  head: () => ({
    meta: [
      { title: "Messages — VinaSound" },
      { name: "description", content: "Discute en privé avec les artistes et fans sur VinaSound." },
      { name: "robots", content: "noindex" },
    ],
  }),
  component: MessagesPage,
});

type Profile = { id: string; display_name: string | null; avatar_url: string | null; last_seen_at?: string | null };
type Conversation = {
  id: string;
  user1_id: string;
  user2_id: string;
  last_message_at: string;
  last_message_preview: string | null;
  last_sender_id: string | null;
  other?: Profile;
  unread?: number;
};
type Message = {
  id: string;
  conversation_id: string;
  sender_id: string;
  content: string | null;
  image_url: string | null;
  audio_url: string | null;
  audio_duration_ms: number | null;
  transcript: string | null;
  created_at: string;
  read_at: string | null;
};

const messageSchema = z.string().trim().min(1).max(4000);


function MessagesPage() {
  const { user, loading } = useAuth();
  const { c: selectedId } = Route.useSearch();
  const navigate = useNavigate();

  if (loading) {
    return (
      <div className="min-h-screen bg-background">
        <SiteHeader />
        <div className="pt-28 text-center text-muted-foreground">Chargement…</div>
      </div>
    );
  }

  if (!user) {
    return (
      <div className="min-h-screen bg-background">
        <SiteHeader />
        <div className="pt-28 mx-auto max-w-md text-center px-6">
          <MessageSquare className="w-12 h-12 mx-auto text-primary mb-3" />
          <h1 className="font-display text-2xl font-extrabold mb-2">Connecte-toi pour discuter</h1>
          <p className="text-muted-foreground mb-5">Envoie des messages privés aux artistes que tu suis.</p>
          <Link to="/login" className="inline-flex items-center px-5 py-2.5 rounded-full bg-primary text-primary-foreground font-bold">
            Se connecter
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      <SiteHeader />
      <div className="pt-24 mx-auto max-w-[1200px] px-4 md:px-6">
        <h1 className="font-display text-3xl font-extrabold mb-4">Messages</h1>
        <div className="grid grid-cols-1 md:grid-cols-[320px_1fr] gap-4 h-[calc(100vh-180px)] min-h-[500px] rounded-2xl border border-border overflow-hidden bg-surface/40">
          <ConversationList
            userId={user.id}
            selectedId={selectedId}
            onSelect={(id) => navigate({ to: "/messages", search: { c: id } })}
          />
          <ConversationThread
            userId={user.id}
            conversationId={selectedId}
            onBack={() => navigate({ to: "/messages", search: { c: undefined } })}
          />
        </div>
      </div>
    </div>
  );
}

function ConversationList({
  userId,
  selectedId,
  onSelect,
}: {
  userId: string;
  selectedId: string | undefined;
  onSelect: (id: string) => void;
}) {
  const [convs, setConvs] = useState<Conversation[]>([]);
  const [loading, setLoading] = useState(true);

  const refetch = async () => {
    const { data: rows } = await supabase
      .from("conversations")
      .select("*")
      .or(`user1_id.eq.${userId},user2_id.eq.${userId}`)
      .order("last_message_at", { ascending: false })
      .limit(50);
    const list = (rows ?? []) as Conversation[];
    const otherIds = Array.from(new Set(list.map((c) => (c.user1_id === userId ? c.user2_id : c.user1_id))));
    let profiles: Profile[] = [];
    if (otherIds.length) {
      const { data: ps } = await supabase
        .from("profiles")
        .select("id, display_name, avatar_url")
        .in("id", otherIds);
      profiles = (ps ?? []) as Profile[];
    }
    const pmap = new Map(profiles.map((p) => [p.id, p]));

    // Unread counts: messages from other not read yet
    const unreadMap = new Map<string, number>();
    if (list.length) {
      const { data: unread } = await supabase
        .from("messages")
        .select("conversation_id")
        .in("conversation_id", list.map((c) => c.id))
        .neq("sender_id", userId)
        .is("read_at", null);
      (unread ?? []).forEach((m: { conversation_id: string }) => {
        unreadMap.set(m.conversation_id, (unreadMap.get(m.conversation_id) ?? 0) + 1);
      });
    }

    setConvs(
      list.map((c) => ({
        ...c,
        other: pmap.get(c.user1_id === userId ? c.user2_id : c.user1_id),
        unread: unreadMap.get(c.id) ?? 0,
      })),
    );
    setLoading(false);
  };

  useEffect(() => {
    refetch();
    const channel = supabase
      .channel(`conv-list-${userId}`)
      .on("postgres_changes", { event: "*", schema: "public", table: "conversations" }, () => refetch())
      .on("postgres_changes", { event: "*", schema: "public", table: "messages" }, () => refetch())
      .subscribe();
    return () => {
      supabase.removeChannel(channel);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [userId]);

  return (
    <aside className={`border-r border-border overflow-y-auto ${selectedId ? "hidden md:block" : "block"}`}>
      {loading ? (
        <div className="p-6 text-sm text-muted-foreground">Chargement…</div>
      ) : convs.length === 0 ? (
        <div className="p-6 text-sm text-muted-foreground">
          Aucune conversation. Visite la page d'un artiste et clique sur "Message" pour commencer.
        </div>
      ) : (
        <ul>
          {convs.map((c) => {
            const isActive = c.id === selectedId;
            const initial = (c.other?.display_name ?? "?")[0]?.toUpperCase();
            const hasUnread = (c.unread ?? 0) > 0 && !isActive;
            return (
              <li key={c.id}>
                <button
                  onClick={() => onSelect(c.id)}
                  className={`w-full text-left px-4 py-3 flex items-center gap-3 border-b border-border/60 transition ${
                    isActive ? "bg-primary/10" : "hover:bg-surface"
                  }`}
                >
                  {c.other?.avatar_url ? (
                    <img src={c.other.avatar_url} alt="" className="w-11 h-11 rounded-full object-cover shrink-0" />
                  ) : (
                    <span className="grid place-items-center w-11 h-11 rounded-full bg-gradient-to-br from-primary to-fuchsia-600 text-primary-foreground font-bold shrink-0">
                      {initial}
                    </span>
                  )}
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center justify-between gap-2">
                      <p className={`truncate ${hasUnread ? "font-extrabold" : "font-semibold"}`}>
                        {c.other?.display_name ?? "Utilisateur"}
                      </p>
                      <span className="text-[10px] text-muted-foreground shrink-0">
                        {timeAgo(c.last_message_at)}
                      </span>
                    </div>
                    <div className="flex items-center justify-between gap-2">
                      <p className={`text-xs truncate ${hasUnread ? "text-foreground font-semibold" : "text-muted-foreground"}`}>
                        {c.last_sender_id === userId ? "Toi : " : ""}
                        {c.last_message_preview ?? "Nouvelle conversation"}
                      </p>
                      {hasUnread && (
                        <span className="grid place-items-center min-w-[20px] h-5 px-1.5 rounded-full bg-primary text-primary-foreground text-[10px] font-bold shrink-0">
                          {c.unread! > 9 ? "9+" : c.unread}
                        </span>
                      )}
                    </div>
                  </div>
                </button>
              </li>
            );
          })}
        </ul>
      )}
    </aside>
  );
}

function ConversationThread({
  userId,
  conversationId,
  onBack,
}: {
  userId: string;
  conversationId: string | undefined;
  onBack: () => void;
}) {
  const [messages, setMessages] = useState<Message[]>([]);
  const [other, setOther] = useState<Profile | null>(null);
  const [loading, setLoading] = useState(false);
  const [draft, setDraft] = useState("");
  const [sending, setSending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [pendingImage, setPendingImage] = useState<File | null>(null);
  const [pendingPreview, setPendingPreview] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [otherOnline, setOtherOnline] = useState(false);
  const [otherTyping, setOtherTyping] = useState(false);

  // Voice recording
  const [isRecording, setIsRecording] = useState(false);
  const [recordSeconds, setRecordSeconds] = useState(0);
  const [pendingAudio, setPendingAudio] = useState<{ blob: Blob; url: string; durationMs: number } | null>(null);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const audioChunksRef = useRef<BlobPart[]>([]);
  const recordTimerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const recordStartRef = useRef<number>(0);

  const scrollRef = useRef<HTMLDivElement>(null);
  const presenceChannelRef = useRef<RealtimeChannel | null>(null);
  const typingTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const lastTypingSentRef = useRef(0);
  const otherId = other?.id ?? null;

  // Load conversation + messages
  useEffect(() => {
    if (!conversationId) {
      setMessages([]);
      setOther(null);
      return;
    }
    setLoading(true);
    let cancelled = false;
    (async () => {
      const { data: conv } = await supabase
        .from("conversations")
        .select("user1_id, user2_id")
        .eq("id", conversationId)
        .maybeSingle();
      if (cancelled || !conv) return;
      const otherUserId = conv.user1_id === userId ? conv.user2_id : conv.user1_id;
      if (!otherUserId) return;
      const { data: prof } = await supabase
        .from("profiles")
        .select("id, display_name, avatar_url, last_seen_at")
        .eq("id", otherUserId)
        .maybeSingle();
      if (!cancelled) setOther((prof as Profile) ?? null);

      const { data: msgs } = await supabase
        .from("messages")
        .select("*")
        .eq("conversation_id", conversationId)
        .order("created_at", { ascending: true })
        .limit(200);
      if (!cancelled) {
        setMessages((msgs ?? []) as Message[]);
        setLoading(false);
      }

      await supabase
        .from("messages")
        .update({ read_at: new Date().toISOString() })
        .eq("conversation_id", conversationId)
        .neq("sender_id", userId)
        .is("read_at", null);
    })();

    const dbChannel = supabase
      .channel(`conv-msgs-${conversationId}`)
      .on(
        "postgres_changes",
        { event: "INSERT", schema: "public", table: "messages", filter: `conversation_id=eq.${conversationId}` },
        async (payload) => {
          const m = payload.new as Message;
          setMessages((prev) => (prev.some((x) => x.id === m.id) ? prev : [...prev, m]));
          // Auto-mark as read if it's from the other and we're viewing
          if (m.sender_id !== userId) {
            await supabase
              .from("messages")
              .update({ read_at: new Date().toISOString() })
              .eq("id", m.id)
              .is("read_at", null);
          }
        },
      )
      .on(
        "postgres_changes",
        { event: "UPDATE", schema: "public", table: "messages", filter: `conversation_id=eq.${conversationId}` },
        (payload) => {
          const m = payload.new as Message;
          setMessages((prev) => prev.map((x) => (x.id === m.id ? m : x)));
        },
      )
      .subscribe();

    return () => {
      cancelled = true;
      supabase.removeChannel(dbChannel);
    };
  }, [conversationId, userId]);

  // Presence + typing channel
  useEffect(() => {
    if (!conversationId) return;
    setOtherOnline(false);
    setOtherTyping(false);
    const channel = supabase.channel(`conv-presence-${conversationId}`, {
      config: { presence: { key: userId } },
    });
    presenceChannelRef.current = channel;

    channel
      .on("presence", { event: "sync" }, () => {
        const state = channel.presenceState();
        const others = Object.keys(state).filter((k) => k !== userId);
        setOtherOnline(others.length > 0);
      })
      .on("broadcast", { event: "typing" }, (payload) => {
        const from = (payload.payload as { from?: string })?.from;
        if (from && from !== userId) {
          setOtherTyping(true);
          if (typingTimeoutRef.current) clearTimeout(typingTimeoutRef.current);
          typingTimeoutRef.current = setTimeout(() => setOtherTyping(false), 3000);
        }
      })
      .on("broadcast", { event: "stop_typing" }, (payload) => {
        const from = (payload.payload as { from?: string })?.from;
        if (from && from !== userId) {
          if (typingTimeoutRef.current) clearTimeout(typingTimeoutRef.current);
          setOtherTyping(false);
        }
      })
      .subscribe(async (status) => {
        if (status === "SUBSCRIBED") {
          await channel.track({ user_id: userId, online_at: new Date().toISOString() });
        }
      });

    return () => {
      if (typingTimeoutRef.current) clearTimeout(typingTimeoutRef.current);
      supabase.removeChannel(channel);
      presenceChannelRef.current = null;
    };
  }, [conversationId, userId]);

  // Subscribe to other user's profile updates (last_seen_at)
  useEffect(() => {
    if (!otherId) return;
    const ch = supabase
      .channel(`profile-${otherId}`)
      .on(
        "postgres_changes",
        { event: "UPDATE", schema: "public", table: "profiles", filter: `id=eq.${otherId}` },
        (payload) => {
          const p = payload.new as Profile;
          setOther((prev) => (prev ? { ...prev, last_seen_at: p.last_seen_at ?? prev.last_seen_at } : prev));
        },
      )
      .subscribe();
    return () => {
      supabase.removeChannel(ch);
    };
  }, [otherId]);

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: "smooth" });
  }, [messages.length, otherTyping]);

  const sendTyping = (typing: boolean) => {
    const ch = presenceChannelRef.current;
    if (!ch) return;
    if (typing) {
      const now = Date.now();
      if (now - lastTypingSentRef.current < 1500) return; // throttle
      lastTypingSentRef.current = now;
      ch.send({ type: "broadcast", event: "typing", payload: { from: userId } });
    } else {
      lastTypingSentRef.current = 0;
      ch.send({ type: "broadcast", event: "stop_typing", payload: { from: userId } });
    }
  };

  const pickImage = (file: File | null) => {
    if (pendingPreview) URL.revokeObjectURL(pendingPreview);
    if (!file) {
      setPendingImage(null);
      setPendingPreview(null);
      return;
    }
    setPendingImage(file);
    setPendingPreview(URL.createObjectURL(file));
  };

  const clearPendingAudio = () => {
    if (pendingAudio) URL.revokeObjectURL(pendingAudio.url);
    setPendingAudio(null);
  };

  const startRecording = async () => {
    if (isRecording) return;
    setError(null);
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      // Prefer webm/opus; Safari falls back to mp4
      const mime = MediaRecorder.isTypeSupported("audio/webm;codecs=opus")
        ? "audio/webm;codecs=opus"
        : MediaRecorder.isTypeSupported("audio/mp4")
          ? "audio/mp4"
          : "";
      const mr = mime ? new MediaRecorder(stream, { mimeType: mime }) : new MediaRecorder(stream);
      audioChunksRef.current = [];
      mr.ondataavailable = (e) => {
        if (e.data && e.data.size > 0) audioChunksRef.current.push(e.data);
      };
      mr.onstop = () => {
        const type = mr.mimeType || "audio/webm";
        const blob = new Blob(audioChunksRef.current, { type });
        const durationMs = Date.now() - recordStartRef.current;
        const url = URL.createObjectURL(blob);
        // Replace previous pending
        if (pendingAudio) URL.revokeObjectURL(pendingAudio.url);
        setPendingAudio({ blob, url, durationMs });
        stream.getTracks().forEach((t) => t.stop());
      };
      recordStartRef.current = Date.now();
      mr.start();
      mediaRecorderRef.current = mr;
      setIsRecording(true);
      setRecordSeconds(0);
      recordTimerRef.current = setInterval(() => {
        const secs = Math.floor((Date.now() - recordStartRef.current) / 1000);
        setRecordSeconds(secs);
        if (secs >= 300) stopRecording(); // 5 min hard cap
      }, 250);
    } catch {
      setError("Micro indisponible. Autorise l'accès au micro pour enregistrer.");
    }
  };

  const stopRecording = () => {
    if (recordTimerRef.current) {
      clearInterval(recordTimerRef.current);
      recordTimerRef.current = null;
    }
    const mr = mediaRecorderRef.current;
    if (mr && mr.state !== "inactive") mr.stop();
    mediaRecorderRef.current = null;
    setIsRecording(false);
  };

  const cancelRecording = () => {
    if (recordTimerRef.current) {
      clearInterval(recordTimerRef.current);
      recordTimerRef.current = null;
    }
    const mr = mediaRecorderRef.current;
    if (mr && mr.state !== "inactive") {
      mr.onstop = null as unknown as () => void;
      try { mr.stop(); } catch { /* ignore */ }
      mr.stream.getTracks().forEach((t) => t.stop());
    }
    mediaRecorderRef.current = null;
    audioChunksRef.current = [];
    setIsRecording(false);
    setRecordSeconds(0);
  };

  const send = async () => {
    if (!conversationId) return;
    const hasText = draft.trim().length > 0;
    if (!hasText && !pendingImage && !pendingAudio) return;
    if (hasText) {
      const parsed = messageSchema.safeParse(draft);
      if (!parsed.success) {
        setError("Message vide ou trop long.");
        return;
      }
    }
    setError(null);
    setSending(true);
    let imageUrl: string | null = null;
    let audioUrl: string | null = null;
    let audioDurationMs: number | null = null;
    try {
      if (pendingImage) {
        imageUrl = await uploadChatImage(pendingImage, userId);
      }
      if (pendingAudio) {
        audioUrl = await uploadChatAudio(pendingAudio.blob, userId);
        audioDurationMs = pendingAudio.durationMs;
      }
    } catch (e) {
      setSending(false);
      setError(e instanceof Error ? e.message : "Échec de l'upload.");
      return;
    }
    const content = hasText ? draft.trim() : null;
    const { error: err } = await supabase
      .from("messages")
      .insert({
        conversation_id: conversationId,
        sender_id: userId,
        content,
        image_url: imageUrl,
        audio_url: audioUrl,
        audio_duration_ms: audioDurationMs,
      });
    setSending(false);
    if (err) {
      setError(err.message);
      return;
    }
    sendTyping(false);
    setDraft("");
    pickImage(null);
    clearPendingAudio();
    if (fileInputRef.current) fileInputRef.current.value = "";
    playSendSound();
  };



  const lastMine = useMemo(() => {
    for (let i = messages.length - 1; i >= 0; i--) {
      if (messages[i].sender_id === userId) return messages[i];
    }
    return null;
  }, [messages, userId]);

  if (!conversationId) {
    return (
      <div className="hidden md:flex items-center justify-center text-muted-foreground">
        <div className="text-center">
          <MessageSquare className="w-10 h-10 mx-auto mb-3 opacity-50" />
          <p className="text-sm">Sélectionne une conversation</p>
        </div>
      </div>
    );
  }

  return (
    <section className="flex flex-col min-w-0">
      <header className="px-4 py-3 border-b border-border flex items-center gap-3 bg-surface/60">
        <button onClick={onBack} className="md:hidden p-2 -ml-2" aria-label="Retour">
          <ArrowLeft className="w-5 h-5" />
        </button>
        <div className="relative shrink-0">
          {other?.avatar_url ? (
            <img src={other.avatar_url} alt="" className="w-9 h-9 rounded-full object-cover" />
          ) : (
            <span className="grid place-items-center w-9 h-9 rounded-full bg-gradient-to-br from-primary to-fuchsia-600 text-primary-foreground font-bold">
              {(other?.display_name ?? "?")[0]?.toUpperCase()}
            </span>
          )}
          <span
            className={`absolute -bottom-0.5 -right-0.5 w-2.5 h-2.5 rounded-full ring-2 ring-background ${
              otherOnline ? "bg-emerald-500" : "bg-muted-foreground/40"
            }`}
            aria-hidden
          />
        </div>
        <div className="min-w-0">
          <p className="font-bold truncate">{other?.display_name ?? "Utilisateur"}</p>
          <p className="text-[11px] text-muted-foreground">
            {otherTyping ? (
              <span className="text-primary font-semibold">en train d'écrire…</span>
            ) : otherOnline ? (
              <span className="text-emerald-500 font-semibold">En ligne</span>
            ) : other?.last_seen_at ? (
              `Vu ${timeAgo(other.last_seen_at)}`
            ) : (
              "Hors ligne"
            )}
          </p>
        </div>
      </header>

      <div ref={scrollRef} className="flex-1 overflow-y-auto p-4 space-y-2">
        {loading && <p className="text-sm text-muted-foreground text-center">Chargement…</p>}
        {!loading && messages.length === 0 && (
          <p className="text-sm text-muted-foreground text-center mt-10">
            Envoie le premier message pour démarrer la conversation.
          </p>
        )}
        {messages.map((m) => {
          const mine = m.sender_id === userId;
          const isLastMine = mine && lastMine?.id === m.id;
          return (
            <div key={m.id} className={`flex ${mine ? "justify-end" : "justify-start"}`}>
              <div className={`max-w-[75%] flex flex-col ${mine ? "items-end" : "items-start"}`}>
                <div
                  className={`px-3.5 py-2 rounded-2xl text-sm leading-relaxed break-words whitespace-pre-wrap ${
                    mine
                      ? "bg-primary text-primary-foreground rounded-br-sm"
                      : "bg-surface border border-border rounded-bl-sm"
                  }`}
                >
                  {m.image_url && (
                    <SignedImage path={m.image_url} />
                  )}
                  {m.audio_url && (
                    <div className="mb-1 -mx-1 first:mt-0 mt-0.5">
                      <SignedVoicePlayer path={m.audio_url} durationMs={m.audio_duration_ms} mine={mine} />
                      <VoiceTranscript
                        messageId={m.id}
                        transcript={m.transcript}
                        mine={mine}
                        onTranscribed={(t) =>
                          setMessages((prev) =>
                            prev.map((x) => (x.id === m.id ? { ...x, transcript: t } : x)),
                          )
                        }
                      />
                    </div>
                  )}
                  {m.content && <div>{m.content}</div>}
                  <div className={`text-[10px] mt-1 opacity-70 ${mine ? "text-primary-foreground" : "text-muted-foreground"}`}>
                    {new Date(m.created_at).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
                  </div>
                </div>

                {isLastMine && (
                  <span className="text-[10px] text-muted-foreground mt-1 inline-flex items-center gap-1 pr-1">
                    {m.read_at ? (
                      <>
                        <CheckCheck className="w-3 h-3 text-primary" /> Lu
                      </>
                    ) : (
                      <>
                        <Check className="w-3 h-3" /> Envoyé
                      </>
                    )}
                  </span>
                )}
              </div>
            </div>
          );
        })}
        {otherTyping && (
          <div className="flex justify-start">
            <div className="px-3.5 py-2 rounded-2xl bg-surface border border-border rounded-bl-sm">
              <span className="inline-flex items-center gap-1">
                <span className="w-1.5 h-1.5 rounded-full bg-muted-foreground animate-bounce [animation-delay:-0.3s]" />
                <span className="w-1.5 h-1.5 rounded-full bg-muted-foreground animate-bounce [animation-delay:-0.15s]" />
                <span className="w-1.5 h-1.5 rounded-full bg-muted-foreground animate-bounce" />
              </span>
            </div>
          </div>
        )}
      </div>

      <form
        onSubmit={(e) => {
          e.preventDefault();
          void send();
        }}
        className="border-t border-border p-3 bg-surface/60"
      >
        {error && <p className="text-xs text-destructive mb-2">{error}</p>}
        {pendingPreview && (
          <div className="mb-2 relative inline-block">
            <img src={pendingPreview} alt="" className="max-h-32 rounded-xl border border-border" />
            <button
              type="button"
              onClick={() => { pickImage(null); if (fileInputRef.current) fileInputRef.current.value = ""; }}
              className="absolute -top-2 -right-2 grid place-items-center w-6 h-6 rounded-full bg-background border border-border shadow"
              aria-label="Retirer l'image"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          </div>
        )}
        {pendingAudio && !isRecording && (
          <div className="mb-2 flex items-center gap-2 bg-background border border-border rounded-2xl p-2 pr-3 max-w-sm">
            <VoicePlayer src={pendingAudio.url} durationMs={pendingAudio.durationMs} mine={false} />
            <button
              type="button"
              onClick={clearPendingAudio}
              className="ml-auto grid place-items-center w-7 h-7 rounded-full text-muted-foreground hover:text-destructive"
              aria-label="Supprimer le vocal"
            >
              <Trash2 className="w-4 h-4" />
            </button>
          </div>
        )}
        {isRecording ? (
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={cancelRecording}
              className="grid place-items-center w-10 h-10 rounded-full bg-background border border-border text-muted-foreground hover:text-destructive hover:border-destructive shrink-0"
              aria-label="Annuler"
            >
              <Trash2 className="w-4 h-4" />
            </button>
            <div className="flex-1 flex items-center gap-3 bg-background border border-border rounded-2xl px-4 py-2.5">
              <span className="relative grid place-items-center w-3 h-3">
                <span className="absolute inset-0 rounded-full bg-red-500 animate-ping opacity-75" />
                <span className="relative w-2.5 h-2.5 rounded-full bg-red-500" />
              </span>
              <span className="text-sm font-mono tabular-nums">{formatDuration(recordSeconds * 1000)}</span>
              <span className="text-xs text-muted-foreground hidden sm:inline">Enregistrement…</span>
            </div>
            <button
              type="button"
              onClick={stopRecording}
              className="grid place-items-center w-10 h-10 rounded-full bg-red-500 text-white shrink-0 hover:opacity-90"
              aria-label="Arrêter l'enregistrement"
            >
              <Square className="w-4 h-4 fill-current" />
            </button>
          </div>
        ) : (
          <div className="flex items-end gap-2">
            <input
              ref={fileInputRef}
              type="file"
              accept="image/*"
              className="hidden"
              onChange={(e) => pickImage(e.target.files?.[0] ?? null)}
            />
            <button
              type="button"
              onClick={() => fileInputRef.current?.click()}
              className="grid place-items-center w-10 h-10 rounded-full bg-background border border-border text-muted-foreground hover:text-primary hover:border-primary shrink-0"
              aria-label="Joindre une image"
            >
              <ImagePlus className="w-4 h-4" />
            </button>
            <textarea
              value={draft}
              onChange={(e) => {
                setDraft(e.target.value);
                if (e.target.value.trim().length > 0) sendTyping(true);
                else sendTyping(false);
              }}
              onBlur={() => sendTyping(false)}
              onKeyDown={(e) => {
                if (e.key === "Enter" && !e.shiftKey) {
                  e.preventDefault();
                  void send();
                }
              }}
              placeholder="Écris ton message…"
              rows={1}
              maxLength={4000}
              className="flex-1 resize-none bg-background border border-border rounded-2xl px-4 py-2.5 text-sm outline-none focus:border-primary max-h-32"
            />
            {draft.trim().length === 0 && !pendingImage && !pendingAudio ? (
              <button
                type="button"
                onClick={startRecording}
                className="grid place-items-center w-10 h-10 rounded-full bg-primary text-primary-foreground shrink-0 hover:opacity-90"
                aria-label="Enregistrer un message vocal"
              >
                <Mic className="w-4 h-4" />
              </button>
            ) : (
              <button
                type="submit"
                disabled={sending}
                className="grid place-items-center w-10 h-10 rounded-full bg-primary text-primary-foreground disabled:opacity-50 hover:opacity-90 shrink-0"
                aria-label="Envoyer"
              >
                <Send className="w-4 h-4" />
              </button>
            )}
          </div>
        )}
      </form>
    </section>
  );
}

function formatDuration(ms: number | null | undefined) {
  const total = Math.max(0, Math.floor((ms ?? 0) / 1000));
  const m = Math.floor(total / 60);
  const s = total % 60;
  return `${m}:${s.toString().padStart(2, "0")}`;
}

function VoicePlayer({ src, durationMs, mine }: { src: string; durationMs: number | null; mine: boolean }) {
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const [playing, setPlaying] = useState(false);
  const [progress, setProgress] = useState(0); // 0..1
  const [currentMs, setCurrentMs] = useState(0);
  const [loadedMs, setLoadedMs] = useState<number | null>(durationMs ?? null);

  useEffect(() => {
    const a = audioRef.current;
    if (!a) return;
    const onTime = () => {
      const cur = a.currentTime * 1000;
      setCurrentMs(cur);
      const total = (loadedMs ?? (a.duration ? a.duration * 1000 : 0));
      setProgress(total > 0 ? Math.min(1, cur / total) : 0);
    };
    const onEnd = () => { setPlaying(false); setProgress(0); setCurrentMs(0); a.currentTime = 0; };
    const onMeta = () => {
      if (Number.isFinite(a.duration) && a.duration > 0) setLoadedMs(a.duration * 1000);
    };
    a.addEventListener("timeupdate", onTime);
    a.addEventListener("ended", onEnd);
    a.addEventListener("loadedmetadata", onMeta);
    return () => {
      a.removeEventListener("timeupdate", onTime);
      a.removeEventListener("ended", onEnd);
      a.removeEventListener("loadedmetadata", onMeta);
    };
  }, [loadedMs]);

  const toggle = () => {
    const a = audioRef.current;
    if (!a) return;
    if (playing) { a.pause(); setPlaying(false); }
    else { void a.play().then(() => setPlaying(true)).catch(() => setPlaying(false)); }
  };

  const display = playing || currentMs > 0 ? currentMs : (loadedMs ?? 0);

  return (
    <div className="flex items-center gap-2 min-w-[180px] max-w-[260px]">
      <button
        type="button"
        onClick={toggle}
        className={`grid place-items-center w-8 h-8 rounded-full shrink-0 ${
          mine ? "bg-primary-foreground/20 text-primary-foreground hover:bg-primary-foreground/30" : "bg-primary text-primary-foreground hover:opacity-90"
        }`}
        aria-label={playing ? "Pause" : "Lire"}
      >
        {playing ? <Pause className="w-3.5 h-3.5 fill-current" /> : <Play className="w-3.5 h-3.5 fill-current" />}
      </button>
      <div className="flex-1 min-w-0">
        <div className={`h-1.5 rounded-full overflow-hidden ${mine ? "bg-primary-foreground/25" : "bg-border"}`}>
          <div
            className={`h-full ${mine ? "bg-primary-foreground" : "bg-primary"}`}
            style={{ width: `${progress * 100}%` }}
          />
        </div>
        <div className={`text-[10px] mt-0.5 tabular-nums ${mine ? "text-primary-foreground/80" : "text-muted-foreground"}`}>
          {formatDuration(display)}
        </div>
      </div>
      <audio ref={audioRef} src={src} preload="metadata" />
    </div>
  );
}

function timeAgo(iso: string) {
  const d = new Date(iso).getTime();
  const s = Math.floor((Date.now() - d) / 1000);
  if (s < 60) return "à l'instant";
  if (s < 3600) return `${Math.floor(s / 60)}m`;
  if (s < 86400) return `${Math.floor(s / 3600)}h`;
  if (s < 604800) return `${Math.floor(s / 86400)}j`;
  return new Date(iso).toLocaleDateString();
}

function useSignedMediaUrl(path: string | null) {
  const [url, setUrl] = useState<string | null>(null);
  useEffect(() => {
    let cancelled = false;
    if (!path) { setUrl(null); return; }
    void getChatMediaSignedUrl(path).then((u) => { if (!cancelled) setUrl(u); });
    return () => { cancelled = true; };
  }, [path]);
  return url;
}

function SignedImage({ path }: { path: string }) {
  const url = useSignedMediaUrl(path);
  if (!url) {
    return (
      <div className="mb-1.5 -mx-1 -mt-1 first:rounded-t-2xl h-40 w-40 rounded-xl bg-muted animate-pulse" />
    );
  }
  return (
    <a
      href={url}
      target="_blank"
      rel="noreferrer"
      className="block mb-1.5 -mx-1 -mt-1 first:rounded-t-2xl overflow-hidden"
    >
      <img
        src={url}
        alt=""
        className="max-h-72 w-auto rounded-xl object-cover"
        loading="lazy"
      />
    </a>
  );
}

function SignedVoicePlayer({ path, durationMs, mine }: { path: string; durationMs: number | null; mine: boolean }) {
  const url = useSignedMediaUrl(path);
  if (!url) {
    return (
      <div className="flex items-center gap-2 min-w-[180px] max-w-[260px] opacity-60">
        <div className="w-8 h-8 rounded-full bg-muted animate-pulse shrink-0" />
        <div className="flex-1 h-1.5 rounded-full bg-muted animate-pulse" />
      </div>
    );
  }
  return <VoicePlayer src={url} durationMs={durationMs} mine={mine} />;
}

function VoiceTranscript({
  messageId,
  transcript,
  mine,
  onTranscribed,
}: {
  messageId: string;
  transcript: string | null;
  mine: boolean;
  onTranscribed: (text: string) => void;
}) {
  const [loading, setLoading] = useState(false);
  const [shown, setShown] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const onClick = async () => {
    setError(null);
    if (transcript) {
      setShown((s) => !s);
      return;
    }
    setLoading(true);
    try {
      const res = await transcribeVoiceMessage({ data: { messageId } });
      onTranscribed(res.transcript);
      setShown(true);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Échec de la transcription.");
    } finally {
      setLoading(false);
    }
  };

  const btnBase = `inline-flex items-center gap-1 text-[11px] mt-1 px-2 py-0.5 rounded-full transition ${
    mine
      ? "bg-primary-foreground/15 hover:bg-primary-foreground/25 text-primary-foreground/90"
      : "bg-muted hover:bg-muted/70 text-muted-foreground"
  }`;

  return (
    <div>
      <button
        type="button"
        onClick={onClick}
        disabled={loading}
        className={btnBase}
        aria-label={
          transcript ? (shown ? "Masquer la transcription" : "Afficher la transcription") : "Transcrire le vocal"
        }
      >
        {loading ? (
          <>
            <Loader2 className="w-3 h-3 animate-spin" /> Transcription…
          </>
        ) : transcript ? (
          shown ? (
            <>
              <EyeOff className="w-3 h-3" /> Masquer le texte
            </>
          ) : (
            <>
              <FileText className="w-3 h-3" /> Afficher le texte
            </>
          )
        ) : (
          <>
            <FileText className="w-3 h-3" /> Transcrire
          </>
        )}
      </button>
      {error && (
        <p className={`text-[10px] mt-1 ${mine ? "text-primary-foreground/80" : "text-destructive"}`}>{error}</p>
      )}
      {transcript && shown && (
        <p
          className={`mt-1 text-xs italic leading-snug whitespace-pre-wrap break-words ${
            mine ? "text-primary-foreground/90" : "text-foreground/80"
          }`}
        >
          {transcript}
        </p>
      )}
    </div>
  );
}

