CREATE TABLE public.geniuspay_transactions (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL,
  purpose TEXT NOT NULL,
  target_id UUID,
  transaction_id TEXT NOT NULL UNIQUE,
  reference TEXT,
  payment_url TEXT,
  amount INTEGER NOT NULL DEFAULT 0,
  currency TEXT NOT NULL DEFAULT 'XOF',
  status TEXT NOT NULL DEFAULT 'pending',
  provider_status TEXT,
  description TEXT,
  raw JSONB,
  settled_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX geniuspay_transactions_user_idx ON public.geniuspay_transactions (user_id, created_at DESC);
CREATE INDEX geniuspay_transactions_status_idx ON public.geniuspay_transactions (status);

GRANT SELECT ON public.geniuspay_transactions TO authenticated;
GRANT ALL ON public.geniuspay_transactions TO service_role;

ALTER TABLE public.geniuspay_transactions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view their own geniuspay transactions"
ON public.geniuspay_transactions FOR SELECT TO authenticated
USING (auth.uid() = user_id);

CREATE POLICY "Admins can view all geniuspay transactions"
ON public.geniuspay_transactions FOR SELECT TO authenticated
USING (public.has_role(auth.uid(), 'admin'));