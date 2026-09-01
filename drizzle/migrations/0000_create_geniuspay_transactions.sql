CREATE TABLE public.geniuspay_transactions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  purpose text NOT NULL,
  target_id uuid,
  transaction_id text NOT NULL UNIQUE,
  reference text,
  amount integer NOT NULL DEFAULT 0,
  currency text NOT NULL DEFAULT 'XOF',
  status text NOT NULL DEFAULT 'pending',
  description text,
  payment_url text,
  provider_status text,
  raw jsonb,
  settled_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX geniuspay_transactions_user_idx ON public.geniuspay_transactions (user_id);
CREATE INDEX geniuspay_transactions_created_idx ON public.geniuspay_transactions (created_at DESC);

GRANT SELECT ON public.geniuspay_transactions TO authenticated;
GRANT ALL ON public.geniuspay_transactions TO service_role;

ALTER TABLE public.geniuspay_transactions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users read own geniuspay transactions"
ON public.geniuspay_transactions FOR SELECT TO authenticated
USING (auth.uid() = user_id);

CREATE POLICY "Admins read all geniuspay transactions"
ON public.geniuspay_transactions FOR SELECT TO authenticated
USING (public.has_role(auth.uid(), 'admin'));

CREATE TRIGGER geniuspay_transactions_set_updated_at
BEFORE UPDATE ON public.geniuspay_transactions
FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();