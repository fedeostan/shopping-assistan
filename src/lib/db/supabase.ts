import { createClient, SupabaseClient } from "@supabase/supabase-js";

// Client-side Supabase client (uses anon key, respects RLS)
let _supabase: SupabaseClient | null = null;
export function getSupabase() {
  if (!_supabase) {
    _supabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
    );
  }
  return _supabase;
}

// Server-side Supabase client (uses service role key, bypasses RLS)
export function createServiceClient() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  );
}
