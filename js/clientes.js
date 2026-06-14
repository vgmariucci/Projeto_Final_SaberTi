import { supabase } from './config.js';

// Cache local para permitir busca em tempo real sem re-onerar o banco
let localClientes = [];

export async function fetchClientes() {
    const tbody = document.getElementById('table-clientes-body');
    if (!tbody) return;
    tbody.innerHTML = `<tr><td colspan="5">Buscando dados...</td></tr>`;

    const { data, error } = await supabase.from('cliente').select('*').order('clienteid', { ascending: false });

    if (error) {
        tbody.innerHTML = `<tr><td colspan="5" style="color:red;">Falha na requisição.</td></tr>`;
        return;
    }

    localClientes = data; // Armazena os dados vindos do Supabase
    renderClientesTable(localClientes);
}

// Função isolada para renderização e vinculação de eventos
function renderClientesTable(dataList) {
    const tbody = document.getElementById('table-clientes-body');
    if (!tbody) return;

    if (dataList.length === 0) {
        tbody.innerHTML = `<tr><td colspan="5" style="text-align:center;">Nenhum cliente encontrado.</td></tr>`;
        return;
    }

    tbody.innerHTML = dataList.map(c => `
        <tr>
            <td><strong>#${c.clienteid}</strong></td>
            <td><span class="badge">${c.tipo_cliente}</span></td>
            <td>${c.cpf_cnpj_cliente}</td>
            <td>${c.nome_cliente}</td>
            <td style="text-align: right;">
                <button type="button" class="btn-edit-cli" 
                    data-id="${c.clienteid}" 
                    data-tipo="${c.tipo_cliente}" 
                    data-doc="${c.cpf_cnpj_cliente}" 
                    data-nome="${c.nome_cliente}"
                    style="background:#334155; color:white; border:none; padding:6px 12px; border-radius:4px; cursor:pointer; font-size:12px;">
                    Editar
                </button>
            </td>
        </tr>
    `).join('');

    tbody.querySelectorAll('.btn-edit-cli').forEach(btn => {
        btn.addEventListener('click', (e) => {
            setupEditMode(
                e.target.getAttribute('data-id'),
                e.target.getAttribute('data-tipo'),
                e.target.getAttribute('data-doc'),
                e.target.getAttribute('data-nome')
            );
        });
    });
}

function setupEditMode(id, tipo, doc, nome) {
    document.getElementById('cli-id').value = id;
    document.getElementById('cli-tipo').value = tipo;
    document.getElementById('cli-documento').value = doc;
    document.getElementById('cli-nome').value = nome;

    document.getElementById('form-title-cliente').innerText = "Editar Cliente";
    document.getElementById('btn-submit-cli').innerText = "Atualizar Cliente";
    document.getElementById('btn-cancel-cli').style.display = "block";
}

function resetClienteForm() {
    document.getElementById('form-cliente').reset();
    document.getElementById('cli-id').value = "";
    document.getElementById('form-title-cliente').innerText = "Novo Cliente";
    document.getElementById('btn-submit-cli').innerText = "Cadastrar Cliente";
    document.getElementById('btn-cancel-cli').style.display = "none";
}

// CPF Validation
function validarCPF(cpf) {
    cpf = cpf.replace(/[^\d]/g, '');
    if (cpf.length !== 11 || /^(\d)\1{10}$/.test(cpf)) return false;
    let soma = 0, resto;
    for (let i = 1; i <= 9; i++) soma += parseInt(cpf.substring(i - 1, i)) * (11 - i);
    resto = (soma * 10) % 11;
    if (resto === 10 || resto === 11) resto = 0;
    if (resto !== parseInt(cpf.substring(9, 10))) return false;
    soma = 0;
    for (let i = 1; i <= 10; i++) soma += parseInt(cpf.substring(i - 1, i)) * (12 - i);
    resto = (soma * 10) % 11;
    if (resto === 10 || resto === 11) resto = 0;
    return resto === parseInt(cpf.substring(10, 11));
}

