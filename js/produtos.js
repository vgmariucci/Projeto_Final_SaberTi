import { supabase } from './config.js';

// NOVO: Cache local para produtos
let localProdutos = [];

async function loadCategoriasDropdown() {
    const select = document.getElementById('prod-categoria');
    if (!select) return;

    const { data, error } = await supabase.from('categoria_produto').select('*');
    if (!error && data) {
        select.innerHTML = data.map(cat =>
            `<option value="${cat.categoriaprodutoid}">${cat.ds_categoria_produto}</option>`
        ).join('');
    }
}

export async function fetchProdutos() {
    await loadCategoriasDropdown();
    const tbody = document.getElementById('table-produtos-body');
    if (!tbody) return;
    tbody.innerHTML = `<tr><td colspan="6">Buscando catálogo...</td></tr>`;

    const { data, error } = await supabase
        .from('produto')
        .select(`
            produtoid, 
            ds_produto, 
            obs_produto,
            vl_venda_produto, 
            status_produto, 
            categoriaprodutoid,
            categoria_produto ( ds_categoria_produto )
        `)
        .order('produtoid', { ascending: false });

    if (error) {
        tbody.innerHTML = `<tr><td colspan="6">Falha: ${error.message}</td></tr>`;
        return;
    }

    localProdutos = data;
    renderProdutosTable(localProdutos);
}

function renderProdutosTable(dataList) {
    const tbody = document.getElementById('table-produtos-body');
    if (!tbody) return;

    if (dataList.length === 0) {
        tbody.innerHTML = `<tr><td colspan="6" style="text-align:center;">Nenhum produto encontrado.</td></tr>`;
        return;
    }

    tbody.innerHTML = dataList.map(p => {
        // NOVO: Lógica visual do status
        const statusBadge = p.status_produto === 'ATIVO'
            ? '<span style="background-color: #d1fae5; color: #059669; padding: 4px 8px; border-radius: 4px; font-weight: 600; font-size: 11px; letter-spacing: 0.5px;">ATIVO</span>'
            : '<span style="background-color: #fee2e2; color: #dc2626; padding: 4px 8px; border-radius: 4px; font-weight: 600; font-size: 11px; letter-spacing: 0.5px;">INATIVO</span>';

        return `
            <tr>
                <td>#${p.produtoid}</td>
                <td><strong>${p.ds_produto}</strong></td>
                <td>${p.categoria_produto?.ds_categoria_produto || 'Sem Categoria'}</td>
                <td>R$ ${parseFloat(p.vl_venda_produto).toFixed(2)}</td>
                <td>${statusBadge}</td>
                <td style="text-align: right;">
                    <button type="button" class="btn-edit-prod" 
                        data-id="${p.produtoid}" 
                        data-desc="${p.ds_produto}" 
                        data-obs="${p.obs_produto || ''}" 
                        data-valor="${p.vl_venda_produto}" 
                        data-status="${p.status_produto}" 
                        data-cat="${p.categoriaprodutoid}"
                        style="background:#334155; color:white; border:none; padding:6px 12px; border-radius:4px; cursor:pointer; font-size:12px;">
                        Editar
                    </button>
                </td>
            </tr>
        `;
    }).join('');

    tbody.querySelectorAll('.btn-edit-prod').forEach(btn => {
        btn.addEventListener('click', (e) => {
            setupEditMode(
                e.target.getAttribute('data-id'),
                e.target.getAttribute('data-cat'),
                e.target.getAttribute('data-desc'),
                e.target.getAttribute('data-obs'),
                e.target.getAttribute('data-valor'),
                e.target.getAttribute('data-status')
            );
        });
    });
}

function setupEditMode(id, catId, desc, obs, valor, status) {
    const statusSelect = document.getElementById('prod-status');

    // NOVO: Adiciona a opção INATIVO se ela ainda não existir
    if (statusSelect.options.length === 1) {
        statusSelect.innerHTML += '<option value="INATIVO">Inativo</option>';
    }

    document.getElementById('prod-id').value = id;
    document.getElementById('prod-categoria').value = catId;
    document.getElementById('prod-descricao').value = desc;
    document.getElementById('prod-obs').value = obs;
    document.getElementById('prod-valor').value = valor;
    document.getElementById('prod-status').value = status;

    document.getElementById('form-title-produto').innerText = "Editar Produto";
    document.getElementById('btn-submit-prod').innerText = "Atualizar Produto";

    // Mostra o botão de cancelar
    document.getElementById('btn-cancel-prod').style.display = "block";
    // NOVO: Mostra o botão de excluir APENAS se o status atual for INATIVO
    document.getElementById('btn-delete-prod').style.display = (status === 'INATIVO') ? "block" : "none";
}

function resetProdutoForm() {
    document.getElementById('form-produto').reset();

    // NOVO: Reseta o dropdown para conter apenas a opção ATIVO
    const statusSelect = document.getElementById('prod-status');
    statusSelect.innerHTML = '<option value="ATIVO">Ativo</option>';

    document.getElementById('prod-id').value = "";
    document.getElementById('form-title-produto').innerText = "Novo Produto";
    document.getElementById('btn-submit-prod').innerText = "Cadastrar Produto";
    // Oculta os botões auxiliares
    document.getElementById('btn-cancel-prod').style.display = "none";
    document.getElementById('btn-delete-prod').style.display = "none";
}

