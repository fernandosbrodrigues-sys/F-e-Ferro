import type { Config } from '@netlify/server';
import { createApiApp } from '../../server/app.ts';
import { requireSupabase } from '../../server/store.ts';

// On Netlify the filesystem is temporary, so data must live in Supabase.
// Without SUPABASE_URL the API runs in a temporary demo mode (see server/store.ts).
requireSupabase();

const app = await createApiApp();
app.listen(Number(process.env.PORT) || 3000);

export const config: Config = { path: '/api/*' };
