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

ALTER TABLE public.track_comments ALTER COLUMN body DROP NOT NULL;

CREATE TABLE IF NOT EXISTS public.artist_creation_fees (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL UNIQUE,
  status text NOT NULL DEFAULT 'pending',
  amount_xof integer NOT NULL DEFAULT 3000,
  method text,
  flw_tx_ref text,
  flw_tx_id text,
  flw_payment_link text,
  paid_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_artist_creation_fees_tx_ref ON public.artist_creation_fees(flw_tx_ref);

GRANT SELECT ON public.artist_creation_fees TO authenticated;
GRANT ALL ON public.artist_creation_fees TO service_role;

ALTER TABLE public.artist_creation_fees ENABLE ROW LEVEL SECURITY;

DO $aaa$ BEGIN
CREATE POLICY "Users view own artist fee"
ON public.artist_creation_fees FOR SELECT
USING (auth.uid() = user_id OR public.has_role(auth.uid(), 'admin'::app_role));
EXCEPTION WHEN duplicate_object THEN NULL; END $aaa$;

CREATE OR REPLACE FUNCTION public.pay_artist_fee_with_wallet(_user_id uuid)
RETURNS TABLE(new_balance_xof integer, amount_xof integer)
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  fee_amount integer := 3000;
  cur integer; nb integer; existing_status text;
BEGIN
  SELECT status INTO existing_status FROM public.artist_creation_fees WHERE user_id = _user_id FOR UPDATE;
  IF existing_status = 'paid' THEN RAISE EXCEPTION 'ALREADY_PAID'; END IF;
  SELECT balance_xof INTO cur FROM public.wallet_balances WHERE user_id = _user_id FOR UPDATE;
  IF cur IS NULL OR cur < fee_amount THEN RAISE EXCEPTION 'INSUFFICIENT_WALLET'; END IF;
  UPDATE public.wallet_balances SET balance_xof = balance_xof - fee_amount, updated_at = now()
    WHERE user_id = _user_id RETURNING balance_xof INTO nb;
  INSERT INTO public.wallet_transactions(user_id, kind, status, amount_xof, description, settled_at)
    VALUES (_user_id, 'debit_artist_fee', 'succeeded', fee_amount, 'Frais de creation profil artiste', now());
  INSERT INTO public.artist_creation_fees(user_id, status, amount_xof, method, paid_at)
    VALUES (_user_id, 'paid', fee_amount, 'wallet', now())
    ON CONFLICT (user_id) DO UPDATE SET status = 'paid', method = 'wallet', paid_at = now(), updated_at = now();
  new_balance_xof := nb;
  amount_xof := fee_amount;
  RETURN NEXT;
END $$;