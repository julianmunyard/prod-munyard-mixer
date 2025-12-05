import { createClient } from '@supabase/supabase-js'

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY

// Check if environment variables are defined
let supabase;
if (!supabaseUrl || !supabaseAnonKey) {
  if (typeof window !== 'undefined') {
    console.error('❌ Supabase environment variables are missing!');
    console.error('Please create a .env.local file with:');
    console.error('NEXT_PUBLIC_SUPABASE_URL=your_supabase_project_url');
    console.error('NEXT_PUBLIC_SUPABASE_ANON_KEY=your_supabase_anon_key');
  }
  
  // Set to null instead of creating a broken client
  supabase = null;
} else {
  // Log which Supabase project we're using (for debugging) - only on client side
  if (typeof window !== 'undefined') {
    console.log('🔗 Using Supabase project:', supabaseUrl);
  }
  
  supabase = createClient(supabaseUrl, supabaseAnonKey, {
    auth: {
      persistSession: true,
      autoRefreshToken: true,
      detectSessionInUrl: true
    }
  });
}

export { supabase };
