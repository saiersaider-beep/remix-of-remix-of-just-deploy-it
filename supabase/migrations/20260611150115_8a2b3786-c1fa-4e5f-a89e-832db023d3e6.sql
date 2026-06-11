
CREATE TABLE public.mm_settings (
  id boolean PRIMARY KEY DEFAULT true CHECK (id),
  flooz_number text NOT NULL DEFAULT '97283628',
  yas_number text NOT NULL DEFAULT '91138304',
  plan_basic_xof int NOT NULL DEFAULT 1000,
  plan_premium_xof int NOT NULL DEFAULT 3000,
  plan_vip_xof int NOT NULL DEFAULT 5000,
  plan_basic_days int NOT NULL DEFAULT 30,
  plan_premium_days int NOT NULL DEFAULT 30,
  plan_vip_days int NOT NULL DEFAULT 30,
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT ON public.mm_settings TO anon, authenticated;
GRANT ALL ON public.mm_settings TO service_role;
ALTER TABLE public.mm_settings ENABLE ROW LEVEL SECURITY;
CREATE POLICY "mm_settings read all" ON public.mm_settings FOR SELECT USING (true);
CREATE POLICY "mm_settings admin write" ON public.mm_settings FOR ALL TO authenticated
  USING (public.has_role(auth.uid(),'admin')) WITH CHECK (public.has_role(auth.uid(),'admin'));
INSERT INTO public.mm_settings (id) VALUES (true) ON CONFLICT DO NOTHING;

CREATE TABLE public.mm_payments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  purpose text NOT NULL,
  target_id uuid,
  amount_xof int NOT NULL CHECK (amount_xof > 0),
  operator text NOT NULL CHECK (operator IN ('flooz','yas')),
  merchant_number text NOT NULL,
  full_name text NOT NULL,
  phone text NOT NULL,
  transaction_ref text,
  screenshot_url text,
  status text NOT NULL DEFAULT 'pending' CHECK (status IN ('pending','approved','rejected')),
  admin_notes text,
  reviewed_by uuid,
  reviewed_at timestamptz,
  applied boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX mm_payments_user_idx ON public.mm_payments(user_id, created_at DESC);
CREATE INDEX mm_payments_status_idx ON public.mm_payments(status, created_at DESC);

GRANT SELECT, INSERT, UPDATE ON public.mm_payments TO authenticated;
GRANT ALL ON public.mm_payments TO service_role;
ALTER TABLE public.mm_payments ENABLE ROW LEVEL SECURITY;

CREATE POLICY "mm_payments owner select" ON public.mm_payments FOR SELECT TO authenticated
  USING (auth.uid() = user_id OR public.has_role(auth.uid(),'admin'));
CREATE POLICY "mm_payments owner insert" ON public.mm_payments FOR INSERT TO authenticated
  WITH CHECK (auth.uid() = user_id AND status = 'pending');
CREATE POLICY "mm_payments admin update" ON public.mm_payments FOR UPDATE TO authenticated
  USING (public.has_role(auth.uid(),'admin')) WITH CHECK (public.has_role(auth.uid(),'admin'));

CREATE TRIGGER mm_payments_updated_at BEFORE UPDATE ON public.mm_payments
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();
CREATE TRIGGER mm_settings_updated_at BEFORE UPDATE ON public.mm_settings
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

CREATE POLICY "mm-receipts owner upload" ON storage.objects FOR INSERT TO authenticated
  WITH CHECK (bucket_id = 'mm-receipts' AND (storage.foldername(name))[1] = auth.uid()::text);
CREATE POLICY "mm-receipts owner read" ON storage.objects FOR SELECT TO authenticated
  USING (bucket_id = 'mm-receipts' AND ((storage.foldername(name))[1] = auth.uid()::text OR public.has_role(auth.uid(),'admin')));

CREATE OR REPLACE FUNCTION public.mm_approve_payment(_payment_id uuid)
RETURNS void
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE p RECORD; plan_days int; new_end timestamptz;
BEGIN
  IF NOT public.has_role(auth.uid(),'admin') THEN RAISE EXCEPTION 'Forbidden'; END IF;
  SELECT * INTO p FROM public.mm_payments WHERE id = _payment_id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'not_found'; END IF;
  IF p.applied THEN RAISE EXCEPTION 'already_applied'; END IF;

  IF p.purpose IN ('pro-basic','pro-premium','pro-vip') THEN
    SELECT CASE p.purpose
      WHEN 'pro-basic' THEN plan_basic_days
      WHEN 'pro-premium' THEN plan_premium_days
      WHEN 'pro-vip' THEN plan_vip_days END
    INTO plan_days FROM public.mm_settings WHERE id=true;
    new_end := now() + (plan_days || ' days')::interval;
    INSERT INTO public.subscriptions(user_id, plan, status, amount, currency, provider, transaction_id, current_period_start, current_period_end)
    VALUES (p.user_id, p.purpose, 'active', p.amount_xof, 'XOF', 'mobile_money', 'mm-'||p.id::text, now(), new_end);
    UPDATE public.artists SET pro_badge = 'pro' WHERE user_id = p.user_id;

  ELSIF p.purpose = 'track' AND p.target_id IS NOT NULL THEN
    INSERT INTO public.track_access(user_id, track_id, source)
      VALUES (p.user_id, p.target_id, 'purchase')
      ON CONFLICT DO NOTHING;
    INSERT INTO public.purchases(user_id, track_id, status, provider, amount, currency, paid_at, transaction_id)
      VALUES (p.user_id, p.target_id, 'succeeded', 'mobile_money', p.amount_xof, 'XOF', now(), 'mm-'||p.id::text);

  ELSIF p.purpose = 'wallet' THEN
    INSERT INTO public.wallet_balances(user_id, balance_xof) VALUES (p.user_id, p.amount_xof)
      ON CONFLICT (user_id) DO UPDATE SET balance_xof = wallet_balances.balance_xof + p.amount_xof, updated_at = now();
    INSERT INTO public.wallet_transactions(user_id, kind, status, amount_xof, reference, settled_at)
      VALUES (p.user_id, 'credit', 'succeeded', p.amount_xof, 'mm-'||p.id::text, now());
  END IF;

  UPDATE public.mm_payments SET status='approved', applied=true, reviewed_by=auth.uid(), reviewed_at=now()
    WHERE id=_payment_id;
END $$;

CREATE OR REPLACE FUNCTION public.mm_reject_payment(_payment_id uuid, _reason text DEFAULT NULL)
RETURNS void
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF NOT public.has_role(auth.uid(),'admin') THEN RAISE EXCEPTION 'Forbidden'; END IF;
  UPDATE public.mm_payments SET status='rejected', admin_notes=_reason, reviewed_by=auth.uid(), reviewed_at=now()
    WHERE id=_payment_id AND status='pending';
END $$;
