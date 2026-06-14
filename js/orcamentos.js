import { supabase } from './config.js';

let cachedClientes = [];
let cachedProdutos = [];
let currentOrcamentoItens = [];
let localOrcamentos = [];

async function loadOrcamentoFormDropdowns() {
    const cliSelect = document.getElementById('orc-cliente');
    const prodSelect = document.getElementById('orc-item-produto');
    if (!cliSelect || !prodSelect) return;

    const { data: clientes } = await supabase.from('cliente').select('clienteid, nome_cliente');
    if (clientes) {
        cachedClientes = clientes;
        cliSelect.innerHTML = '<option value="">-- Selecione o Cliente --</option>' +
            clientes.map(c => `<option value="${c.clienteid}">${c.nome_cliente}</option>`).join('');
    }

    const { data: produtos } = await supabase.from('produto').select('produtoid, ds_produto, vl_venda_produto').eq('status_produto', 'ATIVO');
    if (produtos) {
        cachedProdutos = produtos;
        prodSelect.innerHTML = '<option value="">-- Selecione o Produto --</option>' +
            produtos.map(p => `<option value="${p.produtoid}" data-preco="${p.vl_venda_produto}">${p.ds_produto}</option>`).join('');
    }
}

function renderProvisorioTable() {
    const tbody = document.getElementById('table-itens-provisorios');
    const totalDisplay = document.getElementById('orc-total-display');
    if (!tbody || !totalDisplay) return;

    if (currentOrcamentoItens.length === 0) {
        tbody.innerHTML = `<tr><td colspan="4" style="text-align:center;">Nenhum item adicionado</td></tr>`;
        totalDisplay.innerText = "0.00";
        return;
    }

    let grandTotal = 0;
    tbody.innerHTML = currentOrcamentoItens.map((item, index) => {
        const subtotal = item.preco * item.quantidade;
        grandTotal += subtotal;
        return `
            <tr>
                <td>${item.descricao}</td>
                <td>${item.quantidade}x</td>
                <td>R$ ${subtotal.toFixed(2)}</td>
                <td><button type="button" class="btn-remove-item" data-index="${index}" style="background:none; border:none; color:red; cursor:pointer;">❌</button></td>
            </tr>
        `;
    }).join('');

    totalDisplay.innerText = grandTotal.toFixed(2);

    tbody.querySelectorAll('.btn-remove-item').forEach(btn => {
        btn.addEventListener('click', (e) => {
            const idx = parseInt(e.target.getAttribute('data-index'));
            currentOrcamentoItens.splice(idx, 1);
            renderProvisorioTable();
        });
    });
}

export async function fetchOrcamentos() {
    const tbody = document.getElementById('table-orcamentos-body');
    if (!tbody) return;
    tbody.innerHTML = `<tr><td colspan="7">Buscando histórico de propostas...</td></tr>`;

    const { data, error } = await supabase
        .from('orcamento')
        .select(`orcamentoid, dt_orcamento, dt_validade_orcamento, vl_total_orcamento, cliente ( clienteid, nome_cliente )`)
        .order('orcamentoid', { ascending: false })
        .range(0, 9);

    if (error) {
        tbody.innerHTML = `<tr><td colspan="7">Erro: ${error.message}</td></tr>`;
        return;
    }

    localOrcamentos = data;
    renderOrcamentosTable(localOrcamentos);
}

