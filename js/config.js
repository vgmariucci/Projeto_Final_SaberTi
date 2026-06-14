// ==========================================
// 1. INITIALIZATION & CONFIGURATION
// ==========================================
const SUPABASE_URL = "https://qyzrnibtgbkrwcxthgky.supabase.co";
const SUPABASE_ANON_KEY = "sb_publishable_CeDoa8WvFsVJz00MQ9bdgQ_-yBX0FjJ";

// FIX: Use window.supabase to safely reference the CDN library
export const supabase = window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

