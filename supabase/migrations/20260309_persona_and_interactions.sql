-- Migration: Reconcile user_personas, user_interactions, price_alerts
-- These tables may already exist from dashboard/initial schema.
-- This migration is idempotent: safe to run regardless of current state.

-- Enable pgvector for preference_vector
CREATE EXTENSION IF NOT EXISTS vector;

-- ─────────────────────────────────────────────
-- user_personas (exists with data — fix schema delta, ensure indexes/triggers/RLS)
-- ─────────────────────────────────────────────

-- Create table if it doesn't exist yet
CREATE TABLE IF NOT EXISTS public.user_personas (
  id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id             UUID NOT NULL UNIQUE REFERENCES public.users(id) ON DELETE CASCADE,
  persona             JSONB NOT NULL DEFAULT '{}'::jsonb,
  preference_vector   vector(1536),
  confidence_score    FLOAT NOT NULL DEFAULT 0.0,
  last_refreshed_at   TIMESTAMPTZ,
  created_at          TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at          TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Fix: backfill NULLs then enforce NOT NULL DEFAULT 0.0
UPDATE public.user_personas SET confidence_score = 0.0 WHERE confidence_score IS NULL;
ALTER TABLE public.user_personas ALTER COLUMN confidence_score SET DEFAULT 0.0;
ALTER TABLE public.user_personas ALTER COLUMN confidence_score SET NOT NULL;

-- Index
CREATE INDEX IF NOT EXISTS idx_user_personas_user ON public.user_personas (user_id);

-- Trigger (drop + create to ensure correct definition)
DROP TRIGGER IF EXISTS user_personas_updated_at ON public.user_personas;
CREATE TRIGGER user_personas_updated_at
  BEFORE UPDATE ON public.user_personas
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at();

-- RLS
ALTER TABLE public.user_personas ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS user_personas_select ON public.user_personas;
CREATE POLICY user_personas_select ON public.user_personas
  FOR SELECT USING (auth.uid() = user_id);

DROP POLICY IF EXISTS user_personas_insert ON public.user_personas;
CREATE POLICY user_personas_insert ON public.user_personas
  FOR INSERT WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS user_personas_update ON public.user_personas;
CREATE POLICY user_personas_update ON public.user_personas
  FOR UPDATE USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS user_personas_delete ON public.user_personas;
CREATE POLICY user_personas_delete ON public.user_personas
  FOR DELETE USING (auth.uid() = user_id);

-- ─────────────────────────────────────────────
-- user_interactions (exists with data — ensure indexes/RLS)
-- ─────────────────────────────────────────────

-- Create table if it doesn't exist yet
CREATE TABLE IF NOT EXISTS public.user_interactions (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id         UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  type            TEXT NOT NULL,
  payload         JSONB NOT NULL DEFAULT '{}'::jsonb,
  persona_signals JSONB,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_user_interactions_user ON public.user_interactions (user_id);
CREATE INDEX IF NOT EXISTS idx_user_interactions_type ON public.user_interactions (user_id, type);

-- RLS
ALTER TABLE public.user_interactions ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS user_interactions_select ON public.user_interactions;
CREATE POLICY user_interactions_select ON public.user_interactions
  FOR SELECT USING (auth.uid() = user_id);

DROP POLICY IF EXISTS user_interactions_insert ON public.user_interactions;
CREATE POLICY user_interactions_insert ON public.user_interactions
  FOR INSERT WITH CHECK (auth.uid() = user_id);

-- ─────────────────────────────────────────────
-- price_alerts (wrong schema, 0 rows — drop and recreate)
-- ─────────────────────────────────────────────

DROP TABLE IF EXISTS public.price_alerts CASCADE;

CREATE TABLE public.price_alerts (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id       UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  product_url   TEXT NOT NULL,
  target_price  NUMERIC(12, 2),
  current_price NUMERIC(12, 2),
  currency      TEXT NOT NULL DEFAULT 'USD',
  is_active     BOOLEAN NOT NULL DEFAULT true,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at    TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_price_alerts_user ON public.price_alerts (user_id);
CREATE INDEX idx_price_alerts_active ON public.price_alerts (user_id) WHERE is_active = true;

CREATE TRIGGER price_alerts_updated_at
  BEFORE UPDATE ON public.price_alerts
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at();

-- RLS
ALTER TABLE public.price_alerts ENABLE ROW LEVEL SECURITY;

CREATE POLICY price_alerts_select ON public.price_alerts
  FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY price_alerts_insert ON public.price_alerts
  FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY price_alerts_update ON public.price_alerts
  FOR UPDATE USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY price_alerts_delete ON public.price_alerts
  FOR DELETE USING (auth.uid() = user_id);
