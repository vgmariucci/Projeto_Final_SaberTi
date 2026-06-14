import { supabase } from './config.js';

document.addEventListener("DOMContentLoaded", () => {
    
    particlesJS("particles-js", {
        "particles": {
            "number": { "value": 80 },
            "color": { "value": "#00d4ff" },
            "shape": { "type": "circle" },
            "opacity": { "value": 0.5 },
            "size": { "value": 3 },
            "line_linked": { "enable": true, "distance": 150, "color": "#00d4ff", "opacity": 0.4 }
        },
        "interactivity": { "events": { "onhover": { "enable": true, "mode": "repulse" } } }
    });

    const loginForm = document.getElementById('loginForm');
    const btnCancel = document.getElementById('btnCancel');
    const btnForgot = document.getElementById('btnForgot');

    if (loginForm) loginForm.addEventListener('submit', handleFormSubmit);
    if (btnCancel) btnCancel.addEventListener('click', () => loginForm.reset());
    if (btnForgot) btnForgot.addEventListener('click', handleForgotPassword);
});

async function handleFormSubmit(event) {
    event.preventDefault();

    const email = document.getElementById('email').value.trim();
    const senha = document.getElementById('password').value.trim();

    // Faz o login usando o sistema nativo de autenticação do Supabase
    const { data, error } = await supabase.auth.signInWithPassword({
        email: email,
        password: senha,
    });

    if (error) {
        // O Supabase Auth cuida de senhas erradas ou e-mails inexistentes retornando um erro aqui
        alert("E-mail ou senha incorretos.");
        document.getElementById('password').value = "";
        console.error("Erro de Autenticação:", error.message);
    } else {
        // Se deu certo, extraímos o nome salvo no metadado do usuário durante o cadastro
        const nomeUsuario = data.user.user_metadata?.full_name || "Colaborador";

        alert(`Bem-vindo, ${nomeUsuario}!`);

        // O Supabase armazena automaticamente o token de sessão no LocalStorage do navegador.
        window.location.href = 'index.html';
    }
}

async function handleForgotPassword() {
    const email = document.getElementById('email').value.trim();

    if (!email) {
        alert("Por favor, digite seu e-mail no campo acima para recuperar a senha.");
        return;
    }

    // NOVO: Envia um e-mail real de redefinição de senha usando o Supabase
    const { error } = await supabase.auth.resetPasswordForEmail(email, {
        redirectTo: window.location.origin + '/redefinir-senha.html', // Altere para a sua página de nova senha futuramente
    });

    if (error) {
        alert("Erro ao enviar e-mail de recuperação: " + error.message);
    } else {
        alert(`Se este e-mail estiver cadastrado, as instruções de recuperação foram enviadas para: ${email}`);
    }
}