function renderOrcamentosTable(dataList) {
    const tbody = document.getElementById('table-orcamentos-body');
    if (!tbody) return;

    if (dataList.length === 0) {
        tbody.innerHTML = `<tr><td colspan="7" style="text-align:center;">Nenhum orçamento encontrado.</td></tr>`;
        return;
    }

    const hoje = new Date();
    hoje.setHours(0, 0, 0, 0);

    tbody.innerHTML = dataList.map(o => {
        const dataValidade = new Date(o.dt_validade_orcamento);
        dataValidade.setHours(0, 0, 0, 0);

        const statusIcon = hoje > dataValidade
            ? '<span title="Orçamento Expirado" style="font-size: 14px;">🚩</span>'
            : '<span title="Dentro da Validade" style="font-size: 14px;">🟢</span>';

        return `
            <tr>
                <td><strong>#${o.orcamentoid}</strong></td>
                <td>${o.cliente?.nome_cliente || 'Desconhecido'}</td>
                <td>${new Date(o.dt_orcamento).toLocaleDateString('pt-BR')}</td>
                <td>${new Date(o.dt_validade_orcamento).toLocaleDateString('pt-BR')}</td>
                <td style="text-align: right;"><strong>${parseFloat(o.vl_total_orcamento).toFixed(2)}</strong></td>
                <td style="text-align: center;">${statusIcon}</td> 
                <td style="text-align: center; display: flex; gap: 5px; justify-content: center;">
                    <button type="button" class="btn-view-edit-orc" data-id="${o.orcamentoid}" data-cliente="${o.cliente?.clienteid || ''}" data-validade="${o.dt_validade_orcamento.substring(0, 10)}"
                        style="background:#334155; color:white; border:none; padding:6px; border-radius:4px; cursor:pointer; font-size:12px;" title="Editar">
                        <i data-lucide="edit-3" style="width:16px; height:16px;"></i>
                    </button>
                    <button type="button" class="btn-pdf-orc" data-id="${o.orcamentoid}"
    style="background:#f59e0b; color:white; border:none; padding:6px; border-radius:4px; cursor:pointer; font-size:12px;" title="Gerar PDF">
    <i data-lucide="file-text" style="width:16px; height:16px;"></i>
</button>
                    <button type="button" class="btn-export-single" data-id="${o.orcamentoid}"
                        style="background:#10b981; color:white; border:none; padding:6px; border-radius:4px; cursor:pointer; font-size:12px;" title="Exportar para Excel">
                        <i data-lucide="download" style="width:16px; height:16px;"></i>
                    </button>
                </td>
            </tr>
        `;
        if (typeof lucide !== 'undefined') {
            lucide.createIcons();
        }
    }).join('');

    if (typeof lucide !== 'undefined') {
        lucide.createIcons();
    }

    // Event Listeners for Edit
    tbody.querySelectorAll('.btn-view-edit-orc').forEach(btn => {
        btn.addEventListener('click', async (e) => {
            const orcId = e.target.closest('.btn-view-edit-orc').getAttribute('data-id');
            const clienteId = e.target.closest('.btn-view-edit-orc').getAttribute('data-cliente');
            const validade = e.target.closest('.btn-view-edit-orc').getAttribute('data-validade');
            await loadOrcamentoForEditing(orcId, clienteId, validade);
        });
    });

    // Event Listeners for Single Export
    tbody.querySelectorAll('.btn-export-single').forEach(btn => {
        btn.addEventListener('click', async (e) => {
            const orcId = e.target.closest('.btn-export-single').getAttribute('data-id');
            await exportSingleOrcamento(orcId);
        });
    });

    tbody.querySelectorAll('.btn-pdf-orc').forEach(btn => {
        btn.addEventListener('click', (e) => {
            const orcId = e.target.closest('.btn-pdf-orc').getAttribute('data-id');
            generatePDF(orcId);
        });
    });
}

async function loadOrcamentoForEditing(orcId, clienteId, validade) {
    document.getElementById('orc-id').value = orcId;
    document.getElementById('orc-cliente').value = clienteId;
    document.getElementById('orc-validade').value = validade;

    document.getElementById('form-title-orcamento').innerText = `Editando Orçamento #${orcId}`;
    document.getElementById('btn-submit-orc').innerText = "Salvar Modificações";
    document.getElementById('btn-discard-orc').style.display = "block";

    const { data: itens, error } = await supabase
        .from('item_orcamento')
        .select(`qtd_produto, vl_unitario_produto, produto ( produtoid, ds_produto )`)
        .eq('orcamentoid', orcId);

    if (error) {
        console.error("Erro ao carregar itens do orçamento:", error.message);
        return;
    }

    if (itens) {
        currentOrcamentoItens = itens.map(i => ({
            produtoid: i.produto?.produtoid,
            descricao: i.produto?.ds_produto || "Produto Removido",
            preco: parseFloat(i.vl_unitario_produto),
            quantidade: parseInt(i.qtd_produto)
        }));
        renderProvisorioTable();
    }
}

