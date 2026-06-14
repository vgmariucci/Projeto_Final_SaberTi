import { supabase } from './config.js';

let localUsuarios = [];

export async function fetchUsuarios() {
    const tbody = document.getElementById('table-usuarios-body');
    if (!tbody) return;
    tbody.innerHTML = `<tr><td colspan="4">Buscando usuários...</td></tr>`;

    const { data, error } = await supabase
        .from('usuarios')
        .select('id, nome, email, dt_cadastro')
        .order('id', { ascending: false });

    if (error) {
        tbody.innerHTML = `<tr><td colspan="4" style="color:red;">Erro: ${error.message}</td></tr>`;
        return;
    }

    localUsuarios = data;
    renderUsuariosTable(localUsuarios);
}

function renderUsuariosTable(dataList) {
    const tbody = document.getElementById('table-usuarios-body');
    if (!tbody) return;

    if (dataList.length === 0) {
        tbody.innerHTML = `<tr><td colspan="4" style="text-align:center;">Nenhum usuário encontrado.</td></tr>`;
        return;
    }

    tbody.innerHTML = dataList.map(u => `
        <tr>
            <td><strong>#${u.id}</strong></td>
            <td>${u.nome}</td>
            <td>${u.email}</td>
            <td>${new Date(u.dt_cadastro).toLocaleDateString('pt-BR')}</td>
        </tr>
    `).join('');
}

export function initUsuarios() {
    fetchUsuarios();

    const form = document.getElementById('form-usuario');

    // NOVO: Ouvinte de busca de Usuários (ID, Nome ou E-mail)
    const searchInput = document.getElementById('search-usuario');
    searchInput?.addEventListener('input', (e) => {
        const term = e.target.value.toLowerCase().trim();
        const filtered = localUsuarios.filter(u =>
            u.id.toString().includes(term) ||
            u.nome.toLowerCase().includes(term) ||
            u.email.toLowerCase().includes(term)
        );
        renderUsuariosTable(filtered);
    });


    if (form) {
        form.addEventListener('submit', async (e) => {
            e.preventDefault();

            const nome = document.getElementById('user-nome').value;
            const email = document.getElementById('user-email').value;
            const senhaTemporaria = document.getElementById('user-senha').value;

            // Validação mínima de segurança no front-end antes de enviar
            if (senhaTemporaria.length < 6) {
                alert("A senha deve ter pelo menos 6 caracteres.");
                return;
            }

            // Criando o usuário nativamente no microsserviço de Auth do Supabase
            const { data, error } = await supabase.auth.signUp({
                email: email,
                password: senhaTemporaria,
                options: {
                    // Passamos o nome dentro de 'data' (user_metadata) para ficar salvo no perfil do Auth
                    data: {
                        full_name: nome
                    }
                }
            });

            if (error) {
                alert("Erro ao provisionar usuário no Auth: " + error.message);
                return;
            }

            // Se chegou até aqui, o usuário foi criado com sucesso e a senha está segura!
            alert(`Usuário ${nome} provisionado com sucesso! Um e-mail de confirmação foi enviado para ${email}.`);

            form.reset();
            fetchUsuarios(); // Atualiza a tabela local
        });
    }
}