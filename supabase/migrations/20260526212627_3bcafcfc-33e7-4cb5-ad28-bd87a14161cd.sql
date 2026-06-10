
-- Add missing columns to align schema with code expectations

ALTER TABLE public.purchases ADD COLUMN IF NOT EXISTS flw_tx_id text;
ALTER TABLE public.subscriptions ADD COLUMN IF NOT EXISTS flw_tx_id text;

ALTER TABLE public.track_comments ADD COLUMN IF NOT EXISTS image_url text;

ALTER TABLE public.artist_daily_stats
  ADD COLUMN IF NOT EXISTS unlikes integer NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS comments integer NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS reposts integer NOT NULL DEFAULT 0;

ALTER TABLE public.artist_verification_requests
  ADD COLUMN IF NOT EXISTS display_name text,
  ADD COLUMN IF NOT EXISTS genre text,
  ADD COLUMN IF NOT EXISTS country text,
  ADD COLUMN IF NOT EXISTS social_links jsonb,
  ADD COLUMN IF NOT EXISTS reason text,
  ADD COLUMN IF NOT EXISTS rejection_reason text;

ALTER TABLE public.messages
  ADD COLUMN IF NOT EXISTS image_url text,
  ADD COLUMN IF NOT EXISTS audio_duration_ms integer;

ALTER TABLE public.track_reposts ADD COLUMN IF NOT EXISTS caption text;
UPDATE public.track_reposts SET id = gen_random_uuid() WHERE id IS NULL;
ALTER TABLE public.track_reposts ALTER COLUMN id SET NOT NULL;

UPDATE public.playlist_tracks SET id = gen_random_uuid() WHERE id IS NULL;
ALTER TABLE public.playlist_tracks ALTER COLUMN id SET NOT NULL;

UPDATE public.playlists SET slug = COALESCE(slug, id::text);
ALTER TABLE public.playlists ALTER COLUMN slug SET NOT NULL;

ALTER TABLE public.audio_access_logs ALTER COLUMN access_type DROP NOT NULL;

ALTER TABLE public.payment_events
  ADD COLUMN IF NOT EXISTS signature text,
  ADD COLUMN IF NOT EXISTS processed_at timestamptz,
  ADD COLUMN IF NOT EXISTS processing_error text;

-- Rename function params to match client calls
DROP FUNCTION IF EXISTS public.approve_artist_verification(uuid);
CREATE OR REPLACE FUNCTION public.approve_artist_verification(_request_id uuid)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF NOT public.has_role(auth.uid(),'admin') THEN RAISE EXCEPTION 'Forbidden'; END IF;
  UPDATE public.artist_verification_requests SET status='approved', reviewed_by=auth.uid(), reviewed_at=now() WHERE id=_request_id;
END $$;

DROP FUNCTION IF EXISTS public.reject_artist_verification(uuid, text);
CREATE OR REPLACE FUNCTION public.reject_artist_verification(_request_id uuid, _reason text DEFAULT NULL)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF NOT public.has_role(auth.uid(),'admin') THEN RAISE EXCEPTION 'Forbidden'; END IF;
  UPDATE public.artist_verification_requests SET status='rejected', rejection_reason=_reason, notes=_reason, reviewed_by=auth.uid(), reviewed_at=now() WHERE id=_request_id;
END $$;

-- fetch_trending_tracks: return shape expected by client
DROP FUNCTION IF EXISTS public.fetch_trending_tracks(integer, integer);
CREATE OR REPLACE FUNCTION public.fetch_trending_tracks(_days integer DEFAULT 7, _limit integer DEFAULT 10)
RETURNS TABLE(track_id uuid, recent_plays bigint)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT t.id AS track_id, t.plays::bigint AS recent_plays
  FROM public.tracks t
  WHERE t.is_published = true
    AND t.released_at >= now() - (_days || ' days')::interval
  ORDER BY t.plays DESC, t.likes DESC, t.released_at DESC
  LIMIT _limit;
$$;
