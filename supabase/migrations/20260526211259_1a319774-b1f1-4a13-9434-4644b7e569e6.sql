DO $w71$ BEGIN
CREATE TABLE public.user_roles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  role app_role NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (user_id, role)
);
EXCEPTION WHEN OTHERS THEN RAISE NOTICE 'skip 71: %', SQLERRM; END $w71$;

DO $w71b$ BEGIN
GRANT SELECT ON public.user_roles TO authenticated;
GRANT ALL ON public.user_roles TO service_role;
EXCEPTION WHEN OTHERS THEN RAISE NOTICE 'skip 71b: %', SQLERRM; END $w71b$;

DO $w72$ BEGIN
ALTER TABLE public.user_roles ENABLE ROW LEVEL SECURITY;
EXCEPTION WHEN OTHERS THEN RAISE NOTICE 'skip 72: %', SQLERRM; END $w72$;

DO $w73$ BEGIN
CREATE OR REPLACE FUNCTION public.has_role(_user_id UUID, _role app_role)
RETURNS BOOLEAN LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $hr$
  SELECT EXISTS (SELECT 1 FROM public.user_roles WHERE user_id = _user_id AND role = _role)
$hr$;
EXCEPTION WHEN OTHERS THEN RAISE NOTICE 'skip 73: %', SQLERRM; END $w73$;

DO $w74$ BEGIN
CREATE POLICY "User roles visible to self" ON public.user_roles FOR SELECT USING (auth.uid() = user_id OR public.has_role(auth.uid(), 'admin'));
EXCEPTION WHEN OTHERS THEN RAISE NOTICE 'skip 74: %', SQLERRM; END $w74$;

DO $w75$ BEGIN
CREATE POLICY "Admins manage roles" ON public.user_roles FOR ALL USING (public.has_role(auth.uid(), 'admin'));
EXCEPTION WHEN OTHERS THEN RAISE NOTICE 'skip 75: %', SQLERRM; END $w75$;

DO $w83a$ BEGIN
ALTER TABLE public.tracks ADD COLUMN IF NOT EXISTS lyrics TEXT;
ALTER TABLE public.tracks ADD COLUMN IF NOT EXISTS pricing_model TEXT NOT NULL DEFAULT 'free';
ALTER TABLE public.tracks ADD COLUMN IF NOT EXISTS price_amount INTEGER NOT NULL DEFAULT 0;
ALTER TABLE public.tracks ADD COLUMN IF NOT EXISTS price_currency TEXT NOT NULL DEFAULT 'XOF';
ALTER TABLE public.tracks ADD COLUMN IF NOT EXISTS preview_seconds INTEGER NOT NULL DEFAULT 30;
EXCEPTION WHEN OTHERS THEN RAISE NOTICE 'skip 83a: %', SQLERRM; END $w83a$;

