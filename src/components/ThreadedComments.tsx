import { useEffect, useMemo, useRef, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Heart, MessageCircle, MoreHorizontal, Pin, Send, Trash2, Loader2, Flame, ImagePlus, X } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import {
  createTrackComment,
  deleteTrackComment,
  getTrackComments,
  setCommentPinned,
  toggleCommentLike,
  type TrackComment,
} from "@/lib/track-social";
import { useAuth } from "@/hooks/use-auth";
import { defaultAvatar } from "@/lib/default-avatar";
import { playSendSound } from "@/lib/sounds";
import { uploadChatImage } from "@/lib/chat-media";


interface Props {
  trackId: string;
  isOwner: boolean;
}

interface Node extends TrackComment {
  replies: Node[];
}

function buildTree(flat: TrackComment[]): Node[] {
  const map = new Map<string, Node>();
  flat.forEach((c) => map.set(c.id, { ...c, replies: [] }));
  const roots: Node[] = [];
  flat.forEach((c) => {
    const node = map.get(c.id)!;
    if (c.parent_comment_id && map.has(c.parent_comment_id)) {
      map.get(c.parent_comment_id)!.replies.push(node);
    } else {
      roots.push(node);
    }
  });
  // Sort replies oldest→newest, roots: pinned > most liked > newest
  roots.sort((a, b) => {
    if (a.pinned !== b.pinned) return a.pinned ? -1 : 1;
    if (b.likes_count !== a.likes_count) return b.likes_count - a.likes_count;
    return b.created_at.localeCompare(a.created_at);
  });
  const sortReplies = (n: Node) => {
    n.replies.sort((a, b) => a.created_at.localeCompare(b.created_at));
    n.replies.forEach(sortReplies);
  };
  roots.forEach(sortReplies);
  return roots;
}

