import { createClient } from '@supabase/supabase-js'
import type { Database } from './database.types'

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY

if (!supabaseUrl || !supabaseAnonKey) {
    console.error('Missing Supabase environment variables. Please check your .env file.')
}

// Placeholder fallbacks keep createClient from throwing at import time when
// env vars are missing — main.tsx detects the misconfiguration and renders
// an explicit error screen instead of a blank page.
export const supabase = createClient<Database>(
    supabaseUrl || 'https://missing-env.supabase.co',
    supabaseAnonKey || 'missing-env',
    {
        auth: {
            persistSession: true,
            autoRefreshToken: true,
            detectSessionInUrl: true,
        },
    }
)