function resetOrcamentoForm() {
    const form = document.getElementById('form-orcamento');
    if (form) form.reset();

    document.getElementById('orc-id').value = "";
    currentOrcamentoItens = [];
    renderProvisorioTable();

    document.getElementById('form-title-orcamento').innerText = "Novo Orçamento";
    document.getElementById('btn-submit-orc').innerText = "Finalizar e Emitir Orçamento";
    document.getElementById('btn-discard-orc').style.display = "none";
}

function getTodayString() {
    const today = new Date();
    const yyyy = today.getFullYear();
    const mm = String(today.getMonth() + 1).padStart(2, '0');
    const dd = String(today.getDate()).padStart(2, '0');
    return `${yyyy}-${mm}-${dd}`;
}

function validateValidade() {
    const input = document.getElementById('orc-validade');
    const errorMsg = document.getElementById('orc-validade-error');
    if (!input || !errorMsg) return true;

    const isValid = input.value && input.value > getTodayString();
    errorMsg.style.display = isValid ? 'none' : 'block';
    input.style.borderColor = isValid ? '' : '#ef4444';
    return isValid;
}


// ==========================================
// LÓGICA DE EXPORTAÇÃO PARA PDF
// ==========================================
// ==========================================
// LÓGICA DE EXPORTAÇÃO PARA PDF
// ==========================================
async function generatePDF(orcId) {
    // 1. Fetch full data
    const { data: orcData } = await supabase.from('orcamento')
        .select(`*, cliente(nome_cliente)`)
        .eq('orcamentoid', orcId).single();

    const { data: items } = await supabase.from('item_orcamento')
        .select(`*, produto(ds_produto)`)
        .eq('orcamentoid', orcId);

    // Formatação das Datas (Emissão, Validade e Geração)
    const dataEmissao = new Date(orcData.dt_orcamento).toLocaleDateString('pt-BR');
    const dataValidade = new Date(orcData.dt_validade_orcamento).toLocaleDateString('pt-BR');

    const dataAtual = new Date();
    const dataGeracao = dataAtual.toLocaleDateString('pt-BR') + ' às ' + dataAtual.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' });

    // 2. Build HTML Template
    const printWindow = window.open('', '_blank');
    printWindow.document.write(`
        <html>
        <head>
            <title>Orçamento #${orcId} - ORC STUDIO</title>
            <style>
                :root {
                    --text-primary: #1e293b;
                    --text-muted: #64748b;
                    --brand: #10b981;
                    --dark-bg: #0f172a;
                    --border-color: #e2e8f0;
                }
                body { 
                    font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; 
                    padding: 0; 
                    margin: 0;
                    color: var(--text-primary);
                }
                .page-container {
                    padding: 40px;
                    max-width: 800px;
                    margin: 0 auto;
                }
                .header { 
                    background-color: var(--dark-bg);
                    color: white;
                    padding: 30px 40px;
                    display: flex;
                    justify-content: space-between;
                    align-items: center;
                }
                .header h1 { margin: 0; font-size: 24px; letter-spacing: 1px; }
                .header p { margin: 5px 0 0 0; color: #cbd5e1; font-size: 14px; }
                .header-id { margin: 0; color: var(--brand); font-size: 28px; }
                
                .info-section { 
                    display: flex; 
                    justify-content: space-between; 
                    margin: 30px 0;
                    padding-bottom: 20px;
                    border-bottom: 2px solid var(--border-color);
                }
                .info-box { flex: 1; }
                .info-box h3 { margin: 0 0 10px 0; color: var(--text-muted); font-size: 12px; text-transform: uppercase; letter-spacing: 0.5px; }
                .info-box p { margin: 6px 0; font-size: 15px; }
                
                table { 
                    width: 100%; 
                    border-collapse: collapse; 
                    margin-top: 20px; 
                }
                th { 
                    background-color: #f8fafc; 
                    color: var(--text-primary);
                    border-bottom: 2px solid var(--border-color);
                    padding: 12px; 
                    text-align: left; 
                    font-size: 14px;
                }
                td { 
                    border-bottom: 1px solid var(--border-color); 
                    padding: 12px; 
                    text-align: left; 
                    font-size: 14px;
                }
                .text-right { text-align: right; }
                .text-center { text-align: center; }
                
                .total-section { 
                    margin-top: 30px; 
                    text-align: right; 
                    padding: 20px;
                    background-color: #f8fafc;
                    border-radius: 6px;
                    border: 1px solid var(--border-color);
                }
                .total-section p { margin: 0; font-size: 14px; color: var(--text-muted); text-transform: uppercase; }
                .total-section h2 { margin: 5px 0 0 0; color: var(--brand); font-size: 28px; }
                
                .footer {
                    margin-top: 50px;
                    text-align: center;
                    font-size: 12px;
                    color: var(--text-muted);
                }
            </style>
        </head>
        <body>
            <div class="header">
                <div>
                    <h1>ORC STUDIO</h1>
                    <p>Orçamento de Produtos / Serviços</p>
                </div>
                <div class="text-right">
                    <h2 class="header-id">#${String(orcId).padStart(4, '0')}</h2>
                </div>
            </div>
            
            <div class="page-container">
                <div class="info-section">
                    <div class="info-box">
                        <h3>Dados do Cliente</h3>
                        <p><strong>Nome:</strong> ${orcData.cliente.nome_cliente}</p>
                    </div>
                    <div class="info-box text-right">
                        <h3>Detalhes do Documento</h3>
                        <p><strong>Emissão:</strong> ${dataEmissao}</p>
                        <p><strong>Validade:</strong> ${dataValidade}</p>
                    </div>
                </div>

                <table>
                    <thead>
                        <tr>
                            <th>Produto</th>
                            <th class="text-center">Qtd</th>
                            <th class="text-right">Vl. Unitário</th>
                            <th class="text-right">Subtotal</th>
                        </tr>
                    </thead>
                    <tbody>
                        ${items.map(i => `<tr>
                            <td>${i.produto.ds_produto}</td>
                            <td class="text-center">${i.qtd_produto}</td>
                            <td class="text-right">R$ ${parseFloat(i.vl_unitario_produto).toFixed(2)}</td>
                            <td class="text-right"><strong>R$ ${(i.qtd_produto * i.vl_unitario_produto).toFixed(2)}</strong></td>
                        </tr>`).join('')}
                    </tbody>
                </table>

                <div class="total-section">
                    <p>Total Geral do Orçamento</p>
                    <h2>R$ ${parseFloat(orcData.vl_total_orcamento).toFixed(2)}</h2>
                </div>

                <div class="footer">
                    <p>Documento gerado em ${dataGeracao} através do sistema ORC Studio.</p>
                </div>
            </div>
        </body>
        </html>
    `);

    printWindow.document.close();

    // Pequeno atraso para garantir que o navegador renderizou o CSS antes de abrir a janela de impressão
    setTimeout(() => {
        printWindow.print();
    }, 250);
}

