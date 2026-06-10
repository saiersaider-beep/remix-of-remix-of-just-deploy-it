DO $mig_001$
BEGIN
CREATE TABLE public.profiles (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  first_name TEXT, last_name TEXT, display_name TEXT, avatar_url TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Profiles are viewable by everyone" ON public.profiles FOR SELECT USING (true);
CREATE POLICY "Users can insert own profile" ON public.profiles FOR INSERT WITH CHECK (auth.uid() = id);
CREATE POLICY "Users can update own profile" ON public.profiles FOR UPDATE USING (auth.uid() = id);
CREATE OR REPLACE FUNCTION public.set_updated_at() RETURNS TRIGGER LANGUAGE plpgsql SET search_path = public AS $f$ BEGIN NEW.updated_at = now(); RETURN NEW; END; $f$;
CREATE TRIGGER profiles_set_updated_at BEFORE UPDATE ON public.profiles FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();
CREATE OR REPLACE FUNCTION public.handle_new_user() RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $f$
BEGIN
  INSERT INTO public.profiles (id, first_name, last_name, display_name)
  VALUES (NEW.id, NEW.raw_user_meta_data ->> 'first_name', NEW.raw_user_meta_data ->> 'last_name',
    COALESCE(NULLIF(TRIM(CONCAT(NEW.raw_user_meta_data ->> 'first_name', ' ', NEW.raw_user_meta_data ->> 'last_name')), ''),
      split_part(NEW.email, '@', 1)));
  RETURN NEW;
END; $f$;
CREATE TRIGGER on_auth_user_created AFTER INSERT ON auth.users FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();
REVOKE EXECUTE ON FUNCTION public.set_updated_at() FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.handle_new_user() FROM PUBLIC, anon, authenticated;
EXCEPTION WHEN OTHERS THEN RAISE NOTICE 'skip mig1: %', SQLERRM; END $mig_001$;

DO $mig_004$ BEGIN
CREATE TABLE public.artists (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE UNIQUE,
  slug TEXT NOT NULL UNIQUE, name TEXT NOT NULL, bio TEXT,
  avatar_url TEXT, cover_url TEXT,
  verified BOOLEAN NOT NULL DEFAULT false,
  monthly_listeners INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(), updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX artists_slug_idx ON public.artists(slug);
ALTER TABLE public.artists ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Artists are viewable by everyone" ON public.artists FOR SELECT USING (true);
CREATE POLICY "Users can create their own artist profile" ON public.artists FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can update their own artist profile" ON public.artists FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY "Users can delete their own artist profile" ON public.artists FOR DELETE USING (auth.uid() = user_id);
CREATE TRIGGER artists_set_updated_at BEFORE UPDATE ON public.artists FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();
CREATE TABLE public.artist_followers (
  artist_id UUID NOT NULL REFERENCES public.artists(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  PRIMARY KEY (artist_id, user_id)
);
CREATE INDEX artist_followers_user_idx ON public.artist_followers(user_id);
ALTER TABLE public.artist_followers ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Followers are viewable by everyone" ON public.artist_followers FOR SELECT USING (true);
CREATE POLICY "Users can follow as themselves" ON public.artist_followers FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can unfollow themselves" ON public.artist_followers FOR DELETE USING (auth.uid() = user_id);
EXCEPTION WHEN OTHERS THEN RAISE NOTICE 'skip mig4: %', SQLERRM; END $mig_004$;

DO $mig_005$ BEGIN
CREATE TABLE public.notifications (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  actor_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  type TEXT NOT NULL, entity_type TEXT, entity_id UUID,
  message TEXT NOT NULL, read BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX notifications_user_idx ON public.notifications(user_id, created_at DESC);
ALTER TABLE public.notifications ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users view own notifications" ON public.notifications FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users update own notifications" ON public.notifications FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY "Users delete own notifications" ON public.notifications FOR DELETE USING (auth.uid() = user_id);
CREATE OR REPLACE FUNCTION public.notify_new_follower() RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $f$
DECLARE owner_id UUID; follower_name TEXT;
BEGIN
  SELECT user_id INTO owner_id FROM public.artists WHERE id = NEW.artist_id;
  IF owner_id IS NULL OR owner_id = NEW.user_id THEN RETURN NEW; END IF;
  SELECT COALESCE(raw_user_meta_data->>'first_name', email) INTO follower_name FROM auth.users WHERE id = NEW.user_id;
  INSERT INTO public.notifications (user_id, actor_id, type, entity_type, entity_id, message)
  VALUES (owner_id, NEW.user_id, 'follow', 'artist', NEW.artist_id, COALESCE(follower_name, 'Someone') || ' started following you');
  RETURN NEW;
END; $f$;
REVOKE EXECUTE ON FUNCTION public.notify_new_follower() FROM PUBLIC, anon, authenticated;
CREATE TRIGGER on_new_follower AFTER INSERT ON public.artist_followers FOR EACH ROW EXECUTE FUNCTION public.notify_new_follower();
CREATE TABLE public.tracks (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  artist_id UUID NOT NULL REFERENCES public.artists(id) ON DELETE CASCADE,
  title TEXT NOT NULL, slug TEXT NOT NULL, description TEXT, genre TEXT,
  audio_url TEXT NOT NULL, cover_url TEXT,
  duration_seconds INTEGER NOT NULL DEFAULT 0,
  plays INTEGER NOT NULL DEFAULT 0, likes INTEGER NOT NULL DEFAULT 0,
  is_published BOOLEAN NOT NULL DEFAULT true,
  released_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(artist_id, slug)
);
CREATE INDEX tracks_artist_idx ON public.tracks(artist_id, created_at DESC);
CREATE INDEX tracks_published_idx ON public.tracks(is_published, created_at DESC);
CREATE INDEX idx_tracks_artist_released ON public.tracks(artist_id, released_at DESC);
CREATE INDEX idx_tracks_artist_plays ON public.tracks(artist_id, plays DESC);
ALTER TABLE public.tracks ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Published tracks are viewable by everyone" ON public.tracks FOR SELECT USING (is_published OR EXISTS (SELECT 1 FROM public.artists a WHERE a.id = artist_id AND a.user_id = auth.uid()));
CREATE POLICY "Artists insert own tracks" ON public.tracks FOR INSERT WITH CHECK (EXISTS (SELECT 1 FROM public.artists a WHERE a.id = artist_id AND a.user_id = auth.uid()));
CREATE POLICY "Artists update own tracks" ON public.tracks FOR UPDATE USING (EXISTS (SELECT 1 FROM public.artists a WHERE a.id = artist_id AND a.user_id = auth.uid()));
CREATE POLICY "Artists delete own tracks" ON public.tracks FOR DELETE USING (EXISTS (SELECT 1 FROM public.artists a WHERE a.id = artist_id AND a.user_id = auth.uid()));
CREATE TRIGGER tracks_set_updated_at BEFORE UPDATE ON public.tracks FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();
INSERT INTO storage.buckets (id, name, public) VALUES ('audio', 'audio', true) ON CONFLICT (id) DO NOTHING;
INSERT INTO storage.buckets (id, name, public) VALUES ('covers', 'covers', true) ON CONFLICT (id) DO NOTHING;
CREATE POLICY "Users upload own audio" ON storage.objects FOR INSERT WITH CHECK (bucket_id = 'audio' AND auth.uid()::text = (storage.foldername(name))[1]);
CREATE POLICY "Users update own audio" ON storage.objects FOR UPDATE USING (bucket_id = 'audio' AND auth.uid()::text = (storage.foldername(name))[1]);
CREATE POLICY "Users delete own audio" ON storage.objects FOR DELETE USING (bucket_id = 'audio' AND auth.uid()::text = (storage.foldername(name))[1]);
CREATE POLICY "Users upload own covers" ON storage.objects FOR INSERT WITH CHECK (bucket_id = 'covers' AND auth.uid()::text = (storage.foldername(name))[1]);
CREATE POLICY "Users update own covers" ON storage.objects FOR UPDATE USING (bucket_id = 'covers' AND auth.uid()::text = (storage.foldername(name))[1]);
CREATE POLICY "Users delete own covers" ON storage.objects FOR DELETE USING (bucket_id = 'covers' AND auth.uid()::text = (storage.foldername(name))[1]);
EXCEPTION WHEN OTHERS THEN RAISE NOTICE 'skip mig5: %', SQLERRM; END $mig_005$;

DO $mig_007$ BEGIN
CREATE TABLE IF NOT EXISTS public.albums (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  artist_id UUID NOT NULL, title TEXT NOT NULL, slug TEXT NOT NULL UNIQUE,
  description TEXT, cover_url TEXT,
  released_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  plays INTEGER NOT NULL DEFAULT 0,
  is_published BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_albums_artist_plays ON public.albums(artist_id, plays DESC);
CREATE INDEX IF NOT EXISTS idx_albums_artist_released ON public.albums(artist_id, released_at DESC);
ALTER TABLE public.albums ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Published albums are viewable by everyone" ON public.albums FOR SELECT USING (is_published OR EXISTS (SELECT 1 FROM public.artists a WHERE a.id = albums.artist_id AND a.user_id = auth.uid()));
CREATE POLICY "Artists insert own albums" ON public.albums FOR INSERT WITH CHECK (EXISTS (SELECT 1 FROM public.artists a WHERE a.id = albums.artist_id AND a.user_id = auth.uid()));
CREATE POLICY "Artists update own albums" ON public.albums FOR UPDATE USING (EXISTS (SELECT 1 FROM public.artists a WHERE a.id = albums.artist_id AND a.user_id = auth.uid()));
CREATE POLICY "Artists delete own albums" ON public.albums FOR DELETE USING (EXISTS (SELECT 1 FROM public.artists a WHERE a.id = albums.artist_id AND a.user_id = auth.uid()));
CREATE TRIGGER albums_set_updated_at BEFORE UPDATE ON public.albums FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();
CREATE TABLE IF NOT EXISTS public.album_tracks (
  album_id UUID NOT NULL REFERENCES public.albums(id) ON DELETE CASCADE,
  track_id UUID NOT NULL REFERENCES public.tracks(id) ON DELETE CASCADE,
  position INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  PRIMARY KEY (album_id, track_id)
);
ALTER TABLE public.album_tracks ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Album tracks viewable by everyone" ON public.album_tracks FOR SELECT USING (true);
CREATE POLICY "Artists manage own album tracks" ON public.album_tracks FOR ALL USING (EXISTS (SELECT 1 FROM public.albums al JOIN public.artists ar ON ar.id = al.artist_id WHERE al.id = album_id AND ar.user_id = auth.uid())) WITH CHECK (EXISTS (SELECT 1 FROM public.albums al JOIN public.artists ar ON ar.id = al.artist_id WHERE al.id = album_id AND ar.user_id = auth.uid()));

CREATE TABLE IF NOT EXISTS public.playlists (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  title TEXT NOT NULL, slug TEXT, description TEXT, cover_url TEXT,
  is_public BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.playlists ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Public playlists are viewable by everyone" ON public.playlists FOR SELECT USING (is_public OR auth.uid() = user_id);
CREATE POLICY "Users create own playlists" ON public.playlists FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users update own playlists" ON public.playlists FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY "Users delete own playlists" ON public.playlists FOR DELETE USING (auth.uid() = user_id);
CREATE TRIGGER playlists_set_updated_at BEFORE UPDATE ON public.playlists FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

CREATE TABLE IF NOT EXISTS public.playlist_tracks (
  playlist_id UUID NOT NULL REFERENCES public.playlists(id) ON DELETE CASCADE,
  track_id UUID NOT NULL REFERENCES public.tracks(id) ON DELETE CASCADE,
  position INTEGER NOT NULL DEFAULT 0,
  added_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  PRIMARY KEY (playlist_id, track_id)
);
ALTER TABLE public.playlist_tracks ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Playlist tracks viewable if playlist viewable" ON public.playlist_tracks FOR SELECT USING (EXISTS (SELECT 1 FROM public.playlists p WHERE p.id = playlist_id AND (p.is_public OR p.user_id = auth.uid())));
CREATE POLICY "Owner manages playlist tracks" ON public.playlist_tracks FOR ALL USING (EXISTS (SELECT 1 FROM public.playlists p WHERE p.id = playlist_id AND p.user_id = auth.uid())) WITH CHECK (EXISTS (SELECT 1 FROM public.playlists p WHERE p.id = playlist_id AND p.user_id = auth.uid()));

CREATE TABLE IF NOT EXISTS public.track_likes (
  track_id UUID NOT NULL REFERENCES public.tracks(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  PRIMARY KEY (track_id, user_id)
);
ALTER TABLE public.track_likes ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Likes viewable by everyone" ON public.track_likes FOR SELECT USING (true);
CREATE POLICY "Users like as themselves" ON public.track_likes FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users unlike themselves" ON public.track_likes FOR DELETE USING (auth.uid() = user_id);

CREATE TABLE IF NOT EXISTS public.track_comments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  track_id UUID NOT NULL REFERENCES public.tracks(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  parent_id UUID REFERENCES public.track_comments(id) ON DELETE CASCADE,
  body TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS track_comments_track_idx ON public.track_comments(track_id, created_at DESC);
ALTER TABLE public.track_comments ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Comments viewable by everyone" ON public.track_comments FOR SELECT USING (true);
CREATE POLICY "Users comment as themselves" ON public.track_comments FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users update own comments" ON public.track_comments FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY "Users delete own comments" ON public.track_comments FOR DELETE USING (auth.uid() = user_id);
CREATE TRIGGER track_comments_set_updated_at BEFORE UPDATE ON public.track_comments FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

CREATE TABLE IF NOT EXISTS public.track_reposts (
  track_id UUID NOT NULL REFERENCES public.tracks(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  PRIMARY KEY (track_id, user_id)
);
ALTER TABLE public.track_reposts ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Reposts viewable by everyone" ON public.track_reposts FOR SELECT USING (true);
CREATE POLICY "Users repost as themselves" ON public.track_reposts FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users delete own reposts" ON public.track_reposts FOR DELETE USING (auth.uid() = user_id);
EXCEPTION WHEN OTHERS THEN RAISE NOTICE 'skip mig7: %', SQLERRM; END $mig_007$;