// CNPJ Validation
// CNPJ Validation
function validarCNPJ(cnpj) {
    cnpj = cnpj.replace(/[^\d]/g, '');
    
    // Valida se tem 14 dígitos ou se é uma sequência repetida conhecida
    if (cnpj.length !== 14 || /^(\d)\1{13}$/.test(cnpj)) return false;

    // Função interna para calcular cada dígito verificador
    const calcularDigito = (fatia, pesos) => {
        const soma = fatia
            .split('')
            .reduce((acc, num, idx) => acc + parseInt(num) * pesos[idx], 0);
        const resto = soma % 11;
        return resto < 2 ? 0 : 11 - resto;
    };

    // Pesos oficiais para o primeiro e segundo dígito verificador
    const pesosD1 = [5, 4, 3, 2, 9, 8, 7, 6, 5, 4, 3, 2];
    const pesosD2 = [6, 5, 4, 3, 2, 9, 8, 7, 6, 5, 4, 3, 2];

    // Calcula os dígitos ideais
    const d1 = calcularDigito(cnpj.substring(0, 12), pesosD1);
    const d2 = calcularDigito(cnpj.substring(0, 13), pesosD2);

    // Compara com os dígitos reais informados (posições 12 e 13)
    return d1 === parseInt(cnpj.charAt(12)) && d2 === parseInt(cnpj.charAt(13));
}

export function initClientes() {
    fetchClientes();

    const form = document.getElementById('form-cliente');
    document.getElementById('btn-cancel-cli')?.addEventListener('click', resetClienteForm);

    // NOVO: Ouvinte do campo de busca (Filtra por ID ou CPF/CNPJ)
    const searchInput = document.getElementById('search-cliente');
    searchInput?.addEventListener('input', (e) => {
        const term = e.target.value.toLowerCase().trim();
        const filtered = localClientes.filter(c =>
            c.clienteid.toString().includes(term) ||
            c.cpf_cnpj_cliente.toLowerCase().includes(term)
        );
        renderClientesTable(filtered);
    });

    document.getElementById('cli-tipo').addEventListener('change', (e) => {
        const inputDoc = document.getElementById('cli-documento');
        inputDoc.placeholder = e.target.value === 'F' ? '000.000.000-00' : '00.000.000/0000-00';
        inputDoc.value = ""; // Clear when switching types
    });

    if (form) {
        form.addEventListener('submit', async (e) => {
            e.preventDefault();

            const tipo = document.getElementById('cli-tipo').value;
            const doc = document.getElementById('cli-documento').value;

            // Validate based on type
            if (tipo === 'F' && !validarCPF(doc)) {
                alert("CPF inválido! Por favor, verifique o número digitado.");
                return;
            }
            if (tipo === 'J' && !validarCNPJ(doc)) {
                alert("CNPJ inválido! Por favor, verifique o número digitado.");
                return;
            }

            const id = document.getElementById('cli-id').value;
            const payload = {
                tipo_cliente: document.getElementById('cli-tipo').value,
                cpf_cnpj_cliente: document.getElementById('cli-documento').value,
                nome_cliente: document.getElementById('cli-nome').value
            };

            if (id) {
                const { data: updated, error } = await supabase
                    .from('cliente')
                    .update(payload)
                    .eq('clienteid', parseInt(id))
                    .select();

                if (error) alert("Erro ao atualizar: " + error.message);
                else {
                    alert("Cliente atualizado com sucesso!");
                    resetClienteForm();
                    fetchClientes();
                }
            } else {
                const { error } = await supabase
                    .from('cliente')
                    .insert([payload])
                    .select();
                if (error) alert("Erro ao salvar: " + error.message);
                else {
                    alert("Cliente cadastrado com sucesso!");
                    form.reset();
                    fetchClientes();
                }
            }
        });
    }
}