// ==========================================
// LÓGICA DE EXPORTAÇÃO EXCEL (SheetJS)
// ==========================================

async function exportSingleOrcamento(orcId) {
    try {
        // Buscar Orçamento e Cliente
        const { data: orcData, error: orcErr } = await supabase
            .from('orcamento')
            .select(`*, cliente(nome_cliente)`)
            .eq('orcamentoid', orcId)
            .single();

        if (orcErr) throw orcErr;

        // Buscar Itens do Orçamento
        const { data: itemsData, error: itemsErr } = await supabase
            .from('item_orcamento')
            .select(`*, produto(ds_produto)`)
            .eq('orcamentoid', orcId);

        if (itemsErr) throw itemsErr;

        // Montar dados para o Excel
        const sheetData = itemsData.map(item => ({
            "Nº Orçamento": orcData.orcamentoid,
            "Cliente": orcData.cliente?.nome_cliente || "Desconhecido",
            "Data Emissão": new Date(orcData.dt_orcamento).toLocaleDateString('pt-BR'),
            "Data Validade": new Date(orcData.dt_validade_orcamento).toLocaleDateString('pt-BR'),
            "Produto": item.produto?.ds_produto || "Produto Removido",
            "Quantidade": item.qtd_produto,
            "Valor Unitário (R$)": parseFloat(item.vl_unitario_produto).toFixed(2),
            "Subtotal (R$)": (item.qtd_produto * parseFloat(item.vl_unitario_produto)).toFixed(2)
        }));

        // Adicionar linha de totalizador no final
        sheetData.push({
            "Nº Orçamento": "", "Cliente": "", "Data Emissão": "", "Data Validade": "", "Produto": "", "Quantidade": "",
            "Valor Unitário (R$)": "TOTAL GERAL:",
            "Subtotal (R$)": parseFloat(orcData.vl_total_orcamento).toFixed(2)
        });

        // Gerar e baixar
        const ws = XLSX.utils.json_to_sheet(sheetData);
        const wb = XLSX.utils.book_new();
        XLSX.utils.book_append_sheet(wb, ws, `Orcamento_${orcId}`);
        XLSX.writeFile(wb, `Orcamento_${orcId}.xlsx`);

    } catch (error) {
        alert("Erro ao exportar orçamento: " + error.message);
    }
}