function timeAgo(iso: string) {
  const s = Math.max(1, Math.floor((Date.now() - new Date(iso).getTime()) / 1000));
  if (s < 60) return `${s}s`;
  const m = Math.floor(s / 60);
  if (m < 60) return `${m}m`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}h`;
  const d = Math.floor(h / 24);
  if (d < 7) return `${d}j`;
  const w = Math.floor(d / 7);
  if (w < 5) return `${w}sem`;
  return new Date(iso).toLocaleDateString();
}

function Avatar({ name, url, size = 36 }: { name: string; url?: string | null; size?: number }) {
  const src = url && url.length > 0 ? url : defaultAvatar(name);
  return (
    <div
      className="shrink-0 rounded-full overflow-hidden bg-muted/40 ring-1 ring-border/60"
      style={{ width: size, height: size }}
    >
      <img src={src} alt={name} className="w-full h-full object-cover" loading="lazy" />
    </div>
  );
}


function CommentItem({
  node,
  trackId,
  isOwner,
  depth,
  onReply,
  replyingTo,
  setReplyingTo,
}: {
  node: Node;
  trackId: string;
  isOwner: boolean;
  depth: number;
  onReply: (parentId: string, content: string, authorName: string) => Promise<void>;
  replyingTo: string | null;
  setReplyingTo: (id: string | null) => void;
}) {
  const { user } = useAuth();
  const qc = useQueryClient();
  const [reply, setReply] = useState("");
  const [animating, setAnimating] = useState(false);
  const [showReplies, setShowReplies] = useState(depth === 0 ? false : true);

  const isMine = user?.id === node.user_id;
  const canModerate = isMine || isOwner;

  const likeLockRef = useRef(false);
  const lastLikeAtRef = useRef(0);

  const likeM = useMutation({
    mutationFn: async () => {
      if (!user) throw new Error("Connecte-toi pour aimer.");
      return toggleCommentLike(node.id, user.id, node.is_liked);
    },
    onMutate: async () => {
      await qc.cancelQueries({ queryKey: ["track-comments", trackId] });
      const prev = qc.getQueryData<TrackComment[]>(["track-comments", trackId]);
      qc.setQueryData<TrackComment[]>(["track-comments", trackId], (cur) =>
        cur?.map((c) =>
          c.id === node.id
            ? { ...c, is_liked: !c.is_liked, likes_count: Math.max(0, c.likes_count + (c.is_liked ? -1 : 1)) }
            : c,
        ) ?? [],
      );
      setAnimating(true);
      setTimeout(() => setAnimating(false), 350);
      if (!node.is_liked) {
        import("@/components/RewardOverlay").then(({ triggerReward }) => triggerReward("like"));
      }
      return { prev };
    },
    onError: (e: Error, _v, ctx) => {
      if (ctx?.prev) qc.setQueryData(["track-comments", trackId], ctx.prev);
      toast.error(e.message);
    },
    onSettled: () => {
      likeLockRef.current = false;
      qc.invalidateQueries({ queryKey: ["track-comments", trackId] });
    },
  });

  const handleLike = () => {
    const now = Date.now();
    if (likeLockRef.current || likeM.isPending) return;
    if (now - lastLikeAtRef.current < 400) return; // anti-spam debounce
    lastLikeAtRef.current = now;
    likeLockRef.current = true;
    likeM.mutate();
  };


  const delM = useMutation({
    mutationFn: async () => {
      if (!user) throw new Error("Non connecté.");
      await deleteTrackComment(node.id, isMine ? user.id : node.user_id);
    },
    onSuccess: () => {
      toast.success("Commentaire supprimé");
      qc.invalidateQueries({ queryKey: ["track-comments", trackId] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const pinM = useMutation({
    mutationFn: async () => setCommentPinned(node.id, !node.pinned),
    onSuccess: () => {
      toast.success(node.pinned ? "Commentaire désépinglé" : "Commentaire épinglé");
      qc.invalidateQueries({ queryKey: ["track-comments", trackId] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const submitReply = async () => {
    const content = reply.trim();
    if (!content) return;
    await onReply(node.id, content, node.author_name);
    setReply("");
    setReplyingTo(null);
    setShowReplies(true);
  };

  const isTopByLikes = depth === 0 && node.likes_count >= 3;

  return (
    <div className={depth > 0 ? "pl-3 sm:pl-4 border-l-2 border-border/60 ml-4 sm:ml-5" : ""}>
      <div className="group/comment flex gap-2.5 py-2">
        <Avatar name={node.author_name} url={node.avatar_url} size={depth === 0 ? 36 : 28} />
        <div className="flex-1 min-w-0">
          <div className="flex items-baseline gap-1.5 flex-wrap">
            <span className="text-[13px] font-bold leading-tight">{node.author_name}</span>
            {node.pinned && (
              <span className="inline-flex items-center gap-0.5 text-[10px] font-bold uppercase text-primary">
                <Pin className="w-2.5 h-2.5" /> Épinglé
              </span>
            )}
            {isTopByLikes && !node.pinned && (
              <span className="inline-flex items-center gap-0.5 text-[10px] font-bold uppercase text-amber-500">
                <Flame className="w-2.5 h-2.5" /> Top
              </span>
            )}
            <span className="text-[11px] text-muted-foreground">· {timeAgo(node.created_at)}</span>
            {canModerate && (
              <CommentMenu
                canPin={isOwner && depth === 0}
                pinned={node.pinned}
                onPin={() => pinM.mutate()}
                canDelete={canModerate}
                onDelete={() => {
                  if (confirm("Supprimer ce commentaire ?")) delM.mutate();
                }}
              />
            )}
          </div>
          {node.content && (
            <p className="text-[14px] text-foreground/95 whitespace-pre-wrap break-words leading-snug mt-0.5">
              {node.content}
            </p>
          )}
          {node.image_url && (() => {
            const url = node.image_url.startsWith("http")
              ? node.image_url
              : supabase.storage.from("chat-media").getPublicUrl(node.image_url).data.publicUrl;
            return (
              <a href={url} target="_blank" rel="noreferrer" className="mt-1.5 block">
                <img
                  src={url}
                  alt=""
                  className="max-h-72 rounded-lg object-cover"
                  loading="lazy"
                />
              </a>
            );
          })()}


          <div className="flex items-center gap-3 mt-1 text-[12px]">
            <button
              onClick={handleLike}
              disabled={likeM.isPending}
              className={`inline-flex items-center gap-1 font-medium transition-colors ${node.is_liked ? "text-rose-500" : "text-muted-foreground hover:text-foreground"}`}
              aria-label={node.is_liked ? "Retirer le like" : "Aimer"}
            >
              <Heart
                className={`w-3.5 h-3.5 transition-transform duration-300 ${node.is_liked ? "fill-current" : ""} ${animating ? "scale-[1.6] rotate-12" : "scale-100"}`}
              />
              <span className="tabular-nums">{node.likes_count}</span>
            </button>
            <button
              onClick={() => setReplyingTo(replyingTo === node.id ? null : node.id)}
              className="font-medium text-muted-foreground hover:text-foreground transition-colors"
            >
              Répondre
            </button>
          </div>

          {replyingTo === node.id && (
            <div className="mt-2 flex items-start gap-2">
              <textarea
                autoFocus
                rows={1}
                value={reply}
                onChange={(e) => setReply(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter" && !e.shiftKey) {
                    e.preventDefault();
                    submitReply();
                  }
                }}
                placeholder={`Répondre à @${node.author_name}…`}
                className="flex-1 min-w-0 resize-none rounded-full border border-border bg-background px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-primary/40"
              />
              <button
                onClick={submitReply}
                disabled={!reply.trim()}
                className="grid place-items-center w-8 h-8 rounded-full bg-primary text-primary-foreground disabled:opacity-50 hover:opacity-90 transition-opacity"
                aria-label="Envoyer"
              >
                <Send className="w-3.5 h-3.5" />
              </button>
            </div>
          )}

          {node.replies.length > 0 && depth === 0 && !showReplies && (
            <button
              onClick={() => setShowReplies(true)}
              className="mt-1.5 inline-flex items-center gap-1 text-[12px] font-semibold text-muted-foreground hover:text-foreground"
            >
              <span className="inline-block w-6 h-px bg-border" />
              Voir les {node.replies.length} réponse{node.replies.length > 1 ? "s" : ""}
            </button>
          )}
        </div>
      </div>

      {showReplies && node.replies.length > 0 && (
        <div>
          {node.replies.map((r) => (
            <CommentItem
              key={r.id}
              node={r}
              trackId={trackId}
              isOwner={isOwner}
              depth={Math.min(depth + 1, 2)}
              onReply={onReply}
              replyingTo={replyingTo}
              setReplyingTo={setReplyingTo}
            />
          ))}
          {depth === 0 && (
            <button
              onClick={() => setShowReplies(false)}
              className="ml-10 mb-2 inline-flex items-center gap-1 text-[12px] font-medium text-muted-foreground hover:text-foreground"
            >
              <span className="inline-block w-6 h-px bg-border" />
              Masquer les réponses
            </button>
          )}
        </div>
      )}
    </div>
  );
}


function CommentMenu({
  canPin,
  pinned,
  onPin,
  canDelete,
  onDelete,
}: {
  canPin: boolean;
  pinned: boolean;
  onPin: () => void;
  canDelete: boolean;
  onDelete: () => void;
}) {
  const [open, setOpen] = useState(false);
  useEffect(() => {
    if (!open) return;
    const close = () => setOpen(false);
    window.addEventListener("click", close);
    return () => window.removeEventListener("click", close);
  }, [open]);
  return (
    <div className="ml-auto relative">
      <button
        onClick={(e) => { e.stopPropagation(); setOpen((v) => !v); }}
        className="grid place-items-center w-7 h-7 rounded-full text-muted-foreground hover:text-foreground hover:bg-background/60 transition"
        aria-label="Plus d'actions"
      >
        <MoreHorizontal className="w-4 h-4" />
      </button>
      {open && (
        <div className="absolute right-0 top-full mt-1 z-20 min-w-[160px] rounded-xl border border-border bg-popover shadow-lg overflow-hidden">
          {canPin && (
            <button
              onClick={(e) => { e.stopPropagation(); setOpen(false); onPin(); }}
              className="flex items-center gap-2 w-full px-3 py-2 text-sm hover:bg-surface text-left"
            >
              <Pin className="w-4 h-4" /> {pinned ? "Désépingler" : "Épingler"}
            </button>
          )}
          {canDelete && (
            <button
              onClick={(e) => { e.stopPropagation(); setOpen(false); onDelete(); }}
              className="flex items-center gap-2 w-full px-3 py-2 text-sm hover:bg-surface text-left text-rose-400"
            >
              <Trash2 className="w-4 h-4" /> Supprimer
            </button>
          )}
        </div>
      )}
    </div>
  );
}

export function ThreadedComments({ trackId, isOwner }: Props) {
  const { user } = useAuth();
  const qc = useQueryClient();
  const [text, setText] = useState("");
  const [replyingTo, setReplyingTo] = useState<string | null>(null);
  const [pendingImage, setPendingImage] = useState<File | null>(null);
  const [pendingPreview, setPendingPreview] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const { data: comments = [], isLoading } = useQuery({
    queryKey: ["track-comments", trackId],
    queryFn: () => getTrackComments(trackId),
  });

  const tree = useMemo(() => buildTree(comments), [comments]);

  // Realtime subscription
  useEffect(() => {
    const channel = supabase
      .channel(`track-comments-${trackId}`)
      .on("postgres_changes", { event: "*", schema: "public", table: "track_comments", filter: `track_id=eq.${trackId}` }, () => {
        qc.invalidateQueries({ queryKey: ["track-comments", trackId] });
      })
      .on("postgres_changes", { event: "*", schema: "public", table: "comment_likes" }, () => {
        qc.invalidateQueries({ queryKey: ["track-comments", trackId] });
      })
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, [trackId, qc]);

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

  const postM = useMutation({
    mutationFn: async (payload: { content: string; parent?: string | null; image?: File | null }) => {
      if (!user) throw new Error("Connecte-toi pour commenter.");
      const authorName =
        (user.user_metadata?.first_name as string | undefined) ||
        (user.user_metadata?.display_name as string | undefined) ||
        user.email?.split("@")[0] ||
        "Fan";
      let imageUrl: string | null = null;
      if (payload.image) {
        imageUrl = await uploadChatImage(payload.image, user.id);
      }
      return createTrackComment(trackId, user.id, authorName, payload.content, payload.parent ?? null, imageUrl);
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["track-comments", trackId] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const submit = async () => {
    const content = text.trim();
    if (!content && !pendingImage) return;
    await postM.mutateAsync({ content, image: pendingImage });
    setText("");
    pickImage(null);
    if (fileInputRef.current) fileInputRef.current.value = "";
    playSendSound();
  };

  const submitReply = async (parentId: string, content: string) => {
    await postM.mutateAsync({ content, parent: parentId });
    playSendSound();
  };

  const total = comments.length;

  return (
    <section className="bg-transparent">
      <header className="flex items-center justify-between px-1 py-2">
        <h3 className="text-sm font-bold flex items-center gap-2">
          <MessageCircle className="w-4 h-4 text-primary" />
          {total} commentaire{total > 1 ? "s" : ""}
        </h3>
      </header>


      {/* Composer */}
      <div className="px-1 py-2">
        {user ? (
          <div className="flex items-start gap-3">
            <Avatar
              name={(user.user_metadata?.first_name as string) || user.email || "Moi"}
              url={(user.user_metadata?.avatar_url as string | undefined) ?? null}
            />
            <div className="flex-1 min-w-0">
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
                  rows={1}
                  value={text}
                  onChange={(e) => setText(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter" && !e.shiftKey) {
                      e.preventDefault();
                      submit();
                    }
                  }}
                  placeholder="Ajoute un commentaire…"
                  className="flex-1 min-w-0 resize-none rounded-2xl border border-border bg-background px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-primary/40"
                />
                <button
                  onClick={submit}
                  disabled={postM.isPending || (!text.trim() && !pendingImage)}
                  className="grid place-items-center w-10 h-10 rounded-full bg-primary text-primary-foreground disabled:opacity-50 hover:opacity-90 transition-opacity"
                  aria-label="Publier"
                >
                  {postM.isPending ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}
                </button>
              </div>
            </div>
          </div>
        ) : (
          <p className="text-sm text-muted-foreground py-2">Connecte-toi pour commenter.</p>
        )}
      </div>


      {/* List */}
      <div className="px-1 py-1">
        {isLoading ? (
          <div className="py-10 grid place-items-center text-muted-foreground">
            <Loader2 className="w-5 h-5 animate-spin" />
          </div>
        ) : tree.length === 0 ? (
          <p className="py-10 text-center text-sm text-muted-foreground">
            Sois le premier à laisser un commentaire 💬
          </p>
        ) : (
          <ul className="space-y-0">
            {tree.map((n) => (
              <li key={n.id}>
                <CommentItem
                  node={n}
                  trackId={trackId}
                  isOwner={isOwner}
                  depth={0}
                  onReply={submitReply}
                  replyingTo={replyingTo}
                  setReplyingTo={setReplyingTo}
                />
              </li>
            ))}
          </ul>
        )}
      </div>
    </section>
  );
}
