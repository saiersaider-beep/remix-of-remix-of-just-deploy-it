
-- 1. Table
CREATE TABLE public.artist_creation_fees (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL UNIQUE,
  status text NOT NULL DEFAULT 'pending', -- pending | paid
  amount_xof integer NOT NULL DEFAULT 3000,
  method text, -- 'flutterwave' | 'wallet'
  flw_tx_ref text,
  flw_tx_id text,
  flw_payment_link text,
  paid_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_artist_creation_fees_tx_ref ON public.artist_creation_fees(flw_tx_ref);

-- 2. Grants
GRANT SELECT ON public.artist_creation_fees TO authenticated;
GRANT ALL ON public.artist_creation_fees TO service_role;

-- 3. RLS
ALTER TABLE public.artist_creation_fees ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users view own artist fee"
ON public.artist_creation_fees FOR SELECT
USING (auth.uid() = user_id OR public.has_role(auth.uid(), 'admin'::app_role));

-- 4. Wallet payment RPC (atomic)
CREATE OR REPLACE FUNCTION public.pay_artist_fee_with_wallet(_user_id uuid)
RETURNS TABLE(new_balance_xof integer, amount_xof integer)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  fee_amount integer := 3000;
  cur integer;
  nb integer;
  existing_status text;
BEGIN
  -- Already paid?
  SELECT status INTO existing_status FROM public.artist_creation_fees
    WHERE user_id = _user_id FOR UPDATE;
  IF existing_status = 'paid' THEN
    RAISE EXCEPTION 'ALREADY_PAID';
  END IF;

  -- Check balance
  SELECT balance_xof INTO cur FROM public.wallet_balances
    WHERE user_id = _user_id FOR UPDATE;
  IF cur IS NULL OR cur < fee_amount THEN
    RAISE EXCEPTION 'INSUFFICIENT_WALLET';
  END IF;

  -- Debit wallet
  UPDATE public.wallet_balances
    SET balance_xof = balance_xof - fee_amount, updated_at = now()
    WHERE user_id = _user_id
    RETURNING balance_xof INTO nb;

  INSERT INTO public.wallet_transactions(user_id, kind, status, amount_xof, description, settled_at)
    VALUES (_user_id, 'debit_artist_fee', 'succeeded', fee_amount, 'Frais de création profil artiste', now());

  -- Mark fee paid (upsert)
  INSERT INTO public.artist_creation_fees(user_id, status, amount_xof, method, paid_at)
    VALUES (_user_id, 'paid', fee_amount, 'wallet', now())
    ON CONFLICT (user_id) DO UPDATE
      SET status = 'paid', method = 'wallet', paid_at = now(), updated_at = now();

  new_balance_xof := nb;
  amount_xof := fee_amount;
  RETURN NEXT;
END $$;
