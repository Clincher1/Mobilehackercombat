import type { SupabaseClient } from '@supabase/supabase-js';

// Local demo only: never connect this prototype to any external database.
export function getSupabaseAdmin(): SupabaseClient | null {
  return null;
}
