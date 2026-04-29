import { createClient } from '@supabase/supabase-js'

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || 'https://placeholder.supabase.co'
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || 'placeholder'

if (!process.env.NEXT_PUBLIC_SUPABASE_URL || !process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY) {
  if (process.env.NODE_ENV === 'development') {
    console.warn('Supabase credentials missing in .env.local. Persistent features will be disabled.')
  } else {
    console.warn('Supabase credentials missing in environment. Building with placeholder values.')
  }
}

export const supabase = createClient(supabaseUrl, supabaseAnonKey)

