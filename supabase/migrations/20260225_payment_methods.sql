-- payment_methods table
CREATE TABLE public.payment_methods (
  id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id             UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  label               TEXT,
  brand               TEXT NOT NULL,
  last4               CHAR(4) NOT NULL,
  exp_month           SMALLINT NOT NULL,
  exp_year            SMALLINT NOT NULL,
  encrypted_card_data TEXT NOT NULL,
  is_active           BOOLEAN NOT NULL DEFAULT true,
  is_default          BOOLEAN NOT NULL DEFAULT false,
  created_at          TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at          TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- One default card per user
CREATE UNIQUE INDEX idx_payment_methods_one_default
  ON public.payment_methods (user_id)
  WHERE is_default = true AND is_active = true;

-- Active cards lookup
CREATE INDEX idx_payment_methods_active
  ON public.payment_methods (user_id)
  WHERE is_active = true;

-- Reuse update_updated_at() trigger from 20260224_chat_persistence.sql
CREATE TRIGGER payment_methods_updated_at
  BEFORE UPDATE ON public.payment_methods
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at();

-- RLS
ALTER TABLE public.payment_methods ENABLE ROW LEVEL SECURITY;

CREATE POLICY payment_methods_select ON public.payment_methods
  FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY payment_methods_insert ON public.payment_methods
  FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY payment_methods_update ON public.payment_methods
  FOR UPDATE USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY payment_methods_delete ON public.payment_methods
  FOR DELETE USING (auth.uid() = user_id);