DO $w101$ BEGIN
CREATE TABLE public.announcements (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  title TEXT NOT NULL,
  body TEXT,
  level TEXT NOT NULL DEFAULT 'info',
  active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT ON public.announcements TO anon, authenticated;
GRANT ALL ON public.announcements TO service_role;
EXCEPTION WHEN OTHERS THEN RAISE NOTICE 'skip 101: %', SQLERRM; END $w101$;

DO $w102$ BEGIN
ALTER TABLE public.announcements ENABLE ROW LEVEL SECURITY;
EXCEPTION WHEN OTHERS THEN RAISE NOTICE 'skip 102: %', SQLERRM; END $w102$;

DO $w103$ BEGIN
CREATE POLICY "Active announcements public" ON public.announcements FOR SELECT USING (active);
EXCEPTION WHEN OTHERS THEN RAISE NOTICE 'skip 103: %', SQLERRM; END $w103$;

DO $w104$ BEGIN
CREATE POLICY "Admins manage announcements" ON public.announcements FOR ALL USING (public.has_role(auth.uid(),'admin'));
EXCEPTION WHEN OTHERS THEN RAISE NOTICE 'skip 104: %', SQLERRM; END $w104$;

DO $w105$ BEGIN
CREATE TABLE public.cms_pages (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  slug TEXT NOT NULL UNIQUE,
  title TEXT NOT NULL,
  body TEXT,
  published BOOLEAN NOT NULL DEFAULT true,
  in_footer BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT ON public.cms_pages TO anon, authenticated;
GRANT ALL ON public.cms_pages TO service_role;
EXCEPTION WHEN OTHERS THEN RAISE NOTICE 'skip 105: %', SQLERRM; END $w105$;

DO $w106$ BEGIN
ALTER TABLE public.cms_pages ENABLE ROW LEVEL SECURITY;
EXCEPTION WHEN OTHERS THEN RAISE NOTICE 'skip 106: %', SQLERRM; END $w106$;

DO $w107$ BEGIN
CREATE POLICY "Published pages public" ON public.cms_pages FOR SELECT USING (published);
EXCEPTION WHEN OTHERS THEN RAISE NOTICE 'skip 107: %', SQLERRM; END $w107$;

DO $w108$ BEGIN
CREATE POLICY "Admins manage cms pages" ON public.cms_pages FOR ALL USING (public.has_role(auth.uid(),'admin'));
EXCEPTION WHEN OTHERS THEN RAISE NOTICE 'skip 108: %', SQLERRM; END $w108$;

DO $w110$ BEGIN
CREATE OR REPLACE FUNCTION public.fetch_trending_tracks(_days INTEGER DEFAULT 7, _limit INTEGER DEFAULT 10)
RETURNS SETOF public.tracks LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $ft$
  SELECT * FROM public.tracks
  WHERE is_published = true
    AND released_at >= now() - (_days || ' days')::interval
  ORDER BY plays DESC, likes DESC, released_at DESC
  LIMIT _limit;
$ft$;
EXCEPTION WHEN OTHERS THEN RAISE NOTICE 'skip 110: %', SQLERRM; END $w110$;

DO $w111$ BEGIN
INSERT INTO storage.buckets (id, name, public) VALUES
  ('avatars','avatars',true)
ON CONFLICT (id) DO NOTHING;
EXCEPTION WHEN OTHERS THEN RAISE NOTICE 'skip 111: %', SQLERRM; END $w111$;

DO $w115$ BEGIN
CREATE POLICY "Public read avatars" ON storage.objects FOR SELECT USING (bucket_id = 'avatars');
EXCEPTION WHEN OTHERS THEN RAISE NOTICE 'skip 115: %', SQLERRM; END $w115$;

DO $w131$ BEGIN
CREATE TABLE public.payment_settings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  provider TEXT NOT NULL DEFAULT 'cinetpay',
  api_key TEXT,
  secret_key TEXT,
  site_id TEXT,
  api_url TEXT NOT NULL DEFAULT 'https://api-checkout.cinetpay.com/v2/payment',
  currency TEXT NOT NULL DEFAULT 'XOF',
  mode TEXT NOT NULL DEFAULT 'test',
  enabled BOOLEAN NOT NULL DEFAULT false,
  notify_url_override TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT ALL ON public.payment_settings TO service_role;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.payment_settings TO authenticated;
EXCEPTION WHEN OTHERS THEN RAISE NOTICE 'skip 131: %', SQLERRM; END $w131$;

DO $w132$ BEGIN
ALTER TABLE public.payment_settings ENABLE ROW LEVEL SECURITY;
EXCEPTION WHEN OTHERS THEN RAISE NOTICE 'skip 132: %', SQLERRM; END $w132$;

DO $w133$ BEGIN
CREATE POLICY "Admins read payment settings" ON public.payment_settings
  FOR SELECT TO authenticated USING (public.has_role(auth.uid(), 'admin'));
EXCEPTION WHEN OTHERS THEN RAISE NOTICE 'skip 133: %', SQLERRM; END $w133$;

DO $w134$ BEGIN
CREATE POLICY "Admins write payment settings" ON public.payment_settings
  FOR ALL TO authenticated USING (public.has_role(auth.uid(), 'admin'))
  WITH CHECK (public.has_role(auth.uid(), 'admin'));
EXCEPTION WHEN OTHERS THEN RAISE NOTICE 'skip 134: %', SQLERRM; END $w134$;

DO $w135$ BEGIN
CREATE TRIGGER trg_payment_settings_updated BEFORE UPDATE ON public.payment_settings
FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();
EXCEPTION WHEN OTHERS THEN RAISE NOTICE 'skip 135: %', SQLERRM; END $w135$;

DO $w136$ BEGIN
INSERT INTO public.payment_settings (provider, enabled) VALUES ('cinetpay', false);
EXCEPTION WHEN OTHERS THEN RAISE NOTICE 'skip 136: %', SQLERRM; END $w136$;

DO $w137$ BEGIN
CREATE TABLE public.subscriptions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL,
  plan TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'pending',
  amount INTEGER,
  currency TEXT,
  provider TEXT NOT NULL DEFAULT 'cinetpay',
  transaction_id TEXT UNIQUE,
  flw_tx_ref TEXT,
  payment_url TEXT,
  current_period_start TIMESTAMPTZ,
  current_period_end TIMESTAMPTZ,
  cancelled_at TIMESTAMPTZ,
  raw_response JSONB,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.subscriptions TO authenticated;
GRANT ALL ON public.subscriptions TO service_role;
EXCEPTION WHEN OTHERS THEN RAISE NOTICE 'skip 137: %', SQLERRM; END $w137$;

DO $w138$ BEGIN
ALTER TABLE public.subscriptions ENABLE ROW LEVEL SECURITY;
EXCEPTION WHEN OTHERS THEN RAISE NOTICE 'skip 138: %', SQLERRM; END $w138$;

DO $w139$ BEGIN
CREATE POLICY "Users read own subscriptions" ON public.subscriptions
  FOR SELECT TO authenticated USING (auth.uid() = user_id OR public.has_role(auth.uid(), 'admin'));
EXCEPTION WHEN OTHERS THEN RAISE NOTICE 'skip 139: %', SQLERRM; END $w139$;

DO $w140$ BEGIN
CREATE POLICY "Admins manage subscriptions" ON public.subscriptions
  FOR ALL TO authenticated USING (public.has_role(auth.uid(), 'admin'))
  WITH CHECK (public.has_role(auth.uid(), 'admin'));
EXCEPTION WHEN OTHERS THEN RAISE NOTICE 'skip 140: %', SQLERRM; END $w140$;

DO $w143$ BEGIN
CREATE TRIGGER trg_subscriptions_updated BEFORE UPDATE ON public.subscriptions
FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();
EXCEPTION WHEN OTHERS THEN RAISE NOTICE 'skip 143: %', SQLERRM; END $w143$;

DO $w144$ BEGIN
CREATE TABLE public.purchases (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL,
  track_id UUID,
  album_id UUID,
  amount INTEGER,
  currency TEXT,
  status TEXT NOT NULL DEFAULT 'pending',
  provider TEXT NOT NULL DEFAULT 'cinetpay',
  transaction_id TEXT UNIQUE,
  flw_tx_ref TEXT,
  payment_url TEXT,
  paid_at TIMESTAMPTZ,
  raw_response JSONB,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.purchases TO authenticated;
GRANT ALL ON public.purchases TO service_role;
EXCEPTION WHEN OTHERS THEN RAISE NOTICE 'skip 144: %', SQLERRM; END $w144$;

DO $w145$ BEGIN
ALTER TABLE public.purchases ENABLE ROW LEVEL SECURITY;
EXCEPTION WHEN OTHERS THEN RAISE NOTICE 'skip 145: %', SQLERRM; END $w145$;

DO $w146$ BEGIN
CREATE POLICY "Users read own purchases" ON public.purchases
  FOR SELECT TO authenticated USING (auth.uid() = user_id OR public.has_role(auth.uid(), 'admin'));
EXCEPTION WHEN OTHERS THEN RAISE NOTICE 'skip 146: %', SQLERRM; END $w146$;

DO $w147$ BEGIN
CREATE POLICY "Admins manage purchases" ON public.purchases
  FOR ALL TO authenticated USING (public.has_role(auth.uid(), 'admin'))
  WITH CHECK (public.has_role(auth.uid(), 'admin'));
EXCEPTION WHEN OTHERS THEN RAISE NOTICE 'skip 147: %', SQLERRM; END $w147$;

DO $w150$ BEGIN
CREATE TRIGGER trg_purchases_updated BEFORE UPDATE ON public.purchases
FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();
EXCEPTION WHEN OTHERS THEN RAISE NOTICE 'skip 150: %', SQLERRM; END $w150$;

DO $w151$ BEGIN
ALTER TABLE public.artists ADD COLUMN IF NOT EXISTS pro_badge TEXT NOT NULL DEFAULT 'none';
EXCEPTION WHEN OTHERS THEN RAISE NOTICE 'skip 151: %', SQLERRM; END $w151$;

DO $w152$ BEGIN
CREATE TABLE IF NOT EXISTS public.user_points (
  user_id uuid PRIMARY KEY,
  points integer NOT NULL DEFAULT 0,
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT ON public.user_points TO authenticated;
GRANT ALL ON public.user_points TO service_role;
EXCEPTION WHEN OTHERS THEN RAISE NOTICE 'skip 152: %', SQLERRM; END $w152$;

DO $w153$ BEGIN
ALTER TABLE public.user_points ENABLE ROW LEVEL SECURITY;
EXCEPTION WHEN OTHERS THEN RAISE NOTICE 'skip 153: %', SQLERRM; END $w153$;

DO $w155$ BEGIN
CREATE POLICY "Users read own points" ON public.user_points
  FOR SELECT USING (auth.uid() = user_id OR public.has_role(auth.uid(), 'admin'));
EXCEPTION WHEN OTHERS THEN RAISE NOTICE 'skip 155: %', SQLERRM; END $w155$;

DO $w156$ BEGIN
CREATE TABLE IF NOT EXISTS public.point_transactions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  kind text NOT NULL,
  points integer NOT NULL,
  song_id uuid,
  reference text,
  metadata jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT ON public.point_transactions TO authenticated;
GRANT ALL ON public.point_transactions TO service_role;
EXCEPTION WHEN OTHERS THEN RAISE NOTICE 'skip 156: %', SQLERRM; END $w156$;

DO $w157$ BEGIN
CREATE INDEX IF NOT EXISTS pt_user_created_idx ON public.point_transactions(user_id, created_at DESC);
EXCEPTION WHEN OTHERS THEN RAISE NOTICE 'skip 157: %', SQLERRM; END $w157$;

DO $w158$ BEGIN
ALTER TABLE public.point_transactions ENABLE ROW LEVEL SECURITY;
EXCEPTION WHEN OTHERS THEN RAISE NOTICE 'skip 158: %', SQLERRM; END $w158$;

DO $w160$ BEGIN
CREATE POLICY "Users read own point tx" ON public.point_transactions
  FOR SELECT USING (auth.uid() = user_id OR public.has_role(auth.uid(), 'admin'));
EXCEPTION WHEN OTHERS THEN RAISE NOTICE 'skip 160: %', SQLERRM; END $w160$;

DO $w161$ BEGIN
CREATE TABLE IF NOT EXISTS public.wallet_balances (
  user_id uuid PRIMARY KEY,
  balance_xof integer NOT NULL DEFAULT 0,
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT ON public.wallet_balances TO authenticated;
GRANT ALL ON public.wallet_balances TO service_role;
EXCEPTION WHEN OTHERS THEN RAISE NOTICE 'skip 161: %', SQLERRM; END $w161$;

DO $w162$ BEGIN
ALTER TABLE public.wallet_balances ENABLE ROW LEVEL SECURITY;
EXCEPTION WHEN OTHERS THEN RAISE NOTICE 'skip 162: %', SQLERRM; END $w162$;

DO $w164$ BEGIN
CREATE POLICY "Users read own wallet" ON public.wallet_balances
  FOR SELECT USING (auth.uid() = user_id OR public.has_role(auth.uid(), 'admin'));
EXCEPTION WHEN OTHERS THEN RAISE NOTICE 'skip 164: %', SQLERRM; END $w164$;

DO $w165$ BEGIN
CREATE TABLE IF NOT EXISTS public.wallet_transactions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  kind text NOT NULL,
  status text NOT NULL DEFAULT 'pending',
  amount_xof integer NOT NULL,
  description text,
  reference text,
  metadata jsonb,
  flw_tx_ref text,
  created_at timestamptz NOT NULL DEFAULT now(),
  settled_at timestamptz
);
GRANT SELECT ON public.wallet_transactions TO authenticated;
GRANT ALL ON public.wallet_transactions TO service_role;
EXCEPTION WHEN OTHERS THEN RAISE NOTICE 'skip 165: %', SQLERRM; END $w165$;

DO $w166$ BEGIN
CREATE INDEX IF NOT EXISTS wt_user_created_idx ON public.wallet_transactions(user_id, created_at DESC);
EXCEPTION WHEN OTHERS THEN RAISE NOTICE 'skip 166: %', SQLERRM; END $w166$;

DO $w167$ BEGIN
ALTER TABLE public.wallet_transactions ENABLE ROW LEVEL SECURITY;
EXCEPTION WHEN OTHERS THEN RAISE NOTICE 'skip 167: %', SQLERRM; END $w167$;

DO $w169$ BEGIN
CREATE POLICY "Users read own wallet tx" ON public.wallet_transactions
  FOR SELECT USING (auth.uid() = user_id OR public.has_role(auth.uid(), 'admin'));
EXCEPTION WHEN OTHERS THEN RAISE NOTICE 'skip 169: %', SQLERRM; END $w169$;

DO $w187$ BEGIN
CREATE TABLE IF NOT EXISTS public.track_unlocks (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  track_id uuid NOT NULL,
  kind text NOT NULL,
  seconds_granted integer NOT NULL DEFAULT 60,
  source text NOT NULL,
  expires_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT ON public.track_unlocks TO authenticated;
GRANT ALL ON public.track_unlocks TO service_role;
EXCEPTION WHEN OTHERS THEN RAISE NOTICE 'skip 187: %', SQLERRM; END $w187$;

DO $w188$ BEGIN
CREATE INDEX IF NOT EXISTS tu_user_track_idx ON public.track_unlocks(user_id, track_id, created_at DESC);
EXCEPTION WHEN OTHERS THEN RAISE NOTICE 'skip 188: %', SQLERRM; END $w188$;

DO $w189$ BEGIN
ALTER TABLE public.track_unlocks ENABLE ROW LEVEL SECURITY;
EXCEPTION WHEN OTHERS THEN RAISE NOTICE 'skip 189: %', SQLERRM; END $w189$;

DO $w191$ BEGIN
CREATE POLICY "Users read own unlocks" ON public.track_unlocks
  FOR SELECT USING (auth.uid() = user_id OR public.has_role(auth.uid(), 'admin'));
EXCEPTION WHEN OTHERS THEN RAISE NOTICE 'skip 191: %', SQLERRM; END $w191$;

DO $w192$ BEGIN
CREATE OR REPLACE FUNCTION public.award_points(
  _user_id uuid, _kind text, _points integer, _song_id uuid DEFAULT NULL, _ref text DEFAULT NULL
) RETURNS integer
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $ap$
DECLARE new_bal integer;
BEGIN
  IF _points <= 0 THEN RAISE EXCEPTION 'points must be positive'; END IF;
  INSERT INTO public.user_points(user_id, points) VALUES (_user_id, _points)
    ON CONFLICT (user_id) DO UPDATE SET points = user_points.points + EXCLUDED.points, updated_at = now()
    RETURNING points INTO new_bal;
  INSERT INTO public.point_transactions(user_id, kind, points, song_id, reference)
    VALUES (_user_id, _kind, _points, _song_id, _ref);
  RETURN new_bal;
END $ap$;
EXCEPTION WHEN OTHERS THEN RAISE NOTICE 'skip 192: %', SQLERRM; END $w192$;

DO $w193$ BEGIN
CREATE OR REPLACE FUNCTION public.user_has_track_access(_user_id uuid, _track_id uuid)
RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $uh$
  SELECT
    EXISTS(SELECT 1 FROM public.tracks WHERE id = _track_id AND pricing_model = 'free')
    OR EXISTS(SELECT 1 FROM public.tracks t JOIN public.artists a ON a.id = t.artist_id
              WHERE t.id = _track_id AND a.user_id = _user_id)
    OR EXISTS(SELECT 1 FROM public.purchases p
              WHERE p.user_id = _user_id AND p.track_id = _track_id AND p.status = 'succeeded');
$uh$;
EXCEPTION WHEN OTHERS THEN RAISE NOTICE 'skip 193: %', SQLERRM; END $w193$;

DO $w194$ BEGIN
CREATE OR REPLACE FUNCTION public.spend_points_minute(_user_id uuid, _track_id uuid)
RETURNS TABLE(new_balance integer, points_used integer)
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $sp$
DECLARE cost integer := 55; cur integer; nb integer;
BEGIN
  SELECT points INTO cur FROM public.user_points WHERE user_id = _user_id FOR UPDATE;
  IF cur IS NULL OR cur < cost THEN RAISE EXCEPTION 'INSUFFICIENT_POINTS'; END IF;
  UPDATE public.user_points SET points = points - cost, updated_at = now()
    WHERE user_id = _user_id RETURNING points INTO nb;
  INSERT INTO public.point_transactions(user_id, kind, points, song_id)
    VALUES (_user_id, 'spend_minute', -cost, _track_id);
  INSERT INTO public.track_unlocks(user_id, track_id, kind, seconds_granted, source)
    VALUES (_user_id, _track_id, 'minute_pass', 60, 'points');
  new_balance := nb; points_used := cost; RETURN NEXT;
END $sp$;
EXCEPTION WHEN OTHERS THEN RAISE NOTICE 'skip 194: %', SQLERRM; END $w194$;

DO $w195$ BEGIN
CREATE OR REPLACE FUNCTION public.convert_points_to_wallet(_user_id uuid, _points integer)
RETURNS TABLE(new_points integer, new_balance_xof integer, credited_xof integer)
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $cp$
DECLARE cur_pts integer; xof integer; new_bal integer;
BEGIN
  IF _points < 20 OR (_points % 20) <> 0 THEN
    RAISE EXCEPTION 'points must be a multiple of 20 and >= 20';
  END IF;
  SELECT points INTO cur_pts FROM public.user_points WHERE user_id = _user_id FOR UPDATE;
  IF cur_pts IS NULL OR cur_pts < _points THEN RAISE EXCEPTION 'INSUFFICIENT_POINTS'; END IF;
  xof := (_points / 20) * 100;
  UPDATE public.user_points SET points = points - _points, updated_at = now()
    WHERE user_id = _user_id RETURNING points INTO new_points;
  INSERT INTO public.point_transactions(user_id, kind, points)
    VALUES (_user_id, 'convert_to_wallet', -_points);
  INSERT INTO public.wallet_balances(user_id, balance_xof) VALUES (_user_id, xof)
    ON CONFLICT (user_id) DO UPDATE SET balance_xof = wallet_balances.balance_xof + xof, updated_at = now()
    RETURNING balance_xof INTO new_bal;
  INSERT INTO public.wallet_transactions(user_id, kind, status, amount_xof, description, settled_at)
    VALUES (_user_id, 'convert_from_points', 'succeeded', xof, 'Conversion points to wallet', now());
  new_balance_xof := new_bal; credited_xof := xof; RETURN NEXT;
END $cp$;
EXCEPTION WHEN OTHERS THEN RAISE NOTICE 'skip 195: %', SQLERRM; END $w195$;

DO $w196$ BEGIN
CREATE OR REPLACE FUNCTION public.buy_track_with_wallet(_user_id uuid, _track_id uuid)
RETURNS TABLE(new_balance_xof integer, amount_xof integer)
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $bt$
DECLARE price integer; cur integer; nb integer;
BEGIN
  SELECT price_amount INTO price FROM public.tracks WHERE id = _track_id AND pricing_model = 'paid';
  IF price IS NULL OR price <= 0 THEN RAISE EXCEPTION 'TRACK_NOT_PAID'; END IF;
  SELECT balance_xof INTO cur FROM public.wallet_balances WHERE user_id = _user_id FOR UPDATE;
  IF cur IS NULL OR cur < price THEN RAISE EXCEPTION 'INSUFFICIENT_WALLET'; END IF;
  UPDATE public.wallet_balances SET balance_xof = balance_xof - price, updated_at = now()
    WHERE user_id = _user_id RETURNING balance_xof INTO nb;
  INSERT INTO public.wallet_transactions(user_id, kind, status, amount_xof, description, reference, settled_at)
    VALUES (_user_id, 'debit_purchase', 'succeeded', price, 'Achat morceau', _track_id::text, now());
  INSERT INTO public.purchases(user_id, track_id, status, provider, amount, currency, paid_at)
    VALUES (_user_id, _track_id, 'succeeded', 'wallet', price, 'XOF', now());
  new_balance_xof := nb; amount_xof := price; RETURN NEXT;
END $bt$;
EXCEPTION WHEN OTHERS THEN RAISE NOTICE 'skip 196: %', SQLERRM; END $w196$;

DO $w214$ BEGIN
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS last_seen_at timestamptz;
EXCEPTION WHEN OTHERS THEN RAISE NOTICE 'skip 214: %', SQLERRM; END $w214$;

DO $w215$ BEGIN
CREATE TABLE IF NOT EXISTS public.audio_access_logs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid,
  track_id uuid NOT NULL,
  artist_id uuid,
  access_type text NOT NULL,
  ip_address text,
  user_agent text,
  request_id text,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT ALL ON public.audio_access_logs TO service_role;
GRANT SELECT ON public.audio_access_logs TO authenticated;
EXCEPTION WHEN OTHERS THEN RAISE NOTICE 'skip 215: %', SQLERRM; END $w215$;

DO $w216$ BEGIN
ALTER TABLE public.audio_access_logs ENABLE ROW LEVEL SECURITY;
EXCEPTION WHEN OTHERS THEN RAISE NOTICE 'skip 216: %', SQLERRM; END $w216$;

DO $w217$ BEGIN
CREATE POLICY "Admins read audio access logs" ON public.audio_access_logs
  FOR SELECT TO authenticated USING (public.has_role(auth.uid(), 'admin'));
EXCEPTION WHEN OTHERS THEN RAISE NOTICE 'skip 217: %', SQLERRM; END $w217$;