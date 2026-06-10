DO $mig_011$ BEGIN
CREATE TABLE IF NOT EXISTS public.track_likes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  track_id uuid NOT NULL REFERENCES public.tracks(id) ON DELETE CASCADE,
  user_id uuid NOT NULL,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  UNIQUE (track_id, user_id)
);
EXCEPTION WHEN OTHERS THEN RAISE NOTICE 'skip mig11: %', SQLERRM; END $mig_011$;

DO $mig_pricing$ BEGIN
ALTER TABLE public.tracks
  ADD COLUMN IF NOT EXISTS pricing_model text NOT NULL DEFAULT 'free',
  ADD COLUMN IF NOT EXISTS price_amount integer NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS price_currency text NOT NULL DEFAULT 'XOF',
  ADD COLUMN IF NOT EXISTS preview_seconds integer NOT NULL DEFAULT 30,
  ADD COLUMN IF NOT EXISTS lyrics text;
EXCEPTION WHEN OTHERS THEN RAISE NOTICE 'skip pricing: %', SQLERRM; END $mig_pricing$;

DO $roles$ BEGIN
  CREATE TYPE public.app_role AS ENUM ('admin','moderator','user','super_admin');
EXCEPTION WHEN duplicate_object THEN NULL; END $roles$;

DO $w397$ BEGIN
ALTER TYPE public.app_role ADD VALUE IF NOT EXISTS 'super_admin';
EXCEPTION WHEN OTHERS THEN NULL; END $w397$;

DO $w368$ BEGIN
CREATE TABLE IF NOT EXISTS public.user_roles (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  role public.app_role NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (user_id, role)
);
ALTER TABLE public.user_roles ENABLE ROW LEVEL SECURITY;
GRANT SELECT ON public.user_roles TO authenticated;
GRANT ALL ON public.user_roles TO service_role;
EXCEPTION WHEN OTHERS THEN RAISE NOTICE 'skip 368: %', SQLERRM; END $w368$;

DO $w370$ BEGIN
CREATE OR REPLACE FUNCTION public.has_role(_user_id uuid, _role public.app_role)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (SELECT 1 FROM public.user_roles WHERE user_id = _user_id AND role = _role);
$$;
EXCEPTION WHEN OTHERS THEN RAISE NOTICE 'skip 370: %', SQLERRM; END $w370$;

DO $p1$ BEGIN CREATE POLICY "Users can view their own role" ON public.user_roles FOR SELECT USING (auth.uid() = user_id); EXCEPTION WHEN duplicate_object THEN NULL; END $p1$;
DO $p2$ BEGIN CREATE POLICY "Admins can view roles" ON public.user_roles FOR SELECT USING (public.has_role(auth.uid(), 'admin')); EXCEPTION WHEN duplicate_object THEN NULL; END $p2$;

