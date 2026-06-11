
ALTER TABLE public.mm_settings
  ADD COLUMN IF NOT EXISTS paygate_api_key text DEFAULT '',
  ADD COLUMN IF NOT EXISTS paygate_enabled boolean NOT NULL DEFAULT false;

ALTER TABLE public.mm_payments
  ADD COLUMN IF NOT EXISTS provider text NOT NULL DEFAULT 'manual',
  ADD COLUMN IF NOT EXISTS identifier text,
  ADD COLUMN IF NOT EXISTS tx_reference text;

CREATE UNIQUE INDEX IF NOT EXISTS mm_payments_identifier_uniq
  ON public.mm_payments(identifier) WHERE identifier IS NOT NULL;

CREATE OR REPLACE FUNCTION public.mm_apply_paygate_callback(
  _identifier text,
  _tx_reference text,
  _payment_reference text,
  _amount integer,
  _phone text,
  _payment_method text
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE p RECORD; plan_days int; new_end timestamptz;
BEGIN
  SELECT * INTO p FROM public.mm_payments WHERE identifier = _identifier FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'payment_not_found'; END IF;
  IF p.applied THEN RETURN; END IF;

  IF p.purpose IN ('pro-basic','pro-premium','pro-vip') THEN
    SELECT CASE p.purpose
      WHEN 'pro-basic' THEN plan_basic_days
      WHEN 'pro-premium' THEN plan_premium_days
      WHEN 'pro-vip' THEN plan_vip_days END
    INTO plan_days FROM public.mm_settings WHERE id = true;
    new_end := now() + (plan_days || ' days')::interval;
    INSERT INTO public.subscriptions(user_id, plan, status, amount, currency, provider, transaction_id, current_period_start, current_period_end)
    VALUES (p.user_id, p.purpose, 'active', p.amount_xof, 'XOF', 'paygate', _tx_reference, now(), new_end);
    UPDATE public.artists SET pro_badge = 'pro' WHERE user_id = p.user_id;

  ELSIF p.purpose = 'track' AND p.target_id IS NOT NULL THEN
    INSERT INTO public.track_access(user_id, track_id, source)
      VALUES (p.user_id, p.target_id, 'purchase') ON CONFLICT DO NOTHING;
    INSERT INTO public.purchases(user_id, track_id, status, provider, amount, currency, paid_at, transaction_id)
      VALUES (p.user_id, p.target_id, 'succeeded', 'paygate', p.amount_xof, 'XOF', now(), _tx_reference);

  ELSIF p.purpose = 'wallet' THEN
    INSERT INTO public.wallet_balances(user_id, balance_xof) VALUES (p.user_id, p.amount_xof)
      ON CONFLICT (user_id) DO UPDATE SET balance_xof = wallet_balances.balance_xof + p.amount_xof, updated_at = now();
    INSERT INTO public.wallet_transactions(user_id, kind, status, amount_xof, reference, settled_at)
      VALUES (p.user_id, 'credit', 'succeeded', p.amount_xof, _tx_reference, now());
  END IF;

  UPDATE public.mm_payments
    SET status='approved', applied=true, reviewed_at=now(),
        tx_reference=_tx_reference,
        transaction_ref=COALESCE(transaction_ref, _payment_reference),
        phone=COALESCE(NULLIF(phone,''), _phone)
    WHERE id = p.id;
END $$;
