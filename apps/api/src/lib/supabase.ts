import { createClient } from '@supabase/supabase-js';
import ws from 'ws';

if (!process.env.SUPABASE_URL) throw new Error('Missing SUPABASE_URL');
if (!process.env.SUPABASE_SERVICE_ROLE_KEY) throw new Error('Missing SUPABASE_SERVICE_ROLE_KEY');

// Service-role client — bypasses RLS, used only in the trusted API process.
// Node 20 has no native WebSocket; supply `ws` so the Supabase realtime client
// can construct (we don't actually use realtime, but the client still inits it).
export const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY,
  {
    auth: { persistSession: false },
    realtime: { transport: ws as any },
  },
);