DO $w374$ BEGIN
CREATE TABLE IF NOT EXISTS public.live_rooms (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  artist_id uuid NOT NULL UNIQUE REFERENCES public.artists(id) ON DELETE CASCADE,
  title text,
  is_live boolean NOT NULL DEFAULT false,
  mode text NOT NULL DEFAULT 'MUSIC_ONLY' CHECK (mode IN ('MUSIC_ONLY','MUSIC_VIDEO','OPEN_TALK')),
  started_at timestamptz, ended_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.live_rooms ENABLE ROW LEVEL SECURITY;
GRANT SELECT ON public.live_rooms TO anon, authenticated;
GRANT INSERT, UPDATE, DELETE ON public.live_rooms TO authenticated;
GRANT ALL ON public.live_rooms TO service_role;
EXCEPTION WHEN OTHERS THEN RAISE NOTICE 'skip 374: %', SQLERRM; END $w374$;

DO $lr1$ BEGIN CREATE POLICY "Live rooms viewable by all" ON public.live_rooms FOR SELECT USING (true); EXCEPTION WHEN duplicate_object THEN NULL; END $lr1$;
DO $lr2$ BEGIN CREATE POLICY "Artist owner can insert own room" ON public.live_rooms FOR INSERT WITH CHECK (EXISTS (SELECT 1 FROM public.artists a WHERE a.id = artist_id AND a.user_id = auth.uid())); EXCEPTION WHEN duplicate_object THEN NULL; END $lr2$;
DO $lr3$ BEGIN CREATE POLICY "Artist owner can update own room" ON public.live_rooms FOR UPDATE USING (EXISTS (SELECT 1 FROM public.artists a WHERE a.id = artist_id AND a.user_id = auth.uid())); EXCEPTION WHEN duplicate_object THEN NULL; END $lr3$;
DO $lr4$ BEGIN CREATE POLICY "Artist owner can delete own room" ON public.live_rooms FOR DELETE USING (EXISTS (SELECT 1 FROM public.artists a WHERE a.id = artist_id AND a.user_id = auth.uid())); EXCEPTION WHEN duplicate_object THEN NULL; END $lr4$;

DO $w381$ BEGIN
CREATE TABLE IF NOT EXISTS public.live_stage_members (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  room_id uuid NOT NULL REFERENCES public.live_rooms(id) ON DELETE CASCADE,
  user_id uuid NOT NULL,
  role text NOT NULL DEFAULT 'LISTENER' CHECK (role IN ('LISTENER','WAITING_SPEAKER','SPEAKER','VIDEO_SPEAKER','CO_HOST','HOST')),
  mic_enabled boolean NOT NULL DEFAULT false,
  cam_enabled boolean NOT NULL DEFAULT false,
  request_message text,
  expires_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(room_id, user_id)
);
ALTER TABLE public.live_stage_members ENABLE ROW LEVEL SECURITY;
GRANT SELECT ON public.live_stage_members TO anon, authenticated;
GRANT INSERT, UPDATE, DELETE ON public.live_stage_members TO authenticated;
GRANT ALL ON public.live_stage_members TO service_role;
EXCEPTION WHEN OTHERS THEN RAISE NOTICE 'skip 381: %', SQLERRM; END $w381$;

DO $sm1$ BEGIN CREATE POLICY "Stage members viewable by all" ON public.live_stage_members FOR SELECT USING (true); EXCEPTION WHEN duplicate_object THEN NULL; END $sm1$;
DO $sm2$ BEGIN CREATE POLICY "User can join as self or host can add" ON public.live_stage_members FOR INSERT WITH CHECK (user_id = auth.uid() OR EXISTS (SELECT 1 FROM public.live_rooms r JOIN public.artists a ON a.id = r.artist_id WHERE r.id = room_id AND a.user_id = auth.uid())); EXCEPTION WHEN duplicate_object THEN NULL; END $sm2$;
DO $sm3$ BEGIN CREATE POLICY "User can update self or host can update any" ON public.live_stage_members FOR UPDATE USING (user_id = auth.uid() OR EXISTS (SELECT 1 FROM public.live_rooms r JOIN public.artists a ON a.id = r.artist_id WHERE r.id = room_id AND a.user_id = auth.uid())); EXCEPTION WHEN duplicate_object THEN NULL; END $sm3$;
DO $sm4$ BEGIN CREATE POLICY "User can delete self or host can delete any" ON public.live_stage_members FOR DELETE USING (user_id = auth.uid() OR EXISTS (SELECT 1 FROM public.live_rooms r JOIN public.artists a ON a.id = r.artist_id WHERE r.id = room_id AND a.user_id = auth.uid())); EXCEPTION WHEN duplicate_object THEN NULL; END $sm4$;

-- site_settings
DO $w398$ BEGIN
CREATE TABLE IF NOT EXISTS public.site_settings (
  id text PRIMARY KEY,
  logo_url text,
  updated_at timestamptz NOT NULL DEFAULT now()
);
INSERT INTO public.site_settings (id) VALUES ('default') ON CONFLICT DO NOTHING;
ALTER TABLE public.site_settings ENABLE ROW LEVEL SECURITY;
GRANT SELECT ON public.site_settings TO anon, authenticated;
GRANT INSERT, UPDATE ON public.site_settings TO authenticated;
GRANT ALL ON public.site_settings TO service_role;
EXCEPTION WHEN OTHERS THEN RAISE NOTICE 'skip 398: %', SQLERRM; END $w398$;

DO $ss1$ BEGIN CREATE POLICY "Site settings readable by everyone" ON public.site_settings FOR SELECT USING (true); EXCEPTION WHEN duplicate_object THEN NULL; END $ss1$;
DO $ss2$ BEGIN CREATE POLICY "Admins update site settings" ON public.site_settings FOR UPDATE TO authenticated USING (public.has_role(auth.uid(), 'admin')); EXCEPTION WHEN duplicate_object THEN NULL; END $ss2$;

-- ===== Supplementary schemas =====
DO $sup1$ BEGIN
CREATE TABLE IF NOT EXISTS public.track_events (
  id BIGSERIAL PRIMARY KEY,
  track_id UUID NOT NULL REFERENCES public.tracks(id) ON DELETE CASCADE,
  artist_id UUID NOT NULL REFERENCES public.artists(id) ON DELETE CASCADE,
  user_id UUID NULL,
  event_type TEXT NOT NULL CHECK (event_type IN ('play','like','unlike')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.track_events ENABLE ROW LEVEL SECURITY;
GRANT SELECT, INSERT ON public.track_events TO authenticated;
GRANT INSERT ON public.track_events TO anon;
GRANT ALL ON public.track_events TO service_role;
GRANT USAGE ON SEQUENCE public.track_events_id_seq TO anon, authenticated;
EXCEPTION WHEN OTHERS THEN RAISE NOTICE 'skip sup1: %', SQLERRM; END $sup1$;

DO $sup3$ BEGIN CREATE POLICY "Anyone insert track events" ON public.track_events FOR INSERT WITH CHECK (event_type IN ('play','like','unlike') AND (user_id IS NULL OR auth.uid() = user_id)); EXCEPTION WHEN duplicate_object THEN NULL; END $sup3$;
DO $sup4$ BEGIN CREATE POLICY "Artist owners view own events" ON public.track_events FOR SELECT USING (EXISTS (SELECT 1 FROM public.artists a WHERE a.id = track_events.artist_id AND a.user_id = auth.uid())); EXCEPTION WHEN duplicate_object THEN NULL; END $sup4$;

DO $sup5$ BEGIN
CREATE TABLE IF NOT EXISTS public.track_comment_likes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  comment_id uuid NOT NULL REFERENCES public.track_comments(id) ON DELETE CASCADE,
  user_id uuid NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (comment_id, user_id)
);
ALTER TABLE public.track_comment_likes ENABLE ROW LEVEL SECURITY;
GRANT SELECT ON public.track_comment_likes TO anon, authenticated;
GRANT INSERT, DELETE ON public.track_comment_likes TO authenticated;
GRANT ALL ON public.track_comment_likes TO service_role;
EXCEPTION WHEN OTHERS THEN RAISE NOTICE 'skip sup5: %', SQLERRM; END $sup5$;

DO $sup6$ BEGIN CREATE POLICY "Comment likes viewable" ON public.track_comment_likes FOR SELECT USING (true); EXCEPTION WHEN duplicate_object THEN NULL; END $sup6$;
DO $sup7$ BEGIN CREATE POLICY "Users like comments" ON public.track_comment_likes FOR INSERT WITH CHECK (auth.uid() = user_id); EXCEPTION WHEN duplicate_object THEN NULL; END $sup7$;
DO $sup8$ BEGIN CREATE POLICY "Users unlike own comment likes" ON public.track_comment_likes FOR DELETE USING (auth.uid() = user_id); EXCEPTION WHEN duplicate_object THEN NULL; END $sup8$;

-- Missing columns
DO $sup9$ BEGIN ALTER TABLE public.track_comments ADD COLUMN IF NOT EXISTS author_name TEXT; EXCEPTION WHEN OTHERS THEN NULL; END $sup9$;
DO $sup10$ BEGIN ALTER TABLE public.purchases ADD COLUMN IF NOT EXISTS flw_payment_link TEXT; EXCEPTION WHEN OTHERS THEN NULL; END $sup10$;
DO $sup11$ BEGIN ALTER TABLE public.track_reposts ADD COLUMN IF NOT EXISTS id UUID DEFAULT gen_random_uuid(); EXCEPTION WHEN OTHERS THEN NULL; END $sup11$;
DO $sup13$ BEGIN ALTER TABLE public.audio_access_logs ADD COLUMN IF NOT EXISTS ip TEXT; EXCEPTION WHEN OTHERS THEN NULL; END $sup13$;

-- get_user_fan_tier
DO $sup12$ BEGIN
CREATE OR REPLACE FUNCTION public.get_user_fan_tier(_user_id uuid, _artist_id uuid)
RETURNS TEXT LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT CASE
    WHEN EXISTS (SELECT 1 FROM public.artist_followers WHERE user_id = _user_id AND artist_id = _artist_id AND created_at < now() - interval '90 days') THEN 'super'
    WHEN EXISTS (SELECT 1 FROM public.artist_followers WHERE user_id = _user_id AND artist_id = _artist_id) THEN 'new'
    ELSE 'none'
  END;
$$;
GRANT EXECUTE ON FUNCTION public.get_user_fan_tier(uuid, uuid) TO anon, authenticated;
EXCEPTION WHEN OTHERS THEN RAISE NOTICE 'skip sup12: %', SQLERRM; END $sup12$;