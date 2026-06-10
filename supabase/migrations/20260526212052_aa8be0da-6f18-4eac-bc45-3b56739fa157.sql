-- artist_verification_requests
DO $b1$ BEGIN
CREATE TABLE IF NOT EXISTS public.artist_verification_requests (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  artist_id uuid,
  stage_name text,
  legal_name text,
  documents jsonb,
  status text NOT NULL DEFAULT 'pending',
  notes text,
  reviewed_by uuid,
  reviewed_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.artist_verification_requests ENABLE ROW LEVEL SECURITY;
GRANT SELECT, INSERT, UPDATE ON public.artist_verification_requests TO authenticated;
GRANT ALL ON public.artist_verification_requests TO service_role;
EXCEPTION WHEN OTHERS THEN NULL; END $b1$;

DO $b1p$ BEGIN CREATE POLICY "Users view own verif" ON public.artist_verification_requests FOR SELECT USING (auth.uid() = user_id OR public.has_role(auth.uid(),'admin')); EXCEPTION WHEN duplicate_object THEN NULL; END $b1p$;
DO $b1q$ BEGIN CREATE POLICY "Users create verif" ON public.artist_verification_requests FOR INSERT WITH CHECK (auth.uid() = user_id); EXCEPTION WHEN duplicate_object THEN NULL; END $b1q$;
DO $b1r$ BEGIN CREATE POLICY "Admins update verif" ON public.artist_verification_requests FOR UPDATE USING (public.has_role(auth.uid(),'admin')); EXCEPTION WHEN duplicate_object THEN NULL; END $b1r$;

-- payment_events
DO $b2$ BEGIN
CREATE TABLE IF NOT EXISTS public.payment_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  provider text NOT NULL,
  flw_tx_id text,
  flw_tx_ref text,
  cinetpay_tx_id text,
  event_type text,
  status text,
  amount integer,
  currency text,
  payload jsonb,
  processed boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.payment_events ENABLE ROW LEVEL SECURITY;
GRANT ALL ON public.payment_events TO service_role;
EXCEPTION WHEN OTHERS THEN NULL; END $b2$;

-- wallet_topup_requests
DO $b3$ BEGIN
CREATE TABLE IF NOT EXISTS public.wallet_topup_requests (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  amount_xof integer NOT NULL,
  method text NOT NULL DEFAULT 'bank',
  status text NOT NULL DEFAULT 'pending',
  reference text,
  receipt_url text,
  notes text,
  reviewed_by uuid,
  reviewed_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.wallet_topup_requests ENABLE ROW LEVEL SECURITY;
GRANT SELECT, INSERT ON public.wallet_topup_requests TO authenticated;
GRANT ALL ON public.wallet_topup_requests TO service_role;
EXCEPTION WHEN OTHERS THEN NULL; END $b3$;

DO $b3p$ BEGIN CREATE POLICY "User view own topup" ON public.wallet_topup_requests FOR SELECT USING (auth.uid() = user_id OR public.has_role(auth.uid(),'admin')); EXCEPTION WHEN duplicate_object THEN NULL; END $b3p$;
DO $b3q$ BEGIN CREATE POLICY "User create own topup" ON public.wallet_topup_requests FOR INSERT WITH CHECK (auth.uid() = user_id); EXCEPTION WHEN duplicate_object THEN NULL; END $b3q$;

-- withdrawal_requests
DO $b4$ BEGIN
CREATE TABLE IF NOT EXISTS public.withdrawal_requests (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  artist_id uuid,
  amount_xof integer NOT NULL,
  method text NOT NULL DEFAULT 'mobile_money',
  destination jsonb,
  status text NOT NULL DEFAULT 'pending',
  notes text,
  reviewed_by uuid,
  reviewed_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.withdrawal_requests ENABLE ROW LEVEL SECURITY;
GRANT SELECT, INSERT ON public.withdrawal_requests TO authenticated;
GRANT ALL ON public.withdrawal_requests TO service_role;
EXCEPTION WHEN OTHERS THEN NULL; END $b4$;

DO $b4p$ BEGIN CREATE POLICY "User view own withdraw" ON public.withdrawal_requests FOR SELECT USING (auth.uid() = user_id OR public.has_role(auth.uid(),'admin')); EXCEPTION WHEN duplicate_object THEN NULL; END $b4p$;
DO $b4q$ BEGIN CREATE POLICY "User create own withdraw" ON public.withdrawal_requests FOR INSERT WITH CHECK (auth.uid() = user_id); EXCEPTION WHEN duplicate_object THEN NULL; END $b4q$;

-- copyright_claims
DO $b5$ BEGIN
CREATE TABLE IF NOT EXISTS public.copyright_claims (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  reporter_id uuid,
  track_id uuid,
  reason text,
  evidence_url text,
  status text NOT NULL DEFAULT 'open',
  resolved_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.copyright_claims ENABLE ROW LEVEL SECURITY;
GRANT SELECT, INSERT ON public.copyright_claims TO authenticated;
GRANT ALL ON public.copyright_claims TO service_role;
EXCEPTION WHEN OTHERS THEN NULL; END $b5$;
DO $b5p$ BEGIN CREATE POLICY "Admins view copyright" ON public.copyright_claims FOR SELECT USING (public.has_role(auth.uid(),'admin') OR auth.uid() = reporter_id); EXCEPTION WHEN duplicate_object THEN NULL; END $b5p$;
DO $b5q$ BEGIN CREATE POLICY "Users create copyright" ON public.copyright_claims FOR INSERT WITH CHECK (auth.uid() = reporter_id); EXCEPTION WHEN duplicate_object THEN NULL; END $b5q$;

-- bank_receipts
DO $b6$ BEGIN
CREATE TABLE IF NOT EXISTS public.bank_receipts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  amount_xof integer,
  receipt_url text,
  status text NOT NULL DEFAULT 'pending',
  reviewed_by uuid,
  reviewed_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.bank_receipts ENABLE ROW LEVEL SECURITY;
GRANT SELECT, INSERT ON public.bank_receipts TO authenticated;
GRANT ALL ON public.bank_receipts TO service_role;
EXCEPTION WHEN OTHERS THEN NULL; END $b6$;
DO $b6p$ BEGIN CREATE POLICY "User view own receipt" ON public.bank_receipts FOR SELECT USING (auth.uid() = user_id OR public.has_role(auth.uid(),'admin')); EXCEPTION WHEN duplicate_object THEN NULL; END $b6p$;
DO $b6q$ BEGIN CREATE POLICY "User upload receipt" ON public.bank_receipts FOR INSERT WITH CHECK (auth.uid() = user_id); EXCEPTION WHEN duplicate_object THEN NULL; END $b6q$;

-- banned_ips
DO $b7$ BEGIN
CREATE TABLE IF NOT EXISTS public.banned_ips (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  ip text NOT NULL UNIQUE,
  reason text,
  banned_by uuid,
  created_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.banned_ips ENABLE ROW LEVEL SECURITY;
GRANT ALL ON public.banned_ips TO service_role;
GRANT SELECT ON public.banned_ips TO authenticated;
EXCEPTION WHEN OTHERS THEN NULL; END $b7$;
DO $b7p$ BEGIN CREATE POLICY "Admins manage ips" ON public.banned_ips FOR ALL USING (public.has_role(auth.uid(),'admin')); EXCEPTION WHEN duplicate_object THEN NULL; END $b7p$;

-- faq_items
DO $b8$ BEGIN
CREATE TABLE IF NOT EXISTS public.faq_items (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  question text NOT NULL,
  answer text NOT NULL,
  category text,
  sort_order integer NOT NULL DEFAULT 0,
  is_published boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.faq_items ENABLE ROW LEVEL SECURITY;
GRANT SELECT ON public.faq_items TO anon, authenticated;
GRANT ALL ON public.faq_items TO service_role;
EXCEPTION WHEN OTHERS THEN NULL; END $b8$;
DO $b8p$ BEGIN CREATE POLICY "FAQ public read" ON public.faq_items FOR SELECT USING (is_published); EXCEPTION WHEN duplicate_object THEN NULL; END $b8p$;
DO $b8q$ BEGIN CREATE POLICY "Admins manage FAQ" ON public.faq_items FOR ALL USING (public.has_role(auth.uid(),'admin')); EXCEPTION WHEN duplicate_object THEN NULL; END $b8q$;

-- branding
DO $b9$ BEGIN
CREATE TABLE IF NOT EXISTS public.branding (
  id text PRIMARY KEY DEFAULT 'default',
  logo_url text,
  favicon_url text,
  primary_color text,
  app_name text,
  updated_at timestamptz NOT NULL DEFAULT now()
);
INSERT INTO public.branding (id) VALUES ('default') ON CONFLICT DO NOTHING;
ALTER TABLE public.branding ENABLE ROW LEVEL SECURITY;
GRANT SELECT ON public.branding TO anon, authenticated;
GRANT UPDATE ON public.branding TO authenticated;
GRANT ALL ON public.branding TO service_role;
EXCEPTION WHEN OTHERS THEN NULL; END $b9$;
DO $b9p$ BEGIN CREATE POLICY "Branding public read" ON public.branding FOR SELECT USING (true); EXCEPTION WHEN duplicate_object THEN NULL; END $b9p$;
DO $b9q$ BEGIN CREATE POLICY "Admins update branding" ON public.branding FOR UPDATE USING (public.has_role(auth.uid(),'admin')); EXCEPTION WHEN duplicate_object THEN NULL; END $b9q$;

-- reports
DO $b10$ BEGIN
CREATE TABLE IF NOT EXISTS public.reports (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  reporter_id uuid,
  target_type text NOT NULL,
  target_id uuid,
  reason text,
  status text NOT NULL DEFAULT 'open',
  reviewed_by uuid,
  reviewed_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.reports ENABLE ROW LEVEL SECURITY;
GRANT SELECT, INSERT ON public.reports TO authenticated;
GRANT ALL ON public.reports TO service_role;
EXCEPTION WHEN OTHERS THEN NULL; END $b10$;
DO $b10p$ BEGIN CREATE POLICY "Reporters view own" ON public.reports FOR SELECT USING (auth.uid() = reporter_id OR public.has_role(auth.uid(),'admin')); EXCEPTION WHEN duplicate_object THEN NULL; END $b10p$;
DO $b10q$ BEGIN CREATE POLICY "Users create reports" ON public.reports FOR INSERT WITH CHECK (auth.uid() = reporter_id); EXCEPTION WHEN duplicate_object THEN NULL; END $b10q$;

-- artist_daily_stats
DO $b11$ BEGIN
CREATE TABLE IF NOT EXISTS public.artist_daily_stats (
  artist_id UUID NOT NULL,
  day DATE NOT NULL,
  plays INTEGER NOT NULL DEFAULT 0,
  likes INTEGER NOT NULL DEFAULT 0,
  followers_gained INTEGER NOT NULL DEFAULT 0,
  followers_lost INTEGER NOT NULL DEFAULT 0,
  PRIMARY KEY (artist_id, day)
);
ALTER TABLE public.artist_daily_stats ENABLE ROW LEVEL SECURITY;
GRANT SELECT ON public.artist_daily_stats TO authenticated;
GRANT ALL ON public.artist_daily_stats TO service_role;
EXCEPTION WHEN OTHERS THEN NULL; END $b11$;
DO $b11p$ BEGIN CREATE POLICY "Artists view own stats" ON public.artist_daily_stats FOR SELECT USING (EXISTS (SELECT 1 FROM public.artists a WHERE a.id = artist_id AND a.user_id = auth.uid())); EXCEPTION WHEN duplicate_object THEN NULL; END $b11p$;

-- Stub RPC functions used by client code
DO $f1$ BEGIN
CREATE OR REPLACE FUNCTION public.approve_artist_verification(_req_id uuid) RETURNS void
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF NOT public.has_role(auth.uid(),'admin') THEN RAISE EXCEPTION 'Forbidden'; END IF;
  UPDATE public.artist_verification_requests SET status='approved', reviewed_by=auth.uid(), reviewed_at=now() WHERE id=_req_id;
END $$;
GRANT EXECUTE ON FUNCTION public.approve_artist_verification(uuid) TO authenticated;
EXCEPTION WHEN OTHERS THEN NULL; END $f1$;

DO $f2$ BEGIN
CREATE OR REPLACE FUNCTION public.reject_artist_verification(_req_id uuid, _reason text DEFAULT NULL) RETURNS void
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF NOT public.has_role(auth.uid(),'admin') THEN RAISE EXCEPTION 'Forbidden'; END IF;
  UPDATE public.artist_verification_requests SET status='rejected', notes=_reason, reviewed_by=auth.uid(), reviewed_at=now() WHERE id=_req_id;
END $$;
GRANT EXECUTE ON FUNCTION public.reject_artist_verification(uuid, text) TO authenticated;
EXCEPTION WHEN OTHERS THEN NULL; END $f2$;

DO $f3$ BEGIN
CREATE OR REPLACE FUNCTION public.approve_wallet_topup(_req_id uuid) RETURNS void
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE r RECORD;
BEGIN
  IF NOT public.has_role(auth.uid(),'admin') THEN RAISE EXCEPTION 'Forbidden'; END IF;
  SELECT * INTO r FROM public.wallet_topup_requests WHERE id=_req_id AND status='pending' FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'not_found'; END IF;
  INSERT INTO public.wallet_balances(user_id, balance_xof) VALUES (r.user_id, r.amount_xof)
    ON CONFLICT (user_id) DO UPDATE SET balance_xof = wallet_balances.balance_xof + r.amount_xof, updated_at = now();
  UPDATE public.wallet_topup_requests SET status='approved', reviewed_by=auth.uid(), reviewed_at=now() WHERE id=_req_id;
END $$;
GRANT EXECUTE ON FUNCTION public.approve_wallet_topup(uuid) TO authenticated;
EXCEPTION WHEN OTHERS THEN NULL; END $f3$;

DO $f4$ BEGIN
CREATE OR REPLACE FUNCTION public.reject_wallet_topup(_req_id uuid, _reason text DEFAULT NULL) RETURNS void
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF NOT public.has_role(auth.uid(),'admin') THEN RAISE EXCEPTION 'Forbidden'; END IF;
  UPDATE public.wallet_topup_requests SET status='rejected', notes=_reason, reviewed_by=auth.uid(), reviewed_at=now() WHERE id=_req_id;
END $$;
GRANT EXECUTE ON FUNCTION public.reject_wallet_topup(uuid, text) TO authenticated;
EXCEPTION WHEN OTHERS THEN NULL; END $f4$;

DO $f5$ BEGIN
CREATE OR REPLACE FUNCTION public.dev_credit_wallet(_user_id uuid, _amount integer) RETURNS integer
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE nb integer;
BEGIN
  INSERT INTO public.wallet_balances(user_id, balance_xof) VALUES (_user_id, _amount)
    ON CONFLICT (user_id) DO UPDATE SET balance_xof = wallet_balances.balance_xof + _amount, updated_at=now()
    RETURNING balance_xof INTO nb;
  RETURN nb;
END $$;
EXCEPTION WHEN OTHERS THEN NULL; END $f5$;

DO $f6$ BEGIN
CREATE OR REPLACE FUNCTION public.get_artist_balance(_artist_id uuid) RETURNS integer
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT COALESCE(SUM(amount), 0)::integer FROM public.purchases
  WHERE artist_id = _artist_id AND status='succeeded';
$$;
GRANT EXECUTE ON FUNCTION public.get_artist_balance(uuid) TO authenticated;
EXCEPTION WHEN OTHERS THEN NULL; END $f6$;

DO $f7$ BEGIN
CREATE OR REPLACE FUNCTION public.get_track_purchase_count(_track_id uuid) RETURNS integer
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT COUNT(*)::integer FROM public.purchases WHERE track_id = _track_id AND status='succeeded';
$$;
GRANT EXECUTE ON FUNCTION public.get_track_purchase_count(uuid) TO anon, authenticated;
EXCEPTION WHEN OTHERS THEN NULL; END $f7$;

DO $f8$ BEGIN
CREATE OR REPLACE FUNCTION public.wallet_apply_settled(_user_id uuid, _amount integer, _ref text DEFAULT NULL) RETURNS integer
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE nb integer;
BEGIN
  INSERT INTO public.wallet_balances(user_id, balance_xof) VALUES (_user_id, _amount)
    ON CONFLICT (user_id) DO UPDATE SET balance_xof = wallet_balances.balance_xof + _amount, updated_at=now()
    RETURNING balance_xof INTO nb;
  INSERT INTO public.wallet_transactions(user_id, kind, status, amount_xof, reference, settled_at)
    VALUES (_user_id, 'credit', 'succeeded', _amount, _ref, now());
  RETURN nb;
END $$;
EXCEPTION WHEN OTHERS THEN NULL; END $f8$;

-- get_or_create_conversation (in case missing)
DO $f9$ BEGIN
CREATE OR REPLACE FUNCTION public.get_or_create_conversation(_other_user_id uuid) RETURNS uuid
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE me uuid := auth.uid(); u1 uuid; u2 uuid; cid uuid;
BEGIN
  IF me IS NULL OR _other_user_id IS NULL OR me = _other_user_id THEN RAISE EXCEPTION 'invalid'; END IF;
  IF me < _other_user_id THEN u1 := me; u2 := _other_user_id; ELSE u1 := _other_user_id; u2 := me; END IF;
  SELECT id INTO cid FROM public.conversations WHERE user1_id = u1 AND user2_id = u2;
  IF cid IS NULL THEN INSERT INTO public.conversations(user1_id, user2_id) VALUES (u1, u2) RETURNING id INTO cid; END IF;
  RETURN cid;
END $$;
GRANT EXECUTE ON FUNCTION public.get_or_create_conversation(uuid) TO authenticated;
EXCEPTION WHEN OTHERS THEN NULL; END $f9$;

-- track_comments: parent_comment_id alias
DO $b12$ BEGIN ALTER TABLE public.track_comments ADD COLUMN IF NOT EXISTS parent_comment_id uuid; EXCEPTION WHEN OTHERS THEN NULL; END $b12$;