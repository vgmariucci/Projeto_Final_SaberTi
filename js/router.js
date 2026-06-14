import { supabase } from './config.js';
import { initPerfil } from './perfil_usuario.js';
import { initClientes } from './clientes.js';
import { initProdutos } from './produtos.js';
import { initCategoriasProdutos } from './categorias_produtos.js';
import { initOrcamentos } from './orcamentos.js';
import { initMetricas } from './metricas.js';
import { initUsuarios } from './usuarios.js'; // 1. Import module

const routes = {
    clientes: { html: 'views/clientes.html', init: initClientes },
    produtos: { html: 'views/produtos.html', init: initProdutos },
    categorias_produtos: { html: 'views/categorias_produtos.html', init: initCategoriasProdutos },
    orcamentos: { html: 'views/orcamentos.html', init: initOrcamentos },
    metricas: { html: 'views/metricas.html', init: initMetricas },
    usuarios: { html: 'views/usuarios.html', init: initUsuarios },
    perfil: { html: 'views/perfil_usuario.html', init: initPerfil }
};

async function navigate(routeKey) {
    const route = routes[routeKey];
    if (!route) return;

    try {
        const response = await fetch(route.html);
        if (!response.ok) throw new Error(`Failed to load view: ${routeKey}`);

        const htmlContent = await response.text();
        document.getElementById('main-content').innerHTML = htmlContent;
        route.init();
    } catch (error) {
        console.error("Routing error:", error);
        document.getElementById('main-content').innerHTML = `<h2>Erro ao carregar a página.</h2>`;
    }
}

document.addEventListener("DOMContentLoaded", async () => {

    //Guarda de Rotas (Verificação de Autenticação)
    const { data: { session } } = await supabase.auth.getSession();

    if (!session) {
        // Se não houver sessão ativa, expulsa para o login
        window.location.href = 'login.html';
        return;
    }

    // Captura os dados do usuário logado
    const user = session.user;
    const fallbackName = user.email.split('@')[0];
    const fullName = user.user_metadata?.full_name || fallbackName;

    // Atualiza a interface da Topbar
    const userNameEl = document.getElementById('user-display-name');
    const avatarEl = document.getElementById('user-avatar');
    if (userNameEl) userNameEl.textContent = fullName;
    if (avatarEl) avatarEl.textContent = fullName.charAt(0).toUpperCase();

    // Toggle do Menu Dropdown
    const profileTrigger = document.getElementById('profile-menu-trigger');
    const dropdown = document.getElementById('profile-dropdown');

    profileTrigger?.addEventListener('click', (e) => {
        e.stopPropagation();
        dropdown.classList.toggle('show');
    });

    document.addEventListener('click', () => {
        dropdown.classList.remove('show');
    });

    // Ação do Botão "Meu Perfil" (RECURSO 3)
    document.getElementById('btn-view-profile')?.addEventListener('click', () => {
        navigate('perfil');
    });

    // Ação de Logout Nativado no Supabase
    document.getElementById('btn-logout')?.addEventListener('click', async () => {
        const { error } = await supabase.auth.signOut();
        if (!error) {
            window.location.href = 'login.html';
        } else {
            alert('Erro ao sair do sistema.');
        }
    });

    const sidebar = document.getElementById('sidebar');
    const overlay = document.getElementById('sidebar-overlay');
    const hamburger = document.getElementById('btn-hamburger');

    function openSidebar() {
        sidebar.classList.add('open');
        overlay.classList.add('active');
    }

    function closeSidebar() {
        sidebar.classList.remove('open');
        overlay.classList.remove('active');
    }

    hamburger?.addEventListener('click', () => {
        sidebar.classList.contains('open') ? closeSidebar() : openSidebar();

        // Exemplo de como deve ficar a sua função de alternar abas:
        function alternarAba(abaId) {
            // 1. Oculta todos os painéis e remove classes ativas
            document.querySelectorAll('.view-panel').forEach(panel => panel.classList.remove('active'));

            // 2. Ativa o painel selecionado
            const painelAtivo = document.getElementById(abaId);
            if (painelAtivo) {
                painelAtivo.classList.add('active');
            }

            // 3. SOLUÇÃO DO ENCOLHIMENTO: Se a aba voltando for a de métricas, força o Chart.js a recalcular
            if (abaId === 'metricas' || abaId === 'main-content') {
                // Se você tiver uma instância global dos seus gráficos, force o resize:
                setTimeout(() => {
                    if (window.meuGrafico1) window.meuGrafico1.resize();
                    if (window.meuGrafico2) window.meuGrafico2.resize();
                    // Ou se usar uma abordagem genérica para todas as instâncias de Chart na página:
                    Object.keys(Chart.instances).forEach(key => {
                        Chart.instances[key].resize();
                    });
                }, 50); // Um pequeno delay de 50ms garante que o CSS display: flex já renderizou
            }
        }
    });

    overlay?.addEventListener('click', closeSidebar);

    document.querySelectorAll('.nav-btn').forEach(button => {
        button.addEventListener('click', (e) => {
            document.querySelectorAll('.nav-btn').forEach(btn => btn.classList.remove('active'));
            button.classList.add('active');

            const target = button.getAttribute('data-target');
            if (target) navigate(target);

            // Close sidebar automatically after navigation on mobile
            closeSidebar();
        });
    });

    navigate('clientes');
});