async function exportPeriodOrcamentos() {
    const startDate = document.getElementById('export-start-date').value;
    const endDate = document.getElementById('export-end-date').value;

    if (!startDate || !endDate) {
        alert("Por favor, selecione as datas de Início e Fim para exportar.");
        return;
    }

    try {
        // Query de orçamentos no período
        const { data, error } = await supabase
            .from('orcamento')
            .select(`orcamentoid, dt_orcamento, dt_validade_orcamento, vl_total_orcamento, cliente ( nome_cliente )`)
            .gte('dt_orcamento', `${startDate}T00:00:00.000Z`)
            .lte('dt_orcamento', `${endDate}T23:59:59.999Z`)
            .order('dt_orcamento', { ascending: true });

        if (error) throw error;

        if (!data || data.length === 0) {
            alert("Nenhum orçamento encontrado neste período.");
            return;
        }

        // NOVO: Pegar a data de hoje zerada (apenas dia/mês/ano) para comparar
        const hoje = new Date();
        hoje.setHours(0, 0, 0, 0);

        const sheetData = data.map(o => {
            // NOVO: Lógica de status (mesma usada na renderização da tabela)
            const dataValidade = new Date(o.dt_validade_orcamento);
            dataValidade.setHours(0, 0, 0, 0);
            const statusTexto = hoje > dataValidade ? "Expirado" : "Válido";

            return {
                "Nº Orçamento": o.orcamentoid,
                "Cliente": o.cliente?.nome_cliente || 'Desconhecido',
                "Data Emissão": new Date(o.dt_orcamento).toLocaleDateString('pt-BR'),
                "Data Validade": new Date(o.dt_validade_orcamento).toLocaleDateString('pt-BR'),
                "Valor Total (R$)": parseFloat(o.vl_total_orcamento).toFixed(2),
                "Status": statusTexto // Nova coluna adicionada ao final
            };
        });

        const ws = XLSX.utils.json_to_sheet(sheetData);
        const wb = XLSX.utils.book_new();
        XLSX.utils.book_append_sheet(wb, ws, "Relatório Período");
        XLSX.writeFile(wb, `Relatorio_Orcamentos_${startDate}_a_${endDate}.xlsx`);

    } catch (error) {
        alert("Erro ao exportar período: " + error.message);
    }
}

