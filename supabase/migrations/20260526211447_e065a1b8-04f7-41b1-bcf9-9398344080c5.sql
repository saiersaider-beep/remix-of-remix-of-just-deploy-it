ALTER TABLE public.audio_access_logs ADD COLUMN IF NOT EXISTS mode TEXT;
ALTER TABLE public.audio_access_logs ADD COLUMN IF NOT EXISTS reason TEXT;

ALTER TABLE public.playlist_tracks ADD COLUMN IF NOT EXISTS id UUID DEFAULT gen_random_uuid();
ALTER TABLE public.playlist_tracks ADD COLUMN IF NOT EXISTS added_by UUID;

CREATE TABLE IF NOT EXISTS public.playlist_collaborators (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  playlist_id UUID NOT NULL REFERENCES public.playlists(id) ON DELETE CASCADE,
  user_id UUID NOT NULL,
  role TEXT NOT NULL DEFAULT 'viewer' CHECK (role IN ('editor', 'viewer')),
  invited_by UUID,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (playlist_id, user_id)
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.playlist_collaborators TO authenticated;
GRANT ALL ON public.playlist_collaborators TO service_role;
CREATE INDEX IF NOT EXISTS idx_playlist_collab_user ON public.playlist_collaborators(user_id);
CREATE INDEX IF NOT EXISTS idx_playlist_collab_playlist ON public.playlist_collaborators(playlist_id);
ALTER TABLE public.playlist_collaborators ENABLE ROW LEVEL SECURITY;

DO $a$ BEGIN
  CREATE POLICY "Owner or invitee can view collaboration" ON public.playlist_collaborators FOR SELECT
    USING (auth.uid() = user_id OR EXISTS (SELECT 1 FROM public.playlists p WHERE p.id = playlist_id AND p.user_id = auth.uid()));
EXCEPTION WHEN OTHERS THEN NULL; END $a$;

DO $b$ BEGIN
  CREATE POLICY "Owner can invite collaborators" ON public.playlist_collaborators FOR INSERT
    WITH CHECK (EXISTS (SELECT 1 FROM public.playlists p WHERE p.id = playlist_id AND p.user_id = auth.uid()));
EXCEPTION WHEN OTHERS THEN NULL; END $b$;

DO $c$ BEGIN
  CREATE POLICY "Owner can update collaborators" ON public.playlist_collaborators FOR UPDATE
    USING (EXISTS (SELECT 1 FROM public.playlists p WHERE p.id = playlist_id AND p.user_id = auth.uid()));
EXCEPTION WHEN OTHERS THEN NULL; END $c$;

DO $d$ BEGIN
  CREATE POLICY "Owner or self can remove collaborator" ON public.playlist_collaborators FOR DELETE
    USING (auth.uid() = user_id OR EXISTS (SELECT 1 FROM public.playlists p WHERE p.id = playlist_id AND p.user_id = auth.uid()));
EXCEPTION WHEN OTHERS THEN NULL; END $d$;

CREATE TABLE IF NOT EXISTS public.listening_history (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL,
  track_id UUID NOT NULL,
  played_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.listening_history TO authenticated;
GRANT ALL ON public.listening_history TO service_role;
CREATE INDEX IF NOT EXISTS idx_listening_history_user_played ON public.listening_history(user_id, played_at DESC);
ALTER TABLE public.listening_history ENABLE ROW LEVEL SECURITY;

DO $e$ BEGIN
  CREATE POLICY "Users read own listening history" ON public.listening_history FOR SELECT
    USING (auth.uid() = user_id);
EXCEPTION WHEN OTHERS THEN NULL; END $e$;

DO $f$ BEGIN
  CREATE POLICY "Users insert own listening history" ON public.listening_history FOR INSERT
    WITH CHECK (auth.uid() = user_id);
EXCEPTION WHEN OTHERS THEN NULL; END $f$;

DO $g$ BEGIN
  CREATE POLICY "Users delete own listening history" ON public.listening_history FOR DELETE
    USING (auth.uid() = user_id);
EXCEPTION WHEN OTHERS THEN NULL; END $g$;

CREATE TABLE IF NOT EXISTS public.track_access (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL,
  track_id UUID NOT NULL,
  source TEXT NOT NULL DEFAULT 'purchase',
  granted_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  expires_at TIMESTAMPTZ,
  UNIQUE (user_id, track_id, source)
);
GRANT SELECT ON public.track_access TO authenticated;
GRANT ALL ON public.track_access TO service_role;
CREATE INDEX IF NOT EXISTS idx_track_access_user ON public.track_access(user_id);
ALTER TABLE public.track_access ENABLE ROW LEVEL SECURITY;

DO $h$ BEGIN
  CREATE POLICY "Users read own track access" ON public.track_access FOR SELECT
    USING (auth.uid() = user_id OR public.has_role(auth.uid(), 'admin'::app_role));
EXCEPTION WHEN OTHERS THEN NULL; END $h$;