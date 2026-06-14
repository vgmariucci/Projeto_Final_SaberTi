import { supabase } from './config.js';

export async function initPerfil() {
    const { data: { session } } = await supabase.auth.getSession();
    
    if (!session) return;

    const user = session.user;

    const nomeEl = document.getElementById('perf-nome');
    const emailEl = document.getElementById('perf-email');
    const uuidEl = document.getElementById('perf-uuid');

    // Alimenta os elementos do DOM com os dados recuperados do token JWT
    if (nomeEl) nomeEl.textContent = user.user_metadata?.full_name || user.email.split('@')[0];
    if (emailEl) emailEl.textContent = user.email;
    if (uuidEl) uuidEl.textContent = user.id;
}