async function performSearch() {
    const term = document.getElementById('search-orcamento-buscar').value.trim();
    const useId = document.getElementById('check-id').checked;
    const useNome = document.getElementById('check-nome').checked;
    const startDate = document.getElementById('export-start-date').value;
    const endDate = document.getElementById('export-end-date').value;

    const tbody = document.getElementById('table-orcamentos-body');
    tbody.innerHTML = `<tr><td colspan="7" style="text-align:center;">Pesquisando...</td></tr>`;

    // Start query and filter out empty clients
    let query = supabase
        .from('orcamento')
        .select(`orcamentoid, dt_orcamento, dt_validade_orcamento, vl_total_orcamento, cliente ( nome_cliente )`)
        .not('clienteid', 'is', null);

    // 1. Apply Date Range Filters (if filled)
    if (startDate) {
        query = query.gte('dt_orcamento', `${startDate}T00:00:00.000Z`);
    }
    if (endDate) {
        query = query.lte('dt_orcamento', `${endDate}T23:59:59.999Z`);
    }

    // 2. Apply Search Term Filters (if filled)
    if (term) {
        if (useId && useNome) {
            query = query.or(`orcamentoid.eq.${parseInt(term) || 0},cliente.nome_cliente.ilike.%${term}%`);
        } else if (useId) {
            query = query.eq('orcamentoid', parseInt(term) || 0);
        } else if (useNome) {
            query = query.ilike('cliente.nome_cliente', `%${term}%`);
        }
    }

    // Execute query
    const { data, error } = await query.order('orcamentoid', { ascending: false });

    if (error) {
        alert("Erro na busca: " + error.message);
        return;
    }

    // Safety check: ensure no null clients slip through
    const filteredData = data.filter(o => o.cliente !== null);
    renderOrcamentosTable(filteredData);
}

