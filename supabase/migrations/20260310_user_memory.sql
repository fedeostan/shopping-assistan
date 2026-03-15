-- Migration: user_memory — persistent cross-session episodic memory
-- Idempotent: safe to run regardless of current state.

-- ─────────────────────────────────────────────
-- user_memory
-- ─────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS public.user_memory (
  id                      UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id                 UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  type                    TEXT NOT NULL CHECK (type IN ('fact', 'preference', 'goal', 'context')),
  content                 TEXT NOT NULL,
  source_conversation_id  UUID REFERENCES public.conversations(id) ON DELETE SET NULL,
  confidence              FLOAT NOT NULL DEFAULT 1.0,
  created_at              TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at              TIMESTAMPTZ NOT NULL DEFAULT now(),
  expires_at              TIMESTAMPTZ
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_user_memory_user ON public.user_memory (user_id);
CREATE INDEX IF NOT EXISTS idx_user_memory_user_type ON public.user_memory (user_id, type);
CREATE INDEX IF NOT EXISTS idx_user_memory_user_updated ON public.user_memory (user_id, updated_at DESC);

-- Trigger (reuse existing update_updated_at function)
DROP TRIGGER IF EXISTS user_memory_updated_at ON public.user_memory;
CREATE TRIGGER user_memory_updated_at
  BEFORE UPDATE ON public.user_memory
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at();

-- RLS
ALTER TABLE public.user_memory ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS user_memory_select ON public.user_memory;
CREATE POLICY user_memory_select ON public.user_memory
  FOR SELECT USING (auth.uid() = user_id);

DROP POLICY IF EXISTS user_memory_insert ON public.user_memory;
CREATE POLICY user_memory_insert ON public.user_memory
  FOR INSERT WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS user_memory_update ON public.user_memory;
CREATE POLICY user_memory_update ON public.user_memory
  FOR UPDATE USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS user_memory_delete ON public.user_memory;
CREATE POLICY user_memory_delete ON public.user_memory
  FOR DELETE USING (auth.uid() = user_id);
