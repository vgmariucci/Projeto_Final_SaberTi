import { supabase } from './config.js';

// NOVO: Cache local para Categorias
let localCategorias = [];

export async function fetchCategorias() {
    const tbody = document.getElementById('table-categorias-body');
    if (!tbody) return;
    tbody.innerHTML = `<tr><td colspan="3">Buscando categorias...</td></tr>`;

    const { data, error } = await supabase
        .from('categoria_produto')
        .select('*')
        .order('categoriaprodutoid', { ascending: false });

    if (error) {
        tbody.innerHTML = `<tr><td colspan="3" style="color:red;">Falha na requisição: ${error.message}</td></tr>`;
        return;
    }

    localCategorias = data;
    renderCategoriasTable(localCategorias);
}

// NOVO: Renderizador isolado de categorias
function renderCategoriasTable(dataList) {
    const tbody = document.getElementById('table-categorias-body');
    if (!tbody) return;

    if (dataList.length === 0) {
        tbody.innerHTML = `<tr><td colspan="3" style="text-align:center;">Nenhuma categoria encontrada.</td></tr>`;
        return;
    }

    tbody.innerHTML = dataList.map(c => `
        <tr>
            <td><strong>#${c.categoriaprodutoid}</strong></td>
            <td>${c.ds_categoria_produto}</td>
            <td style="text-align: right;">
                <button type="button" class="btn-edit-cat" 
                    data-id="${c.categoriaprodutoid}" 
                    data-desc="${c.ds_categoria_produto}" 
                    style="background:#334155; color:white; border:none; padding:6px 12px; border-radius:4px; cursor:pointer; font-size:12px; font-weight:600;">
                    Editar
                </button>
            </td>
        </tr>
    `).join('');

    tbody.querySelectorAll('.btn-edit-cat').forEach(btn => {
        btn.addEventListener('click', (e) => {
            const id = e.target.getAttribute('data-id');
            const desc = e.target.getAttribute('data-desc');
            setupEditMode(id, desc);
        });
    });
}

function setupEditMode(id, desc) {
    document.getElementById('cat-id').value = id;
    document.getElementById('cat-descricao').value = desc;
    document.getElementById('form-title').innerText = "Editar Categoria";
    document.getElementById('btn-submit-cat').innerText = "Atualizar Categoria";
    document.getElementById('btn-cancel-edit').style.display = "block";
}

function resetForm() {
    document.getElementById('form-categoria').reset();
    document.getElementById('cat-id').value = "";
    document.getElementById('form-title').innerText = "Nova Categoria";
    document.getElementById('btn-submit-cat').innerText = "Cadastrar Categoria";
    document.getElementById('btn-cancel-edit').style.display = "none";
}

export function initCategoriasProdutos() {
    fetchCategorias();

    const form = document.getElementById('form-categoria');
    const cancelBtn = document.getElementById('btn-cancel-edit');

    if (cancelBtn) {
        cancelBtn.addEventListener('click', resetForm);
    }

    // NOVO: Ouvinte de Busca de Categorias (Filtra por ID ou Descrição)
    const searchInput = document.getElementById('search-categoria');
    searchInput?.addEventListener('input', (e) => {
        const term = e.target.value.toLowerCase().trim();
        const filtered = localCategorias.filter(c => 
            c.categoriaprodutoid.toString().includes(term) || 
            c.ds_categoria_produto.toLowerCase().includes(term)
        );
        renderCategoriasTable(filtered);
    });

    if (form) {
        form.addEventListener('submit', async (e) => {
            e.preventDefault();
            
            const catId = document.getElementById('cat-id').value;
            const descricao = document.getElementById('cat-descricao').value;
            
            const payload = {
                ds_categoria_produto: descricao
            };

            if (catId) {
                const { error } = await supabase
                    .from('categoria_produto')
                    .update(payload)
                    .eq('categoriaprodutoid', catId);

                if (error) {
                    alert("Erro ao atualizar categoria: " + error.message);
                } else {
                    alert("Categoria atualizada com sucesso!");
                    resetForm();
                    fetchCategorias();
                }
            } else {
                const { error } = await supabase
                    .from('categoria_produto')
                    .insert([payload]);

                if (error) {
                    alert("Erro ao salvar categoria: " + error.message);
                } else {
                    alert("Categoria criada com sucesso!");
                    resetForm();
                    fetchCategorias();
                }
            }
        });
    }
}