export function initOrcamentos() {
    loadOrcamentoFormDropdowns();
    fetchOrcamentos();

    const btnSearch = document.getElementById('btn-search-trigger');
    const filters = document.querySelectorAll('.search-filter');

    // Enable button ONLY when EXACTLY ONE checkbox is checked
    const updateBtnState = () => {
        const checkId = document.getElementById('check-id').checked;
        const checkNome = document.getElementById('check-nome').checked;

        // isExactlyOneChecked will be true ONLY if one is true and the other is false
        const isExactlyOneChecked = (checkId && !checkNome) || (!checkId && checkNome);

        btnSearch.disabled = !isExactlyOneChecked;

        // Visual feedback for the disabled state
        btnSearch.style.opacity = isExactlyOneChecked ? "1" : "0.5";
        btnSearch.style.cursor = isExactlyOneChecked ? "pointer" : "not-allowed";
    };

    filters.forEach(f => f.addEventListener('change', updateBtnState));

    btnSearch.addEventListener('click', performSearch);

    const validadeInput = document.getElementById('orc-validade');
    if (validadeInput) {
        validadeInput.min = getTodayString();
        validadeInput.addEventListener('change', validateValidade);
    }

    const searchInput = document.getElementById('search-orcamento');
    searchInput?.addEventListener('input', (e) => {
        const term = e.target.value.toLowerCase().trim();
        const filtered = localOrcamentos.filter(o => {
            const clienteNome = o.cliente?.nome_cliente?.toLowerCase() || '';
            return o.orcamentoid.toString().includes(term) || clienteNome.includes(term);
        });
        renderOrcamentosTable(filtered);
    });

    const btnAddItem = document.getElementById('btn-add-item');
    btnAddItem?.addEventListener('click', () => {
        const selectProd = document.getElementById('orc-item-produto');
        const inputQtd = document.getElementById('orc-item-qtd');

        if (!selectProd.value) return alert('Selecione um produto.');

        const option = selectProd.options[selectProd.selectedIndex];
        currentOrcamentoItens.push({
            produtoid: parseInt(selectProd.value),
            descricao: option.text,
            preco: parseFloat(option.getAttribute('data-preco')),
            quantidade: parseInt(inputQtd.value)
        });

        renderProvisorioTable();
    });

    const btnDiscard = document.getElementById('btn-discard-orc');
    btnDiscard?.addEventListener('click', () => {
        resetOrcamentoForm();
    });

    // NOVO: Listener para Exportar Período
    const btnExportPeriod = document.getElementById('btn-export-period');
    btnExportPeriod?.addEventListener('click', exportPeriodOrcamentos);

    const formOrcamento = document.getElementById('form-orcamento');
    formOrcamento?.addEventListener('submit', async (e) => {
        e.preventDefault();

        const orcId = document.getElementById('orc-id').value;
        const clienteId = document.getElementById('orc-cliente').value;
        const dataValidade = document.getElementById('orc-validade').value;

        if (currentOrcamentoItens.length === 0) {
            alert("Adicione pelo menos um produto ao orçamento antes de salvar.");
            return;
        }

        if (!validateValidade()) {
            alert("A data de validade deve ser posterior à data de hoje.");
            document.getElementById('orc-validade').focus();
            return;
        }

        const totalGeral = currentOrcamentoItens.reduce((sum, item) => sum + (item.preco * item.quantidade), 0);

        const payloadOrcamento = {
            clienteid: parseInt(clienteId),
            dt_validade_orcamento: dataValidade,
            vl_total_orcamento: totalGeral
        };

        try {
            if (orcId) {
                // 1. Atualiza apenas o cabeçalho (data, valor total, cliente)
                const { error: errorOrc } = await supabase
                    .from('orcamento')
                    .update(payloadOrcamento)
                    .eq('orcamentoid', parseInt(orcId));

                if (errorOrc) throw errorOrc;

                // 2. Chama o RPC para deletar/inserir os itens de forma atômica
                const payloadItens = currentOrcamentoItens.map(item => ({
                    produtoid: item.produtoid,
                    qtd_produto: item.quantidade,
                    vl_unitario_produto: item.preco
                }));

                const { error: rpcError } = await supabase.rpc('update_orcamento_items', {
                    p_orcamentoid: parseInt(orcId),
                    p_items: payloadItens // Supabase converte array JS para jsonb automaticamente
                });

                if (rpcError) throw rpcError;

                alert(`Orçamento #${orcId} atualizado com sucesso!`);
            }
            else {
                payloadOrcamento.dt_orcamento = new Date().toISOString();

                const { data: novoOrc, error: errorNovoOrc } = await supabase
                    .from('orcamento')
                    .insert([payloadOrcamento])
                    .select();

                if (errorNovoOrc) throw errorNovoOrc;
                const novoOrcId = novoOrc[0].orcamentoid;

                const payloadItens = currentOrcamentoItens.map(item => ({
                    orcamentoid: novoOrcId,
                    produtoid: item.produtoid,
                    qtd_produto: item.quantidade,
                    vl_unitario_produto: item.preco
                }));

                const { error: errorNovoItens } = await supabase.from('item_orcamento').insert(payloadItens);
                if (errorNovoItens) throw errorNovoItens;

                alert("Orçamento emitido com sucesso!");
            }

            resetOrcamentoForm();
            await fetchOrcamentos();

        } catch (err) {
            console.error("Erro na transação de orçamento:", err);
            alert("Falha ao salvar as informações: " + err.message);
        }

        //Allow pressing "Enter" in the search box to trigger the search
        document.getElementById('search-orcamento-buscar')?.addEventListener('keypress', (e) => {
            if (e.key === 'Enter' && !btnSearch.disabled) {
                performSearch();
            }
        });
    });

}