export function initProdutos() {
    fetchProdutos();

    const form = document.getElementById('form-produto');
    document.getElementById('btn-cancel-prod')?.addEventListener('click', resetProdutoForm);

    // NOVO: Lógica de Exclusão Segura com SweetAlert2
    const btnDelete = document.getElementById('btn-delete-prod');
    btnDelete?.addEventListener('click', async () => {
        const id = document.getElementById('prod-id').value;
        if (!id) return;

        // 1. Confirmação com modal estilizado (SweetAlert2)
        const result = await Swal.fire({
            title: 'Tem certeza?',
            text: "Esta ação excluirá o produto permanentemente.",
            icon: 'warning',
            showCancelButton: true,
            confirmButtonColor: '#ef4444', // Vermelho (combina com seu botão excluir)
            cancelButtonColor: '#64748b',  // Slate (combina com seu botão cancelar)
            confirmButtonText: 'Sim, excluir!',
            cancelButtonText: 'Cancelar',
            background: '#ffffff',
            color: '#1e293b'
        });

        // Se o usuário clicar em "Cancelar" ou fechar o modal, paramos aqui
        if (!result.isConfirmed) return;

        // 2. Verificar se o produto existe na tabela item_orcamento
        const { data: itensOrcamento, error: errCheck } = await supabase
            .from('item_orcamento')
            .select('orcamentoid')
            .eq('produtoid', id)
            .limit(1);

        if (errCheck) {
            Swal.fire({
                title: 'Erro!',
                text: "Falha ao verificar o histórico do produto: " + errCheck.message,
                icon: 'error',
                confirmButtonColor: '#334155'
            });
            return;
        }

        // Se o produto fizer parte de um orçamento, bloqueia a exclusão
        if (itensOrcamento && itensOrcamento.length > 0) {
            Swal.fire({
                title: 'Ação Bloqueada',
                text: "Este produto não pode ser excluído porque faz parte de um ou mais orçamentos registrados no sistema.",
                icon: 'info',
                confirmButtonColor: '#3b82f6' // Azul para informar
            });
            return;
        }

        // 3. Deletar o produto
        const { data: deletedRow, error: errDelete } = await supabase
            .from('produto')
            .delete()
            .eq('produtoid', id)
            .select(); // O .select() força o Supabase a retornar a linha que foi apagada

        if (errDelete) {
            Swal.fire({
                title: 'Erro!',
                text: "Não foi possível excluir o produto: " + errDelete.message,
                icon: 'error',
                confirmButtonColor: '#334155'
            });
        } else if (!deletedRow || deletedRow.length === 0) {
            // Se não houve erro, mas a array veio vazia, o RLS bloqueou silenciosamente!
            Swal.fire({
                title: 'Permissão Negada!',
                text: "A exclusão foi bloqueada. Verifique as políticas de segurança (RLS) da tabela 'produto' no painel do Supabase.",
                icon: 'warning',
                confirmButtonColor: '#f59e0b' // Laranja de aviso
            });
        } else {
            // Sucesso Real!
            Swal.fire({
                title: 'Excluído!',
                text: 'O produto foi removido com sucesso.',
                icon: 'success',
                confirmButtonColor: '#10b981'
            });

            resetProdutoForm();
            fetchProdutos();
        }
    });

    // NOVO: Ouvinte de Busca de Produtos (Filtra por ID, Descrição ou Nome de Categoria)
    const searchInput = document.getElementById('search-produto');
    searchInput?.addEventListener('input', (e) => {
        const term = e.target.value.toLowerCase().trim();
        const filtered = localProdutos.filter(p => {
            const catNome = p.categoria_produto?.ds_categoria_produto?.toLowerCase() || '';
            return p.produtoid.toString().includes(term) ||
                p.ds_produto.toLowerCase().includes(term) ||
                catNome.includes(term);
        });
        renderProdutosTable(filtered);
    });

    if (form) {
        form.addEventListener('submit', async (e) => {
            e.preventDefault();
            const id = document.getElementById('prod-id').value;
            const payload = {
                categoriaprodutoid: parseInt(document.getElementById('prod-categoria').value),
                ds_produto: document.getElementById('prod-descricao').value,
                obs_produto: document.getElementById('prod-obs').value,
                vl_venda_produto: parseFloat(document.getElementById('prod-valor').value),
                status_produto: document.getElementById('prod-status').value
            };

            if (id) {
                const { error } = await supabase.from('produto').update(payload).eq('produtoid', id);
                if (error) alert("Erro ao atualizar: " + error.message);
                else {
                    alert("Produto atualizado!");
                    resetProdutoForm();
                    fetchProdutos();
                }
            } else {
                payload.dt_cadastro_produto = new Date().toISOString();
                const { error } = await supabase.from('produto').insert([payload]);
                if (error) alert("Erro ao salvar produto: " + error.message);
                else {
                    alert("Produto adicionado!");
                    form.reset();
                    fetchProdutos();
                }
            }
        });
    }
}