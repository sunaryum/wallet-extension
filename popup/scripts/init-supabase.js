const SUPABASE_URL = 'https://fhamhyolyolsirfxxhan.supabase.co';
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImZoYW1oeW9seW9sc2lyZnh4aGFuIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NDk1NjAyMjIsImV4cCI6MjA2NTEzNjIyMn0.iQIDCKWVZpKlmbKXG60J-nUd5lK-S5Nw5GvDSqE_w1Y';

// Initialize immediately instead of waiting for DOMContentLoaded
try {
  if (typeof supabase === 'undefined') {
    throw new Error('Supabase library not loaded!');
  }
  
  window.supabaseClient = supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
  console.log('Supabase initialized successfully');
} catch (error) {
  console.error('Supabase initialization failed:', error);
  window.supabaseClient = null;
}